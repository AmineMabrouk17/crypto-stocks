import type { NextConfig } from "next";

// The Rust backend owns all of /api/*. There are no Next.js API route handlers.
// Local dev uses the local backend; production defaults to the supervised VPS
// service so a deploy works without a manual env var. BACKEND_ORIGIN overrides both.
const backendOrigin =
  process.env.BACKEND_ORIGIN ??
  (process.env.NODE_ENV === "production"
    ? "http://88.99.81.55:8080"
    : "http://127.0.0.1:8080");

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
