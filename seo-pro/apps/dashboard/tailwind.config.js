/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        card:
          '0 12px 24px -10px rgba(24,39,75,.12), 0 4px 12px -6px rgba(24,39,75,.08)',
      },
      borderRadius: { '2xl': '1.25rem' },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
