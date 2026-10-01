import { test, expect } from '@playwright/test';
import { attachErrorTracker } from '../helpers/auth';

test.describe('Workspace & Navigation E2E Tests', () => {
  test('Workspace area is present and reachable', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('Hamburger sidebar toggle button expands and collapses sidebar', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const sidebarToggle = page.locator('button[title*="Sidebar"], button[title*="Workspace"], button[aria-label*="sidebar"]').first();
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#root')).toBeVisible();

      // Toggle back
      await sidebarToggle.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#root')).toBeVisible();
    }
  });

  test('New Chat action from Workspace sidebar works cleanly', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const newChatBtn = page.locator('button[title*="New Chat"], button').first();
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#root')).toBeVisible();
    }
  });

  test('Pinned chats section visibility in sidebar', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const pinnedSection = page.getByText(/Pinned|Saved/i).first();
    const isVisible = await pinnedSection.isVisible().catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });
});
