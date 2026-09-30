import { defineConfig } from 'vitest/config';

// Separado do vite.config.ts para os testes (lógica pura) não subirem o runtime da Cloudflare.
// server/*.test.ts: só módulos sem D1 (ex: verificação do JWT do Access).
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
