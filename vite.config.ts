import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@domain': path.resolve(import.meta.dirname, 'src/domain'),
      '@features': path.resolve(import.meta.dirname, 'src/features'),
      '@services': path.resolve(import.meta.dirname, 'src/services'),
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@app': path.resolve(import.meta.dirname, 'src/app'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) {
            return 'three-core';
          }
          if (id.includes('node_modules/@react-three/')) {
            return 'three-fiber';
          }
          if (id.includes('node_modules/konva/') || id.includes('node_modules/react-konva/')) {
            return 'konva-core';
          }
        },
      },
    },
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
