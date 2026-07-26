import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Gate the areas unit tests are responsible for. Page-level components
      // are covered by e2e and intentionally excluded (see PROGRESS.md).
      include: ['src/lib/**', 'src/components/**', 'src/context/**', 'src/app/api/**'],
      thresholds: {
        'src/lib/**': { lines: 90, branches: 85 },
        'src/components/**': { lines: 70, branches: 70 },
        'src/context/**': { lines: 75, branches: 50 },
        'src/app/api/**': { lines: 85, branches: 75 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
