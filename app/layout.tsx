import './globals.css'
import MobileShell from '@/components/MobileShell'
import Sidebar from '@/components/Sidebar'
import OfflineSync from '@/components/OfflineSync'
import ConnectionStatus from '@/components/ConnectionStatus'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister' // Enregistrement du Service Worker
import PWAInstallPrompt from '@/components/PWAInstallPrompt' // Invite d'installation PWA
import { Inter } from 'next/font/google'
import { YearProvider } from '@/context/YearContext'
import type { Metadata, Viewport } from 'next'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'KalanNyetaa - Gestion Scolaire',
  description: 'Application d\'intelligence financière and de gestion pour l\'école KalanNyetaa',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KalanNyetaa',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#F8FAFC',
  colorScheme: 'light', 
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html 
      lang="fr" 
      className={`${inter.variable} font-sans light`} 
      style={{ colorScheme: 'light' }}
      data-theme="light"
    >
      <body className="!bg-[#F8FAFC] !text-slate-900 bg-[#F8FAFC] text-slate-900 antialiased min-h-screen
        [&:has(#login-page)]_._admin-content:md:pl-0
        [&:has(#role-selection-page)]_._admin-content:md:pl-0">
        
        {/* ⚙️ Initialisation discrète de la PWA (Enregistrement du service worker en arrière-plan) */}
        <ServiceWorkerRegister />

        <YearProvider>
          <ConnectionStatus />
          <MobileShell>
            {/* L'enveloppe de classe pour le ciblage CSS */}
            <div className="app-sidebar">
              <Sidebar /> 
            </div>
            
            {/* Contenu principal */}
            <div className="admin-content flex-1 pb-28 md:pb-0 md:pl-72 transition-all duration-150">
              {children}
            </div>
          </MobileShell>
          <OfflineSync />
          
          {/* 📲 Popup / Bannière de téléchargement PWA personnalisée */}
          <PWAInstallPrompt />
        </YearProvider>

      </body>
    </html>
  )
}