# Visual Regression Tests

This directory contains visual regression test suites powered by Playwright (`playwright.visual.config.ts`), covering critical UI layouts including **Emergency QR layouts**, wallet flows, and accessibility modes.

## Coverage

- **Viewports**: Desktop (`1280×800`), Mobile (`390×844`), Mobile Landscape (`844×390`), Desktop Landscape (`1280×720`), Narrow Phone (`320×568`), and Print layout.
- **Themes**: Light mode and Dark mode.
- **Accessibility**: Large-text mode (`font-size: 24px`).
- **Emergency QR Layouts**: Verifies that the QR code quiet zone and primary contact actions (call buttons, preview links, download actions) remain visible and fully functional across narrow, large-text, landscape, dark-mode, and print layouts.

## Determinism

To ensure stable, non-flaky visual diffs:
- Dynamic content (Stellar addresses, balances, timestamps, UUIDs) is masked automatically before screenshotting.
- CSS animations and transitions are disabled globally via Playwright launch options and `toHaveScreenshot` config.
- Consistent fonts are used across environments.

## Running Tests Locally

```bash
# Run all visual regression tests
npx playwright test --config playwright.visual.config.ts --project=chromium

# Run only emergency visual tests
npx playwright test tests/visual/ --project=chromium -g "Emergency"
```

## Snapshot Update Process

When intentional UI or CSS changes are made, baseline snapshots must be updated:

1. **Update snapshots locally:**
   ```bash
   npx playwright test tests/visual/ --project=chromium --update-snapshots
   ```
2. **Review the diff:**
   Inspect the updated `.png` files under `tests/visual/snapshots/` using git diff / git status.
3. **Commit updated baselines:**
   ```bash
   git add tests/visual/snapshots/
   git commit -m "test(visual): update baseline screenshots for emergency QR layouts"
   ```

### Updating via GitHub Actions (CI)
You can also trigger a baseline update via GitHub Actions workflow dispatch on `.github/workflows/visual-regression.yml` by setting `update_baselines` to `true`, then downloading and committing the generated snapshot artifact.
