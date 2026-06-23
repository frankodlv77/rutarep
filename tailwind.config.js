/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0b1320',
        surface:  '#131e2e',
        surface2: '#1a2840',
        surface3: '#1f3050',
        accent:   '#f59e0b',
        success:  '#10b981',
        danger:   '#ef4444',
        info:     '#3b82f6',
        muted:    '#6b85a0',
        textc:    '#f0f4f8',
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
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
