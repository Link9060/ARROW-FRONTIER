import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/ARROW-FRONTIER/' : '/',
  build: { target: 'es2022' },
});
