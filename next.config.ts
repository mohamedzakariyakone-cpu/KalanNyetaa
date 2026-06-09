import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // Désactivé en développement pour éviter que le cache ne bloque tes modifications en direct
  register: true,
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

export default withPWA(nextConfig);
