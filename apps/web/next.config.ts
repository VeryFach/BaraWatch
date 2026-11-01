import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  reactCompiler: true,
  allowedDevOrigins: ['daedal-nonirrevocably-odis.ngrok-free.dev'],
};

export default nextConfig;
