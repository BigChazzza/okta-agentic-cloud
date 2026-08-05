import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

// CORS — allow Vercel console URL and localhost dev
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",").map(s => s.trim()).filter(Boolean)
  .concat(["http://localhost:3020", "http://localhost:3000"]);

app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// patternId → Set of SSE response objects
const subscribers = new Map<string, Set<Response>>();

// patternId → recent events (last 100, replayed to new subscribers)
const BUFFER_SIZE = 100;
const recentEvents = new Map<string, object[]>();

function bufferEvent(patternId: string, event: object) {
  if (!recentEvents.has(patternId)) recentEvents.set(patternId, []);
  const buf = recentEvents.get(patternId)!;
  buf.push(event);
  if (buf.length > BUFFER_SIZE) buf.shift();
}

// POST /emit — pattern services push events here
// Body: { patternId, actor, action, target, detail?, tokenSnippet?, level? }
app.post("/emit", (req: Request, res: Response) => {
  const { patternId, actor, action, target, detail, tokenSnippet, token, level } = req.body as {
    patternId: string;
    actor: string;
    action: string;
    target: string;
    detail?: string;
    tokenSnippet?: string;
    token?: string;
    level?: "info" | "auth" | "token" | "error";
  };

  if (!patternId || !actor || !action || !target) {
    res.status(400).json({ error: "patternId, actor, action, target are required" });
    return;
  }

  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    patternId,
    timestamp: new Date().toISOString(),
    actor,
    action,
    target,
    ...(detail !== undefined && { detail }),
    ...(tokenSnippet !== undefined && { tokenSnippet }),
    ...(token !== undefined && { token }),
    level: level ?? "info",
  };

  bufferEvent(patternId, event);

  const subs = subscribers.get(patternId);
  if (subs) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of subs) {
      try {
        client.write(data);
      } catch {
        // client disconnected — will be cleaned up on close
      }
    }
  }

  res.json({ ok: true, delivered: subs?.size ?? 0 });
});

// GET /events/:patternId — console subscribes here via SSE
app.get("/events/:patternId", (req: Request, res: Response) => {
  const { patternId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx/proxy buffering on Render
  res.flushHeaders();

  // 25s heartbeat — keeps connection alive through Render's 30s idle proxy timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  if (!subscribers.has(patternId)) {
    subscribers.set(patternId, new Set());
  }
  subscribers.get(patternId)!.add(res);

  // Replay buffered events so reconnecting clients see what they missed
  const buffered = recentEvents.get(patternId) ?? [];
  for (const ev of buffered) {
    try {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    } catch { /* ignore */ }
  }

  req.on("close", () => {
    clearInterval(heartbeat);
    subscribers.get(patternId)?.delete(res);
    if (subscribers.get(patternId)?.size === 0) {
      subscribers.delete(patternId);
    }
  });
});

// DELETE /events/:patternId — clear buffer and notify connected clients (e.g. on logout)
app.delete("/events/:patternId", (req: Request, res: Response) => {
  const { patternId } = req.params;
  recentEvents.delete(patternId);
  const subs = subscribers.get(patternId);
  if (subs) {
    const data = `data: ${JSON.stringify({ type: "clear" })}\n\n`;
    for (const client of subs) {
      try { client.write(data); } catch { /* disconnected */ }
    }
  }
  res.json({ ok: true });
});

// GET /health — used by console and docker healthcheck
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, subscribers: Object.fromEntries(
    [...subscribers.entries()].map(([k, v]) => [k, v.size])
  ) });
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`event-bus listening on :${PORT}`);
});
