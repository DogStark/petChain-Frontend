import { test, expect } from '@playwright/test';

test.describe('PetPhotos accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pets/photos');
  });

  test('adds a photo using the native file input fallback', async ({ page }) => {
    const fileInput = page.getByLabel(/add photos/i);
    await expect(fileInput).toBeVisible();

    await fileInput.setInputFiles({
      name: 'pet.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-data'),
    });

    await expect(page.getByRole('img', { name: /pet\.png/i })).toBeVisible();
  });

  test('reorders photos with keyboard controls and announces the new position', async ({ page }) => {
    const firstPhoto = page.getByRole('listitem').first();
    await firstPhoto.getByRole('button', { name: /move .* down/i }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toContainText(/position 2/i);
  });

  test('previews a photo via keyboard', async ({ page }) => {
    const previewButton = page.getByRole('button', { name: /preview/i }).first();
    await previewButton.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(previewButton).toBeFocused();
  });

  test('removes a photo with a confirmation path', async ({ page }) => {
    const removeButton = page.getByRole('button', { name: /remove photo/i }).first();
    await removeButton.focus();
    await page.keyboard.press('Enter');

    const confirm = page.getByRole('button', { name: /confirm remove/i });
    await expect(confirm).toBeVisible();
    await confirm.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toContainText(/removed/i);
  });
});
