import { test, expect } from '@playwright/test';

test.describe('Task management end-to-end', () => {
  test('register, create, tag, edit, delete', async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;

    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByTestId('user-email')).toHaveText(email);

    await page.click('button:has-text("+ New task")');
    await page.fill('input[name="title"]', 'Write E2E test');
    await page.fill('input[name="new-tag-name"]', 'e2e');
    await page.click('button:has-text("Add")');
    await page.click('button:has-text("Create task")');

    const card = page.getByTestId('task-card').filter({ hasText: 'Write E2E test' });
    await expect(card).toBeVisible();
    await expect(card.getByText('e2e')).toBeVisible();

    await card.getByRole('button', { name: /to in_progress/i }).click();
    await expect(card.getByText(/to done/i)).toBeVisible();

    await page.on('dialog', (dialog) => dialog.accept());
    await card.getByRole('button', { name: 'Delete' }).click();
    await expect(card).toHaveCount(0);
  });
});
