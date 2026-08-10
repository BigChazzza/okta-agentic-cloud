"use client";

import { useEffect, useState, useCallback } from "react";
import { KeyRound, Eye, EyeOff, ArrowRight, ExternalLink } from "lucide-react";

const STORAGE_KEY = "okta-demo-credentials";

function hasValidKey(): boolean {
  if (typeof window === "undefined") return true; // SSR — don't block
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const creds = JSON.parse(raw);
    const key =
      creds.provider === "openai"   ? creds.openaiKey   :
      creds.provider === "litellm"  ? creds.litellmKey  :
      creds.anthropicKey;
    return typeof key === "string" && key.trim().length > 10;
  } catch {
    return false;
  }
}

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [gated, setGated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!hasValidKey()) setGated(true);
  }, []);

  const onKeyAdded = useCallback(() => {
    if (hasValidKey()) setGated(false);
  }, []);

  if (!mounted) return <>{children}</>;
  if (!gated) return <>{children}</>;

  return (
    <>
      {/* Blur the content behind but keep it mounted */}
      <div className="pointer-events-none select-none blur-sm brightness-50" aria-hidden>
        {children}
      </div>
      <ApiKeyModal onSaved={onKeyAdded} />
    </>
  );
}

/* ── Modal ───────────────────────────────────────────── */

function ApiKeyModal({ onSaved }: { onSaved: () => void }) {
  const [provider, setProvider] = useState<"anthropic" | "openai" | "litellm">("anthropic");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const placeholder =
    provider === "anthropic" ? "sk-ant-api03-…" :
    provider === "openai"    ? "sk-proj-…"       :
    "Enter your LiteLLM key…";

  const isValid =
    provider === "anthropic" ? key.trim().startsWith("sk-ant") && key.trim().length > 20 :
    provider === "openai"    ? key.trim().startsWith("sk-") && key.trim().length > 20 :
    key.trim().length > 10;

  function save() {
    if (!isValid) {
      setError(
        provider === "anthropic" ? "Anthropic keys start with sk-ant-api03-" :
        provider === "openai"    ? "OpenAI keys start with sk-" :
        "Please enter a valid LiteLLM key"
      );
      return;
    }
    try {
      const existing = JSON.parse(sessionStorage.getItem("okta-demo-credentials") ?? "{}");
      const updated = {
        provider,
        anthropicKey: provider === "anthropic" ? key.trim() : (existing.anthropicKey ?? ""),
        openaiKey:    provider === "openai"    ? key.trim() : (existing.openaiKey ?? ""),
        litellmKey:   provider === "litellm"   ? key.trim() : (existing.litellmKey ?? ""),
        slackToken:   existing.slackToken ?? "",
        slackChannel: existing.slackChannel ?? "",
      };
      sessionStorage.setItem("okta-demo-credentials", JSON.stringify(updated));
      onSaved();
    } catch {
      setError("Could not save key — please check your browser settings.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#020A1C]/90 backdrop-blur-md" />

      <div className="relative w-full max-w-[400px] rounded-2xl border border-white/[0.08] bg-[#04122E]/90 p-8 shadow-2xl backdrop-blur-md">
        {/* Background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -top-20 -left-20 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-violet-700/8 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <defs>
                <linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1662DD" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              <circle cx="13" cy="13" r="11.5" stroke="url(#kg)" strokeWidth="2" />
              <circle cx="13" cy="13" r="4.5" fill="url(#kg)" />
            </svg>
            <span className="text-[18px] font-semibold tracking-tight text-white">okta</span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-blue-300/50">
            AI Patterns Demo
          </span>
        </div>

        {/* Heading */}
        <div className="mb-1 flex items-center justify-center gap-2">
          <KeyRound size={15} className="text-blue-400" />
          <h2 className="text-[15px] font-semibold text-white">LLM API Key Required</h2>
        </div>
        <p className="mb-6 text-center text-[12px] leading-relaxed text-slate-400">
          The AI agents in this demo call Claude, GPT-4, or your LiteLLM proxy. Add your key — it
          stays in your browser session only and is never sent to any server.
        </p>

        {/* Provider toggle */}
        <div className="mb-4 flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-1">
          {(["anthropic", "openai", "litellm"] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setProvider(p); setKey(""); setError(""); }}
              className={`flex-1 rounded-md py-1.5 text-[12px] font-medium transition-all ${
                provider === p
                  ? "text-white shadow"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              style={provider === p ? {
                background: "linear-gradient(135deg, rgba(22,98,221,0.5), rgba(124,58,237,0.4))",
              } : {}}
            >
              {p === "anthropic" ? "Anthropic" : p === "openai" ? "OpenAI" : "LiteLLM"}
            </button>
          ))}
        </div>

        {/* Key input */}
        <div className="mb-2">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(""); }}
              placeholder={placeholder}
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border bg-white/[0.04] px-3 py-2.5 pr-10 text-[13px] text-white outline-none transition-all placeholder:text-slate-600"
              style={{
                borderColor: error ? "rgba(239,68,68,0.5)" : "rgba(22,98,221,0.25)",
                fontFamily: "var(--font-geist-mono, monospace)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(22,98,221,0.6)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = error ? "rgba(239,68,68,0.5)" : "rgba(22,98,221,0.25)")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
        </div>

        {/* Save button */}
        <button
          onClick={save}
          disabled={key.trim().length < 10}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: key.trim().length >= 10
              ? "linear-gradient(135deg, #1662DD, #7C3AED)"
              : "rgba(255,255,255,0.05)",
            border: "1px solid rgba(22,98,221,0.3)",
          }}
        >
          Save and continue
          <ArrowRight size={14} />
        </button>

        {/* Footer link */}
        <p className="mt-5 text-center text-[11px] text-slate-600">
          Don&apos;t have a key?{" "}
          <a
            href={
            provider === "anthropic" ? "https://console.anthropic.com/keys" :
            provider === "openai"    ? "https://platform.openai.com/api-keys" :
            "https://docs.litellm.ai/docs/proxy/virtual_keys"
          }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-blue-500/70 hover:text-blue-400 transition-colors"
          >
            Get one here <ExternalLink size={10} />
          </a>
        </p>
      </div>
    </div>
  );
}
