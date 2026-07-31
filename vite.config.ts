import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://OrionAF.github.io/iom-arcanist-optimizer/
export default defineConfig({
  base: '/iom-arcanist-optimizer/',
  plugins: [react()],
});
