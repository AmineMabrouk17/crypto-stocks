import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@crypto-stocks/lib"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
      },
    ],
  },
};

export default nextConfig;
