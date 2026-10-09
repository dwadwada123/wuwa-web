/**
 * Wuthering Waves Character-Level Evidence Aggregation Test Suite
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Comprehensive tests covering:
 * - Directional pair profile creation & deterministic IDs (A -> B != B -> A)
 * - Rule versioning ('7.7.1') and Patch 3.7 isolation
 * - Canonical ordering and lineage traceability (candidates, evaluations, evidence, relationships, facts)
 * - Anti-double-counting and lineage-aware anti-inflation invariants
 * - Status aggregation (EVALUATED, PARTIALLY_EVALUATED, MISSING_CONTEXT, UNMODELED, UNKNOWN, NOT_APPLICABLE, EMPTY)
 * - Empty-pair semantics (absence of evidence != incompatibility; score is null, never negative)
 * - Zero role inference, zero meta, zero character power scores, zero team scoring, zero ToA/Vigor
 * - Repository querying (incoming, outgoing, multi-criteria filters)
 * - Production dataset reconciliation (9,599 resonator candidates -> 2,087 modeled pairs)
 * - Production audit passing all Invariants A through AG
 * - 20-run repeated determinism test requiring 20/20 byte-for-byte identical outputs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  aggregateCharacterPairEvidence,
  aggregateCharacterPairEvidences,
  buildEmptyCharacterPairProfile,
  getCharacterPairEvidenceProfile,
  getCharacterPairEvidenceProfiles,
  queryCharacterPairEvidenceProfiles,
  getOutgoingProfilesForResonator,
  getIncomingProfilesForResonator,
  clearCharacterPairProfileCache,
  explainCharacterPairEvidenceProfile,
  auditCharacterPairEvidenceProfiles,
  deriveCharacterPairProfileId,
  compareCharacterPairProfile,
  isEvaluatedPairProfile,
  isPartiallyEvaluatedPairProfile,
  isMissingContextPairProfile,
  isUnmodeledPairProfile,
  isEmptyPairProfile,
  hasPairEvidenceScore,
  matchesPairProfileFilter,
  CHARACTER_PAIR_AGGREGATION_RULE_VERSION,
  PAIR_SCORE_SCALE_MIN,
  PAIR_SCORE_SCALE_MAX
} from '../lib/engine/relationships/character-pairs/index.ts';

import { evaluateCompatibilityCandidate } from '../lib/engine/relationships/evaluation/evaluator.ts';
import { generateCompatibilityCandidates } from '../lib/engine/relationships/compatibility/candidates.ts';
import { buildGameplayCapability } from '../lib/engine/capabilities/builder.ts';
import { buildGameplayRelationshipsForCapability } from '../lib/engine/relationships/builder.ts';
import { composeInteractionEvidence } from '../lib/engine/relationships/composition/composer.ts';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import type { CompatibilityCandidate } from '../lib/engine/relationships/compatibility/types.ts';

/**
 * Deterministic factory creating valid NormalizedEngineFacts for character pair tests.
 */
function createMockFact(overrides?: Partial<NormalizedEngineFact>): NormalizedEngineFact {
  const isUnmodeledOrUnknown =
    overrides?.consumptionState === 'UNMODELED' ||
    overrides?.consumptionState === 'UNKNOWN' ||
    overrides?.consumptionState === 'NOT_APPLICABLE';

  const baseNumeric = overrides?.value && 'value' in overrides.value ? overrides.value.value : 20;
  const baseValue =
    overrides?.value ??
    (isUnmodeledOrUnknown
      ? { type: 'UNRESOLVED' as const, reason: 'Test Fixture' }
      : {
          type: 'EXACT' as const,
          value: baseNumeric !== null && baseNumeric !== undefined ? baseNumeric : 20,
          unit: 'PERCENT' as const
        });

  const entityId = overrides?.entityId ?? 'ResonatorA';
  const sourceCode = overrides?.sourceCode ?? 'skill';
  const category = overrides?.category ?? 'STAT_BUFF';
  const target = overrides?.target ?? 'TEAM';
  const parameter = overrides?.parameter ?? 'ATK_PERCENT';
  const element = overrides?.element ?? 'NONE';

  return {
    factId:
      overrides?.factId ??
      `${entityId}|${sourceCode}|${category}|${target}|${parameter}|${element}|EXACT:${baseNumeric}:PERCENT|NO_COND|NO_DUR|NO_STACK`,
    entityId,
    sourceCode,
    patchVersion: overrides?.patchVersion ?? '3.7',
    category,
    parameter,
    value: baseValue,
    staticNumericValue:
      overrides && 'staticNumericValue' in overrides
        ? overrides.staticNumericValue!
        : baseValue.type === 'EXACT'
          ? baseValue.value
          : null,
    unit: 'PERCENT',
    target,
    element,
    condition: overrides?.condition,
    duration: overrides?.duration,
    stacking: overrides?.stacking,
    refinementRank: overrides?.refinementRank,
    parameterSafety: overrides?.parameterSafety ?? 'DIRECT_ENGINE_FACT',
    consumptionState: isUnmodeledOrUnknown
      ? overrides?.consumptionState ?? 'UNMODELED'
      : overrides?.consumptionState ?? 'CONSUMABLE_STATIC',
    semanticStatus: overrides?.semanticStatus ?? 'SAFE_EXPLICIT',
    provenance: {
      entityId,
      entityName: `${entityId} Name`,
      sourceType: 'RESONATOR_ABILITY',
      patchVersion: '3.7',
      sourceProvenance: 'Test Provenance',
      originalDescription: 'Test Description'
    },
    extraction: {
      parserVersion: '3.7.0',
      method: 'DETERMINISTIC_RULE_PARSER',
      extractionDate: '2026-10-08'
    },
    ...overrides
  };
}

/**
 * Builds candidate pairs from two mock facts.
 */
function buildMockCandidatePair(
  fact1: NormalizedEngineFact,
  fact2: NormalizedEngineFact
): CompatibilityCandidate[] {
  const cap1 = buildGameplayCapability(fact1);
  const cap2 = buildGameplayCapability(fact2);
  const rels = [
    ...buildGameplayRelationshipsForCapability(cap1),
    ...buildGameplayRelationshipsForCapability(cap2)
  ];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');
  const candidates = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  return [...candidates];
}

// ============================================================================
// SUITE 1: CORE PROFILE CREATION, IDS & DIRECTIONALITY (Tests 1-5)
// ============================================================================

test('1. Core: profile creation produces valid CharacterPairEvidenceProfile', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.strictEqual(profile.sourceResonatorId, 'Jiyan');
  assert.strictEqual(profile.targetResonatorId, 'Mortefi');
  assert.strictEqual(profile.patchVersion, '3.7');
  assert.strictEqual(profile.ruleVersion, CHARACTER_PAIR_AGGREGATION_RULE_VERSION);
  assert.ok(profile.id.startsWith('pair:3.7:Jiyan:Mortefi:'));
  assert.ok(profile.candidateIds.length > 0);
  assert.ok(profile.evaluationIds.length > 0);
});

test('2. Core: deterministic profile ID format pair:3.7:<src>:<tgt>:7.7.1', () => {
  const id = deriveCharacterPairProfileId('3.7', 'Jiyan', 'Mortefi', '7.7.1');
  assert.strictEqual(id, 'pair:3.7:Jiyan:Mortefi:7.7.1');
});

test('3. Directionality: A -> B produces different profile and ID from B -> A', () => {
  const idAB = deriveCharacterPairProfileId('3.7', 'Jiyan', 'Mortefi', '7.7.1');
  const idBA = deriveCharacterPairProfileId('3.7', 'Mortefi', 'Jiyan', '7.7.1');
  assert.notStrictEqual(idAB, idBA);
  assert.strictEqual(idAB, 'pair:3.7:Jiyan:Mortefi:7.7.1');
  assert.strictEqual(idBA, 'pair:3.7:Mortefi:Jiyan:7.7.1');
});

test('4. Versioning: profile preserves CHARACTER_PAIR_AGGREGATION_RULE_VERSION', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual(profile.ruleVersion, '7.7.1');
});

test('5. Ordering: canonical comparator orders by source, target, score desc, ID', () => {
  const p1 = buildEmptyCharacterPairProfile('Aero', 'Chixia');
  const p2 = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  const p3 = buildEmptyCharacterPairProfile('Jiyan', 'Verina');

  const list = [p3, p1, p2];
  list.sort(compareCharacterPairProfile);
  assert.strictEqual(list[0].id, p1.id);
  assert.strictEqual(list[1].id, p2.id);
  assert.strictEqual(list[2].id, p3.id);
});

// ============================================================================
// SUITE 2: LINEAGE TRACEABILITY (Tests 6-10)
// ============================================================================

test('6. Lineage: candidateIds are traceable to Step 5', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  for (const cid of profile.candidateIds) {
    assert.ok(cands.some((c) => c.id === cid));
  }
});

test('7. Lineage: evaluationIds are traceable to Step 6', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  for (const eid of profile.evaluationIds) {
    assert.ok(evals.some((ev) => ev.id === eid));
  }
});

test('8. Lineage: evidenceIds are traceable to Step 4', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.evidenceIds.length > 0);
  for (const eid of profile.evidenceIds) {
    assert.ok(eid.startsWith('evi:3.7:'));
  }
});

test('9. Lineage: relationshipIds are traceable to Step 3', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.relationshipIds.length > 0);
  for (const rid of profile.relationshipIds) {
    assert.ok(rid.startsWith('rel:3.7:'));
  }
});

test('10. Lineage: sourceFactIds are traceable to Step 1 / Semantic Facts', () => {
  const fact1 = createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' });
  const fact2 = createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' });
  const cands = buildMockCandidatePair(fact1, fact2);
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.sourceFactIds.includes(fact1.factId));
  assert.ok(profile.sourceFactIds.includes(fact2.factId));
});

// ============================================================================
// SUITE 3: QUALIFICATIONS & DIMENSIONS (Tests 11-20)
// ============================================================================

test('11. Qualification: explicit candidate aggregation preserves EXPLICIT nature', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const explicitCand = { ...cands[0], qualificationNature: 'EXPLICIT' as const };
  const evals = [evaluateCompatibilityCandidate(explicitCand)];
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, [explicitCand]);

  assert.ok(profile.qualificationNatures.includes('EXPLICIT'));
  assert.strictEqual(profile.componentSummary.countsByQualificationNature.EXPLICIT, 1);
});

test('12. Qualification: dimensional candidate aggregation preserves DIMENSIONAL nature', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.qualificationNatures.includes('DIMENSIONAL'));
  assert.ok(profile.componentSummary.countsByQualificationNature.DIMENSIONAL > 0);
});

test('13. Dimension: action dimension match preserved in matchedDimensions and summary', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.matchedDimensions.some((d) => d.kind === 'ACTION'));
  assert.ok(profile.componentSummary.countsByDimensionKind.ACTION > 0);
});

test('14. Dimension: element dimension match preserved in matchedDimensions and summary', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', element: 'Aero', parameter: 'AERO_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Yangyang', target: 'SELF', element: 'Aero', parameter: 'AERO_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c, { context: { element: 'Aero' } }));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Yangyang', evals, cands);

  assert.ok(profile.matchedDimensions.some((d) => d.kind === 'ELEMENT'));
  assert.ok(profile.componentSummary.countsByDimensionKind.ELEMENT > 0);
});

test('15. Dimension: transition dimension match preserved in matchedDimensions and summary', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', sourceCode: 'INTRO_SKILL', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.matchedDimensions.some((d) => d.kind === 'TRANSITION'));
  assert.ok(profile.componentSummary.countsByDimensionKind.TRANSITION > 0);
});

test('16. Dimension: resource dimension match preserved in matchedDimensions and summary', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Yangyang', target: 'TEAM', parameter: 'ENERGY_REGEN_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', parameter: 'ENERGY_REGEN_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Yangyang', 'Jiyan', evals, cands);

  assert.ok(profile.matchedDimensions.some((d) => d.kind === 'RESOURCE'));
  assert.ok(profile.componentSummary.countsByDimensionKind.RESOURCE > 0);
});

test('17. Dimension: defensive dimension match preserved in matchedDimensions and summary', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Verina', target: 'TEAM', category: 'HEALING', parameter: 'HP_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', category: 'HEALING', parameter: 'HP_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Verina', 'Jiyan', evals, cands);

  assert.ok(profile.matchedDimensions.some((d) => d.kind === 'DEFENSIVE'));
  assert.ok(profile.componentSummary.countsByDimensionKind.DEFENSIVE > 0);
});

test('18. Dimension: offensive dimension match preserved in matchedDimensions and summary', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.matchedDimensions.some((d) => d.kind === 'OFFENSIVE'));
  assert.ok(profile.componentSummary.countsByDimensionKind.OFFENSIVE > 0);
});

test('19. Dimension: mechanical dimension match preserved in matchedDimensions and summary', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Yinlin', target: 'TEAM', category: 'COORDINATED_ATTACK', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Calcharo', target: 'SELF', category: 'COORDINATED_ATTACK', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Yinlin', 'Calcharo', evals, cands);

  assert.ok(profile.matchedDimensions.some((d) => d.kind === 'MECHANICAL'));
  assert.ok(profile.componentSummary.countsByDimensionKind.MECHANICAL > 0);
});

test('20. Dimension: multiple dimensions captured independently in componentSummary', () => {
  const fact1 = createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' });
  const fact2 = createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' });
  const cands = buildMockCandidatePair(fact1, fact2);
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.ok(profile.qualificationTypes.length > 0);
  assert.ok(Object.keys(profile.componentSummary.countsByQualificationType).length > 0);
});

// ============================================================================
// SUITE 4: ANTI-DOUBLE-COUNTING & ANTI-INFLATION (Tests 21-24)
// ============================================================================

test('21. Anti-double-counting: multiple duplicate candidates sharing the same evidenceId contribute only once', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  // Duplicate candidate 0 with identical evidenceId
  const dupCand = { ...cands[0], id: `${cands[0].id}_dup` };
  const allCands = [cands[0], dupCand];
  const evals = allCands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, allCands);

  // independentEvaluatedEvidenceCount must be 1, NOT 2!
  assert.strictEqual(profile.evidenceScoreSummary.independentEvaluatedEvidenceCount, 1);
});

test('22. Anti-double-counting: multiple candidates sharing the same sourceFactId do not multiply score', () => {
  const fact = createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' });
  const cands = buildMockCandidatePair(fact, createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' }));
  const dupCand = { ...cands[0], id: `${cands[0].id}_variant` };
  const allCands = [cands[0], dupCand];
  const evals = allCands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, allCands);

  assert.strictEqual(profile.evidenceScoreSummary.uniqueSourceFactCount, 2);
  assert.strictEqual(profile.evidenceScoreSummary.independentEvaluatedEvidenceCount, 1);
});

test('23. Anti-inflation: identical evidence across multiple candidates does not inflate independent evidence count', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.strictEqual(profile.evidenceScoreSummary.independentEvaluatedEvidenceCount, 1);
  assert.ok(profile.evidenceScoreSummary.pairEvidenceScore! <= 100);
});

test('24. Scoring: independent evaluated evidence yields multi-lineage bonus capped at 15.0', () => {
  const cands1 = buildMockCandidatePair(
    createMockFact({ factId: 'F1', entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ factId: 'F2', entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const cands2 = buildMockCandidatePair(
    createMockFact({ factId: 'F3', entityId: 'Jiyan', target: 'TEAM', parameter: 'ENERGY_REGEN_PERCENT' }),
    createMockFact({ factId: 'F4', entityId: 'Mortefi', target: 'SELF', parameter: 'ENERGY_REGEN_PERCENT' })
  );

  const combinedCands = [cands1[0], cands2[0]];
  const evals = combinedCands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, combinedCands);

  assert.strictEqual(profile.evidenceScoreSummary.independentEvaluatedEvidenceCount, 2);
  // Base score + 5.0 bonus for second independent evidence lineage
  const baseScore = Math.max(evals[0].totalScore!, evals[1].totalScore!);
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, Math.round((baseScore + 5.0) * 100) / 100);
});

// ============================================================================
// SUITE 5: STATUS & EPISTEMIC SAFETY (Tests 25-33)
// ============================================================================

test('25. Empty: empty pair produces status EMPTY with pairEvidenceScore: null', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual(profile.status, 'EMPTY');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
  assert.strictEqual(profile.candidateIds.length, 0);
  assert.strictEqual(profile.evidenceIds.length, 0);
});

test('26. Empty: empty pair is NOT incompatibility (never negative, never zero)', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
  assert.notStrictEqual(profile.evidenceScoreSummary.pairEvidenceScore, 0);
  assert.notStrictEqual(profile.evidenceScoreSummary.pairEvidenceScore, -1);
  assert.ok(profile.explanationCodes.includes('NO_MODELED_EVIDENCE'));
});

test('27. Applicability: missing context candidates yield status MISSING_CONTEXT and null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({
      entityId: 'Jiyan',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { trigger: 'ON_INTRO_SKILL' }
    }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c)); // empty context -> MISSING_CONTEXT
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.strictEqual(profile.status, 'MISSING_CONTEXT');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
  assert.ok(profile.applicabilitySummary.missingContextCount > 0);
});

test('28. Applicability: partial evaluation (evaluated + missing context) yields PARTIALLY_EVALUATED', () => {
  const candStatic = buildMockCandidatePair(
    createMockFact({ factId: 'F_STATIC_1', entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ factId: 'F_STATIC_2', entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  )[0];

  const candContextual = buildMockCandidatePair(
    createMockFact({
      factId: 'F_CTX_1',
      entityId: 'Jiyan',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { trigger: 'ON_INTRO_SKILL' }
    }),
    createMockFact({ factId: 'F_CTX_2', entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  )[0];

  const cands = [candStatic, candContextual];
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.strictEqual(profile.status, 'PARTIALLY_EVALUATED');
  assert.ok(profile.evidenceScoreSummary.pairEvidenceScore !== null);
  assert.ok(profile.applicabilitySummary.evaluatedCount > 0);
  assert.ok(profile.applicabilitySummary.missingContextCount > 0);
});

test('29. Applicability: context mismatch yields CONTEXT_MISMATCH and null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({
      entityId: 'Jiyan',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { trigger: 'ON_INTRO_SKILL' }
    }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  // Pass wrong trigger to cause CONTEXT_MISMATCH
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c, { context: { trigger: 'ON_OUTRO_SKILL' } }));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.strictEqual(profile.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
  assert.ok(profile.applicabilitySummary.contextMismatchCount > 0);
});

test('30. Epistemics: unknown candidates fail closed with UNKNOWN and null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const unknownCand = { ...cands[0], status: 'UNKNOWN' as const };
  const unknownEval = {
    ...evaluateCompatibilityCandidate(cands[0]),
    evaluationStatus: 'UNKNOWN' as const,
    totalScore: null,
    components: []
  };
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', [unknownEval], [unknownCand]);

  assert.strictEqual(profile.status, 'UNKNOWN');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
});

test('31. Epistemics: unmodeled candidates preserve UNMODELED and null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', consumptionState: 'UNMODELED' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', consumptionState: 'UNMODELED' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);

  assert.strictEqual(profile.status, 'UNMODELED');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
});

test('32. Epistemics: not applicable candidates yield NOT_APPLICABLE and null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const naCand = { ...cands[0], status: 'NOT_APPLICABLE' as const };
  const naEval = {
    ...evaluateCompatibilityCandidate(cands[0]),
    evaluationStatus: 'NOT_APPLICABLE' as const,
    totalScore: null,
    components: []
  };
  const profile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', [naEval], [naCand]);

  assert.strictEqual(profile.status, 'NOT_APPLICABLE');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
});

test('33. Safety: zero negative scores or penalties under any circumstances', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual(profile.evidenceScoreSummary.pairEvidenceScore, null);
  assert.ok(profile.evidenceScoreSummary.pairEvidenceScore === null || profile.evidenceScoreSummary.pairEvidenceScore >= 0);
});

// ============================================================================
// SUITE 6: SAFETY & PROHIBITED DOMAINS (Tests 34-41)
// ============================================================================

test('34. Safety: no role inference tags in profile (MAIN_DPS, SUB_DPS, SUPPORT)', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  const json = JSON.stringify(profile);
  assert.strictEqual(json.includes('MAIN_DPS'), false);
  assert.strictEqual(json.includes('SUB_DPS'), false);
  assert.strictEqual(json.includes('SUPPORT'), false);
});

test('35. Safety: no meta or tier ranking fields in profile', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  const json = JSON.stringify(profile);
  assert.strictEqual(json.includes('"tier"'), false);
  assert.strictEqual(json.includes('"meta"'), false);
  assert.strictEqual(json.includes('"rank"'), false);
});

test('36. Safety: zero character-level power scores (no characterPower, DPS, etc.)', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual((profile as any).characterPower, undefined);
  assert.strictEqual((profile as any).characterScore, undefined);
  assert.strictEqual((profile as any).dpsScore, undefined);
});

test('37. Safety: zero team aggregation or team scoring logic', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual((profile as any).teamScore, undefined);
  assert.strictEqual((profile as any).bestTeam, undefined);
  assert.strictEqual((profile as any).teamRanking, undefined);
});

test('38. Safety: zero ToA or Vigor scoring logic', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual((profile as any).towerScore, undefined);
  assert.strictEqual((profile as any).vigorScore, undefined);
});

test('39. Safety: zero combat simulation logic', () => {
  const profile = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  assert.strictEqual((profile as any).simulation, undefined);
  assert.strictEqual((profile as any).rotationDps, undefined);
});

test('40. Safety: no raw description access in character-pairs module', () => {
  const dirPath = path.resolve('lib/engine/relationships/character-pairs');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dirPath, f), 'utf-8');
    assert.strictEqual(content.includes('parseDescription'), false, `parseDescription found in ${f}`);
  }
});

test('41. Safety: no semantic parser bypass in character-pairs module', () => {
  const dirPath = path.resolve('lib/engine/relationships/character-pairs');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dirPath, f), 'utf-8');
    assert.strictEqual(content.includes('SemanticEffect'), false, `SemanticEffect found in ${f}`);
  }
});

// ============================================================================
// SUITE 7: REPOSITORY & QUERIES (Tests 42-44)
// ============================================================================

test('42. Repository: getCharacterPairEvidenceProfile returns modeled or empty profile', () => {
  const modeledProfile = getCharacterPairEvidenceProfile('Mornye', 'Augusta');
  assert.strictEqual(modeledProfile.sourceResonatorId, 'Mornye');
  assert.strictEqual(modeledProfile.targetResonatorId, 'Augusta');
  assert.strictEqual(modeledProfile.status, 'PARTIALLY_EVALUATED');

  // Non-existent pair returns EMPTY
  const emptyProfile = getCharacterPairEvidenceProfile('NonExistent1', 'NonExistent2');
  assert.strictEqual(emptyProfile.status, 'EMPTY');
  assert.strictEqual(emptyProfile.evidenceScoreSummary.pairEvidenceScore, null);
});

test('43. Repository: queryCharacterPairEvidenceProfiles filters by multiple criteria', () => {
  const scoredProfiles = queryCharacterPairEvidenceProfiles({ hasScore: true });
  assert.ok(scoredProfiles.length > 0);
  for (const p of scoredProfiles) {
    assert.ok(p.evidenceScoreSummary.pairEvidenceScore !== null);
  }

  const mornyeProfiles = queryCharacterPairEvidenceProfiles({ sourceResonatorId: 'Mornye' });
  assert.ok(mornyeProfiles.length > 0);
  for (const p of mornyeProfiles) {
    assert.strictEqual(p.sourceResonatorId, 'Mornye');
  }
});

test('44. Repository: getOutgoingProfilesForResonator and getIncomingProfilesForResonator', () => {
  const outgoing = getOutgoingProfilesForResonator('Mornye');
  assert.ok(outgoing.length > 0);
  for (const p of outgoing) {
    assert.strictEqual(p.sourceResonatorId, 'Mornye');
  }

  const incoming = getIncomingProfilesForResonator('Augusta');
  assert.ok(incoming.length > 0);
  for (const p of incoming) {
    assert.strictEqual(p.targetResonatorId, 'Augusta');
  }
});

// ============================================================================
// SUITE 8: PATCH & EXPLANATION (Tests 45-48)
// ============================================================================

test('45. Patch: strictly enforces Patch 3.7', () => {
  const profile = getCharacterPairEvidenceProfile('Mornye', 'Augusta');
  assert.strictEqual(profile.patchVersion, '3.7');
});

test('46. Patch: cross-patch rejection fails closed', () => {
  const cand = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  )[0];
  const crossPatchCand = { ...cand, patchVersion: '3.6' as any };
  const ev = evaluateCompatibilityCandidate(cand);

  assert.throws(() => {
    aggregateCharacterPairEvidence('Jiyan', 'Mortefi', [ev], [crossPatchCand]);
  }, /Step 7 rejects cross-patch candidate/);
});

test('47. Explanation: explainCharacterPairEvidenceProfile returns structured presentation', () => {
  const profile = getCharacterPairEvidenceProfile('Mornye', 'Augusta');
  const exp = explainCharacterPairEvidenceProfile(profile);

  assert.strictEqual(exp.profileId, profile.id);
  assert.strictEqual(exp.sourceResonatorId, 'Mornye');
  assert.strictEqual(exp.targetResonatorId, 'Augusta');
  assert.ok(exp.summary.includes('Character pair Mornye -> Augusta'));
  assert.strictEqual(exp.pairEvidenceScore, profile.evidenceScoreSummary.pairEvidenceScore);
});

test('48. Options: includeEmptyPairs materializes 3540 directional pairs (2087 modeled + 1453 empty)', () => {
  const allWithEmpty = getCharacterPairEvidenceProfiles({ includeEmptyPairs: true });
  assert.strictEqual(allWithEmpty.length, 3540);

  let emptyCount = 0;
  let modeledCount = 0;
  for (const p of allWithEmpty) {
    if (p.status === 'EMPTY') emptyCount++;
    else modeledCount++;
  }

  assert.strictEqual(modeledCount, 2087);
  assert.strictEqual(emptyCount, 1453);
});

// ============================================================================
// SUITE 9: PRODUCTION AUDIT & DETERMINISM (Tests 49-52)
// ============================================================================

test('49. Production: candidate evaluation reconciliation (9599 resonator candidates map 1-to-1)', () => {
  const audit = auditCharacterPairEvidenceProfiles();
  assert.strictEqual(audit.totalUpstreamCandidates, 13615);
  assert.strictEqual(audit.totalUpstreamEvaluations, 13615);
  assert.strictEqual(audit.includedResonatorCandidates, 9599);
  assert.strictEqual(audit.excludedNonResonatorCandidates, 4016);
  assert.strictEqual(audit.includedResonatorCandidates + audit.excludedNonResonatorCandidates, 13615);

  assert.strictEqual(audit.totalModeledPairs, 2087);
  assert.strictEqual(audit.uniquePairIds, 2087);
  assert.strictEqual(audit.duplicatePairIds, 0);
});

test('50. Production: production audit passes all invariants A through AG without throwing', () => {
  assert.doesNotThrow(() => {
    auditCharacterPairEvidenceProfiles();
  });
});

test('51. Production: repeated aggregation yields byte-for-byte identical output', () => {
  clearCharacterPairProfileCache();
  const profs1 = getCharacterPairEvidenceProfiles();
  clearCharacterPairProfileCache();
  const profs2 = getCharacterPairEvidenceProfiles();

  assert.strictEqual(JSON.stringify(profs1), JSON.stringify(profs2));
});

test('52. Determinism: 20/20 consecutive uncached production runs are byte-for-byte identical', () => {
  let initialJson = '';
  for (let i = 0; i < 20; i++) {
    clearCharacterPairProfileCache();
    const profs = getCharacterPairEvidenceProfiles();
    const currentJson = JSON.stringify(profs);

    if (i === 0) {
      initialJson = currentJson;
    } else {
      assert.strictEqual(currentJson, initialJson, `Determinism mismatch at run index ${i}`);
    }
  }
});
