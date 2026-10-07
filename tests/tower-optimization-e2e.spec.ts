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
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let canonicalResonators: Array<{ id: string; name: string }> = [];

  test.beforeAll(async () => {
    // Fetch canonical resonators
    const { data: resonators } = await supabaseAdmin
      .from('resonators')
      .select('id, name')
      .order('name', { ascending: true })
      .limit(20);

    if (resonators) {
      canonicalResonators = resonators;
    }

    // Seed test user with at least 12 resonators in Supabase for standard tests
    if (canonicalResonators.length >= 12) {
      await supabaseAdmin
        .from('user_resonators')
        .delete()
        .eq('user_id', TEST_USER_ID);

      const rows = canonicalResonators.slice(0, 12).map((r) => ({
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

  test('Security: Unauthenticated access redirects to login preserving destination', async ({
    page,
  }) => {
    // 1. Visit /inventory without session
    await page.goto('/inventory');
    await page.waitForURL((url) => url.pathname === '/auth/login' && url.searchParams.get('redirect') === '/inventory');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // 2. Visit /tower without session
    await page.goto('/tower');
    await page.waitForURL((url) => url.pathname === '/auth/login' && url.searchParams.get('redirect') === '/tower');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('Full 17-Step User Flow: Login -> Inventory Search & Toggle -> Refresh Persistence -> Tower Run -> Results -> Logout -> Relogin', async ({
    page,
  }) => {
    test.setTimeout(90000);

    // 1. Login
    await page.goto('/auth/login?redirect=/inventory');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // 2. Open Inventory directly via preserved redirect
    await page.waitForURL((url) => url.pathname === '/inventory', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Resonator Roster' })).toBeVisible();

    // 3. Search Resonator
    const targetChar = canonicalResonators[0]?.name || 'Aero Rover';
    const searchInput = page.getByLabel('Search resonators by name');
    await searchInput.fill(targetChar);
    await expect(page.getByText(targetChar).first()).toBeVisible();

    // 4. Mark / unmark ownership toggle
    const targetCardButton = page.getByRole('button', { name: new RegExp(targetChar, 'i') }).first();
    const initialText = await targetCardButton.innerText();
    const expectedToggledText = initialText === 'Remove' ? 'Mark Owned' : 'Remove';

    await Promise.all([
      page.waitForResponse((res) => res.request().method() === 'POST' && res.status() === 200, { timeout: 15000 }),
      targetCardButton.click(),
    ]);

    await expect(targetCardButton).toHaveText(expectedToggledText, { timeout: 10000 });

    // 5. Refresh inventory
    await page.reload();

    // 6. Verify ownership remained persisted after refresh
    await searchInput.fill(targetChar);
    const postRefreshButton = page.getByRole('button', { name: new RegExp(targetChar, 'i') }).first();
    await expect(postRefreshButton).toHaveText(expectedToggledText);

    // Restore ownership to owned for full 12-stage feasibility
    if (initialText === 'Remove') {
      // It was removed, click again to re-add
      await Promise.all([
        page.waitForResponse((res) => res.request().method() === 'POST' && res.status() === 200, { timeout: 15000 }),
        postRefreshButton.click(),
      ]);
      await expect(postRefreshButton).toHaveText('Remove', { timeout: 10000 });
    }

    // Clear search
    await searchInput.fill('');

    // 7. Open Tower
    const towerLink = page.getByRole('link', { name: /Tower Optimizer/i });
    await expect(towerLink).toBeVisible();
    await towerLink.click();
    await page.waitForURL((url) => url.pathname === '/tower', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Tower of Adversity Optimizer' })).toBeVisible();

    // Verify resolved cycle metadata is displayed
    await expect(page.getByText('Hazard Zone (Season 40)').first()).toBeVisible();
    await expect(page.getByText('Patch 3.7').first()).toBeVisible();
    await expect(page.getByText('Start Date')).toBeVisible();
    await expect(page.getByText('End Date')).toBeVisible();

    // 8. Run full-cycle optimization (BEST_EFFORT mode)
    const runButton = page.getByRole('button', { name: /Run Optimization/i });
    await expect(runButton).toBeEnabled();
    await runButton.click();

    // 9. Verify 12 stage results render
    await expect(
      page.getByRole('heading', { name: 'ToA Optimization Results' })
    ).toBeVisible({ timeout: 45000 });

    await expect(page.getByText('Assigned Stages')).toBeVisible();
    await expect(page.getByText('12 / 12')).toBeVisible();

    // Verify Tower Section Headings
    await expect(page.getByText('Resonant Tower').first()).toBeVisible();
    await expect(page.getByText('Hazard Tower').first()).toBeVisible();
    await expect(page.getByText('Echoing Tower').first()).toBeVisible();

    // 10. Verify total score is present
    await expect(page.getByText('Score', { exact: true })).toBeVisible();

    // 11. Verify optimality state is present
    await expect(
      page.getByText(/Primary objective proven|Fully proven optimal|Best solution found/i).first()
    ).toBeVisible();

    // 12. Verify Vigor table is present
    await expect(page.getByText('Vigor Allocation Summary')).toBeVisible();
    await expect(page.getByText('Consumed / Capacity')).toBeVisible();

    // 13. Open "Why this team?"
    const inspectButton = page.getByRole('button', { name: /Inspect Why|Why this team/i }).first();
    await expect(inspectButton).toBeVisible();
    await inspectButton.click();

    // 14. Verify explanation content
    await expect(page.getByText('Primary Selection Drivers').first()).toBeVisible();
    await expect(page.getByText('Top Score Dimensions').first()).toBeVisible();
    await expect(page.getByText(/Stage Vigor Impact/i).first()).toBeVisible();

    // 15. Navigate to /account and Logout
    await page.getByRole('link', { name: 'Account' }).click();
    await page.waitForURL((url) => url.pathname === '/account', { timeout: 15000 });
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // After sign-out, redirected to home ("/")
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'WuWa Optimizer' })).toBeVisible();

    // 16. Login again
    await page.goto('/auth/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/account', { timeout: 15000 });

    // 17. Verify inventory persistence after re-login
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Resonator Roster' })).toBeVisible();
    await expect(page.getByText('In Roster').first()).toBeVisible();
  });

  test('UX: Insufficient inventory (< 3 Resonators) renders actionable warning', async ({
    page,
  }) => {
    test.setTimeout(45000);

    // Set user roster to only 2 resonators
    await supabaseAdmin
      .from('user_resonators')
      .delete()
      .eq('user_id', TEST_USER_ID);

    if (canonicalResonators.length >= 2) {
      await supabaseAdmin.from('user_resonators').insert(
        canonicalResonators.slice(0, 2).map((r) => ({
          user_id: TEST_USER_ID,
          resonator_id: r.id,
          level: 90,
          waveband: 0,
        }))
      );
    }

    // Login and navigate to /tower
    await page.goto('/auth/login?redirect=/tower');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/tower', { timeout: 15000 });

    // Verify warning banner
    await expect(page.getByText('Insufficient Resonators in Roster')).toBeVisible();
    await expect(page.getByText(/You currently have only/i)).toBeVisible();

    // Verify Run button is disabled
    const runButton = page.getByRole('button', { name: /Run Optimization/i });
    await expect(runButton).toBeDisabled();

    // Restore standard 12-resonator roster for subsequent tests
    const rows = canonicalResonators.slice(0, 12).map((r) => ({
      user_id: TEST_USER_ID,
      resonator_id: r.id,
      level: 90,
      waveband: 0,
    }));
    await supabaseAdmin.from('user_resonators').insert(rows);
  });

  test('Responsive Design: Viewports audit on Desktop, Tablet, and Mobile', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Login first
    await page.goto('/auth/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/account', { timeout: 15000 });

    const viewports = [
      { name: 'Desktop', width: 1440, height: 900 },
      { name: 'Tablet', width: 1024, height: 768 },
      { name: 'Mobile', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Check /inventory
      await page.goto('/inventory');
      await expect(page.getByRole('heading', { name: 'Resonator Roster' })).toBeVisible();

      // Verify no horizontal overflow
      const inventoryOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(inventoryOverflow, `Inventory had horizontal overflow on ${vp.name}`).toBe(false);

      // Verify filters and search work
      const searchInput = page.getByLabel('Search resonators by name');
      await expect(searchInput).toBeVisible();

      // Check /tower
      await page.goto('/tower');
      await expect(page.getByRole('heading', { name: 'Tower of Adversity Optimizer' })).toBeVisible();

      const towerOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(towerOverflow, `Tower had horizontal overflow on ${vp.name}`).toBe(false);

      // Verify scope selector buttons are visible
      await expect(page.getByRole('radio', { name: 'Full Cycle' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Run Optimization/i })).toBeVisible();
    }
  });
});
