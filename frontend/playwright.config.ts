import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Automatically load environment variables from .env.local and .env
for (const envFile of ['.env.local', '.env', '../.env.local', '../.env']) {
  const envPath = path.resolve('.', envFile);
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const k = key.trim();
        const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (k && !process.env[k]) {
          process.env[k] = val;
        }
      }
    }
  }
}

/**
 * Playwright E2E Testing Configuration for Mega Assistant
 *
 * BASE_URL can be set via environment variable. Defaults to production URL.
 * Local testing URL can be passed via: BASE_URL=http://localhost:5173 npm run test:e2e
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://mega-ai-assistant.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
