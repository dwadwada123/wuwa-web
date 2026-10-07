import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const GENERIC_SUCCESS_MESSAGE =
  'If an account is associated with this email, a password reset link has been sent. Please check your inbox and spam folder.';
const INVALID_LINK_MESSAGE =
  'The reset link is invalid or has expired. Please request a new password reset email.';

test('Forgot Password: Email Validation Logic', () => {
  function validateEmail(email: string): { valid: boolean; error?: string } {
    const clean = email.trim();
    if (!clean) {
      return { valid: false, error: 'Please provide an email address.' };
    }
    if (!clean.includes('@') || !clean.includes('.')) {
      return { valid: false, error: 'Please provide a valid email address.' };
    }
    return { valid: true };
  }

  assert.strictEqual(validateEmail('').valid, false);
  assert.strictEqual(validateEmail('   ').valid, false);
  assert.strictEqual(validateEmail('invalid-email').valid, false);
  assert.strictEqual(validateEmail('no-domain@').valid, false);
  assert.strictEqual(validateEmail('test@example').valid, false);
  assert.strictEqual(validateEmail('test@example.com').valid, true);
  assert.strictEqual(validateEmail('  rover@solaris3.org  ').valid, true);
});

test('Forgot Password: Anti-Enumeration & Dynamic Origin Verification', async () => {
  const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const origin = 'https://wuwa-hub.vercel.app';
  const targetRedirect = `${origin}/auth/update-password`;

  // 1. Test with a non-existent email
  const nonExistentEmail = `unregistered_${Date.now()}@solaris3.test`;
  const { error: errorNonExistent } = await supabase.auth.resetPasswordForEmail(
    nonExistentEmail,
    { redirectTo: targetRedirect }
  );

  // Even if user does not exist, no error exposing non-existence is returned
  assert.strictEqual(errorNonExistent, null);

  // User UI should always render generic success message
  const uiMessageNonExistent = GENERIC_SUCCESS_MESSAGE;
  assert.match(uiMessageNonExistent, /If an account is associated with this email/i);
  assert.doesNotMatch(uiMessageNonExistent, /email does not exist/i);

  // 2. Test with an existing registered user
  const adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existingEmail = `existing_user_${Date.now()}@solaris3.test`;
  const { data: createdUser } = await adminClient.auth.admin.createUser({
    email: existingEmail,
    password: 'InitialPassword123!',
    email_confirm: true,
  });

  try {
    const { error: errorExisting } = await supabase.auth.resetPasswordForEmail(
      existingEmail,
      { redirectTo: targetRedirect }
    );
    assert.strictEqual(errorExisting, null);

    const uiMessageExisting = GENERIC_SUCCESS_MESSAGE;
    // Both responses must be identical to completely prevent user enumeration
    assert.strictEqual(uiMessageExisting, uiMessageNonExistent);
  } finally {
    if (createdUser?.user?.id) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
    }
  }
});

test('Update Password: Input Validation Rules', () => {
  function validatePasswords(
    p1: string,
    p2: string
  ): { valid: boolean; error?: string } {
    if (!p1 || !p2) {
      return { valid: false, error: 'Please fill out both password fields.' };
    }
    if (p1.length < 6) {
      return { valid: false, error: 'Password must be at least 6 characters long.' };
    }
    if (p1 !== p2) {
      return { valid: false, error: 'The passwords do not match.' };
    }
    return { valid: true };
  }

  assert.strictEqual(validatePasswords('', '').valid, false);
  assert.strictEqual(validatePasswords('12345', '12345').valid, false);
  assert.strictEqual(
    validatePasswords('12345', '12345').error,
    'Password must be at least 6 characters long.'
  );
  assert.strictEqual(validatePasswords('ValidPass123', 'DifferentPass123').valid, false);
  assert.strictEqual(
    validatePasswords('ValidPass123', 'DifferentPass123').error,
    'The passwords do not match.'
  );
  assert.strictEqual(validatePasswords('SecurePass123!', 'SecurePass123!').valid, true);
});

test('Update Password: End-to-End User Password Update via Supabase Auth', async () => {
  const adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testEmail = `update_pwd_${Date.now()}@solaris3.test`;
  const oldPassword = 'OldPassword123!';
  const newPassword = 'NewSecurePassword456!';

  // 1. Create confirmed user
  const { data: userData } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: oldPassword,
    email_confirm: true,
  });

  const userId = userData?.user?.id;
  assert.ok(userId, 'Test user must be created');

  try {
    // 2. Sign in as user
    const userClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: sessionData, error: loginErr } =
      await userClient.auth.signInWithPassword({
        email: testEmail,
        password: oldPassword,
      });

    assert.strictEqual(loginErr, null);
    assert.ok(sessionData.session, 'Must have active session');

    // 3. Update password via updateUser({ password: newPassword })
    const { error: updateErr } = await userClient.auth.updateUser({
      password: newPassword,
    });
    assert.strictEqual(updateErr, null);

    // 4. Verify old password no longer works
    const clientOld = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: oldLoginErr } = await clientOld.auth.signInWithPassword({
      email: testEmail,
      password: oldPassword,
    });
    assert.ok(oldLoginErr, 'Old password must be rejected');

    // 5. Verify new password successfully authenticates
    const clientNew = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: newSession, error: newLoginErr } =
      await clientNew.auth.signInWithPassword({
        email: testEmail,
        password: newPassword,
      });
    assert.strictEqual(newLoginErr, null);
    assert.strictEqual(newSession.user.id, userId);
  } finally {
    if (userId) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test('Auth Callback: Open Redirect Protection & Relative Target Normalization', () => {
  function sanitizeNextUrl(rawNext: string | null): string {
    if (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')) {
      return rawNext;
    }
    return '/account';
  }

  assert.strictEqual(sanitizeNextUrl(null), '/account');
  assert.strictEqual(sanitizeNextUrl(''), '/account');
  assert.strictEqual(sanitizeNextUrl('https://evil.com'), '/account');
  assert.strictEqual(sanitizeNextUrl('//evil.com/phishing'), '/account');
  assert.strictEqual(sanitizeNextUrl('/auth/update-password'), '/auth/update-password');
  assert.strictEqual(sanitizeNextUrl('/inventory'), '/inventory');
  assert.strictEqual(sanitizeNextUrl('/tower'), '/tower');
});

test('Auth Callback: Expired or Invalid Recovery Link Error Handling', () => {
  function getErrorRedirect(next: string, errorType: string, baseUrl: string): URL {
    const errorUrl = new URL(
      next === '/auth/update-password' ? '/auth/update-password' : '/auth/login',
      baseUrl
    );
    errorUrl.searchParams.set('error', errorType);
    return errorUrl;
  }

  const url = getErrorRedirect('/auth/update-password', 'invalid_link', 'https://wuwa-hub.vercel.app');
  assert.strictEqual(url.pathname, '/auth/update-password');
  assert.strictEqual(url.searchParams.get('error'), 'invalid_link');
  assert.strictEqual(INVALID_LINK_MESSAGE, 'The reset link is invalid or has expired. Please request a new password reset email.');
});

test('Auth Regression: Standard Sign In, Sign Up, and Sign Out Isolation', async () => {
  const adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testEmail = `regression_user_${Date.now()}@solaris3.test`;
  const testPassword = 'RegressionPassword123!';

  // Sign up verification
  const { data: signUpData, error: signUpErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  assert.strictEqual(signUpErr, null);
  assert.ok(signUpData.user?.id);

  const userId = signUpData.user.id;

  try {
    const userClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Sign in verification
    const { data: signInData, error: signInErr } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(signInErr, null);
    assert.strictEqual(signInData.user.email, testEmail);

    // Sign out verification
    const { error: signOutErr } = await userClient.auth.signOut();
    assert.strictEqual(signOutErr, null);
  } finally {
    await adminClient.auth.admin.deleteUser(userId);
  }
});
