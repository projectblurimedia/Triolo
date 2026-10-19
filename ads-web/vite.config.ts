import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Bind to the LAN interface (not just localhost) so the site is reachable from another
  // device on the same network (e.g. testing on a phone browser) — matches the mobile
  // apps' own LAN-IP convention (see src/services/apiClient.ts).
  server: {
    host: true,
  },
});
