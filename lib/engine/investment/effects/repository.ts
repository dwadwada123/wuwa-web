/**
 * Wuthering Waves Deterministic Investment Effect Repository
 * Phase 7 Step 15: Deterministic Investment Effect Resolution & Combat Contribution Contract
 *
 * Implements deterministic query, lookup, filtering, and summary APIs
 * over investment effect resolutions.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FACT REPOSITORY ONLY: Zero gameplay scores, zero rankings, zero DPS.
 * 2. DETERMINISTIC ORDERING: All collections are returned in canonical deterministic order.
 * 3. IMMUTABILITY: All returned objects and arrays are frozen.
 */

import type {
  InvestmentEffectResolution,
  InvestmentEffectResolutionSummary,
  InvestmentEffectFilter,
  InvestmentDimensionKey,
  ResonatorInvestmentSnapshot
} from './types.ts';
import {
  resolveInvestmentEffect,
  resolveAllInvestmentEffects
} from './resolver.ts';
import {
  matchesInvestmentEffectFilter,
  isInvestmentEffectResolved,
  isInvestmentEffectUnknown,
  isInvestmentEffectUnmodeled
} from './predicates.ts';
import { createDefaultStep15Provenance } from './rules.ts';

/**
 * Retrieves a single evaluated investment effect resolution.
 */
export function getInvestmentEffect(
  resonatorId: string,
  effectId: string,
  investment: ResonatorInvestmentSnapshot
): InvestmentEffectResolution {
  return resolveInvestmentEffect(resonatorId, effectId, investment);
}

/**
 * Retrieves all evaluated investment effect resolutions for a Resonator,
 * with optional filtering.
 */
export function getAllInvestmentEffects(
  resonatorId: string,
  investment: ResonatorInvestmentSnapshot,
  filter?: InvestmentEffectFilter
): readonly InvestmentEffectResolution[] {
  const all = resolveAllInvestmentEffects(resonatorId, investment);
  if (!filter) return all;
  return Object.freeze(all.filter((rec) => matchesInvestmentEffectFilter(rec, filter)));
}

/**
 * Retrieves only strictly RESOLVED investment effects for a Resonator.
 */
export function getResolvedInvestmentEffects(
  resonatorId: string,
  investment: ResonatorInvestmentSnapshot
): readonly InvestmentEffectResolution[] {
  const all = resolveAllInvestmentEffects(resonatorId, investment);
  return Object.freeze(all.filter(isInvestmentEffectResolved));
}

/**
 * Retrieves only UNKNOWN investment effects (blocked by missing user input) for a Resonator.
 */
export function getUnknownInvestmentEffects(
  resonatorId: string,
  investment: ResonatorInvestmentSnapshot
): readonly InvestmentEffectResolution[] {
  const all = resolveAllInvestmentEffects(resonatorId, investment);
  return Object.freeze(all.filter(isInvestmentEffectUnknown));
}

/**
 * Retrieves only UNMODELED investment effects (blocked by missing canonical formula/curves) for a Resonator.
 */
export function getUnmodeledInvestmentEffects(
  resonatorId: string,
  investment: ResonatorInvestmentSnapshot
): readonly InvestmentEffectResolution[] {
  const all = resolveAllInvestmentEffects(resonatorId, investment);
  return Object.freeze(all.filter(isInvestmentEffectUnmodeled));
}

/**
 * Returns the declared investment dimension dependencies for a canonical effect ID.
 */
export function getInvestmentEffectDependencies(
  effectId: string
): readonly InvestmentDimensionKey[] {
  if (effectId.startsWith('char-')) {
    return Object.freeze(['CHARACTER_LEVEL']);
  }
  if (effectId === 'weapon-base-atk' || effectId === 'weapon-sub-stat' || effectId === 'weapon-level-scaling') {
    return Object.freeze(['WEAPON_IDENTITY', 'WEAPON_LEVEL']);
  }
  if (effectId === 'weapon-refinement' || effectId.startsWith('weapon-refinement:')) {
    return Object.freeze(['WEAPON_IDENTITY', 'WEAPON_REFINEMENT']);
  }
  if (effectId.startsWith('sequence-node:')) {
    return Object.freeze(['SEQUENCE_LEVEL']);
  }
  if (effectId === 'sonata-2pc' || effectId === 'sonata-5pc') {
    return Object.freeze(['ECHO_SONATA_SET', 'ECHO_EQUIPPED_COUNT']);
  }
  if (effectId === 'echo-stat-scaling') {
    return Object.freeze(['ECHO_EQUIPPED_COUNT', 'ECHO_TUNED_COUNT', 'ECHO_MAX_LEVEL_COUNT']);
  }
  return Object.freeze([]);
}

/**
 * Computes an objective resolution summary across all investment effects for a Resonator.
 * Pure accounting summary; NEVER a gameplay score!
 */
export function getInvestmentResolutionSummary(
  resonatorId: string,
  investment: ResonatorInvestmentSnapshot
): InvestmentEffectResolutionSummary {
  const all = resolveAllInvestmentEffects(resonatorId, investment);

  let resolvedCount = 0;
  let unknownCount = 0;
  let unmodeledCount = 0;
  let notApplicableCount = 0;
  let invalidCount = 0;

  const resolvedEffectIds: string[] = [];
  const unknownEffectIds: string[] = [];
  const unmodeledEffectIds: string[] = [];

  for (const eff of all) {
    if (eff.status === 'RESOLVED') {
      resolvedCount++;
      resolvedEffectIds.push(eff.effectId);
    } else if (eff.status === 'UNKNOWN') {
      unknownCount++;
      unknownEffectIds.push(eff.effectId);
    } else if (eff.status === 'UNMODELED') {
      unmodeledCount++;
      unmodeledEffectIds.push(eff.effectId);
    } else if (eff.status === 'NOT_APPLICABLE') {
      notApplicableCount++;
    } else if (eff.status === 'INVALID' || eff.status === 'PATCH_MISMATCH') {
      invalidCount++;
    }
  }

  return Object.freeze({
    resonatorId,
    totalEffects: all.length,
    resolvedCount,
    unknownCount,
    unmodeledCount,
    notApplicableCount,
    invalidCount,
    resolvedEffectIds: Object.freeze(resolvedEffectIds),
    unknownEffectIds: Object.freeze(unknownEffectIds),
    unmodeledEffectIds: Object.freeze(unmodeledEffectIds),
    provenance: createDefaultStep15Provenance(resonatorId, 'SUMMARY')
  });
}
