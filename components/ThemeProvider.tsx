'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  const updateTheme = (newTheme: Theme) => {
    const htmlElement = document.documentElement

    if (newTheme === 'system') {
      const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isDarkSystem) {
        htmlElement.classList.add('dark')
        setIsDark(true)
      } else {
        htmlElement.classList.remove('dark')
        setIsDark(false)
      }
    } else if (newTheme === 'dark') {
      htmlElement.classList.add('dark')
      setIsDark(true)
    } else {
      htmlElement.classList.remove('dark')
      setIsDark(false)
    }

    localStorage.setItem('theme', newTheme)
  }

  // Détecter la préférence système
  useEffect(() => {
    setMounted(true)

    // Récupérer la préférence sauvegardée
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      setThemeState(savedTheme)
    } else {
      setThemeState('system')
    }

    // Écouter les changements de préférence système
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const currentTheme = localStorage.getItem('theme') as Theme | null
      if (currentTheme === 'system') {
        updateTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Mettre à jour le thème quand il change
  useEffect(() => {
    if (!mounted) return
    updateTheme(theme)
  }, [theme, mounted])

  const handleSetTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
