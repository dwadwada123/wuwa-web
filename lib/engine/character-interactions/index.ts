/**
 * Wuthering Waves Character Relationship & Interaction Module
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 */

export * from './types.ts';
export * from './rules.ts';
export {
  deriveConditionKey,
  deriveCharacterInteractionId,
  isInteractionAuthoritative,
  isInteractionUnknown,
  isInteractionUnmodeled,
  isInteractionNotApplicable,
  isInteractionConflicted,
  compareCharacterInteractionEvidence,
  matchesCharacterInteractionFilter
} from './predicates.ts';
export * from './composer.ts';
export * from './repository.ts';
export * from './audit.ts';

import type { CharacterInteractionEvidence } from './types.ts';
import { deriveConditionKey } from './predicates.ts';

/**
 * Produces an objective, factual explanation of a composed character interaction.
 */
export function explainCharacterInteraction(item: CharacterInteractionEvidence): string {
  const condStr = deriveConditionKey(item.condition);
  const valStr = item.effectValue !== null ? ` (magnitude: ${item.effectValue}${item.unit || ''})` : '';

  return [
    `Interaction: ${item.sourceCharacterId} -> ${item.targetCharacterId}`,
    `Type: ${item.interactionType} [${item.category}]`,
    `Status: ${item.evidenceStatus}`,
    `Condition: ${condStr}${valStr}`,
    `Relationships Proving: ${item.relationshipIds.length}`,
    `Evidences Supporting: ${item.evidenceIds.length}`,
    `Reason Codes: ${item.reasonCodes.join(', ')}`
  ].join(' | ');
}
