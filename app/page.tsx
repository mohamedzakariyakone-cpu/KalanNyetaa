'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NeutralRootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirection immédiate et définitive vers le tableau de bord
    // Le proxy (middleware) prendra le relais si l'utilisateur n'est pas connecté
    router.replace('/dashboard');
  }, [router]);

  // On retourne un écran blanc total ou un loader minimaliste pendant la micro-seconde de redirection
  return (
    <div className="min-h-screen w-full bg-[#fcfcfc] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}