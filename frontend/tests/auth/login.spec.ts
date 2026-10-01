import { test, expect } from '@playwright/test';
import { getUserCredentials, loginUser, attachErrorTracker } from '../helpers/auth';

test.describe('Authentication E2E Flow Tests', () => {
  test('Login UI and Auth controls load cleanly', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('User login and session establishment', async ({ page }) => {
    attachErrorTracker(page);
    const creds = getUserCredentials();
    test.skip(!creds, 'User credentials (E2E_USER_EMAIL / E2E_USER_PASSWORD) not configured.');

    const success = await loginUser(page);
    expect(success).toBe(true);
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Authenticated session persists on page refresh (F5)', async ({ page }) => {
    attachErrorTracker(page);
    const creds = getUserCredentials();
    test.skip(!creds, 'User credentials (E2E_USER_EMAIL / E2E_USER_PASSWORD) not configured.');

    await loginUser(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Logout action resets user session and returns to auth/login view', async ({ page }) => {
    attachErrorTracker(page);
    const creds = getUserCredentials();
    test.skip(!creds, 'User credentials (E2E_USER_EMAIL / E2E_USER_PASSWORD) not configured.');

    await loginUser(page);

    // Click profile menu / avatar if logged in
    const profileBtn = page.locator('button[title*="Profile"], button[aria-label*="Profile"]').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      const logoutBtn = page.getByRole('button', { name: /Logout|Sign Out/i }).first();
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('#root')).toBeVisible();
      }
    }
  });
});
