import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#4f46e5',
          dark: '#6366f1',
        },
        card: {
          light: '#ffffff',
          dark: '#1f2937',
        },
      },
      backgroundImage: {
        'gradient-light': 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #f0fdf4 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0f172a 0%, #1a1a2e 50%, #0f172a 100%)',
      },
    },
  },
  plugins: [],
}

export default config
