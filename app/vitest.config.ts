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
    // Fixed env for tests. `apiClient` throws at import time without a base URL,
    // so any test whose subject transitively imports it fails to even load —
    // and it fails only where no .env exists, i.e. in CI and not on the machine
    // that wrote the test. Pinning it here also keeps runs from varying with
    // whatever a developer happens to have in their .env.
    env: {
      VITE_API_BASE_URL: 'http://localhost:8080',
    },
  },
});
