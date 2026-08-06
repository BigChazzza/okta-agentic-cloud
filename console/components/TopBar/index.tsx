import Link from "next/link";
import { Settings, ExternalLink } from "lucide-react";
import FooterBar from "@/components/FooterBar";

const RESOURCE_LINKS = [
  { id: "ai-rocks",   title: "AI Rocks",   url: "https://ai.atko.rocks/blueprint" },
  { id: "mcp-bridge", title: "MCP Bridge", url: "https://admin.ai-patterns.oktademo.app/" },
  { id: "okta",       title: "Okta",       url: "https://demo-ai-patterns.oktapreview.com/" },
  { id: "whiteboard", title: "Whiteboard", url: "https://okta-ai-diagram.vercel.app/" },
];

export default function TopBar() {
  return (
    <div className="flex w-full items-center justify-between px-5 py-2 border-b border-white/5">
      <FooterBar />

      <div className="flex items-center gap-2">
        {RESOURCE_LINKS.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
          >
            <ExternalLink size={9} />
            {link.title}
          </a>
        ))}
        <Link
          href="/settings"
          className="rounded p-1 text-white/20 hover:text-cyan-400 transition-colors"
          title="Settings"
        >
          <Settings size={13} />
        </Link>
      </div>
    </div>
  );
}
