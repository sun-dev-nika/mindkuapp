import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// `defineConfig` de `vitest/config` extiende la config de Vite con el campo
// `test`, así este único archivo sirve tanto para `vite dev`/`vite build`
// como para `vitest run` (no se necesita un vitest.config.ts separado).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setupTests.ts'],
  },
});
