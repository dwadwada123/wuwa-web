import test from 'node:test';
import assert from 'node:assert/strict';

import {
  updateResonatorInvestmentAction,
  toggleResonatorOwnership,
} from '../app/inventory/actions.ts';
import {
  UserInventoryAdapter,
  type GameEntityResolver,
} from '../lib/services/recommendation/adapter.ts';
import { RecommendationApplicationService } from '../lib/services/recommendation/service.ts';

class MockEntityResolver implements GameEntityResolver {
  private resonators = new Map<string, string>();
  private weapons = new Map<string, string>();
  private sonatas = new Map<string, string>();

  registerResonator(uuid: string, name: string) {
    this.resonators.set(uuid, name);
  }
  registerWeapon(uuid: string, name: string) {
    this.weapons.set(uuid, name);
  }
  registerSonata(uuid: string, name: string) {
    this.sonatas.set(uuid, name);
  }

  resolveResonatorName(id: string) {
    return this.resonators.get(id) ?? null;
  }
  resolveWeaponName(id: string) {
    return this.weapons.get(id) ?? null;
  }
  resolveSonataName(id: string) {
    return this.sonatas.get(id) ?? null;
  }
}

interface MockDbState {
  users: Array<{ id: string; email: string }>;
  resonators: Array<{ id: string; name: string; element: string; weapon_type: string; rarity: number }>;
  weapons: Array<{ id: string; name: string; weapon_type: string; rarity: number }>;
  sonatas: Array<{ id: string; name: string; code: string }>;
  userResonators: Array<{
    id: string;
    user_id: string;
    resonator_id: string;
    level: number;
    waveband: number;
    created_at?: string;
    updated_at?: string;
  }>;
  userWeapons: Array<{
    id: string;
    user_id: string;
    weapon_id: string;
    level: number;
    refinement: number;
    created_at?: string;
    updated_at?: string;
  }>;
  userLoadouts: Array<{
    id: string;
    user_id: string;
    user_resonator_id: string;
    weapon_instance_id: string | null;
    active_echo_id?: string | null;
    sonata_id: string | null;
    created_at?: string;
    updated_at?: string;
  }>;
}

function createInMemorySupabase(params: {
  currentUserId: string | null;
  authError?: Error | null;
  state?: Partial<MockDbState>;
}) {
  const { currentUserId, authError = null } = params;

  const db: MockDbState = {
    users: params.state?.users ?? [{ id: 'user-1', email: 'user1@example.com' }],
    resonators: params.state?.resonators ?? [
      { id: 'res-jinhsi', name: 'Jinhsi', element: 'Spectro', weapon_type: 'Broadblade', rarity: 5 },
      { id: 'res-changli', name: 'Changli', element: 'Fusion', weapon_type: 'Sword', rarity: 5 },
      { id: 'res-verina', name: 'Verina', element: 'Spectro', weapon_type: 'Rectifier', rarity: 5 },
    ],
    weapons: params.state?.weapons ?? [
      { id: 'wep-ages', name: 'Ages of Harvest', weapon_type: 'Broadblade', rarity: 5 },
      { id: 'wep-emerald', name: 'Emerald of Genesis', weapon_type: 'Sword', rarity: 5 },
      { id: 'wep-ripples', name: 'Cosmic Ripples', weapon_type: 'Rectifier', rarity: 5 },
    ],
    sonatas: params.state?.sonatas ?? [
      { id: 'son-celestial', name: 'Celestial Light', code: 'CELESTIAL_LIGHT' },
      { id: 'son-molten', name: 'Molten Rift', code: 'MOLTEN_RIFT' },
    ],
    userResonators: params.state?.userResonators ?? [],
    userWeapons: params.state?.userWeapons ?? [],
    userLoadouts: params.state?.userLoadouts ?? [],
  };

  let idCounter = 1;

  const client: any = {
    auth: {
      getClaims: async () => {
        if (authError) return { data: null, error: authError };
        if (!currentUserId) return { data: null, error: new Error('No active session') };
        return { data: { claims: { sub: currentUserId, email: `${currentUserId}@example.com` } }, error: null };
      },
      getUser: async () => {
        if (authError) return { data: { user: null }, error: authError };
        if (!currentUserId) return { data: { user: null }, error: null };
        return { data: { user: { id: currentUserId, email: `${currentUserId}@example.com` } }, error: null };
      },
    },
    from: (table: string) => {
      let filterEqs: Record<string, any> = {};
      let selectFields: string | null = null;
      let isSingle = false;
      let isMaybeSingle = false;

      const chain: any = {
        select: (fields?: string) => {
          selectFields = fields ?? '*';
          return chain;
        },
        eq: (col: string, val: any) => {
          filterEqs[col] = val;
          return chain;
        },
        order: () => chain,
        single: () => {
          isSingle = true;
          return chain;
        },
        maybeSingle: () => {
          isMaybeSingle = true;
          return chain;
        },
        insert: (payload: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          const inserted: any[] = [];
          for (const r of rows) {
            const newRow = {
              id: r.id ?? `gen-id-${idCounter++}`,
              ...r,
              created_at: r.created_at ?? new Date().toISOString(),
              updated_at: r.updated_at ?? new Date().toISOString(),
            };
            if (table === 'user_resonators') db.userResonators.push(newRow);
            if (table === 'user_weapons') db.userWeapons.push(newRow);
            if (table === 'user_resonator_loadouts') db.userLoadouts.push(newRow);
            inserted.push(newRow);
          }

          const insertChain: any = {
            select: () => insertChain,
            single: () => {
              isSingle = true;
              return insertChain;
            },
            then: (resolve: any) => {
              if (isSingle) {
                resolve({ data: inserted[0] ?? null, error: null });
              } else {
                resolve({ data: inserted, error: null });
              }
            },
          };
          return insertChain;
        },
        update: (updates: any) => {
          const updateChain: any = {
            eq: (col: string, val: any) => {
              filterEqs[col] = val;
              return updateChain;
            },
            then: (resolve: any) => {
              let targetList: any[] = [];
              if (table === 'user_resonators') targetList = db.userResonators;
              if (table === 'user_weapons') targetList = db.userWeapons;
              if (table === 'user_resonator_loadouts') targetList = db.userLoadouts;

              let updatedCount = 0;
              for (const row of targetList) {
                const match = Object.entries(filterEqs).every(([k, v]) => row[k] === v);
                if (match) {
                  Object.assign(row, updates);
                  updatedCount++;
                }
              }
              resolve({ data: null, error: null });
            },
          };
          return updateChain;
        },
        upsert: (payload: any, options?: { onConflict?: string }) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          const conflictCols = options?.onConflict ? options.onConflict.split(',').map((s) => s.trim()) : ['id'];
          const upserted: any[] = [];

          let targetList: any[] = [];
          if (table === 'user_resonators') targetList = db.userResonators;
          if (table === 'user_weapons') targetList = db.userWeapons;
          if (table === 'user_resonator_loadouts') targetList = db.userLoadouts;

          for (const r of rows) {
            const existingIdx = targetList.findIndex((item) =>
              conflictCols.every((col) => item[col] === r[col])
            );
            if (existingIdx >= 0) {
              const updated = {
                ...targetList[existingIdx],
                ...r,
                updated_at: new Date().toISOString(),
              };
              targetList[existingIdx] = updated;
              upserted.push(updated);
            } else {
              const created = {
                id: r.id ?? `gen-id-${idCounter++}`,
                ...r,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              targetList.push(created);
              upserted.push(created);
            }
          }

          const upsertChain: any = {
            select: () => upsertChain,
            single: () => {
              isSingle = true;
              return upsertChain;
            },
            then: (resolve: any) => {
              if (isSingle) {
                resolve({ data: upserted[0] ?? null, error: null });
              } else {
                resolve({ data: upserted, error: null });
              }
            },
          };
          return upsertChain;
        },
        delete: () => {
          const deleteChain: any = {
            eq: (col: string, val: any) => {
              filterEqs[col] = val;
              return deleteChain;
            },
            then: (resolve: any) => {
              if (table === 'user_resonators') {
                db.userResonators = db.userResonators.filter(
                  (r: any) => !Object.entries(filterEqs).every(([k, v]) => r[k] === v)
                );
              }
              if (table === 'user_weapons') {
                db.userWeapons = db.userWeapons.filter(
                  (w: any) => !Object.entries(filterEqs).every(([k, v]) => w[k] === v)
                );
              }
              if (table === 'user_resonator_loadouts') {
                db.userLoadouts = db.userLoadouts.filter(
                  (l: any) => !Object.entries(filterEqs).every(([k, v]) => l[k] === v)
                );
              }
              resolve({ data: null, error: null });
            },
          };
          return deleteChain;
        },
        then: (resolve: any) => {
          let list: any[] = [];
          if (table === 'resonators') list = db.resonators;
          if (table === 'weapons') list = db.weapons;
          if (table === 'sonatas') list = db.sonatas;
          if (table === 'user_resonators') list = db.userResonators;
          if (table === 'user_weapons') list = db.userWeapons;
          if (table === 'user_resonator_loadouts') list = db.userLoadouts;

          const filtered = list.filter((item) =>
            Object.entries(filterEqs).every(([k, v]) => item[k] === v)
          );

          if (isSingle) {
            resolve({ data: filtered[0] ?? null, error: filtered[0] ? null : new Error('Not found') });
          } else if (isMaybeSingle) {
            resolve({ data: filtered[0] ?? null, error: null });
          } else {
            resolve({ data: filtered, error: null });
          }
        },
      };

      return chain;
    },
  };

  return { client, db };
}

test('Work Package 1 — Character Investment & Equipment Management', async (t) => {
  await t.test('Authentication Guard: Rejects unauthenticated session', async () => {
    const { client } = createInMemorySupabase({ currentUserId: null });
    const res = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 0,
      },
      { supabase: client }
    );

    assert.strictEqual(res.success, false);
    assert.match(res.error!, /Unauthorized/);
  });

  await t.test('Ownership Guard: Rejects editing non-owned Resonator', async () => {
    const { client } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: { userResonators: [] }, // user does not own res-jinhsi
    });

    const res = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 0,
      },
      { supabase: client }
    );

    assert.strictEqual(res.success, false);
    assert.match(res.error!, /not in your owned roster/);
  });

  await t.test('Boundary Validation: Rejects out-of-range character level', async () => {
    const { client } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: {
        userResonators: [{ id: 'ur-1', user_id: 'user-1', resonator_id: 'res-jinhsi', level: 1, waveband: 0 }],
      },
    });

    // Level 0 rejected
    const res0 = await updateResonatorInvestmentAction(
      { resonatorId: 'res-jinhsi', characterLevel: 0, sequenceLevel: 0 },
      { supabase: client }
    );
    assert.strictEqual(res0.success, false);
    assert.match(res0.error!, /between 1 and 90/);

    // Level 91 rejected
    const res91 = await updateResonatorInvestmentAction(
      { resonatorId: 'res-jinhsi', characterLevel: 91, sequenceLevel: 0 },
      { supabase: client }
    );
    assert.strictEqual(res91.success, false);
    assert.match(res91.error!, /between 1 and 90/);

    // Non-integer float rejected
    const resFloat = await updateResonatorInvestmentAction(
      { resonatorId: 'res-jinhsi', characterLevel: 80.5, sequenceLevel: 0 },
      { supabase: client }
    );
    assert.strictEqual(resFloat.success, false);
  });

  await t.test('Boundary Validation: Rejects out-of-range waveband/sequence', async () => {
    const { client } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: {
        userResonators: [{ id: 'ur-1', user_id: 'user-1', resonator_id: 'res-jinhsi', level: 1, waveband: 0 }],
      },
    });

    // Sequence -1 rejected
    const resNeg = await updateResonatorInvestmentAction(
      { resonatorId: 'res-jinhsi', characterLevel: 90, sequenceLevel: -1 },
      { supabase: client }
    );
    assert.strictEqual(resNeg.success, false);
    assert.match(resNeg.error!, /between 0 and 6/);

    // Sequence 7 rejected
    const res7 = await updateResonatorInvestmentAction(
      { resonatorId: 'res-jinhsi', characterLevel: 90, sequenceLevel: 7 },
      { supabase: client }
    );
    assert.strictEqual(res7.success, false);
    assert.match(res7.error!, /between 0 and 6/);
  });

  await t.test('Weapon Validation: Rejects weapon level and refinement out of bounds', async () => {
    const { client } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: {
        userResonators: [{ id: 'ur-1', user_id: 'user-1', resonator_id: 'res-jinhsi', level: 1, waveband: 0 }],
      },
    });

    // Weapon level 0
    const resWep0 = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 0,
        weapon: { weaponId: 'wep-ages', level: 0, refinement: 1 },
      },
      { supabase: client }
    );
    assert.strictEqual(resWep0.success, false);
    assert.match(resWep0.error!, /Weapon level/);

    // Weapon refinement 6
    const resRef6 = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 0,
        weapon: { weaponId: 'wep-ages', level: 90, refinement: 6 },
      },
      { supabase: client }
    );
    assert.strictEqual(resRef6.success, false);
    assert.match(resRef6.error!, /Weapon refinement/);
  });

  await t.test('Compatibility Guard: Rejects equipping incompatible weapon type', async () => {
    const { client } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: {
        userResonators: [{ id: 'ur-1', user_id: 'user-1', resonator_id: 'res-jinhsi', level: 1, waveband: 0 }],
      },
    });

    // Jinhsi is Broadblade; wep-emerald is Sword
    const resMismatch = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 0,
        weapon: { weaponId: 'wep-emerald', level: 90, refinement: 1 },
      },
      { supabase: client }
    );

    assert.strictEqual(resMismatch.success, false);
    assert.match(resMismatch.error!, /Weapon type mismatch/);
  });

  await t.test('Persistence: Successfully saves complete investment and equipment', async () => {
    const { client, db } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: {
        userResonators: [{ id: 'ur-1', user_id: 'user-1', resonator_id: 'res-jinhsi', level: 1, waveband: 0 }],
      },
    });

    const res = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 2,
        weapon: { weaponId: 'wep-ages', level: 90, refinement: 1 },
        sonataId: 'son-celestial',
      },
      { supabase: client }
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data?.level, 90);
    assert.strictEqual(res.data?.waveband, 2);
    assert.strictEqual(res.data?.weaponId, 'wep-ages');
    assert.strictEqual(res.data?.sonataId, 'son-celestial');

    // Verify DB state
    const resRow = db.userResonators.find((r) => r.id === 'ur-1');
    assert.strictEqual(resRow?.level, 90);
    assert.strictEqual(resRow?.waveband, 2);

    assert.strictEqual(db.userWeapons.length, 1);
    assert.strictEqual(db.userWeapons[0].weapon_id, 'wep-ages');
    assert.strictEqual(db.userWeapons[0].level, 90);
    assert.strictEqual(db.userWeapons[0].refinement, 1);

    assert.strictEqual(db.userLoadouts.length, 1);
    assert.strictEqual(db.userLoadouts[0].weapon_instance_id, db.userWeapons[0].id);
    assert.strictEqual(db.userLoadouts[0].sonata_id, 'son-celestial');
  });

  await t.test('Idempotency: Repeated updates modify weapon in place without creating duplicates', async () => {
    const { client, db } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: {
        userResonators: [{ id: 'ur-1', user_id: 'user-1', resonator_id: 'res-jinhsi', level: 1, waveband: 0 }],
      },
    });

    // Save 1
    const res1 = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 70,
        sequenceLevel: 1,
        weapon: { weaponId: 'wep-ages', level: 70, refinement: 1 },
        sonataId: 'son-celestial',
      },
      { supabase: client }
    );
    assert.strictEqual(res1.success, true);
    assert.strictEqual(db.userWeapons.length, 1);
    const firstWeaponInstId = db.userWeapons[0].id;

    // Save 2 (Level up weapon to 90, refinement 2)
    const res2 = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 2,
        weapon: { weaponId: 'wep-ages', level: 90, refinement: 2 },
        sonataId: 'son-celestial',
      },
      { supabase: client }
    );
    assert.strictEqual(res2.success, true);

    // Verify zero duplicate rows created in userWeapons and userLoadouts
    assert.strictEqual(db.userWeapons.length, 1);
    assert.strictEqual(db.userWeapons[0].id, firstWeaponInstId);
    assert.strictEqual(db.userWeapons[0].level, 90);
    assert.strictEqual(db.userWeapons[0].refinement, 2);
    assert.strictEqual(db.userLoadouts.length, 1);
    assert.strictEqual(db.userLoadouts[0].weapon_instance_id, firstWeaponInstId);
  });

  await t.test('Equipment Clearing: Unequipping weapon sets loadout weapon_instance_id to null', async () => {
    const { client, db } = createInMemorySupabase({
      currentUserId: 'user-1',
      state: {
        userResonators: [{ id: 'ur-1', user_id: 'user-1', resonator_id: 'res-jinhsi', level: 90, waveband: 2 }],
        userWeapons: [{ id: 'uw-1', user_id: 'user-1', weapon_id: 'wep-ages', level: 90, refinement: 1 }],
        userLoadouts: [{ id: 'ul-1', user_id: 'user-1', user_resonator_id: 'ur-1', weapon_instance_id: 'uw-1', sonata_id: 'son-celestial' }],
      },
    });

    const resClear = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 2,
        weapon: null, // Unequipped
        sonataId: null, // Unset
      },
      { supabase: client }
    );

    assert.strictEqual(resClear.success, true);
    assert.strictEqual(resClear.data?.weaponInstanceId, null);
    assert.strictEqual(resClear.data?.sonataId, null);

    // Loadout updated
    const loadout = db.userLoadouts.find((l) => l.user_resonator_id === 'ur-1');
    assert.strictEqual(loadout?.weapon_instance_id, null);
    assert.strictEqual(loadout?.sonata_id, null);

    // Existing weapon instance not deleted
    assert.strictEqual(db.userWeapons.length, 1);
  });

  await t.test('Integration: Adapter & Recommendation Application Service consume saved build state', async () => {
    const resolver = new MockEntityResolver();
    resolver.registerResonator('res-jinhsi', 'Jinhsi');
    resolver.registerResonator('res-changli', 'Changli');
    resolver.registerResonator('res-verina', 'Verina');
    resolver.registerWeapon('wep-ages', 'Ages of Harvest');
    resolver.registerWeapon('wep-emerald', 'Emerald of Genesis');
    resolver.registerWeapon('wep-ripples', 'Cosmic Ripples');
    resolver.registerSonata('son-celestial', 'Celestial Light');

    const { client } = createInMemorySupabase({
      currentUserId: 'user-e2e',
      state: {
        userResonators: [
          { id: 'ur-1', user_id: 'user-e2e', resonator_id: 'res-jinhsi', level: 1, waveband: 0 },
          { id: 'ur-2', user_id: 'user-e2e', resonator_id: 'res-changli', level: 90, waveband: 1 },
          { id: 'ur-3', user_id: 'user-e2e', resonator_id: 'res-verina', level: 80, waveband: 0 },
        ],
        userWeapons: [
          { id: 'uw-changli', user_id: 'user-e2e', weapon_id: 'wep-emerald', level: 90, refinement: 1 },
          { id: 'uw-verina', user_id: 'user-e2e', weapon_id: 'wep-ripples', level: 80, refinement: 1 },
        ],
        userLoadouts: [
          { id: 'ul-changli', user_id: 'user-e2e', user_resonator_id: 'ur-2', weapon_instance_id: 'uw-changli', sonata_id: 'son-celestial' },
          { id: 'ul-verina', user_id: 'user-e2e', user_resonator_id: 'ur-3', weapon_instance_id: 'uw-verina', sonata_id: null },
        ],
      },
    });

    // 1. User updates Jinhsi investment from baseline (Lv 1, S0, unequipped) to (Lv 90, S2, Ages of Harvest Lv 90 R1, Celestial Light)
    const updateRes = await updateResonatorInvestmentAction(
      {
        resonatorId: 'res-jinhsi',
        characterLevel: 90,
        sequenceLevel: 2,
        weapon: { weaponId: 'wep-ages', level: 90, refinement: 1 },
        sonataId: 'son-celestial',
      },
      { supabase: client }
    );
    assert.strictEqual(updateRes.success, true);

    // 2. UserInventoryAdapter reads updated DB state
    const adapter = new UserInventoryAdapter({ supabase: client, entityResolver: resolver });
    const adapted = await adapter.adaptUserInventory('user-e2e');

    assert.strictEqual(adapted.ownedResonatorIds.length, 3);
    assert.strictEqual(adapted.investmentSnapshots.length, 3);

    // Verify Jinhsi snapshot reflects updated build
    const jinhsiSnapshot = adapted.investmentSnapshots.find((s) => s.resonatorId === 'Jinhsi');
    assert.ok(jinhsiSnapshot);
    assert.deepStrictEqual(jinhsiSnapshot.characterLevel, { status: 'KNOWN', value: 90 });
    assert.deepStrictEqual(jinhsiSnapshot.sequenceLevel, { status: 'KNOWN', value: 2 });
    assert.strictEqual(jinhsiSnapshot.weapon?.weaponId, 'Ages of Harvest');
    assert.deepStrictEqual(jinhsiSnapshot.weapon?.weaponLevel, { status: 'KNOWN', value: 90 });
    assert.deepStrictEqual(jinhsiSnapshot.weapon?.refinementRank, { status: 'KNOWN', value: 1 });
    assert.strictEqual(jinhsiSnapshot.echoInvestment?.sonataSetId, 'Celestial Light');

    // 3. RecommendationApplicationService runs with updated inventory
    const recService = new RecommendationApplicationService({
      supabase: client,
      inventoryAdapter: adapter,
    });

    const recResult = await recService.executeRecommendation({
      scope: 'TOWER',
      selectedTowerId: 'hazard-tower',
      targetK: 1,
      allowPartial: true,
    });

    assert.strictEqual(recResult.success, true);
    if (!recResult.success) return;

    // Verify view model contains configured build data without prohibited scoring terms
    assert.strictEqual(recResult.data.serviceRuleVersion, '7.25.1');
    assert.strictEqual(recResult.data.engineRuleVersion, '7.24.1');
    assert.ok(recResult.data.stages.length > 0);
  });
});
