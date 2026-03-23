import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
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