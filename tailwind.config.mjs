/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff8f1',
          100: '#feeedc',
          200: '#fcdab8',
          300: '#f9bd88',
          400: '#f59654',
          500: '#f1742a',
          600: '#e65100', // Primary Maharashtra saffron/amber
          700: '#bf360c',
          800: '#992d10',
          900: '#7c2711',
          950: '#431106',
        },
        surface: {
          canvas: 'var(--color-canvas)',
          card: 'var(--color-card)',
          muted: 'var(--color-surface-muted)',
          border: 'var(--color-border)',
        },
        ink: {
          primary: 'var(--color-ink-primary)',
          secondary: 'var(--color-ink-secondary)',
          muted: 'var(--color-ink-muted)',
          inverse: 'var(--color-ink-inverse)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-secondary-foreground)',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans Devanagari"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        marathi: ['"Noto Sans Devanagari"', 'sans-serif'],
        latin: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
      boxShadow: {
        'soft': '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'lift': '0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
