import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@domain': path.resolve(import.meta.dirname, 'src/domain'),
      '@features': path.resolve(import.meta.dirname, 'src/features'),
      '@services': path.resolve(import.meta.dirname, 'src/services'),
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@app': path.resolve(import.meta.dirname, 'src/app'),
    },
  },
});
