/**
 * Wuthering Waves Deterministic Resonator Investment Normalizer
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Implements deterministic validation and normalization of user investment inputs into
 * immutable ResonatorInvestmentSnapshot records and factual completeness summaries.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. UNKNOWN ≠ 0: Missing or unknown values are never converted to 0, S0, R1, or level 1.
 * 2. Fail closed on invalid IDs or numeric boundaries.
 * 3. Strict Patch 3.7 isolation.
 * 4. Zero numeric coercion or default fallbacks.
 */

import {
  RESONATOR_INVESTMENT_RULE_VERSION,
  EMPTY_INVESTMENT_PROVENANCE
} from './rules.ts';
import {
  deriveResonatorInvestmentId,
  knownValue,
  unknownValue,
  isValidCharacterLevel,
  isValidWeaponLevel,
  isValidRefinementRank,
  isValidSequenceLevel,
  isValidEchoCount,
  isCanonicalResonatorId,
  isCanonicalWeaponId,
  isCanonicalSonataId
} from './predicates.ts';
import type {
  InvestmentValue,
  InvestmentValueStatus,
  InvestmentDimensionKey,
  InvestmentCompletenessSummary,
  WeaponInvestmentSnapshot,
  EchoInvestmentSnapshot,
  ResonatorInvestmentSnapshot,
  ResonatorInvestmentInput,
  NormalizedResonatorInvestment
} from './types.ts';

/**
 * Computes the objective data completeness summary for an investment snapshot.
 * Factual data completeness metric only; NEVER a gameplay or power score.
 */
export function computeInvestmentCompleteness(
  snapshot: ResonatorInvestmentSnapshot
): InvestmentCompletenessSummary {
  const details: Record<InvestmentDimensionKey, InvestmentValueStatus> = {
    CHARACTER_LEVEL: snapshot.characterLevel.status,
    WEAPON_IDENTITY: snapshot.weapon !== null ? 'KNOWN' : 'UNKNOWN',
    WEAPON_LEVEL: snapshot.weapon !== null ? snapshot.weapon.weaponLevel.status : 'UNKNOWN',
    WEAPON_REFINEMENT: snapshot.weapon !== null ? snapshot.weapon.refinementRank.status : 'UNKNOWN',
    SEQUENCE_LEVEL: snapshot.sequenceLevel.status,
    ECHO_EQUIPPED_COUNT: snapshot.echoInvestment !== null ? snapshot.echoInvestment.equippedCount.status : 'UNKNOWN',
    ECHO_TUNED_COUNT: snapshot.echoInvestment !== null ? snapshot.echoInvestment.tunedCount.status : 'UNKNOWN',
    ECHO_MAX_LEVEL_COUNT: snapshot.echoInvestment !== null ? snapshot.echoInvestment.maxLevelEchoCount.status : 'UNKNOWN',
    ECHO_SONATA_SET: snapshot.echoInvestment !== null && snapshot.echoInvestment.sonataSetId !== null ? 'KNOWN' : 'UNKNOWN'
  };

  const totalDimensions = 9;
  let knownDimensions = 0;

  for (const key of Object.keys(details) as InvestmentDimensionKey[]) {
    if (details[key] === 'KNOWN') {
      knownDimensions++;
    }
  }

  const unknownDimensions = totalDimensions - knownDimensions;
  const ratio = Math.round((knownDimensions / totalDimensions) * 10000) / 10000;

  return Object.freeze({
    totalDimensions,
    knownDimensions,
    unknownDimensions,
    completenessRatio: ratio,
    dimensionDetails: Object.freeze(details)
  });
}

function normalizeRawValue<T>(
  raw: unknown,
  validator: (val: unknown) => val is T,
  errorMsg: string,
  errors: string[]
): InvestmentValue<T> {
  if (raw === undefined || raw === null) {
    return unknownValue('UNKNOWN');
  }

  if (typeof raw === 'object' && raw !== null && 'status' in raw) {
    const inv = raw as InvestmentValue<T>;
    if (inv.status === 'KNOWN') {
      if (validator(inv.value)) {
        return knownValue(inv.value);
      }
      errors.push(`${errorMsg}: ${String(inv.value)}`);
      return unknownValue('INVALID');
    }
    return unknownValue(inv.status);
  }

  if (validator(raw)) {
    return knownValue(raw);
  }

  errors.push(`${errorMsg}: ${String(raw)}`);
  return unknownValue('INVALID');
}

/**
 * Validates and normalizes user Resonator investment input into an immutable ResonatorInvestmentSnapshot.
 */
export function normalizeResonatorInvestment(
  input: ResonatorInvestmentInput,
  options?: { ruleVersion?: '7.13.1' }
): NormalizedResonatorInvestment {
  const errors: string[] = [];
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? RESONATOR_INVESTMENT_RULE_VERSION;
  const provenance = input?.provenance ?? EMPTY_INVESTMENT_PROVENANCE;

  // 1. Strict object check
  if (!input || typeof input !== 'object') {
    const fallbackId = deriveResonatorInvestmentId(patchVersion, 'UNKNOWN', ruleVersion);
    const fallbackSnapshot: ResonatorInvestmentSnapshot = Object.freeze({
      id: fallbackId,
      patchVersion,
      ruleVersion,
      resonatorId: 'UNKNOWN',
      characterLevel: unknownValue<number>('INVALID'),
      weapon: null,
      sequenceLevel: unknownValue<number>('INVALID'),
      echoInvestment: null,
      provenance
    });
    return Object.freeze({
      snapshot: fallbackSnapshot,
      isValid: false,
      validationErrors: Object.freeze(['Invalid investment input: expected an object.']),
      completeness: computeInvestmentCompleteness(fallbackSnapshot)
    });
  }

  // 2. Strict patch validation
  if (input.patchVersion !== '3.7') {
    errors.push(`Patch mismatch: Expected '3.7', got '${String(input.patchVersion)}'.`);
  }

  // 3. Resonator ID validation
  const resonatorId = typeof input.resonatorId === 'string' ? input.resonatorId.trim() : '';
  if (!resonatorId) {
    errors.push('Resonator ID must be a non-empty string.');
  } else if (!isCanonicalResonatorId(resonatorId)) {
    errors.push(`Invalid or unrecognized Resonator ID: '${resonatorId}'.`);
  }

  const id = deriveResonatorInvestmentId(
    patchVersion,
    resonatorId || 'UNKNOWN_RESONATOR',
    ruleVersion
  );

  // 4. Character level validation
  const characterLevel = normalizeRawValue<number>(
    input.characterLevel,
    isValidCharacterLevel,
    'Invalid character level. Must be integer in [1, 90]',
    errors
  );

  // 5. Weapon validation
  let weaponSnapshot: WeaponInvestmentSnapshot | null = null;
  if (input.weapon !== undefined && input.weapon !== null) {
    if (typeof input.weapon !== 'object') {
      errors.push('Invalid weapon investment: expected an object.');
    } else {
      const weaponId = typeof input.weapon.weaponId === 'string' ? input.weapon.weaponId.trim() : '';
      if (!weaponId) {
        errors.push('Weapon ID must be a non-empty string.');
      } else if (!isCanonicalWeaponId(weaponId)) {
        errors.push(`Invalid or unrecognized weapon ID: '${weaponId}'.`);
      }

      const weaponLevel = normalizeRawValue<number>(
        input.weapon.weaponLevel,
        isValidWeaponLevel,
        'Invalid weapon level. Must be integer in [1, 90]',
        errors
      );

      const refinementRank = normalizeRawValue<number>(
        input.weapon.refinementRank,
        isValidRefinementRank,
        'Invalid refinement rank. Must be integer in [1, 5]',
        errors
      );

      weaponSnapshot = Object.freeze({
        weaponId: weaponId || 'UNKNOWN_WEAPON',
        weaponLevel,
        refinementRank,
        compatibilityStatus: input.weapon.compatibilityStatus ?? 'UNKNOWN',
        provenance: input.weapon.provenance ?? provenance
      });
    }
  }

  // 6. Sequence level validation
  const sequenceLevel = normalizeRawValue<number>(
    input.sequenceLevel,
    isValidSequenceLevel,
    'Invalid sequence level. Must be integer in [0, 6]',
    errors
  );

  // 7. Echo investment validation
  let echoSnapshot: EchoInvestmentSnapshot | null = null;
  if (input.echoInvestment !== undefined && input.echoInvestment !== null) {
    if (typeof input.echoInvestment !== 'object') {
      errors.push('Invalid echo investment: expected an object.');
    } else {
      const equippedCount = normalizeRawValue<number>(
        input.echoInvestment.equippedCount,
        isValidEchoCount,
        'Invalid equipped echo count. Must be integer in [0, 5]',
        errors
      );

      const tunedCount = normalizeRawValue<number>(
        input.echoInvestment.tunedCount,
        isValidEchoCount,
        'Invalid tuned echo count. Must be integer in [0, 5]',
        errors
      );

      const maxLevelEchoCount = normalizeRawValue<number>(
        input.echoInvestment.maxLevelEchoCount,
        isValidEchoCount,
        'Invalid max-level echo count. Must be integer in [0, 5]',
        errors
      );

      let sonataSetId: string | null = null;
      if (input.echoInvestment.sonataSetId !== undefined && input.echoInvestment.sonataSetId !== null) {
        if (typeof input.echoInvestment.sonataSetId !== 'string') {
          errors.push('Sonata set ID must be a string or null.');
        } else {
          const trimmedSonata = input.echoInvestment.sonataSetId.trim();
          if (!isCanonicalSonataId(trimmedSonata)) {
            errors.push(`Invalid or unrecognized Sonata set ID: '${trimmedSonata}'.`);
          } else {
            sonataSetId = trimmedSonata;
          }
        }
      }

      echoSnapshot = Object.freeze({
        equippedCount,
        tunedCount,
        maxLevelEchoCount,
        sonataSetId,
        provenance: input.echoInvestment.provenance ?? provenance
      });
    }
  }

  const snapshot: ResonatorInvestmentSnapshot = Object.freeze({
    id,
    patchVersion,
    ruleVersion,
    resonatorId: resonatorId || 'UNKNOWN_RESONATOR',
    characterLevel,
    weapon: weaponSnapshot,
    sequenceLevel,
    echoInvestment: echoSnapshot,
    provenance
  });

  const completeness = computeInvestmentCompleteness(snapshot);

  return Object.freeze({
    snapshot,
    isValid: errors.length === 0,
    validationErrors: Object.freeze(errors),
    completeness
  });
}
