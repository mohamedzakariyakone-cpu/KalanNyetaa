import './globals.css'
import MobileShell from '@/components/MobileShell'
import Sidebar from '@/components/Sidebar'
import OfflineSync from '@/components/OfflineSync'
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
    statusBarStyle: 'default',
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
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        
        {/* 🪄 SÉCURITÉ ABSOLUE : CSS natif injecté pour forcer le masquage 
            si l'un des deux écrans d'accès est détecté dans la page */}
        <style>{`
          body:has(#login-page) .app-sidebar,
          body:has(#role-selection-page) .app-sidebar {
            display: none !important;
          }
          body:has(#login-page) .admin-content,
          body:has(#role-selection-page) .admin-content {
            padding-left: 0 !important;
          }
        `}</style>
      </head>
      
      <body className="!bg-[#F8FAFC] !text-slate-900 bg-[#F8FAFC] text-slate-900 antialiased min-h-screen
        [&:has(#login-page)]_._admin-content:md:pl-0
        [&:has(#role-selection-page)]_._admin-content:md:pl-0">
        
        <YearProvider>
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
        </YearProvider>

      </body>
    </html>
  )
}