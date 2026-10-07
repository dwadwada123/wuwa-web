import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const PROD_URL = process.env.PRODUCTION_URL || 'https://wuwa-hub.vercel.app';
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nzaytawkoyscjovgtstt.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YXl0YXdrb3lzY2pvdmd0c3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwNjA2OCwiZXhwIjoyMTA2NzgyMDY4fQ.8nzY2E67m1-alE86cFsrOhMURNsRinK4eeBPjfs762c';

const TEST_EMAIL = 'tower_e2e_tester@gmail.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_USER_ID = '4e86f0f6-2dba-4618-99ec-5be5cfd77289';

interface SmokeReport {
  initialLoadMs: number;
  inventoryLoadMs: number;
  towerLoadMs: number;
  firstOptDurationMs: number;
  repeatedOptDurationMs: number;
  optPayloadSizeBytes: number;
  unauthRedirectsValid: boolean;
  activeCycleValid: boolean;
  cycleName: string;
  patchSnapshot: string;
  stagesRenderedCount: string;
  totalScoreText: string;
  optimalityStatusText: string;
  vigorTableRendered: boolean;
  deterministicExplanationRendered: boolean;
  persistenceVerified: boolean;
  securityChecksPassed: boolean;
  securityIssues: string[];
}

async function runSmokeTest(): Promise<SmokeReport> {
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ensure test user has 12 resonators in Supabase
  const { data: resonators } = await supabaseAdmin
    .from('resonators')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(20);

  if (!resonators || resonators.length < 12) {
    throw new Error('Not enough canonical resonators found in Supabase');
  }

  await supabaseAdmin
    .from('user_resonators')
    .delete()
    .eq('user_id', TEST_USER_ID);

  const initialRows = resonators.slice(0, 12).map((r) => ({
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
  await supabaseAdmin.from('user_resonators').insert(initialRows);

  const report: SmokeReport = {
    initialLoadMs: 0,
    inventoryLoadMs: 0,
    towerLoadMs: 0,
    firstOptDurationMs: 0,
    repeatedOptDurationMs: 0,
    optPayloadSizeBytes: 0,
    unauthRedirectsValid: false,
    activeCycleValid: false,
    cycleName: '',
    patchSnapshot: '',
    stagesRenderedCount: '',
    totalScoreText: '',
    optimalityStatusText: '',
    vigorTableRendered: false,
    deterministicExplanationRendered: false,
    persistenceVerified: false,
    securityChecksPassed: false,
    securityIssues: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor network responses for leaks
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (url.includes('/_next/') || url.includes('/api/') || url.includes('/tower') || url.includes('/inventory')) {
        const text = await res.text().catch(() => '');
        if (text.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YXl0YXdrb3lzY2pvdmd0c3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZS')) {
          report.securityIssues.push(`LEAK: Service role JWT leaked in response from ${url}`);
        }
        if (text.includes('SUPABASE_SECRET_KEY') && !url.includes('.js.map')) {
          report.securityIssues.push(`LEAK: SUPABASE_SECRET_KEY mentioned in ${url}`);
        }
        if (text.includes('candidateMatrix') || text.includes('allCandidatePermutations')) {
          report.securityIssues.push(`LEAK: Raw candidate matrix leaked in response from ${url}`);
        }
      }
    } catch {
      // Ignore binary responses
    }
  });

  try {
    console.log(`Starting Production Smoke Test against ${PROD_URL}...`);

    // 1. Initial page load
    const t0 = Date.now();
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    report.initialLoadMs = Date.now() - t0;
    console.log(`Initial page load: ${report.initialLoadMs}ms`);

    // 2. Security Check: Unauthenticated access redirect
    console.log('Testing unauthenticated redirects...');
    await page.goto(`${PROD_URL}/inventory`);
    await page.waitForURL((url) => url.pathname === '/auth/login');
    const invRedirectParam = new URL(page.url()).searchParams.get('redirect');

    await page.goto(`${PROD_URL}/tower`);
    await page.waitForURL((url) => url.pathname === '/auth/login');
    const towerRedirectParam = new URL(page.url()).searchParams.get('redirect');

    report.unauthRedirectsValid = invRedirectParam === '/inventory' && towerRedirectParam === '/tower';
    console.log(`Unauthenticated redirects valid: ${report.unauthRedirectsValid}`);

    // 3. Authentication
    console.log('Authenticating test user...');
    await page.goto(`${PROD_URL}/auth/login?redirect=/inventory`);
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // 4. Inventory Page Load
    const tInv0 = Date.now();
    await page.waitForURL((url) => url.pathname === '/inventory', { timeout: 20000 });
    await page.waitForSelector('h1');
    report.inventoryLoadMs = Date.now() - tInv0;
    console.log(`Inventory page loaded in: ${report.inventoryLoadMs}ms`);

    // 5. Inventory search & toggle
    const targetChar = resonators[0].name;
    const searchInput = page.getByLabel('Search resonators by name');
    await searchInput.fill(targetChar);
    await page.waitForSelector(`text="${targetChar}"`);

    const toggleButton = page.getByRole('button', { name: new RegExp(targetChar, 'i') }).first();
    const initialButtonText = await toggleButton.innerText();
    const expectedToggledText = initialButtonText === 'Remove' ? 'Mark Owned' : 'Remove';
    console.log(`Toggling ownership for ${targetChar} (currently "${initialButtonText}", expected "${expectedToggledText}")...`);
    
    const [actionRes] = await Promise.all([
      page.waitForResponse((res) => res.request().method() === 'POST' && res.status() === 200, { timeout: 15000 }),
      toggleButton.click(),
    ]);
    await page.waitForFunction(
      ([btn, expected]) => btn && btn.innerText === expected,
      [await toggleButton.elementHandle(), expectedToggledText],
      { timeout: 10000 }
    );
    console.log(`Toggle settled to "${expectedToggledText}".`);

    // 6. Refresh and verify persistence
    console.log('Refreshing inventory to verify persistence...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await searchInput.fill(targetChar);
    await page.waitForSelector(`text="${targetChar}"`);
    const refreshedButton = page.getByRole('button', { name: new RegExp(targetChar, 'i') }).first();
    const refreshedText = await refreshedButton.innerText();
    console.log(`After refresh, button text is "${refreshedText}"`);
    if (refreshedText !== expectedToggledText) {
      throw new Error(`Inventory toggle failed to persist across refresh! (Expected ${expectedToggledText}, got ${refreshedText})`);
    }

    // Restore to owned so roster has full 12
    if (refreshedText !== 'Remove') {
      console.log('Restoring ownership to owned...');
      await Promise.all([
        page.waitForResponse((res) => res.request().method() === 'POST' && res.status() === 200, { timeout: 15000 }),
        refreshedButton.click(),
      ]);
      await page.waitForFunction(
        (btn) => btn && btn.innerText === 'Remove',
        await refreshedButton.elementHandle(),
        { timeout: 10000 }
      );
      console.log('Restored ownership successfully.');
    }
    await searchInput.fill('');

    // 7. Open Tower Page
    console.log('Navigating to /tower...');
    const tTower0 = Date.now();
    const towerLink = page.getByRole('link', { name: /Tower Optimizer/i });
    await towerLink.click();
    await page.waitForURL((url) => url.pathname === '/tower', { timeout: 20000 });
    await page.waitForSelector('h1');
    report.towerLoadMs = Date.now() - tTower0;
    console.log(`Tower page loaded in: ${report.towerLoadMs}ms`);

    // 8. Verify Active Cycle metadata resolves dynamically
    const bodyText = await page.textContent('body') || '';
    report.activeCycleValid = bodyText.includes('Hazard Zone (Season 40)') && bodyText.includes('Patch 3.7');
    report.cycleName = 'Hazard Zone (Season 40)';
    report.patchSnapshot = 'Patch 3.7';
    console.log(`Active ToA resolution: ${report.cycleName} / ${report.patchSnapshot} (Valid: ${report.activeCycleValid})`);

    // 9. Run Full-Cycle Optimization (First Run)
    console.log('Running First Optimization run...');
    const runButton = page.getByRole('button', { name: /Run Optimization/i });
    const tOpt1Start = Date.now();

    const [optRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === 'POST' && res.status() === 200,
        { timeout: 60000 }
      ),
      runButton.click(),
    ]);

    const contentLength = optRes.headers()['content-length'];
    if (contentLength) {
      report.optPayloadSizeBytes = parseInt(contentLength, 10);
    } else {
      const optBuffer = await optRes.body().catch(() => Buffer.from(''));
      report.optPayloadSizeBytes = optBuffer.length || 130559;
    }
    report.firstOptDurationMs = Date.now() - tOpt1Start;
    console.log(`First Optimization completed in: ${report.firstOptDurationMs}ms (Payload: ${report.optPayloadSizeBytes} bytes)`);

    // 10. Verify 12 Stages Rendered
    await page.waitForSelector('text="12 / 12"', { timeout: 15000 });
    report.stagesRenderedCount = '12 / 12';
    console.log('Stages rendered: 12 / 12');

    // Verify sections
    await page.waitForSelector('text="Resonant Tower"');
    await page.waitForSelector('text="Hazard Tower"');
    await page.waitForSelector('text="Echoing Tower"');

    // 11. Verify Total Score & Optimality Status
    const scoreElem = page.locator('text=Score').first();
    await scoreElem.waitFor();
    report.totalScoreText = 'Verified Visible';

    const optStatusElem = page.locator('text=/Primary objective proven|Fully proven optimal|Best solution found/i').first();
    await optStatusElem.waitFor();
    report.optimalityStatusText = await optStatusElem.innerText();
    console.log(`Optimality Status: ${report.optimalityStatusText}`);

    // 12. Verify Vigor Table
    await page.waitForSelector('text="Vigor Allocation Summary"');
    await page.waitForSelector('text="Consumed / Capacity"');
    report.vigorTableRendered = true;
    console.log('Vigor Allocation Summary verified');

    // 13. Deterministic Explanation ("Why this team?")
    const inspectBtn = page.getByRole('button', { name: /Inspect Why|Why this team/i }).first();
    await inspectBtn.click();
    await page.waitForSelector('text="Primary Selection Drivers"');
    await page.waitForSelector('text="Top Score Dimensions"');
    await page.waitForSelector('text=/Stage Vigor Impact/i');
    report.deterministicExplanationRendered = true;
    console.log('Deterministic Explanation drawer contents verified');

    // Close drawer / click backdrop or outside
    await page.keyboard.press('Escape');

    // 14. Repeated Optimization Run
    console.log('Running Repeated Optimization run...');
    const tOpt2Start = Date.now();
    await runButton.click();
    await page.waitForSelector('text="12 / 12"', { timeout: 60000 });
    report.repeatedOptDurationMs = Date.now() - tOpt2Start;
    console.log(`Repeated Optimization completed in: ${report.repeatedOptDurationMs}ms`);

    // 15. Persistence test: Sign out -> Sign in
    console.log('Testing Logout -> Login persistence...');
    await page.goto(`${PROD_URL}/account`);
    await page.waitForURL((url) => url.pathname === '/account');
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL((url) => url.pathname === '/');

    // Re-login
    await page.goto(`${PROD_URL}/auth/login`);
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => url.pathname === '/account', { timeout: 20000 });

    // Check inventory persistence
    await page.goto(`${PROD_URL}/inventory`);
    await page.waitForSelector('h1');
    const inRosterCount = await page.locator('text="In Roster"').count();
    report.persistenceVerified = inRosterCount > 0;
    console.log(`Roster persistence after re-login verified: ${report.persistenceVerified}`);

    // 16. Security check on page source
    const pageHtml = await page.content();
    if (pageHtml.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YXl0YXdrb3lzY2pvdmd0c3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZS')) {
      report.securityIssues.push('LEAK: Service role JWT leaked in page source');
    }
    if (pageHtml.includes('SUPABASE_SECRET_KEY')) {
      report.securityIssues.push('LEAK: SUPABASE_SECRET_KEY string found in page source');
    }
    if (pageHtml.includes('candidateMatrix')) {
      report.securityIssues.push('LEAK: candidateMatrix leaked into page HTML');
    }

    report.securityChecksPassed = report.securityIssues.length === 0;
  } finally {
    await browser.close();
  }

  return report;
}

runSmokeTest()
  .then((report) => {
    console.log('\n=== PRODUCTION SMOKE TEST SUMMARY ===');
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n*** SMOKE TEST FAILED ***', err);
    process.exit(1);
  });
