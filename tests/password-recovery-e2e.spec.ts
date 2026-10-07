import { test, expect } from '@playwright/test';

test.describe('Password Recovery and Auth UX', () => {
  test('Login page has accessible Forgot password? link targeting /auth/forgot-password', async ({
    page,
  }) => {
    await page.goto('/auth/login');

    const forgotLink = page.getByRole('link', { name: 'Forgot password?' });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', '/auth/forgot-password');

    // Click link and navigate
    await forgotLink.click();
    await page.waitForURL((url) => url.pathname === '/auth/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
  });

  test('Forgot Password Form: Validates email input and rejects invalid formats', async ({
    page,
  }) => {
    await page.goto('/auth/forgot-password');

    const submitBtn = page.getByRole('button', { name: 'Send Reset Link' });
    const emailInput = page.getByLabel('Email Address');

    // Empty or invalid input
    await emailInput.fill('invalid-email-address');
    await submitBtn.click();

    // Check error message
    const errorAlert = page.getByText('Please provide a valid email address.');
    await expect(errorAlert).toBeVisible();
  });

  test('Forgot Password Form: Submits valid email, displays generic success, and preserves privacy (no account enumeration)', async ({
    page,
  }) => {
    await page.goto('/auth/forgot-password');

    const testEmail = `recovery_tester_${Date.now()}@example.com`;
    await page.getByLabel('Email Address').fill(testEmail);
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    // Verify success view
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
    const successMsg = page.getByText(
      'If an account is associated with this email, a password reset link has been sent. Please check your inbox and spam folder.'
    );
    await expect(successMsg).toBeVisible();

    // Verify privacy: No mention of user presence or lack thereof
    await expect(page.getByText('This email does not exist')).not.toBeVisible();
    await expect(page.getByText('User not found')).not.toBeVisible();

    // Verify back to sign in link
    const backToSignIn = page.getByRole('link', { name: 'Back to Sign In' });
    await expect(backToSignIn).toBeVisible();
    await backToSignIn.click();
    await page.waitForURL((url) => url.pathname === '/auth/login');
  });

  test('Update Password Page: Guard against unauthenticated/expired recovery sessions', async ({
    page,
  }) => {
    // Visit without code or session
    await page.goto('/auth/update-password');

    // Verify expired / invalid session state
    await expect(page.getByRole('heading', { name: 'Invalid or Expired Link' })).toBeVisible();
    await expect(
      page.getByText(
        'The reset link is invalid or has expired. Please request a new password reset email.'
      )
    ).toBeVisible();

    // Verify link to request a new reset link
    const requestNewLink = page.getByRole('link', { name: 'Request New Reset Link' });
    await expect(requestNewLink).toBeVisible();
    await requestNewLink.click();
    await page.waitForURL((url) => url.pathname === '/auth/forgot-password');
  });
});
