import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        button: {
          primary: '#A1C181',
          'primary-hover': '#FE7F2D',
          'primary-active': '#FE7F2D',
        },
        sidebar: {
          bg: '#619B8A',
          border: '#619B8A',
        },
        icon: {
          body: '#FCCA46',
        },
        checkout: {
          date: '#FCCA46',
        },
        card: {
          border: '#A1C181',
        },
        search: {
          border: '#233D4D',
        },
        nav: {
          active: '#FE7F2D',
        },
        danger: {
          DEFAULT: '#EF4444',
        },
        success: {
          DEFAULT: '#10B981',
        },
        warning: {
          DEFAULT: '#F59E0B',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F3F4F6',
        },
        background: {
          DEFAULT: '#FAFAFA',
        },
        border: {
          DEFAULT: '#A1C181',
        },
        text: {
          primary: '#1F2937',
          secondary: '#6B7280',
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