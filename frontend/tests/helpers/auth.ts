import { Page, expect } from '@playwright/test';

/**
 * Environment variable resolution for E2E credentials
 */
export function getUserCredentials() {
  const email = process.env.E2E_USER_EMAIL || process.env.TEST_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD || process.env.TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

export function getAdminCredentials() {
  const email = process.env.E2E_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
}

/**
 * Attaches a listener to capture uncaught page runtime errors and verify no fatal UI crashes occur.
 */
export function attachErrorTracker(page: Page) {
  const errors: Error[] = [];
  page.on('pageerror', (err) => {
    // Assert critical crash errors do not occur
    expect(err.message).not.toContain('adminUsers.map is not a function');
    expect(err.message).not.toContain("Cannot read properties of undefined (reading 'map')");
    errors.push(err);
  });
  return errors;
}

/**
 * Helper to perform login via UI if credentials are provided
 */
export async function loginUser(page: Page) {
  const creds = getUserCredentials();
  if (!creds) return false;

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  if (await emailInput.isVisible()) {
    await emailInput.fill(creds.email);
    await passwordInput.fill(creds.password);
    await page.getByRole('button', { name: /sign in|log in|submit/i }).click();
    await page.waitForTimeout(1500);
  }
  return true;
}

/**
 * Helper to perform admin login via UI if credentials are provided
 */
export async function loginAdmin(page: Page) {
  const creds = getAdminCredentials();
  if (!creds) return false;

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  if (await emailInput.isVisible()) {
    await emailInput.fill(creds.email);
    await passwordInput.fill(creds.password);
    await page.getByRole('button', { name: /sign in|log in|submit/i }).click();
    await page.waitForLoadState('networkidle');
  }
  return true;
}
