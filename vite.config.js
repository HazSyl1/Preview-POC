import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PREVIEW_WEB_PORT || 5175), strictPort: true, proxy: { '/api': process.env.PREVIEW_API_TARGET || 'http://localhost:5050' } },
});
