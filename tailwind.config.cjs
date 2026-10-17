/** @type {import('tailwindcss').Config} */
function cssVarWithOpacity(varName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      const pct = Math.round(Number(opacityValue) * 100)
      if (!Number.isNaN(pct)) {
        return `color-mix(in srgb, var(${varName}) ${pct}%, transparent)`
      }
    }
    return `var(${varName})`
  }
}

module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        app: cssVarWithOpacity('--bg-app'),
        panel: cssVarWithOpacity('--bg-panel'),
        secondary: cssVarWithOpacity('--bg-secondary'),
        primary: cssVarWithOpacity('--text-primary'),
        muted: cssVarWithOpacity('--text-secondary'),
        subtle: cssVarWithOpacity('--border-subtle'),
        accent: cssVarWithOpacity('--accent-primary'),
        danger: cssVarWithOpacity('--status-danger'),
        warning: cssVarWithOpacity('--status-warning'),
        success: cssVarWithOpacity('--status-success')
      },
      textColor: {
        primary: cssVarWithOpacity('--text-primary'),
        secondary: cssVarWithOpacity('--text-secondary'),
        muted: cssVarWithOpacity('--text-secondary')
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
