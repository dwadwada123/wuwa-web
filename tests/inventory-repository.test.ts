import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

import { SupabaseUserInventoryRepository } from '../lib/data-access/repositories/user-inventory-repository.ts';

const LOCAL_SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabaseAdmin = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test('User Inventory Repository - Add, Read, and Remove Resonators with Tenant Isolation', async () => {
  const repo = new SupabaseUserInventoryRepository(supabaseAdmin);

  // Create real test users in auth.users
  const userAlphaEmail = `alpha_${Date.now()}@example.com`;
  const userBetaEmail = `beta_${Date.now()}@example.com`;

  const { data: userAlphaData } = await supabaseAdmin.auth.admin.createUser({
    email: userAlphaEmail,
    password: 'password123',
    email_confirm: true,
  });
  const { data: userBetaData } = await supabaseAdmin.auth.admin.createUser({
    email: userBetaEmail,
    password: 'password123',
    email_confirm: true,
  });

  const testUserId = userAlphaData?.user?.id!;
  const testUserBeta = userBetaData?.user?.id!;

  // Find a canonical resonator from database
  const { data: canonRes, error: resErr } = await supabaseAdmin
    .from('resonators')
    .select('id')
    .limit(2);

  assert.ok(!resErr, 'Must query canonical resonators');
  assert.ok(canonRes && canonRes.length >= 2, 'Need at least 2 canonical resonators');

  const resId1 = canonRes[0].id;

  try {
    // 1. Add owned resonator for User 1
    const addedRes = await repo.addOwnedResonator(testUserId, resId1, {
      level: 80,
      waveband: 1,
      normalAttackLevel: 6,
    });
    assert.equal(addedRes.userId, testUserId);
    assert.equal(addedRes.resonatorId, resId1);
    assert.equal(addedRes.level, 80);
    assert.equal(addedRes.waveband, 1);

    // 2. Read owned roster for User 1
    const roster1 = await repo.getOwnedRoster(testUserId);
    assert.equal(roster1.userId, testUserId);
    assert.ok(roster1.resonatorIds.includes(resId1));
    assert.ok(roster1.resonators);
    const foundRes = roster1.resonators.find((r) => r.resonatorId === resId1);
    assert.ok(foundRes);
    assert.equal(foundRes.level, 80);

    // 3. Verify Tenant Isolation: User Beta roster does not contain User 1's resonator
    const rosterBeta = await repo.getOwnedRoster(testUserBeta);
    assert.ok(!rosterBeta.resonatorIds.includes(resId1));

    // 4. Update / Upsert investment
    const updatedRes = await repo.addOwnedResonator(testUserId, resId1, {
      level: 90,
      waveband: 2,
    });
    assert.equal(updatedRes.level, 90);
    assert.equal(updatedRes.waveband, 2);

    // 5. Remove resonator
    await repo.removeOwnedResonator(testUserId, resId1);
    const rosterAfterDelete = await repo.getOwnedRoster(testUserId);
    assert.ok(!rosterAfterDelete.resonatorIds.includes(resId1));
  } finally {
    // Cleanup
    await supabaseAdmin.from('user_resonators').delete().eq('user_id', testUserId);
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
    await supabaseAdmin.auth.admin.deleteUser(testUserBeta);
  }
});

test('User Inventory Repository - Weapon Instances and Loadouts', async () => {
  const repo = new SupabaseUserInventoryRepository(supabaseAdmin);
  const userGammaEmail = `gamma_${Date.now()}@example.com`;

  const { data: userGammaData } = await supabaseAdmin.auth.admin.createUser({
    email: userGammaEmail,
    password: 'password123',
    email_confirm: true,
  });

  const testUserId = userGammaData?.user?.id!;

  // Fetch canonical resonator & weapon
  const [resData, wepData] = await Promise.all([
    supabaseAdmin.from('resonators').select('id').limit(1).single(),
    supabaseAdmin.from('weapons').select('id').limit(1).single(),
  ]);

  assert.ok(resData.data, 'Need canonical resonator');
  assert.ok(wepData.data, 'Need canonical weapon');

  const resonatorId = resData.data.id;
  const weaponId = wepData.data.id;

  try {
    // 1. Add owned resonator
    const userRes = await repo.addOwnedResonator(testUserId, resonatorId);

    // 2. Add two instances of the same weapon (supporting duplicate copies)
    const wepInst1 = await repo.addOwnedWeapon(testUserId, weaponId, { level: 90, refinement: 1 });
    const wepInst2 = await repo.addOwnedWeapon(testUserId, weaponId, { level: 80, refinement: 5 });

    assert.equal(wepInst1.weaponId, weaponId);
    assert.equal(wepInst2.weaponId, weaponId);
    assert.notEqual(wepInst1.id, wepInst2.id, 'Weapon instances must have distinct UUIDs');

    // 3. Equip instance 1 in resonator loadout
    const loadout = await repo.saveResonatorLoadout(testUserId, {
      userResonatorId: userRes.id,
      weaponInstanceId: wepInst1.id,
    });
    assert.equal(loadout.userResonatorId, userRes.id);
    assert.equal(loadout.weaponInstanceId, wepInst1.id);

    // 4. Verify getOwnedRoster returns all items
    const roster = await repo.getOwnedRoster(testUserId);
    assert.ok(roster.weapons);
    assert.ok(roster.loadouts);
    assert.equal(roster.weapons.length, 2);
    assert.equal(roster.loadouts.length, 1);
    assert.equal(roster.loadouts[0].weaponInstanceId, wepInst1.id);

    // 5. Delete loadout
    await repo.deleteResonatorLoadout(testUserId, userRes.id);
    const rosterNoLoadout = await repo.getOwnedRoster(testUserId);
    assert.ok(rosterNoLoadout.loadouts);
    assert.equal(rosterNoLoadout.loadouts.length, 0);

    // 6. Delete weapon instance
    await repo.removeOwnedWeapon(testUserId, wepInst1.id);
    const rosterAfterWepDelete = await repo.getOwnedRoster(testUserId);
    assert.ok(rosterAfterWepDelete.weapons);
    assert.equal(rosterAfterWepDelete.weapons.length, 1);
    assert.equal(rosterAfterWepDelete.weapons[0].id, wepInst2.id);
  } finally {
    // Cleanup
    await supabaseAdmin.from('user_weapons').delete().eq('user_id', testUserId);
    await supabaseAdmin.from('user_resonators').delete().eq('user_id', testUserId);
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
  }
});
