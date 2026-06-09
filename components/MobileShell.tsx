'use client'

import React, { useState, useEffect } from 'react'
// 🚀 CORRECTION : Utilisation de l'alias absolu pour être sûr que Next.js trouve le composant
import Sidebar from '@/components/Sidebar'
import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // On vérifie si on est sur l'accueil ou le login
  const isLogin = pathname === '/' || pathname === '/login'

  return (
    <div className="min-h-screen w-full">
      {/* Floating FAB (mobile) - caché sur le login / accueil */}
      {!isLogin && (
        <button 
          onClick={() => setOpen(true)} 
          className="md:hidden fixed z-40 right-4 bottom-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay mobile (floating bottom sheet) */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 bottom-6 transform -translate-x-1/2 w-[92vw] max-w-90">
            {/* Si Sidebar est aussi utilisé ici avec l'alias absolu, aucun problème */}
            <Sidebar floating onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex">
        {/* La Sidebar desktop est cachée sur l'accueil et le login */}
        {!isLogin && <Sidebar />}
        
        <main className={`flex-1 ${!isLogin ? 'md:ml-72' : ''} p-4 md:p-10`}>
          <div className="app-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}