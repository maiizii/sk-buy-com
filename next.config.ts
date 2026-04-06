import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/9.x/pixel-art/png",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/npm/@lobehub/icons-static-png@1.85.0/**",
      },
    ],
  },
};

export default nextConfig;
