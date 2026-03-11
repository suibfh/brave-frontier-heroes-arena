import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/bfh/:path*",
        destination: "https://api.bravefrontierheroes.com/:path*",
      },
    ];
  },
};

export default nextConfig;