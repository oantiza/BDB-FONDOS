// import tailwindScrollbar from 'tailwind-scrollbar';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Corporativa (MATCHING MI BOUTIQUE)
        brand: {
          DEFAULT: '#0B2545', // Navy Principal
          light: '#1e3a8a',
          dark: '#061a33',
        },
        accent: {
          DEFAULT: '#D4AF37', // Dorado Principal
          light: '#FCD34D',
          hover: '#b8952b',
        },
        // Fondos específicos Light Theme
        background: '#F3F4F6', // Light Gray
        surface: '#FFFFFF',     // White
        text: '#1F2937',        // Gray 800
      },
      fontFamily: {
        sans: ['Roboto Flex', 'Roboto', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Merriweather', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    // tailwindScrollbar,
  ],
}