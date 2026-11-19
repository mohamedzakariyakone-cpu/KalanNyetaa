'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';


export default function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Action exécutée au clic sur "Mettre à jour maintenant"
  const applyUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      // 1. Vider uniquement les caches d'interface et de scripts obsolètes
      // On préserve "supabase-api-cache" et IndexedDB pour ne jamais perdre les saisies hors-ligne
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((name) => {
            if (
              name.includes('static-assets-cache') ||
              name.includes('html-pages-cache') ||
              name.includes('serwist') ||
              name.includes('next') ||
              name.includes('pages')
            ) {
              return caches.delete(name);
            }
            return Promise.resolve(false);
          })
        );
      }

      // 2. Activer le nouveau Service Worker en attente
      const registration = await navigator.serviceWorker?.getRegistration();
      const workerToActivate = waitingWorker || registration?.waiting;

      if (workerToActivate) {
        workerToActivate.postMessage({ type: 'SKIP_WAITING' });
        // Filet de sécurité si controllerchange met plus de 2 secondes à répondre
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour :', error);
      window.location.reload();
    }
  }, [isUpdating, waitingWorker]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Intercepteur anti-plantage (ChunkLoadError) si un ancien fichier JS n'existe plus sur le serveur
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const message =
        'reason' in event
          ? String(event.reason?.message || event.reason || '')
          : String(event.message || '');

      if (
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('Failed to fetch dynamically imported module')
      ) {
        setUpdateAvailable(true);
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('error', handleChunkError);
        window.removeEventListener('unhandledrejection', handleChunkError);
      };
    }

    let refreshing = false;
    let updateInterval: ReturnType<typeof setInterval>;

    // 2. Rechargement automatique dès que le nouveau Service Worker prend le contrôle
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // 3. Surveillance de l'enregistrement Serwist ou natif
    const attachUpdateListeners = (registration: ServiceWorkerRegistration) => {
      // Si une mise à jour est déjà téléchargée et en attente
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }

      // Si une nouvelle mise à jour arrive pendant que l'utilisateur est sur l'application
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });

      // Vérifier les nouvelles versions au retour sur l'app (smartphone/onglet) et toutes les 2 minutes
      const checkForUpdates = () => {
        registration.update().catch(() => {});
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkForUpdates();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      updateInterval = setInterval(checkForUpdates, 120000);
    };

    const register = async () => {
      try {
        let registration: ServiceWorkerRegistration | undefined;

        if (window.serwist?.register) {
          registration = await window.serwist.register();
          console.log('Service Worker Serwist enregistré avec succès.');
        }

        // Fallback ou récupération de l'enregistrement actif
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });
          console.log('Service Worker natif enregistré avec succès:', registration);
        }

        if (registration) {
          attachUpdateListeners(registration);
        }
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
      }
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }

    return () => {
      window.removeEventListener('load', register);
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  // Tant qu'il n'y a pas de nouvelle mise à jour, rien ne s'affiche
  if (!updateAvailable) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Icône */}
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto">
          <Sparkles size={26} />
        </div>

        {/* Texte */}
        <div className="space-y-2">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            Nouvelle version disponible
          </span>
          <h2
            id="pwa-update-title"
            className="text-xl font-black text-slate-900 tracking-tight"
          >
            Mise à jour requise
          </h2>
          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            Une nouvelle version de <strong>KalanNyetaa</strong> est prête. Cliquez sur le bouton ci-dessous pour appliquer les améliorations et éviter tout bug d&apos;affichage.
          </p>
        </div>

        {/* Garantie données */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50/70 border border-emerald-200/80 py-2 px-3 rounded-xl">
          <ShieldCheck size={14} className="shrink-0" />
          <span>Vos données enregistrées sont conservées</span>
        </div>

        {/* Bouton d'action unique et obligatoire */}
        <button
          type="button"
          onClick={applyUpdate}
          disabled={isUpdating}
          className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md disabled:opacity-70 cursor-pointer"
        >
          <RefreshCw size={16} className={isUpdating ? 'animate-spin' : ''} />
          <span>{isUpdating ? 'Installation en cours...' : 'Mettre à jour maintenant'}</span>
        </button>

      </div>
    </div>
  );
}