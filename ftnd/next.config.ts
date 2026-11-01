import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a separate local dev server use its own cache when the default .next/dev lock is stale.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
