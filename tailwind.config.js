/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.ts'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    screens: { md: '681px' },
    extend: {
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        surface: 'var(--surface)',
        soft: 'var(--soft)',
        backdrop: 'var(--backdrop)',
        accent: 'var(--accent)',
        'on-accent': 'var(--on-accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-text': 'var(--accent-text)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        cam: '#0F0C13',
      },
      fontFamily: {
        vto: ['var(--vto-font, system-ui)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { vto: 'var(--r)' },
      transitionTimingFunction: { vto: 'cubic-bezier(.2,.8,.2,1)' },
      keyframes: {
        in: { from: { opacity: '0', transform: 'translateY(6px)' } },
        flash: { '0%': { opacity: '.85' }, '100%': { opacity: '0' } },
        shake: { '25%': { transform: 'translateX(-4px)' }, '75%': { transform: 'translateX(4px)' } },
        seam: { from: { top: '6%' }, to: { top: '94%' } },
        needle: { from: { left: '8%' }, to: { left: 'calc(92% - 12px)' } },
      },
      animation: {
        in: 'in .26s cubic-bezier(.2,.8,.2,1) both',
        flash: 'flash .35s ease-out',
        shake: 'shake .35s',
        seam: 'seam 2.6s cubic-bezier(.2,.8,.2,1) infinite alternate',
        needle: 'needle 1.3s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
