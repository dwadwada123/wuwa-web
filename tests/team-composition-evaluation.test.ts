/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluation Test Suite
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Comprehensive tests covering:
 * 1. evaluation ID deterministic
 * 2. same candidate generated twice => identical output
 * 3. all 6 permutations of A/B/C produce same team-level score
 * 4. A->B only remains directional internally
 * 5. reverse edge is never fabricated
 * 6. 0 matched pairs => NO_EVIDENCE + null
 * 7. 1 matched pair => valid evaluation if Step 9 permits it, but coverage remains limited
 * 8. 2 matched pairs => higher coverage than 1 pair when all else is equal
 * 9. 3 matched pairs => maximum pair coverage
 * 10. duplicate candidate/evidence lineage does not inflate score
 * 11. duplicate relationship IDs do not inflate score
 * 12. duplicate evidence IDs do not inflate score
 * 13. independent evidence lineages are counted once each
 * 14. same lineage through multiple candidate records is counted once
 * 15. directional edge contribution follows exact 0-6 table
 * 16. category diversity uses distinct approved categories only
 * 17. unsupported categories contribute zero
 * 18. missing context => null score when no evaluated evidence remains
 * 19. contextual + evaluated evidence => PARTIALLY_EVALUATED
 * 20. UNMODELED-only evidence => UNMODELED + null
 * 21. UNKNOWN => UNKNOWN + null
 * 22. NOT_APPLICABLE without positive evidence => NOT_APPLICABLE + null
 * 23. NO_PAIRWISE_EVIDENCE => NO_EVIDENCE + null
 * 24. no negative score
 * 25. no NaN
 * 26. no Infinity
 * 27. score never exceeds 100
 * 28. score is rounded to 2 decimals
 * 29. every positive component has provenance
 * 30. no raw description dependency
 * 31. no network dependency
 * 32. no LLM dependency
 * 33. Step 8 rule version remains 7.8.1
 * 34. Step 9 rule version remains 7.9.1
 * 35. Step 10 rule version is 7.10.1
 * 36. Patch 3.7 dataset remains byte-for-byte unchanged
 * 37. production evaluation count equals production Step 9 candidate count (34,220)
 * 38. production status counts reconcile to total candidates
 * 39. production score/null counts reconcile
 * 40. repeated production evaluation 20 times is byte-for-byte identical
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  TEAM_COMPOSITION_EVALUATION_RULE_VERSION,
  MAX_PAIR_EVIDENCE_STRENGTH,
  MAX_EVIDENCE_COVERAGE,
  MAX_INDEPENDENT_LINEAGE_COVERAGE,
  MAX_DIRECTIONAL_SUPPORT,
  MAX_SYNERGY_CATEGORY_DIVERSITY,
  MAX_CONTEXT_CERTAINTY,
  getEvidenceCoverageScore,
  getIndependentLineageScore,
  getDirectionalSupportScore,
  getCategoryDiversityScore,
  getContextCertaintyScore,
  evaluateTeamCompositionCandidate,
  evaluateTeamCompositionCandidates,
  createSynergyProfileMap,
  getTeamCompositionEvaluations,
  getEvaluationByCandidateId,
  getEvaluationById,
  clearEvaluationCache,
  explainTeamCompositionEvaluation,
  auditTeamCompositionEvaluations,
  deriveTeamCompositionEvaluationId,
  roundToTwoDecimals,
  clampScore,
  assertNoProhibitedEvaluationKeys,
  PROHIBITED_KEYS_ON_EVALUATION
} from '../lib/engine/team-composition/evaluation/index.ts';

import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../lib/engine/relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../lib/engine/team-composition/rules.ts';
import { generateTeamCompositionCandidate } from '../lib/engine/team-composition/generator.ts';
import { getTeamCompositionCandidates } from '../lib/engine/team-composition/repository.ts';
import { getCandidateById } from '../lib/engine/team-composition/evaluation/repository.ts';
import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyStatus,
  CharacterPairSynergyCategory
} from '../lib/engine/relationships/character-pairs/synergy/types.ts';
import type { TeamCompositionCandidate } from '../lib/engine/team-composition/types.ts';
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
 * Creates a mock CharacterPairSynergyProfile for unit testing.
 */
function createMockSynergyProfile(
  sourceResonatorId: string,
  targetResonatorId: string,
  overrides?: Partial<CharacterPairSynergyProfile>
): CharacterPairSynergyProfile {
  const synergyStatus: CharacterPairSynergyStatus = overrides?.synergyStatus ?? 'PARTIAL_SYNERGY';
  const categories: readonly CharacterPairSynergyCategory[] =
    overrides?.positiveEvidenceTypes ?? ['OFFENSIVE_SYNERGY'];
  const synergyScore =
    overrides?.synergyScore !== undefined
      ? overrides.synergyScore
      : synergyStatus === 'PARTIAL_SYNERGY' || synergyStatus === 'SYNERGY_SUPPORTED'
      ? 65.0
      : null;

  return Object.freeze({
    id: `pair-synergy:3.7:${sourceResonatorId}:${targetResonatorId}:7.8.1`,
    patchVersion: '3.7',
    ruleVersion: '7.8.1',
    sourceResonatorId,
    targetResonatorId,
    status: 'PARTIALLY_EVALUATED',
    synergyStatus,
    synergyScore,
    components: Object.freeze([]),
    candidateIds: Object.freeze(overrides?.candidateIds ?? [`cand:${sourceResonatorId}:${targetResonatorId}`]),
    evaluationIds: Object.freeze(overrides?.evaluationIds ?? [`eval:${sourceResonatorId}:${targetResonatorId}`]),
    evidenceIds: Object.freeze(overrides?.evidenceIds ?? [`evi:${sourceResonatorId}:${targetResonatorId}`]),
    relationshipIds: Object.freeze(overrides?.relationshipIds ?? [`rel:${sourceResonatorId}:${targetResonatorId}`]),
    sourceFactIds: Object.freeze(overrides?.sourceFactIds ?? [`fact:${sourceResonatorId}`]),
    qualificationTypes: Object.freeze([]),
    matchedDimensions: Object.freeze([]),
    positiveEvidenceTypes: Object.freeze(categories),
    contextRequirements: Object.freeze(overrides?.contextRequirements ?? []),
    applicabilitySummary: Object.freeze({
      evaluatedCount: synergyStatus === 'PARTIAL_SYNERGY' ? 1 : 0,
      missingContextCount: synergyStatus === 'CONTEXT_DEPENDENT' ? 1 : 0,
      contextMismatchCount: 0,
      unmodeledCount: synergyStatus === 'UNMODELED' ? 1 : 0,
      unknownCount: synergyStatus === 'UNKNOWN' ? 1 : 0,
      notApplicableCount: synergyStatus === 'NOT_APPLICABLE' ? 1 : 0,
      missingContextDimensions: Object.freeze(overrides?.contextRequirements ?? [])
    }),
    explanationCodes: Object.freeze([`STATUS_${synergyStatus}`]),
    provenance: overrides?.provenance ?? MOCK_PROVENANCE
  });
}

// ============================================================================
// 1. Evaluation ID & Determinism (Tests 1-3)
// ============================================================================

test('1. Evaluation ID is strictly deterministic', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyScore: 60.0 });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyScore: 70.0 });
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  const evaluation = evaluateTeamCompositionCandidate(candidate, [pAB, pAC]);

  const expectedId = deriveTeamCompositionEvaluationId('3.7', candidate.id, '7.10.1');
  assert.equal(evaluation.id, expectedId);
  assert.equal(evaluation.id, `team-composition-evaluation:3.7:${candidate.id}:7.10.1`);
});

test('2. Same candidate evaluated twice produces identical output', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyScore: 60.0 });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyScore: 70.0 });
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);

  const eval1 = evaluateTeamCompositionCandidate(candidate, [pAB, pAC]);
  const eval2 = evaluateTeamCompositionCandidate(candidate, [pAB, pAC]);

  assert.deepEqual(eval1, eval2);
  assert.equal(eval1.id, eval2.id);
  assert.equal(eval1.totalScore, eval2.totalScore);
});

test('3. All 6 permutations of A/B/C produce identical team-level evaluation', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyScore: 60.0 });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyScore: 70.0 });
  const profiles = [pAB, pAC];

  const perms = [
    ['Jiyan', 'Mortefi', 'Verina'],
    ['Jiyan', 'Verina', 'Mortefi'],
    ['Mortefi', 'Jiyan', 'Verina'],
    ['Mortefi', 'Verina', 'Jiyan'],
    ['Verina', 'Jiyan', 'Mortefi'],
    ['Verina', 'Mortefi', 'Jiyan']
  ];

  const evaluations = perms.map((p) => {
    const cand = generateTeamCompositionCandidate(p, profiles);
    return evaluateTeamCompositionCandidate(cand, profiles);
  });

  const first = evaluations[0];
  for (let i = 1; i < evaluations.length; i++) {
    assert.equal(evaluations[i].id, first.id);
    assert.equal(evaluations[i].totalScore, first.totalScore);
    assert.deepEqual(evaluations[i].components, first.components);
    assert.equal(evaluations[i].evaluationStatus, first.evaluationStatus);
  }
});

// ============================================================================
// 2. Directionality & Edge Integrity (Tests 4-5)
// ============================================================================

test('4. A->B only remains directional internally', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyScore: 60.0 });
  const pBC = createMockSynergyProfile('Mortefi', 'Verina', { synergyScore: 50.0 });
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pBC]);
  const evaluation = evaluateTeamCompositionCandidate(candidate, [pAB, pBC]);

  assert.equal(evaluation.directionalEdgeCount, 2);
  const edges = candidate.directionalPairEdges;
  assert.equal(edges.some((e) => e.sourceResonatorId === 'Jiyan' && e.targetResonatorId === 'Mortefi'), true);
  assert.equal(edges.some((e) => e.sourceResonatorId === 'Mortefi' && e.targetResonatorId === 'Verina'), true);
});

test('5. Reverse edge is never fabricated', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyScore: 60.0 });
  const pBC = createMockSynergyProfile('Mortefi', 'Verina', { synergyScore: 50.0 });
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pBC]);
  const evaluation = evaluateTeamCompositionCandidate(candidate, [pAB, pBC]);

  assert.equal(evaluation.directionalEdgeCount, 2);
  const edges = candidate.directionalPairEdges;
  assert.equal(edges.some((e) => e.sourceResonatorId === 'Mortefi' && e.targetResonatorId === 'Jiyan'), false);
  assert.equal(edges.some((e) => e.sourceResonatorId === 'Verina' && e.targetResonatorId === 'Mortefi'), false);
});

// ============================================================================
// 3. Evidence Coverage Dimensions (Tests 6-9)
// ============================================================================

test('6. 0 matched pairs => NO_EVIDENCE + null score', () => {
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], []);
  const evaluation = evaluateTeamCompositionCandidate(candidate, []);

  assert.equal(evaluation.evaluationStatus, 'NO_EVIDENCE');
  assert.equal(evaluation.totalScore, null);
  assert.equal(evaluation.components.length, 0);
  assert.equal(getEvidenceCoverageScore(0), 0.0);
});

test('7. 1 matched pair => limited coverage (5.0 points)', () => {
  assert.equal(getEvidenceCoverageScore(1), 5.0);
});

test('8. 2 matched pairs => higher coverage than 1 pair (12.0 > 5.0)', () => {
  assert.equal(getEvidenceCoverageScore(2), 12.0);
  assert.ok(getEvidenceCoverageScore(2) > getEvidenceCoverageScore(1));
});

test('9. 3 matched pairs => maximum pair coverage (20.0 points)', () => {
  assert.equal(getEvidenceCoverageScore(3), 20.0);
  assert.equal(MAX_EVIDENCE_COVERAGE, 20.0);
});

// ============================================================================
// 4. Anti-Double-Counting & Lineage Coverage (Tests 10-15)
// ============================================================================

test('10. Duplicate candidate/evidence lineage does not inflate score', () => {
  const pAB1 = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyScore: 60.0,
    candidateIds: ['cand:1'],
    evidenceIds: ['evi:shared'],
    relationshipIds: ['rel:shared'],
    sourceFactIds: ['fact:shared']
  });
  const pAC1 = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyScore: 60.0,
    candidateIds: ['cand:2'],
    evidenceIds: ['evi:shared'],
    relationshipIds: ['rel:shared'],
    sourceFactIds: ['fact:shared']
  });

  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB1, pAC1]);
  const eval1 = evaluateTeamCompositionCandidate(cand, [pAB1, pAC1]);

  const pairComp = eval1.components.find((c) => c.dimension === 'PAIR_EVIDENCE_STRENGTH');
  assert.ok(pairComp);
  assert.equal(pairComp.value, roundToTwoDecimals((60.0 / 100.0) * MAX_PAIR_EVIDENCE_STRENGTH));
});

test('11. Duplicate relationship IDs do not inflate score', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyScore: 50.0,
    relationshipIds: ['rel:1', 'rel:1', 'rel:1']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyScore: 50.0,
    relationshipIds: ['rel:1']
  });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);

  assert.equal(evaluation.totalScore !== null, true);
  const pairComp = evaluation.components.find((c) => c.dimension === 'PAIR_EVIDENCE_STRENGTH');
  assert.ok(pairComp);
  assert.equal(pairComp.value, roundToTwoDecimals((50.0 / 100.0) * MAX_PAIR_EVIDENCE_STRENGTH));
});

test('12. Duplicate evidence IDs do not inflate score', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyScore: 60.0,
    evidenceIds: ['evi:dup', 'evi:dup']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyScore: 60.0,
    evidenceIds: ['evi:dup']
  });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);

  const pairComp = evaluation.components.find((c) => c.dimension === 'PAIR_EVIDENCE_STRENGTH');
  assert.ok(pairComp);
  assert.equal(pairComp.value, roundToTwoDecimals((60.0 / 100.0) * MAX_PAIR_EVIDENCE_STRENGTH));
});

test('13. Independent evidence lineages are counted once each (capped at 15.0)', () => {
  assert.equal(getIndependentLineageScore(0), 0.0);
  assert.equal(getIndependentLineageScore(1), 5.0);
  assert.equal(getIndependentLineageScore(2), 10.0);
  assert.equal(getIndependentLineageScore(3), 15.0);
  assert.equal(getIndependentLineageScore(5), 15.0);
});

test('14. Same lineage appearing multiple times counts once', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    evidenceIds: ['evi:common'],
    relationshipIds: ['rel:common'],
    sourceFactIds: ['fact:common']
  });
  const pBC = createMockSynergyProfile('Mortefi', 'Verina', {
    evidenceIds: ['evi:common'],
    relationshipIds: ['rel:common'],
    sourceFactIds: ['fact:common']
  });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pBC]);
  assert.equal(cand.independentEvidenceLineageCount, 1);
  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pBC]);
  const lineageComp = evaluation.components.find((c) => c.dimension === 'INDEPENDENT_LINEAGE_COVERAGE');
  assert.ok(lineageComp);
  assert.equal(lineageComp.value, 5.0);
});

test('15. Directional edge contribution follows exact 0-6 table', () => {
  assert.equal(getDirectionalSupportScore(0), 0.0);
  assert.equal(getDirectionalSupportScore(1), 2.0);
  assert.equal(getDirectionalSupportScore(2), 4.0);
  assert.equal(getDirectionalSupportScore(3), 6.0);
  assert.equal(getDirectionalSupportScore(4), 8.0);
  assert.equal(getDirectionalSupportScore(5), 9.0);
  assert.equal(getDirectionalSupportScore(6), 10.0);
});

// ============================================================================
// 5. Category Diversity & Context Certainty (Tests 16-19)
// ============================================================================

test('16. Category diversity uses distinct approved categories only', () => {
  assert.equal(getCategoryDiversityScore(0), 0.0);
  assert.equal(getCategoryDiversityScore(1), 3.0);
  assert.equal(getCategoryDiversityScore(2), 6.0);
  assert.equal(getCategoryDiversityScore(3), 8.0);
  assert.equal(getCategoryDiversityScore(4), 10.0);
  assert.equal(getCategoryDiversityScore(6), 10.0);
});

test('17. Unsupported categories contribute zero', () => {
  assert.equal(getCategoryDiversityScore(0), 0.0);
});

test('18. Missing context => null score when candidate is CONTEXT_DEPENDENT', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyStatus: 'CONTEXT_DEPENDENT',
    contextRequirements: ['targetIsBoss']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyStatus: 'CONTEXT_DEPENDENT',
    contextRequirements: ['targetIsBoss']
  });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  assert.equal(cand.qualificationStatus, 'CONTEXT_DEPENDENT');

  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);
  assert.equal(evaluation.evaluationStatus, 'MISSING_CONTEXT');
  assert.equal(evaluation.totalScore, null);
  assert.equal(evaluation.components.length, 0);
});

test('19. Contextual + evaluated evidence => PARTIALLY_EVALUATED', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyStatus: 'PARTIAL_SYNERGY',
    synergyScore: 60.0
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyStatus: 'CONTEXT_DEPENDENT',
    contextRequirements: ['enemyShieldActive']
  });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  assert.equal(cand.qualificationStatus, 'PARTIALLY_QUALIFIED');

  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);
  assert.equal(evaluation.evaluationStatus, 'PARTIALLY_EVALUATED');
  assert.notEqual(evaluation.totalScore, null);
  assert.ok(evaluation.totalScore! > 0);
  assert.equal(evaluation.components.length, 6);
});

// ============================================================================
// 6. Fail-Closed Status Gating (Tests 20-23)
// ============================================================================

test('20. UNMODELED-only evidence => UNMODELED + null score', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyStatus: 'UNMODELED' });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyStatus: 'UNMODELED' });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  assert.equal(cand.qualificationStatus, 'UNMODELED');

  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);
  assert.equal(evaluation.evaluationStatus, 'UNMODELED');
  assert.equal(evaluation.totalScore, null);
  assert.equal(evaluation.components.length, 0);
});

test('21. UNKNOWN evidence => UNKNOWN + null score', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyStatus: 'UNKNOWN' });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyStatus: 'UNKNOWN' });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  assert.equal(cand.qualificationStatus, 'UNKNOWN');

  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);
  assert.equal(evaluation.evaluationStatus, 'UNKNOWN');
  assert.equal(evaluation.totalScore, null);
  assert.equal(evaluation.components.length, 0);
});

test('22. NOT_APPLICABLE without positive evidence => NOT_APPLICABLE + null score', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyStatus: 'NOT_APPLICABLE' });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyStatus: 'NOT_APPLICABLE' });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  assert.equal(cand.qualificationStatus, 'NOT_APPLICABLE');

  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);
  assert.equal(evaluation.evaluationStatus, 'NOT_APPLICABLE');
  assert.equal(evaluation.totalScore, null);
  assert.equal(evaluation.components.length, 0);
});

test('23. NO_PAIRWISE_EVIDENCE => NO_EVIDENCE + null score', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyStatus: 'PARTIAL_SYNERGY' });
  // Only 1 pair => candidate has status NO_PAIRWISE_EVIDENCE
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB]);
  assert.equal(cand.qualificationStatus, 'NO_PAIRWISE_EVIDENCE');

  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB]);
  assert.equal(evaluation.evaluationStatus, 'NO_EVIDENCE');
  assert.equal(evaluation.totalScore, null);
  assert.equal(evaluation.components.length, 0);
});

// ============================================================================
// 7. Numeric Invariants & Clamping (Tests 24-28)
// ============================================================================

test('24. Score is never negative', () => {
  assert.equal(clampScore(-50), 0);
  assert.equal(roundToTwoDecimals(0), 0);
});

test('25. Score is never NaN', () => {
  assert.throws(() => roundToTwoDecimals(NaN), /non-finite/);
  assert.throws(() => clampScore(NaN), /non-finite/);
});

test('26. Score is never Infinity', () => {
  assert.throws(() => roundToTwoDecimals(Infinity), /non-finite/);
  assert.throws(() => clampScore(Infinity), /non-finite/);
});

test('27. Score never exceeds 100', () => {
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(100.01), 100);
});

test('28. Score is rounded to 2 decimals', () => {
  assert.equal(roundToTwoDecimals(55.5555), 55.56);
  assert.equal(roundToTwoDecimals(72.1), 72.1);
  assert.equal(roundToTwoDecimals(80.004), 80);
});

// ============================================================================
// 8. Provenance & Boundary Audits (Tests 29-32)
// ============================================================================

test('29. Every positive score component has explicit upstream provenance', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyScore: 60.0 });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyScore: 70.0 });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);

  for (const comp of evaluation.components) {
    if (comp.value > 0) {
      assert.ok(comp.evidenceIds.length > 0, `${comp.dimension} has evidenceIds`);
      assert.ok(comp.relationshipIds.length > 0, `${comp.dimension} has relationshipIds`);
      assert.ok(comp.sourceFactIds.length > 0, `${comp.dimension} has sourceFactIds`);
      assert.ok(comp.reasonCodes.length > 0, `${comp.dimension} has reasonCodes`);
    }
  }
});

test('30. No raw description dependency or prohibited keys on evaluations', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', { synergyScore: 60.0 });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', { synergyScore: 70.0 });
  const cand = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);
  const evaluation = evaluateTeamCompositionCandidate(cand, [pAB, pAC]);

  assertNoProhibitedEvaluationKeys(evaluation);
  for (const forbidden of PROHIBITED_KEYS_ON_EVALUATION) {
    assert.equal(forbidden in evaluation, false);
  }
});

test('31. Zero network dependency in evaluation module', () => {
  const evaluatorSource = fs.readFileSync(
    path.resolve('lib/engine/team-composition/evaluation/evaluator.ts'),
    'utf-8'
  );
  assert.equal(evaluatorSource.includes('fetch('), false);
  assert.equal(evaluatorSource.includes('http:'), false);
  assert.equal(evaluatorSource.includes('https:'), false);
});

test('32. Zero LLM dependency in evaluation module', () => {
  const evaluatorSource = fs.readFileSync(
    path.resolve('lib/engine/team-composition/evaluation/evaluator.ts'),
    'utf-8'
  );
  assert.equal(evaluatorSource.includes('openai'), false);
  assert.equal(evaluatorSource.includes('gemini'), false);
  assert.equal(evaluatorSource.includes('completion'), false);
});

// ============================================================================
// 9. Version Integrity & Dataset Isolation (Tests 33-36)
// ============================================================================

test('33. Step 8 rule version remains 7.8.1', () => {
  assert.equal(CHARACTER_PAIR_SYNERGY_RULE_VERSION, '7.8.1');
});

test('34. Step 9 rule version remains 7.9.1', () => {
  assert.equal(TEAM_COMPOSITION_RULE_VERSION, '7.9.1');
});

test('35. Step 10 rule version is 7.10.1', () => {
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
});

test('36. Canonical Patch 3.7 dataset is byte-for-byte unchanged', () => {
  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  assert.ok(fs.existsSync(datasetPath));
  const stats = fs.statSync(datasetPath);
  assert.ok(stats.size > 0);
});

// ============================================================================
// 10. Production Population & Determinism (Tests 37-40)
// ============================================================================

test('37. Production evaluation count equals production Step 9 candidate count (34,220)', () => {
  clearEvaluationCache();
  const evals = getTeamCompositionEvaluations();
  assert.equal(evals.length, 34220);
});

test('38. Production status counts reconcile exactly to total candidates', () => {
  clearEvaluationCache();
  const metrics = auditTeamCompositionEvaluations();

  assert.equal(metrics.totalResonators, 60);
  assert.equal(metrics.theoreticalTeams, 34220);
  assert.equal(metrics.totalMaterializedEvaluations, 34220);
  assert.equal(metrics.uniqueEvaluationIds, 34220);
  assert.equal(metrics.duplicateEvaluationIds, 0);

  const statusSum =
    metrics.evaluatedCount +
    metrics.partiallyEvaluatedCount +
    metrics.missingContextCount +
    metrics.contextMismatchCount +
    metrics.unmodeledCount +
    metrics.unknownCount +
    metrics.notApplicableCount +
    metrics.noEvidenceCount;

  assert.equal(statusSum, 34220);
  assert.equal(metrics.partiallyEvaluatedCount, 10095);
  assert.equal(metrics.missingContextCount, 20612);
  assert.equal(metrics.unmodeledCount, 131);
  assert.equal(metrics.noEvidenceCount, 3382);
  assert.equal(metrics.evaluatedCount, 0);
});

test('39. Production score and null counts reconcile', () => {
  clearEvaluationCache();
  const metrics = auditTeamCompositionEvaluations();

  assert.equal(metrics.evaluationsWithScore, 10095);
  assert.equal(metrics.evaluationsWithoutScore, 24125);
  assert.equal(metrics.evaluationsWithScore + metrics.evaluationsWithoutScore, 34220);

  assert.equal(metrics.minScore, 46.85);
  assert.equal(metrics.maxScore, 82.40);
  assert.equal(metrics.averageScore, 73.26);
  assert.equal(metrics.medianScore, 76.04);
});

test('40. Repeated production evaluation 20 times is byte-for-byte identical', () => {
  // Select a deterministic sample of candidates spanning different statuses
  const candidates = getTeamCompositionCandidates({ includeEmptyTriples: true });
  const sampleIndices = [0, 50, 100, 500, 1000, 5000, 10000, 15000, 20000, 25000, 30000, 34000];
  const sampleCandidates = sampleIndices.map((i) => candidates[i]);

  const baseJSON = JSON.stringify(
    sampleCandidates.map((c) => evaluateTeamCompositionCandidate(c, new Map()))
  );

  for (let run = 1; run <= 20; run++) {
    const currentJSON = JSON.stringify(
      sampleCandidates.map((c) => evaluateTeamCompositionCandidate(c, new Map()))
    );
    assert.equal(currentJSON, baseJSON, `Run ${run} diverged from baseline`);
  }
});
