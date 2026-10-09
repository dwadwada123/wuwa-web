/**
 * Wuthering Waves Deterministic Tower of Adversity Allocation Contract Test Suite
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Exhaustively tests contract identity, strict input validation, Vigor stamina accounting,
 * elemental buff matching, exact branch-and-bound optimization, independent audit verification,
 * twenty-run determinism, and production catalog integration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  TOA_ALLOCATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  REQUIRED_STEP22_RULE_VERSION,
  RESONATOR_STARTING_VIGOR,
  MAX_RESONATOR_VIGOR,
  MIN_STAGE_VIGOR_COST,
  MAX_STAGE_VIGOR_COST,
  CANONICAL_STAGE_COUNT,
  PROHIBITED_TOA_ALLOCATION_KEYS
} from '../lib/engine/toa-allocation/rules.ts';

import {
  allocateToAStages,
  getCanonicalSeason40Stages,
  getDefaultToAAllocationResult,
  clearToAAllocationCache,
  auditSingleToAAllocation,
  runProductionToAAllocationAudit,
  formatToAAllocationExplanation,
  canTeamAffordStage,
  calculateBuffMatches,
  compareObjectiveTuples,
  deriveToAAllocationId,
  assertNoProhibitedToAAllocationKeys,
  solveToAAllocation,
  validateSeason40DatasetConsistency,
  type ToAStageDefinition,
  type ToAAreaEffect,
  type TeamBuildEvaluation,
  type ToAAllocationInput,
  type ToAAllocationObjectiveTuple
} from '../lib/engine/toa-allocation/index.ts';

import {
  CANONICAL_RESONATOR_METADATA
} from '../lib/engine/character-build-evaluation/rules.ts';

// Helper to construct mock TeamBuildEvaluation with specified elements
function createMockTeamBuild(
  memberA: string,
  memberB: string,
  memberC: string,
  overrides?: {
    status?: TeamBuildEvaluation['status'];
    elements?: [string, string, string];
    knownAspects?: number;
    hasIncompatibleWeapon?: boolean;
  }
): TeamBuildEvaluation {
  const sorted = [memberA, memberB, memberC].sort((a, b) => a.localeCompare(b));
  const id = `team-build:3.7:${sorted.join(':')}:7.21.1`;
  const teamCandidateId = `team-composition:3.7:${sorted.join(':')}:7.9.1`;
  const status = overrides?.status ?? 'FULLY_EQUIPPED';
  const knownAspects = overrides?.knownAspects ?? 18;
  const hasIncompatible = overrides?.hasIncompatibleWeapon ?? false;

  const defaultElements: [string, string, string] = [
    CANONICAL_RESONATOR_METADATA[sorted[0]]?.element ?? 'Aero',
    CANONICAL_RESONATOR_METADATA[sorted[1]]?.element ?? 'Fusion',
    CANONICAL_RESONATOR_METADATA[sorted[2]]?.element ?? 'Electro'
  ];
  const elements = overrides?.elements ?? defaultElements;

  function makeMember(name: string, elem: string, idx: number) {
    return {
      id: `char-build:3.7:${name}:7.20.1`,
      patchVersion: '3.7' as const,
      ruleVersion: '7.20.1' as const,
      resonatorId: name,
      element: elem as any,
      rarity: 5 as const,
      weaponType: 'Sword' as const,
      status: 'FULLY_EQUIPPED' as const,
      weaponEvaluation: {
        weaponId: 'weapon_sword_1',
        weaponType: 'Sword' as const,
        isEquipped: true,
        weaponLevel: 90,
        refinementRank: 1,
        compatibility: hasIncompatible ? 'INCOMPATIBLE' as const : 'COMPATIBLE' as const,
        status: hasIncompatible ? 'INCOMPATIBLE_WEAPON' as const : 'FULLY_EQUIPPED' as const
      },
      echoEvaluation: {
        hasLoadout: true,
        equippedCount: 5,
        tunedCount: 5,
        activeSonataSetName: 'Sierra Gale',
        sonataAlignment: 'ELEMENT_ALIGNED' as const,
        status: 'FULLY_EQUIPPED' as const
      },
      completeness: {
        totalAspects: 6,
        knownAspects: Math.floor(knownAspects / 3),
        unknownAspects: 6 - Math.floor(knownAspects / 3),
        completenessRatio: Math.floor(knownAspects / 3) / 6,
        aspectStates: {} as any
      },
      explanationCodes: ['STATUS_FULLY_EQUIPPED'],
      provenance: {
        source: 'DERIVED_CHARACTER_BUILD_EVALUATION' as const,
        patchVersion: '3.7' as const,
        ruleVersion: '7.20.1' as const,
        resonatorId: name,
        upstreamDecisionContextRuleVersion: '7.19.1' as const,
        upstreamSnapshotRuleVersion: '7.13.1' as const
      }
    };
  }

  return Object.freeze({
    id,
    patchVersion: '3.7' as const,
    ruleVersion: '7.21.1' as const,
    teamCandidateId,
    memberResonatorIds: Object.freeze(sorted) as unknown as readonly [string, string, string],
    status,
    memberBuildEvaluations: Object.freeze([
      makeMember(sorted[0], elements[0], 0),
      makeMember(sorted[1], elements[1], 1),
      makeMember(sorted[2], elements[2], 2)
    ]) as any,
    weaponAggregation: Object.freeze({
      compatibleCount: hasIncompatible ? 2 : 3,
      incompatibleCount: hasIncompatible ? 1 : 0,
      unequippedCount: 0,
      unknownCount: 0,
      allCompatible: !hasIncompatible,
      hasIncompatibleWeapon: hasIncompatible
    }),
    echoAggregation: Object.freeze({
      equippedCount: 3,
      elementAlignedSonataCount: 3,
      universalSonataCount: 0,
      misalignedSonataCount: 0,
      unequippedSonataCount: 0,
      unknownSonataCount: 0
    }),
    sonataInteraction: Object.freeze({
      memberSonataCodes: ['SIERRA_GALE', 'MOLTEN_RIFT', 'FREEZING_FROST'] as const,
      distinctActiveSonataCodes: ['SIERRA_GALE', 'MOLTEN_RIFT', 'FREEZING_FROST'],
      hasDuplicateSonataSets: false,
      duplicateSonataCodes: [],
      stackingStatus: 'UNMODELED' as const,
      interactionStatus: 'EVALUATED' as const
    }),
    completeness: Object.freeze({
      totalTeamAspects: 18,
      knownTeamAspects: knownAspects,
      unknownTeamAspects: 18 - knownAspects,
      teamCompletenessRatio: knownAspects / 18,
      memberCompletenessRatios: [1.0, 1.0, 1.0] as const
    }),
    explanationCodes: ['TEAM_FULLY_EQUIPPED'],
    provenance: Object.freeze({
      source: 'DERIVED_TEAM_BUILD_EVALUATION' as const,
      patchVersion: '3.7' as const,
      ruleVersion: '7.21.1' as const,
      teamCandidateId,
      memberBuildEvaluationIds: [
        `char-build:3.7:${sorted[0]}:7.20.1`,
        `char-build:3.7:${sorted[1]}:7.20.1`,
        `char-build:3.7:${sorted[2]}:7.20.1`
      ] as const,
      upstreamBuildEvaluationRuleVersion: '7.20.1' as const,
      upstreamTeamCandidateRuleVersion: '7.9.1' as const
    })
  });
}

// Helper to construct a mock ToAStageDefinition
function createMockStage(
  stageId: string,
  vigorCost: number,
  globalStageOrder: number,
  beneficialElements: string[] = ['Aero']
): ToAStageDefinition {
  return Object.freeze({
    stageId,
    patchVersion: '3.7' as const,
    seasonId: 'season:40',
    towerId: 'mock-tower',
    towerName: 'Mock Tower',
    towerOrder: 1,
    stageIndex: globalStageOrder,
    globalStageOrder,
    vigorCost,
    difficulty: 3,
    areaEffects: Object.freeze([]),
    beneficialElements: Object.freeze(beneficialElements),
    enemyCodes: Object.freeze(['MOCK_ENEMY'])
  });
}

// ==========================================
// TEST SUITE
// ==========================================

test('1. Contract Identity, Patch Isolation, and Rule Versions', () => {
  assert.strictEqual(TOA_ALLOCATION_RULE_VERSION, '7.23.1');
  assert.strictEqual(CANONICAL_PATCH_VERSION, '3.7');
  assert.strictEqual(CANONICAL_SEASON_ID, 'season:40');
  assert.strictEqual(REQUIRED_STEP22_RULE_VERSION, '7.22.1');
  assert.strictEqual(RESONATOR_STARTING_VIGOR, 10);
  assert.strictEqual(MAX_RESONATOR_VIGOR, 10);
  assert.strictEqual(MIN_STAGE_VIGOR_COST, 1);
  assert.strictEqual(MAX_STAGE_VIGOR_COST, 5);
  assert.strictEqual(CANONICAL_STAGE_COUNT, 12);

  // Reject invalid patchId
  assert.throws(
    () => allocateToAStages({ patchId: '3.6' as any }),
    /Invalid patchId/
  );
  assert.throws(
    () => allocateToAStages({ patchId: '' as any }),
    /Invalid patchId/
  );

  // Reject invalid ruleVersion
  assert.throws(
    () => allocateToAStages({ ruleVersion: '7.22.1' as any }),
    /Invalid ruleVersion/
  );

  // Reject mismatched seasonId
  assert.throws(
    () => allocateToAStages({ seasonId: 'season:39' as any }),
    /Invalid seasonId/
  );
});

test('2. Strict Input Validation and Fail-Closed Behavior', () => {
  // Non-canonical Resonator ID in owned roster
  assert.throws(
    () => allocateToAStages({ ownedRoster: ['fake_resonator_999'] }),
    /Non-canonical Resonator ID/
  );

  // Duplicate Resonator ID in owned roster
  assert.throws(
    () => allocateToAStages({ ownedRoster: ['Jiyan', 'Jiyan'] }),
    /Duplicate Resonator ID/
  );

  // Empty string in owned roster
  assert.throws(
    () => allocateToAStages({ ownedRoster: [''] }),
    /Owned roster contains invalid or empty Resonator ID/
  );

  // Duplicate stage ID in targetStageIds
  assert.throws(
    () =>
      allocateToAStages({
        targetStageIds: ['toa-resonant-floor-1', 'toa-resonant-floor-1']
      }),
    /Duplicate target stage ID/
  );

  // Non-existent target stage ID
  assert.throws(
    () =>
      allocateToAStages({
        targetStageIds: ['non_existent_stage_999']
      }),
    /Requested target stage ID 'non_existent_stage_999' not found/
  );

  // Stage definition with invalid vigor cost (< 1 or > 5)
  const badStage1 = createMockStage('bad-stage-0', 0, 1);
  assert.throws(
    () => allocateToAStages({ stageCatalog: [badStage1] }),
    /invalid vigorCost 0/
  );

  const badStage6 = createMockStage('bad-stage-6', 6, 1);
  assert.throws(
    () => allocateToAStages({ stageCatalog: [badStage6] }),
    /invalid vigorCost 6/
  );

  // Duplicate stage ID in stageCatalog
  const stageA = createMockStage('stage-dup', 2, 1);
  assert.throws(
    () => allocateToAStages({ stageCatalog: [stageA, stageA] }),
    /Duplicate stage identifier 'stage-dup'/
  );

  // Candidate team with bad patch or rule version
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const badPatchTeam = { ...t1, patchVersion: '3.6' } as any;
  assert.throws(
    () => allocateToAStages({ candidateTeams: [badPatchTeam] }),
    /invalid patchVersion/
  );

  const badRuleTeam = { ...t1, ruleVersion: '7.20.1' } as any;
  assert.throws(
    () => allocateToAStages({ candidateTeams: [badRuleTeam] }),
    /invalid ruleVersion/
  );

  // Duplicate candidate team IDs
  assert.throws(
    () => allocateToAStages({ candidateTeams: [t1, t1] }),
    /Duplicate TeamBuildEvaluation ID/
  );
});

test('3. Character Ownership Invariant', () => {
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const t2 = createMockTeamBuild('Baizhi', 'Sanhua', 'Yangyang');

  // Owned roster contains only t1 members (Jiyan, Mortefi, Verina), but not t2
  const s1 = createMockStage('st-1', 4, 1);

  const res = allocateToAStages({
    stageCatalog: [s1],
    targetStageIds: ['st-1'],
    candidateTeams: [t1, t2],
    ownedRoster: ['Jiyan', 'Mortefi', 'Verina'] // t2 is excluded by roster
  });

  assert.strictEqual(res.allocation.status, 'OPTIMAL_ALLOCATION');
  assert.strictEqual(res.allocation.assignments[0].team?.id, t1.id);

  // If owned roster excludes all candidates
  const resEmpty = allocateToAStages({
    stageCatalog: [s1],
    targetStageIds: ['st-1'],
    candidateTeams: [t1],
    ownedRoster: ['Chixia', 'Danjin', 'Calcharo'] // none of t1's members
  });

  assert.strictEqual(resEmpty.allocation.status, 'INFEASIBLE_ALLOCATION');
  assert.strictEqual(resEmpty.allocation.assignments.length, 0);
});

test('4. Resonator Vigor Bounds & Overdraft Prevention', () => {
  // Test canTeamAffordStage directly
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const s4 = createMockStage('st-4', 4, 1);
  const s5 = createMockStage('st-5', 5, 2);

  const usedMap = new Map<string, number>();
  // Initial: 0 used. Can afford 4 vigor
  assert.strictEqual(canTeamAffordStage(t1, s4, usedMap), true);

  // After 4 vigor used:
  usedMap.set('Jiyan', 4);
  usedMap.set('Mortefi', 4);
  usedMap.set('Verina', 4);
  assert.strictEqual(canTeamAffordStage(t1, s5, usedMap), true); // 4 + 5 = 9 <= 10

  // After 9 vigor used:
  usedMap.set('Jiyan', 9);
  usedMap.set('Mortefi', 9);
  usedMap.set('Verina', 9);
  assert.strictEqual(canTeamAffordStage(t1, s4, usedMap), false); // 9 + 4 = 13 > 10 (overdraft rejected!)

  // Exactly 10 Vigor consumed (e.g. 9 + 1 = 10)
  const s1 = createMockStage('st-1', 1, 3);
  assert.strictEqual(canTeamAffordStage(t1, s1, usedMap), true); // 9 + 1 = 10 <= 10 (valid!)

  // Exactly 10 used -> cannot afford even 1 more
  usedMap.set('Jiyan', 10);
  assert.strictEqual(canTeamAffordStage(t1, s1, usedMap), false); // 10 + 1 = 11 > 10 (rejected!)
});

test('5. Multi-Stage Team Reuse within 10 Vigor Budget', () => {
  // Team 1 assigns to 4 stages with vigor costs [1, 2, 3, 4] -> sum = 10 vigor!
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const stages = [
    createMockStage('stage-1', 1, 1),
    createMockStage('stage-2', 2, 2),
    createMockStage('stage-3', 3, 3),
    createMockStage('stage-4', 4, 4)
  ];

  const res = allocateToAStages({
    stageCatalog: stages,
    candidateTeams: [t1]
  });

  assert.strictEqual(res.allocation.status, 'OPTIMAL_ALLOCATION');
  assert.strictEqual(res.allocation.completeness.assignedStageCount, 4);
  assert.strictEqual(res.allocation.completeness.totalVigorConsumed, 30); // 10 vigor * 3 members

  // Verify all 4 assignments use team 1
  for (const a of res.allocation.assignments) {
    assert.strictEqual(a.isAssigned, true);
    assert.strictEqual(a.team?.id, t1.id);
  }

  // Verify per-character vigor accounting: exactly 10/10 consumed, 0 remaining
  for (const va of res.allocation.vigorAccounting) {
    assert.strictEqual(va.vigorConsumed, 10);
    assert.strictEqual(va.vigorRemaining, 0);
    assert.strictEqual(va.assignedStageCount, 4);
  }
});

test('6. Over-budget 5th Stage Triggers Infeasibility without Overdraft', () => {
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const stages = [
    createMockStage('stage-1', 1, 1),
    createMockStage('stage-2', 2, 2),
    createMockStage('stage-3', 3, 3),
    createMockStage('stage-4', 4, 4),
    createMockStage('stage-5', 1, 5) // Total vigor = 11 > 10
  ];

  // When allowPartial is false (default)
  const res = allocateToAStages({
    stageCatalog: stages,
    candidateTeams: [t1],
    allowPartial: false
  });

  assert.strictEqual(res.allocation.status, 'INFEASIBLE_ALLOCATION');
  assert.strictEqual(res.allocation.completeness.assignedStageCount, 0);
  assert.ok(res.allocation.infeasibilityReasons);

  // When allowPartial is true
  const resPartial = allocateToAStages({
    stageCatalog: stages,
    candidateTeams: [t1],
    allowPartial: true
  });

  assert.strictEqual(resPartial.allocation.status, 'PARTIAL_ALLOCATION');
  assert.strictEqual(resPartial.allocation.completeness.assignedStageCount, 4);
  assert.strictEqual(resPartial.allocation.completeness.unassignedStageCount, 1);
  assert.strictEqual(
    resPartial.allocation.vigorAccounting.find((v) => v.resonatorId === 'Jiyan')?.vigorConsumed,
    10
  );
});

test('7. Stage-Buff Elemental Matching Rewards Alignment', () => {
  // Aero-buffed stage
  const sAero = createMockStage('st-aero', 3, 1, ['Aero']);

  // Team 1: 3 Aero members
  const tAero = createMockTeamBuild('Jiyan', 'Yangyang', 'Aalto', {
    elements: ['Aero', 'Aero', 'Aero']
  });

  // Team 2: 0 Aero members
  const tNonAero = createMockTeamBuild('Chixia', 'Mortefi', 'Danjin', {
    elements: ['Fusion', 'Fusion', 'Havoc']
  });

  const res = allocateToAStages({
    stageCatalog: [sAero],
    candidateTeams: [tAero, tNonAero]
  });

  assert.strictEqual(res.allocation.status, 'OPTIMAL_ALLOCATION');
  assert.strictEqual(res.allocation.assignments[0].team?.id, tAero.id);
  assert.strictEqual(res.allocation.assignments[0].buffMatchedMemberCount, 3);
  assert.strictEqual(res.allocation.objectiveTuple.beneficialBuffMatches, 3);
});

test('8. Weapon Incompatibility Penalization under Lexicographic Tuple', () => {
  const s1 = createMockStage('st-1', 4, 1, []);

  // Team Compatible: fully compatible
  const tComp = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina', {
    hasIncompatibleWeapon: false,
    status: 'FULLY_EQUIPPED'
  });

  // Team Incompatible: incompatible weapon
  const tIncomp = createMockTeamBuild('Baizhi', 'Sanhua', 'Yangyang', {
    hasIncompatibleWeapon: true,
    status: 'INCOMPATIBLE_WEAPON'
  });

  // Both can afford the stage; solver must prefer compatible team
  const res = allocateToAStages({
    stageCatalog: [s1],
    candidateTeams: [tIncomp, tComp] // order permuted
  });

  assert.strictEqual(res.allocation.assignments[0].team?.id, tComp.id);
  assert.strictEqual(res.allocation.objectiveTuple.incompatibleWeaponAssignments, 0);
});

test('9. Exact Combinatorial Optimization Outperforms Greedy Choice', () => {
  // Classic counter-example for greedy search:
  // Stage 1: cost 5, buff = ['Aero']
  // Stage 2: cost 5, buff = ['Aero']
  // Stage 3: cost 5, buff = ['Fusion']
  // Stage 4: cost 5, buff = ['Fusion']
  // Total cost = 20 vigor.
  // Two teams available:
  // Team A (Aero): [Aero, Aero, Aero] (10 vigor capacity)
  // Team B (Fusion): [Fusion, Fusion, Fusion] (10 vigor capacity)
  // A greedy search might assign Team A to Stage 1 and Stage 3 (wasting Aero potential on Fusion stage).
  // The exact global optimizer assigns Team A to Stages 1 & 2 (3 + 3 = 6 Aero matches)
  // and Team B to Stages 3 & 4 (3 + 3 = 6 Fusion matches) -> total 12 matches!

  const s1 = createMockStage('st-1', 5, 1, ['Aero']);
  const s2 = createMockStage('st-2', 5, 2, ['Aero']);
  const s3 = createMockStage('st-3', 5, 3, ['Fusion']);
  const s4 = createMockStage('st-4', 5, 4, ['Fusion']);

  const tAero = createMockTeamBuild('Jiyan', 'Yangyang', 'Aalto', {
    elements: ['Aero', 'Aero', 'Aero']
  });
  const tFusion = createMockTeamBuild('Chixia', 'Mortefi', 'Changli', {
    elements: ['Fusion', 'Fusion', 'Fusion']
  });

  const res = allocateToAStages({
    stageCatalog: [s1, s2, s3, s4],
    candidateTeams: [tAero, tFusion]
  });

  assert.strictEqual(res.allocation.status, 'OPTIMAL_ALLOCATION');
  assert.strictEqual(res.allocation.completeness.assignedStageCount, 4);
  assert.strictEqual(res.allocation.objectiveTuple.beneficialBuffMatches, 12);

  // Stage 1 & 2 assigned to tAero
  assert.strictEqual(res.allocation.assignments[0].team?.id, tAero.id);
  assert.strictEqual(res.allocation.assignments[1].team?.id, tAero.id);
  // Stage 3 & 4 assigned to tFusion
  assert.strictEqual(res.allocation.assignments[2].team?.id, tFusion.id);
  assert.strictEqual(res.allocation.assignments[3].team?.id, tFusion.id);
});

test('10. Independent Combinatorial Brute-Force Oracle Comparison', () => {
  // Independent reference brute-force implementation
  function bruteForceSolve(
    stages: readonly ToAStageDefinition[],
    teams: readonly TeamBuildEvaluation[]
  ): { bestObj: ToAAllocationObjectiveTuple; bestAssignments: (string | null)[] } {
    let bestObj: ToAAllocationObjectiveTuple | null = null;
    let bestAssignments: (string | null)[] = [];

    const numStages = stages.length;
    const numTeams = teams.length;

    // Explore (numTeams + 1)^numStages combinations
    function generate(stageIdx: number, curAssignments: (TeamBuildEvaluation | null)[]) {
      if (stageIdx === numStages) {
        // Check Vigor feasibility
        const usedMap = new Map<string, number>();
        for (let i = 0; i < numStages; i++) {
          const t = curAssignments[i];
          if (t) {
            const cost = stages[i].vigorCost;
            for (const m of t.memberResonatorIds) {
              const u = (usedMap.get(m) ?? 0) + cost;
              if (u > MAX_RESONATOR_VIGOR) return; // Infeasible
              usedMap.set(m, u);
            }
          }
        }

        // Compute objective
        let completed = 0;
        let buffMatches = 0;
        let incomp = 0;
        let fully = 0;
        let known = 0;
        const keyPairs: { stageId: string; teamId: string | null }[] = [];

        for (let i = 0; i < numStages; i++) {
          const t = curAssignments[i];
          const st = stages[i];
          if (t) {
            completed++;
            buffMatches += calculateBuffMatches(t, st).count;
            if (t.weaponAggregation.hasIncompatibleWeapon) incomp++;
            if (t.status === 'FULLY_EQUIPPED') fully++;
            known += t.completeness.knownTeamAspects;
            keyPairs.push({ stageId: st.stageId, teamId: t.id });
          } else {
            keyPairs.push({ stageId: st.stageId, teamId: null });
          }
        }

        const obj: ToAAllocationObjectiveTuple = {
          stagesCompleted: completed,
          beneficialBuffMatches: buffMatches,
          incompatibleWeaponAssignments: incomp,
          fullyEquippedAssignments: fully,
          totalKnownAspects: known,
          totalSynergyPairs: 0,
          totalDirectionalEdges: 0,
          canonicalAssignmentKey: keyPairs
            .sort((a, b) => a.stageId.localeCompare(b.stageId))
            .map((k) => `${k.stageId}:${k.teamId ?? 'UNASSIGNED'}`)
            .join('|')
        };

        if (bestObj === null || compareObjectiveTuples(obj, bestObj) < 0) {
          bestObj = obj;
          bestAssignments = curAssignments.map((t) => (t ? t.id : null));
        }
        return;
      }

      // Try assigning each team
      for (let j = 0; j < numTeams; j++) {
        curAssignments[stageIdx] = teams[j];
        generate(stageIdx + 1, curAssignments);
      }
      // Try unassigned
      curAssignments[stageIdx] = null;
      generate(stageIdx + 1, curAssignments);
    }

    generate(0, new Array(numStages));
    return { bestObj: bestObj!, bestAssignments };
  }

  // Test across multiple synthetic configurations
  const smallStages = [
    createMockStage('st-a', 2, 1, ['Aero']),
    createMockStage('st-b', 3, 2, ['Fusion']),
    createMockStage('st-c', 4, 3, ['Electro'])
  ];

  const t1 = createMockTeamBuild('Jiyan', 'Yangyang', 'Aalto', {
    elements: ['Aero', 'Aero', 'Aero']
  });
  const t2 = createMockTeamBuild('Chixia', 'Mortefi', 'Changli', {
    elements: ['Fusion', 'Fusion', 'Fusion']
  });

  const oracleResult = bruteForceSolve(smallStages, [t1, t2]);

  const solverResult = solveToAAllocation({
    targetStages: smallStages,
    candidateTeams: [t1, t2],
    allowPartial: true
  });

  assert.strictEqual(
    solverResult.objectiveTuple.stagesCompleted,
    oracleResult.bestObj.stagesCompleted,
    'Stages completed matches oracle'
  );
  assert.strictEqual(
    solverResult.objectiveTuple.beneficialBuffMatches,
    oracleResult.bestObj.beneficialBuffMatches,
    'Buff matches match oracle'
  );
  assert.strictEqual(
    solverResult.objectiveTuple.canonicalAssignmentKey,
    oracleResult.bestObj.canonicalAssignmentKey,
    'Canonical assignment key matches oracle exactly'
  );
});

test('11. Deterministic Identifier Derivation and Permutation Invariance', () => {
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const t2 = createMockTeamBuild('Baizhi', 'Sanhua', 'Yangyang');

  const s1 = createMockStage('st-1', 2, 1);
  const s2 = createMockStage('st-2', 3, 2);

  // Run with candidates in order [t1, t2]
  const resA = allocateToAStages({
    stageCatalog: [s1, s2],
    candidateTeams: [t1, t2]
  });

  // Run with candidates in permuted order [t2, t1]
  const resB = allocateToAStages({
    stageCatalog: [s1, s2],
    candidateTeams: [t2, t1]
  });

  // Run with stages in permuted order [s2, s1]
  const resC = allocateToAStages({
    stageCatalog: [s2, s1],
    candidateTeams: [t1, t2]
  });

  assert.strictEqual(resA.allocation.id, resB.allocation.id);
  assert.strictEqual(resA.allocation.id, resC.allocation.id);
  assert.strictEqual(
    JSON.stringify(resA.allocation.objectiveTuple),
    JSON.stringify(resB.allocation.objectiveTuple)
  );
});

test('12. Independent Result Audit Verification & Tampering Rejection', () => {
  const s1 = createMockStage('st-1', 4, 1);
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');

  const res = allocateToAStages({
    stageCatalog: [s1],
    candidateTeams: [t1]
  });

  // 1. Untampered allocation passes audit
  const cleanReport = auditSingleToAAllocation(res.allocation);
  assert.strictEqual(cleanReport.isValid, true);
  assert.strictEqual(cleanReport.violations.length, 0);

  // 2. Tampered patch version rejected
  const tamperedPatch = { ...res.allocation, patchVersion: '3.6' as any };
  const repPatch = auditSingleToAAllocation(tamperedPatch);
  assert.strictEqual(repPatch.isValid, false);
  assert.ok(repPatch.violations.some((v) => v.code === 'PATCH_MISMATCH'));

  // 3. Tampered Vigor record rejected
  const tamperedVigor = {
    ...res.allocation,
    vigorAccounting: res.allocation.vigorAccounting.map((v) => ({
      ...v,
      vigorConsumed: 999
    }))
  };
  const repVigor = auditSingleToAAllocation(tamperedVigor);
  assert.strictEqual(repVigor.isValid, false);
  assert.ok(repVigor.violations.some((v) => v.code === 'VIGOR_ACCOUNTING_DISCREPANCY'));

  // 4. Duplicate stage in assignments rejected
  const tamperedDup = {
    ...res.allocation,
    assignments: [...res.allocation.assignments, res.allocation.assignments[0]]
  };
  const repDup = auditSingleToAAllocation(tamperedDup);
  assert.strictEqual(repDup.isValid, false);
  assert.ok(repDup.violations.some((v) => v.code === 'DUPLICATE_STAGE_ASSIGNMENT'));

  // 5. Tampered objective tuple rejected
  const tamperedObj = {
    ...res.allocation,
    objectiveTuple: { ...res.allocation.objectiveTuple, stagesCompleted: 99 }
  };
  const repObj = auditSingleToAAllocation(tamperedObj);
  assert.strictEqual(repObj.isValid, false);
  assert.ok(repObj.violations.some((v) => v.code === 'OBJECTIVE_STAGES_COMPLETED_MISMATCH'));
});

test('13. Prohibited-Key Rejection Across Casing and Delimiters', () => {
  for (const badKey of PROHIBITED_TOA_ALLOCATION_KEYS) {
    assert.throws(
      () => assertNoProhibitedToAAllocationKeys({ [badKey]: 100 }),
      /Prohibited key/,
      `Should reject ${badKey}`
    );

    // Kebab case
    const kebab = badKey.replace(/([A-Z])/g, '-$1').toLowerCase();
    assert.throws(
      () => assertNoProhibitedToAAllocationKeys({ [kebab]: 100 }),
      /Prohibited key/,
      `Should reject ${kebab}`
    );

    // Snake case
    const snake = badKey.replace(/([A-Z])/g, '_$1').toLowerCase();
    assert.throws(
      () => assertNoProhibitedToAAllocationKeys({ [snake]: 100 }),
      /Prohibited key/,
      `Should reject ${snake}`
    );
  }
});

test('14. Canonical Season 40 Stage Catalog Invariants', () => {
  clearToAAllocationCache();
  const stages = getCanonicalSeason40Stages();

  assert.strictEqual(stages.length, 12, 'Must have exactly 12 stages in Season 40');

  // Verify towers
  const tower1 = stages.filter((s) => s.towerOrder === 1);
  const tower2 = stages.filter((s) => s.towerOrder === 2);
  const tower3 = stages.filter((s) => s.towerOrder === 3);

  assert.strictEqual(tower1.length, 4, 'Resonant Tower has 4 stages');
  assert.strictEqual(tower2.length, 4, 'Hazard Tower has 4 stages');
  assert.strictEqual(tower3.length, 4, 'Echoing Tower has 4 stages');

  // Verify Vigor costs:
  // Tower 1: [1, 2, 3, 4] -> sum 10
  assert.deepStrictEqual(
    tower1.map((s) => s.vigorCost),
    [1, 2, 3, 4]
  );
  // Tower 2: [5, 5, 5, 5] -> sum 20
  assert.deepStrictEqual(
    tower2.map((s) => s.vigorCost),
    [5, 5, 5, 5]
  );
  // Tower 3: [1, 2, 3, 4] -> sum 10
  assert.deepStrictEqual(
    tower3.map((s) => s.vigorCost),
    [1, 2, 3, 4]
  );

  // Total Season 40 vigor cost = 10 + 20 + 10 = 40
  const totalCost = stages.reduce((acc, s) => acc + s.vigorCost, 0);
  assert.strictEqual(totalCost, 40);

  // Beneficial elements
  assert.deepStrictEqual(tower1[0].beneficialElements, ['Aero']);
  assert.deepStrictEqual(tower2[0].beneficialElements, ['Electro', 'Fusion']);
  assert.deepStrictEqual(tower3[0].beneficialElements, ['Havoc']);
});

test('15. Production Integration with Step 22 Portfolio & Infeasibility Semantics', () => {
  clearToAAllocationCache();

  // With default Step 22 portfolio (K = 3 teams, 30 vigor total) against full 12 stages (40 vigor required):
  // allowPartial: false -> INFEASIBLE_ALLOCATION
  const resInfeasible = allocateToAStages({
    allowPartial: false
  });

  assert.strictEqual(resInfeasible.allocation.status, 'INFEASIBLE_ALLOCATION');
  assert.strictEqual(resInfeasible.allocation.completeness.assignedStageCount, 0);
  assert.ok(resInfeasible.allocation.infeasibilityReasons);
  assert.ok(
    resInfeasible.allocation.infeasibilityReasons.some((r) =>
      r.includes('Target stages require 40 Vigor')
    )
  );

  // allowPartial: true -> PARTIAL_ALLOCATION
  const resPartial = allocateToAStages({
    allowPartial: true
  });

  assert.strictEqual(resPartial.allocation.status, 'PARTIAL_ALLOCATION');
  assert.ok(resPartial.allocation.completeness.assignedStageCount > 0);
  assert.ok(resPartial.allocation.completeness.assignedStageCount < 12);
  assert.strictEqual(resPartial.allocation.completeness.totalVigorConsumed <= 30 * 3, true);

  // Audits cleanly
  const report = auditSingleToAAllocation(resPartial.allocation);
  assert.strictEqual(report.isValid, true);
});

test('16. Twenty-Run Byte-Identical Determinism', () => {
  clearToAAllocationCache();

  const hashes: string[] = [];
  for (let run = 1; run <= 20; run++) {
    clearToAAllocationCache();
    const res = allocateToAStages({
      targetStageIds: ['toa-resonant-floor-1', 'toa-resonant-floor-2', 'toa-resonant-floor-3'],
      allowPartial: false
    });
    const serialized = JSON.stringify(res);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    hashes.push(hash);
  }

  const firstHash = hashes[0];
  assert.ok(firstHash, 'Must generate valid SHA-256 hash');
  for (let i = 1; i < hashes.length; i++) {
    assert.strictEqual(
      hashes[i],
      firstHash,
      `Run ${i + 1} produced divergent hash from run 1!`
    );
  }
});

test('17. Factual Presentation Explanation Formatting', () => {
  const res = allocateToAStages({
    targetStageIds: ['toa-resonant-floor-1', 'toa-resonant-floor-2'],
    allowPartial: false
  });

  const text = formatToAAllocationExplanation(res.allocation);

  assert.ok(text.includes('TOWER OF ADVERSITY STAGE ALLOCATION'));
  assert.ok(text.includes('Status:'));
  assert.ok(text.includes('Coverage: 2/2 stages'));
  assert.ok(text.includes('Vigor Consumed:'));
  assert.ok(text.includes('Stage Assignments:'));
  assert.ok(text.includes('Per-Resonator Vigor Usage:'));
  assert.ok(text.includes('Notice: Multi-stage equipment swapping and non-elemental buff stacking are unmodeled.'));

  // Ensure no prohibited words appear in presentation
  for (const prohibited of ['combat power', 'tier list', 'meta rank', 'dps', 'gearscore']) {
    assert.strictEqual(
      text.toLowerCase().includes(prohibited),
      false,
      `Presentation should not include prohibited word '${prohibited}'`
    );
  }
});

test('18. Full 12-Stage Allocation with 4-Team Portfolio Covers All Floors', () => {
  // Construct 4 disjoint teams with beneficial elements matching towers
  const t1Aero = createMockTeamBuild('Jiyan', 'Yangyang', 'Aalto', {
    elements: ['Aero', 'Aero', 'Aero']
  });
  const t2Electro = createMockTeamBuild('Yinlin', 'Calcharo', 'Yuanwu', {
    elements: ['Electro', 'Electro', 'Electro']
  });
  const t3Fusion = createMockTeamBuild('Chixia', 'Mortefi', 'Changli', {
    elements: ['Fusion', 'Fusion', 'Fusion']
  });
  const t4Havoc = createMockTeamBuild('Danjin', 'Rover: Havoc', 'Camellya', {
    elements: ['Havoc', 'Havoc', 'Havoc']
  });

  const res = allocateToAStages({
    candidateTeams: [t1Aero, t2Electro, t3Fusion, t4Havoc],
    allowPartial: false
  });

  assert.strictEqual(res.allocation.status, 'OPTIMAL_ALLOCATION');
  assert.strictEqual(res.allocation.completeness.assignedStageCount, 12);
  assert.strictEqual(res.allocation.completeness.unassignedStageCount, 0);
  assert.strictEqual(res.allocation.completeness.stageCoverageRatio, 1.0);
  assert.strictEqual(res.allocation.completeness.totalVigorConsumed, 120); // 40 vigor * 3 members

  // Independent audit verification
  const auditReport = auditSingleToAAllocation(res.allocation);
  assert.strictEqual(auditReport.isValid, true);
  assert.strictEqual(auditReport.violations.length, 0);

  // Every Resonator consumed exactly 10 Vigor, 0 remaining
  for (const va of res.allocation.vigorAccounting) {
    assert.strictEqual(va.vigorConsumed, 10);
    assert.strictEqual(va.vigorRemaining, 0);
  }
});

test('19. Overlapping Teams Sharing a Resonator Respect Individual Vigor Bounds', () => {
  // Team 1: [Jiyan, Mortefi, Verina]
  // Team 2: [Jiyan, Sanhua, Baizhi] (shares Jiyan)
  const t1 = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const t2 = createMockTeamBuild('Jiyan', 'Sanhua', 'Baizhi');

  // Stage 1 (cost 5), Stage 2 (cost 5), Stage 3 (cost 5)
  // Jiyan has 10 Vigor. Can participate in at most 2 stages total!
  const s1 = createMockStage('st-1', 5, 1);
  const s2 = createMockStage('st-2', 5, 2);
  const s3 = createMockStage('st-3', 5, 3);

  // Assigning 3 stages of cost 5 with only t1 and t2 is impossible because both teams require Jiyan,
  // and Jiyan cannot exceed 10 Vigor (5 + 5 + 5 = 15 > 10).
  const resInfeasible = allocateToAStages({
    stageCatalog: [s1, s2, s3],
    candidateTeams: [t1, t2],
    allowPartial: false
  });
  assert.strictEqual(resInfeasible.allocation.status, 'INFEASIBLE_ALLOCATION');

  // When allowPartial: true, can assign at most 2 stages
  const resPartial = allocateToAStages({
    stageCatalog: [s1, s2, s3],
    candidateTeams: [t1, t2],
    allowPartial: true
  });
  assert.strictEqual(resPartial.allocation.status, 'PARTIAL_ALLOCATION');
  assert.strictEqual(resPartial.allocation.completeness.assignedStageCount, 2);
  const jiyanUsage = resPartial.allocation.vigorAccounting.find((v) => v.resonatorId === 'Jiyan');
  assert.strictEqual(jiyanUsage?.vigorConsumed, 10);
  assert.strictEqual(jiyanUsage?.vigorRemaining, 0);
});

test('20. Deep Immutability and runProductionToAAllocationAudit Execution', () => {
  clearToAAllocationCache();
  const prodResult = runProductionToAAllocationAudit();

  assert.strictEqual(prodResult.patchId, '3.7');
  assert.strictEqual(prodResult.ruleVersion, '7.23.1');
  assert.strictEqual(prodResult.seasonId, 'season:40');
  assert.ok(prodResult.allocation);

  // 1. Attempt mutation on root result
  assert.throws(() => {
    (prodResult as any).patchId = '3.8';
  }, TypeError);

  // 2. Attempt mutation on metrics
  assert.throws(() => {
    (prodResult.metrics as any).targetStageCount = 999;
  }, TypeError);

  // 3. Attempt mutation on completeness
  assert.throws(() => {
    (prodResult.allocation.completeness as any).targetStageCount = 999;
  }, TypeError);

  // 4. Attempt mutation on objectiveTuple
  assert.throws(() => {
    (prodResult.allocation.objectiveTuple as any).stagesCompleted = 999;
  }, TypeError);

  // 5. Attempt mutation on assignments array
  assert.throws(() => {
    (prodResult.allocation.assignments as any).push({});
  }, TypeError);

  // 6. Attempt mutation on vigorAccounting array
  assert.throws(() => {
    (prodResult.allocation.vigorAccounting as any)[0] = {};
  }, TypeError);

  // 7. Test deep immutability on an assigned allocation
  const resAssigned = allocateToAStages({
    targetStageIds: ['toa-resonant-floor-1'],
    allowPartial: false
  });

  const a0 = resAssigned.allocation.assignments[0];
  assert.strictEqual(Object.isFrozen(a0), true, 'Assignment item must be frozen');
  assert.throws(() => {
    (a0 as any).vigorCost = 999;
  }, TypeError);

  assert.strictEqual(Object.isFrozen(a0.stage), true, 'Assignment stage must be frozen');
  assert.throws(() => {
    (a0.stage as any).vigorCost = 999;
  }, TypeError);

  if (a0.team) {
    assert.strictEqual(Object.isFrozen(a0.team), true, 'Assignment team must be frozen');
    assert.throws(() => {
      (a0.team as any).id = 'tampered-team-id';
    }, TypeError);
  }

  const v0 = resAssigned.allocation.vigorAccounting[0];
  assert.strictEqual(Object.isFrozen(v0), true, 'Vigor accounting item must be frozen');
  assert.throws(() => {
    (v0 as any).vigorConsumed = 999;
  }, TypeError);

  // 8. Memoized cache isolation check
  clearToAAllocationCache();
  const cached1 = getDefaultToAAllocationResult();
  assert.throws(() => {
    (cached1.allocation.objectiveTuple as any).stagesCompleted = 777;
  }, TypeError);
  const cached2 = getDefaultToAAllocationResult();
  assert.strictEqual(cached2.allocation.objectiveTuple.stagesCompleted, 0);

  // 9. Separate invocations produce separate isolated instances
  const sepA = allocateToAStages({ targetStageIds: ['toa-resonant-floor-1'] });
  const sepB = allocateToAStages({ targetStageIds: ['toa-resonant-floor-1'] });
  assert.notStrictEqual(sepA, sepB);
  assert.notStrictEqual(sepA.allocation, sepB.allocation);
  assert.notStrictEqual(sepA.allocation.objectiveTuple, sepB.allocation.objectiveTuple);

  // 10. Caller-owned input objects remain unfrozen and mutable by the caller
  const callerStage = {
    stageId: 'toa-resonant-floor-1',
    patchVersion: '3.7' as const,
    seasonId: 'season:40',
    towerId: 'resonant-tower',
    towerName: 'Resonant Tower',
    towerOrder: 1,
    stageIndex: 1,
    globalStageOrder: 1,
    vigorCost: 1,
    difficulty: 3,
    areaEffects: Object.freeze([]),
    beneficialElements: Object.freeze(['Aero']),
    enemyCodes: Object.freeze([])
  };

  const callerTeam = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');
  const mutableTeamWrapper = { ...callerTeam };

  allocateToAStages({
    stageCatalog: [callerStage],
    candidateTeams: [mutableTeamWrapper as any],
    allowPartial: false
  });

  // Caller's wrapper object was NOT frozen in place
  assert.strictEqual(Object.isFrozen(mutableTeamWrapper), false);
  mutableTeamWrapper.id = 'caller-mutated-team';
  assert.strictEqual(mutableTeamWrapper.id, 'caller-mutated-team');
});

test('21. Comprehensive Fail-Closed Adversarial Input Validation Matrix (10 Cases)', () => {
  const validStage = createMockStage('st-valid', 2, 1);
  const validTeam = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina');

  // Case 1: Foreign patch stage (patchVersion: '3.6')
  const stageBadPatch = { ...validStage, patchVersion: '3.6' };
  assert.throws(
    () => allocateToAStages({ stageCatalog: [stageBadPatch as any] }),
    /invalid patchVersion '3.6'/
  );

  // Case 2: Foreign season stage (seasonId: 'season:39')
  const stageBadSeason = { ...validStage, seasonId: 'season:39' };
  assert.throws(
    () => allocateToAStages({ stageCatalog: [stageBadSeason as any] }),
    /invalid seasonId 'season:39'/
  );

  // Case 3: Duplicate stage IDs in stageCatalog
  assert.throws(
    () => allocateToAStages({ stageCatalog: [validStage, validStage] }),
    /Duplicate stage identifier/
  );

  // Case 4: Missing / unresolvable target IDs in targetStageIds
  assert.throws(
    () => allocateToAStages({ targetStageIds: ['non_existent_stage_xyz'] }),
    /Requested target stage ID 'non_existent_stage_xyz' not found/
  );

  // Case 5: Empty target list (targetStageIds: []) -> fail-closed INFEASIBLE_ALLOCATION
  const resEmptyTargets = allocateToAStages({ targetStageIds: [] });
  assert.strictEqual(resEmptyTargets.allocation.status, 'INFEASIBLE_ALLOCATION');
  assert.strictEqual(resEmptyTargets.allocation.completeness.targetStageCount, 0);
  assert.strictEqual(resEmptyTargets.allocation.completeness.assignedStageCount, 0);
  assert.deepStrictEqual(resEmptyTargets.allocation.infeasibilityReasons, [
    'No target stages requested for allocation.'
  ]);

  // Case 6: Two-member and four-member candidate teams (length !== 3)
  const twoMemberTeam = {
    ...validTeam,
    id: 'team-two-members',
    memberResonatorIds: ['Jiyan', 'Verina']
  };
  assert.throws(
    () => allocateToAStages({ candidateTeams: [twoMemberTeam as any] }),
    /expected exactly 3/
  );

  const fourMemberTeam = {
    ...validTeam,
    id: 'team-four-members',
    memberResonatorIds: ['Jiyan', 'Mortefi', 'Verina', 'Aalto']
  };
  assert.throws(
    () => allocateToAStages({ candidateTeams: [fourMemberTeam as any] }),
    /expected exactly 3/
  );

  // Case 7: Duplicate Resonators inside one team (['Jiyan', 'Jiyan', 'Verina'])
  const dupMemberTeam = {
    ...validTeam,
    id: 'team-dup-members',
    memberResonatorIds: ['Jiyan', 'Jiyan', 'Verina']
  };
  assert.throws(
    () => allocateToAStages({ candidateTeams: [dupMemberTeam as any] }),
    /contains duplicate member Resonator 'Jiyan'/
  );

  // Case 8: Invalid portfolio and contradictory fallback inputs
  const badPatchPortfolio = {
    patchVersion: '3.6',
    ruleVersion: '7.22.1',
    teams: [validTeam]
  };
  assert.throws(
    () => allocateToAStages({ portfolio: badPatchPortfolio as any }),
    /Portfolio has invalid patchVersion '3.6'/
  );

  const badRulePortfolio = {
    patchVersion: '3.7',
    ruleVersion: '7.20.1',
    teams: [validTeam]
  };
  assert.throws(
    () => allocateToAStages({ portfolio: badRulePortfolio as any }),
    /Portfolio has invalid ruleVersion '7.20.1'/
  );

  // Case 9: Unknown or non-canonical Resonator ID in ownedRoster
  assert.throws(
    () => allocateToAStages({ ownedRoster: ['UnknownFakeChar'] }),
    /Non-canonical Resonator ID 'UnknownFakeChar'/
  );

  // Case 10: Audit rejection of an allocation containing invalid stage or team metadata
  const validRes = allocateToAStages({ targetStageIds: ['toa-resonant-floor-1'] });

  // Tampered stage patch in audit
  const tamperedStagePatch = {
    ...validRes.allocation,
    assignments: [
      {
        ...validRes.allocation.assignments[0],
        stage: { ...validRes.allocation.assignments[0].stage, patchVersion: '3.6' as any }
      }
    ]
  };
  const auditStagePatch = auditSingleToAAllocation(tamperedStagePatch);
  assert.strictEqual(auditStagePatch.isValid, false);
  assert.ok(auditStagePatch.violations.some((v) => v.code === 'STAGE_PATCH_MISMATCH'));

  // Tampered stage season in audit
  const tamperedStageSeason = {
    ...validRes.allocation,
    assignments: [
      {
        ...validRes.allocation.assignments[0],
        stage: { ...validRes.allocation.assignments[0].stage, seasonId: 'season:39' as any }
      }
    ]
  };
  const auditStageSeason = auditSingleToAAllocation(tamperedStageSeason);
  assert.strictEqual(auditStageSeason.isValid, false);
  assert.ok(auditStageSeason.violations.some((v) => v.code === 'STAGE_SEASON_MISMATCH'));

  // Tampered duplicate member in team under audit
  const tamperedTeamMember = {
    ...validRes.allocation,
    assignments: [
      {
        ...validRes.allocation.assignments[0],
        team: {
          ...validRes.allocation.assignments[0].team!,
          memberResonatorIds: ['Jiyan', 'Jiyan', 'Verina'] as any
        }
      }
    ]
  };
  const auditTeamMember = auditSingleToAAllocation(tamperedTeamMember);
  assert.strictEqual(auditTeamMember.isValid, false);
  assert.ok(auditTeamMember.violations.some((v) => v.code === 'DUPLICATE_TEAM_MEMBER'));
});

test('22. Status Taxonomy Consistency & Equipment Qualification', () => {
  const s1 = createMockStage('st-status-1', 3, 1);

  // 1. Fully equipped team covers stage -> OPTIMAL_ALLOCATION
  const tFull = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina', {
    status: 'FULLY_EQUIPPED'
  });
  const resOptimal = allocateToAStages({
    stageCatalog: [s1],
    targetStageIds: ['st-status-1'],
    candidateTeams: [tFull],
    allowPartial: false
  });
  assert.strictEqual(resOptimal.allocation.status, 'OPTIMAL_ALLOCATION');
  const auditOptimal = auditSingleToAAllocation(resOptimal.allocation);
  assert.strictEqual(auditOptimal.isValid, true);

  // 2. Valid candidate team with PARTIALLY_EQUIPPED status covers stage -> FEASIBLE_ALLOCATION
  const tPartial = createMockTeamBuild('Jiyan', 'Mortefi', 'Verina', {
    status: 'PARTIALLY_EQUIPPED'
  });
  const resFeasible = allocateToAStages({
    stageCatalog: [s1],
    targetStageIds: ['st-status-1'],
    candidateTeams: [tPartial],
    allowPartial: false
  });
  assert.strictEqual(resFeasible.allocation.status, 'FEASIBLE_ALLOCATION');
  const auditFeasible = auditSingleToAAllocation(resFeasible.allocation);
  assert.strictEqual(auditFeasible.isValid, true);

  // 3. Audit flags status inconsistency if PARTIALLY_EQUIPPED team is mislabeled as OPTIMAL_ALLOCATION
  const mislabeledAlloc = {
    ...resFeasible.allocation,
    status: 'OPTIMAL_ALLOCATION' as const
  };
  const auditMislabeled = auditSingleToAAllocation(mislabeledAlloc);
  assert.strictEqual(auditMislabeled.isValid, false);
  assert.ok(
    auditMislabeled.violations.some((v) => v.code === 'OPTIMAL_STATUS_WITH_PARTIAL_EQUIPMENT')
  );
});

test('23. Season 40 Provenance & Zero-Drift Dataset Consistency', () => {
  // Read real canonical Patch 3.7 dataset file directly
  const datasetPath = path.resolve(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  assert.strictEqual(fs.existsSync(datasetPath), true, 'Canonical dataset must exist at path');

  const rawJson = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const consistencyReport = validateSeason40DatasetConsistency(rawJson);

  assert.strictEqual(consistencyReport.isValid, true, 'Real dataset must pass Season 40 consistency');
  assert.deepStrictEqual(consistencyReport.errors, [], 'Must have zero consistency errors');

  // Cross-compare real dataset with canonical fallback stages
  const fallbackStages = getCanonicalSeason40Stages();
  assert.strictEqual(fallbackStages.length, 12);

  const cycle = rawJson.toa_cycles[0];
  assert.strictEqual(cycle.cycle_code, 'season:40');
  const towers = cycle.zones[0].towers;

  let flatIndex = 0;
  for (const t of towers) {
    for (const st of t.stages) {
      const fallback = fallbackStages[flatIndex];
      assert.strictEqual(fallback.stageIndex, st.stage_index);
      assert.strictEqual(fallback.towerOrder, t.tower_order);
      assert.strictEqual(fallback.vigorCost, st.vigor_cost);
      assert.deepStrictEqual(
        fallback.areaEffects.map((a) => a.sourceId),
        st.area_effect_source_ids,
        `Stage ${fallback.stageId} area effect source IDs must match canonical dataset`
      );
      assert.ok(
        fallback.beneficialElements.length > 0,
        `Stage ${fallback.stageId} must have valid beneficial elements`
      );
      assert.strictEqual(fallback.patchVersion, '3.7');
      assert.strictEqual(fallback.seasonId, 'season:40');
      flatIndex++;
    }
  }

  // Negative dataset validation tests:
  // Missing cycles
  const errMissing = validateSeason40DatasetConsistency({});
  assert.strictEqual(errMissing.isValid, false);

  // Wrong season ID
  const errWrongSeason = validateSeason40DatasetConsistency({
    toa_cycles: [{ cycle_code: 'season:39' }]
  });
  assert.strictEqual(errWrongSeason.isValid, false);

  // Corrupted vigor costs
  const errCorruptedVigor = validateSeason40DatasetConsistency({
    toa_cycles: [
      {
        cycle_code: 'season:40',
        zones: [
          {
            zone_type: 'HazardZone',
            towers: [
              {
                tower_order: 1,
                tower_name: 'Resonant Tower',
                stages: [{ stage_index: 1, vigor_cost: 99 }]
              },
              { tower_order: 2, tower_name: 'Hazard Tower', stages: [] },
              { tower_order: 3, tower_name: 'Echoing Tower', stages: [] }
            ]
          }
        ]
      }
    ]
  });
  assert.strictEqual(errCorruptedVigor.isValid, false);
});

test('24. Documented Search State & Complexity Benchmarks', () => {
  // Benchmark 1: Small toy allocation (3 stages, 2 teams, allowPartial: true)
  const toyStages = [
    createMockStage('toy-1', 2, 1, ['Aero']),
    createMockStage('toy-2', 3, 2, ['Fusion']),
    createMockStage('toy-3', 4, 3, ['Electro'])
  ];
  const toyTeams = [
    createMockTeamBuild('Jiyan', 'Yangyang', 'Aalto', { elements: ['Aero', 'Aero', 'Aero'] }),
    createMockTeamBuild('Chixia', 'Mortefi', 'Changli', { elements: ['Fusion', 'Fusion', 'Fusion'] })
  ];

  const t0_toy = performance.now();
  const resToy = allocateToAStages({
    stageCatalog: toyStages,
    candidateTeams: toyTeams,
    allowPartial: true
  });
  const msToy = performance.now() - t0_toy;

  assert.strictEqual(resToy.allocation.completeness.assignedStageCount, 3);
  assert.ok(resToy.metrics.searchStatesExplored < 50, 'Toy search explores small state space');

  // Benchmark 2: Canonical 12-stage with 3-team portfolio (allowPartial: false early fail vs allowPartial: true)
  const res3Fail = allocateToAStages({ allowPartial: false });
  assert.strictEqual(res3Fail.allocation.status, 'INFEASIBLE_ALLOCATION');
  assert.strictEqual(res3Fail.metrics.searchStatesExplored, 1, 'Early bound detects infeasibility in 1 state');

  // Benchmark 3: Canonical 12-stage with 4-team portfolio (full coverage)
  const t1 = createMockTeamBuild('Jiyan', 'Yangyang', 'Aalto', { elements: ['Aero', 'Aero', 'Aero'] });
  const t2 = createMockTeamBuild('Yinlin', 'Calcharo', 'Yuanwu', { elements: ['Electro', 'Electro', 'Electro'] });
  const t3 = createMockTeamBuild('Chixia', 'Mortefi', 'Changli', { elements: ['Fusion', 'Fusion', 'Fusion'] });
  const t4 = createMockTeamBuild('Danjin', 'Rover: Havoc', 'Camellya', { elements: ['Havoc', 'Havoc', 'Havoc'] });

  const t0_12 = performance.now();
  const res12 = allocateToAStages({
    candidateTeams: [t1, t2, t3, t4],
    allowPartial: false
  });
  const ms12 = performance.now() - t0_12;

  assert.strictEqual(res12.allocation.status, 'OPTIMAL_ALLOCATION');
  assert.strictEqual(res12.allocation.completeness.assignedStageCount, 12);
  // Empirical verification: explores ~200,000 states under full exact branch-and-bound
  assert.ok(
    res12.metrics.searchStatesExplored > 100000,
    'Explores exact combinatorial space (~200k states)'
  );
  assert.ok(
    res12.metrics.prunedStatesCount > 10000,
    'Pruning rules successfully eliminate dead branches'
  );
});

test('25. Reserved Objective Tuple Dimensions Invariants', () => {
  const res = allocateToAStages({
    targetStageIds: ['toa-resonant-floor-1']
  });

  const obj = res.allocation.objectiveTuple;
  assert.strictEqual(typeof obj.totalSynergyPairs, 'number');
  assert.strictEqual(typeof obj.totalDirectionalEdges, 'number');
  assert.strictEqual(obj.totalSynergyPairs, 0, 'Reserved dimension evaluates to 0');
  assert.strictEqual(obj.totalDirectionalEdges, 0, 'Reserved dimension evaluates to 0');

  // Deterministic tie-break ordering is total and strict
  const objA: ToAAllocationObjectiveTuple = {
    ...obj,
    canonicalAssignmentKey: 'stageA:team1'
  };
  const objB: ToAAllocationObjectiveTuple = {
    ...obj,
    canonicalAssignmentKey: 'stageA:team2'
  };
  assert.ok(compareObjectiveTuples(objA, objB) < 0);
  assert.ok(compareObjectiveTuples(objB, objA) > 0);
});

