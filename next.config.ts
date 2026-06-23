import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  // 🪄 Correction : On désactive Serwist UNIQUEMENT en dev si besoin, 
  // mais surtout on laisse la production se builder proprement.
  disable: process.env.NODE_ENV === "development", 
  scope: "/",
  reloadOnOnline: true,
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.6', '192.168.1.5'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
  },

  // 🛠️ Nettoyage des eval-source-maps pour Chrome Mobile
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false; // Supprime complètement les outils de debug sur Vercel
    }
    return config;
  },
};

export default withSerwist(nextConfig);