'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerServiceWorker = async () => {
        try {
          if ((window as any).serwist && typeof (window as any).serwist.register === 'function') {
            await (window as any).serwist.register();
            console.log('Service Worker Serwist enregistré avec succès.');
            return;
          }

          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });
          console.log('Service Worker enregistré avec succès:', registration);
        } catch (error) {
          console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
        }
      };

      if (document.readyState === 'complete') {
        registerServiceWorker();
      } else {
        window.addEventListener('load', registerServiceWorker);
        return () => window.removeEventListener('load', registerServiceWorker);
      }
    }
  }, []);

  return null;
}
