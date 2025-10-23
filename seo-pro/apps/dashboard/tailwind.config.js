// apps/dashboard/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      boxShadow: {
        // Necesario si quieres usar "shadow-card" en @apply
        card:
          '0 12px 24px -10px rgba(24,39,75,.12), 0 4px 12px -6px rgba(24,39,75,.08)',
      },
      borderRadius: {
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
