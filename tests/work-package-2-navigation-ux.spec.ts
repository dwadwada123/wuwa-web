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

test.describe('Work Package 2 — Global Navigation, UX Polish & End-to-End Verification', () => {
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let canonicalResonators: Array<{ id: string; name: string; weapon_type: string }> = [];

  test.beforeAll(async () => {
    const { data: resonators } = await supabaseAdmin
      .from('resonators')
      .select('id, name, weapon_type')
      .order('name', { ascending: true })
      .limit(20);

    if (resonators) {
      canonicalResonators = resonators;
    }

    // Ensure test user has a clean baseline roster with at least 12 resonators
    if (canonicalResonators.length >= 12) {
      await supabaseAdmin
        .from('user_resonators')
        .delete()
        .eq('user_id', TEST_USER_ID);

      const rows = canonicalResonators.slice(0, 12).map((r) => ({
        user_id: TEST_USER_ID,
        resonator_id: r.id,
        level: 80,
        waveband: 0,
      }));

      await supabaseAdmin.from('user_resonators').insert(rows);
    }
  });

  // =========================================================================
  // SCENARIO 1: Authentication and Route Protection
  // =========================================================================
  test('Scenario 1: Authentication Guard & Public/Protected Navigation Isolation', async ({
    page,
  }) => {
    // 1. Unauthenticated direct access to /inventory redirects to login
    await page.goto('/inventory');
    await page.waitForURL((url) => url.pathname === '/auth/login' && url.searchParams.get('redirect') === '/inventory');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // 2. Unauthenticated direct access to /tower redirects to login
    await page.goto('/tower');
    await page.waitForURL((url) => url.pathname === '/auth/login' && url.searchParams.get('redirect') === '/tower');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // 3. Unauthenticated direct access to /account redirects to login
    await page.goto('/account');
    await page.waitForURL((url) => url.pathname === '/auth/login' && url.searchParams.get('redirect') === '/account');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // 4. Public auth pages must NOT display authenticated GlobalNav
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Roster & Inventory' })).toBeHidden();

    // Also check on /auth/sign-up and /auth/forgot-password
    await page.goto('/auth/sign-up');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();

    await page.goto('/auth/forgot-password');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  });

  // =========================================================================
  // SCENARIO 2: Global Navigation, Active States & Mobile Drawer
  // =========================================================================
  test('Scenario 2: Global Navigation, Active Route States & Keyboard / Mobile Interaction', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Login to establish session
    await page.goto('/auth/login?redirect=/inventory');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/inventory', { timeout: 15000 });

    // 1. Verify Global Header is visible with brand logo
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
    await expect(header.getByText('WuWa')).toBeVisible();
    await expect(header.getByText('Patch 3.7')).toBeVisible();

    // 2. Verify desktop navigation links exist
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();

    const inventoryLink = nav.getByRole('link', { name: 'Roster & Inventory' });
    const towerLink = nav.getByRole('link', { name: 'Tower Optimizer' });
    const accountLink = nav.getByRole('link', { name: 'Account' });

    await expect(inventoryLink).toBeVisible();
    await expect(towerLink).toBeVisible();
    await expect(accountLink).toBeVisible();

    // 3. Verify Active State on /inventory
    await expect(inventoryLink).toHaveAttribute('aria-current', 'page');
    await expect(towerLink).not.toHaveAttribute('aria-current', 'page');

    // 4. Navigate to /tower via Global Nav
    await towerLink.click();
    await page.waitForURL((url) => url.pathname === '/tower', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Tower of Adversity Optimizer' })).toBeVisible();
    await expect(towerLink).toHaveAttribute('aria-current', 'page');
    await expect(inventoryLink).not.toHaveAttribute('aria-current', 'page');

    // 5. Navigate to /account via Global Nav
    await accountLink.click();
    await page.waitForURL((url) => url.pathname === '/account', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Account Overview' })).toBeVisible();
    await expect(accountLink).toHaveAttribute('aria-current', 'page');

    // 6. Test Mobile Navigation & Collapsible Menu
    await page.setViewportSize({ width: 390, height: 844 });
    const menuToggle = page.getByRole('button', { name: /Toggle navigation menu/i });
    await expect(menuToggle).toBeVisible();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

    // Open mobile menu
    await menuToggle.click();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNav).toBeVisible();

    // Test mobile menu navigation link
    const mobileInventoryLink = mobileNav.getByRole('link', { name: /Roster & Inventory/i });
    await expect(mobileInventoryLink).toBeVisible();
    await mobileInventoryLink.click();
    await page.waitForURL((url) => url.pathname === '/inventory', { timeout: 15000 });

    // Menu should auto-close after navigation
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();

    // Reset viewport to desktop
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // =========================================================================
  // SCENARIO 3 & 4: Inventory Management & Character Investment Drawer
  // =========================================================================
  test('Scenario 3 & 4: Inventory Ownership, Investment Drawer, Equipment & Validation', async ({
    page,
  }) => {
    test.setTimeout(90000);

    // Login and navigate to /inventory
    await page.goto('/auth/login?redirect=/inventory');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/inventory', { timeout: 15000 });

    // 1. Verify Roster UI and Empty State Filter Handling
    const searchInput = page.getByLabel('Search resonators by name');
    await expect(searchInput).toBeVisible();

    // Search for non-existent resonator to test empty state
    await searchInput.fill('NonExistentCharacterXYZ');
    await expect(page.getByText('No resonators match your criteria')).toBeVisible();
    await page.getByRole('button', { name: 'Reset Filters' }).click();
    await expect(searchInput).toHaveValue('');

    // 2. Select first owned resonator and inspect card
    const targetChar = canonicalResonators[0]?.name || 'Aero Rover';
    await searchInput.fill(targetChar);

    // Card shows "In Roster" badge and "Edit Build" button
    await expect(page.getByText('In Roster').first()).toBeVisible();
    const editBuildButton = page.getByRole('button', { name: new RegExp(`Edit build for ${targetChar}`, 'i') });
    await expect(editBuildButton).toBeVisible();

    // 3. Open Character Investment Drawer
    await editBuildButton.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', { name: targetChar })).toBeVisible();

    // 4. Verify Drawer Controls
    const levelInput = drawer.getByLabel(/Character Level/i);
    await expect(levelInput).toBeVisible();

    // Configure Level to 90 using preset chip
    const lv90Chip = drawer.getByRole('button', { name: 'Lv.90', exact: true });
    await lv90Chip.click();
    await expect(levelInput).toHaveValue('90');

    // Configure Waveband / Sequence to S2
    const s2Chip = drawer.getByRole('button', { name: 'S2', exact: true });
    await s2Chip.click();

    // Verify Weapon Selection is populated and compatible
    const weaponSelect = drawer.getByLabel(/Select Compatible Weapon|Weapon/i);
    await expect(weaponSelect).toBeVisible();

    // Select a compatible weapon if available
    const weaponOptions = await weaponSelect.locator('option').allInnerTexts();
    expect(weaponOptions.length).toBeGreaterThan(1); // Has unequipped + weapons
    if (weaponOptions.length > 1) {
      await weaponSelect.selectOption({ index: 1 });
    }

    // Configure Weapon Level and Refinement
    const wepLevelInput = drawer.getByLabel(/Weapon Level/i);
    if (await wepLevelInput.isVisible()) {
      await wepLevelInput.fill('90');
      const r2Chip = drawer.getByRole('button', { name: 'R2', exact: true });
      if (await r2Chip.isVisible()) {
        await r2Chip.click();
      }
    }

    // Configure Sonata Set
    const sonataSelect = drawer.getByLabel(/Select Active Sonata Effect|Sonata/i);
    await expect(sonataSelect).toBeVisible();
    const sonataOptions = await sonataSelect.locator('option').allInnerTexts();
    expect(sonataOptions.length).toBeGreaterThan(1);
    if (sonataOptions.length > 1) {
      await sonataSelect.selectOption({ index: 1 });
    }

    // 5. Test Client-Side Bounds Validation
    await levelInput.fill('999'); // Invalid level
    await expect(drawer.getByText(/Level must be an integer between 1 and 90/i)).toBeVisible();
    const saveButton = drawer.getByRole('button', { name: 'Save Build' });
    await expect(saveButton).toBeDisabled();

    // Fix level back to 90
    await levelInput.fill('90');
    await expect(saveButton).toBeEnabled();

    // 6. Save Valid Investment
    await Promise.all([
      page.waitForResponse((res) => res.request().method() === 'POST' && res.status() === 200),
      saveButton.click(),
    ]);

    // Drawer closes upon successful save
    await expect(drawer).toBeHidden();

    // 7. Verify Card reflects updated persisted investment values
    await expect(page.getByText(/Lv\.90 • S2/).first()).toBeVisible();

    // 8. Reload page to verify database persistence round-trip
    await page.reload();
    await searchInput.fill(targetChar);
    await expect(page.getByText(/Lv\.90 • S2/).first()).toBeVisible();

    // 9. Verify Drawer Keyboard Accessibility (Escape key closes drawer)
    await editBuildButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  // =========================================================================
  // SCENARIO 5: Tower Recommendations End-to-End Execution
  // =========================================================================
  test('Scenario 5: Tower Recommendation Flow & Contract 7.25.1 Verification', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Login and navigate to /tower
    await page.goto('/auth/login?redirect=/tower');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/tower', { timeout: 15000 });

    // 1. Verify Page Metadata & Deterministic Badge
    await expect(page.getByRole('heading', { name: 'Tower of Adversity Optimizer' })).toBeVisible();
    await expect(page.getByText('Hazard Zone (Season 40)').first()).toBeVisible();
    await expect(page.getByText('Deterministic Engine').first()).toBeVisible();

    // 2. Run Recommendation Execution
    const runButton = page.getByRole('button', { name: /Run Optimization/i });
    await expect(runButton).toBeEnabled();
    await runButton.click();

    // 3. Verify Recommendation Results render cleanly
    await expect(
      page.getByRole('heading', { name: /ToA (Optimization|Recommendation) Results/i })
    ).toBeVisible({ timeout: 45000 });

    // Verify Scope and Metrics
    await expect(page.getByText(/Assigned Stages|Stage Coverage/i).first()).toBeVisible();
    await expect(page.getByText(/\d+ \/ 12/).first()).toBeVisible();

    // Verify Contract 7.25.1 Status Badge
    await expect(
      page.getByText(/Optimal Recommendation|Feasible Recommendation|Partial Recommendation|No Feasible Allocation/i).first()
    ).toBeVisible();

    // Verify Vigor Allocation Table
    await expect(page.getByText('Vigor Allocation Summary')).toBeVisible();
    await expect(page.getByText('Consumed / Capacity')).toBeVisible();

    // Verify Tower Stages render with teams
    await expect(page.getByText('Resonant Tower').first()).toBeVisible();
    await expect(page.getByText('Hazard Tower').first()).toBeVisible();
    await expect(page.getByText('Echoing Tower').first()).toBeVisible();
  });

  // =========================================================================
  // SCENARIO 6: Browser Stability & Responsive Layout Audit
  // =========================================================================
  test('Scenario 6: Browser Stability, Zero Uncaught Exceptions & Viewport Audit', async ({
    page,
  }) => {
    test.setTimeout(60000);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/account', { timeout: 15000 });

    const viewports = [
      { name: 'Desktop Large', width: 1440, height: 900 },
      { name: 'Tablet', width: 1024, height: 768 },
      { name: 'Mobile', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Audit /inventory
      await page.goto('/inventory');
      await expect(page.getByRole('heading', { name: 'Resonator Roster' })).toBeVisible();
      const invOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(invOverflow, `Horizontal overflow detected on /inventory for ${vp.name}`).toBe(false);

      // Audit /tower
      await page.goto('/tower');
      await expect(page.getByRole('heading', { name: 'Tower of Adversity Optimizer' })).toBeVisible();
      const towerOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(towerOverflow, `Horizontal overflow detected on /tower for ${vp.name}`).toBe(false);

      // Audit /account
      await page.goto('/account');
      await expect(page.getByRole('heading', { name: 'Account Overview' })).toBeVisible();
      const accountOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(accountOverflow, `Horizontal overflow detected on /account for ${vp.name}`).toBe(false);
    }

    // Filter out expected network or benign hydration noise
    const severeErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('Failed to load resource')
    );
    expect(severeErrors.length, `Severe console errors encountered: ${severeErrors.join('; ')}`).toBe(0);
  });
});
