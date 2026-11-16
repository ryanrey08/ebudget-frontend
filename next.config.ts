import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Docker production builds set NEXT_OUTPUT=standalone (see Dockerfile), which
  // makes `next build` emit a self-contained server in .next/standalone with
  // only the node_modules it needs. Regular `npm run build` / `npm start` on the
  // host are unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
