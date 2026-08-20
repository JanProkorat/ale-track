import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

const PORT = 3039;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^src\/(.+)/, replacement: `${path.resolve(process.cwd(), 'src')}/$1` }],
  },
  server: { port: PORT, host: true },
  preview: { port: PORT, host: true },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material'],
          'vendor-map': ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
});
