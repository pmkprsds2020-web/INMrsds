import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" hanya diperlukan untuk self-host (Bun/Caddy).
  // Di Vercel, standalone tidak dibutuhkan dan malah bikin build error
  // (Vercel punya sistem serverless/file-tracing sendiri).
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["0.0.0.0", "http://0.0.0.0:81"],
};

export default nextConfig;
