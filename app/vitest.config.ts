import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^src\/(.+)/, replacement: `${path.resolve(process.cwd(), 'src')}/$1` }],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
