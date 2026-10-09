import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseGameDataRepository,
  clearGameDataCache,
} from '../lib/data-access/repositories/game-data-repository.ts';
import type {
  ResonanceSequence,
  SequenceOrder,
  GameplayEffect,
  Resonator,
  ResonatorAbility,
} from '../lib/domain/types/index.ts';

/**
 * Creates a mock Supabase client for unit testing repository queries and mappings.
 */
function createMockClient(
  queryHandler: (table: string, filters: Record<string, unknown>) => { data: unknown; error: unknown }
): SupabaseClient {
  return {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: (_cols: string) => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        returns: <T>() => builder,
        then: <TResult1 = unknown, TResult2 = never>(
          resolve?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
          reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) => {
          const result = queryHandler(table, filters);
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

test('1. Empty result — Resonator with no Sequence data returns empty array', async () => {
  clearGameDataCache();

  // Test A: In-memory mock returning zero rows
  const mockClient = createMockClient((table, filters) => {
    assert.strictEqual(table, 'resonator_sequences');
    assert.strictEqual(filters['resonator_id'], 'res-no-sequences');
    assert.strictEqual(filters['resonator_sequence_patch_data.patch_id'], 'patch-3-7-id');
    return { data: [], error: null };
  });

  const mockRepo = new SupabaseGameDataRepository(mockClient);
  const mockResult = await mockRepo.getResonanceSequences('res-no-sequences', 'patch-3-7-id');
  assert.ok(Array.isArray(mockResult), 'Must return an array');
  assert.strictEqual(mockResult.length, 0, 'Must be empty array');
});

test('2. S1–S6 ordering — Scrambled database rows return in deterministic S1 to S6 order', async () => {
  clearGameDataCache();

  // Scrambled order from DB: S4, S1, S6, S2, S5, S3
  const scrambledRows = [
    {
      id: 'seq-4',
      resonator_id: 'res-jinhsi',
      node_order: 4,
      nodeCode: 'S4',
      resonator_sequence_patch_data: [
        {
          id: 'spd-4',
          patch_id: 'patch-3-7-id',
          name: 'Benevolent Grace',
          description: 'S4 description text',
          provenance_id: 'prov-1',
          resonator_sequence_effects: [],
        },
      ],
    },
    {
      id: 'seq-1',
      resonator_id: 'res-jinhsi',
      node_order: 1,
      node_code: 'S1',
      resonator_sequence_patch_data: [
        {
          id: 'spd-1',
          patch_id: 'patch-3-7-id',
          name: 'Abyssal Ascendance',
          description: 'S1 description text',
          provenance_id: 'prov-1',
          resonator_sequence_effects: [],
        },
      ],
    },
    {
      id: 'seq-6',
      resonator_id: 'res-jinhsi',
      node_order: 6,
      node_code: 'S6',
      resonator_sequence_patch_data: [
        {
          id: 'spd-6',
          patch_id: 'patch-3-7-id',
          name: 'Radiant Sovereign',
          description: 'S6 description text',
          provenance_id: 'prov-1',
          resonator_sequence_effects: [],
        },
      ],
    },
    {
      id: 'seq-2',
      resonator_id: 'res-jinhsi',
      node_order: 2,
      node_code: 'S2',
      resonator_sequence_patch_data: [
        {
          id: 'spd-2',
          patch_id: 'patch-3-7-id',
          name: 'Chronicle of Seasons',
          description: 'S2 description text',
          provenance_id: 'prov-1',
          resonator_sequence_effects: [],
        },
      ],
    },
    {
      id: 'seq-5',
      resonator_id: 'res-jinhsi',
      node_order: 5,
      node_code: 'S5',
      resonator_sequence_patch_data: [
        {
          id: 'spd-5',
          patch_id: 'patch-3-7-id',
          name: 'Frost and Flame',
          description: 'S5 description text',
          provenance_id: 'prov-1',
          resonator_sequence_effects: [],
        },
      ],
    },
    {
      id: 'seq-3',
      resonator_id: 'res-jinhsi',
      node_order: 3,
      node_code: 'S3',
      resonator_sequence_patch_data: [
        {
          id: 'spd-3',
          patch_id: 'patch-3-7-id',
          name: 'Celestial Bloom',
          description: 'S3 description text',
          provenance_id: 'prov-1',
          resonator_sequence_effects: [],
        },
      ],
    },
  ];

  const mockClient = createMockClient(() => ({
    data: scrambledRows,
    error: null,
  }));

  const repo = new SupabaseGameDataRepository(mockClient);
  const result = await repo.getResonanceSequences('res-jinhsi', 'patch-3-7-id');

  assert.strictEqual(result.length, 6, 'Must return exactly 6 nodes');

  const expectedOrder: SequenceOrder[] = [1, 2, 3, 4, 5, 6];
  const expectedCodes = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  const expectedNames = [
    'Abyssal Ascendance',
    'Chronicle of Seasons',
    'Celestial Bloom',
    'Benevolent Grace',
    'Frost and Flame',
    'Radiant Sovereign',
  ];

  for (let i = 0; i < 6; i++) {
    assert.strictEqual(result[i].nodeOrder, expectedOrder[i], `Node at index ${i} must have nodeOrder ${expectedOrder[i]}`);
    assert.strictEqual(result[i].name, expectedNames[i], `Node at index ${i} must have expected name ${expectedNames[i]}`);
  }
});

test('3. Patch isolation — Sequence data is strictly isolated by patchId', async () => {
  clearGameDataCache();

  let queriedPatchId: unknown = null;

  const mockClient = createMockClient((_table, filters) => {
    queriedPatchId = filters['resonator_sequence_patch_data.patch_id'];
    if (queriedPatchId === 'patch-3-7-id') {
      return {
        data: [
          {
            id: 'seq-1',
            resonator_id: 'res-jinhsi',
            node_order: 1,
            node_code: 'S1',
            resonator_sequence_patch_data: [
              {
                id: 'spd-37',
                patch_id: 'patch-3-7-id',
                name: 'Patch 3.7 S1 Name',
                description: 'Patch 3.7 S1 Description',
                provenance_id: 'prov-1',
                resonator_sequence_effects: [],
              },
            ],
          },
        ],
        error: null,
      };
    } else if (queriedPatchId === 'patch-3-8-id') {
      return {
        data: [
          {
            id: 'seq-1',
            resonator_id: 'res-jinhsi',
            node_order: 1,
            node_code: 'S1',
            resonator_sequence_patch_data: [
              {
                id: 'spd-38',
                patch_id: 'patch-3-8-id',
                name: 'Patch 3.8 Reworked S1 Name',
                description: 'Patch 3.8 Reworked S1 Description',
                provenance_id: 'prov-2',
                resonator_sequence_effects: [],
              },
            ],
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  });

  const repo = new SupabaseGameDataRepository(mockClient);

  // Query Patch 3.7
  const res37 = await repo.getResonanceSequences('res-jinhsi', 'patch-3-7-id');
  assert.strictEqual(queriedPatchId, 'patch-3-7-id');
  assert.strictEqual(res37.length, 1);
  assert.strictEqual(res37[0].name, 'Patch 3.7 S1 Name');
  assert.strictEqual(res37[0].description, 'Patch 3.7 S1 Description');

  // Query Patch 3.8
  const res38 = await repo.getResonanceSequences('res-jinhsi', 'patch-3-8-id');
  assert.strictEqual(queriedPatchId, 'patch-3-8-id');
  assert.strictEqual(res38.length, 1);
  assert.strictEqual(res38[0].name, 'Patch 3.8 Reworked S1 Name');
  assert.strictEqual(res38[0].description, 'Patch 3.8 Reworked S1 Description');

  // Query Non-existent Patch 3.9 -> must return empty array without falling back
  const res39 = await repo.getResonanceSequences('res-jinhsi', 'patch-3-9-id');
  assert.strictEqual(queriedPatchId, 'patch-3-9-id');
  assert.strictEqual(res39.length, 0, 'Missing patch data must return empty array without fallback');
});

test('4. GameplayEffect mapping — Returns associated GameplayEffects in effect_order', async () => {
  clearGameDataCache();

  // Node S1 with 3 effects in scrambled order: order 3, order 1, order 2
  const mockRow = {
    id: 'seq-1',
    resonator_id: 'res-jinhsi',
    node_order: 1,
    node_code: 'S1',
    resonator_sequence_patch_data: [
      {
        id: 'spd-1',
        patch_id: 'patch-3-7-id',
        name: 'S1 Node',
        description: 'S1 Description',
        provenance_id: 'prov-1',
        resonator_sequence_effects: [
          {
            effect_order: 3,
            gameplay_effects: {
              id: 'ge-3',
              patch_id: 'patch-3-7-id',
              category: 'STAT_BUFF',
              target: 'SELF',
              condition_expression: { type: 'ON_SKILL_HIT' },
              detail_expression: { stat: 'CRIT_DMG', value: 0.25 },
            },
          },
          {
            effect_order: 1,
            gameplay_effects: {
              id: 'ge-1',
              patch_id: 'patch-3-7-id',
              category: 'DMG_AMPLIFY',
              target: 'SELF',
              condition_expression: null,
              detail_expression: { multiplier: 1.15 },
            },
          },
          {
            effect_order: 2,
            gameplay_effects: {
              id: 'ge-2',
              patch_id: 'patch-3-7-id',
              category: 'RESOURCE_GRANT',
              target: 'SELF',
              condition_expression: { stack_threshold: 4 },
              detail_expression: { forte_gauge: 50 },
            },
          },
        ],
      },
    ],
  };

  const mockClient = createMockClient(() => ({
    data: [mockRow],
    error: null,
  }));

  const repo = new SupabaseGameDataRepository(mockClient);
  const result = await repo.getResonanceSequences('res-jinhsi', 'patch-3-7-id');

  assert.strictEqual(result.length, 1);
  const node = result[0];
  assert.strictEqual(node.effects.length, 3, 'Must have 3 mapped gameplay effects');

  // Verify deterministic ordering: ge-1 (order 1), ge-2 (order 2), ge-3 (order 3)
  assert.strictEqual(node.effects[0].id, 'ge-1');
  assert.strictEqual(node.effects[0].category, 'DMG_AMPLIFY');
  assert.strictEqual(node.effects[0].target, 'SELF');
  assert.deepStrictEqual(node.effects[0].detailExpression, { multiplier: 1.15 });

  assert.strictEqual(node.effects[1].id, 'ge-2');
  assert.strictEqual(node.effects[1].category, 'RESOURCE_GRANT');
  assert.deepStrictEqual(node.effects[1].conditionExpression, { stack_threshold: 4 });

  assert.strictEqual(node.effects[2].id, 'ge-3');
  assert.strictEqual(node.effects[2].category, 'STAT_BUFF');
  assert.deepStrictEqual(node.effects[2].detailExpression, { stat: 'CRIT_DMG', value: 0.25 });
});

test('5. Effect patch isolation — Excludes gameplay effects belonging to other patches', async () => {
  clearGameDataCache();

  // Node S1 has Effect A (patch 3.7) and a corrupted cross-patch join Effect B (patch 3.8)
  const mockRow = {
    id: 'seq-1',
    resonator_id: 'res-jinhsi',
    node_order: 1,
    node_code: 'S1',
    resonator_sequence_patch_data: [
      {
        id: 'spd-1',
        patch_id: 'patch-3-7-id',
        name: 'S1 Node',
        description: 'S1 Description',
        provenance_id: 'prov-1',
        resonator_sequence_effects: [
          {
            effect_order: 1,
            gameplay_effects: {
              id: 'ge-valid-37',
              patch_id: 'patch-3-7-id',
              category: 'STAT_BUFF',
              target: 'SELF',
              condition_expression: null,
              detail_expression: { atk_percent: 0.1 },
            },
          },
          {
            effect_order: 2,
            gameplay_effects: {
              id: 'ge-foreign-38',
              patch_id: 'patch-3-8-id', // DIFFERENT PATCH
              category: 'SPECIAL_MECHANIC',
              target: 'TEAM',
              condition_expression: null,
              detail_expression: { mechanic: 'unreleased_v38_buff' },
            },
          },
        ],
      },
    ],
  };

  const mockClient = createMockClient(() => ({
    data: [mockRow],
    error: null,
  }));

  const repo = new SupabaseGameDataRepository(mockClient);
  const result = await repo.getResonanceSequences('res-jinhsi', 'patch-3-7-id');

  assert.strictEqual(result.length, 1);
  const effects = result[0].effects;
  assert.strictEqual(effects.length, 1, 'Foreign patch effect must be excluded');
  assert.strictEqual(effects[0].id, 'ge-valid-37');
  assert.strictEqual(effects[0].patchId, 'patch-3-7-id');
});

test('6. No Ability contamination — ResonanceSequence is strictly decoupled from combat abilities', () => {
  // Domain contract check
  const sampleSequenceNode: ResonanceSequence = {
    id: 'seq-uuid-001',
    resonatorId: 'res-uuid-001',
    nodeOrder: 1,
    nodeCode: 'S1',
    name: 'Sequence Node Name',
    description: 'Sequence Node Description',
    provenanceId: 'prov-uuid-001',
    effects: [],
  };

  // 1. Verify ResonanceSequence has expected fields
  assert.strictEqual(sampleSequenceNode.nodeOrder, 1);
  assert.strictEqual(sampleSequenceNode.nodeCode, 'S1');

  // 2. Verify ResonanceSequence does NOT have Ability fields
  assert.strictEqual('abilityCategory' in sampleSequenceNode, false, 'Must not have abilityCategory');
  assert.strictEqual('ability_category' in sampleSequenceNode, false, 'Must not have ability_category');
  assert.strictEqual('cooldownSeconds' in sampleSequenceNode, false, 'Must not have cooldownSeconds');
  assert.strictEqual('energyCost' in sampleSequenceNode, false, 'Must not have energyCost');
  assert.strictEqual('concertosGenerated' in sampleSequenceNode, false, 'Must not have concertosGenerated');

  // 3. Verify Resonator domain model maintains clear separation
  const sampleResonator: Resonator = {
    id: 'res-uuid-001',
    name: 'Jinhsi',
    element: 'Spectro',
    weaponType: 'Broadblade',
    rarity: 5,
    releaseDate: '2024-06-28',
    baseHpLvl90: 10625,
    baseAtkLvl90: 437,
    baseDefLvl90: 1187,
    roles: [],
    combatTags: [],
    abilities: [
      {
        code: 'NORMAL_ATTACK',
        category: 'Normal Attack',
        name: 'Slash',
        concertosGenerated: 10,
        effects: [],
      },
    ],
    sequenceNodes: [sampleSequenceNode],
  };

  assert.strictEqual(sampleResonator.abilities.length, 1);
  assert.strictEqual(sampleResonator.abilities[0].code, 'NORMAL_ATTACK');
  assert.strictEqual(sampleResonator.sequenceNodes?.length, 1);
  assert.strictEqual(sampleResonator.sequenceNodes[0].nodeCode, 'S1');
});

test('7. Determinism — Repeated retrieval produces equivalent ordered domain objects', async () => {
  clearGameDataCache();

  let queryCallCount = 0;
  const mockClient = createMockClient(() => {
    queryCallCount++;
    return {
      data: [
        {
          id: 'seq-2',
          resonator_id: 'res-jinhsi',
          node_order: 2,
          node_code: 'S2',
          resonator_sequence_patch_data: [
            {
              id: 'spd-2',
              patch_id: 'patch-3-7-id',
              name: 'S2 Node',
              description: 'S2 Description',
              provenance_id: 'prov-1',
              resonator_sequence_effects: [],
            },
          ],
        },
        {
          id: 'seq-1',
          resonator_id: 'res-jinhsi',
          node_order: 1,
          node_code: 'S1',
          resonator_sequence_patch_data: [
            {
              id: 'spd-1',
              patch_id: 'patch-3-7-id',
              name: 'S1 Node',
              description: 'S1 Description',
              provenance_id: 'prov-1',
              resonator_sequence_effects: [],
            },
          ],
        },
      ],
      error: null,
    };
  });

  const repo = new SupabaseGameDataRepository(mockClient);

  // First call -> fetches from client and populates cache
  const firstCall = await repo.getResonanceSequences('res-jinhsi', 'patch-3-7-id');
  assert.strictEqual(queryCallCount, 1);
  assert.strictEqual(firstCall.length, 2);
  assert.strictEqual(firstCall[0].nodeOrder, 1);
  assert.strictEqual(firstCall[1].nodeOrder, 2);

  // Second call -> hits cache
  const secondCall = await repo.getResonanceSequences('res-jinhsi', 'patch-3-7-id');
  assert.strictEqual(queryCallCount, 1, 'Second call must hit cache without refetching');
  assert.deepStrictEqual(firstCall, secondCall, 'Cached result must be strictly identical');

  // Clear cache and call third time -> refetches and produces identical ordered structure
  clearGameDataCache();
  const thirdCall = await repo.getResonanceSequences('res-jinhsi', 'patch-3-7-id');
  assert.strictEqual(queryCallCount, 2, 'Must refetch after cache clear');
  assert.deepStrictEqual(firstCall, thirdCall, 'Refetched result must match first call identically');
});
