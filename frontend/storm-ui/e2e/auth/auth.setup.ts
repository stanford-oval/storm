import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/auth/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('/auth/login');

  // Fill in login form
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.fill('[data-testid="password-input"]', 'testpassword123');
  await page.click('[data-testid="login-button"]');

  // Wait until the page receives the cookies.
  //
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await expect(page).toHaveURL('/dashboard');

  // Alternatively, you can wait until the page reaches a state where all cookies are set.
  await expect(page.getByTestId('user-menu')).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});
