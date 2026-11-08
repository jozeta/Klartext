// ESLint 9 flat config (replaces .eslintrc.cjs; same rules as before).
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import nounsanitized from 'eslint-plugin-no-unsanitized'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // SEC-DOM-2: innerHTML/outerHTML/insertAdjacentHTML/document.write with a non-literal value is an
  // error. A reviewed sink carries `// eslint-disable-next-line no-unsanitized/property -- reviewed: <why>`.
  nounsanitized.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
)
