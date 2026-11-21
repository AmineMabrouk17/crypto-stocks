import type { NextConfig } from "next";

// The Rust backend owns all of /api/*. There are no Next.js API route handlers.
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  transpilePackages: ["@crypto-stocks/lib"],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendOrigin}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
