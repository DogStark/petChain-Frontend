import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURES = path.join(__dirname, 'fixtures');

/**
 * Pet photo upload flow.
 *
 * Covers issue #980: client-side orientation normalization, HEIC fallback,
 * bounded size/dimensions, and safe filename handling.
 */
test.describe('pet photo upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pets/new');
  });

  test('normalizes EXIF orientation so the preview matches the upload', async ({ page }) => {
    const input = page.locator('input[type="file"][name="photo"]');
    await input.setInputFiles(path.join(FIXTURES, 'oriented-portrait.jpg'));

    const preview = page.getByTestId('pet-photo-preview');
    await expect(preview).toBeVisible();

    // The normalized preview must be portrait (height > width) regardless of
    // the raw EXIF orientation tag in the source file.
    const box = await preview.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(box!.width);
  });

  test('converts HEIC uploads to a browser-safe format', async ({ page }) => {
    const input = page.locator('input[type="file"][name="photo"]');
    await input.setInputFiles(path.join(FIXTURES, 'pet.heic'));

    const preview = page.getByTestId('pet-photo-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('src', /^data:image\/(jpeg|png|webp)/);
    await expect(page.getByTestId('pet-photo-error')).toHaveCount(0);
  });

  test('rejects HEIC with an actionable message when conversion is unavailable', async ({ page }) => {
    // Simulate a browser without HEIC decoding support.
    await page.addInitScript(() => {
      // @ts-expect-error test hook
      window.__DISABLE_HEIC_DECODE__ = true;
    });
    await page.reload();

    const input = page.locator('input[type="file"][name="photo"]');
    await input.setInputFiles(path.join(FIXTURES, 'pet.heic'));

    const error = page.getByTestId('pet-photo-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/HEIC|HEIF/i);
    await expect(error).toContainText(/JPEG|PNG|convert/i);
  });

  test('rejects oversized files before upload', async ({ page }) => {
    const input = page.locator('input[type="file"][name="photo"]');
    await input.setInputFiles(path.join(FIXTURES, 'oversized.jpg'));

    const error = page.getByTestId('pet-photo-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/too large|size/i);
    await expect(page.getByTestId('pet-photo-preview')).toHaveCount(0);
  });

  test('rejects images with excessive dimensions before upload', async ({ page }) => {
    const input = page.locator('input[type="file"][name="photo"]');
    await input.setInputFiles(path.join(FIXTURES, 'huge-dimensions.jpg'));

    const error = page.getByTestId('pet-photo-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/dimensions|resolution|pixels/i);
  });

  test('normalizes unsafe filenames and never exposes raw metadata', async ({ page }) => {
    const input = page.locator('input[type="file"][name="photo"]');
    await input.setInputFiles({
      name: '../../etc/passwd<script>.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-jpeg-bytes'),
    });

    const preview = page.getByTestId('pet-photo-preview');
    await expect(preview).toBeVisible();

    const src = await preview.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).not.toContain('..');
    expect(src).not.toContain('<');
    expect(src).not.toContain('script');

    // No raw EXIF/metadata should leak into the rendered UI.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/exif|gps|latitude|longitude/i);
  });
});
