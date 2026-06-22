'use client';

import { useEffect } from 'react';

export default function PWAInit() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker KalanNyetaa actif sur le scope:', reg.scope))
        .catch((err) => console.error('Erreur Service Worker KalanNyetaa:', err));
    }
  }, []);

  return null;
}