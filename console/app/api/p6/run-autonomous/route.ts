import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

async function emitEvent(
  actor: string,
  action: string,
  target: string,
  detail?: string,
  token?: string,
  level: "info" | "auth" | "token" | "error" = "info",
) {
  const eventBusUrl = process.env.EVENT_BUS_URL;
  if (!eventBusUrl) return;
  await fetch(`${eventBusUrl}/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      patternId: "p6",
      timestamp: new Date().toISOString(),
      actor,
      action,
      target,
      detail,
      token,
      level,
    }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const { message, session_id } = (await req.json()) as { message: string; session_id?: string };

  await emitEvent("Console", "triggering autonomous mission", "P6 Agent", "POST /chat — no user token (CC mode)", undefined, "info");

  // Per the P6 design: no auth header — the agent mints its own CC tokens
  const agentUrl = process.env.P6_AGENT_INTERNAL_URL ?? "http://localhost:3600";
  const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };

  // Forward LLM credentials from browser settings so the agent can call the LLM
  const llmApiKey  = req.headers.get("x-llm-api-key");
  const llmProvider = req.headers.get("x-llm-provider");
  if (llmApiKey)   forwardHeaders["x-llm-api-key"]   = llmApiKey;
  if (llmProvider) forwardHeaders["x-llm-provider"]  = llmProvider;

  const slackChannel = req.headers.get("x-slack-channel");
  const slackToken   = req.headers.get("x-slack-token");
  if (slackChannel) forwardHeaders["x-slack-channel"] = slackChannel;
  if (slackToken)   forwardHeaders["x-slack-token"]   = slackToken;

  const chatResp = await fetch(`${agentUrl}/chat`, {
    method: "POST",
    headers: forwardHeaders,
    body: JSON.stringify({ message, session_id }),
  });

  if (!chatResp.ok || !chatResp.body) {
    const err = await chatResp.text().catch(() => `HTTP ${chatResp.status}`);
    await emitEvent("Console", "mission failed", "P6 Agent", err, undefined, "error");
    return NextResponse.json({ error: err }, { status: 502 });
  }

  return new NextResponse(chatResp.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
