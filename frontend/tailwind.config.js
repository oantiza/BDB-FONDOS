import tailwindScrollbar from 'tailwind-scrollbar';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Corporativa
        brand: {
          DEFAULT: '#0B2545', // Azul Oscuro (Navy)
          light: '#1e3a8a',
          dark: '#020617',
        },
        accent: {
          DEFAULT: '#D4AF37', // Dorado
          light: '#FCD34D',
          hover: '#b8952b',
        },
        // Fondos específicos
        navy: {
          50: '#f0f4f8',
          900: '#0a192f',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Merriweather', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [
    tailwindScrollbar, // Necesario para la clase 'scrollbar-thin' usada en los modales
  ],
}