import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SERVICES = [
  { id: "event-bus",        name: "Event Bus",        url: process.env.EVENT_BUS_INTERNAL_URL },
  { id: "inventory-server", name: "Inventory Server", url: process.env.INVENTORY_SERVER_URL },
  { id: "hr-server",        name: "HR Server",        url: process.env.HR_SERVER_URL },
  { id: "finance-server",   name: "Finance Server",   url: process.env.FINANCE_SERVER_URL },
  { id: "p2-agent",         name: "P2 Agent",         url: process.env.P2_AGENT_INTERNAL_URL },
  { id: "p3-agent",         name: "P3 Agent",         url: process.env.P3_AGENT_INTERNAL_URL },
  { id: "p4-agent",         name: "P4 Agent",         url: process.env.P4_AGENT_INTERNAL_URL },
  { id: "p6-agent",         name: "P6 Agent",         url: process.env.P6_AGENT_INTERNAL_URL },
];

export async function GET(_req: NextRequest) {
  const results = await Promise.allSettled(
    SERVICES.map(async (svc) => {
      if (!svc.url) return { ...svc, ready: false };
      try {
        const res = await fetch(`${svc.url}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(4_000),
        });
        return { ...svc, ready: res.ok };
      } catch {
        return { ...svc, ready: false };
      }
    })
  );

  const statuses = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { ...SERVICES[i], ready: false }
  );

  const readyCount = statuses.filter((s) => s.ready).length;

  return NextResponse.json({
    allReady: readyCount === SERVICES.length,
    readyCount,
    total: SERVICES.length,
    services: statuses.map(({ id, name, ready }) => ({ id, name, ready })),
  });
}
