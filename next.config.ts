import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ollama is a local, trusted, loopback-only dependency. Keeping it server-side
  // means the browser can never reach it (report rule: do not put privileged
  // tools in browser-accessible code).
  env: {
    NEXT_PUBLIC_APP_NAME: "Murmur",
  },
};

export default nextConfig;