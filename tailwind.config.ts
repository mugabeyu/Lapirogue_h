import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F4C4A',
          hover: '#0A3A38',
          700: '#0A3A38',
        },
        accent: {
          DEFAULT: '#E97B5C',
        },
        sand: {
          50: '#FAF7F2',
          100: '#F2EDE3',
          200: '#E5DCC9',
          300: '#D6C8AF',
        },
        ink: {
          900: '#1A1F1E',
          600: '#5C615F',
          400: '#8A8F8C',
        },
        success: {
          DEFAULT: '#4A7C59',
          50: '#EAF2EC',
          600: '#3C6649',
          700: '#2D4D37',
        },
        warning: {
          DEFAULT: '#C89B3C',
          50: '#F9F5EB',
          700: '#7A5E24',
        },
        danger: {
          DEFAULT: '#B84A3C',
          50: '#F8ECEB',
          700: '#702D24',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-display)', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
