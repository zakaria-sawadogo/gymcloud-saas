import type { Config } from 'tailwindcss';

/**
 * Configuration Tailwind v4.
 *
 * IMPORTANT : les couleurs, ombres et rayons personnalisés de GymCloud
 * (primary, accent, ink, shadow-card, radius-card...) sont désormais
 * définis dans `app/globals.css` via un bloc `@theme` natif — c'est la
 * seule source de vérité en Tailwind v4 pour ces tokens. Ce fichier ne
 * garde que ce que `@theme` ne couvre pas (content, darkMode).
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
};

export default config;
