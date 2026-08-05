import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // "standalone" is for Docker. Vercel uses its own output — remove when deploying to Vercel.
  // Keep for local Docker dev; override with NEXT_OUTPUT=export env var for Vercel if needed.
  output: (process.env.NEXT_OUTPUT as NextConfig["output"]) ?? "standalone",
  devIndicators: false,
  // Allow streaming responses from Render backend agents
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3020", process.env.NEXTAUTH_URL ?? ""].filter(Boolean),
    },
  },
};

export default nextConfig;
