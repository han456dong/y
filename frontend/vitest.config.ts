import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    env: {
      VITE_API_BASE_URL: 'http://localhost/api',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './docs/tests/coverage',
      include: ['src/apis/**/*.ts', 'src/services/**/*.ts', 'src/store/**/*.ts', 'src/router/**/*.ts'],
      exclude: ['src/mocks/**', 'src/test/**', '**/*.d.ts'],
    },
  },
})
