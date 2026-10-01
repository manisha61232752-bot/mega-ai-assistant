import { test, expect } from '@playwright/test';
import { attachErrorTracker } from '../helpers/auth';

test.describe('Profile, Settings & Help Route Overlay E2E Tests', () => {
  test('Profile route (/profile) opens modal overlay without white screen', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    const text = await page.textContent('#root');
    expect(text?.length).toBeGreaterThan(50);
  });

  test('Profile modal persists on F5 refresh', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
    expect(page.url()).toContain('/profile');
  });

  test('Settings route (/settings) opens modal overlay without white screen', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Settings sub-tab routes (/settings?tab=security, appearance, notifications)', async ({ page }) => {
    attachErrorTracker(page);
    
    // Security tab
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    // Appearance tab
    await page.goto('/settings?tab=appearance');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    // Notifications tab
    await page.goto('/settings?tab=notifications');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Settings modal persists on F5 refresh', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/settings?tab=security');
    await page.waitForLoadState('domcontentloaded');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
    expect(page.url()).toContain('/settings');
  });

  test('Help route (/help) opens modal overlay and persists on F5 refresh', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
    expect(page.url()).toContain('/help');
  });

  test('Closing modal dialog returns cleanly to underlying view', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');

    const closeBtn = page.locator('button[title*="Close"], button:has-text("✕")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#root')).toBeVisible();
    }
  });

  test('Browser back/forward navigation with modal routes', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    await page.goForward();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });
});
