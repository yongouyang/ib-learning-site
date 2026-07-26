import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Config for the opt-in live contract tests (tests/live) — these hit real
// external APIs and cost tokens. Run explicitly:
//   FEEDBACK_LIVE=1 FEEDBACK_API_KEY=... npx vitest run --config vitest.live.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/live/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
