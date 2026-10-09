import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  validatePatchDataset,
  validateSequenceNode,
  validateSequenceNodes,
  validateRefinementScaling,
  VALID_SEQUENCE_ORDERS,
  VALID_SEQUENCE_CODES,
  VALID_REFINEMENT_RANKS,
  VALID_EFFECT_CATEGORIES,
  FORBIDDEN_PROVENANCE_NAMES
} from '../lib/ingestion/validation.ts';
import { ingestPatchDataset, deterministicUuid } from '../lib/ingestion/engine.ts';
import type {
  PatchDataset,
  SequenceNodeInput,
  RefinementScaling,
  GameplayEffectCategory,
  GameplayEffectTarget
} from '../lib/ingestion/types.ts';

// Helper to create a minimal valid base dataset for testing
function createBaseDataset(): PatchDataset {
  return {
    patch: {
      version: '3.7',
      release_date: '2026-09-30',
      provenance_source_name: 'Official 3.7 Release Notes'
    },
    provenance_sources: [
      {
        source_name: 'Official 3.7 Release Notes',
        source_type: 'OFFICIAL_PUBLISHED',
        verification_date: '2026-09-30',
        confidence: 'HIGH',
        classification: 'CORE_MECHANIC',
        status: 'ACTIVE'
      },
      {
        source_name: 'Verified Resonator Archive 3.7',
        source_type: 'COMMUNITY_VERIFIED',
        verification_date: '2026-09-30',
        confidence: 'HIGH',
        classification: 'CORE_MECHANIC',
        status: 'ACTIVE'
      }
    ],
    functional_roles: [
      { code: 'MAIN_DPS', label: 'Main DPS' }
    ],
    combat_tags: [
      { code: 'SPECTRO_DMG', label: 'Spectro DMG' }
    ],
    resonators: [
      {
        name: 'TestResonator',
        element: 'Spectro',
        weapon_type: 'Broadblade',
        rarity: 5,
        release_date: '2026-09-30',
        patch_data: {
          base_hp_lvl90: 10000,
          base_atk_lvl90: 400,
          base_def_lvl90: 1000,
          provenance_source_name: 'Official 3.7 Release Notes',
          roles: [{ code: 'MAIN_DPS', is_primary: true }],
          combat_tags: ['SPECTRO_DMG']
        },
        abilities: [
          {
            ability_code: 'A1_NORMAL',
            ability_category: 'NormalAttack',
            name: 'Basic Attack',
            concertos_generated: 10,
            provenance_source_name: 'Official 3.7 Release Notes'
          }
        ]
      }
    ],
    weapons: [
      {
        name: 'TestBroadblade',
        weapon_type: 'Broadblade',
        rarity: 5,
        patch_data: {
          base_atk_lvl90: 587,
          sub_stat_type: 'CRIT_RATE',
          sub_stat_value_lvl90: 24.3,
          provenance_source_name: 'Official 3.7 Release Notes',
          passive_effect: {
            category: 'STAT_BUFF',
            target: 'SELF',
            provenance_source_name: 'Official 3.7 Release Notes',
            detail_expression: {
              stat: 'ATK_PERCENT',
              base_value: 0.12
            }
          }
        }
      }
    ]
  };
}

// ----------------------------------------------------------------------------
// 1. SEQUENCE VALIDATION TESTS
// ----------------------------------------------------------------------------

test('Sequence Validation: Valid S1 through S6 sequence nodes pass validation', () => {
  const validNodes: SequenceNodeInput[] = [
    {
      node_order: 1,
      node_code: 'S1',
      name: 'Sequence Node 1',
      description: 'Increases Forte resonance effect',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    },
    {
      node_order: 6,
      node_code: 'S6',
      name: 'Sequence Node 6',
      description: 'Unlocks peak resonant amplification',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    }
  ];

  const errors = validateSequenceNodes(validNodes, {
    patchVersion: '3.7',
    provenanceNames: new Set(['Verified Resonator Archive 3.7']),
    resonatorName: 'TestResonator'
  });

  assert.strictEqual(errors.length, 0, 'Valid S1 and S6 nodes must have zero validation errors');
});

test('Sequence Validation: Rejects invalid node_order (0, 7, -1, 1.5, null, undefined)', () => {
  const invalidOrders = [0, 7, -1, 1.5, null, undefined, NaN];

  for (const badOrder of invalidOrders) {
    const node = {
      node_order: badOrder,
      node_code: 'S1',
      name: 'Bad Order Node',
      description: 'Testing invalid order',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    };

    const errors = validateSequenceNode(node, {
      patchVersion: '3.7',
      provenanceNames: new Set(['Verified Resonator Archive 3.7'])
    });

    assert.ok(
      errors.some((e) => e.path.includes('node_order') && e.message.includes('Must be an integer between 1 and 6')),
      `Expected node_order validation error for order ${badOrder}`
    );
  }
});

test('Sequence Validation: Rejects invalid node_code and mismatched order/code', () => {
  // Invalid node_code format
  const badCodeNode = {
    node_order: 1,
    node_code: 'X1',
    name: 'Invalid Code Node',
    description: 'Testing bad code',
    provenance_source_name: 'Verified Resonator Archive 3.7'
  };
  const codeErrors = validateSequenceNode(badCodeNode, {
    patchVersion: '3.7',
    provenanceNames: new Set(['Verified Resonator Archive 3.7'])
  });
  assert.ok(
    codeErrors.some((e) => e.path.includes('node_code') && e.message.includes('Must be one of S1')),
    'Must reject invalid node_code format'
  );

  // Mismatched node_order and node_code (e.g. node_order 1 with node_code 'S2')
  const mismatchedNode = {
    node_order: 1,
    node_code: 'S2',
    name: 'Mismatched Node',
    description: 'Testing mismatch',
    provenance_source_name: 'Verified Resonator Archive 3.7'
  };
  const mismatchErrors = validateSequenceNode(mismatchedNode, {
    patchVersion: '3.7',
    provenanceNames: new Set(['Verified Resonator Archive 3.7'])
  });
  assert.ok(
    mismatchErrors.some((e) => e.path.includes('node_code') && e.message.includes('Mismatched node_order 1 and node_code \'S2\'')),
    'Must reject mismatched order and code'
  );
});

test('Sequence Validation: Rejects duplicate node_order and duplicate node_code for same resonator', () => {
  const duplicateOrderNodes: SequenceNodeInput[] = [
    {
      node_order: 2,
      node_code: 'S2',
      name: 'Sequence Node 2A',
      description: 'Desc A',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    },
    {
      node_order: 2,
      node_code: 'S2',
      name: 'Sequence Node 2B',
      description: 'Desc B',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    }
  ];

  const errors = validateSequenceNodes(duplicateOrderNodes, {
    patchVersion: '3.7',
    provenanceNames: new Set(['Verified Resonator Archive 3.7']),
    resonatorName: 'TestResonator'
  });

  assert.ok(
    errors.some((e) => e.message.includes('Duplicate node_order 2')),
    'Must reject duplicate node_order'
  );
  assert.ok(
    errors.some((e) => e.message.includes('Duplicate node_code \'S2\'')),
    'Must reject duplicate node_code'
  );
});

test('Sequence Validation: Rejects missing required values (name, description, resonator identity)', () => {
  // Empty name
  const emptyNameNode = {
    node_order: 1,
    node_code: 'S1',
    name: '   ',
    description: 'Valid description',
    provenance_source_name: 'Verified Resonator Archive 3.7'
  };
  const nameErrors = validateSequenceNode(emptyNameNode);
  assert.ok(nameErrors.some((e) => e.path.includes('name') && e.message.includes('required')));

  // Empty description
  const emptyDescNode = {
    node_order: 1,
    node_code: 'S1',
    name: 'Valid Name',
    description: '',
    provenance_source_name: 'Verified Resonator Archive 3.7'
  };
  const descErrors = validateSequenceNode(emptyDescNode);
  assert.ok(descErrors.some((e) => e.path.includes('description') && e.message.includes('required')));
});

test('Sequence Validation: Rejects missing and fake/placeholder provenance', () => {
  // Missing provenance
  const missingProvNode = {
    node_order: 1,
    node_code: 'S1',
    name: 'Node 1',
    description: 'Desc',
    provenance_source_name: ''
  };
  const missingErrors = validateSequenceNode(missingProvNode);
  assert.ok(missingErrors.some((e) => e.path.includes('provenance_source_name') && e.message.includes('Missing provenance')));

  // Fake / placeholder provenance values
  const fakeValues = ['unknown', 'N/A', 'generated', 'system', 'placeholder', 'none', 'null'];
  for (const fake of fakeValues) {
    const fakeProvNode = {
      node_order: 1,
      node_code: 'S1',
      name: 'Node 1',
      description: 'Desc',
      provenance_source_name: fake
    };
    const fakeErrors = validateSequenceNode(fakeProvNode);
    assert.ok(
      fakeErrors.some((e) => e.message.includes('Forbidden fake/placeholder provenance')),
      `Must reject fake provenance '${fake}'`
    );
  }
});

// ----------------------------------------------------------------------------
// 2. GAMEPLAY EFFECT TAXONOMY & PATCH ISOLATION TESTS
// ----------------------------------------------------------------------------

test('GameplayEffect Validation: Every approved category is accepted in sequence effects', () => {
  const approvedCategories: GameplayEffectCategory[] = [
    'STAT_BUFF',
    'DMG_AMPLIFY',
    'COORDINATED_ATTACK',
    'DEF_SHRED',
    'RES_SHRED',
    'HEALING',
    'SHIELD',
    'SPECIAL_MECHANIC',
    'RESOURCE_GRANT',
    'STATE_CHANGE'
  ];

  for (const cat of approvedCategories) {
    const node: SequenceNodeInput = {
      node_order: 1,
      node_code: 'S1',
      name: 'Category Node',
      description: 'Testing category acceptance',
      provenance_source_name: 'Verified Resonator Archive 3.7',
      effects: [
        {
          category: cat,
          target: 'SELF',
          provenance_source_name: 'Verified Resonator Archive 3.7',
          effect_order: 1
        }
      ]
    };

    const errors = validateSequenceNode(node, {
      patchVersion: '3.7',
      provenanceNames: new Set(['Verified Resonator Archive 3.7'])
    });

    assert.strictEqual(errors.length, 0, `Approved category ${cat} must be accepted`);
  }
});

test('GameplayEffect Validation: Unknown category and invalid target are rejected', () => {
  const badNode: SequenceNodeInput = {
    node_order: 1,
    node_code: 'S1',
    name: 'Bad Category Node',
    description: 'Testing rejection',
    provenance_source_name: 'Verified Resonator Archive 3.7',
    effects: [
      {
        category: 'UNAPPROVED_SUPER_BUFF' as unknown as GameplayEffectCategory,
        target: 'INVALID_TARGET' as unknown as GameplayEffectTarget,
        provenance_source_name: 'Verified Resonator Archive 3.7'
      }
    ]
  };

  const errors = validateSequenceNode(badNode, {
    patchVersion: '3.7',
    provenanceNames: new Set(['Verified Resonator Archive 3.7'])
  });

  assert.ok(errors.some((e) => e.path.includes('category') && e.message.includes('Invalid gameplay effect category')));
  assert.ok(errors.some((e) => e.path.includes('target') && e.message.includes('Invalid gameplay effect target')));
});

test('Patch Isolation: Cross-patch sequence node and effect references are rejected', () => {
  // Cross-patch sequence node (claims patch 3.8 in a 3.7 dataset)
  const crossPatchNode = {
    node_order: 1,
    node_code: 'S1',
    name: 'Cross Patch Node',
    description: 'Belongs to 3.8',
    patch_version: '3.8',
    provenance_source_name: 'Verified Resonator Archive 3.7'
  };

  const nodeErrors = validateSequenceNode(crossPatchNode, {
    patchVersion: '3.7',
    provenanceNames: new Set(['Verified Resonator Archive 3.7'])
  });

  assert.ok(
    nodeErrors.some((e) => e.path.includes('patch_version') && e.message.includes('Cross-patch reference rejected')),
    'Must reject sequence node from different patch'
  );

  // Cross-patch effect inside sequence node
  const crossPatchEffectNode = {
    node_order: 1,
    node_code: 'S1',
    name: 'Node with bad effect',
    description: 'Effect is from 3.8',
    provenance_source_name: 'Verified Resonator Archive 3.7',
    effects: [
      {
        category: 'STAT_BUFF' as const,
        target: 'SELF' as const,
        patch_version: '3.8',
        provenance_source_name: 'Verified Resonator Archive 3.7'
      }
    ]
  };

  const effectErrors = validateSequenceNode(crossPatchEffectNode, {
    patchVersion: '3.7',
    provenanceNames: new Set(['Verified Resonator Archive 3.7'])
  });

  assert.ok(
    effectErrors.some((e) => e.path.includes('patch_version') && e.message.includes('Cross-patch effect reference rejected')),
    'Must reject cross-patch effect inside sequence node'
  );
});

// ----------------------------------------------------------------------------
// 3. WEAPON REFINEMENT CONTRACT & VALIDATION TESTS
// ----------------------------------------------------------------------------

test('Refinement Validation: Valid R1 through R5 explicit ranks are accepted', () => {
  const fullRefinement: RefinementScaling = {
    R1: { atk_percent: 0.12, crit_dmg: 0.24 },
    R2: { atk_percent: 0.15, crit_dmg: 0.30 },
    R3: { atk_percent: 0.18, crit_dmg: 0.36 },
    R4: { atk_percent: 0.21, crit_dmg: 0.42 },
    R5: { atk_percent: 0.24, crit_dmg: 0.48 }
  };

  const errors = validateRefinementScaling(fullRefinement, { weaponName: 'TestBroadblade' });
  assert.strictEqual(errors.length, 0, 'Explicit R1–R5 refinement scaling must validate cleanly');
});

test('Refinement Validation: Single verified rank (e.g. R1 only) is valid without fabricating missing R2–R5', () => {
  const r1Only: RefinementScaling = {
    R1: { resonance_skill_dmg_bonus: 0.20 }
  };

  const errors = validateRefinementScaling(r1Only, { weaponName: 'TestBroadblade' });
  assert.strictEqual(errors.length, 0, 'R1-only verified scaling must be completely valid');

  // Verify that system does NOT mutate or fabricate R2..R5 into the object
  assert.strictEqual(r1Only.R2, undefined, 'Must not fabricate R2');
  assert.strictEqual(r1Only.R3, undefined, 'Must not fabricate R3');
  assert.strictEqual(r1Only.R4, undefined, 'Must not fabricate R4');
  assert.strictEqual(r1Only.R5, undefined, 'Must not fabricate R5');
});

test('Refinement Validation: Rejects invalid ranks (R0, R6, R-1, R1.5, arbitrary strings)', () => {
  const badRanks = ['R0', 'R6', 'R-1', 'R1.5', 'refinement_1', 'R7'];

  for (const rank of badRanks) {
    const badScaling = {
      [rank]: { bonus: 0.10 }
    };

    const errors = validateRefinementScaling(badScaling, { weaponName: 'TestWeapon' });
    assert.ok(
      errors.some((e) => e.path.includes(rank) && e.message.includes('Invalid refinement rank')),
      `Expected rejection for invalid rank '${rank}'`
    );
  }
});

test('Refinement Validation: Rejects empty scaling object and non-object rank values', () => {
  // Empty object claiming numerical scaling
  const emptyErrors = validateRefinementScaling({}, { weaponName: 'TestWeapon' });
  assert.ok(
    emptyErrors.some((e) => e.message.includes('claims numerical scaling but contains no rank definitions')),
    'Must reject empty refinement scaling object'
  );

  // Empty rank definition
  const emptyRank = {
    R1: {}
  };
  const emptyRankErrors = validateRefinementScaling(emptyRank, { weaponName: 'TestWeapon' });
  assert.ok(
    emptyRankErrors.some((e) => e.path.includes('R1') && e.message.includes('cannot be empty')),
    'Must reject empty rank map'
  );

  // Non-object rank value
  const nonObjectRank = {
    R1: 0.12 as unknown as Record<string, unknown>
  };
  const nonObjErrors = validateRefinementScaling(nonObjectRank, { weaponName: 'TestWeapon' });
  assert.ok(
    nonObjErrors.some((e) => e.path.includes('R1') && e.message.includes('must be a non-null object')),
    'Must reject scalar rank value'
  );
});

test('Refinement Validation: Rejects synthetic multipliers, formula expressions, and inferred/derived flags', () => {
  // 1. Inferred / derived flags
  const derivedPayload = {
    R1: { atk_buff: 0.12 },
    R2: { atk_buff: 0.15, inferred: true }
  };
  const derivedErrors = validateRefinementScaling(derivedPayload, { weaponName: 'TestWeapon' });
  assert.ok(
    derivedErrors.some((e) => e.path.includes('inferred') && e.message.includes('forbidden \'inferred\' flag')),
    'Must reject payload containing inferred: true'
  );

  // 2. Synthetic multiplier param
  const multiplierPayload = {
    R1: { multiplier: 1.0 },
    R2: { multiplier: 1.2 }
  };
  const multErrors = validateRefinementScaling(multiplierPayload, { weaponName: 'TestWeapon' });
  assert.ok(
    multErrors.some((e) => e.message.includes('forbidden synthetic multiplier')),
    'Must reject synthetic multiplier key'
  );

  // 3. Formula string expression (e.g. "${R1} * 1.25")
  const formulaPayload = {
    R1: { buff: '0.12' },
    R2: { buff: '${R1} * 1.2' }
  };
  const formulaErrors = validateRefinementScaling(formulaPayload, { weaponName: 'TestWeapon' });
  assert.ok(
    formulaErrors.some((e) => e.message.includes('unverified formula expression')),
    'Must reject formula expression in place of concrete numbers'
  );
});

test('Refinement Validation: Rejects conflicting refinement definitions between patch_data and passive_effect', () => {
  const dataset = createBaseDataset();
  dataset.weapons![0].patch_data.refinement_scaling = {
    R1: { atk_bonus: 0.12 }
  };
  dataset.weapons![0].patch_data.passive_effect!.detail_expression = {
    refinement_scaling: {
      R1: { atk_bonus: 0.16 } // Conflict!
    }
  };

  const result = validatePatchDataset(dataset);
  assert.strictEqual(result.isValid, false, 'Conflicting refinement scaling definitions must fail');
  assert.ok(
    result.errors.some((e) => e.message.includes('Conflicting refinement_scaling definitions')),
    'Must report conflicting refinement definitions error'
  );
});

// ----------------------------------------------------------------------------
// 4. PARTIAL DATA HANDLING TESTS
// ----------------------------------------------------------------------------

test('Partial Data: Resonator with sequence_nodes undefined remains 100% valid', () => {
  const dataset = createBaseDataset();
  assert.strictEqual(dataset.resonators[0].sequence_nodes, undefined);

  const result = validatePatchDataset(dataset);
  assert.strictEqual(result.isValid, true, 'Dataset with sequence_nodes: undefined must be 100% valid');
  assert.strictEqual(result.errors.length, 0);
});

test('Partial Data: Resonator with partial sequence nodes (e.g. S1 and S2 only) does not fabricate missing S3–S6', () => {
  const dataset = createBaseDataset();
  dataset.resonators[0].sequence_nodes = [
    {
      node_order: 1,
      node_code: 'S1',
      name: 'Verified S1 Talent',
      description: 'Documented S1 mechanic',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    },
    {
      node_order: 2,
      node_code: 'S2',
      name: 'Verified S2 Talent',
      description: 'Documented S2 mechanic',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    }
  ];

  const result = validatePatchDataset(dataset);
  assert.strictEqual(result.isValid, true, 'Partial sequence node roster must validate cleanly');
  assert.strictEqual(dataset.resonators[0].sequence_nodes.length, 2, 'Roster must remain exactly 2 nodes');
});

// ----------------------------------------------------------------------------
// 5. DETERMINISTIC INGESTION & IDEMPOTENCY TESTS
// ----------------------------------------------------------------------------

function createInMemorySupabaseClient() {
  const tableData = new Map<string, Map<string, Record<string, unknown>>>();

  function getTableMap(name: string) {
    if (!tableData.has(name)) {
      tableData.set(name, new Map());
    }
    return tableData.get(name)!;
  }

  function computeConflictKey(tableName: string, row: Record<string, unknown>, onConflict?: string): string {
    if (onConflict) {
      const keys = onConflict.split(',').map((k) => k.trim());
      return `${tableName}::` + keys.map((k) => String(row[k])).join('::');
    }
    return `${tableName}::` + String(row.id ?? Math.random());
  }

  const client = {
    from: (tableName: string) => {
      let currentResult: unknown = null;
      const currentError: unknown = null;

      const builder = {
        upsert: (payload: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) => {
          const map = getTableMap(tableName);
          const items = Array.isArray(payload) ? payload : [payload];
          const rows: Record<string, unknown>[] = [];

          for (const item of items) {
            const row = { ...item };
            const key = computeConflictKey(tableName, row, opts?.onConflict);
            const existing = map.get(key);
            if (existing) {
              row.id = existing.id;
            } else if (!row.id) {
              row.id = deterministicUuid(`${tableName}:${key}`);
            }
            map.set(key, row);
            rows.push(row);
          }

          currentResult = Array.isArray(payload) ? rows : rows[0];
          return builder;
        },
        select: (_cols?: string) => builder,
        single: () => {
          return Promise.resolve({
            data: currentResult,
            error: currentError
          });
        },
        then: <TResult1 = unknown, TResult2 = never>(
          resolve?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
          reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) => {
          return Promise.resolve({ data: currentResult, error: currentError }).then(resolve, reject);
        }
      };
      return builder;
    }
  } as unknown as SupabaseClient;

  return { tableData, client };
}

test('Deterministic Ingestion: Repeated execution is 100% idempotent and creates zero duplicates', async () => {
  const { tableData, client } = createInMemorySupabaseClient();

  const dataset = createBaseDataset();
  dataset.resonators[0].sequence_nodes = [
    {
      node_order: 1,
      node_code: 'S1',
      name: 'Deterministic S1',
      description: 'S1 talent description',
      provenance_source_name: 'Verified Resonator Archive 3.7',
      effects: [
        {
          category: 'STAT_BUFF',
          target: 'SELF',
          provenance_source_name: 'Verified Resonator Archive 3.7',
          detail_expression: { buff: 'ATK_PERCENT', value: 0.10 },
          effect_order: 1
        }
      ]
    },
    {
      node_order: 2,
      node_code: 'S2',
      name: 'Deterministic S2',
      description: 'S2 talent description',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    }
  ];

  dataset.weapons![0].patch_data.refinement_scaling = {
    R1: { atk_percent: 0.12 },
    R2: { atk_percent: 0.15 }
  };

  // Run 1: Initial Ingestion
  const report1 = await ingestPatchDataset(dataset, client);
  assert.strictEqual(report1.success, true);
  assert.strictEqual(report1.counts.resonatorSequences, 2);
  assert.strictEqual(report1.counts.resonatorSequencePatchData, 2);
  assert.strictEqual(report1.counts.resonatorSequenceEffects, 1);

  const initialSeqCount = tableData.get('resonator_sequences')!.size;
  const initialSeqPatchCount = tableData.get('resonator_sequence_patch_data')!.size;
  const initialSeqEffCount = tableData.get('resonator_sequence_effects')!.size;
  const initialGameplayEffCount = tableData.get('gameplay_effects')!.size;

  assert.strictEqual(initialSeqCount, 2);
  assert.strictEqual(initialSeqPatchCount, 2);
  assert.strictEqual(initialSeqEffCount, 1);

  // Run 2: Exact duplicate ingestion
  const report2 = await ingestPatchDataset(dataset, client);
  assert.strictEqual(report2.success, true);

  // Assert row count in tables did not duplicate
  const secondSeqCount = tableData.get('resonator_sequences')!.size;
  const secondSeqPatchCount = tableData.get('resonator_sequence_patch_data')!.size;
  const secondSeqEffCount = tableData.get('resonator_sequence_effects')!.size;
  const secondGameplayEffCount = tableData.get('gameplay_effects')!.size;

  assert.strictEqual(secondSeqCount, initialSeqCount, 'resonator_sequences count must remain identical');
  assert.strictEqual(secondSeqPatchCount, initialSeqPatchCount, 'resonator_sequence_patch_data count must remain identical');
  assert.strictEqual(secondSeqEffCount, initialSeqEffCount, 'resonator_sequence_effects count must remain identical');
  assert.strictEqual(secondGameplayEffCount, initialGameplayEffCount, 'gameplay_effects count must remain identical');

  // Verify deterministic IDs
  const s1ExpectedId = deterministicUuid('resonator_sequence:TestResonator:1');
  const s1Row = Array.from(tableData.get('resonator_sequences')!.values()).find((r) => r.node_order === 1);
  assert.strictEqual(s1Row?.id, s1ExpectedId, 'Sequence ID must match deterministic SHA256 v4 UUID');

  // Verify weapon passive effect merged refinement_scaling into detail_expression
  const weaponEffect = Array.from(tableData.get('gameplay_effects')!.values()).find(
    (e) => (e.detail_expression as Record<string, unknown>)?.refinement_scaling !== undefined
  );
  assert.ok(weaponEffect, 'Weapon passive effect must store refinement_scaling in detail_expression');
  const refScaling = (weaponEffect.detail_expression as Record<string, unknown>).refinement_scaling as RefinementScaling;
  assert.deepStrictEqual(refScaling.R1, { atk_percent: 0.12 });
  assert.deepStrictEqual(refScaling.R2, { atk_percent: 0.15 });
  assert.strictEqual(refScaling.R3, undefined, 'Must not interpolate or fabricate R3');
});

test('Sequence Validation: Rejects missing resonator identity in dataset', () => {
  const dataset = createBaseDataset();
  dataset.resonators[0].name = '';
  dataset.resonators[0].sequence_nodes = [
    {
      node_order: 1,
      node_code: 'S1',
      name: 'S1 with nameless resonator',
      description: 'Test description',
      provenance_source_name: 'Verified Resonator Archive 3.7'
    }
  ];

  const result = validatePatchDataset(dataset);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some((e) => e.path.includes('name') && e.message.includes('Resonator name is required')));
});

test('Provenance: Attempt to ingest a Sequence node without provenance is rejected', async () => {
  const { client } = createInMemorySupabaseClient();
  const dataset = createBaseDataset();
  dataset.resonators[0].sequence_nodes = [
    {
      node_order: 1,
      node_code: 'S1',
      name: 'Unprovenanced S1',
      description: 'Test description',
      provenance_source_name: '' // Missing provenance
    }
  ];

  await assert.rejects(
    async () => {
      await ingestPatchDataset(dataset, client);
    },
    /provenance/i,
    'Ingestion must reject sequence node with missing provenance'
  );
});

test('Patch Isolation: Attempting cross-patch Sequence -> GameplayEffect association is rejected at ingestion boundary', async () => {
  const { client } = createInMemorySupabaseClient();
  const dataset = createBaseDataset();
  dataset.resonators[0].sequence_nodes = [
    {
      node_order: 1,
      node_code: 'S1',
      name: 'Cross-patch S1',
      description: 'Test description',
      provenance_source_name: 'Verified Resonator Archive 3.7',
      effects: [
        {
          category: 'STAT_BUFF',
          target: 'SELF',
          provenance_source_name: 'Verified Resonator Archive 3.7',
          detail_expression: { buff: 'ATK_PERCENT', value: 0.10 },
          effect_order: 1,
          // Explicit cross-patch violation: belongs to patch 3.8 while dataset is 3.7
          ...({ patch_version: '3.8' } as Record<string, unknown>)
        }
      ]
    }
  ];

  await assert.rejects(
    async () => {
      await ingestPatchDataset(dataset, client);
    },
    /Cross-patch/i,
    'Ingestion must reject sequence node referencing cross-patch gameplay effect'
  );
});

