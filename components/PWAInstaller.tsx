'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Écouter l'événement d'installation native du navigateur
    const handleBeforeInstallPrompt = (e: Event) => {
      // Empêcher la boîte de dialogue automatique par défaut du navigateur
      e.preventDefault();
      // Stocker l'événement pour pouvoir le déclencher au clic sur notre bouton
      setDeferredPrompt(e);
      
      // Vérifier si l'utilisateur n'a pas déjà fermé la bannière pour cette session
      const isDismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Si l'application est déjà installée et lancée en mode standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Afficher la boîte de dialogue d'installation du navigateur
    deferredPrompt.prompt();

    // Attendre la réponse de l'utilisateur
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Choix de l'utilisateur : ${outcome}`);

    // On nettoie l'invite car elle ne peut servir qu'une fois
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleCloseBanner = () => {
    setShowBanner(false);
    // Optionnel : ne plus l'embêter pendant la session actuelle
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 bg-white border border-blue-100 rounded-[2rem] p-5 shadow-[0_15px_50px_rgba(23,99,255,0.15)] z-[9999] animate-pop-in transition-all duration-300">
      <div className="flex gap-4 items-start relative">
        
        {/* Bouton Fermer */}
        <button 
          onClick={handleCloseBanner}
          className="absolute -top-1 -right-1 p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-blue-50 transition-colors"
        >
          <X size={12} />
        </button>

        {/* Logo / Icône d'illustration temporaire */}
        <div className="h-12 w-12 bg-gradient-to-br from-[#1763FF] to-[#00246B] text-white rounded-2xl flex items-center justify-center text-lg font-black shadow-md shrink-0">
          K
        </div>

        {/* Texte descriptif */}
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight leading-tight">
            Installer l'application
          </h4>
          <p className="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">
            Accédez instantanément à <span className="font-bold text-[#1763FF]">KalanNyetaa</span> depuis votre écran d'accueil comme une application mobile native.
          </p>
        </div>
      </div>

      {/* Bouton d'action principal */}
      <button
        onClick={handleInstallClick}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-[#1763FF] text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-[#1252D4] transition-all shadow-md shadow-blue-500/10 active:scale-98"
      >
        <Download size={14} /> Télécharger l'application
      </button>
    </div>
  );
}