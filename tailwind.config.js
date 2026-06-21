/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        card: 'var(--surface-card)',
        active: 'var(--surface-active)',
        border: 'var(--border)',
        'border-hover': 'var(--border-hover)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        gold: 'var(--gold)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'modal-in': 'modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }
    },
  },
  plugins: [],
}
