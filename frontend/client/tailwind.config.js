/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Orbitron', 'system-ui', 'sans-serif'], display: ['Orbitron', 'sans-serif'] },
      backgroundImage: {
        'gradient-blue': 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 25%, #0284c7 50%, #0ea5e9 75%, #38bdf8 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
      },
      animation: { 'gradient': 'gradient 8s ease infinite', 'float': 'float 6s ease-in-out infinite' },
      keyframes: {
        gradient: { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
