import { test, expect, Page } from '@playwright/test';

/**
 * Long-list pagination flow for medical records and activity feeds.
 *
 * Covers the acceptance criteria of #993:
 *  - items do not duplicate across pages
 *  - end-of-list is distinguished from an empty first page
 *  - a failed next page does not erase already loaded records
 *  - refresh resets the cursor safely without racing an in-flight request
 */

const RECORDS_PATH = '/records';
const ACTIVITY_PATH = '/activity';

interface PageResponse {
  items: Array<{ id: string; title: string }>;
  nextCursor: string | null;
}

/**
 * Builds a deterministic, paginated dataset so the test can assert on
 * stable canonical ids and cursor progression.
 */
function buildDataset(total: number, pageSize: number): PageResponse[] {
  const pages: PageResponse[] = [];
  for (let start = 0; start < total; start += pageSize) {
    const end = Math.min(start + pageSize, total);
    const items = [];
    for (let i = start; i < end; i += 1) {
      items.push({ id: `rec-${i}`, title: `Record ${i}` });
    }
    const nextCursor = end < total ? `cursor-${end}` : null;
    pages.push({ items, nextCursor });
  }
  return pages;
}

async function mockPaginatedApi(
  page: Page,
  path: string,
  pages: PageResponse[],
  options: { failOnCursor?: string } = {},
) {
  await page.route(`**${path}*`, async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get('cursor');

    if (options.failOnCursor && cursor === options.failOnCursor) {
      await route.fulfill({ status: 500, body: 'server error' });
      return;
    }

    const index = cursor
      ? pages.findIndex((p) => p.nextCursor === cursor) + 1
      : 0;
    const payload = pages[index] ?? { items: [], nextCursor: null };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

async function scrollToBottom(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
}

test.describe('resilient long-list pagination', () => {
  test('loads all pages without duplicating items', async ({ page }) => {
    const pages = buildDataset(60, 20);
    await mockPaginatedApi(page, RECORDS_PATH, pages);

    await page.goto(RECORDS_PATH);
    await expect(page.getByTestId('record-item')).toHaveCount(20);

    await scrollToBottom(page);
    await expect(page.getByTestId('record-item')).toHaveCount(40);

    await scrollToBottom(page);
    await expect(page.getByTestId('record-item')).toHaveCount(60);

    // No duplicate canonical ids across pages.
    const ids = await page
      .getByTestId('record-item')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-id')));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('distinguishes end-of-list from an empty first page', async ({ page }) => {
    const pages = buildDataset(20, 20);
    await mockPaginatedApi(page, RECORDS_PATH, pages);

    await page.goto(RECORDS_PATH);
    await expect(page.getByTestId('record-item')).toHaveCount(20);

    await scrollToBottom(page);
    await expect(page.getByTestId('end-of-list')).toBeVisible();
    await expect(page.getByTestId('empty-state')).toHaveCount(0);
  });

  test('shows empty state when the first page is empty', async ({ page }) => {
    await mockPaginatedApi(page, RECORDS_PATH, [
      { items: [], nextCursor: null },
    ]);

    await page.goto(RECORDS_PATH);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('end-of-list')).toHaveCount(0);
  });

  test('keeps loaded records when a next page fails and allows retry', async ({
    page,
  }) => {
    const pages = buildDataset(60, 20);
    await mockPaginatedApi(page, RECORDS_PATH, pages, {
      failOnCursor: 'cursor-20',
    });

    await page.goto(RECORDS_PATH);
    await expect(page.getByTestId('record-item')).toHaveCount(20);

    await scrollToBottom(page);
    await expect(page.getByTestId('pagination-error')).toBeVisible();
    // Previously loaded records must not be erased by the failure.
    await expect(page.getByTestId('record-item')).toHaveCount(20);

    // Recover: stop failing and retry at the point of failure.
    await page.unroute(`**${RECORDS_PATH}*`);
    await mockPaginatedApi(page, RECORDS_PATH, pages);
    await page.getByTestId('pagination-retry').click();
    await expect(page.getByTestId('record-item')).toHaveCount(40);
  });

  test('refresh resets the cursor without racing an in-flight request', async ({
    page,
  }) => {
    const pages = buildDataset(60, 20);
    await mockPaginatedApi(page, RECORDS_PATH, pages);

    await page.goto(RECORDS_PATH);
    await expect(page.getByTestId('record-item')).toHaveCount(20);

    // Trigger a next-page load and immediately refresh before it settles.
    await scrollToBottom(page);
    await page.getByTestId('refresh-button').click();

    // After refresh the list is reset to the first page exactly once.
    await expect(page.getByTestId('record-item')).toHaveCount(20);
    const ids = await page
      .getByTestId('record-item')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-id')));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('recovers after going offline and back online', async ({ page, context }) => {
    const pages = buildDataset(60, 20);
    await mockPaginatedApi(page, RECORDS_PATH, pages);

    await page.goto(RECORDS_PATH);
    await expect(page.getByTestId('record-item')).toHaveCount(20);

    await context.setOffline(true);
    await scrollToBottom(page);
    await expect(page.getByTestId('pagination-error')).toBeVisible();
    await expect(page.getByTestId('record-item')).toHaveCount(20);

    await context.setOffline(false);
    await page.getByTestId('pagination-retry').click();
    await expect(page.getByTestId('record-item')).toHaveCount(40);
  });

  test('activity feed paginates without duplicates', async ({ page }) => {
    const pages = buildDataset(40, 20);
    await mockPaginatedApi(page, ACTIVITY_PATH, pages);

    await page.goto(ACTIVITY_PATH);
    await expect(page.getByTestId('activity-item')).toHaveCount(20);

    await scrollToBottom(page);
    await expect(page.getByTestId('activity-item')).toHaveCount(40);

    const ids = await page
      .getByTestId('activity-item')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-id')));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
