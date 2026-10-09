/**
 * Wuthering Waves Compatibility Candidate Evaluation Audit Engine
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Implements rigorous multi-dimensional invariant audits enforcing rules A through Z
 * across candidate evaluations, and calculates comprehensive production metrics.
 */

import {
  COMPATIBILITY_EVALUATION_RULE_VERSION,
  EVALUATION_SCALE_MIN,
  EVALUATION_SCALE_MAX
} from './rules.ts';
import {
  deriveCompatibilityEvaluationId,
  compareCompatibilityEvaluation
} from './predicates.ts';
import { evaluateCompatibilityCandidates } from './evaluator.ts';
import { getCompatibilityCandidates } from '../compatibility/repository.ts';
import { auditProductionCapabilities } from '../../capabilities/builder.ts';
import { auditProductionRelationships } from '../audit.ts';
import { auditProductionInteractionEvidence } from '../composition/audit.ts';
import type {
  CompatibilityCandidateEvaluation,
  CandidateEvaluationDimension,
  CandidateEvaluationRuleCode,
  CandidateEvaluationStatus,
  ProductionEvaluationAuditMetrics
} from './types.ts';
import type { CompatibilityCandidate } from '../compatibility/types.ts';
import type { GameplayCapability } from '../../capabilities/types.ts';
import type { GameplayRelationship } from '../types.ts';
import type { InteractionEvidence } from '../composition/types.ts';

const VALID_DIMENSIONS = new Set<CandidateEvaluationDimension>([
  'EVIDENCE_DIRECTNESS',
  'EVIDENCE_COVERAGE',
  'MECHANICAL_SPECIFICITY',
  'CONTEXT_CERTAINTY',
  'TARGET_SPECIFICITY',
  'ACTION_MATCH',
  'ELEMENT_MATCH',
  'TRANSITION_MATCH',
  'RESOURCE_MATCH',
  'DEFENSIVE_MATCH',
  'OFFENSIVE_MATCH',
  'MECHANICAL_MATCH'
]);

const VALID_RULE_CODES = new Set<CandidateEvaluationRuleCode>([
  'DIRECT_EXPLICIT_LINK',
  'DIMENSIONAL_DIRECT_LINK',
  'DIMENSIONAL_BROAD_LINK',
  'ACTION_EXACT_MATCH',
  'ELEMENT_EXACT_MATCH',
  'ELEMENT_ALL_MATCH',
  'TRANSITION_OUTRO_INTRO_MATCH',
  'TARGET_SCOPE_MATCH',
  'RESOURCE_PROVISION_MATCH',
  'DEFENSIVE_PROVISION_MATCH',
  'OFFENSIVE_AMPLIFICATION_MATCH',
  'MECHANICAL_COORDINATED_MATCH',
  'MULTI_DIMENSION_COVERAGE',
  'CERTAINTY_STATIC_CONTEXT_FREE',
  'CERTAINTY_CONTEXT_SATISFIED',
  'SAFE_EFFECT_MAGNITUDE_BONUS'
]);

const VALID_STATUSES = new Set<CandidateEvaluationStatus>([
  'EVALUATED',
  'MISSING_CONTEXT',
  'CONTEXT_MISMATCH',
  'UNMODELED',
  'UNKNOWN',
  'NOT_APPLICABLE'
]);

const FORBIDDEN_TOKENS = [
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER',
  'SHIELDER',
  'BUFFER',
  'DEBUFFER',
  'HYPERCARRY',
  'QUICK_SWAP',
  'synergyScore',
  'characterScore',
  'teamScore',
  'teamSynergy',
  'bestTeam',
  'metaRank',
  'tierList',
  'dpsScore',
  'towerScore',
  'vigorScore'
];

/**
 * Audits a collection of CompatibilityCandidateEvaluations against invariants A through Z.
 */
export function auditCompatibilityEvaluations(
  evaluations?: readonly CompatibilityCandidateEvaluation[],
  candidates?: readonly CompatibilityCandidate[],
  capabilities?: readonly GameplayCapability[],
  evidenceList?: readonly InteractionEvidence[],
  relationships?: readonly GameplayRelationship[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = COMPATIBILITY_EVALUATION_RULE_VERSION
): ProductionEvaluationAuditMetrics {
  const capList = capabilities ?? auditProductionCapabilities().capabilities;
  const relList = relationships ?? auditProductionRelationships().relationships;
  const eviList = evidenceList ?? auditProductionInteractionEvidence().evidence;
  const candList = candidates ?? getCompatibilityCandidates();
  const evalList = evaluations ?? evaluateCompatibilityCandidates(candList);

  const candidateIdMap = new Map<string, CompatibilityCandidate>();
  for (const cand of candList) {
    candidateIdMap.set(cand.id, cand);
  }

  const evidenceIdSet = new Set(eviList.map((e) => e.id));
  const relationshipIdSet = new Set(relList.map((r: GameplayRelationship) => r.relationshipId));

  const seenIds = new Set<string>();
  let duplicateEvaluationIds = 0;
  let evaluationsWithScore = 0;
  let evaluationsWithoutScore = 0;
  let evaluationsUsingMagnitude = 0;
  let evaluationsWithoutMagnitude = 0;

  const validScores: number[] = [];

  const evaluationsByStatus: Record<CandidateEvaluationStatus, number> = {
    EVALUATED: 0,
    MISSING_CONTEXT: 0,
    CONTEXT_MISMATCH: 0,
    UNMODELED: 0,
    UNKNOWN: 0,
    NOT_APPLICABLE: 0
  };

  const evaluationsByRuleCode: Record<string, number> = {};
  const evaluationsByDimension: Record<string, number> = {};
  const evaluationsByCandidateType: Record<string, number> = {};

  const scoreDistribution: Record<string, number> = {
    '0.00 - 19.99': 0,
    '20.00 - 39.99': 0,
    '40.00 - 59.99': 0,
    '60.00 - 79.99': 0,
    '80.00 - 100.00': 0
  };

  for (let i = 0; i < evalList.length; i++) {
    const evaluation = evalList[i];

    // A. Every evaluation references a valid candidate
    const refCand = candidateIdMap.get(evaluation.candidateId);
    if (!refCand) {
      throw new Error(`Audit failure: Evaluation '${evaluation.id}' references unknown candidate '${evaluation.candidateId}'.`);
    }

    // B. Candidate patch = evaluation patch = '3.7'
    if (evaluation.patchVersion !== expectedPatch || refCand.patchVersion !== expectedPatch) {
      throw new Error(
        `Audit failure: Evaluation '${evaluation.id}' patch '${evaluation.patchVersion}' violates expected patch '${expectedPatch}'.`
      );
    }

    // C. Rule version is present and matches expected version
    if (evaluation.ruleVersion !== expectedRuleVersion) {
      throw new Error(
        `Audit failure: Evaluation '${evaluation.id}' ruleVersion '${evaluation.ruleVersion}' violates expected ruleVersion '${expectedRuleVersion}'.`
      );
    }

    // D. Duplicate evaluation ID check
    if (seenIds.has(evaluation.id)) {
      duplicateEvaluationIds++;
      throw new Error(`Audit failure: Duplicate evaluation ID '${evaluation.id}'.`);
    }
    seenIds.add(evaluation.id);

    // E. Deterministic ID check
    const expectedId = deriveCompatibilityEvaluationId(expectedPatch, evaluation.candidateId, expectedRuleVersion);
    if (evaluation.id !== expectedId) {
      throw new Error(`Audit failure: Non-deterministic evaluation ID '${evaluation.id}'. Expected '${expectedId}'.`);
    }

    // F. Status validity
    if (!VALID_STATUSES.has(evaluation.evaluationStatus)) {
      throw new Error(`Audit failure: Evaluation '${evaluation.id}' has invalid status '${evaluation.evaluationStatus}'.`);
    }
    evaluationsByStatus[evaluation.evaluationStatus]++;

    // G. Candidate type accounting
    const qualType = refCand.qualificationType;
    const existingCandCount = evaluationsByCandidateType[qualType];
    evaluationsByCandidateType[qualType] = typeof existingCandCount === 'number' ? existingCandCount + 1 : 1;

    // H. Epistemic score safety checks
    if (
      evaluation.evaluationStatus === 'UNKNOWN' ||
      evaluation.evaluationStatus === 'NOT_APPLICABLE' ||
      evaluation.evaluationStatus === 'UNMODELED' ||
      evaluation.evaluationStatus === 'MISSING_CONTEXT' ||
      evaluation.evaluationStatus === 'CONTEXT_MISMATCH'
    ) {
      if (evaluation.totalScore !== null) {
        throw new Error(
          `Audit failure: Evaluation '${evaluation.id}' in status '${evaluation.evaluationStatus}' has non-null score '${evaluation.totalScore}'.`
        );
      }
      if (evaluation.components.length > 0) {
        throw new Error(
          `Audit failure: Evaluation '${evaluation.id}' in status '${evaluation.evaluationStatus}' has non-empty components.`
        );
      }
      evaluationsWithoutScore++;
    } else if (evaluation.evaluationStatus === 'EVALUATED') {
      if (evaluation.totalScore === null) {
        throw new Error(`Audit failure: EVALUATED evaluation '${evaluation.id}' has null score.`);
      }
      if (!Number.isFinite(evaluation.totalScore)) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' score is not finite: '${evaluation.totalScore}'.`);
      }
      if (Number.isNaN(evaluation.totalScore)) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' score is NaN.`);
      }
      if (evaluation.totalScore < EVALUATION_SCALE_MIN || evaluation.totalScore > EVALUATION_SCALE_MAX) {
        throw new Error(
          `Audit failure: Evaluation '${evaluation.id}' score '${evaluation.totalScore}' out of bounds [${EVALUATION_SCALE_MIN}, ${EVALUATION_SCALE_MAX}].`
        );
      }

      evaluationsWithScore++;
      validScores.push(evaluation.totalScore);

      // Distribution bucket
      if (evaluation.totalScore < 20) {
        scoreDistribution['0.00 - 19.99']++;
      } else if (evaluation.totalScore < 40) {
        scoreDistribution['20.00 - 39.99']++;
      } else if (evaluation.totalScore < 60) {
        scoreDistribution['40.00 - 59.99']++;
      } else if (evaluation.totalScore < 80) {
        scoreDistribution['60.00 - 79.99']++;
      } else {
        scoreDistribution['80.00 - 100.00']++;
      }
    }

    // I. Score components audit
    let hasMagnitudeComponent = false;
    for (const comp of evaluation.components) {
      if (!VALID_DIMENSIONS.has(comp.dimension)) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' component has invalid dimension '${comp.dimension}'.`);
      }
      if (!VALID_RULE_CODES.has(comp.ruleCode)) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' component has invalid ruleCode '${comp.ruleCode}'.`);
      }
      if (!Number.isFinite(comp.value) || Number.isNaN(comp.value) || comp.value < 0) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' component has invalid value '${comp.value}'.`);
      }
      if (comp.value > comp.maxValue) {
        throw new Error(
          `Audit failure: Evaluation '${evaluation.id}' component value '${comp.value}' exceeds max '${comp.maxValue}'.`
        );
      }

      const existingRuleCount = evaluationsByRuleCode[comp.ruleCode];
      evaluationsByRuleCode[comp.ruleCode] = typeof existingRuleCount === 'number' ? existingRuleCount + 1 : 1;
      const existingDimCount = evaluationsByDimension[comp.dimension];
      evaluationsByDimension[comp.dimension] = typeof existingDimCount === 'number' ? existingDimCount + 1 : 1;

      if (comp.ruleCode === 'SAFE_EFFECT_MAGNITUDE_BONUS') {
        hasMagnitudeComponent = true;
      }
    }

    if (hasMagnitudeComponent) {
      evaluationsUsingMagnitude++;
    } else {
      evaluationsWithoutMagnitude++;
    }

    // J. Lineage references validation
    for (const eviId of evaluation.evidenceIds) {
      if (!evidenceIdSet.has(eviId)) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' references unknown evidence '${eviId}'.`);
      }
    }
    for (const relId of evaluation.relationshipIds) {
      if (!relationshipIdSet.has(relId)) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' references unknown relationship '${relId}'.`);
      }
    }

    // K. Forbidden token scanning
    const jsonStr = JSON.stringify(evaluation);
    for (const token of FORBIDDEN_TOKENS) {
      if (jsonStr.includes(`"${token}"`)) {
        throw new Error(`Audit failure: Evaluation '${evaluation.id}' contains forbidden token '${token}'.`);
      }
    }
  }

  // Canonical ordering verification
  const sortedCopy = [...evalList].sort(compareCompatibilityEvaluation);
  for (let i = 0; i < evalList.length; i++) {
    if (evalList[i].id !== sortedCopy[i].id) {
      throw new Error(`Audit failure: Evaluations are not sorted in deterministic canonical order at index ${i}.`);
    }
  }

  // Statistical calculations
  let scoreMin: number | null = null;
  let scoreMax: number | null = null;
  let scoreAverage: number | null = null;
  let scoreMedian: number | null = null;

  if (validScores.length > 0) {
    const sortedScores = [...validScores].sort((a, b) => a - b);
    scoreMin = sortedScores[0];
    scoreMax = sortedScores[sortedScores.length - 1];

    const sum = sortedScores.reduce((acc, v) => acc + v, 0);
    scoreAverage = Math.round((sum / sortedScores.length) * 100) / 100;

    const mid = Math.floor(sortedScores.length / 2);
    if (sortedScores.length % 2 === 0) {
      scoreMedian = Math.round(((sortedScores[mid - 1] + sortedScores[mid]) / 2) * 100) / 100;
    } else {
      scoreMedian = sortedScores[mid];
    }
  }

  return Object.freeze({
    totalInputCapabilities: capList.length,
    totalInputRelationships: relList.length,
    totalInputEvidence: eviList.length,
    totalInputCandidates: candList.length,
    totalEvaluations: evalList.length,
    uniqueEvaluationIds: seenIds.size,
    duplicateEvaluationIds,
    evaluationsWithScore,
    evaluationsWithoutScore,
    scoreMin,
    scoreMax,
    scoreAverage,
    scoreMedian,
    scoreDistribution: Object.freeze(scoreDistribution),
    evaluationsByStatus: Object.freeze(evaluationsByStatus),
    evaluationsByRuleCode: Object.freeze(evaluationsByRuleCode),
    evaluationsByDimension: Object.freeze(evaluationsByDimension),
    evaluationsUsingMagnitude,
    evaluationsWithoutMagnitude,
    evaluationsByCandidateType: Object.freeze(evaluationsByCandidateType),
    evaluations: evalList
  });
}
