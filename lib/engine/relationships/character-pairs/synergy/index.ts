/**
 * Wuthering Waves Character Pair Synergy Module
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Public API for querying, evaluating, explaining, and auditing directional
 * CharacterPairSynergyProfiles.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './evaluator.ts';
export * from './repository.ts';
export * from './audit.ts';

import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyProfileExplanation
} from './types.ts';

/**
 * Generates a human-readable deterministic presentation explanation of a CharacterPairSynergyProfile.
 * Presentation only: this string output MUST NEVER become an engine input.
 */
export function explainCharacterPairSynergyProfile(
  profile: CharacterPairSynergyProfile
): CharacterPairSynergyProfileExplanation {
  const scoreStr =
    profile.synergyScore !== null
      ? `${profile.synergyScore}/100`
      : 'null';

  const catStr =
    profile.positiveEvidenceTypes.length > 0
      ? profile.positiveEvidenceTypes.join(', ')
      : 'None';

  const summary =
    `Character pair synergy ${profile.sourceResonatorId} -> ${profile.targetResonatorId} [Status: ${profile.synergyStatus}]: ` +
    `Supported categories: [${catStr}]. ` +
    `Components: ${profile.components.length}, ` +
    `Unique evidence: ${profile.evidenceIds.length}. ` +
    `Synergy evidence score: ${scoreStr}.`;

  return Object.freeze({
    profileId: profile.id,
    sourceResonatorId: profile.sourceResonatorId,
    targetResonatorId: profile.targetResonatorId,
    synergyStatus: profile.synergyStatus,
    synergyScore: profile.synergyScore,
    summary,
    supportedCategories: profile.positiveEvidenceTypes,
    explanationCodes: profile.explanationCodes
  });
}
