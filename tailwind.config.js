/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      colors: {
        emerald: {
          go: '#10b981',
          'go-dark': '#059669',
        },
        amber: {
          fix: '#f59e0b',
          'fix-dark': '#d97706',
        },
        red: {
          kill: '#ef4444',
          'kill-dark': '#dc2626',
        },
      },
    },
  },
  plugins: [],
};
