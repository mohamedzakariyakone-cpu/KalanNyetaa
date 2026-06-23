import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  showPrompt: boolean;
  installApp: () => Promise<void>;
  dismissPrompt: () => void;
}

export function usePWAInstall(): PWAInstallState {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Détecter le type d'appareil
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    const isMobile = isIOSDevice || isAndroidDevice;

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(!isMobile);

    // Vérifier si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Écouter l'événement beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      setIsInstallable(true);
      
      // Sur Android, on veut être plus agressif pour l'affichage
      const isAndroidDevice = /android/.test(navigator.userAgent.toLowerCase());
      const delay = isAndroidDevice ? 1000 : 3000;

      setTimeout(() => {
        setShowPrompt(true);
      }, delay);
    };

    // Écouter l'événement d'installation réussie
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      console.warn('Installation prompt not available');
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('PWA installed successfully');
        setIsInstalled(true);
      } else {
        console.log('PWA installation dismissed');
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
      setIsInstallable(false);
    } catch (error) {
      console.error('Error during PWA installation:', error);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    // Attendre 24 heures avant de montrer à nouveau le prompt
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isDesktop,
    deferredPrompt,
    showPrompt,
    installApp,
    dismissPrompt,
  };
}
