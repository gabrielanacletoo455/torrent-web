import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev, o Vite serve o frontend e faz proxy do backend (porta 3000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/downloads': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
