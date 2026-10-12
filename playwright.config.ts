import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:'tests/e2e',
  testMatch:'**/*.pw.ts',
  timeout:45_000,
  expect:{timeout:10_000},
  retries:process.env.CI?1:0,
  workers:process.env.CI?1:undefined,
  reporter:process.env.CI?'list':'line',
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer:{
    command:'npm run dev -- --host 127.0.0.1 --port 4173',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!process.env.CI,
    timeout:60_000,
  },
});
