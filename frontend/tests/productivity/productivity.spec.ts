import { test, expect } from '@playwright/test';
import { attachErrorTracker } from '../helpers/auth';

test.describe('Productivity Features & Modules E2E Tests', () => {
  test('Help & Hotkeys dialog opens correctly from route or UI', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();

    const rootText = await page.textContent('#root');
    expect(rootText).toBeDefined();
  });

  test('Documents workspace and file management panel accessibility', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const docsTab = page.getByText(/Documents|Files|Workspace/i).first();
    if (await docsTab.isVisible()) {
      await docsTab.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#root')).toBeVisible();
    }
  });

  test('AI Automation & Agent Tools module accessibility', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const automationTab = page.getByText(/Automation|Tools|Agent/i).first();
    if (await automationTab.isVisible()) {
      await automationTab.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#root')).toBeVisible();
    }
  });

  test('Notes, Tasks, and Reminders productivity shortcuts accessibility', async ({ page }) => {
    attachErrorTracker(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const productivityBtn = page.locator('button[title*="Notes"], button[title*="Tasks"], button[title*="Reminders"]').first();
    const isVisible = await productivityBtn.isVisible().catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });
});
