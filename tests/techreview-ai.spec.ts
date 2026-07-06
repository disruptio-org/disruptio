import { test, expect, Page } from '@playwright/test';

const PROJECT_ID = 'cmr8sz31c0001vqigo7rv4bqr';
const FEATURE_ID = 'cmr90ml1c000bvqh4zlxtt3x6';
const STORY_ID = 'cmr9eifs40001vqlglvzvlicr';
const STORY_URL = `/projects/${PROJECT_ID}/features/${FEATURE_ID}/stories/${STORY_ID}`;

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@disruptio.org');
  await page.locator('input[type="password"]').fill('disruptio');
  await page.locator('button:has-text("LOGIN")').click();
  await page.waitForURL(/\/projects/, { timeout: 15000 });
}

test('Tech Review AI generation should populate form fields', async ({ page }) => {
  test.setTimeout(120000); // 2 min for AI call

  await login(page);
  await page.goto(STORY_URL);
  await page.waitForLoadState('networkidle');

  // Navigate to Tech Review tab
  await page.locator('button:has-text("TECH REVIEW")').click();
  await page.waitForTimeout(1000);

  // Check fields are initially empty (placeholder visible)
  const notesTextarea = page.locator('textarea').first();
  const initialValue = await notesTextarea.inputValue();
  console.log('Initial notes value:', JSON.stringify(initialValue));

  // Select an agent (first available)
  const agentSelect = page.locator('select').last();
  const options = await agentSelect.locator('option').all();
  let agentValue = '';
  for (const opt of options) {
    const val = await opt.getAttribute('value');
    if (val) { agentValue = val; break; }
  }
  console.log('Selected agent:', agentValue);
  if (agentValue) {
    await agentSelect.selectOption(agentValue);
  }

  // Capture network responses
  const runResponsePromise = page.waitForResponse(
    resp => resp.url().includes('/agents/run') && resp.request().method() === 'POST',
    { timeout: 90000 }
  );

  // Click Generate with AI
  await page.locator('button:has-text("GENERATE WITH AI")').click();
  console.log('Clicked GENERATE WITH AI');

  // Wait for the AI run response
  const runResponse = await runResponsePromise;
  console.log('Run response status:', runResponse.status());
  const runData = await runResponse.json();
  console.log('Run response has error:', !!runData.error);
  console.log('Run response.response length:', (runData.response || '').length);
  console.log('Run response.response (first 300):', (runData.response || '').substring(0, 300));

  // Check if a PATCH was also made
  // Wait a bit for the PATCH to complete
  await page.waitForTimeout(3000);

  // Now check the textarea values
  // Re-query since component may have remounted
  const allTextareas = page.locator('textarea');
  const textareaCount = await allTextareas.count();
  console.log('Number of textareas:', textareaCount);

  for (let i = 0; i < textareaCount; i++) {
    const val = await allTextareas.nth(i).inputValue();
    console.log(`Textarea ${i} value (first 100):`, JSON.stringify(val.substring(0, 100)));
  }

  // At least one textarea should have content after AI generation
  let anyFilled = false;
  for (let i = 0; i < textareaCount; i++) {
    const val = await allTextareas.nth(i).inputValue();
    if (val.length > 0) {
      anyFilled = true;
      break;
    }
  }

  // Also check console logs
  page.on('console', msg => {
    if (msg.text().includes('[AI Assist]')) {
      console.log('BROWSER LOG:', msg.text());
    }
  });

  expect(anyFilled).toBeTruthy();
});
