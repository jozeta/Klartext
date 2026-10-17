import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [
      'unified',
      'remark-parse',
      'remark-gfm',
      'remark-frontmatter',
      'remark-math',
      'remark-rehype',
      'rehype-raw',
      'rehype-sanitize',
      'rehype-katex',
      'rehype-stringify',
      'chokidar',
      'yaml',
      'zod',
      'katex',
      'simple-git',
      'dompurify',
      '@untitledui/icons',
      'react',
      'react-dom'
    ] })],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    },
    plugins: [react()]
  }
})
