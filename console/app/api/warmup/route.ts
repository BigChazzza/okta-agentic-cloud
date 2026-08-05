import { NextRequest, NextResponse } from "next/server";

// All Render backend service health endpoints
const SERVICES = [
  process.env.EVENT_BUS_INTERNAL_URL,
  process.env.P2_AGENT_INTERNAL_URL,
  process.env.P3_AGENT_INTERNAL_URL,
  process.env.P4_AGENT_INTERNAL_URL,
  process.env.P6_AGENT_INTERNAL_URL,
  process.env.HR_SERVER_URL,
  process.env.FINANCE_SERVER_URL,
  process.env.INVENTORY_SERVER_URL,
].filter(Boolean) as string[];

export async function GET(_req: NextRequest) {
  // Fire-and-forget pings — we don't wait for them to succeed
  const pings = SERVICES.map((base) =>
    fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    }).catch(() => null)
  );

  // Wait up to 2s to report any that are already awake, then return
  const results = await Promise.allSettled(
    pings.map((p) =>
      Promise.race([
        p,
        new Promise<null>((res) => setTimeout(() => res(null), 2_000)),
      ])
    )
  );

  const statuses = SERVICES.map((url, i) => {
    const r = results[i];
    const name = url.split(".")[0].split("//")[1] ?? url;
    if (r.status === "fulfilled" && r.value && "ok" in r.value) {
      return { name, ok: (r.value as Response).ok };
    }
    return { name, ok: false };
  });

  // The background pings continue running — Vercel edge keeps them alive
  return NextResponse.json({ warming: true, statuses });
}
