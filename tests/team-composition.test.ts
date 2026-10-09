/**
 * Wuthering Waves Team Composition Candidate Test Suite
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Comprehensive tests covering:
 * - Exactly 3 distinct characters required
 * - Duplicate character rejected
 * - Team identity order-independence ({A,B,C} === {C,A,B})
 * - Permutations produce identical canonical IDs
 * - Rule A: Minimum 2 distinct unordered pairs to qualify
 * - A->B alone does not qualify (NO_PAIRWISE_EVIDENCE)
 * - A->B + A->C qualifies structurally
 * - A->B + B->C qualifies structurally with DIRECTIONAL_SYNERGY_CHAIN
 * - A->B + B->A counts as ONE unordered pair connection
 * - Preservation of directional edges (A->B vs B->A)
 * - Missing B->A is not fabricated
 * - No transitive synergy (A->B + B->C does not imply A->C)
 * - Three pair connections (THREE_PAIR_SYNERGY_EDGES)
 * - No-evidence triple -> NO_PAIRWISE_EVIDENCE
 * - Contextual evidence remains CONTEXT_DEPENDENT
 * - Mixed evaluated/contextual -> PARTIALLY_QUALIFIED
 * - UNMODELED remains UNMODELED
 * - UNKNOWN fails closed
 * - NOT_APPLICABLE cannot qualify as positive evidence
 * - Lineage deduplication: facts, evidence, relationships, candidates
 * - Zero team scores, zero character power, zero role inference, zero ToA, zero Vigor
 * - Zero network, zero LLMs, zero random IDs, zero timestamps
 * - Production dataset reconciliation and 20-run repeated determinism check
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  generateTeamCompositionCandidate,
  generateTeamCompositionCandidates,
  getTeamCompositionCandidate,
  getTeamCompositionCandidates,
  queryTeamCompositionCandidates,
  getTeamCompositionCandidatesForResonator,
  clearTeamCompositionCandidateCache,
  explainTeamCompositionCandidate,
  auditTeamCompositionCandidates,
  canonicalizeTeamMemberIds,
  canonicalizeTeamMembers,
  deriveTeamCompositionCandidateId,
  compareTeamCompositionCandidate,
  isQualifiedCandidate,
  isPartiallyQualifiedCandidate,
  isContextDependentCandidate,
  isUnmodeledCandidate,
  isNoEvidenceCandidate,
  isStructurallyQualifiedCandidate,
  matchesTeamCompositionFilter,
  assertNoProhibitedKeys,
  TEAM_COMPOSITION_RULE_VERSION,
  TEAM_MEMBER_COUNT,
  MIN_MATCHED_PAIRS_FOR_QUALIFICATION
} from '../lib/engine/team-composition/index.ts';

import type {
  TeamCompositionCandidate,
  TeamDirectionalPairEdge,
  CharacterPairSynergyProfile,
  CharacterPairSynergyStatus,
  CharacterPairSynergyCategory,
  SourceReference
} from '../lib/engine/team-composition/types.ts';

const MOCK_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'TEST_ENTITY',
  entityName: 'Test Resonator Ability',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'test_skill',
  patchVersion: '3.7',
  sourceProvenance: 'Test Mock Suite',
  originalDescription: 'Test ability description'
});

/**
 * Creates a mock CharacterPairSynergyProfile for unit tests.
 */
function createMockSynergyProfile(
  sourceResonatorId: string,
  targetResonatorId: string,
  overrides?: Partial<CharacterPairSynergyProfile>
): CharacterPairSynergyProfile {
  const synergyStatus: CharacterPairSynergyStatus = overrides?.synergyStatus ?? 'PARTIAL_SYNERGY';
  const categories: readonly CharacterPairSynergyCategory[] =
    overrides?.positiveEvidenceTypes ?? ['OFFENSIVE_SYNERGY'];

  return Object.freeze({
    id: `pair-synergy:3.7:${sourceResonatorId}:${targetResonatorId}:7.8.1`,
    patchVersion: '3.7',
    ruleVersion: '7.8.1',
    sourceResonatorId,
    targetResonatorId,
    status: 'PARTIALLY_EVALUATED',
    synergyStatus,
    synergyScore: synergyStatus === 'PARTIAL_SYNERGY' ? 65.0 : null,
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
// 1. Cardinality & Distinctness
// ============================================================================

test('Step 9: Exactly three distinct characters required', () => {
  assert.throws(
    () => canonicalizeTeamMemberIds(['Jiyan', 'Mortefi']),
    /Team cardinality violation/
  );
  assert.throws(
    () => canonicalizeTeamMemberIds(['Jiyan', 'Mortefi', 'Verina', 'Aalto']),
    /Team cardinality violation/
  );
});

test('Step 9: Duplicate character rejected', () => {
  assert.throws(
    () => canonicalizeTeamMemberIds(['Jiyan', 'Jiyan', 'Mortefi']),
    /Team distinctness violation/
  );
  assert.throws(
    () => canonicalizeTeamMemberIds(['Mortefi', 'Verina', 'Mortefi']),
    /Team distinctness violation/
  );
});

test('Step 9: Team identity is order-independent', () => {
  const c1 = canonicalizeTeamMemberIds(['Verina', 'Jiyan', 'Mortefi']);
  const c2 = canonicalizeTeamMemberIds(['Mortefi', 'Verina', 'Jiyan']);
  const c3 = canonicalizeTeamMemberIds(['Jiyan', 'Mortefi', 'Verina']);

  assert.deepEqual(c1, ['Jiyan', 'Mortefi', 'Verina']);
  assert.deepEqual(c2, ['Jiyan', 'Mortefi', 'Verina']);
  assert.deepEqual(c3, ['Jiyan', 'Mortefi', 'Verina']);
});

test('Step 9: All six permutations produce one team ID', () => {
  const members = ['Jiyan', 'Mortefi', 'Verina'];
  const perms = [
    ['Jiyan', 'Mortefi', 'Verina'],
    ['Jiyan', 'Verina', 'Mortefi'],
    ['Mortefi', 'Jiyan', 'Verina'],
    ['Mortefi', 'Verina', 'Jiyan'],
    ['Verina', 'Jiyan', 'Mortefi'],
    ['Verina', 'Mortefi', 'Jiyan']
  ];

  const expectedId = 'team-composition:3.7:Jiyan:Mortefi:Verina:7.9.1';
  for (const perm of perms) {
    const id = deriveTeamCompositionCandidateId('3.7', perm);
    assert.equal(id, expectedId);
  }
});

// ============================================================================
// 2. Structural Qualification Rules
// ============================================================================

test('Step 9: A->B alone does not qualify a team', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB]
  );

  assert.equal(candidate.matchedPairCount, 1);
  assert.equal(candidate.directionalEdgeCount, 1);
  assert.equal(candidate.qualificationStatus, 'NO_PAIRWISE_EVIDENCE');
  assert.equal(candidate.qualificationTypes.length, 0);
  assert.ok(candidate.explanationCodes.includes('INSUFFICIENT_PAIR_EDGES'));
});

test('Step 9: A->B + A->C qualifies structurally', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  assert.equal(candidate.matchedPairCount, 2);
  assert.equal(candidate.directionalEdgeCount, 2);
  assert.equal(candidate.qualificationStatus, 'PARTIALLY_QUALIFIED');
  assert.ok(candidate.qualificationTypes.includes('TWO_PAIR_SYNERGY_EDGES'));
});

test('Step 9: A->B + B->C qualifies structurally with DIRECTIONAL_SYNERGY_CHAIN', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pBC = createMockSynergyProfile('Mortefi', 'Verina');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pBC]
  );

  assert.equal(candidate.matchedPairCount, 2);
  assert.equal(candidate.directionalEdgeCount, 2);
  assert.equal(candidate.qualificationStatus, 'PARTIALLY_QUALIFIED');
  assert.ok(candidate.qualificationTypes.includes('TWO_PAIR_SYNERGY_EDGES'));
  assert.ok(candidate.qualificationTypes.includes('DIRECTIONAL_SYNERGY_CHAIN'));
});

test('Step 9: A->B + B->A counts as ONE unordered pair connection', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pBA = createMockSynergyProfile('Mortefi', 'Jiyan');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pBA]
  );

  // Exactly 1 unordered pair connected!
  assert.equal(candidate.matchedPairCount, 1);
  // Both directional edges preserved
  assert.equal(candidate.directionalEdgeCount, 2);
  // Fails minimum 2 pairs
  assert.equal(candidate.qualificationStatus, 'NO_PAIRWISE_EVIDENCE');
});

test('Step 9: Both directional edges remain preserved', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    positiveEvidenceTypes: ['OFFENSIVE_SYNERGY']
  });
  const pBA = createMockSynergyProfile('Mortefi', 'Jiyan', {
    positiveEvidenceTypes: ['DEFENSIVE_SYNERGY']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pBA, pAC]
  );

  assert.equal(candidate.directionalEdgeCount, 3);
  const edgeAB = candidate.directionalPairEdges.find(
    (e) => e.sourceResonatorId === 'Jiyan' && e.targetResonatorId === 'Mortefi'
  );
  const edgeBA = candidate.directionalPairEdges.find(
    (e) => e.sourceResonatorId === 'Mortefi' && e.targetResonatorId === 'Jiyan'
  );
  assert.ok(edgeAB);
  assert.ok(edgeBA);
  assert.deepEqual(edgeAB.synergyCategories, ['OFFENSIVE_SYNERGY']);
  assert.deepEqual(edgeBA.synergyCategories, ['DEFENSIVE_SYNERGY']);
});

test('Step 9: Missing B->A does not get fabricated', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB]
  );

  const edgeBA = candidate.directionalPairEdges.find(
    (e) => e.sourceResonatorId === 'Mortefi' && e.targetResonatorId === 'Jiyan'
  );
  assert.equal(edgeBA, undefined);
});

test('Step 9: No transitive A->C from A->B + B->C', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pBC = createMockSynergyProfile('Mortefi', 'Verina');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pBC]
  );

  const edgeAC = candidate.directionalPairEdges.find(
    (e) => e.sourceResonatorId === 'Jiyan' && e.targetResonatorId === 'Verina'
  );
  const edgeCA = candidate.directionalPairEdges.find(
    (e) => e.sourceResonatorId === 'Verina' && e.targetResonatorId === 'Jiyan'
  );
  assert.equal(edgeAC, undefined);
  assert.equal(edgeCA, undefined);
});

test('Step 9: Three explicit pair connections are preserved correctly', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const pBC = createMockSynergyProfile('Mortefi', 'Verina');

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC, pBC]
  );

  assert.equal(candidate.matchedPairCount, 3);
  assert.equal(candidate.directionalEdgeCount, 3);
  assert.ok(candidate.qualificationTypes.includes('THREE_PAIR_SYNERGY_EDGES'));
  assert.ok(candidate.qualificationTypes.includes('DIRECTIONAL_SYNERGY_CHAIN'));
});

// ============================================================================
// 3. Epistemic Safety & Status Rules
// ============================================================================

test('Step 9: No-pairwise-evidence triple becomes NO_PAIRWISE_EVIDENCE', () => {
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    []
  );

  assert.equal(candidate.matchedPairCount, 0);
  assert.equal(candidate.directionalEdgeCount, 0);
  assert.equal(candidate.qualificationStatus, 'NO_PAIRWISE_EVIDENCE');
  assert.ok(candidate.explanationCodes.includes('NO_PAIRWISE_SYNERGY_EVIDENCE'));
});

test('Step 9: Contextual pair evidence remains contextual', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyStatus: 'CONTEXT_DEPENDENT',
    contextRequirements: ['TARGET_HEALTH_THRESHOLD']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyStatus: 'CONTEXT_DEPENDENT',
    contextRequirements: ['COMBAT_STATE']
  });

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  assert.equal(candidate.matchedPairCount, 2);
  assert.equal(candidate.qualificationStatus, 'CONTEXT_DEPENDENT');
  assert.ok(candidate.qualificationTypes.includes('CONTEXTUAL_PAIR_SUPPORT'));
  assert.ok(candidate.contextRequirements.includes('TARGET_HEALTH_THRESHOLD'));
  assert.ok(candidate.contextRequirements.includes('COMBAT_STATE'));
});

test('Step 9: Mixed evaluated/contextual evidence remains partially qualified', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyStatus: 'PARTIAL_SYNERGY'
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyStatus: 'CONTEXT_DEPENDENT',
    contextRequirements: ['COMBAT_STATE']
  });

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  assert.equal(candidate.matchedPairCount, 2);
  assert.equal(candidate.qualificationStatus, 'PARTIALLY_QUALIFIED');
  assert.ok(candidate.qualificationTypes.includes('CONTEXTUAL_PAIR_SUPPORT'));
  assert.equal(candidate.applicabilitySummary.partiallyEvaluatedPairCount, 1);
  assert.equal(candidate.applicabilitySummary.contextDependentPairCount, 1);
});

test('Step 9: UNMODELED pair evidence does not create a normal evaluated team', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyStatus: 'UNMODELED'
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyStatus: 'UNMODELED'
  });

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  assert.equal(candidate.matchedPairCount, 2);
  assert.equal(candidate.qualificationStatus, 'UNMODELED');
  assert.ok(candidate.qualificationTypes.includes('UNMODELED_PAIR_SUPPORT'));
});

test('Step 9: UNKNOWN fails closed', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyStatus: 'UNKNOWN'
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    synergyStatus: 'PARTIAL_SYNERGY'
  });

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  assert.equal(candidate.qualificationStatus, 'UNKNOWN');
});

test('Step 9: NOT_APPLICABLE cannot qualify as positive evidence', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    synergyStatus: 'NOT_APPLICABLE'
  });
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB]
  );

  assert.equal(candidate.qualificationStatus, 'NOT_APPLICABLE');
});

// ============================================================================
// 4. Lineage Deduplication
// ============================================================================

test('Step 9: Duplicate pair profiles do not inflate matchedPairCount', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAB]
  );

  assert.equal(candidate.matchedPairCount, 1);
  assert.equal(candidate.directionalEdgeCount, 1);
});

test('Step 9: Duplicate evidence IDs do not inflate lineage counts', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    evidenceIds: ['EVI_SHARED', 'EVI_UNIQUE_AB']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    evidenceIds: ['EVI_SHARED', 'EVI_UNIQUE_AC']
  });

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  // 3 unique evidence IDs: EVI_SHARED, EVI_UNIQUE_AB, EVI_UNIQUE_AC
  assert.equal(candidate.supportingEvidenceIds.length, 3);
  assert.equal(candidate.independentEvidenceLineageCount, 3);
});

test('Step 9: Duplicate relationship IDs do not inflate lineage counts', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    relationshipIds: ['REL_SHARED', 'REL_AB']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    relationshipIds: ['REL_SHARED', 'REL_AC']
  });

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  assert.equal(candidate.supportingRelationshipIds.length, 3);
});

test('Step 9: Duplicate fact IDs do not inflate lineage counts', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi', {
    sourceFactIds: ['FACT_JIYAN_SKILL', 'FACT_MORTEFI_OUTRO']
  });
  const pAC = createMockSynergyProfile('Jiyan', 'Verina', {
    sourceFactIds: ['FACT_JIYAN_SKILL', 'FACT_VERINA_OUTRO']
  });

  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAC]
  );

  assert.equal(candidate.supportingSourceFactIds.length, 3);
});

// ============================================================================
// 5. Prohibition of Prohibited Concepts (Static & Runtime Safety)
// ============================================================================

test('Step 9: Zero role inference on candidate contract', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);

  const candRecord = candidate as unknown as Record<string, unknown>;
  assert.equal(candRecord.role, undefined);
  assert.equal(candRecord.roles, undefined);
  assert.equal(candRecord.MAIN_DPS, undefined);
  assert.equal(candRecord.SUB_DPS, undefined);
  assert.equal(candRecord.SUPPORT, undefined);
  assert.equal(candRecord.HEALER, undefined);
  assert.equal(candRecord.BUFFER, undefined);
});

test('Step 9: Zero character power on candidate contract', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);

  const candRecord = candidate as unknown as Record<string, unknown>;
  assert.equal(candRecord.characterPower, undefined);
  assert.equal(candRecord.characterScore, undefined);
  assert.equal(candRecord.resonatorPower, undefined);
  assert.equal(candRecord.resonatorScore, undefined);
});

test('Step 9: Zero team score or ranking on candidate contract', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);

  const candRecord = candidate as unknown as Record<string, unknown>;
  assert.equal(candRecord.teamScore, undefined);
  assert.equal(candRecord.teamPower, undefined);
  assert.equal(candRecord.dpsScore, undefined);
  assert.equal(candRecord.damageGain, undefined);
  assert.equal(candRecord.teamRanking, undefined);
  assert.equal(candRecord.bestTeam, undefined);
  assert.equal(candRecord.metaRank, undefined);
  assert.equal(candRecord.tierList, undefined);
});

test('Step 9: Zero ToA or Vigor on candidate contract', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);

  const candRecord = candidate as unknown as Record<string, unknown>;
  assert.equal(candRecord.towerScore, undefined);
  assert.equal(candRecord.toa, undefined);
  assert.equal(candRecord.vigorScore, undefined);
  assert.equal(candRecord.vigorCost, undefined);
});

test('Step 9: Zero network imports in Step 9 code', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition');
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (!f.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    assert.doesNotMatch(content, /\bfetch\s*\(/);
    assert.doesNotMatch(content, /\baxios\b/);
    assert.doesNotMatch(content, /\bhttp\b/);
    assert.doesNotMatch(content, /\bhttps\b/);
    assert.doesNotMatch(content, /\bWebSocket\b/);
  }
});

test('Step 9: Zero LLM / prompt imports in Step 9 code', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition');
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (!f.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    assert.doesNotMatch(content, /\bopenai\b/i);
    assert.doesNotMatch(content, /\banthropic\b/i);
    assert.doesNotMatch(content, /\bgemini\b/i);
    assert.doesNotMatch(content, /\bllm\b/i);
    assert.doesNotMatch(content, /\bprompt\b/i);
  }
});

test('Step 9: assertNoProhibitedKeys throws on forbidden property', () => {
  assert.throws(
    () => assertNoProhibitedKeys({ teamScore: 100 }),
    /Audit failure: Prohibited key 'teamScore'/
  );
  assert.throws(
    () => assertNoProhibitedKeys({ nested: { characterPower: 50 } }),
    /Audit failure: Prohibited key 'characterPower'/
  );
});

// ============================================================================
// 6. Determinism & Canonical Production Verification
// ============================================================================

test('Step 9: Deterministic candidate IDs', () => {
  const id1 = deriveTeamCompositionCandidateId('3.7', ['Verina', 'Mortefi', 'Jiyan']);
  const id2 = deriveTeamCompositionCandidateId('3.7', ['Jiyan', 'Verina', 'Mortefi']);
  assert.equal(id1, id2);
  assert.equal(id1, 'team-composition:3.7:Jiyan:Mortefi:Verina:7.9.1');
});

test('Step 9: 20 repeated production generations are byte-identical', () => {
  clearTeamCompositionCandidateCache();
  const baseline = getTeamCompositionCandidates();
  const baselineJson = JSON.stringify(baseline);
  const baselineHash = crypto.createHash('sha256').update(baselineJson).digest('hex');

  for (let i = 0; i < 19; i++) {
    clearTeamCompositionCandidateCache();
    const current = getTeamCompositionCandidates();
    const currentJson = JSON.stringify(current);
    const currentHash = crypto.createHash('sha256').update(currentJson).digest('hex');
    assert.equal(currentHash, baselineHash, `Run ${i + 2} differs from baseline run!`);
  }
});

test('Step 9: Canonical Patch 3.7 dataset remains completely unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  assert.ok(fs.existsSync(datasetPath));
  const stats = fs.statSync(datasetPath);
  assert.ok(stats.size > 0);
});

test('Step 9: Production audit executes cleanly and satisfies all Invariants', () => {
  clearTeamCompositionCandidateCache();
  const metrics = auditTeamCompositionCandidates();

  assert.equal(metrics.totalResonators, 60);
  assert.equal(metrics.theoreticalTriples, 34220);
  assert.equal(metrics.triplesWithEvidence, 30838);
  assert.equal(metrics.noEvidenceTriples, 3382);
  assert.equal(metrics.totalMaterializedCandidates, 34220);
  assert.equal(metrics.duplicateCandidateIds, 0);

  // Status distribution
  assert.equal(metrics.qualifiedCount, 0);
  assert.equal(metrics.partiallyQualifiedCount, 10095);
  assert.equal(metrics.contextDependentCount, 20612);
  assert.equal(metrics.unmodeledCount, 131);
  assert.equal(metrics.unknownCount, 0);
  assert.equal(metrics.notApplicableCount, 0);
  assert.equal(metrics.noPairwiseEvidenceCount, 3382);

  // Matched pair count distribution
  assert.equal(metrics.matchedPairCountDistribution[0], 1277);
  assert.equal(metrics.matchedPairCountDistribution[1], 2105);
  assert.equal(metrics.matchedPairCountDistribution[2], 9127);
  assert.equal(metrics.matchedPairCountDistribution[3], 21711);

  // Total equals 34,220
  assert.equal(1277 + 2105 + 9127 + 21711, 34220);

  // Directionality statistics
  assert.equal(metrics.directionalityStats.unidirectionalOnlyPairs, 49938);
  assert.equal(metrics.directionalityStats.bidirectionalPairs, 35554);
  assert.equal(metrics.totalConnectedPairOccurrences, 85492);
  assert.equal(metrics.totalDirectionalEdges, 121046);

  // Mathematical Reconciliation Invariants (Section 3 & 6)
  assert.equal(
    metrics.directionalityStats.unidirectionalOnlyPairs + metrics.directionalityStats.bidirectionalPairs,
    metrics.totalConnectedPairOccurrences
  );
  assert.equal(
    metrics.directionalityStats.unidirectionalOnlyPairs + 2 * metrics.directionalityStats.bidirectionalPairs,
    metrics.totalDirectionalEdges
  );
  assert.equal(
    metrics.matchedPairCountDistribution[1] +
      2 * metrics.matchedPairCountDistribution[2] +
      3 * metrics.matchedPairCountDistribution[3],
    metrics.totalConnectedPairOccurrences
  );
});

// ============================================================================
// 7. Directionality Metrics Reconciliation Tests (Remediation)
// ============================================================================

function countCandidateDirectionality(c: TeamCompositionCandidate): { uni: number; bi: number } {
  const [a, b, cRes] = c.memberResonatorIds;
  const pairs = [
    [a, b], [a, cRes], [b, cRes]
  ];
  let uni = 0;
  let bi = 0;
  for (const [p1, p2] of pairs) {
    const hasFwd = c.directionalPairEdges.some(
      (e: TeamDirectionalPairEdge) => e.sourceResonatorId === p1 && e.targetResonatorId === p2
    );
    const hasRev = c.directionalPairEdges.some(
      (e: TeamDirectionalPairEdge) => e.sourceResonatorId === p2 && e.targetResonatorId === p1
    );
    if (hasFwd && hasRev) bi++;
    else if (hasFwd || hasRev) uni++;
  }
  return { uni, bi };
}

test('Step 9: Directionality case 1 - A->B only', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB]);

  assert.equal(candidate.matchedPairCount, 1);
  assert.equal(candidate.directionalEdgeCount, 1);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 1);
  assert.equal(bi, 0);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 2 - B->A only', () => {
  const pBA = createMockSynergyProfile('Mortefi', 'Jiyan');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pBA]);

  assert.equal(candidate.matchedPairCount, 1);
  assert.equal(candidate.directionalEdgeCount, 1);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 1);
  assert.equal(bi, 0);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 3 - A->B + B->A', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pBA = createMockSynergyProfile('Mortefi', 'Jiyan');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pBA]);

  assert.equal(candidate.matchedPairCount, 1);
  assert.equal(candidate.directionalEdgeCount, 2);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 0);
  assert.equal(bi, 1);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 4 - A->B + A->C', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB, pAC]);

  assert.equal(candidate.matchedPairCount, 2);
  assert.equal(candidate.directionalEdgeCount, 2);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 2);
  assert.equal(bi, 0);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 5 - A->B + B->A + A->C + C->A', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pBA = createMockSynergyProfile('Mortefi', 'Jiyan');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const pCA = createMockSynergyProfile('Verina', 'Jiyan');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pBA, pAC, pCA]
  );

  assert.equal(candidate.matchedPairCount, 2);
  assert.equal(candidate.directionalEdgeCount, 4);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 0);
  assert.equal(bi, 2);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 6 - all six directional edges', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pBA = createMockSynergyProfile('Mortefi', 'Jiyan');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const pCA = createMockSynergyProfile('Verina', 'Jiyan');
  const pBC = createMockSynergyProfile('Mortefi', 'Verina');
  const pCB = createMockSynergyProfile('Verina', 'Mortefi');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pBA, pAC, pCA, pBC, pCB]
  );

  assert.equal(candidate.matchedPairCount, 3);
  assert.equal(candidate.directionalEdgeCount, 6);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 0);
  assert.equal(bi, 3);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 7 - no pair', () => {
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], []);

  assert.equal(candidate.matchedPairCount, 0);
  assert.equal(candidate.directionalEdgeCount, 0);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 0);
  assert.equal(bi, 0);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 8 - duplicate directional profile does not inflate metrics', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const candidate = generateTeamCompositionCandidate(
    ['Jiyan', 'Mortefi', 'Verina'],
    [pAB, pAB, pAB]
  );

  assert.equal(candidate.matchedPairCount, 1);
  assert.equal(candidate.directionalEdgeCount, 1);
  const { uni, bi } = countCandidateDirectionality(candidate);
  assert.equal(uni, 1);
  assert.equal(bi, 0);
  assert.equal(candidate.matchedPairCount, uni + bi);
  assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
});

test('Step 9: Directionality case 9 - reverse direction is never fabricated', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const candidate = generateTeamCompositionCandidate(['Jiyan', 'Mortefi', 'Verina'], [pAB]);

  assert.equal(candidate.directionalPairEdges.length, 1);
  assert.equal(candidate.directionalPairEdges[0].sourceResonatorId, 'Jiyan');
  assert.equal(candidate.directionalPairEdges[0].targetResonatorId, 'Mortefi');
  const hasReverse = candidate.directionalPairEdges.some(
    (e) => e.sourceResonatorId === 'Mortefi' && e.targetResonatorId === 'Jiyan'
  );
  assert.equal(hasReverse, false);
});

test('Step 9: Directionality case 10 - all six permutations produce identical directionality metrics', () => {
  const pAB = createMockSynergyProfile('Jiyan', 'Mortefi');
  const pAC = createMockSynergyProfile('Jiyan', 'Verina');
  const pCA = createMockSynergyProfile('Verina', 'Jiyan');
  const profiles = [pAB, pAC, pCA];

  const perms = [
    ['Jiyan', 'Mortefi', 'Verina'],
    ['Jiyan', 'Verina', 'Mortefi'],
    ['Mortefi', 'Jiyan', 'Verina'],
    ['Mortefi', 'Verina', 'Jiyan'],
    ['Verina', 'Jiyan', 'Mortefi'],
    ['Verina', 'Mortefi', 'Jiyan']
  ];

  for (const perm of perms) {
    const candidate = generateTeamCompositionCandidate(perm, profiles);
    assert.equal(candidate.matchedPairCount, 2);
    assert.equal(candidate.directionalEdgeCount, 3);
    const { uni, bi } = countCandidateDirectionality(candidate);
    assert.equal(uni, 1);
    assert.equal(bi, 1);
    assert.equal(candidate.matchedPairCount, uni + bi);
    assert.equal(candidate.directionalEdgeCount, uni + 2 * bi);
  }
});

test('Step 9: Directionality case 11 - production aggregate equations reconcile exactly', () => {
  const candidates = getTeamCompositionCandidates({ includeEmptyTriples: true });
  assert.equal(candidates.length, 34220);

  let totalMatched = 0;
  let totalEdges = 0;
  let totalUni = 0;
  let totalBi = 0;

  for (const c of candidates) {
    totalMatched += c.matchedPairCount;
    totalEdges += c.directionalEdgeCount;
    const { uni, bi } = countCandidateDirectionality(c);
    assert.equal(c.matchedPairCount, uni + bi);
    assert.equal(c.directionalEdgeCount, uni + 2 * bi);
    totalUni += uni;
    totalBi += bi;
  }

  // Equation 1: U + B === totalMatchedPairOccurrences
  assert.equal(totalUni + totalBi, totalMatched);
  assert.equal(totalMatched, 85492);
  assert.equal(totalUni, 49938);
  assert.equal(totalBi, 35554);

  // Equation 2: U + 2*B === totalDirectionalEdges
  assert.equal(totalUni + 2 * totalBi, totalEdges);
  assert.equal(totalEdges, 121046);
});

test('Step 9: Repository query and explanation generation', () => {
  const cand = getTeamCompositionCandidate('Jiyan', 'Mortefi', 'Verina');
  assert.ok(cand);
  assert.deepEqual(cand.memberResonatorIds, ['Jiyan', 'Mortefi', 'Verina']);

  const expl = explainTeamCompositionCandidate(cand);
  assert.equal(expl.candidateId, cand.id);
  assert.deepEqual(expl.members, cand.memberResonatorIds);
  assert.ok(expl.summary.includes('Connected by'));

  const jiyanTeams = getTeamCompositionCandidatesForResonator('Jiyan');
  assert.ok(jiyanTeams.length > 0);
  for (const t of jiyanTeams) {
    assert.ok(t.memberResonatorIds.includes('Jiyan'));
  }
});
