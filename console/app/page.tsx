import { PatternCard } from "@/components/PatternCard";
import { PATTERNS } from "@/lib/patterns";
import { ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import { getIndustry, DEFAULT_INDUSTRY_ID } from "@/lib/industries";

export const revalidate = 0;

async function getActivePatterns(): Promise<Set<string>> {
  const active = new Set<string>();
  await Promise.allSettled(
    PATTERNS.filter((p) => p.agentUrl).map(async (p) => {
      try {
        const res = await fetch(`${p.agentUrl}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) active.add(p.id);
      } catch {
        // service not running — stays inactive
      }
    })
  );
  return active;
}

export default async function Home() {
  const cookieStore = await cookies();
  const industryId = cookieStore.get("demo_industry")?.value ?? DEFAULT_INDUSTRY_ID;
  const industry = getIndustry(industryId);
  const active = await getActivePatterns();

  return (
    <main className="relative min-h-screen px-6 py-8">
      {/* Header */}
      <div className="mx-auto mb-10 max-w-3xl text-center">
        {/* Eyebrow pill — Okta blue border */}
        <div
          className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-medium tracking-wide"
          style={{
            background: "rgba(22,98,221,0.1)",
            color: "#4B90F8",
            borderColor: "rgba(22,98,221,0.35)",
          }}
        >
          <ShieldCheck size={12} />
          Secure AI — Identity Patterns
        </div>

        {/* Main heading — Plus Jakarta Sans, Okta-style gradient */}
        <h1
          className="mb-4 font-extrabold leading-[1.1] tracking-tight"
          style={{
            fontFamily: "var(--font-jakarta, sans-serif)",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            background: "linear-gradient(135deg, #FFFFFF 30%, #A5C8FF 65%, #C4A8FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Okta{industryId !== DEFAULT_INDUSTRY_ID ? ` ${industry.label}` : ""} Agentic Demo
        </h1>

        <p className="mx-auto max-w-lg text-[15px] leading-relaxed text-slate-400">
          Production-ready patterns for securing AI agents with Okta. Select a
          pattern to see the live auth flow and interact with the agent.
        </p>
      </div>

      {/* Pattern grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {PATTERNS.filter((p) => !p.hidden).map((p) => (
          <PatternCard key={p.id} pattern={p} active={active.has(p.id)} />
        ))}
      </div>
    </main>
  );
}
