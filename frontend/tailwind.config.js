export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Manrope"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Editorial cream/white base
        cream: {
          50: '#ffffff',
          100: '#fdfaf7',
          200: '#f8f1ec',
        },
        // Dusty rose / soft pink accents
        rose: {
          50: '#fef7f5',
          100: '#fce9e6',
          200: '#f6cfca',
          300: '#eeb0a9',
          400: '#e29089',
          500: '#cf6f68',
          600: '#a85049',
          700: '#7d3a36',
          800: '#5a2a27',
          900: '#3a1c1a',
        },
        ink: {
          50: '#f4f2f1',
          100: '#dcd8d6',
          200: '#a9a3a0',
          300: '#76706d',
          400: '#3f3937',
          500: '#1c1816',
          900: '#0e0a09',
        },
        // Keep safeher alias for backwards compat — maps to rose
        safeher: {
          50: '#fef7f5',
          100: '#fce9e6',
          200: '#f6cfca',
          300: '#eeb0a9',
          400: '#e29089',
          500: '#cf6f68',
          600: '#a85049',
          700: '#7d3a36',
          800: '#5a2a27',
          900: '#3a1c1a',
        },
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bloom: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(8px,-6px)' },
        },
      },
      animation: {
        marquee: 'marquee 32s linear infinite',
        rise: 'rise 0.7s cubic-bezier(0.16,1,0.3,1) both',
        bloom: 'bloom 0.5s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 2.4s linear infinite',
        drift: 'drift 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
