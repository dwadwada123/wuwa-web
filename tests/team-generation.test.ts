import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateTeamCandidates,
  createTeamCandidate,
  generate3Combinations,
  calculateCombinationCount,
  createCanonicalTeamKey,
  canonicalizeTeamMembers,
  getCandidateKey,
  isSameTeam,
} from '../lib/engine/index.ts';

import type {
  TeamGenerationContext,
  OwnedRoster,
  ResonatorBuild,
} from '../lib/domain/types/index.ts';

import {
  patchContext37,
  patchContext36,
  fullOwnedRoster,
  jinhsi,
  verina,
  jianxin,
  yangyang,
  futureResonator,
  availableResonatorsList,
  ageOfHarvestWeapon,
  swordEmeraldGenesis,
  stageHazardZone37,
  stageResonantTower37,
  stageHazardZone36,
  createSyntheticRoster,
} from './fixtures/domain-fixtures.ts';

test('Candidate Generation - Combination Engine & Counts', () => {
  // Test theoretical combination formula C(N, 3)
  assert.equal(calculateCombinationCount(0, 3), 0);
  assert.equal(calculateCombinationCount(1, 3), 0);
  assert.equal(calculateCombinationCount(2, 3), 0);
  assert.equal(calculateCombinationCount(3, 3), 1);
  assert.equal(calculateCombinationCount(4, 3), 4);
  assert.equal(calculateCombinationCount(5, 3), 10);
  assert.equal(calculateCombinationCount(6, 3), 20);

  // Test generate3Combinations output length
  assert.equal(generate3Combinations([]).length, 0);
  assert.equal(generate3Combinations([1]).length, 0);
  assert.equal(generate3Combinations([1, 2]).length, 0);
  assert.equal(generate3Combinations([1, 2, 3]).length, 1);
  assert.equal(generate3Combinations([1, 2, 3, 4]).length, 4);
  assert.equal(generate3Combinations([1, 2, 3, 4, 5]).length, 10);
});

test('Candidate Generation - Small Roster Size Boundary Conditions', () => {
  const baseContext: TeamGenerationContext = {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  };

  // N = 0
  const emptyRoster: OwnedRoster = { resonatorIds: [] };
  assert.equal(generateTeamCandidates(emptyRoster, baseContext).length, 0);

  // N = 1
  const oneRoster: OwnedRoster = { resonatorIds: [jinhsi.id] };
  assert.equal(generateTeamCandidates(oneRoster, baseContext).length, 0);

  // N = 2
  const twoRoster: OwnedRoster = { resonatorIds: [jinhsi.id, verina.id] };
  assert.equal(generateTeamCandidates(twoRoster, baseContext).length, 0);

  // N = 3
  const threeRoster: OwnedRoster = { resonatorIds: [jinhsi.id, verina.id, jianxin.id] };
  const threeCandidates = generateTeamCandidates(threeRoster, baseContext);
  assert.equal(threeCandidates.length, 1, 'Roster of 3 should generate exactly 1 team');
  assert.equal(
    threeCandidates[0].canonicalKey,
    createCanonicalTeamKey([jinhsi.id, verina.id, jianxin.id])
  );

  // N = 4
  const fourRoster: OwnedRoster = {
    resonatorIds: [jinhsi.id, verina.id, jianxin.id, yangyang.id],
  };
  const fourCandidates = generateTeamCandidates(fourRoster, baseContext);
  assert.equal(fourCandidates.length, 4, 'C(4, 3) must equal 4');
});

test('Candidate Generation - Permutation Deduplication (All 6 Permutations)', () => {
  const b1: ResonatorBuild = { resonator: jinhsi };
  const b2: ResonatorBuild = { resonator: verina };
  const b3: ResonatorBuild = { resonator: yangyang };

  const perm1: ResonatorBuild[] = [b1, b2, b3];
  const perm2: ResonatorBuild[] = [b1, b3, b2];
  const perm3: ResonatorBuild[] = [b2, b1, b3];
  const perm4: ResonatorBuild[] = [b2, b3, b1];
  const perm5: ResonatorBuild[] = [b3, b1, b2];
  const perm6: ResonatorBuild[] = [b3, b2, b1];

  const key1 = createCanonicalTeamKey(perm1.map((m) => m.resonator.id));
  const key2 = createCanonicalTeamKey(perm2.map((m) => m.resonator.id));
  const key3 = createCanonicalTeamKey(perm3.map((m) => m.resonator.id));
  const key4 = createCanonicalTeamKey(perm4.map((m) => m.resonator.id));
  const key5 = createCanonicalTeamKey(perm5.map((m) => m.resonator.id));
  const key6 = createCanonicalTeamKey(perm6.map((m) => m.resonator.id));

  // All 6 permutations produce identical key
  assert.equal(key1, key2);
  assert.equal(key2, key3);
  assert.equal(key3, key4);
  assert.equal(key4, key5);
  assert.equal(key5, key6);

  // All 6 permutations canonicalize to identical ordered member sequence
  const canon1 = canonicalizeTeamMembers(perm1);
  const canon2 = canonicalizeTeamMembers(perm2);
  const canon3 = canonicalizeTeamMembers(perm3);
  const canon4 = canonicalizeTeamMembers(perm4);
  const canon5 = canonicalizeTeamMembers(perm5);
  const canon6 = canonicalizeTeamMembers(perm6);

  assert.deepEqual(canon1, canon2);
  assert.deepEqual(canon2, canon3);
  assert.deepEqual(canon3, canon4);
  assert.deepEqual(canon4, canon5);
  assert.deepEqual(canon5, canon6);

  // isSameTeam helper
  assert.ok(isSameTeam({ members: perm1 }, { members: perm6 }));
});

test('Candidate Generation - Hard Filtering Constraints', () => {
  const context: TeamGenerationContext = {
    patchContext: patchContext37, // snapshot: 2026-09-14
    availableResonators: availableResonatorsList,
  };

  // 1. Unreleased character in snapshot date (futureResonator released 2026-11-01)
  const rosterWithFuture: OwnedRoster = {
    resonatorIds: [jinhsi.id, verina.id, futureResonator.id],
  };
  const candidatesWithFuture = generateTeamCandidates(rosterWithFuture, context);
  assert.equal(
    candidatesWithFuture.length,
    0,
    'Team containing unreleased character must be filtered out by hard rule'
  );

  // 2. Invalid build constraint (weapon type mismatch)
  const invalidBuildRoster: OwnedRoster = {
    resonatorIds: [jinhsi.id, verina.id, yangyang.id],
    weaponIds: [swordEmeraldGenesis.id],
  };
  const contextWithInvalidBuild: TeamGenerationContext = {
    ...context,
    builds: {
      // Jinhsi is Broadblade, but equipped with Sword
      [jinhsi.id]: { resonator: jinhsi, weapon: swordEmeraldGenesis },
    },
  };
  const candidatesWithInvalidBuild = generateTeamCandidates(
    invalidBuildRoster,
    contextWithInvalidBuild
  );
  assert.equal(
    candidatesWithInvalidBuild.length,
    0,
    'Team with invalid build constraint must be filtered out by hard rule'
  );

  // 3. Stage Patch Mismatch (Patch isolation hard rule)
  const contextMismatchStage: TeamGenerationContext = {
    ...context,
    stage: stageHazardZone36, // Stage from Patch 3.6 evaluated in Patch 3.7
  };
  const candidatesMismatchPatch = generateTeamCandidates(fullOwnedRoster, contextMismatchStage);
  assert.equal(
    candidatesMismatchPatch.length,
    0,
    'Cross-patch stage evaluation must be filtered out by hard patch isolation'
  );
});

test('Candidate Generation - Soft Signals Preserved (No Premature Filtering)', () => {
  const context: TeamGenerationContext = {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    stage: stageHazardZone37,
  };

  // Team with NO healer and NO shield (Jinhsi, Yangyang, Sanhua/synthetic DPS)
  // Let's create a 3-character roster without any healer or shielder
  const dpsResonator = {
    ...jinhsi,
    id: 'res-pure-dps',
    name: 'Pure DPS',
    abilities: [],
    roles: [{ code: 'MAIN_DPS', label: 'Main DPS', isPrimary: true }],
  };

  const noSustainRoster: OwnedRoster = {
    resonatorIds: [jinhsi.id, yangyang.id, dpsResonator.id],
  };

  const noSustainContext: TeamGenerationContext = {
    patchContext: patchContext37,
    availableResonators: [jinhsi, yangyang, dpsResonator],
    stage: stageHazardZone37,
  };

  const candidates = generateTeamCandidates(noSustainRoster, noSustainContext);

  assert.equal(
    candidates.length,
    1,
    'Teams with no healer/shield must NOT be rejected by candidate generator'
  );

  const candidate = candidates[0];
  assert.equal(candidate.metadata.hasHealing, false);
  assert.equal(candidate.metadata.hasShield, false);
  assert.equal(candidate.validationReport.isValid, true);
  // Violations array contains the soft rule warning, but team is valid
  assert.ok(
    candidate.validationReport.violations.some((v) => v.severity === 'SOFT'),
    'Soft rule warning must be recorded without rejecting the candidate'
  );
});

test('Candidate Generation - Determinism Guarantee', () => {
  const context: TeamGenerationContext = {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    stage: stageHazardZone37,
  };

  const run1 = generateTeamCandidates(fullOwnedRoster, context);
  const run2 = generateTeamCandidates(fullOwnedRoster, context);

  assert.equal(run1.length, run2.length);
  assert.equal(
    JSON.stringify(run1),
    JSON.stringify(run2),
    'Candidate generation must be byte-for-byte identical across runs'
  );
});

test('Candidate Generation - Stage-Aware vs Roster-Only Modes', () => {
  const rosterContext: TeamGenerationContext = {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  };

  // Mode A: Roster-only
  const rosterCandidates = generateTeamCandidates(fullOwnedRoster, rosterContext);
  assert.equal(rosterCandidates.length, 4);
  assert.equal(rosterCandidates[0].metadata.stageFacts, undefined);

  // Mode B: Stage-aware (Stage 1: Hazard Zone Floor 4)
  const stage1Context: TeamGenerationContext = {
    ...rosterContext,
    stage: stageHazardZone37,
  };
  const stage1Candidates = generateTeamCandidates(fullOwnedRoster, stage1Context);
  assert.equal(stage1Candidates.length, 4);
  assert.ok(stage1Candidates[0].metadata.stageFacts !== undefined);
  assert.equal(stage1Candidates[0].metadata.stageFacts?.stageId, stageHazardZone37.id);

  // Mode B: Stage-aware (Stage 2: Resonant Tower Floor 4)
  const stage2Context: TeamGenerationContext = {
    ...rosterContext,
    stage: stageResonantTower37,
  };
  const stage2Candidates = generateTeamCandidates(fullOwnedRoster, stage2Context);
  assert.equal(stage2Candidates.length, 4);
  assert.ok(stage2Candidates[0].metadata.stageFacts !== undefined);
  assert.equal(stage2Candidates[0].metadata.stageFacts?.stageId, stageResonantTower37.id);

  // Canonical keys remain identical between stages
  assert.equal(stage1Candidates[0].canonicalKey, stage2Candidates[0].canonicalKey);

  // Stage-specific facts differ according to stage definitions
  const team1FactsStage1 = stage1Candidates[0].metadata.stageFacts;
  const team1FactsStage2 = stage2Candidates[0].metadata.stageFacts;

  assert.notEqual(team1FactsStage1?.stageId, team1FactsStage2?.stageId);
  assert.notEqual(team1FactsStage1?.enemyCount, team1FactsStage2?.enemyCount);
});

test('Candidate Generation - 50-Resonator Performance Benchmark', () => {
  const { roster, resonators } = createSyntheticRoster(50);

  const context: TeamGenerationContext = {
    patchContext: patchContext37,
    availableResonators: resonators,
  };

  const expectedCombinations = calculateCombinationCount(50, 3);
  assert.equal(expectedCombinations, 19600, 'C(50, 3) must be 19,600');

  const startTime = performance.now();
  const candidates = generateTeamCandidates(roster, context);
  const durationMs = performance.now() - startTime;

  assert.equal(candidates.length, 19600, 'All 19,600 valid candidates must be generated');
  assert.ok(
    durationMs < 5000,
    `50-resonator in-memory generation took ${durationMs.toFixed(2)}ms (must be well under 5s)`
  );

  console.log(
    `[BENCHMARK] 50 Resonators: ${candidates.length} candidates generated in ${durationMs.toFixed(2)}ms (${(
      (candidates.length / durationMs) *
      1000
    ).toFixed(0)} teams/sec)`
  );
});
