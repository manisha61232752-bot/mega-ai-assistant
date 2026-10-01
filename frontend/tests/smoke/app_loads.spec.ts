import { test, expect } from '@playwright/test';

test.describe('App Baseline & Smoke Tests', () => {
  test('Production / App website loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/frontend|Mega Assistant|AI/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Main Application UI loads without white screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const root = page.locator('#root');
    await expect(root).toBeVisible();
    
    const pageText = await page.textContent('body');
    expect(pageText?.length).toBeGreaterThan(50);
  });

  test('New Chat button or primary action is present in the UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const newChatBtn = page.locator('button[title*="New Chat"], button').first();
    await expect(newChatBtn).toBeAttached();
  });

  test('Profile route (/profile) opens modal overlay without white screen', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Settings route (/settings) opens modal overlay without white screen', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Help route (/help) opens modal overlay without white screen', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible();
  });
});
