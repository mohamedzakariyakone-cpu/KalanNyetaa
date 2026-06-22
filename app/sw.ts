import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry } from "serwist";
import { Serwist, CacheFirst, NetworkOnly, StaleWhileRevalidate } from "serwist";

// 1. Déclarations des types globaux
declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Ligne obligatoire pour le bundler
const manifest = self.__SW_MANIFEST;

// 2. Configuration des stratégies de cache avec Serwist
const serwist = new Serwist({
  precacheEntries: manifest,
  skipWaiting: true,
  clientsClaim: true,
  // 🪄 Correction 1 : Désactivé ou géré proprement si non requis explicitement en dev local
  navigationPreload: false, 

  runtimeCaching: [
    // API Supabase - Stale-While-Revalidate pour les GET (Détection dynamique du domaine)
    {
      matcher: ({ url, request }) => {
        return url.origin.includes(".supabase.co") && request.method === "GET";
      },
      handler: new StaleWhileRevalidate({
        cacheName: "supabase-api-cache",
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => response,
          }
        ]
      }),
    },

    // API Supabase POST/PUT/DELETE - Network only (pas de cache)
    {
      matcher: ({ url, request }) => {
        return (
          url.origin.includes(".supabase.co") &&
          (request.method === "POST" || request.method === "PUT" || request.method === "DELETE")
        );
      },
      handler: new NetworkOnly({
        networkTimeoutSeconds: 10,
      }),
    },

    // Images externes - Cache first
    {
      matcher: ({ url }) => url.origin === "https://ui-avatars.com",
      handler: new CacheFirst({
        cacheName: "external-images-cache",
      }),
    },

    // Assets statiques (JS, CSS) - Cache first
    {
      matcher: ({ request }) =>
        request.destination === "style" || request.destination === "script" || request.destination === "font",
      handler: new CacheFirst({
        cacheName: "static-assets-cache",
      }),
    },

    // Documents HTML - Stale-While-Revalidate
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new StaleWhileRevalidate({
        cacheName: "html-pages-cache",
      }),
    },

    // Autres requêtes par défaut
    ...defaultCache,
  ],

  // Gestion de la page offline
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// 3. Événement pour gérer les messages du client
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "SYNC_OFFLINE_DATA") {
    event.waitUntil(
      (async () => {
        try {
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({
              type: "SYNC_OFFLINE_DATA_REQUEST",
              timestamp: Date.now(),
            });
          });
        } catch (error) {
          console.error("Erreur lors du sync en arrière-plan:", error);
        }
      })()
    );
  }

  if (event.data.type === "BACKGROUND_PRELOAD") {
    event.waitUntil(
      (async () => {
        try {
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({
              type: "BACKGROUND_PRELOAD_REQUEST",
              timestamp: Date.now(),
            });
          });
        } catch (error) {
          console.error("Erreur lors du préchargement en arrière-plan:", error);
        }
      })()
    );
  }
});

// 4. Nettoyage et enregistrement chaîné
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating & cleaning custom caches...");
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const cachesToDelete = cacheNames.filter(
        (name) =>
          !name.includes("supabase-api-cache") &&
          !name.includes("external-images-cache") &&
          !name.includes("static-assets-cache") &&
          !name.includes("html-pages-cache") &&
          !name.includes("serwist") &&
          !name.includes("workbox")
      );

      await Promise.all(cachesToDelete.map((name) => caches.delete(name)));
    })()
  );
});

// 5. Initialisation des écouteurs Serwist (gère l'activation en arrière-plan de manière sûre)
serwist.addEventListeners();