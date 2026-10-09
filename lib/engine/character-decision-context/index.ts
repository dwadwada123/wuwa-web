/**
 * Wuthering Waves Character Decision Context Contract
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Barrel export and factual explanation utilities.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './builder.ts';
export * from './repository.ts';
export * from './audit.ts';

import type { CharacterDecisionContext } from './types.ts';

/**
 * Generates an objective, factual explanation string for a CharacterDecisionContext.
 * Zero recommendation, zero ranking, zero gameplay power judgment.
 */
export function explainCharacterDecisionContext(context: CharacterDecisionContext): string {
  const scoreDisplay =
    context.summary.evaluationScore !== null
      ? context.summary.evaluationScore.toString()
      : 'N/A';

  const lines: string[] = [
    '=== CHARACTER DECISION CONTEXT ===',
    `Character: ${context.characterId}`,
    `Patch: ${context.patchVersion} | Rule Version: ${context.ruleVersion} | ID: ${context.id}`,
    `Evaluation Status: ${context.summary.evaluationStatus} | Evaluation Score: ${scoreDisplay}`,
    `Outgoing Interactions: ${context.summary.outgoingInteractionCount} (Authoritative: ${context.summary.authoritativeOutgoingCount}, Unknown: ${context.summary.unknownOutgoingCount}, Unmodeled: ${context.summary.unmodeledOutgoingCount}, Distinct Targets: ${context.summary.distinctOutgoingTargets})`,
    `Incoming Interactions: ${context.summary.incomingInteractionCount} (Authoritative: ${context.summary.authoritativeIncomingCount}, Unknown: ${context.summary.unknownIncomingCount}, Unmodeled: ${context.summary.unmodeledIncomingCount}, Distinct Sources: ${context.summary.distinctIncomingSources})`,
    `Provenance: ${context.provenance.source} (Evaluation: ${context.provenance.evaluationId}, Profile: ${context.provenance.profileId})`,
    '=================================='
  ];

  return lines.join('\n');
}
