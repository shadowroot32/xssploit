import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: { 950: '#0a0a0f', 900: '#12121a', 800: '#1a1a24', 700: '#262633' },
        accent: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
      },
    },
  },
  plugins: [],
};
export default config;
