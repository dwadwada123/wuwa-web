/**
 * Wuthering Waves Character Build Evaluation Contract Barrel Export
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Re-exports public types, rules, predicates, builders, repository APIs,
 * auditors, and presentation utilities for Step 20.
 */

export * from './types.ts';
export {
  CHARACTER_BUILD_EVALUATION_RULE_VERSION,
  REQUIRED_STEP19_RULE_VERSION,
  REQUIRED_STEP13_RULE_VERSION,
  CANONICAL_WEAPON_COUNT,
  CANONICAL_SONATA_COUNT,
  TRACKED_BUILD_ASPECTS_COUNT,
  ALL_BUILD_ASPECTS,
  CANONICAL_RESONATOR_METADATA,
  CANONICAL_WEAPON_METADATA,
  CANONICAL_SONATA_METADATA,
  getCanonicalSonataMetadata,
  BUILD_EVALUATION_EXPLANATION_CODES,
  EMPTY_BUILD_EVALUATION_PROVENANCE,
  PROHIBITED_BUILD_EVALUATION_KEYS,
  type CanonicalResonatorMetadata,
  type CanonicalWeaponMetadata,
  type CanonicalSonataMetadata,
  type ProhibitedBuildEvaluationKey
} from './rules.ts';
export * from './predicates.ts';
export * from './builder.ts';
export * from './repository.ts';
export {
  assertNoProhibitedBuildEvaluationKeys,
  auditSingleCharacterBuildEvaluation,
  auditCharacterBuildEvaluations,
  runProductionCharacterBuildEvaluationAudit
} from './audit.ts';

import type { CharacterBuildEvaluation } from './types.ts';

/**
 * Formats a factual, human-readable presentation explanation for a
 * CharacterBuildEvaluation record.
 * Never introduces subjective judgments, power scores, or tier ratings.
 */
export function formatCharacterBuildExplanation(evaluation: CharacterBuildEvaluation): string {
  const lines: string[] = [
    `Character: ${evaluation.resonatorId} (${evaluation.rarity}★ ${evaluation.element} ${evaluation.weaponType})`,
    `Build Status: ${evaluation.status}`,
    `Completeness: ${evaluation.completeness.completenessRatio !== null ? (evaluation.completeness.completenessRatio * 100).toFixed(1) + '%' : 'UNKNOWN'} (${evaluation.completeness.knownAspects}/${evaluation.completeness.totalAspects} aspects known)`
  ];

  const w = evaluation.weaponEvaluation;
  if (w.isEquipped) {
    const lvlStr = w.weaponLevel !== null ? `Lv.${w.weaponLevel}` : 'Lv.?';
    const refStr = w.refinementRank !== null ? `R${w.refinementRank}` : 'R?';
    lines.push(
      `Weapon: ${w.weaponId} (${lvlStr}, ${refStr}) — Compatibility: ${w.compatibility}`
    );
  } else {
    lines.push(`Weapon: Not Equipped (${w.compatibility})`);
  }

  const e = evaluation.echoEvaluation;
  if (e.hasLoadout) {
    const eqStr = e.equippedCount !== null ? `${e.equippedCount}/5 equipped` : 'Equipped: ?';
    const tuStr = e.tunedCount !== null ? `${e.tunedCount}/5 tuned` : 'Tuned: ?';
    const sonataStr = e.activeSonataSetName
      ? `${e.activeSonataSetName} (${e.sonataAlignment})`
      : 'No Sonata Set';
    lines.push(`Echo Loadout: ${eqStr}, ${tuStr} — Sonata: ${sonataStr}`);
  } else {
    lines.push(`Echo Loadout: Not Equipped (${e.sonataAlignment})`);
  }

  return lines.join('\n');
}
