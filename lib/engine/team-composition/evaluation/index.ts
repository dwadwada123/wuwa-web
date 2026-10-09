/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluation Module
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Public entrypoint for Step 10 evaluation contracts, scoring rules,
 * evaluator engine, repository, and audit facilities.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './evaluator.ts';
export * from './repository.ts';
export * from './audit.ts';

import type {
  TeamCompositionCandidateEvaluation,
  TeamCompositionEvaluationExplanation
} from './types.ts';

/**
 * Produces a structured, machine-readable explanation for a team composition candidate evaluation.
 */
export function explainTeamCompositionEvaluation(
  evaluation: TeamCompositionCandidateEvaluation
): TeamCompositionEvaluationExplanation {
  const componentBreakdown: Record<string, number> = {};
  for (const comp of evaluation.components) {
    componentBreakdown[comp.dimension] = comp.value;
  }

  let summary: string;
  if (evaluation.totalScore !== null) {
    summary = `Team candidate evaluated with evidence strength score ${evaluation.totalScore.toFixed(2)}/100.00 across ${evaluation.matchedPairCount} matched pair(s) and ${evaluation.directionalEdgeCount} directional edge(s).`;
  } else {
    summary = `Team candidate evaluation blocked with status ${evaluation.evaluationStatus}. Total score: null.`;
  }

  return Object.freeze({
    evaluationId: evaluation.id,
    candidateId: evaluation.candidateId,
    evaluationStatus: evaluation.evaluationStatus,
    totalScore: evaluation.totalScore,
    summary,
    componentBreakdown: Object.freeze(componentBreakdown),
    explanationCodes: evaluation.explanationCodes
  });
}
