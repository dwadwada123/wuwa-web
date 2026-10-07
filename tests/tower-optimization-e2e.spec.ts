import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nzaytawkoyscjovgtstt.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YXl0YXdrb3lzY2pvdmd0c3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwNjA2OCwiZXhwIjoyMTA2NzgyMDY4fQ.8nzY2E67m1-alE86cFsrOhMURNsRinK4eeBPjfs762c';

const TEST_EMAIL = 'tower_e2e_tester@gmail.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_USER_ID = '4e86f0f6-2dba-4618-99ec-5be5cfd77289';

test.describe('Tower of Adversity End-to-End Optimization Flow', () => {
  test.beforeAll(async () => {
    // Seed test user with at least 12 resonators in Supabase to ensure full 12-stage feasibility
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch canonical resonators
    const { data: resonators } = await supabaseAdmin
      .from('resonators')
      .select('id')
      .limit(15);

    if (resonators && resonators.length >= 12) {
      // Clear existing owned resonators for clean test state
      await supabaseAdmin
        .from('user_resonators')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Insert 12 owned resonators
      const rows = resonators.slice(0, 12).map((r) => ({
        user_id: TEST_USER_ID,
        resonator_id: r.id,
        level: 90,
        waveband: 0,
        normal_attack_level: 6,
        resonance_skill_level: 6,
        forte_circuit_level: 6,
        resonance_liberation_level: 6,
        intro_skill_level: 6,
      }));

      await supabaseAdmin.from('user_resonators').insert(rows);
    }
  });

  test('Full User Flow: Login -> /inventory -> /tower -> Run Full-Cycle Optimization -> Inspect Results', async ({
    page,
  }) => {
    test.setTimeout(90000);
    // 1. Login
    await page.goto('/auth/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // After sign-in, account page opens
    await page.waitForURL('**/account', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();

    // 2. Open /inventory
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Resonator Roster' })).toBeVisible();

    // 3. Verify owned/unowned state in inventory
    await expect(page.getByText('In Roster').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Tower Optimizer/i })).toBeVisible();

    // 4. Open optimizer via navigation link
    await page.getByRole('link', { name: /Tower Optimizer/i }).click();
    await page.waitForURL('**/tower', { timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: 'Tower of Adversity Optimizer' })
    ).toBeVisible();

    // Verify resolved cycle metadata is displayed (Requirement 2)
    await expect(page.getByText('Hazard Zone (Season 40)').first()).toBeVisible();
    await expect(page.getByText('Patch 3.7').first()).toBeVisible();
    await expect(page.getByText('Start Date')).toBeVisible();
    await expect(page.getByText('End Date')).toBeVisible();

    // Verify Scope Selector
    await expect(page.getByRole('button', { name: 'Full Cycle' })).toBeVisible();

    // 5. Run full-cycle optimization (BEST_EFFORT mode)
    const runButton = page.getByRole('button', { name: /Run Optimization/i });
    await expect(runButton).toBeEnabled();
    await runButton.click();

    // 6. Verify result page renders (wait for solve and explanation)
    await expect(
      page.getByRole('heading', { name: 'ToA Optimization Results' })
    ).toBeVisible({ timeout: 45000 });

    // 7. Verify 12 stages are shown
    await expect(page.getByText('Assigned Stages')).toBeVisible();
    await expect(page.getByText('12 / 12')).toBeVisible();

    // Verify Tower Section Headings
    await expect(page.getByText('Resonant Tower').first()).toBeVisible();
    await expect(page.getByText('Hazard Tower').first()).toBeVisible();
    await expect(page.getByText('Echoing Tower').first()).toBeVisible();

    // 8. Verify total score is present
    await expect(page.getByText('Score', { exact: true })).toBeVisible();

    // 9. Verify optimality state is present
    await expect(
      page.getByText(/Primary objective proven|Fully proven optimal|Best solution found/i).first()
    ).toBeVisible();

    // 10. Verify Vigor summary is present
    await expect(page.getByText('Vigor Allocation Summary')).toBeVisible();
    await expect(page.getByText('Consumed / Capacity')).toBeVisible();

    // 11. Verify at least one "Why this team?" explanation is rendered
    const inspectButton = page.getByRole('button', { name: /Inspect Why|Why this team/i }).first();
    await expect(inspectButton).toBeVisible();
    await inspectButton.click();

    // Verify explanation details appear
    await expect(page.getByText('Primary Selection Drivers').first()).toBeVisible();
    await expect(page.getByText('Top Score Dimensions').first()).toBeVisible();
    await expect(page.getByText(/Stage Vigor Impact/i).first()).toBeVisible();
  });
});
