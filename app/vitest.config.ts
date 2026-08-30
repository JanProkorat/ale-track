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
    // Vitest's default 5s is a wall clock, not a work budget: the heaviest files render the
    // order and shipment editors dozens of times, and under parallel workers on a busy machine
    // a render that takes 300ms alone can take several seconds. Individual tests were timing
    // out in the full run while passing every time on their own, which is a report about the
    // machine rather than about the code.
    testTimeout: 20000,
  },
});
