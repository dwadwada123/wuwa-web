import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOptimizationCacheKey,
  OptimizationCache,
  type OptimizationCacheKeyInput,
} from '../lib/engine/cache/optimization-cache.ts';

const baseInput: OptimizationCacheKeyInput = {
  userId: 'usr-12345678-0000-0000-0000-000000000001',
  inventory: {
    resonators: [
      {
        resonatorId: 'jinshi',
        level: 90,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 10,
        forteCircuitLevel: 10,
        resonanceLiberationLevel: 10,
        introSkillLevel: 6,
      },
      {
        resonatorId: 'yinlin',
        level: 90,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 8,
        forteCircuitLevel: 9,
        resonanceLiberationLevel: 8,
        introSkillLevel: 6,
      },
      {
        resonatorId: 'verina',
        level: 90,
        waveband: 1,
        normalAttackLevel: 1,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
    ],
    weapons: [
      { id: 'wep-inst-1', weaponId: 'ages-of-harvest', level: 90, refinement: 1 },
      { id: 'wep-inst-2', weaponId: 'stringmaster', level: 90, refinement: 1 },
      { id: 'wep-inst-3', weaponId: 'variation', level: 80, refinement: 5 },
    ],
    loadouts: [
      { resonatorId: 'jinshi', weaponInstanceId: 'wep-inst-1' },
      { resonatorId: 'yinlin', weaponInstanceId: 'wep-inst-2' },
      { resonatorId: 'verina', weaponInstanceId: 'wep-inst-3' },
    ],
  },
  patchId: 'patch-3-7-id',
  cycleId: 'cycle-s40-id',
  stages: [
    {
      id: 'tower-hazard-4',
      vigorCost: 4,
      areaEffects: [{ id: 'spectro-buff-s40' }],
      waves: [
        {
          enemyInstances: [
            {
              enemy: {
                id: 'mephis',
                resistances: [{ element: 'Electro', ratio: 0.4 }],
              },
            },
          ],
        },
      ],
    },
  ],
  mode: 'BEST_EFFORT',
  maxSearchStates: 200000,
  scoringVersion: 'v1-standard',
};

test('Cache Invalidation: identical inputs produce identical cache keys and cache hits', () => {
  const cache = new OptimizationCache(10, 60000);
  const key1 = computeOptimizationCacheKey(baseInput);
  const key2 = computeOptimizationCacheKey(JSON.parse(JSON.stringify(baseInput)));

  assert.strictEqual(key1, key2, 'Keys must be identical for identical input state');

  const mockResult = { totalScore: 9800, assignments: ['stage1'] };
  cache.set(key1, mockResult);

  const cached = cache.get(key2);
  assert.deepStrictEqual(cached, mockResult, 'Cache must hit for identical inputs');
});

test('Cache Invalidation: change in owned Resonator invalidates cache', () => {
  const cache = new OptimizationCache(10, 60000);
  const keyBase = computeOptimizationCacheKey(baseInput);
  cache.set(keyBase, { result: 'base' });

  // 1. Add new resonator
  const addedResonatorInput: OptimizationCacheKeyInput = {
    ...baseInput,
    inventory: {
      ...baseInput.inventory,
      resonators: [
        ...baseInput.inventory.resonators,
        { resonatorId: 'changli', level: 90, waveband: 0 },
      ],
    },
  };
  const keyAdded = computeOptimizationCacheKey(addedResonatorInput);
  assert.notStrictEqual(keyAdded, keyBase, 'Adding a resonator must change the cache key');
  assert.strictEqual(cache.get(keyAdded), null, 'Cache must miss when new resonator is added');

  // 2. Change resonator level
  const changedLevelInput: OptimizationCacheKeyInput = {
    ...baseInput,
    inventory: {
      ...baseInput.inventory,
      resonators: baseInput.inventory.resonators.map((r) =>
        r.resonatorId === 'jinshi' ? { ...r, level: 80 } : r
      ),
    },
  };
  const keyLevel = computeOptimizationCacheKey(changedLevelInput);
  assert.notStrictEqual(keyLevel, keyBase, 'Changing level must change the cache key');
  assert.strictEqual(cache.get(keyLevel), null, 'Cache must miss when resonator level changes');

  // 3. Change resonator waveband
  const changedWavebandInput: OptimizationCacheKeyInput = {
    ...baseInput,
    inventory: {
      ...baseInput.inventory,
      resonators: baseInput.inventory.resonators.map((r) =>
        r.resonatorId === 'jinshi' ? { ...r, waveband: 2 } : r
      ),
    },
  };
  const keyWaveband = computeOptimizationCacheKey(changedWavebandInput);
  assert.notStrictEqual(keyWaveband, keyBase, 'Changing waveband must change cache key');
  assert.strictEqual(cache.get(keyWaveband), null);

  // 4. Change resonator skill level
  const changedSkillInput: OptimizationCacheKeyInput = {
    ...baseInput,
    inventory: {
      ...baseInput.inventory,
      resonators: baseInput.inventory.resonators.map((r) =>
        r.resonatorId === 'jinshi' ? { ...r, resonanceSkillLevel: 4 } : r
      ),
    },
  };
  const keySkill = computeOptimizationCacheKey(changedSkillInput);
  assert.notStrictEqual(keySkill, keyBase, 'Changing skill level must change cache key');
  assert.strictEqual(cache.get(keySkill), null);
});

test('Cache Invalidation: change in weapon or loadout invalidates cache', () => {
  const cache = new OptimizationCache(10, 60000);
  const keyBase = computeOptimizationCacheKey(baseInput);
  cache.set(keyBase, { result: 'base' });

  // 1. Change equipped weapon in loadout
  const changedLoadoutInput: OptimizationCacheKeyInput = {
    ...baseInput,
    inventory: {
      ...baseInput.inventory,
      loadouts: [
        { resonatorId: 'jinshi', weaponInstanceId: 'wep-inst-999' },
        ...baseInput.inventory.loadouts!.slice(1),
      ],
    },
  };
  const keyLoadout = computeOptimizationCacheKey(changedLoadoutInput);
  assert.notStrictEqual(keyLoadout, keyBase, 'Changing equipped weapon must change cache key');
  assert.strictEqual(cache.get(keyLoadout), null);

  // 2. Change weapon refinement
  const changedRefinementInput: OptimizationCacheKeyInput = {
    ...baseInput,
    inventory: {
      ...baseInput.inventory,
      weapons: baseInput.inventory.weapons!.map((w) =>
        w.id === 'wep-inst-1' ? { ...w, refinement: 5 } : w
      ),
    },
  };
  const keyRefinement = computeOptimizationCacheKey(changedRefinementInput);
  assert.notStrictEqual(keyRefinement, keyBase, 'Changing weapon refinement must change cache key');
  assert.strictEqual(cache.get(keyRefinement), null);
});

test('Cache Invalidation: change in patch context invalidates cache', () => {
  const cache = new OptimizationCache(10, 60000);
  const keyBase = computeOptimizationCacheKey(baseInput);
  cache.set(keyBase, { result: 'base' });

  const changedPatchInput: OptimizationCacheKeyInput = {
    ...baseInput,
    patchId: 'patch-3-8-id',
  };
  const keyPatch = computeOptimizationCacheKey(changedPatchInput);
  assert.notStrictEqual(keyPatch, keyBase, 'Changing patch must change cache key');
  assert.strictEqual(cache.get(keyPatch), null);
});

test('Cache Invalidation: change in ToA cycle or stage context invalidates cache', () => {
  const cache = new OptimizationCache(10, 60000);
  const keyBase = computeOptimizationCacheKey(baseInput);
  cache.set(keyBase, { result: 'base' });

  // 1. Cycle ID change
  const changedCycleInput: OptimizationCacheKeyInput = {
    ...baseInput,
    cycleId: 'cycle-s41-id',
  };
  const keyCycle = computeOptimizationCacheKey(changedCycleInput);
  assert.notStrictEqual(keyCycle, keyBase, 'Changing cycle must change cache key');
  assert.strictEqual(cache.get(keyCycle), null);

  // 2. Stage list / vigor cost change
  const changedStageVigorInput: OptimizationCacheKeyInput = {
    ...baseInput,
    stages: [
      {
        ...baseInput.stages[0],
        vigorCost: 5, // Vigor cost changed from 4 to 5
      },
    ],
  };
  const keyVigor = computeOptimizationCacheKey(changedStageVigorInput);
  assert.notStrictEqual(keyVigor, keyBase, 'Changing stage vigor must change cache key');
  assert.strictEqual(cache.get(keyVigor), null);

  // 3. Area buff change
  const changedBuffInput: OptimizationCacheKeyInput = {
    ...baseInput,
    stages: [
      {
        ...baseInput.stages[0],
        areaEffects: [{ id: 'havoc-buff-s41' }],
      },
    ],
  };
  const keyBuff = computeOptimizationCacheKey(changedBuffInput);
  assert.notStrictEqual(keyBuff, keyBase, 'Changing area effects must change cache key');
  assert.strictEqual(cache.get(keyBuff), null);

  // 4. Enemy facts / resistances change
  const changedEnemyInput: OptimizationCacheKeyInput = {
    ...baseInput,
    stages: [
      {
        ...baseInput.stages[0],
        waves: [
          {
            enemyInstances: [
              {
                enemy: {
                  id: 'bell-borne-geochelone',
                  resistances: [{ element: 'Glacio', ratio: 0.5 }],
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const keyEnemy = computeOptimizationCacheKey(changedEnemyInput);
  assert.notStrictEqual(keyEnemy, keyBase, 'Changing stage enemies must change cache key');
  assert.strictEqual(cache.get(keyEnemy), null);
});

test('Cache Invalidation: change in optimizer mode or search budget invalidates cache', () => {
  const cache = new OptimizationCache(10, 60000);
  const keyBase = computeOptimizationCacheKey(baseInput);
  cache.set(keyBase, { result: 'base' });

  // 1. BEST_EFFORT vs EXACT
  const changedModeInput: OptimizationCacheKeyInput = {
    ...baseInput,
    mode: 'EXACT',
  };
  const keyMode = computeOptimizationCacheKey(changedModeInput);
  assert.notStrictEqual(keyMode, keyBase, 'Switching to EXACT must change cache key');
  assert.strictEqual(cache.get(keyMode), null, 'EXACT run must not reuse BEST_EFFORT result');

  // 2. Search budget change
  const changedBudgetInput: OptimizationCacheKeyInput = {
    ...baseInput,
    maxSearchStates: 50000,
  };
  const keyBudget = computeOptimizationCacheKey(changedBudgetInput);
  assert.notStrictEqual(keyBudget, keyBase, 'Changing search budget must change cache key');
  assert.strictEqual(cache.get(keyBudget), null);

  // 3. Scoring version change
  const changedScoringInput: OptimizationCacheKeyInput = {
    ...baseInput,
    scoringVersion: 'v2-experimental',
  };
  const keyScoring = computeOptimizationCacheKey(changedScoringInput);
  assert.notStrictEqual(keyScoring, keyBase, 'Changing scoring version must change cache key');
  assert.strictEqual(cache.get(keyScoring), null);
});

test('Cache Invalidation: user isolation ensures separate tenants never collide', () => {
  const cache = new OptimizationCache(10, 60000);
  const keyUser1 = computeOptimizationCacheKey(baseInput);
  cache.set(keyUser1, { user: 'user1-result' });

  const otherUserInput: OptimizationCacheKeyInput = {
    ...baseInput,
    userId: 'usr-99999999-0000-0000-0000-000000000002',
  };
  const keyUser2 = computeOptimizationCacheKey(otherUserInput);

  assert.notStrictEqual(keyUser1, keyUser2, 'Different users must produce distinct keys');
  assert.strictEqual(cache.get(keyUser2), null, 'User 2 must not see User 1 cached result');
});

test('Cache Invalidation: TTL expiration and LRU eviction work correctly', async () => {
  // Short TTL of 50ms
  const cache = new OptimizationCache(2, 50);
  const key1 = computeOptimizationCacheKey({ ...baseInput, userId: 'u1' });
  const key2 = computeOptimizationCacheKey({ ...baseInput, userId: 'u2' });
  const key3 = computeOptimizationCacheKey({ ...baseInput, userId: 'u3' });

  cache.set(key1, { val: 1 });
  cache.set(key2, { val: 2 });
  assert.strictEqual(cache.has(key1), true);

  // Eviction: adding 3rd element evicts oldest (key1)
  cache.set(key3, { val: 3 });
  assert.strictEqual(cache.has(key1), false, 'Oldest entry should be evicted');
  assert.strictEqual(cache.has(key2), true);
  assert.strictEqual(cache.has(key3), true);

  // TTL expiration
  await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(cache.get(key2), null, 'Entry must expire after TTL');
  assert.strictEqual(cache.has(key2), false, 'has() must return false after TTL');
});
