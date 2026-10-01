import { test, expect } from '@playwright/test';
import { getAdminCredentials, loginAdmin, attachErrorTracker } from '../helpers/auth';

test.describe('Admin Panel E2E & Safety Tests', () => {
  test('Admin Panel route navigation handling without white screen', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    const text = await page.textContent('#root');
    expect(text?.length).toBeGreaterThan(50);
  });

  test('Admin Users section renders without adminUsers.map error or white screen', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/admin?section=users');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Admin Subscriptions section renders without features.map error or white screen', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/admin?section=subscription');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Repeated switching Users -> Subscriptions -> Users without runtime crash', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/admin?section=users');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin?section=subscription');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin?section=users');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#root')).toBeVisible();
  });

  test('Admin Audit Logs and System Errors sections render safely', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/admin?section=logs');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    await page.goto('/admin?section=errors');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Admin page refresh (F5) does not produce a blank screen', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Full Admin Panel authenticated access flow (Skipped if admin credentials not configured)', async ({ page }) => {
    attachErrorTracker(page);
    const creds = getAdminCredentials();
    test.skip(
      !creds,
      'Admin test credentials (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) not configured in environment.'
    );

    const loggedIn = await loginAdmin(page);
    expect(loggedIn).toBe(true);

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });
});
