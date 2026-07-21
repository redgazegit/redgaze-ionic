/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import analog from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [analog()],
  test: {
    globals: true,
    setupFiles: ['./src/test-pre-setup.js', './src/test-setup.js'],
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.e2e.spec.ts', 'e2e/**'],
    css: false,
    reporters: ['default'],
    onUnhandledError(error): boolean | void {
      if (error instanceof Error && error.name === 'AbortError' && error.message.includes('The operation was aborted')) {
        return false;
      }
    },
    coverage: {
      provider: 'v8',
      include: ['src/app/**/*.ts'],
      exclude: ['src/app/**/*.spec.ts', 'src/app/**/*.model.ts', 'src/app/icons.ts'],
    },
    server: {
      deps: {
        inline: ['@ionic/core', '@ionic/angular'],
      },
    },
  },
  optimizeDeps: {
    include: ['@ionic/core', '@ionic/angular'],
  },
});
