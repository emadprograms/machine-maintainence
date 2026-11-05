/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Apple system blue
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#b6d8ff',
          300: '#84bdff',
          400: '#4aa0ff',
          500: '#0a84ff',
          600: '#0071e3',
          700: '#0060c0',
          800: '#004f9e',
          900: '#003c78',
          950: '#00264d',
        },
        // Apple teal (system cyan) — used for the scan module
        accent: {
          50: '#e8fbfe',
          100: '#c8f3fa',
          200: '#97e6f2',
          300: '#5ed3e6',
          400: '#2fb8d4',
          500: '#159bb6',
          600: '#0e7e96',
          700: '#0e6479',
          800: '#125263',
          900: '#144554',
        },
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--color-ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--color-ink-faint) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--color-line) / <alpha-value>)',
          soft: 'rgb(var(--color-line-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Inter', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        apple: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.14)',
        'apple-lg': '0 4px 12px rgba(0,0,0,0.06), 0 24px 48px -16px rgba(0,0,0,0.20)',
        'apple-sm': '0 1px 2px rgba(0,0,0,0.05), 0 2px 8px -4px rgba(0,0,0,0.10)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'scan-line': {
          '0%': { top: '0%' },
          '50%': { top: '100%' },
          '100%': { top: '0%' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scan-line': 'scan-line 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
