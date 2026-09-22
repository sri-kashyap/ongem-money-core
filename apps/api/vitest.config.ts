import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Pulling and starting the Postgres container can take a while on a cold CI runner.
    hookTimeout: 120_000,
    testTimeout: 15_000,
  },
});
