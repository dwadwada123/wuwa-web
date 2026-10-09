/**
 * Wuthering Waves Deterministic Investment-Aware Character Evaluation Contract
 * Phase 7 Step 16: Deterministic Investment-Aware Character Evaluation Contract
 *
 * Main barrel export for Step 16.
 */

export * from './types.ts';
export * from './rules.ts';
export {
  deriveCharacterEvaluationId,
  compareCharacterEvaluation,
  isCharacterEvaluated,
  isCharacterPartiallyEvaluated,
  isCharacterContextDependent,
  isCharacterInvestmentUnknown,
  isCharacterUnmodeled,
  hasCharacterEvaluationScore,
  matchesCharacterEvaluationFilter
} from './predicates.ts';
export * from './evaluator.ts';
export * from './repository.ts';
export * from './audit.ts';

import type { CharacterEvaluation } from './types.ts';

/**
 * Generates an objective, deterministic human-readable explanation of a character evaluation.
 * STRICTLY factual; ZERO gameplay praise or power statements.
 */
export function explainCharacterEvaluation(evaluation: CharacterEvaluation): string {
  const lines: string[] = [];
  lines.push(`Resonator: ${evaluation.resonatorId}`);
  lines.push(`Status: ${evaluation.status}`);
  lines.push(`Modeled Evidence Score: ${evaluation.evaluationScore !== null ? evaluation.evaluationScore.toFixed(2) : 'null'}`);
  lines.push(`Known Investment Dimensions: ${evaluation.investmentDimensionsKnown.length}/9`);
  lines.push(`Resolved Investment Effects: ${evaluation.resolvedInvestmentEffectIds.length}`);
  lines.push(`Synergy Profiles Referenced: ${evaluation.synergyProfileIds.length}`);

  if (evaluation.components.length > 0) {
    lines.push('Score Components:');
    for (const c of evaluation.components) {
      lines.push(`  - ${c.dimension}: ${c.value.toFixed(2)} / ${c.maxValue} (${c.ruleCode})`);
    }
  }

  return lines.join('\n');
}
