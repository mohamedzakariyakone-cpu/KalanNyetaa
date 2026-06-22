'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Capturer l'événement natif d'installation PWA envoyé par le navigateur
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Vérifier si l'utilisateur n'a pas fermé la bannière pour cette session
      const isDismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Si l'application est déjà installée et ouverte en mode autonome (App), on la cache
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Déclencher instantanément la boîte de dialogue d'installation du navigateur
    deferredPrompt.prompt();

    // Attendre le choix de l'utilisateur
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    
    // Nettoyer l'événement
    setDeferredPrompt(null);
  };

  const handleCloseBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="pwa-install-banner fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-white border border-slate-200 rounded-[2rem] p-5 shadow-[0_20px_50px_rgba(23,99,255,0.15)] z-[9999] transition-all duration-300 animate-pop-in">
      <div className="flex gap-4 items-start relative">
        <button 
          onClick={handleCloseBanner}
          className="absolute -top-1 -right-1 p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-blue-50 transition-colors"
        >
          <X size={12} />
        </button>

        <div className="h-12 w-12 bg-gradient-to-br from-[#1763FF] to-[#00246B] text-white rounded-2xl flex items-center justify-center text-lg font-black shadow-md shrink-0">
          K
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight leading-tight">
            Installer KalanNyetaa
          </h4>
          <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-relaxed">
            Ajoutez l'application sur votre écran d'accueil pour un accès instantané.
          </p>
        </div>
      </div>

      <button
        onClick={handleInstallClick}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-[#1763FF] text-white px-4 py-3.5 rounded-xl text-[10px] font-black uppercase hover:bg-[#1252D4] transition-all shadow-md shadow-blue-500/10 active:scale-98"
      >
        <Download size={13} /> Télécharger l'application
      </button>
    </div>
  );
}