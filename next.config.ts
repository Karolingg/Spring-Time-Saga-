import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/simulate",
        destination: "/map",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

