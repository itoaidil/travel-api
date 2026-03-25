import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/franchise_admin/',
  build: {
    outDir: '../public/franchise_admin',
    emptyOutDir: true
  },
  server: {
    host: true,
    port: 5175
  }
});
