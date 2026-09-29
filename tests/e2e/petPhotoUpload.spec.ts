import { test, expect, type Page, type Route } from '@playwright/test';

const PET_ID = '123e4567-e89b-12d3-a456-426614174000';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYz8AAAAASUVORK5CYII=',
  'base64'
);

const existingPhoto = {
  id: 'photo-existing',
  petId: PET_ID,
  photoUrl: '/existing-photo.png',
  thumbnailUrl: '/existing-photo.png',
  isPrimary: true,
  displayOrder: 0,
  mimeType: 'image/png',
  fileSize: PNG.length,
  width: 1,
  height: 1,
  originalFilename: 'existing.png',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function mockPetApi(page: Page, uploadHandler: (route: Route) => Promise<void>) {
  await page.addInitScript(() => localStorage.setItem('authToken', 'e2e-upload-token'));
  await page.route('**/api/v1/pets/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'GET' && pathname === `/api/v1/pets/${PET_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: PET_ID,
          name: 'Miso',
          species: 'cat',
          gender: 'female',
          dateOfBirth: '2020-01-01',
          weight: null,
          color: null,
          microchipNumber: null,
          specialNeeds: null,
          photos: [existingPhoto],
        }),
      });
      return;
    }

    if (request.method() === 'GET' && pathname === `/api/v1/pets/${PET_ID}/photos`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([existingPhoto]) });
      return;
    }

    if (request.method() === 'POST' && pathname === `/api/v1/pets/${PET_ID}/photos`) {
      await uploadHandler(route);
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/existing-photo.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
}

test.describe('Pet photo upload recovery', () => {
  test('preserves the current primary photo after failure and retries the same batch', async ({ page }) => {
    let uploadCalls = 0;
    const idempotencyKeys: string[] = [];
    let releaseRetry!: () => void;
    const retryPending = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    await mockPetApi(page, async (route) => {
      uploadCalls++;
      idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
      if (uploadCalls === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Upload failed' }),
        });
        return;
      }
      await retryPending;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ ...existingPhoto, id: 'photo-new', isPrimary: false, originalFilename: 'new-pet.png' }]),
      });
    });
    await page.goto(`/pets/${PET_ID}`);

    await page.getByLabel('Select photos to upload').setInputFiles({
      name: 'new-pet.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(page.getByRole('img', { name: 'new-pet.png' })).toBeVisible();
    await page.getByRole('button', { name: 'Upload 1 photo' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Upload failed' })).toContainText('Upload failed');
    await expect(page.getByRole('img', { name: 'new-pet.png' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Miso' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry upload' })).toBeVisible();

    await page.getByRole('button', { name: 'Retry upload' }).click();
    await expect(page.getByRole('img', { name: 'new-pet.png' })).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Miso' })).toBeVisible();
    await expect.poll(() => uploadCalls).toBe(2);
    expect(idempotencyKeys[0]).toBeTruthy();
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
    releaseRetry();
  });

  test('aborts an in-flight upload and clears staged preview state', async ({ page }) => {
    let releaseUpload!: () => void;
    const pendingUpload = new Promise<void>((resolve) => { releaseUpload = resolve; });
    await mockPetApi(page, async (route) => {
      await pendingUpload;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([]) }).catch(() => undefined);
    });
    await page.goto(`/pets/${PET_ID}`);

    await page.getByLabel('Select photos to upload').setInputFiles({
      name: 'new-pet.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(page.getByRole('img', { name: 'new-pet.png' })).toBeVisible();
    const requestFailed = page.waitForEvent('requestfailed', {
      predicate: (request) => request.method() === 'POST' && request.url().includes(`/pets/${PET_ID}/photos`),
    });
    await page.getByRole('button', { name: 'Upload 1 photo' }).click();
    await page.getByRole('button', { name: 'Cancel upload' }).click();

    await expect(page.getByRole('img', { name: 'new-pet.png' })).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Miso' })).toBeVisible();
    await requestFailed;
    releaseUpload();
  });
});