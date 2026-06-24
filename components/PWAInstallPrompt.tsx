'use client';

import { useEffect, useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X, Smartphone, Monitor } from 'lucide-react';

export default function PWAInstallPrompt() {
  const { isInstallable, isInstalled, isAndroid, isDesktop, showPrompt, installApp, dismissPrompt } = usePWAInstall();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const dismissedTime = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissedTime) {
      const dismissedDate = new Date(dismissedTime);
      const now = new Date();
      const hoursDiff = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        setDismissed(true);
      } else {
        localStorage.removeItem('pwa-prompt-dismissed');
      }
    }
  }, []);

  if (!mounted || isInstalled || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    await installApp();
  };

  const handleDismiss = () => {
    setDismissed(true);
    dismissPrompt();
  };

  if (isInstallable && showPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[99999] p-4 md:bottom-4 md:right-4 md:left-auto md:max-w-sm">
        <div className="bg-gradient-to-r from-[#1763FF] to-[#00246B] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/10 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Download size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-black text-sm">Installer KalanNyetaa</h3>
                <p className="text-white/70 text-xs">Accès rapide depuis votre écran d'accueil</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors p-1"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="bg-white/20 p-1.5 rounded-lg mt-0.5">
                  <Smartphone size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Accès rapide</p>
                  <p className="text-white/70 text-xs">Lancez l'app directement depuis votre écran d'accueil</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-white/20 p-1.5 rounded-lg mt-0.5">
                  <Monitor size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Mode hors-ligne</p>
                  <p className="text-white/70 text-xs">Continuez à travailler même sans connexion Internet</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all border border-white/20"
              >
                Plus tard
              </button>
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2.5 bg-white text-[#1763FF] rounded-lg font-black text-xs uppercase tracking-wider hover:bg-white/90 transition-all shadow-lg active:scale-95"
              >
                Installer
              </button>
            </div>
          </div>

          <div className="bg-white/5 px-6 py-2 text-center">
            <p className="text-white/50 text-xs">
              {isAndroid ? '📱 Android' : isDesktop ? '💻 Desktop' : '📱 Mobile'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isAndroid) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[99999] p-4 md:bottom-4 md:right-4 md:left-auto md:max-w-sm">
        <div className="bg-slate-900 text-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg">
                <Smartphone size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-sm">Installez KalanNyetaa</h3>
                <p className="text-white/70 text-xs">Si le prompt n'apparaît pas automatiquement, utilisez Chrome.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 text-white/90 text-[11px] leading-relaxed">
              <p className="font-bold uppercase tracking-[0.18em] mb-2">Étapes Android</p>
              <ol className="list-decimal list-inside space-y-2 text-[11px]">
                <li>Ouvrez le menu Chrome (⋮)</li>
                <li>Choisissez « Ajouter à l'écran d'accueil »</li>
                <li>Confirmez pour installer l'application</li>
              </ol>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full px-4 py-3 bg-white text-slate-900 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-all"
            >
              J'ai compris
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
