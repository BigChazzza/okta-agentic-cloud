"use client";

import { useEffect, useState, useCallback } from "react";

interface ServiceStatus {
  id: string;
  name: string;
  ready: boolean;
}

interface WarmupData {
  allReady: boolean;
  readyCount: number;
  total: number;
  services: ServiceStatus[];
}

interface Props {
  onReady: () => void;
}

export function ServiceWarmup({ onReady }: Props) {
  const [data, setData] = useState<WarmupData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const handleReady = useCallback(() => {
    if (!dismissed) {
      setDismissed(true);
      onReady();
    }
  }, [dismissed, onReady]);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/warmup");
      const json: WarmupData = await res.json();
      setData(json);
      if (json.allReady) {
        setTimeout(handleReady, 1_000);
      }
    } catch {
      // network error — keep showing
    }
  }, [handleReady]);

  useEffect(() => {
    check();
    const poll = setInterval(check, 6_000);
    const clock = setInterval(() => setElapsed((e) => e + 1), 1_000);
    const timeout = setTimeout(handleReady, 90_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      clearTimeout(timeout);
    };
  }, [check, handleReady]);

  const progress = data ? Math.round((data.readyCount / data.total) * 100) : 0;
  const allReady = data?.allReady ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020B1C]/96 backdrop-blur-sm">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-80 w-80 rounded-full bg-blue-600/12 blur-3xl" />
        <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-violet-700/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[360px] rounded-2xl border border-white/[0.07] bg-[#04122E]/80 p-8 shadow-2xl backdrop-blur-md">
        {/* Okta wordmark */}
        <div className="mb-7 flex flex-col items-center gap-2.5">
          <OktaMark />
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-blue-300/50">
            AI Patterns Demo
          </span>
        </div>

        {/* Heading */}
        <h2 className="mb-1 text-center text-[15px] font-semibold text-white">
          {allReady ? "All systems ready" : "Starting services…"}
        </h2>
        <p className="mb-6 text-center text-[12px] leading-relaxed text-slate-400">
          {allReady
            ? "Loading your demo now"
            : data
            ? `${data.total - data.readyCount} of ${data.total} service${data.total - data.readyCount !== 1 ? "s" : ""} still starting on Render`
            : "Checking service health…"}
        </p>

        {/* Progress bar */}
        <div className="mb-6 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${allReady ? 100 : progress}%`,
              background: allReady
                ? "linear-gradient(90deg, #1662DD, #22c55e)"
                : "linear-gradient(90deg, #1662DD, #7C3AED)",
            }}
          />
        </div>

        {/* Service list */}
        <ul className="space-y-2.5">
          {(data?.services ?? PLACEHOLDER_SERVICES).map((svc) => (
            <li key={svc.id} className="flex items-center gap-3">
              <StatusDot ready={svc.ready} checking={!data} />
              <span className="flex-1 text-[12px] text-slate-400">{svc.name}</span>
              {data ? (
                svc.ready ? (
                  <span className="text-[11px] font-medium text-emerald-400">Ready</span>
                ) : (
                  <span className="text-[11px] text-slate-600">Starting</span>
                )
              ) : (
                <span className="text-[11px] text-slate-700">Checking…</span>
              )}
            </li>
          ))}
        </ul>

        {/* Skip link — appears after 12 seconds */}
        {elapsed >= 12 && !allReady && (
          <button
            onClick={handleReady}
            className="mt-6 w-full text-center text-[11px] text-slate-600 transition-colors hover:text-slate-400"
          >
            Skip — continue without waiting →
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function StatusDot({ ready, checking }: { ready: boolean; checking: boolean }) {
  if (checking) {
    return <span className="h-1.5 w-1.5 rounded-full bg-slate-700 animate-pulse" />;
  }
  return ready ? (
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
  ) : (
    <span className="h-1.5 w-1.5 rounded-full bg-blue-500/50 animate-pulse" />
  );
}

function OktaMark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <defs>
          <linearGradient id="okta-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1662DD" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <circle cx="15" cy="15" r="13" stroke="url(#okta-grad)" strokeWidth="2.5" />
        <circle cx="15" cy="15" r="5" fill="url(#okta-grad)" />
      </svg>
      <span
        className="text-[22px] font-semibold tracking-tight text-white"
        style={{ letterSpacing: "-0.01em" }}
      >
        okta
      </span>
    </div>
  );
}

const PLACEHOLDER_SERVICES = [
  { id: "event-bus",        name: "Event Bus",        ready: false },
  { id: "inventory-server", name: "Inventory Server", ready: false },
  { id: "hr-server",        name: "HR Server",        ready: false },
  { id: "finance-server",   name: "Finance Server",   ready: false },
  { id: "p2-agent",         name: "P2 Agent",         ready: false },
  { id: "p3-agent",         name: "P3 Agent",         ready: false },
  { id: "p4-agent",         name: "P4 Agent",         ready: false },
  { id: "p6-agent",         name: "P6 Agent",         ready: false },
];
