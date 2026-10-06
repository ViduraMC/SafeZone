/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Unit-test coverage targets the domain, application and infrastructure layers
      // of every use-case module. Presentation (React) code is exercised manually and
      // through a handful of component tests.
      include: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts', 'src/**/types.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
