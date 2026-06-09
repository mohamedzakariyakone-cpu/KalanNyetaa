'use client';

import React from 'react';

interface MobileShellProps {
  children: React.ReactNode;
}

const MobileShell = ({ children }: MobileShellProps) => {
  return (
    /* - Sur Mobile : On prend tout l'écran, on bloque le scroll horizontal, et on ajoute le padding en bas (pb-28) pour ta barre fixe.
      - Sur PC (md:) : On désactive complètement la coque (`md:p-0 md:pb-0 md:overflow-visible`) pour laisser ton layout d'administration intact.
    */
    <div className="w-full min-h-screen overflow-x-hidden pb-28 md:pb-0 md:overflow-visible">
      <div className="w-full max-w-full mx-auto px-4 sm:px-6 md:px-0 md:max-w-none">
        {children}
      </div>
    </div>
  );
};

export default MobileShell;