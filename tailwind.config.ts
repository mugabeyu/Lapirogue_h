import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B5D57',
          hover: '#084843',
          700: '#084843',
        },
        accent: {
          DEFAULT: '#C5A46D',
        },
        sand: {
          50: '#F7F5F1',
          100: '#F7F5F1',
          200: '#E7E2DA',
          300: '#D6C8AF',
        },
        ink: {
          900: '#1B2430',
          600: '#667085',
          400: '#8A8F8C',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#FAF9F7',
        },
        background: {
          DEFAULT: '#F7F5F1',
        },
        border: {
          DEFAULT: '#E7E2DA',
        },
        success: {
          DEFAULT: '#16A34A',
        },
        warning: {
          DEFAULT: '#D97706',
        },
        danger: {
          DEFAULT: '#DC2626',
        },
      },
      fontFamily: {
        poppins: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        display: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        page: '32px',
        section: '24px',
        card: '16px',
        inline: '8px',
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