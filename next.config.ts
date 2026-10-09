import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.prydwen.gg',
      },
      {
        protocol: 'https',
        hostname: 'api.encore.moe',
      },
    ],
  },
};

export default nextConfig;
