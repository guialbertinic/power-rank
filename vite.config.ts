import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  // O plugin da Cloudflare roda o Worker (server/worker.ts) + D1 local dentro do `vite dev`.
  plugins: [react(), cloudflare()],
});
