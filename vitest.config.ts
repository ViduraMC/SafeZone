import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vitest runs the unit tests of the domain, application and infrastructure
 * layers. These layers are plain TypeScript with no React Native imports, so
 * they are tested in Node. The React Native screens are tested with Jest
 * (jest-expo), see jest.config.js.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts', 'src/**/types.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
