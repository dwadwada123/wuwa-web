/**
 * Wuthering Waves Character Interaction Aggregation & Profile Module
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 */

export * from './types.ts';
export * from './rules.ts';
export {
  deriveCharacterProfileId,
  compareCharacterInteractionProfiles,
  matchesCharacterInteractionProfileFilter
} from './predicates.ts';
export * from './aggregator.ts';
export * from './repository.ts';
export * from './audit.ts';

import type { CharacterInteractionProfile } from './types.ts';

/**
 * Produces an objective, factual explanation of a character interaction profile.
 */
export function explainCharacterInteractionProfile(profile: CharacterInteractionProfile): string {
  const s = profile.summary;
  return [
    `Character: ${profile.characterId}`,
    `Patch: ${profile.patchVersion}`,
    `Rule: ${profile.ruleVersion}`,
    `Outgoing Interactions: ${s.outgoingTotal} (Auth: ${s.outgoingAuthoritative}, Unk: ${s.outgoingUnknown}, Unm: ${s.outgoingUnmodeled}, Conf: ${s.outgoingConflicted}) across ${s.distinctOutgoingTargets} distinct targets`,
    `Incoming Interactions: ${s.incomingTotal} (Auth: ${s.incomingAuthoritative}, Unk: ${s.incomingUnknown}, Unm: ${s.incomingUnmodeled}, Conf: ${s.incomingConflicted}) across ${s.distinctIncomingSources} distinct sources`
  ].join(' | ');
}
