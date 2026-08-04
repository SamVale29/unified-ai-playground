import { expect, test } from '@playwright/test';

test('opens the safe demo, runs a comparison and exposes the inspector', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI SDK Playground' })).toBeVisible();
  await expect(page.getByText('Demo mode uses simulated provider responses.')).toBeVisible();
  await page.getByLabel('Preset').selectOption('structured');
  await page.getByRole('button', { name: 'Run comparison' }).click();
  await expect(page.getByText('Fixture run completed. Values are simulated and safe to share.')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: 'Metrics' }).click();
  await expect(page.getByText('Measured metrics')).toBeVisible();
  await page.getByRole('tab', { name: 'Compatibility' }).click();
  await expect(page.getByRole('heading', { name: 'Compatibility report', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Export' }).click();
  await expect(page.getByText('Sanitized export')).toBeVisible();
});

test('keeps the layout usable on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Experiment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
