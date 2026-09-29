import { defineConfig } from 'vitest/config';

// Separado do vite.config.ts para os testes (lógica pura) não subirem o runtime da Cloudflare.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
