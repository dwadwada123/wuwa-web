/**
 * Wuthering Waves Compatibility Candidate Evaluation Module
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Public surface exporting pure domain models, evaluation rules, predicates,
 * repositories, auditors, and deterministic explanation utilities.
 */

import type {
  CompatibilityCandidateEvaluation,
  CompatibilityEvaluationExplanation,
  CandidateEvaluationRuleCode
} from './types.ts';

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './evaluator.ts';
export * from './repository.ts';
export * from './audit.ts';

/**
 * Returns a human-readable description for a machine-readable rule code.
 */
function describeRuleCode(ruleCode: CandidateEvaluationRuleCode): string {
  switch (ruleCode) {
    case 'DIRECT_EXPLICIT_LINK':
      return 'Explicit pairwise target linkage verified by Step 4 interaction evidence.';
    case 'DIMENSIONAL_DIRECT_LINK':
      return 'Dimensional candidate with targeted scope (Next Resonator or Active Character).';
    case 'DIMENSIONAL_BROAD_LINK':
      return 'Dimensional candidate with broad mechanical team scope.';
    case 'ACTION_EXACT_MATCH':
      return 'Source capability amplifies the exact action type executed by target capability.';
    case 'ELEMENT_EXACT_MATCH':
      return 'Exact canonical element match between source amplification and target element.';
    case 'ELEMENT_ALL_MATCH':
      return 'All-Attribute source amplification satisfies target canonical element.';
    case 'TRANSITION_OUTRO_INTRO_MATCH':
      return 'Source Outro / Next Resonator mechanic coordinates with target Intro trigger.';
    case 'TARGET_SCOPE_MATCH':
      return 'Broad mechanical target scope compatibility.';
    case 'RESOURCE_PROVISION_MATCH':
      return 'Source resource provision or cooldown reduction matches target energy/resource mechanics.';
    case 'DEFENSIVE_PROVISION_MATCH':
      return 'Source healing or shield provision provides survivability support to teammate combat capability.';
    case 'OFFENSIVE_AMPLIFICATION_MATCH':
      return 'Source ATK/CRIT amplification or DEF/RES shred matches teammate offensive combat capability.';
    case 'MECHANICAL_COORDINATED_MATCH':
      return 'Source coordinated attack mechanic synchronizes with teammate combat attacks.';
    case 'MULTI_DIMENSION_COVERAGE':
      return 'Candidate is supported across multiple distinct orthogonal mechanical dimensions.';
    case 'CERTAINTY_STATIC_CONTEXT_FREE':
      return 'Both capabilities are verified static and context-free with 100% unconditional readiness.';
    case 'CERTAINTY_CONTEXT_SATISFIED':
      return 'Capabilities are contextual and verified applicable under supplied evaluation context.';
    case 'SAFE_EFFECT_MAGNITUDE_BONUS':
      return 'Verified numeric gameplay effect percentage bonus scaled within bounded parameters.';
    default:
      return 'Deterministic mechanical evaluation rule applied.';
  }
}

/**
 * Generates a deterministic, machine-structured explanation of a candidate evaluation.
 * STRICTLY PRESENTATION ONLY: Never an input to scoring or evaluation logic.
 */
export function explainCompatibilityEvaluation(
  evaluation: CompatibilityCandidateEvaluation
): CompatibilityEvaluationExplanation {
  const componentBreakdown = evaluation.components.map((comp) => ({
    dimension: comp.dimension,
    ruleCode: comp.ruleCode,
    points: comp.value,
    maxPoints: comp.maxValue,
    explanation: describeRuleCode(comp.ruleCode)
  }));

  let summary: string;
  if (evaluation.totalScore !== null) {
    summary = `Candidate scored ${evaluation.totalScore}/100 across ${evaluation.components.length} deterministic evidence dimensions under rule version ${evaluation.ruleVersion}.`;
  } else {
    summary = `Candidate evaluation yielded null score due to epistemic status '${evaluation.evaluationStatus}'.`;
  }

  return Object.freeze({
    evaluationId: evaluation.id,
    candidateId: evaluation.candidateId,
    sourceEntityId: evaluation.candidate.sourceEntityId,
    targetEntityId: evaluation.candidate.targetEntityId,
    status: evaluation.evaluationStatus,
    totalScore: evaluation.totalScore,
    ruleVersion: evaluation.ruleVersion,
    summary,
    componentBreakdown: Object.freeze(componentBreakdown),
    missingDimensions: evaluation.applicability.missingDimensions,
    mismatchedDimensions: evaluation.applicability.mismatchedDimensions
  });
}
