/**
 * Wuthering Waves Compatibility Candidate Evaluator Engine
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Implements pure, deterministic, side-effect free numerical evaluation of approved
 * CompatibilityCandidate records into structured CompatibilityCandidateEvaluation domain models.
 *
 * CENTRAL INVARIANTS:
 * 1. EVIDENCE STRENGTH != CHARACTER POWER: Evaluates deterministic evidence strength only.
 * 2. BOUNDED SCALE: Scores are strictly clamped within [0, 100].
 * 3. NO MAGIC VALUES: Every point is derived from explicit rules and constants in rules.ts.
 * 4. EPISTEMIC FIDELITY: UNMODELED, UNKNOWN, NOT_APPLICABLE, MISSING_CONTEXT, and CONTEXT_MISMATCH strictly yield totalScore: null.
 * 5. NO DOUBLE-COUNTING: Underlying fact IDs and orthogonal dimensions are deduplicated.
 */

import {
  COMPATIBILITY_EVALUATION_RULE_VERSION,
  EVALUATION_SCALE_MIN,
  EVALUATION_SCALE_MAX,
  MAX_SCORE_DIRECTNESS,
  MAX_SCORE_SPECIFICITY,
  MAX_SCORE_COVERAGE,
  MAX_SCORE_CERTAINTY,
  MAX_SCORE_MAGNITUDE,
  DIRECT_EXPLICIT_LINK_SCORE,
  DIMENSIONAL_DIRECT_LINK_SCORE,
  DIMENSIONAL_BROAD_LINK_SCORE,
  SPECIFICITY_ACTION_EXACT_SCORE,
  SPECIFICITY_ELEMENT_EXACT_SCORE,
  SPECIFICITY_ELEMENT_ALL_SCORE,
  SPECIFICITY_TRANSITION_SCORE,
  SPECIFICITY_RESOURCE_SCORE,
  SPECIFICITY_MECHANICAL_SCORE,
  SPECIFICITY_OFFENSIVE_SCORE,
  SPECIFICITY_DEFENSIVE_SCORE,
  SPECIFICITY_TARGET_SCOPE_SCORE,
  COVERAGE_ONE_DIMENSION_SCORE,
  COVERAGE_TWO_DIMENSIONS_SCORE,
  COVERAGE_THREE_PLUS_DIMENSIONS_SCORE,
  CERTAINTY_STATIC_CONTEXT_FREE_SCORE,
  CERTAINTY_CONTEXT_SATISFIED_SCORE,
  MAGNITUDE_SCALE_MAX_BUFF_PERCENT
} from './rules.ts';
import {
  deriveCompatibilityEvaluationId,
  compareCompatibilityEvaluation
} from './predicates.ts';
import { evaluateCompatibilityCandidateApplicability } from '../compatibility/predicates.ts';
import type {
  CompatibilityCandidate,
  CandidateQualificationType
} from '../compatibility/types.ts';
import type {
  CompatibilityCandidateEvaluation,
  CompatibilityScoreComponent,
  CandidateEvaluationDimension,
  CandidateEvaluationStatus,
  CompatibilityEvaluationOptions
} from './types.ts';

/**
 * Maps qualification type to corresponding specific match dimension.
 */
function getSpecificityDimension(qualType: CandidateQualificationType): CandidateEvaluationDimension {
  switch (qualType) {
    case 'ACTION_COMPATIBILITY_CANDIDATE':
      return 'ACTION_MATCH';
    case 'ELEMENT_COMPATIBILITY_CANDIDATE':
      return 'ELEMENT_MATCH';
    case 'TRANSITION_COMPATIBILITY_CANDIDATE':
      return 'TRANSITION_MATCH';
    case 'RESOURCE_COMPATIBILITY_CANDIDATE':
      return 'RESOURCE_MATCH';
    case 'DEFENSIVE_COMPATIBILITY_CANDIDATE':
      return 'DEFENSIVE_MATCH';
    case 'OFFENSIVE_COMPATIBILITY_CANDIDATE':
      return 'OFFENSIVE_MATCH';
    case 'MECHANICAL_COMPATIBILITY_CANDIDATE':
      return 'MECHANICAL_MATCH';
    case 'TARGET_SCOPE_COMPATIBILITY_CANDIDATE':
    case 'EXPLICIT_TARGET_LINK':
    default:
      return 'TARGET_SPECIFICITY';
  }
}

/**
 * Deterministically evaluates a single CompatibilityCandidate under explicit evaluation rules.
 * Pure, synchronous, side-effect free, and fail-closed.
 */
export function evaluateCompatibilityCandidate(
  candidate: CompatibilityCandidate,
  options?: CompatibilityEvaluationOptions
): CompatibilityCandidateEvaluation {
  // 1. Patch Isolation (strictly Patch 3.7)
  if (candidate.patchVersion !== '3.7') {
    throw new Error(
      `Evaluation engine strictly requires Patch 3.7. Candidate '${candidate.id}' has patchVersion '${candidate.patchVersion}'.`
    );
  }

  const ruleVersion = options?.ruleVersion ?? COMPATIBILITY_EVALUATION_RULE_VERSION;
  const id = deriveCompatibilityEvaluationId('3.7', candidate.id, ruleVersion);

  // 2. Applicability delegation (100% to Step 2 / Step 5)
  const applicability = evaluateCompatibilityCandidateApplicability(candidate, options?.context);

  // 3. Epistemic Status Hierarchy (Fail-closed)
  let evaluationStatus: CandidateEvaluationStatus;

  if (candidate.status === 'UNKNOWN') {
    evaluationStatus = 'UNKNOWN';
  } else if (candidate.status === 'NOT_APPLICABLE') {
    evaluationStatus = 'NOT_APPLICABLE';
  } else if (candidate.status === 'UNMODELED') {
    evaluationStatus = 'UNMODELED';
  } else if (applicability.status === 'CONTEXT_MISMATCH') {
    evaluationStatus = 'CONTEXT_MISMATCH';
  } else if (applicability.status === 'MISSING_CONTEXT') {
    evaluationStatus = 'MISSING_CONTEXT';
  } else if (applicability.isApplicable) {
    evaluationStatus = 'EVALUATED';
  } else {
    evaluationStatus = 'NOT_APPLICABLE';
  }

  // Non-applicable, unmodeled, unknown, or mismatched context strictly yields null score
  if (evaluationStatus !== 'EVALUATED') {
    const explanationCodes = Object.freeze([
      `STATUS_${evaluationStatus}`,
      ...applicability.reasons
    ]);

    return Object.freeze({
      id,
      candidateId: candidate.id,
      patchVersion: '3.7',
      ruleVersion,
      totalScore: null,
      evaluationStatus,
      components: Object.freeze([]),
      candidate,
      evidenceIds: candidate.evidenceIds,
      relationshipIds: candidate.relationshipIds,
      applicability,
      explanationCodes,
      provenance: candidate.provenance
    });
  }

  // 4. Component Score Derivations
  const components: CompatibilityScoreComponent[] = [];
  const explanationCodes: string[] = [];

  // A. DIRECTNESS COMPONENT (Max: 25)
  let directnessValue: number;
  let directnessRuleCode: CompatibilityScoreComponent['ruleCode'];

  if (candidate.qualificationNature === 'EXPLICIT') {
    directnessValue = DIRECT_EXPLICIT_LINK_SCORE;
    directnessRuleCode = 'DIRECT_EXPLICIT_LINK';
  } else if (
    candidate.sourceCapability.target === 'NEXT_RESONATOR' ||
    candidate.sourceCapability.target === 'ACTIVE_CHARACTER'
  ) {
    directnessValue = DIMENSIONAL_DIRECT_LINK_SCORE;
    directnessRuleCode = 'DIMENSIONAL_DIRECT_LINK';
  } else {
    directnessValue = DIMENSIONAL_BROAD_LINK_SCORE;
    directnessRuleCode = 'DIMENSIONAL_BROAD_LINK';
  }

  components.push(
    Object.freeze({
      dimension: 'EVIDENCE_DIRECTNESS',
      value: directnessValue,
      maxValue: MAX_SCORE_DIRECTNESS,
      ruleCode: directnessRuleCode,
      evidenceIds: candidate.evidenceIds,
      relationshipIds: candidate.relationshipIds,
      reasonCodes: Object.freeze([directnessRuleCode])
    })
  );
  explanationCodes.push(directnessRuleCode);

  // B. SPECIFICITY COMPONENT (Max: 35)
  let specificityValue: number;
  let specificityRuleCode: CompatibilityScoreComponent['ruleCode'];
  const specificityDim = getSpecificityDimension(candidate.qualificationType);

  switch (candidate.qualificationType) {
    case 'ACTION_COMPATIBILITY_CANDIDATE':
      specificityValue = SPECIFICITY_ACTION_EXACT_SCORE;
      specificityRuleCode = 'ACTION_EXACT_MATCH';
      break;

    case 'ELEMENT_COMPATIBILITY_CANDIDATE':
      if (candidate.sourceCapability.element === 'All') {
        specificityValue = SPECIFICITY_ELEMENT_ALL_SCORE;
        specificityRuleCode = 'ELEMENT_ALL_MATCH';
      } else {
        specificityValue = SPECIFICITY_ELEMENT_EXACT_SCORE;
        specificityRuleCode = 'ELEMENT_EXACT_MATCH';
      }
      break;

    case 'TRANSITION_COMPATIBILITY_CANDIDATE':
      specificityValue = SPECIFICITY_TRANSITION_SCORE;
      specificityRuleCode = 'TRANSITION_OUTRO_INTRO_MATCH';
      break;

    case 'RESOURCE_COMPATIBILITY_CANDIDATE':
      specificityValue = SPECIFICITY_RESOURCE_SCORE;
      specificityRuleCode = 'RESOURCE_PROVISION_MATCH';
      break;

    case 'DEFENSIVE_COMPATIBILITY_CANDIDATE':
      specificityValue = SPECIFICITY_DEFENSIVE_SCORE;
      specificityRuleCode = 'DEFENSIVE_PROVISION_MATCH';
      break;

    case 'OFFENSIVE_COMPATIBILITY_CANDIDATE':
      specificityValue = SPECIFICITY_OFFENSIVE_SCORE;
      specificityRuleCode = 'OFFENSIVE_AMPLIFICATION_MATCH';
      break;

    case 'MECHANICAL_COMPATIBILITY_CANDIDATE':
      specificityValue = SPECIFICITY_MECHANICAL_SCORE;
      specificityRuleCode = 'MECHANICAL_COORDINATED_MATCH';
      break;

    case 'TARGET_SCOPE_COMPATIBILITY_CANDIDATE':
      specificityValue = SPECIFICITY_TARGET_SCOPE_SCORE;
      specificityRuleCode = 'TARGET_SCOPE_MATCH';
      break;

    case 'EXPLICIT_TARGET_LINK':
    default:
      specificityValue = SPECIFICITY_ACTION_EXACT_SCORE;
      specificityRuleCode = 'DIRECT_EXPLICIT_LINK';
      break;
  }

  components.push(
    Object.freeze({
      dimension: specificityDim,
      value: specificityValue,
      maxValue: MAX_SCORE_SPECIFICITY,
      ruleCode: specificityRuleCode,
      evidenceIds: candidate.evidenceIds,
      relationshipIds: candidate.relationshipIds,
      reasonCodes: Object.freeze([specificityRuleCode, ...candidate.reasonCodes])
    })
  );
  explanationCodes.push(specificityRuleCode);

  // C. EVIDENCE COVERAGE COMPONENT (Max: 15)
  // Deduplicate matched dimensions by unique kind to prevent artificial multiplication
  const distinctKinds = new Set(candidate.matchedDimensions.map((d) => d.kind));
  let coverageValue: number;

  if (distinctKinds.size >= 3) {
    coverageValue = COVERAGE_THREE_PLUS_DIMENSIONS_SCORE;
  } else if (distinctKinds.size === 2) {
    coverageValue = COVERAGE_TWO_DIMENSIONS_SCORE;
  } else {
    coverageValue = COVERAGE_ONE_DIMENSION_SCORE;
  }

  components.push(
    Object.freeze({
      dimension: 'EVIDENCE_COVERAGE',
      value: coverageValue,
      maxValue: MAX_SCORE_COVERAGE,
      ruleCode: 'MULTI_DIMENSION_COVERAGE',
      evidenceIds: candidate.evidenceIds,
      relationshipIds: candidate.relationshipIds,
      reasonCodes: Object.freeze([
        'MULTI_DIMENSION_COVERAGE',
        `DISTINCT_DIMENSIONS_${distinctKinds.size}`
      ])
    })
  );
  explanationCodes.push(`COVERAGE_${distinctKinds.size}_DIMENSIONS`);

  // D. CONTEXT CERTAINTY COMPONENT (Max: 15)
  let certaintyValue: number;
  let certaintyRuleCode: CompatibilityScoreComponent['ruleCode'];

  if (candidate.sourceCapability.isStatic && candidate.targetCapability.isStatic) {
    certaintyValue = CERTAINTY_STATIC_CONTEXT_FREE_SCORE;
    certaintyRuleCode = 'CERTAINTY_STATIC_CONTEXT_FREE';
  } else {
    certaintyValue = CERTAINTY_CONTEXT_SATISFIED_SCORE;
    certaintyRuleCode = 'CERTAINTY_CONTEXT_SATISFIED';
  }

  components.push(
    Object.freeze({
      dimension: 'CONTEXT_CERTAINTY',
      value: certaintyValue,
      maxValue: MAX_SCORE_CERTAINTY,
      ruleCode: certaintyRuleCode,
      evidenceIds: candidate.evidenceIds,
      relationshipIds: candidate.relationshipIds,
      reasonCodes: Object.freeze([certaintyRuleCode])
    })
  );
  explanationCodes.push(certaintyRuleCode);

  // E. SAFE EFFECT MAGNITUDE BONUS COMPONENT (Max: 10)
  // Strictly applied ONLY when effectValue is known, safe, non-null, finite, > 0, and not UNMODELED
  if (
    candidate.effectValue !== null &&
    Number.isFinite(candidate.effectValue) &&
    candidate.effectValue > 0 &&
    candidate.status !== 'UNMODELED' &&
    candidate.unit === 'PERCENT'
  ) {
    const rawMagnitude = (candidate.effectValue / MAGNITUDE_SCALE_MAX_BUFF_PERCENT) * MAX_SCORE_MAGNITUDE;
    const magnitudeValue = Math.min(MAX_SCORE_MAGNITUDE, Math.round(rawMagnitude * 100) / 100);

    if (magnitudeValue > 0) {
      components.push(
        Object.freeze({
          dimension: specificityDim,
          value: magnitudeValue,
          maxValue: MAX_SCORE_MAGNITUDE,
          ruleCode: 'SAFE_EFFECT_MAGNITUDE_BONUS',
          evidenceIds: candidate.evidenceIds,
          relationshipIds: candidate.relationshipIds,
          reasonCodes: Object.freeze([
            'SAFE_EFFECT_MAGNITUDE_BONUS',
            `MAGNITUDE_${candidate.effectValue}_PERCENT`
          ])
        })
      );
      explanationCodes.push(`MAGNITUDE_BONUS_${magnitudeValue}`);
    }
  }

  // 5. Total Score Aggregation & Bounding
  const rawSum = components.reduce((sum, c) => sum + c.value, 0);
  const totalScore = Math.min(
    EVALUATION_SCALE_MAX,
    Math.max(EVALUATION_SCALE_MIN, Math.round(rawSum * 100) / 100)
  );

  return Object.freeze({
    id,
    candidateId: candidate.id,
    patchVersion: '3.7',
    ruleVersion,
    totalScore,
    evaluationStatus,
    components: Object.freeze(components),
    candidate,
    evidenceIds: candidate.evidenceIds,
    relationshipIds: candidate.relationshipIds,
    applicability,
    explanationCodes: Object.freeze(explanationCodes),
    provenance: candidate.provenance
  });
}

/**
 * Deterministically evaluates a collection of CompatibilityCandidates.
 * Returns an immutable collection canonically ordered by compareCompatibilityEvaluation.
 */
export function evaluateCompatibilityCandidates(
  candidates: readonly CompatibilityCandidate[],
  options?: CompatibilityEvaluationOptions
): readonly CompatibilityCandidateEvaluation[] {
  const evaluations = candidates.map((cand) => evaluateCompatibilityCandidate(cand, options));
  evaluations.sort(compareCompatibilityEvaluation);
  return Object.freeze(evaluations);
}
