import { test, expect } from '@playwright/test';

test('debug crash', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('/');
  await page.waitForTimeout(5000);
  
  const rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('ROOT CONTENT:', rootContent);
  
  if (!rootContent || rootContent.length < 10) {
    throw new Error('Root is empty! App likely crashed.');
  }
});
