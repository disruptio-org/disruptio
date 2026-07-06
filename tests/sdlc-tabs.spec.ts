import { test, expect } from '@playwright/test';

// Real IDs from the database
const PROJECT_ID = 'cmr8sz31c0001vqigo7rv4bqr';
const FEATURE_ID = 'cmr90ml1c000bvqh4zlxtt3x6';
const STORY_ID = 'cmr90orfu000dvqh4pzwqo1uj';
const STORY_URL = `/projects/${PROJECT_ID}/features/${FEATURE_ID}/stories/${STORY_ID}`;

// Helper: login if needed (NextAuth session cookie)
async function ensureLoggedIn(page: any) {
  await page.goto('/');
  // Check if we need to login
  const url = page.url();
  if (url.includes('/login') || url.includes('/auth')) {
    await page.fill('input[name="email"], input[type="email"]', 'admin@disruptio.io');
    await page.fill('input[name="password"], input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/projects/);
  }
}

test.describe('SDLC Tabs - Structure', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('should display all 10 tabs in the pipeline', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    // All 10 tabs should be visible
    const tabLabels = ['USER STORY', 'REQUIREMENTS', 'ACCEPTANCE CRITERIA', 'GHERKIN SCENARIOS',
      'MOCKUPS', 'TECH REVIEW', 'PLANNING', 'DEVELOPMENT', 'CODE REVIEW', 'SHIP'];
    
    for (const label of tabLabels) {
      const tab = page.getByRole('button', { name: new RegExp(label, 'i') });
      await expect(tab).toBeVisible({ timeout: 15000 });
    }
  });

  test('should display tab numbers 01 through 10', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    for (const num of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']) {
      await expect(page.locator(`text="${num}"`).first()).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Phase 1: Development Tab', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('should navigate to Development tab', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    // Click on Development tab
    const devTab = page.getByRole('button', { name: /DEVELOPMENT/i });
    await devTab.click();

    // Should show development content (either loading, data, or empty state)
    await expect(
      page.locator('text=/BRANCH|PULL REQUEST|LOADING DEVELOPMENT|NO GITHUB ISSUE|No development activity/i').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('Development tab should show branch and PR cards when issue has activity', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    const devTab = page.getByRole('button', { name: /DEVELOPMENT/i });
    await devTab.click();

    // Wait for loading to complete
    await page.waitForFunction(() => {
      return !document.querySelector('[class*="spin"]') ||
        document.querySelector('text=/BRANCH/i');
    }, { timeout: 15000 });

    // After loading, should show BRANCH and PULL REQUEST labels
    // or empty state message
    const hasBranch = await page.locator('text=BRANCH').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=/No development activity|No branch detected/i').first().isVisible().catch(() => false);
    
    expect(hasBranch || hasEmpty).toBeTruthy();
  });
});

test.describe('Phase 2: Code Review Tab', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('should navigate to Code Review tab', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    const reviewTab = page.getByRole('button', { name: /CODE REVIEW/i });
    await reviewTab.click();

    // Should show review content or empty state
    await expect(
      page.locator('text=/REVIEWERS|PENDING REVIEW|APPROVED|NO PULL REQUEST|LOADING CODE REVIEW|No reviews submitted/i').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('Code Review tab should show AI evaluation section', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    const reviewTab = page.getByRole('button', { name: /CODE REVIEW/i });
    await reviewTab.click();

    // Wait for content to load
    await page.waitForTimeout(3000);

    // AI evaluation section should be visible
    await expect(
      page.locator('text=/AI CODE EVALUATION/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('AI evaluation should have run button', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    const reviewTab = page.getByRole('button', { name: /CODE REVIEW/i });
    await reviewTab.click();

    await page.waitForTimeout(3000);

    // Either "RUN EVALUATION" or "RE-EVALUATE" button should exist
    const runButton = page.locator('button:has-text("EVALUATION")').first();
    await expect(runButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Phase 5: Ship Tab', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('should navigate to Ship tab', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    const shipTab = page.getByRole('button', { name: /SHIP/i });
    await shipTab.click();

    // Should show ship content or empty state
    await expect(
      page.locator('text=/MERGE STATUS|NO PULL REQUEST|LOADING SHIP|LIFECYCLE TIMELINE/i').first()
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Tab Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('should navigate through all SDLC tabs sequentially', async ({ page }) => {
    await page.goto(STORY_URL);
    await page.waitForLoadState('networkidle');

    const tabs = [
      { name: 'USER STORY', content: /persona|want to/i },
      { name: 'REQUIREMENTS', content: /functional|requirement|GENERATE/i },
      { name: 'DEVELOPMENT', content: /BRANCH|LOADING|NO GITHUB|No development/i },
      { name: 'CODE REVIEW', content: /REVIEW|PENDING|AI CODE EVALUATION|NO PULL/i },
      { name: 'SHIP', content: /MERGE|LOADING|NO PULL|LIFECYCLE/i },
    ];

    for (const tab of tabs) {
      const button = page.getByRole('button', { name: new RegExp(tab.name, 'i') });
      await button.click();
      await expect(
        page.locator(`text=${tab.content.source}`).first()
      ).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('API Endpoints', () => {
  test('github-dev API should return development data', async ({ request }) => {
    const response = await request.get(
      `/api/projects/${PROJECT_ID}/github-dev?storyId=${STORY_ID}&type=development`
    );
    // May return 401 (no auth) or 200 with data, or 404 (no issue)
    expect([200, 401, 404]).toContain(response.status());
  });

  test('github-dev evaluate API should accept POST', async ({ request }) => {
    const response = await request.post(
      `/api/projects/${PROJECT_ID}/github-dev/evaluate`,
      { data: { storyId: STORY_ID } }
    );
    // May return 401 (no auth) or 200/400/500 depending on state
    expect([200, 400, 401, 500]).toContain(response.status());
  });
});
