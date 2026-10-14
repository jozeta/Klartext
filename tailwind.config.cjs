/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        panel: 'var(--bg-panel)',
        secondary: 'var(--bg-secondary)',
        primary: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        subtle: 'var(--border-subtle)',
        accent: 'var(--accent-primary)',
        danger: 'var(--status-danger)',
        warning: 'var(--status-warning)',
        success: 'var(--status-success)'
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        editor: ['var(--font-editor)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
