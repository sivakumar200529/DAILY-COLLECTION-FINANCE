import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Enable public / network host binding
    port: 5173,
    // The data files are the server's, not the screens'. Watching them crashed the dev server
    // (EBUSY) when a large backup copy was being written on loading or removing the data.
    watch: {
      ignored: ['**/krs_finance_data*.json', '**/krs_sessions*.json', '**/project_monitoring_data*.json', '**/uploads/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  }
});
