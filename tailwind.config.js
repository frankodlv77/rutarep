/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:       'var(--c-bg)',
        surface:  'var(--c-surface)',
        surface2: 'var(--c-surface2)',
        surface3: 'var(--c-surface3)',
        textc:    'var(--c-text)',
        muted:    'var(--c-muted)',
        muted2:   'var(--c-muted2)',
        border:   { subtle: 'var(--c-border)', DEFAULT: 'var(--c-border)' },
        accent:   '#f59e0b',
        success:  '#10b981',
        danger:   '#ef4444',
        info:     '#3b82f6',
      },
      fontFamily: {
        heading: ['Inter', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      borderRadius: {
        xl2: '16px',
        xl3: '22px',
      },
      animation: {
        fadeUp:   'fadeUp .25s cubic-bezier(0.16,1,0.3,1)',
        slideUp:  'slideUp .3s cubic-bezier(0.16,1,0.3,1)',
        pulse2:   'pulse2 1.8s infinite',
        fadeIn:   'fadeIn .4s ease',
      },
      keyframes: {
        fadeUp:  { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        pulse2:  { '0%,100%': { boxShadow: '0 0 0 0 rgba(245,158,11,.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(245,158,11,0)' } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
}
