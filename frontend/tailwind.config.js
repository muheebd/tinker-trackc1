/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#FAF8F3',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#0B1220',
          card: '#141B2E',
          border: '#232D45',
        },
        brand: {
          DEFAULT: '#0E7C66',
          dark: '#0B5C4C',
          light: '#E4F3EF',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"Space Grotesk"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        pulseCheck: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        shakeX: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        pulseCheck: 'pulseCheck 0.4s ease-in-out',
        shakeX: 'shakeX 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
};