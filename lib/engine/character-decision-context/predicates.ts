/**
 * Wuthering Waves Character Decision Context Predicates & Comparators
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Implements deterministic ID derivation, filter matching, and canonical ordering.
 */

import { CHARACTER_DECISION_CONTEXT_RULE_VERSION } from './rules.ts';
import type {
  CharacterDecisionContext,
  CharacterDecisionContextFilter
} from './types.ts';

/**
 * Derives a deterministic canonical identifier for a character decision context.
 * Format: char-context:<patch>:<characterId>:<ruleVersion>
 */
export function deriveCharacterDecisionContextId(
  characterId: string,
  patchVersion: string = '3.7',
  ruleVersion: string = CHARACTER_DECISION_CONTEXT_RULE_VERSION
): string {
  return `char-context:${patchVersion}:${characterId}:${ruleVersion}`;
}

/**
 * Deterministic total ordering comparator for CharacterDecisionContext records.
 * Order:
 * 1. patchVersion ASC
 * 2. characterId ASC
 * 3. id ASC
 */
export function compareCharacterDecisionContexts(
  a: CharacterDecisionContext,
  b: CharacterDecisionContext
): number {
  if (String(a.patchVersion) !== String(b.patchVersion)) {
    return String(a.patchVersion).localeCompare(String(b.patchVersion));
  }
  if (a.characterId !== b.characterId) {
    return a.characterId.localeCompare(b.characterId);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Evaluates whether a CharacterDecisionContext satisfies a filter.
 */
export function matchesCharacterDecisionContextFilter(
  context: CharacterDecisionContext,
  filter?: CharacterDecisionContextFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion && context.patchVersion !== filter.patchVersion) return false;
  if (filter.characterId && context.characterId !== filter.characterId) return false;

  if (filter.hasEvaluation !== undefined) {
    if (context.summary.hasEvaluation !== filter.hasEvaluation) return false;
  }

  if (filter.evaluationStatus && context.summary.evaluationStatus !== filter.evaluationStatus) {
    return false;
  }

  if (filter.hasOutgoing !== undefined) {
    const hasOut = context.summary.outgoingInteractionCount > 0;
    if (hasOut !== filter.hasOutgoing) return false;
  }

  if (filter.hasIncoming !== undefined) {
    const hasIn = context.summary.incomingInteractionCount > 0;
    if (hasIn !== filter.hasIncoming) return false;
  }

  if (filter.minOutgoing !== undefined) {
    if (context.summary.outgoingInteractionCount < filter.minOutgoing) return false;
  }

  if (filter.minIncoming !== undefined) {
    if (context.summary.incomingInteractionCount < filter.minIncoming) return false;
  }

  if (filter.hasAuthoritativeOutgoing !== undefined) {
    const hasAuthOut = context.summary.authoritativeOutgoingCount > 0;
    if (hasAuthOut !== filter.hasAuthoritativeOutgoing) return false;
  }

  if (filter.hasAuthoritativeIncoming !== undefined) {
    const hasAuthIn = context.summary.authoritativeIncomingCount > 0;
    if (hasAuthIn !== filter.hasAuthoritativeIncoming) return false;
  }

  return true;
}
