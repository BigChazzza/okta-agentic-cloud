import express from "express";

const PORT = Number(process.env.PORT ?? 4100);
const OKTA_DOMAIN = process.env.OKTA_DOMAIN ?? "";
const OKTA_API_TOKEN = process.env.OKTA_API_TOKEN ?? "";
const GATEWAY_WLP_ID = process.env.GATEWAY_WLP_ID ?? "";
const EVENT_BUS_URL = process.env.EVENT_BUS_URL ?? "http://localhost:4000";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const PATTERN_ID = "p1";

interface OktaLogTarget {
  id: string;
  type: string;
  displayName: string | null;
}

interface OktaLogEntry {
  uuid: string;
  published: string;
  eventType: string;
  outcome?: { result?: string };
  actor?: { displayName?: string };
  gatewayContext?: {
    capabilityName?: string;
    subject?: { alternateId?: string };
  };
  target?: OktaLogTarget[];
}

// Rolling window of recently-emitted UUIDs — guards against re-emitting
// entries that land again due to `since` boundary overlap between polls.
const seenUuids = new Set<string>();
const SEEN_UUIDS_MAX = 500;

function rememberUuid(uuid: string) {
  seenUuids.add(uuid);
  if (seenUuids.size > SEEN_UUIDS_MAX) {
    const oldest = seenUuids.values().next().value;
    if (oldest !== undefined) seenUuids.delete(oldest);
  }
}

// Start 2 minutes back on cold start so a fresh deploy doesn't replay a large backlog.
let sinceTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString();
let pollErrorCount = 0;
let lastPollAt: string | null = null;
let lastPollOk = true;

function mapLogEntryToEvent(entry: OktaLogEntry) {
  const targets = entry.target ?? [];
  const targetMcp = targets.find((t) => t.type === "TARGET_MCP_SERVER");
  const virtualMcp = targets.find((t) => t.type === "VIRTUAL_MCP_SERVER");
  const targetLabel = targetMcp?.displayName ?? virtualMcp?.displayName ?? "Agent Gateway";

  const capability = entry.gatewayContext?.capabilityName ?? "tool";
  const user = entry.gatewayContext?.subject?.alternateId;

  return {
    patternId: PATTERN_ID,
    actor: entry.actor?.displayName ?? "Agent Gateway",
    action: `called ${capability}`,
    target: targetLabel,
    detail: user ? `user=${user}` : undefined,
    level: entry.outcome?.result === "SUCCESS" ? "info" : "error",
  };
}

async function emitToEventBus(event: ReturnType<typeof mapLogEntryToEvent>) {
  try {
    await fetch(`${EVENT_BUS_URL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.warn("[gateway-log-poller] failed to emit to event-bus:", err);
  }
}

async function pollOnce(): Promise<void> {
  if (!OKTA_DOMAIN || !OKTA_API_TOKEN || !GATEWAY_WLP_ID) {
    console.warn("[gateway-log-poller] missing OKTA_DOMAIN, OKTA_API_TOKEN, or GATEWAY_WLP_ID — skipping poll");
    return;
  }

  const url = new URL(`https://${OKTA_DOMAIN}/api/v1/logs`);
  url.searchParams.set("filter", `target.id eq "${GATEWAY_WLP_ID}"`);
  url.searchParams.set("since", sinceTimestamp);
  url.searchParams.set("sortOrder", "ASCENDING");
  url.searchParams.set("limit", "100");

  let entries: OktaLogEntry[];
  try {
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `SSWS ${OKTA_API_TOKEN}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "(unreadable)");
      console.warn(`[gateway-log-poller] System Log API returned ${resp.status}: ${body.slice(0, 300)}`);
      pollErrorCount++;
      lastPollOk = false;
      return;
    }
    entries = (await resp.json()) as OktaLogEntry[];
  } catch (err) {
    console.warn("[gateway-log-poller] System Log API unreachable:", err);
    pollErrorCount++;
    lastPollOk = false;
    return;
  }

  lastPollOk = true;
  lastPollAt = new Date().toISOString();

  for (const entry of entries) {
    if (seenUuids.has(entry.uuid)) continue;
    rememberUuid(entry.uuid);
    await emitToEventBus(mapLogEntryToEvent(entry));
  }

  if (entries.length > 0) {
    // Advance `since` to the last entry's exact timestamp (not +1ms) — System Log
    // timestamps can collide at millisecond resolution, so re-fetching that exact
    // instant next poll is safe; the seenUuids guard above skips true duplicates.
    sinceTimestamp = entries[entries.length - 1].published;
  }
}

function startPolling() {
  pollOnce().catch((err) => console.warn("[gateway-log-poller] poll failed:", err));
  setInterval(() => {
    pollOnce().catch((err) => console.warn("[gateway-log-poller] poll failed:", err));
  }, POLL_INTERVAL_MS);
}

const app = express();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gateway-log-poller",
    configured: Boolean(OKTA_DOMAIN && OKTA_API_TOKEN && GATEWAY_WLP_ID),
    lastPollAt,
    lastPollOk,
    pollErrorCount,
    sinceTimestamp,
  });
});

app.listen(PORT, () => {
  console.log(`gateway-log-poller listening on :${PORT} (poll interval ${POLL_INTERVAL_MS}ms)`);
  startPolling();
});
