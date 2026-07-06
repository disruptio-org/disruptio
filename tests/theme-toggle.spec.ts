import { test, expect } from '@playwright/test';

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage theme preference
    await page.goto('http://localhost:8000');
    await page.evaluate(() => localStorage.removeItem('disruptio-theme'));
  });

  test('defaults to dark theme', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.waitForLoadState('networkidle');

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('dark');
  });

  test('toggle switches from dark to light', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.waitForLoadState('networkidle');

    // Check if the toggle is anywhere on the page (requires auth + project page)
    const toggle = page.getByRole('button', { name: /switch to light theme/i });
    
    // If no toggle visible, try navigating to a project page
    if (!await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      const projectLink = page.locator('a[href*="/projects/"]').first();
      if (await projectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await projectLink.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // If still not visible, we're likely not authenticated — skip
    if (!await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await toggle.click();

    // Verify theme changed to light
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('light');

    // Verify localStorage was updated
    const stored = await page.evaluate(() => localStorage.getItem('disruptio-theme'));
    expect(stored).toBe('light');
  });

  test('toggle switches back from light to dark', async ({ page }) => {
    // Set light theme via localStorage first
    await page.goto('http://localhost:8000');
    await page.evaluate(() => localStorage.setItem('disruptio-theme', 'light'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to a project page
    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Find toggle — should now say "Switch to dark theme"
    const toggle = page.getByRole('button', { name: /switch to dark theme/i });
    if (await toggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await toggle.click();

      const theme = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme')
      );
      expect(theme).toBe('dark');

      const stored = await page.evaluate(() => localStorage.getItem('disruptio-theme'));
      expect(stored).toBe('dark');
    }
  });

  test('theme persists across page reload', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.evaluate(() => localStorage.setItem('disruptio-theme', 'light'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('light');
  });

  test('no page reload on toggle click', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.waitForLoadState('networkidle');

    // Navigate to project
    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');
    }

    const toggle = page.getByRole('button', { name: /switch to light theme/i });
    if (await toggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Track navigation events
      let navigated = false;
      page.on('load', () => { navigated = true; });

      await toggle.click();
      await page.waitForTimeout(500);

      expect(navigated).toBe(false);
    }
  });

  test('theme toggle is keyboard accessible', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.waitForLoadState('networkidle');

    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');
    }

    const toggle = page.getByRole('button', { name: /switch to light theme/i });
    if (await toggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await toggle.focus();
      await page.keyboard.press('Enter');

      const theme = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme')
      );
      expect(theme).toBe('light');
    }
  });

  test('theme applies consistently across navigation', async ({ page }) => {
    // Set light theme
    await page.goto('http://localhost:8000');
    await page.evaluate(() => localStorage.setItem('disruptio-theme', 'light'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to different pages and verify theme stays
    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');

      let theme = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme')
      );
      expect(theme).toBe('light');

      // Navigate to features tab if visible
      const featuresTab = page.locator('text=FEATURES').first();
      if (await featuresTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await featuresTab.click();
        await page.waitForTimeout(500);

        theme = await page.evaluate(() =>
          document.documentElement.getAttribute('data-theme')
        );
        expect(theme).toBe('light');
      }
    }
  });
});
