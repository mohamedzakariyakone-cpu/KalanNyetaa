import { useEffect, useState } from 'react';

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
  }
}

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
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    const isMobile = isIOSDevice || isAndroidDevice;

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(!isMobile);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      window.deferredPrompt = event;
      setDeferredPrompt(event);
      setIsInstallable(true);

      const delay = isAndroidDevice ? 1000 : 3000;
      setTimeout(() => {
        setShowPrompt(true);
      }, delay);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const pendingPrompt = (window as any).deferredPrompt;
    if (pendingPrompt) {
      setDeferredPrompt(pendingPrompt as BeforeInstallPromptEvent);
      setIsInstallable(true);
      setShowPrompt(true);
    }

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
