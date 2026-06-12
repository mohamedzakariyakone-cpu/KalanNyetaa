import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  ExpirationPlugin,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,

  runtimeCaching: [
    // Supabase API
    {
      matcher: ({ url }) => url.origin === 'https://your-supabase-url.supabase.co',
      handler: new CacheFirst({
        cacheName: 'supabase-api-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
          }),
        ],
      }),
    },

    // Images externes
    {
      matcher: ({ url }) => url.origin === 'https://ui-avatars.com',
      handler: new CacheFirst({
        cacheName: 'external-images-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
          }),
        ],
      }),
    },

    // Assets statiques
    {
      matcher: ({ request }) =>
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'font',
      handler: new CacheFirst({
        cacheName: 'static-assets-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
          }),
        ],
      }),
    },

    // Pages HTML
    {
      matcher: ({ request }) => request.destination === 'document',
      handler: new NetworkFirst({
        cacheName: 'html-pages-cache',
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 24 heures
          }),
        ],
      }),
    },

    ...defaultCache,
  ],

  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

// Gestion des messages de communication (Ex: Demande de synchronisation)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'SYNC_OFFLINE_DATA') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_OFFLINE_DATA_REQUEST',
            timestamp: Date.now(),
          });
        });
      })()
    );
  }
});

// Les événements standards 'install' et 'activate' restants sont optionnels 
// mais préservés s'ils sont nécessaires au cycle de vie de tes composants tiers.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Point d'entrée principal Serwist pour l'écoute globale
serwist.addEventListeners();