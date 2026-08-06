import Link from "next/link";
import { Settings, ExternalLink } from "lucide-react";
import FooterBar from "@/components/FooterBar";

const RESOURCE_LINKS = [
  { id: "ai-rocks",   title: "AI Rocks",   url: "https://ai.atko.rocks/blueprint" },
  { id: "mcp-bridge", title: "MCP Bridge", url: "https://admin.ai-patterns.oktademo.app/" },
  { id: "okta",       title: "Okta",       url: "https://demo-ai-patterns.oktapreview.com/" },
  { id: "whiteboard", title: "Whiteboard", url: "https://okta-ai-diagram.vercel.app/" },
  { id: "xaa-dev",    title: "XAA Dev",    url: "https://xaa.dev/" },
];

export default function TopBar() {
  return (
    <div
      className="flex w-full items-center justify-between px-5 py-2"
      style={{ borderBottom: "1px solid rgba(22,98,221,0.18)" }}
    >
      {/* Left: Okta wordmark */}
      <div className="flex items-center gap-3">
        <OktaMark />
        <div className="hidden sm:flex flex-col leading-none">
          <span className="text-[11px] font-semibold text-white/90 tracking-wide">AI Patterns</span>
          <span className="text-[9px] text-white/30 uppercase tracking-[0.15em]">Demo Console</span>
        </div>
        <div
          className="mx-2 hidden sm:block h-5 w-px"
          style={{ background: "linear-gradient(to bottom, transparent, rgba(22,98,221,0.3), transparent)" }}
        />
        <FooterBar />
      </div>

      {/* Right: resource links + settings */}
      <div className="flex items-center gap-1.5">
        {RESOURCE_LINKS.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all duration-200
              border border-[rgba(22,98,221,0.2)] bg-[rgba(22,98,221,0.05)] text-[rgba(160,185,240,0.7)]
              hover:border-[rgba(22,98,221,0.5)] hover:bg-[rgba(22,98,221,0.12)] hover:text-blue-300"
          >
            <ExternalLink size={9} />
            {link.title}
          </a>
        ))}

        <div className="mx-1 h-4 w-px bg-white/5" />

        <Link
          href="/settings"
          className="rounded p-1 text-white/20 hover:text-blue-400 transition-colors"
          title="Settings"
        >
          <Settings size={13} />
        </Link>
      </div>
    </div>
  );
}

function OktaMark() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-label="Okta">
        <defs>
          <linearGradient id="tb-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1662DD" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <circle cx="11" cy="11" r="9.5" stroke="url(#tb-grad)" strokeWidth="2" />
        <circle cx="11" cy="11" r="3.5" fill="url(#tb-grad)" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-white" style={{ letterSpacing: "-0.01em" }}>
        okta
      </span>
    </div>
  );
}
