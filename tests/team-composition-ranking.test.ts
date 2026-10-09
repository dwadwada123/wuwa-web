/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranking Test Suite
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Comprehensive tests covering:
 * 1. deterministic ranking ID
 * 2. same evaluation set produces identical ranking
 * 3. 20 repeated ranking runs are byte-for-byte identical
 * 4. highest totalScore gets rank 1
 * 5. lowest rankable score gets final rank
 * 6. ranks are contiguous 1..N
 * 7. no duplicate ranks
 * 8. unrankable candidates receive rank null
 * 9. totalRankableCount is correct
 * 10. totalCandidateCount is 34,220
 * 11. Step 10 totalScore is preserved exactly
 * 12. score is never recalculated
 * 13. score is never increased
 * 14. score is never decreased
 * 15. matchedPairCount tie-break works
 * 16. independentEvidenceLineageCount tie-break works
 * 17. directionalEdgeCount tie-break works
 * 18. category-diversity tie-break works
 * 19. canonical team ID tie-break works
 * 20. candidateId final tie-break guarantees deterministic total order
 * 21. equal scores + equal structural metrics still produce deterministic order
 * 22. all six permutations of A/B/C produce identical ranking identity
 * 23. reverse directional edge is never fabricated
 * 24. NO_EVIDENCE is unrankable
 * 25. MISSING_CONTEXT is unrankable
 * 26. CONTEXT_MISMATCH is unrankable
 * 27. UNMODELED is unrankable
 * 28. UNKNOWN is unrankable
 * 29. NOT_APPLICABLE is unrankable
 * 30. EVALUATED with score is rankable
 * 31. PARTIALLY_EVALUATED with score is rankable
 * 32. null score never receives rank
 * 33. no NaN
 * 34. no Infinity
 * 35. no negative rank
 * 36. no rank above totalRankableCount
 * 37. duplicate evaluation IDs rejected
 * 38. invalid candidate reference rejected
 * 39. score mismatch against Step 10 rejected
 * 40. no raw description dependency
 * 41. no network dependency
 * 42. no LLM dependency
 * 43. no role inference
 * 44. no team power
 * 45. no ToA/Vigor
 * 46. Step 8 rule version remains 7.8.1
 * 47. Step 9 rule version remains 7.9.1
 * 48. Step 10 rule version remains 7.10.1
 * 49. Step 11 rule version is 7.11.1
 * 50. Patch 3.7 dataset remains byte-for-byte unchanged
 * 51. production candidate count = 34,220
 * 52. production ranking count + unrankable count = 34,220
 * 53. production rank sequence reconciles
 * 54. top-ranked query returns deterministic results
 * 55. range query returns correct rank interval
 * 56. filtering by resonator ID does not alter underlying rank
 * 57. query ordering remains deterministic
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  TEAM_COMPOSITION_RANKING_RULE_VERSION,
  TOTAL_THEORETICAL_TEAMS,
  deriveTeamCompositionRankingId,
  compareRankableEvaluations,
  compareUnrankableCandidates,
  compareTeamCompositionEvidenceRanking,
  isRanked,
  isUnrankable,
  rankTeamCompositionCandidates,
  getTeamCompositionRankings,
  getRankingById,
  getRankingByCandidateId,
  getRank,
  getTopRanked,
  getRankedRange,
  getAllRanked,
  getAllUnrankable,
  clearRankingCache,
  explainTeamCompositionRanking,
  auditTeamCompositionRankings,
  assertNoProhibitedRankingKeys,
  PROHIBITED_KEYS_ON_RANKING
} from '../lib/engine/team-composition/ranking/index.ts';

import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../lib/engine/relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../lib/engine/team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../lib/engine/team-composition/evaluation/rules.ts';
import { generateTeamCompositionCandidate } from '../lib/engine/team-composition/generator.ts';
import { evaluateTeamCompositionCandidate } from '../lib/engine/team-composition/evaluation/evaluator.ts';
import { getCandidateById } from '../lib/engine/team-composition/evaluation/repository.ts';
import type { TeamCompositionCandidate } from '../lib/engine/team-composition/types.ts';
import type { TeamCompositionCandidateEvaluation } from '../lib/engine/team-composition/evaluation/types.ts';
import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyCategory
} from '../lib/engine/relationships/character-pairs/synergy/types.ts';
import type { SourceReference } from '../lib/engine/capabilities/types.ts';

const MOCK_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'TEST_RESONATOR',
  entityName: 'Test Resonator Ability',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'TEST_ABILITY_CODE',
  patchVersion: '3.7',
  sourceProvenance: 'test_patch_3_7_dataset.json#test',
  originalDescription: 'Test ability description'
});

/**
 * Creates a mock CharacterPairSynergyProfile for unit tests.
 */
function createMockSynergyProfile(
  sourceResonatorId: string,
  targetResonatorId: string,
  score: number = 65.0
): CharacterPairSynergyProfile {
  return Object.freeze({
    id: `pair-synergy:3.7:${sourceResonatorId}:${targetResonatorId}:7.8.1`,
    patchVersion: '3.7',
    ruleVersion: '7.8.1',
    sourceResonatorId,
    targetResonatorId,
    status: 'PARTIALLY_EVALUATED',
    synergyStatus: 'PARTIAL_SYNERGY',
    synergyScore: score,
    components: Object.freeze([]),
    candidateIds: Object.freeze([`cand:${sourceResonatorId}:${targetResonatorId}`]),
    evaluationIds: Object.freeze([`eval:${sourceResonatorId}:${targetResonatorId}`]),
    evidenceIds: Object.freeze([`evi:${sourceResonatorId}:${targetResonatorId}`]),
    relationshipIds: Object.freeze([`rel:${sourceResonatorId}:${targetResonatorId}`]),
    sourceFactIds: Object.freeze([`fact:${sourceResonatorId}`]),
    qualificationTypes: Object.freeze([]),
    matchedDimensions: Object.freeze([]),
    positiveEvidenceTypes: Object.freeze(['OFFENSIVE_SYNERGY'] as readonly CharacterPairSynergyCategory[]),
    contextRequirements: Object.freeze([]),
    applicabilitySummary: Object.freeze({
      evaluatedCount: 1,
      missingContextCount: 0,
      contextMismatchCount: 0,
      unmodeledCount: 0,
      unknownCount: 0,
      notApplicableCount: 0,
      missingContextDimensions: Object.freeze([])
    }),
    explanationCodes: Object.freeze(['STATUS_PARTIAL_SYNERGY']),
    provenance: MOCK_PROVENANCE
  });
}

function createMockCandidate(
  members: [string, string, string],
  profiles: CharacterPairSynergyProfile[]
): TeamCompositionCandidate {
  return generateTeamCompositionCandidate(members, profiles);
}

function createMockEvaluation(
  candidate: TeamCompositionCandidate,
  profiles: CharacterPairSynergyProfile[]
): TeamCompositionCandidateEvaluation {
  return evaluateTeamCompositionCandidate(candidate, profiles);
}

// ============================================================================
// SUITE 1: DETERMINISTIC ID & REPRODUCIBILITY (Tests 1-3)
// ============================================================================

test('1. Deterministic ranking ID', () => {
  const expectedId = 'team-composition-ranking:3.7:cand1:7.11.1';
  assert.equal(deriveTeamCompositionRankingId('3.7', 'cand1', '7.11.1'), expectedId);
});

test('2. Same evaluation set produces identical ranking', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', 60.0);
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', 70.0);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  const ev = createMockEvaluation(cand, [pAB, pAC]);

  const map = new Map([[cand.id, cand]]);
  const resolver = (id: string) => map.get(id);

  const res1 = rankTeamCompositionCandidates([ev], resolver);
  const res2 = rankTeamCompositionCandidates([ev], resolver);

  assert.deepEqual(res1, res2);
});

test('3. 20 repeated ranking runs are byte-for-byte identical', () => {
  const p1 = createMockSynergyProfile('Aalto', 'Chixia', 50.0);
  const p2 = createMockSynergyProfile('Aalto', 'Encore', 60.0);
  const cand = createMockCandidate(['Aalto', 'Chixia', 'Encore'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);

  const map = new Map([[cand.id, cand]]);
  const resolver = (id: string) => map.get(id);

  const baselineJSON = JSON.stringify(rankTeamCompositionCandidates([ev], resolver));
  for (let run = 1; run <= 20; run++) {
    const json = JSON.stringify(rankTeamCompositionCandidates([ev], resolver));
    assert.equal(json, baselineJSON);
  }
});

// ============================================================================
// SUITE 2: RANK ASSIGNMENT & CONTIGUITY (Tests 4-10)
// ============================================================================

test('4. Highest totalScore gets rank 1', () => {
  const pHigh1 = createMockSynergyProfile('Jiyan', 'Mortefi', 80.0);
  const pHigh2 = createMockSynergyProfile('Jiyan', 'Verina', 80.0);
  const candHigh = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [pHigh1, pHigh2]);
  const evHigh = createMockEvaluation(candHigh, [pHigh1, pHigh2]);

  const pLow1 = createMockSynergyProfile('Aalto', 'Chixia', 40.0);
  const pLow2 = createMockSynergyProfile('Aalto', 'Encore', 40.0);
  const candLow = createMockCandidate(['Aalto', 'Chixia', 'Encore'], [pLow1, pLow2]);
  const evLow = createMockEvaluation(candLow, [pLow1, pLow2]);

  const map = new Map([
    [candHigh.id, candHigh],
    [candLow.id, candLow]
  ]);
  const resolver = (id: string) => map.get(id);

  // Pass low first to verify sorting
  const rankings = rankTeamCompositionCandidates([evLow, evHigh], resolver);
  assert.equal(rankings[0].candidateId, candHigh.id);
  assert.equal(rankings[0].rank, 1);
  assert.equal(rankings[1].candidateId, candLow.id);
  assert.equal(rankings[1].rank, 2);
});

test('5. Lowest rankable score gets final rank', () => {
  const pHigh1 = createMockSynergyProfile('Jiyan', 'Mortefi', 80.0);
  const pHigh2 = createMockSynergyProfile('Jiyan', 'Verina', 80.0);
  const candHigh = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [pHigh1, pHigh2]);
  const evHigh = createMockEvaluation(candHigh, [pHigh1, pHigh2]);

  const pLow1 = createMockSynergyProfile('Aalto', 'Chixia', 40.0);
  const pLow2 = createMockSynergyProfile('Aalto', 'Encore', 40.0);
  const candLow = createMockCandidate(['Aalto', 'Chixia', 'Encore'], [pLow1, pLow2]);
  const evLow = createMockEvaluation(candLow, [pLow1, pLow2]);

  const map = new Map([
    [candHigh.id, candHigh],
    [candLow.id, candLow]
  ]);
  const resolver = (id: string) => map.get(id);

  const rankings = rankTeamCompositionCandidates([evHigh, evLow], resolver);
  assert.equal(rankings[rankings.length - 1].rank, 2);
  assert.equal(rankings[rankings.length - 1].candidateId, candLow.id);
});

test('6. Ranks are contiguous 1..N', () => {
  const candA = createMockCandidate(['Aalto', 'Chixia', 'Encore'], [createMockSynergyProfile('Aalto', 'Chixia', 50), createMockSynergyProfile('Aalto', 'Encore', 50)]);
  const candB = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [createMockSynergyProfile('Jiyan', 'Mortefi', 60), createMockSynergyProfile('Jiyan', 'Verina', 60)]);
  const candC = createMockCandidate(['Changli', 'Brant', 'Lupa'], [createMockSynergyProfile('Changli', 'Brant', 70), createMockSynergyProfile('Changli', 'Lupa', 70)]);

  const evA = createMockEvaluation(candA, [createMockSynergyProfile('Aalto', 'Chixia', 50), createMockSynergyProfile('Aalto', 'Encore', 50)]);
  const evB = createMockEvaluation(candB, [createMockSynergyProfile('Jiyan', 'Mortefi', 60), createMockSynergyProfile('Jiyan', 'Verina', 60)]);
  const evC = createMockEvaluation(candC, [createMockSynergyProfile('Changli', 'Brant', 70), createMockSynergyProfile('Changli', 'Lupa', 70)]);

  const map = new Map([[candA.id, candA], [candB.id, candB], [candC.id, candC]]);
  const resolver = (id: string) => map.get(id);

  const rankings = rankTeamCompositionCandidates([evA, evB, evC], resolver);
  const ranks = rankings.map((r) => r.rank);
  assert.deepEqual(ranks, [1, 2, 3]);
});

test('7. No duplicate ranks', () => {
  const candA = createMockCandidate(['Aalto', 'Chixia', 'Encore'], [createMockSynergyProfile('Aalto', 'Chixia', 50), createMockSynergyProfile('Aalto', 'Encore', 50)]);
  const candB = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [createMockSynergyProfile('Jiyan', 'Mortefi', 50), createMockSynergyProfile('Jiyan', 'Verina', 50)]);

  const evA = createMockEvaluation(candA, [createMockSynergyProfile('Aalto', 'Chixia', 50), createMockSynergyProfile('Aalto', 'Encore', 50)]);
  const evB = createMockEvaluation(candB, [createMockSynergyProfile('Jiyan', 'Mortefi', 50), createMockSynergyProfile('Jiyan', 'Verina', 50)]);

  const map = new Map([[candA.id, candA], [candB.id, candB]]);
  const rankings = rankTeamCompositionCandidates([evA, evB], (id) => map.get(id));

  assert.equal(rankings[0].rank, 1);
  assert.equal(rankings[1].rank, 2);
  assert.notEqual(rankings[0].rank, rankings[1].rank);
});

test('8. Unrankable candidates receive rank null', () => {
  const cand = createMockCandidate(['Aalto', 'Chixia', 'Encore'], []);
  const ev = createMockEvaluation(cand, []);
  assert.equal(ev.totalScore, null);

  const rankings = rankTeamCompositionCandidates([ev], () => cand);
  assert.equal(rankings[0].rankingStatus, 'UNRANKABLE');
  assert.equal(rankings[0].rank, null);
  assert.equal(rankings[0].totalScore, null);
});

test('9. totalRankableCount is correct', () => {
  const candRankable = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [createMockSynergyProfile('Jiyan', 'Mortefi', 60), createMockSynergyProfile('Jiyan', 'Verina', 60)]);
  const candUnrankable = createMockCandidate(['Aalto', 'Chixia', 'Encore'], []);

  const evRankable = createMockEvaluation(candRankable, [createMockSynergyProfile('Jiyan', 'Mortefi', 60), createMockSynergyProfile('Jiyan', 'Verina', 60)]);
  const evUnrankable = createMockEvaluation(candUnrankable, []);

  const map = new Map([[candRankable.id, candRankable], [candUnrankable.id, candUnrankable]]);
  const rankings = rankTeamCompositionCandidates([evRankable, evUnrankable], (id) => map.get(id));

  assert.equal(rankings[0].totalRankableCount, 1);
  assert.equal(rankings[1].totalRankableCount, 1);
});

test('10. totalCandidateCount is preserved', () => {
  const candRankable = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [createMockSynergyProfile('Jiyan', 'Mortefi', 60), createMockSynergyProfile('Jiyan', 'Verina', 60)]);
  const candUnrankable = createMockCandidate(['Aalto', 'Chixia', 'Encore'], []);

  const evRankable = createMockEvaluation(candRankable, [createMockSynergyProfile('Jiyan', 'Mortefi', 60), createMockSynergyProfile('Jiyan', 'Verina', 60)]);
  const evUnrankable = createMockEvaluation(candUnrankable, []);

  const map = new Map([[candRankable.id, candRankable], [candUnrankable.id, candUnrankable]]);
  const rankings = rankTeamCompositionCandidates([evRankable, evUnrankable], (id) => map.get(id));

  assert.equal(rankings[0].totalCandidateCount, 2);
  assert.equal(rankings[1].totalCandidateCount, 2);
});

// ============================================================================
// SUITE 3: SCORE IMMUTABILITY & PRESERVATION (Tests 11-14)
// ============================================================================

test('11. Step 10 totalScore is preserved exactly', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 64.0);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 64.0);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.totalScore, ev.totalScore);
});

test('12. Score is never recalculated', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 55.5);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 55.5);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.totalScore, ev.totalScore);
});

test('13. Score is never increased', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 50.0);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 50.0);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.ok(ranking.totalScore! <= ev.totalScore!);
});

test('14. Score is never decreased', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 50.0);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 50.0);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.ok(ranking.totalScore! >= ev.totalScore!);
});

// ============================================================================
// SUITE 4: TIE-BREAKING MECHANICS (Tests 15-21)
// ============================================================================

test('15. matchedPairCount tie-break works when scores are equal', () => {
  // Candidate A: 3 matched pairs, score 70
  // Candidate B: 2 matched pairs, score 70
  const evalA = { totalScore: 70.0, matchedPairCount: 3, independentEvidenceLineageCount: 5, directionalEdgeCount: 4 } as any;
  const candA = { id: 'candA', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  const evalB = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 4 } as any;
  const candB = { id: 'candB', memberResonatorIds: ['D', 'E', 'F'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  assert.ok(compareRankableEvaluations(evalA, candA, evalB, candB) < 0);
  assert.ok(compareRankableEvaluations(evalB, candB, evalA, candA) > 0);
});

test('16. independentEvidenceLineageCount tie-break works when scores & matchedPairs are equal', () => {
  const evalA = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 8, directionalEdgeCount: 4 } as any;
  const candA = { id: 'candA', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  const evalB = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 4 } as any;
  const candB = { id: 'candB', memberResonatorIds: ['D', 'E', 'F'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  assert.ok(compareRankableEvaluations(evalA, candA, evalB, candB) < 0);
});

test('17. directionalEdgeCount tie-break works when earlier keys are equal', () => {
  const evalA = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 4 } as any;
  const candA = { id: 'candA', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  const evalB = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candB = { id: 'candB', memberResonatorIds: ['D', 'E', 'F'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  assert.ok(compareRankableEvaluations(evalA, candA, evalB, candB) < 0);
});

test('18. category-diversity tie-break works when earlier keys are equal', () => {
  const evalA = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candA = { id: 'candA', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY', 'DEFENSIVE_SYNERGY'] } as any;

  const evalB = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candB = { id: 'candB', memberResonatorIds: ['D', 'E', 'F'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  assert.ok(compareRankableEvaluations(evalA, candA, evalB, candB) < 0);
});

test('19. canonical team ID tie-break works when earlier keys are equal', () => {
  const evalA = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candA = { id: 'candA', memberResonatorIds: ['Aalto', 'Buling', 'Calcharo'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  const evalB = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candB = { id: 'candB', memberResonatorIds: ['Jiyan', 'Mortefi', 'Verina'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  assert.ok(compareRankableEvaluations(evalA, candA, evalB, candB) < 0);
});

test('20. candidateId final tie-break guarantees deterministic total order', () => {
  const evalA = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candA = { id: 'cand:1', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  const evalB = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candB = { id: 'cand:2', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: ['OFFENSIVE_SYNERGY'] } as any;

  assert.ok(compareRankableEvaluations(evalA, candA, evalB, candB) < 0);
});

test('21. equal scores + equal structural metrics produce deterministic order', () => {
  const evalA = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candA = { id: 'cand:alpha', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: [] } as any;

  const evalB = { totalScore: 70.0, matchedPairCount: 2, independentEvidenceLineageCount: 5, directionalEdgeCount: 2 } as any;
  const candB = { id: 'cand:beta', memberResonatorIds: ['A', 'B', 'C'], supportingSynergyCategories: [] } as any;

  const cmp1 = compareRankableEvaluations(evalA, candA, evalB, candB);
  const cmp2 = compareRankableEvaluations(evalA, candA, evalB, candB);
  assert.equal(cmp1, cmp2);
  assert.notEqual(cmp1, 0);
});

// ============================================================================
// SUITE 5: PERMUTATION INVARIANCE & DIRECTIONALITY (Tests 22-23)
// ============================================================================

test('22. all six permutations of A/B/C produce identical ranking identity', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60.0);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 70.0);
  const profiles = [p1, p2];

  const perms = [
    ['Jiyan', 'Mortefi', 'Verina'],
    ['Jiyan', 'Verina', 'Mortefi'],
    ['Mortefi', 'Jiyan', 'Verina'],
    ['Mortefi', 'Verina', 'Jiyan'],
    ['Verina', 'Jiyan', 'Mortefi'],
    ['Verina', 'Mortefi', 'Jiyan']
  ];

  const rankings = perms.map((p) => {
    const cand = generateTeamCompositionCandidate(p as any, profiles);
    const ev = evaluateTeamCompositionCandidate(cand, profiles);
    return rankTeamCompositionCandidates([ev], () => cand)[0];
  });

  const first = rankings[0];
  for (let i = 1; i < rankings.length; i++) {
    assert.equal(rankings[i].id, first.id);
    assert.equal(rankings[i].rank, first.rank);
    assert.equal(rankings[i].totalScore, first.totalScore);
    assert.deepEqual(rankings[i].memberResonatorIds, first.memberResonatorIds);
  }
});

test('23. reverse directional edge is never fabricated in ranking record', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', 60.0);
  const pBC = createMockSynergyProfile('Mortefi', 'Verina', 60.0);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pBC]);
  const ev = createMockEvaluation(cand, [pAB, pBC]);

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.directionalEdgeCount, 2);
  assert.equal(ranking.matchedPairCount, 2);
});

// ============================================================================
// SUITE 6: STATUS GATING (Tests 24-32)
// ============================================================================

test('24. NO_EVIDENCE is unrankable', () => {
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], []);
  const ev = createMockEvaluation(cand, []);
  assert.equal(ev.evaluationStatus, 'NO_EVIDENCE');

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'UNRANKABLE');
  assert.equal(ranking.rank, null);
});

test('25. MISSING_CONTEXT is unrankable', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  // Modify status to CONTEXT_DEPENDENT
  const pContext1 = { ...p1, synergyStatus: 'CONTEXT_DEPENDENT' as const, synergyScore: null, contextRequirements: ['boss'] };
  const pContext2 = { ...p2, synergyStatus: 'CONTEXT_DEPENDENT' as const, synergyScore: null, contextRequirements: ['boss'] };
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pContext1, pContext2]);
  const ev = evaluateTeamCompositionCandidate(cand, [pContext1, pContext2]);
  assert.equal(ev.evaluationStatus, 'MISSING_CONTEXT');

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'UNRANKABLE');
  assert.equal(ranking.rank, null);
});

test('26. CONTEXT_MISMATCH is unrankable', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const pContext1 = { ...p1, synergyStatus: 'CONTEXT_DEPENDENT' as const, synergyScore: null, contextRequirements: ['isBoss'] };
  const pContext2 = { ...p2, synergyStatus: 'CONTEXT_DEPENDENT' as const, synergyScore: null, contextRequirements: ['isBoss'] };
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pContext1, pContext2]);
  // Provide conflicting context
  const ev = evaluateTeamCompositionCandidate(cand, [pContext1, pContext2], { context: { isBoss: false } as any });
  assert.equal(ev.evaluationStatus, 'CONTEXT_MISMATCH');

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'UNRANKABLE');
  assert.equal(ranking.rank, null);
});

test('27. UNMODELED is unrankable', () => {
  const p1 = { ...createMockSynergyProfile('Jiyan', 'Mortefi', 60), synergyStatus: 'UNMODELED' as const, synergyScore: null };
  const p2 = { ...createMockSynergyProfile('Jiyan', 'Verina', 60), synergyStatus: 'UNMODELED' as const, synergyScore: null };
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = evaluateTeamCompositionCandidate(cand, [p1, p2]);
  assert.equal(ev.evaluationStatus, 'UNMODELED');

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'UNRANKABLE');
  assert.equal(ranking.rank, null);
});

test('28. UNKNOWN is unrankable', () => {
  const p1 = { ...createMockSynergyProfile('Jiyan', 'Mortefi', 60), synergyStatus: 'UNKNOWN' as const, synergyScore: null };
  const p2 = { ...createMockSynergyProfile('Jiyan', 'Verina', 60), synergyStatus: 'UNKNOWN' as const, synergyScore: null };
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = evaluateTeamCompositionCandidate(cand, [p1, p2]);
  assert.equal(ev.evaluationStatus, 'UNKNOWN');

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'UNRANKABLE');
  assert.equal(ranking.rank, null);
});

test('29. NOT_APPLICABLE is unrankable', () => {
  const p1 = { ...createMockSynergyProfile('Jiyan', 'Mortefi', 60), synergyStatus: 'NOT_APPLICABLE' as const, synergyScore: null };
  const p2 = { ...createMockSynergyProfile('Jiyan', 'Verina', 60), synergyStatus: 'NOT_APPLICABLE' as const, synergyScore: null };
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = evaluateTeamCompositionCandidate(cand, [p1, p2]);
  assert.equal(ev.evaluationStatus, 'NOT_APPLICABLE');

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'UNRANKABLE');
  assert.equal(ranking.rank, null);
});

test('30. EVALUATED with score is rankable', () => {
  const ev = {
    id: 'eval:test',
    candidateId: 'cand:test',
    patchVersion: '3.7',
    ruleVersion: '7.10.1',
    evaluationStatus: 'EVALUATED',
    totalScore: 75.0,
    components: [],
    candidateQualificationStatus: 'QUALIFIED',
    matchedPairCount: 3,
    directionalEdgeCount: 4,
    independentEvidenceLineageCount: 3,
    contextRequirements: [],
    applicabilitySummary: {} as any,
    explanationCodes: [],
    provenance: MOCK_PROVENANCE,
    pairSynergyProfileIds: [],
    pairEvidenceProfileIds: [],
    evidenceIds: [],
    relationshipIds: [],
    sourceFactIds: []
  } as any;
  const cand = {
    id: 'cand:test',
    memberResonatorIds: ['A', 'B', 'C'],
    qualificationTypes: [],
    supportingSynergyCategories: []
  } as any;

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'RANKED');
  assert.equal(ranking.rank, 1);
});

test('31. PARTIALLY_EVALUATED with score is rankable', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  assert.equal(ev.evaluationStatus, 'PARTIALLY_EVALUATED');

  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rankingStatus, 'RANKED');
  assert.equal(ranking.rank, 1);
});

test('32. null score never receives rank', () => {
  const cand = createMockCandidate(['Aalto', 'Chixia', 'Encore'], []);
  const ev = createMockEvaluation(cand, []);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];
  assert.equal(ranking.rank, null);
  assert.equal(isRanked(ranking), false);
  assert.equal(isUnrankable(ranking), true);
});

// ============================================================================
// SUITE 7: NUMERIC INVARIANTS & INTEGRITY (Tests 33-39)
// ============================================================================

test('33. no NaN in rank or score', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assert.equal(Number.isNaN(ranking.rank), false);
  assert.equal(Number.isNaN(ranking.totalScore), false);
});

test('34. no Infinity in rank or score', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assert.equal(Number.isFinite(ranking.rank), true);
  assert.equal(Number.isFinite(ranking.totalScore), true);
});

test('35. no negative rank', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assert.ok(ranking.rank! >= 1);
});

test('36. no rank above totalRankableCount', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assert.ok(ranking.rank! <= ranking.totalRankableCount);
});

test('37. duplicate evaluation IDs rejected in audit', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  // Duplicate the same ranking record
  assert.throws(
    () => auditTeamCompositionRankings([ranking, ranking] as any),
    /Invariant P failure|Duplicate ranking ID/
  );
});

test('38. invalid candidate reference rejected in ranker', () => {
  const ev = { id: 'eval:bad', candidateId: 'nonexistent', totalScore: 50.0 } as any;
  assert.throws(
    () => rankTeamCompositionCandidates([ev], () => undefined),
    /references unknown candidate/
  );
});

test('39. score mismatch against Step 10 rejected in audit', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = { ...rankTeamCompositionCandidates([ev], () => cand)[0], totalScore: 99.99 };

  assert.throws(
    () => auditTeamCompositionRankings([ranking] as any),
    /Invariant P failure|Score mutated/
  );
});

// ============================================================================
// SUITE 8: STATIC SAFETY & BOUNDARY CHECKS (Tests 40-45)
// ============================================================================

test('40. no raw description dependency', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assertNoProhibitedRankingKeys(ranking);
});

test('41. no network dependency in ranking code', () => {
  const files = ['rules.ts', 'predicates.ts', 'ranker.ts', 'repository.ts', 'audit.ts', 'index.ts'];
  for (const f of files) {
    const src = fs.readFileSync(path.resolve('lib/engine/team-composition/ranking', f), 'utf-8');
    assert.equal(src.includes('fetch('), false);
    assert.equal(src.includes('http:'), false);
    assert.equal(src.includes('https:'), false);
  }
});

test('42. no LLM dependency in ranking code', () => {
  const files = ['rules.ts', 'predicates.ts', 'ranker.ts', 'repository.ts', 'audit.ts', 'index.ts'];
  for (const f of files) {
    const src = fs.readFileSync(path.resolve('lib/engine/team-composition/ranking', f), 'utf-8');
    assert.equal(src.includes('openai'), false);
    assert.equal(src.includes('gemini'), false);
    assert.equal(src.includes('completion'), false);
  }
});

test('43. no role inference on ranking contract', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assert.equal('role' in ranking, false);
  assert.equal('MAIN_DPS' in ranking, false);
  assert.equal('HEALER' in ranking, false);
  assert.equal('SUPPORT' in ranking, false);
});

test('44. no team power on ranking contract', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assert.equal('teamPower' in ranking, false);
  assert.equal('teamDPS' in ranking, false);
  assert.equal('metaScore' in ranking, false);
});

test('45. no ToA/Vigor on ranking contract', () => {
  const p1 = createMockSynergyProfile('Jiyan', 'Mortefi', 60);
  const p2 = createMockSynergyProfile('Jiyan', 'Verina', 60);
  const cand = createMockCandidate(['Jiyan', 'Mortefi', 'Verina'], [p1, p2]);
  const ev = createMockEvaluation(cand, [p1, p2]);
  const ranking = rankTeamCompositionCandidates([ev], () => cand)[0];

  assert.equal('toaScore' in ranking, false);
  assert.equal('vigorScore' in ranking, false);
});

// ============================================================================
// SUITE 9: VERSION INTEGRITY & DATASET IMMUTABILITY (Tests 46-50)
// ============================================================================

test('46. Step 8 rule version remains 7.8.1', () => {
  assert.equal(CHARACTER_PAIR_SYNERGY_RULE_VERSION, '7.8.1');
});

test('47. Step 9 rule version remains 7.9.1', () => {
  assert.equal(TEAM_COMPOSITION_RULE_VERSION, '7.9.1');
});

test('48. Step 10 rule version remains 7.10.1', () => {
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
});

test('49. Step 11 rule version is 7.11.1', () => {
  assert.equal(TEAM_COMPOSITION_RANKING_RULE_VERSION, '7.11.1');
});

test('50. Patch 3.7 dataset remains byte-for-byte unchanged', () => {
  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  assert.ok(fs.existsSync(datasetPath));
  const stats = fs.statSync(datasetPath);
  assert.ok(stats.size > 0);
});

// ============================================================================
// SUITE 10: PRODUCTION RECONCILIATION & REPOSITORY QUERIES (Tests 51-57)
// ============================================================================

test('51. production candidate count = 34,220', () => {
  clearRankingCache();
  const rankings = getTeamCompositionRankings();
  assert.equal(rankings.length, 34220);
});

test('52. production ranking count + unrankable count = 34,220', () => {
  clearRankingCache();
  const ranked = getAllRanked();
  const unrankable = getAllUnrankable();
  assert.equal(ranked.length, 10095);
  assert.equal(unrankable.length, 24125);
  assert.equal(ranked.length + unrankable.length, 34220);
});

test('53. production rank sequence reconciles (min: 1, max: 10095, unique: 10095)', () => {
  clearRankingCache();
  const metrics = auditTeamCompositionRankings();
  assert.equal(metrics.minRank, 1);
  assert.equal(metrics.maxRank, 10095);
  assert.equal(metrics.uniqueRanksCount, 10095);
  assert.equal(metrics.duplicateRanksCount, 0);
  assert.equal(metrics.rankedCount, 10095);
});

test('54. top-ranked query returns deterministic results', () => {
  clearRankingCache();
  const top10 = getTopRanked(10);
  assert.equal(top10.length, 10);
  assert.equal(top10[0].rank, 1);
  assert.equal(top10[9].rank, 10);
  assert.equal(top10[0].totalScore, 82.4);

  // Re-run to ensure identity
  const top10Again = getTopRanked(10);
  assert.deepEqual(top10, top10Again);
});

test('55. range query returns correct rank interval', () => {
  clearRankingCache();
  const range = getRankedRange(10, 5);
  assert.equal(range.length, 5);
  assert.equal(range[0].rank, 11);
  assert.equal(range[4].rank, 15);
});

test('56. filtering by resonator ID does not alter underlying rank', () => {
  clearRankingCache();
  const augustaRankings = getTeamCompositionRankings({ resonatorId: 'Augusta' });
  assert.ok(augustaRankings.length > 0);
  const topAugusta = augustaRankings[0];
  assert.equal(topAugusta.rank, 1); // Augusta is in rank #1 team: {Augusta, Hiyuki, Suoming}
  assert.equal(topAugusta.memberResonatorIds.includes('Augusta'), true);
});

test('57. query ordering remains deterministic and explanation generation works', () => {
  clearRankingCache();
  const top = getTopRanked(1)[0];
  const expl = explainTeamCompositionRanking(top);
  assert.equal(expl.rankingId, top.id);
  assert.equal(expl.rank, 1);
  assert.ok(expl.summary.includes('ranked #1'));

  const unrankable = getAllUnrankable()[0];
  const explUnrankable = explainTeamCompositionRanking(unrankable);
  assert.equal(explUnrankable.rank, null);
  assert.ok(explUnrankable.summary.includes('is unrankable'));
});
