import './globals.css'
import MobileShell from '@/components/MobileShell'
import { Inter } from 'next/font/google'
import { YearProvider } from '@/context/YearContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import type { Metadata, Viewport } from 'next'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Métadonnées optimisées pour la PWA
export const metadata: Metadata = {
  title: 'KanlanNyetaa - Gestion Scolaire',
  description: 'Application d\'intelligence financière et de gestion pour l\'école KanlanNyetaa',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KanlanNyetaa',
  },
  formatDetection: {
    telephone: false,
  },
};

// Configuration du viewport pour éviter les zooms automatiques inconfortables sur mobile
export const viewport: Viewport = {
  themeColor: '#4f46e5', // Le violet de ton thème principal
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
    <html lang="fr" className={`${inter.variable} font-sans`} suppressHydrationWarning>
      <head>
        {/* Icône requise pour l'installation sur iOS (Safari) */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* Script pour éviter le flash en mode sombre */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'system';
                const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 antialiased transition-colors">
        <ThemeProvider>
          <YearProvider>
            <MobileShell>
              {children}
            </MobileShell>
          </YearProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}