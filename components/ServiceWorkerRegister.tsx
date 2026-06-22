'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegister() {
  const [swRegistered, setSwRegistered] = useState(false);
  const [swError, setSwError] = useState<string | null>(null);

  useEffect(() => {
    // Enregistrer le Service Worker uniquement si le navigateur le supporte
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
        })
        .then((registration) => {
          console.log('Service Worker enregistré avec succès:', registration);
          setSwRegistered(true);

          // Vérifier les mises à jour toutes les heures
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);

          // Écouter les mises à jour
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Nouvelle version du Service Worker disponible');
                  // Vous pouvez afficher une notification ici
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
          setSwError(error.message);
        });
    } else {
      console.warn('Les Service Workers ne sont pas supportés par ce navigateur');
    }
  }, []);

  // Ce composant ne rend rien, il gère juste l'enregistrement
  return null;
}
