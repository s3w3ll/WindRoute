import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/WindRoute/',
  plugins: [react()],
  // @ts-expect-error vitest injects test config at runtime
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    passWithNoTests: true,
    pool: 'threads',
  },
})
