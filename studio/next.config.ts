import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large file uploads for admin sync
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  // API route body size limit
  api: {
    bodyParser: {
      sizeLimit: "200mb",
    },
  } as Record<string, unknown>,
};

export default nextConfig;
