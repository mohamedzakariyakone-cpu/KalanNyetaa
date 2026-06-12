import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  disable: process.env.NODE_ENV === "development",
  scope: "/",
  reloadOnOnline: true,
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.198.67'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
  },
};

export default withSerwist(nextConfig);
