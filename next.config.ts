import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  // 🪄 Correction finale : Un simple booléen forcé à false pour vos tests locaux
  disable: process.env.NODE_ENV === "development" ? false : false, 
  scope: "/",
  reloadOnOnline: true,
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  // Prise en compte de votre adresse IP locale actuelle (.1.6)
  allowedDevOrigins: ['192.168.1.6', '192.168.1.5'],

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
