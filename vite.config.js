import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PREVIEW_WEB_PORT || 5175), strictPort: true, proxy: { '/api': process.env.PREVIEW_API_TARGET || 'http://localhost:5050' } },
  build: { rollupOptions: { input: { app: resolve(root, 'index.html'), authRedirect: resolve(root, 'auth-redirect.html') } } },
});
