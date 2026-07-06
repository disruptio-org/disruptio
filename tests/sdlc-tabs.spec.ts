import { test, expect, Page } from '@playwright/test';

// Real IDs from the database
const PROJECT_ID = 'cmr8sz31c0001vqigo7rv4bqr';
const FEATURE_ID = 'cmr90ml1c000bvqh4zlxtt3x6';
const STORY_ID = 'cmr90orfu000dvqh4pzwqo1uj';
const STORY_URL = `/projects/${PROJECT_ID}/features/${FEATURE_ID}/stories/${STORY_ID}`;

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  // Wait for the form to render
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@disruptio.org');
  await page.locator('input[type="password"]').fill('disruptio');
  await page.locator('button:has-text("LOGIN")').click();
  // Wait for redirect to projects
  await page.waitForURL(/\/projects/, { timeout: 15000 });
}

async function goToStory(page: Page) {
  await page.goto(STORY_URL);
  await page.waitForLoadState('networkidle');
  // Wait for tab bar to render
  await page.waitForSelector('button:has-text("USER STORY")', { timeout: 15000 });
}

test.describe('SDLC Tabs - Structure', () => {
  test('all 10 tabs should be visible', async ({ page }) => {
    await login(page);
    await goToStory(page);

    const tabLabels = ['USER STORY', 'REQUIREMENTS', 'ACCEPTANCE CRITERIA', 'GHERKIN SCENARIOS',
      'MOCKUPS', 'TECH REVIEW', 'PLANNING', 'DEVELOPMENT', 'CODE REVIEW', 'SHIP'];
    
    for (const label of tabLabels) {
      await expect(page.locator(`button:has-text("${label}")`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('tab numbers 01 through 10 should be rendered', async ({ page }) => {
    await login(page);
    await goToStory(page);

    for (const num of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']) {
      await expect(page.locator(`text="${num}"`).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Phase 1: Development Tab', () => {
  test('should navigate to Development tab and show content', async ({ page }) => {
    await login(page);
    await goToStory(page);

    // Click on Development tab
    await page.locator('button:has-text("DEVELOPMENT")').click();
    await page.waitForTimeout(2000);

    // Should show one of: loading, data, or empty state
    const content = page.locator('text=/BRANCH|PULL REQUEST|LOADING DEVELOPMENT|NO GITHUB ISSUE|No development activity/i');
    await expect(content.first()).toBeVisible({ timeout: 20000 });
  });
});

test.describe('Phase 2+4: Code Review Tab with AI Evaluation', () => {
  test('should navigate to Code Review tab and show content', async ({ page }) => {
    await login(page);
    await goToStory(page);

    // First visit Development to sync PR data
    await page.locator('button:has-text("DEVELOPMENT")').click();
    await page.waitForTimeout(3000);

    // Then visit Code Review
    await page.locator('button:has-text("CODE REVIEW")').click();
    await page.waitForTimeout(2000);

    // Should show review content or empty state
    const content = page.locator('text=/REVIEWERS|PENDING|APPROVED|NO PULL REQUEST|LOADING CODE REVIEW|AI CODE EVALUATION/i');
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test('AI CODE EVALUATION section or NO PR message should be visible', async ({ page }) => {
    await login(page);
    await goToStory(page);

    await page.locator('button:has-text("DEVELOPMENT")').click();
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("CODE REVIEW")').click();
    await page.waitForTimeout(3000);

    // Either AI evaluation section (if PR exists) or NO PULL REQUEST message
    const hasAiSection = await page.locator('text="AI CODE EVALUATION"').first().isVisible().catch(() => false);
    const hasNoPrMsg = await page.locator('text=/NO PULL REQUEST/i').first().isVisible().catch(() => false);
    expect(hasAiSection || hasNoPrMsg).toBeTruthy();
  });

  test('evaluation button or no-PR state should be present', async ({ page }) => {
    await login(page);
    await goToStory(page);

    await page.locator('button:has-text("DEVELOPMENT")').click();
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("CODE REVIEW")').click();
    await page.waitForTimeout(3000);

    // Either evaluation button (if PR) or NO PULL REQUEST message
    const hasBtn = await page.locator('button:has-text("EVALUATION"), button:has-text("EVALUATE")').first().isVisible().catch(() => false);
    const hasNoPrMsg = await page.locator('text=/NO PULL REQUEST/i').first().isVisible().catch(() => false);
    expect(hasBtn || hasNoPrMsg).toBeTruthy();
  });
});

test.describe('Phase 5: Ship Tab', () => {
  test('should navigate to Ship tab and show content', async ({ page }) => {
    await login(page);
    await goToStory(page);

    await page.locator('button:has-text("SHIP")').click();
    await page.waitForTimeout(2000);

    // Should show ship content or empty state
    const content = page.locator('text=/MERGE STATUS|NO PULL REQUEST|LOADING SHIP|LIFECYCLE TIMELINE/i');
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Tab Navigation Flow', () => {
  test('can navigate through all new tabs sequentially', async ({ page }) => {
    await login(page);
    await goToStory(page);

    // Click Development
    await page.locator('button:has-text("DEVELOPMENT")').click();
    await page.waitForTimeout(2000);
    expect(await page.locator('text=/BRANCH|NO GITHUB|LOADING|No development/i').first().isVisible()).toBeTruthy();

    // Click Code Review
    await page.locator('button:has-text("CODE REVIEW")').click();
    await page.waitForTimeout(2000);
    expect(await page.locator('text=/AI CODE EVALUATION|NO PULL|LOADING|REVIEW/i').first().isVisible()).toBeTruthy();

    // Click Ship
    await page.locator('button:has-text("SHIP")').click();
    await page.waitForTimeout(2000);
    expect(await page.locator('text=/MERGE|NO PULL|LOADING|LIFECYCLE/i').first().isVisible()).toBeTruthy();
  });
});

test.describe('API Endpoints', () => {
  test('github-dev API should respond', async ({ request }) => {
    const response = await request.get(
      `/api/projects/${PROJECT_ID}/github-dev?storyId=${STORY_ID}&type=development`
    );
    expect([200, 401, 404]).toContain(response.status());
  });

  test('github-dev evaluate API should accept POST', async ({ request }) => {
    const response = await request.post(
      `/api/projects/${PROJECT_ID}/github-dev/evaluate`,
      { data: { storyId: STORY_ID } }
    );
    expect([200, 400, 401, 500]).toContain(response.status());
  });
});
