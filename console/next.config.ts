import type { NextConfig } from "next";

// "standalone" output is for Docker only. Vercel manages its own output format.
// This detects Vercel at build time (VERCEL env var is set automatically).
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  ...(isVercel ? {} : { output: "standalone" }),
  devIndicators: false,
};

export default nextConfig;
