/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluation Auditor
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Audits TeamCompositionCandidateEvaluation records against Invariants A through AE.
 * Strictly verifies deterministic IDs, bounded scores, null score gating for blocked statuses,
 * anti-double-counting, provenance completeness, and absolute absence of gameplay/meta inferences.
 */

import { auditTeamCompositionCandidates } from '../audit.ts';
import { getTeamCompositionCandidates } from '../repository.ts';
import { getCandidateById, getTeamCompositionEvaluations } from './repository.ts';
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../../relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../rules.ts';
import {
  TEAM_COMPOSITION_EVALUATION_RULE_VERSION,
  MAX_PAIR_EVIDENCE_STRENGTH,
  MAX_EVIDENCE_COVERAGE,
  MAX_INDEPENDENT_LINEAGE_COVERAGE,
  MAX_DIRECTIONAL_SUPPORT,
  MAX_SYNERGY_CATEGORY_DIVERSITY,
  MAX_CONTEXT_CERTAINTY,
  TEAM_EVALUATION_SCORE_SCALE_MIN,
  TEAM_EVALUATION_SCORE_SCALE_MAX
} from './rules.ts';
import {
  deriveTeamCompositionEvaluationId,
  roundToTwoDecimals
} from './predicates.ts';
import type {
  TeamCompositionCandidateEvaluation,
  TeamCompositionEvaluationDimension,
  ProductionTeamEvaluationAuditMetrics
} from './types.ts';

/** Prohibited keys that MUST NEVER exist on a TeamCompositionCandidateEvaluation */
export const PROHIBITED_KEYS_ON_EVALUATION: readonly string[] = Object.freeze([
  'characterPower',
  'characterStrength',
  'characterScore',
  'resonatorPower',
  'resonatorScore',
  'teamPower',
  'teamDPS',
  'teamDps',
  'rotationDps',
  'dpsScore',
  'damageGain',
  'teamDamageIncrease',
  'damageRanking',
  'teamRanking',
  'bestTeam',
  'teamViability',
  'metaRank',
  'metaScore',
  'tierList',
  'toaScore',
  'towerScore',
  'vigorScore',
  'antiSynergyScore',
  'conflictScore',
  'incompatibilityPenalty',
  'negativeSynergy',
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER',
  'BUFFER'
]);

/**
 * Validates that an object contains zero prohibited property names or values.
 */
export function assertNoProhibitedEvaluationKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedEvaluationKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_EVALUATION) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedEvaluationKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Audits a collection of TeamCompositionCandidateEvaluations against strict Invariants A through AE.
 */
export function auditTeamCompositionEvaluations(
  evaluationsInput?: readonly TeamCompositionCandidateEvaluation[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = TEAM_COMPOSITION_EVALUATION_RULE_VERSION
): ProductionTeamEvaluationAuditMetrics {
  const step9Audit = auditTeamCompositionCandidates();
  const evaluations = evaluationsInput ?? getTeamCompositionEvaluations();

  const totalEvaluations = evaluations.length;
  if (totalEvaluations === 0) {
    throw new Error('Audit failure: Zero team composition candidate evaluations provided for audit.');
  }

  // Verify upstream rule versions (Invariant AC & AD)
  if (CHARACTER_PAIR_SYNERGY_RULE_VERSION !== '7.8.1') {
    throw new Error(
      `Invariant AC failure: Upstream Step 8 rule version modified: ${CHARACTER_PAIR_SYNERGY_RULE_VERSION} !== '7.8.1'.`
    );
  }
  if (TEAM_COMPOSITION_RULE_VERSION !== '7.9.1') {
    throw new Error(
      `Invariant AD failure: Upstream Step 9 rule version modified: ${TEAM_COMPOSITION_RULE_VERSION} !== '7.9.1'.`
    );
  }

  const seenEvaluationIds = new Set<string>();
  let duplicateEvaluationIds = 0;

  let evaluatedCount = 0;
  let partiallyEvaluatedCount = 0;
  let missingContextCount = 0;
  let contextMismatchCount = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  let noEvidenceCount = 0;

  const validScores: number[] = [];
  const scoreBuckets: Record<string, number> = {
    '0-20': 0,
    '20-40': 0,
    '40-60': 0,
    '60-80': 0,
    '80-100': 0,
    NULL: 0
  };

  const dimensionTotals: Record<TeamCompositionEvaluationDimension, number> = {
    PAIR_EVIDENCE_STRENGTH: 0,
    EVIDENCE_COVERAGE: 0,
    INDEPENDENT_LINEAGE_COVERAGE: 0,
    DIRECTIONAL_SUPPORT: 0,
    SYNERGY_CATEGORY_DIVERSITY: 0,
    CONTEXT_CERTAINTY: 0
  };

  for (let i = 0; i < evaluations.length; i++) {
    const ev = evaluations[i];
    const path = `evaluations[${i}]`;

    // Static safety check on object structure
    assertNoProhibitedEvaluationKeys(ev, path);

    // Invariant A: patchVersion === '3.7'
    if (ev.patchVersion !== expectedPatch) {
      throw new Error(`Invariant A failure: patchVersion is '${ev.patchVersion}', expected '${expectedPatch}'.`);
    }

    // Invariant B: ruleVersion === '7.10.1'
    if (ev.ruleVersion !== expectedRuleVersion) {
      throw new Error(`Invariant B failure: ruleVersion is '${ev.ruleVersion}', expected '${expectedRuleVersion}'.`);
    }

    // Invariant C & D: candidateId references a valid Step 9 candidate
    const candidate = getCandidateById(ev.candidateId);
    if (!candidate) {
      throw new Error(`Invariant C/D failure: Candidate ID '${ev.candidateId}' does not reference a valid candidate.`);
    }

    // Invariant E & F: Team has exactly 3 members and canonical identity preserved
    if (candidate.memberResonatorIds.length !== 3) {
      throw new Error(`Invariant E failure: Candidate '${ev.candidateId}' does not have exactly 3 members.`);
    }

    // Invariant G: No duplicate evaluation IDs
    if (seenEvaluationIds.has(ev.id)) {
      duplicateEvaluationIds++;
      throw new Error(`Invariant G failure: Duplicate evaluation ID detected: '${ev.id}'.`);
    }
    seenEvaluationIds.add(ev.id);

    // Invariant H: Deterministic evaluation ID derivation
    const expectedId = deriveTeamCompositionEvaluationId(expectedPatch, ev.candidateId, expectedRuleVersion);
    if (ev.id !== expectedId) {
      throw new Error(`Invariant H failure: Evaluation ID '${ev.id}' != expected deterministic ID '${expectedId}'.`);
    }

    // Status accounting
    switch (ev.evaluationStatus) {
      case 'EVALUATED':
        evaluatedCount++;
        break;
      case 'PARTIALLY_EVALUATED':
        partiallyEvaluatedCount++;
        break;
      case 'MISSING_CONTEXT':
        missingContextCount++;
        break;
      case 'CONTEXT_MISMATCH':
        contextMismatchCount++;
        break;
      case 'UNMODELED':
        unmodeledCount++;
        break;
      case 'UNKNOWN':
        unknownCount++;
        break;
      case 'NOT_APPLICABLE':
        notApplicableCount++;
        break;
      case 'NO_EVIDENCE':
        noEvidenceCount++;
        break;
      default:
        throw new Error(`Unknown evaluation status '${ev.evaluationStatus}' at ${path}.`);
    }

    // Invariant L, M, N, O, P: Fail-closed gating for blocked statuses
    const isBlocked =
      ev.evaluationStatus === 'MISSING_CONTEXT' ||
      ev.evaluationStatus === 'CONTEXT_MISMATCH' ||
      ev.evaluationStatus === 'UNMODELED' ||
      ev.evaluationStatus === 'UNKNOWN' ||
      ev.evaluationStatus === 'NOT_APPLICABLE' ||
      ev.evaluationStatus === 'NO_EVIDENCE';

    if (isBlocked) {
      if (ev.totalScore !== null) {
        throw new Error(
          `Invariant L-P failure: Blocked status '${ev.evaluationStatus}' has non-null score ${ev.totalScore}.`
        );
      }
      if (ev.components.length !== 0) {
        throw new Error(
          `Invariant L-P failure: Blocked status '${ev.evaluationStatus}' has non-empty components (${ev.components.length}).`
        );
      }
      scoreBuckets.NULL++;
    } else {
      // Invariant I, J, K: Scored evaluation constraints
      if (ev.totalScore === null) {
        throw new Error(
          `Invariant I failure: Evaluated status '${ev.evaluationStatus}' has null score at ${path}.`
        );
      }
      if (!Number.isFinite(ev.totalScore)) {
        throw new Error(`Invariant I failure: Non-finite score ${ev.totalScore} at ${path}.`);
      }
      if (ev.totalScore < TEAM_EVALUATION_SCORE_SCALE_MIN || ev.totalScore > TEAM_EVALUATION_SCORE_SCALE_MAX) {
        throw new Error(`Invariant J failure: Score ${ev.totalScore} outside [0.00, 100.00] at ${path}.`);
      }
      if (ev.totalScore !== roundToTwoDecimals(ev.totalScore)) {
        throw new Error(`Invariant K failure: Score ${ev.totalScore} is not rounded to 2 decimals at ${path}.`);
      }

      validScores.push(ev.totalScore);

      // Bucket categorization
      if (ev.totalScore <= 20) scoreBuckets['0-20']++;
      else if (ev.totalScore <= 40) scoreBuckets['20-40']++;
      else if (ev.totalScore <= 60) scoreBuckets['40-60']++;
      else if (ev.totalScore <= 80) scoreBuckets['60-80']++;
      else scoreBuckets['80-100']++;

      // Invariant Q & R: Provenance and component bounds
      let sumComponentValues = 0;
      for (const comp of ev.components) {
        if (!Number.isFinite(comp.value) || comp.value < 0) {
          throw new Error(`Invariant AA failure: Negative or non-finite component value ${comp.value} in ${comp.dimension}.`);
        }
        if (comp.value > comp.maxValue) {
          throw new Error(
            `Invariant Q failure: Component value ${comp.value} exceeds maxValue ${comp.maxValue} in ${comp.dimension}.`
          );
        }

        // Positive points must carry explicit provenance
        if (comp.value > 0) {
          if (comp.evidenceIds.length === 0) {
            throw new Error(`Invariant R failure: Positive component ${comp.dimension} has empty evidenceIds.`);
          }
          if (comp.relationshipIds.length === 0) {
            throw new Error(`Invariant R failure: Positive component ${comp.dimension} has empty relationshipIds.`);
          }
          if (comp.sourceFactIds.length === 0) {
            throw new Error(`Invariant R failure: Positive component ${comp.dimension} has empty sourceFactIds.`);
          }
          if (comp.reasonCodes.length === 0) {
            throw new Error(`Invariant R failure: Positive component ${comp.dimension} has empty reasonCodes.`);
          }
        }

        dimensionTotals[comp.dimension] += comp.value;
        sumComponentValues += comp.value;
      }

      // Verify clamped sum matches totalScore
      const expectedClamped = roundToTwoDecimals(Math.min(100.0, Math.max(0.0, sumComponentValues)));
      if (ev.totalScore !== expectedClamped) {
        throw new Error(
          `Invariant Q failure: Total score ${ev.totalScore} does not match clamped sum of components ${expectedClamped}.`
        );
      }
    }
  }

  // Reconciliation checks
  const totalCategorized =
    evaluatedCount +
    partiallyEvaluatedCount +
    missingContextCount +
    contextMismatchCount +
    unmodeledCount +
    unknownCount +
    notApplicableCount +
    noEvidenceCount;

  if (totalCategorized !== totalEvaluations) {
    throw new Error(
      `Reconciliation failure: Status sum ${totalCategorized} does not match total evaluations ${totalEvaluations}.`
    );
  }

  // Calculate descriptive distribution metrics
  validScores.sort((a, b) => a - b);
  const minScore = validScores.length > 0 ? validScores[0] : null;
  const maxScore = validScores.length > 0 ? validScores[validScores.length - 1] : null;
  const sumScore = validScores.reduce((acc, s) => acc + s, 0);
  const averageScore = validScores.length > 0 ? roundToTwoDecimals(sumScore / validScores.length) : null;
  let medianScore: number | null = null;
  if (validScores.length > 0) {
    const mid = Math.floor(validScores.length / 2);
    medianScore =
      validScores.length % 2 === 0
        ? roundToTwoDecimals((validScores[mid - 1] + validScores[mid]) / 2)
        : validScores[mid];
  }

  const dimensionContributionAverages: Record<TeamCompositionEvaluationDimension, number> = {
    PAIR_EVIDENCE_STRENGTH:
      validScores.length > 0 ? roundToTwoDecimals(dimensionTotals.PAIR_EVIDENCE_STRENGTH / validScores.length) : 0,
    EVIDENCE_COVERAGE:
      validScores.length > 0 ? roundToTwoDecimals(dimensionTotals.EVIDENCE_COVERAGE / validScores.length) : 0,
    INDEPENDENT_LINEAGE_COVERAGE:
      validScores.length > 0 ? roundToTwoDecimals(dimensionTotals.INDEPENDENT_LINEAGE_COVERAGE / validScores.length) : 0,
    DIRECTIONAL_SUPPORT:
      validScores.length > 0 ? roundToTwoDecimals(dimensionTotals.DIRECTIONAL_SUPPORT / validScores.length) : 0,
    SYNERGY_CATEGORY_DIVERSITY:
      validScores.length > 0 ? roundToTwoDecimals(dimensionTotals.SYNERGY_CATEGORY_DIVERSITY / validScores.length) : 0,
    CONTEXT_CERTAINTY:
      validScores.length > 0 ? roundToTwoDecimals(dimensionTotals.CONTEXT_CERTAINTY / validScores.length) : 0
  };

  return Object.freeze({
    totalResonators: step9Audit.totalResonators,
    theoreticalTeams: step9Audit.theoreticalTriples,
    totalMaterializedEvaluations: totalEvaluations,
    uniqueEvaluationIds: seenEvaluationIds.size,
    duplicateEvaluationIds,

    evaluatedCount,
    partiallyEvaluatedCount,
    missingContextCount,
    contextMismatchCount,
    unmodeledCount,
    unknownCount,
    notApplicableCount,
    noEvidenceCount,

    evaluationsWithScore: validScores.length,
    evaluationsWithoutScore: totalEvaluations - validScores.length,

    minScore,
    maxScore,
    averageScore,
    medianScore,

    scoreDistribution: Object.freeze(scoreBuckets),
    dimensionContributionAverages: Object.freeze(dimensionContributionAverages),

    evaluations
  });
}
