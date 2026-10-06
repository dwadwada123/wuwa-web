/**
 * Patch Isolation Rules
 *
 * Ensures deterministic evaluation under an explicit patch snapshot.
 * Prevents accidental cross-patch contamination (e.g., Patch 3.6 vs Patch 3.7).
 */

import type { PatchContext, ToAStage, ToACycle, RuleResult } from '../../domain/types/index.ts';

export const RULE_STAGE_PATCH_MATCH = 'RULE_STAGE_PATCH_MATCH';
export const RULE_CYCLE_PATCH_MATCH = 'RULE_CYCLE_PATCH_MATCH';

/**
 * Validates that a ToA stage belongs to the active evaluation patch.
 */
export function validateStagePatch(
  stage: ToAStage,
  context: { patchContext: PatchContext }
): RuleResult {
  const isMatch = stage.patchId === context.patchContext.patchId;

  return {
    ruleId: RULE_STAGE_PATCH_MATCH,
    passed: isMatch,
    severity: 'HARD',
    reason: isMatch
      ? `Stage patch (${stage.patchId}) matches execution context (${context.patchContext.patchId}).`
      : `Stage patch mismatch: stage belongs to ${stage.patchId}, but execution context is ${context.patchContext.patchId}.`,
    evidence: [
      `stage.patchId = ${stage.patchId}`,
      `context.patchId = ${context.patchContext.patchId}`,
    ],
  };
}

/**
 * Validates that a ToA cycle belongs to the active evaluation patch.
 */
export function validateCyclePatch(
  cycle: ToACycle,
  context: { patchContext: PatchContext }
): RuleResult {
  const isMatch = cycle.patchId === context.patchContext.patchId;

  return {
    ruleId: RULE_CYCLE_PATCH_MATCH,
    passed: isMatch,
    severity: 'HARD',
    reason: isMatch
      ? `Cycle patch (${cycle.patchId}) matches execution context (${context.patchContext.patchId}).`
      : `Cycle patch mismatch: cycle belongs to ${cycle.patchId}, but execution context is ${context.patchContext.patchId}.`,
    evidence: [
      `cycle.patchId = ${cycle.patchId}`,
      `context.patchId = ${context.patchContext.patchId}`,
    ],
  };
}
