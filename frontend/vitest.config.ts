import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Coverage is reported but not gated: the unit suite currently covers the
      // utilities/logic (parsers, stores, schemas), not the React UI. Raising a
      // real gate here means writing component/page tests — a follow-up. Until
      // then the gate lives on the backend (80%), and a failing test still fails
      // CI. To re-enable, add a `thresholds` block once UI tests exist.
      exclude: [
        'node_modules/',
        'tests/',
        'src/main.tsx',
        'src/vite-env.d.ts',
        '**/*.config.*',
      ],
    },
  },
});
