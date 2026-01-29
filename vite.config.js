import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page build so Netlify publish (dist/) includes legal pages.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), 'index.html'),
        datenschutz: resolve(process.cwd(), 'datenschutz.html'),
        impressum: resolve(process.cwd(), 'impressum.html'),
      },
    },
  },
});

