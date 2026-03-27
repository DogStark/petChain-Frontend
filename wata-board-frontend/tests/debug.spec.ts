import { test, expect } from '@playwright/test';

test('debug page content', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER ' + msg.type().toUpperCase() + ': ' + msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR: ' + err.message));

  await page.goto('http://localhost:5173/');
  
  // Wait for the h1 to be visible - this confirms the page loaded successfully
  await page.waitForSelector('h1', { timeout: 10000 });

  const title = await page.locator('h1').innerText();
  console.log('PAGE TITLE:', title);

  const html = await page.content();
  console.log('FULL HTML LENGTH:', html.length);
  
  // Check if Error Boundary is visible
  const errorVisible = await page.locator('h1:has-text("Something went wrong")').isVisible();
  console.log('ERROR BOUNDARY VISIBLE:', errorVisible);

  if (errorVisible) {
    const errorText = await page.locator('p.text-slate-300').innerText();
    console.log('UI ERROR TEXT:', errorText);
  }

  expect(errorVisible).toBe(false);
  expect(html.length).toBeGreaterThan(0);
});
