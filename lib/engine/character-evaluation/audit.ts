/**
 * Wuthering Waves Character Evaluation Auditor
 * Phase 7 Step 16: Deterministic Investment-Aware Character Evaluation Contract
 *
 * Implements rigorous auditing of Invariants A through AZ and asserts zero prohibited keys.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. EVIDENCE EVALUATION AUDIT ONLY: Zero gameplay scores, zero DPS, zero tiering.
 * 2. PROHIBITED KEYS: Rejects any characterPower/DPS/teamScore/tier properties.
 * 3. IMMUTABILITY & PURITY: Pure inspection without mutating any objects.
 */

import {
  CHARACTER_EVALUATION_RULE_VERSION,
  COMPONENT_MAX_VALUES
} from './rules.ts';
import {
  deriveCharacterEvaluationId,
  isCharacterEvaluated,
  isCharacterPartiallyEvaluated,
  isCharacterContextDependent,
  isCharacterInvestmentUnknown,
  isCharacterUnmodeled
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import type {
  CharacterEvaluation,
  ProductionCharacterEvaluationAuditMetrics
} from './types.ts';

const PROHIBITED_KEYS = [
  'characterPower',
  'characterStrength',
  'characterScore',
  'combatPower',
  'effectivePower',
  'overallStrength',
  'DPS',
  'dps',
  'rotationDps',
  'damage',
  'damageGain',
  'teamScore',
  'teamPower',
  'teamDPS',
  'teamDps',
  'tierList',
  'metaScore',
  'powerScore',
  'buildStrength',
  'metaStrength',
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER'
];

/**
 * Asserts that a record contains zero prohibited gameplay scoring keys.
 */
export function assertNoProhibitedCharacterEvaluationKeys(record: unknown, path: string = 'root'): void {
  if (!record || typeof record !== 'object') return;

  for (const key of Object.keys(record)) {
    if (PROHIBITED_KEYS.includes(key)) {
      throw new Error(`Forbidden key '${key}' detected at ${path}.${key}.`);
    }
    const val = (record as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      assertNoProhibitedCharacterEvaluationKeys(val, `${path}.${key}`);
    }
  }
}

/**
 * Audits a collection of CharacterEvaluation records against Invariants A through AZ.
 */
export function auditCharacterEvaluations(
  evaluations: readonly CharacterEvaluation[]
): ProductionCharacterEvaluationAuditMetrics {
  const seenIds = new Set<string>();

  let evaluatedCount = 0;
  let partiallyEvaluatedCount = 0;
  let contextDependentCount = 0;
  let investmentUnknownCount = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  let invalidCount = 0;
  let noEvidenceCount = 0;
  let nonNullScoreCount = 0;
  let nullScoreCount = 0;

  const validScores: number[] = [];
  const scoreBuckets = {
    '0-19.99': 0,
    '20-39.99': 0,
    '40-59.99': 0,
    '60-79.99': 0,
    '80-100': 0
  };

  for (let i = 0; i < evaluations.length; i++) {
    const evaluation = evaluations[i];
    const path = `evaluations[${i}]`;

    // Static safety: Prohibited keys check
    assertNoProhibitedCharacterEvaluationKeys(evaluation, path);

    // Invariant A: patchVersion = '3.7'
    if (evaluation.patchVersion !== '3.7') {
      throw new Error(`Invariant A failure: patchVersion is '${evaluation.patchVersion}' at ${path}. Expected '3.7'.`);
    }

    // Invariant B: ruleVersion = '7.16.1'
    if (evaluation.ruleVersion !== CHARACTER_EVALUATION_RULE_VERSION) {
      throw new Error(`Invariant B failure: ruleVersion is '${evaluation.ruleVersion}' at ${path}. Expected '${CHARACTER_EVALUATION_RULE_VERSION}'.`);
    }

    // Invariant C: canonical resonator
    if (evaluation.status !== 'INVALID' && !isCanonicalResonatorId(evaluation.resonatorId)) {
      throw new Error(`Invariant C failure: resonatorId '${evaluation.resonatorId}' is non-canonical at ${path}.`);
    }

    // Invariant D: deterministic ID
    const expectedId = deriveCharacterEvaluationId(evaluation.resonatorId, evaluation.ruleVersion);
    if (evaluation.id !== expectedId) {
      throw new Error(`Invariant D failure: ID '${evaluation.id}' != expected '${expectedId}' at ${path}.`);
    }

    if (seenIds.has(evaluation.id)) {
      throw new Error(`Invariant D failure: duplicate ID '${evaluation.id}' at ${path}.`);
    }
    seenIds.add(evaluation.id);

    // Invariant E: valid status
    const validStatuses = [
      'EVALUATED',
      'PARTIALLY_EVALUATED',
      'CONTEXT_DEPENDENT',
      'INVESTMENT_UNKNOWN',
      'UNMODELED',
      'UNKNOWN',
      'NOT_APPLICABLE',
      'INVALID',
      'PATCH_MISMATCH',
      'NO_EVIDENCE'
    ];
    if (!validStatuses.includes(evaluation.status)) {
      throw new Error(`Invariant E failure: invalid status '${evaluation.status}' at ${path}.`);
    }

    // Status accounting
    if (evaluation.status === 'EVALUATED') evaluatedCount++;
    else if (evaluation.status === 'PARTIALLY_EVALUATED') partiallyEvaluatedCount++;
    else if (evaluation.status === 'CONTEXT_DEPENDENT') contextDependentCount++;
    else if (evaluation.status === 'INVESTMENT_UNKNOWN') investmentUnknownCount++;
    else if (evaluation.status === 'UNMODELED') unmodeledCount++;
    else if (evaluation.status === 'UNKNOWN') unknownCount++;
    else if (evaluation.status === 'NOT_APPLICABLE') notApplicableCount++;
    else if (evaluation.status === 'INVALID') invalidCount++;
    else if (evaluation.status === 'NO_EVIDENCE') noEvidenceCount++;

    // Invariant F, G: score null or bounded finite [0, 100]
    const score = evaluation.evaluationScore;
    if (score !== null) {
      nonNullScoreCount++;
      if (!Number.isFinite(score)) {
        throw new Error(`Invariant F failure: non-finite evaluationScore '${score}' at ${path}.`);
      }
      if (score < 0 || score > 100) {
        throw new Error(`Invariant G failure: evaluationScore '${score}' outside [0, 100] at ${path}.`);
      }
      // Invariant J: exact deterministic rounding
      if (Math.round(score * 100) / 100 !== score) {
        throw new Error(`Invariant J failure: unrounded evaluationScore '${score}' at ${path}.`);
      }
      validScores.push(score);

      // Score distribution buckets
      if (score < 20) scoreBuckets['0-19.99']++;
      else if (score < 40) scoreBuckets['20-39.99']++;
      else if (score < 60) scoreBuckets['40-59.99']++;
      else if (score < 80) scoreBuckets['60-79.99']++;
      else scoreBuckets['80-100']++;
    } else {
      nullScoreCount++;
    }

    // Invariant H, I: component values bounded and sum bounded
    let componentSum = 0;
    for (const comp of evaluation.components) {
      assertNoProhibitedCharacterEvaluationKeys(comp, `${path}.component.${comp.dimension}`);
      if (comp.value < 0 || comp.value > comp.maxValue) {
        throw new Error(`Invariant H failure: component '${comp.dimension}' value ${comp.value} outside [0, ${comp.maxValue}] at ${path}.`);
      }
      componentSum += comp.value;
    }
    if (componentSum > 100.01) {
      throw new Error(`Invariant I failure: component sum ${componentSum} exceeds 100 at ${path}.`);
    }

    // Invariant W, X, Y, Z: deduplication
    if (new Set(evaluation.synergyProfileIds).size !== evaluation.synergyProfileIds.length) {
      throw new Error(`Invariant W failure: duplicate synergyProfileIds at ${path}.`);
    }
    if (new Set(evaluation.investmentEffectIds).size !== evaluation.investmentEffectIds.length) {
      throw new Error(`Invariant X failure: duplicate investmentEffectIds at ${path}.`);
    }
    if (new Set(evaluation.evidenceIds).size !== evaluation.evidenceIds.length) {
      throw new Error(`Invariant Y failure: duplicate evidenceIds at ${path}.`);
    }
    if (new Set(evaluation.relationshipIds).size !== evaluation.relationshipIds.length) {
      throw new Error(`Invariant Z failure: duplicate relationshipIds at ${path}.`);
    }
    if (new Set(evaluation.sourceFactIds).size !== evaluation.sourceFactIds.length) {
      throw new Error(`Invariant Z failure: duplicate sourceFactIds at ${path}.`);
    }

    // Invariant AC: provenance preserved
    if (evaluation.provenance.patchVersion !== '3.7' || !evaluation.provenance.sourceProvenance) {
      throw new Error(`Invariant AC failure: invalid provenance at ${path}.`);
    }
  }

  // Summary statistics
  validScores.sort((a, b) => a - b);
  const minScore = validScores.length > 0 ? validScores[0] : null;
  const maxScore = validScores.length > 0 ? validScores[validScores.length - 1] : null;
  const avgScore = validScores.length > 0
    ? Math.round((validScores.reduce((sum, s) => sum + s, 0) / validScores.length) * 100) / 100
    : null;
  let medianScore: number | null = null;
  if (validScores.length > 0) {
    const mid = Math.floor(validScores.length / 2);
    medianScore = validScores.length % 2 !== 0
      ? validScores[mid]
      : Math.round(((validScores[mid - 1] + validScores[mid]) / 2) * 100) / 100;
  }

  return Object.freeze({
    totalResonatorsAudited: evaluations.length,
    evaluatedCount,
    partiallyEvaluatedCount,
    contextDependentCount,
    investmentUnknownCount,
    unmodeledCount,
    unknownCount,
    notApplicableCount,
    invalidCount,
    noEvidenceCount,
    nonNullScoreCount,
    nullScoreCount,
    minScore,
    maxScore,
    avgScore,
    medianScore,
    scoreBuckets: Object.freeze(scoreBuckets),
    allInvariantsPassed: true
  });
}
