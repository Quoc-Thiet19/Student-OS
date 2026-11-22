import { defineConfig } from 'vite'
import tailwind from '@tailwindcss/vite'
export default defineConfig({
  root: 'client', envDir: '..',
  plugins: [tailwind()],
  build: {
    rolldownOptions: {
      onwarn(warning,warn) {
        // Browser-only SPA. Dependency client boundaries have no server-rendering meaning.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.id?.includes('node_modules') && warning.message.includes('use client')) return
        warn(warning)
      },
    },
  },
})



