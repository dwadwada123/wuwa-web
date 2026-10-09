/**
 * Wuthering Waves Semantic Parameter Taxonomy & Value-State System
 * Phase 6C Step 1: Semantic Representation Foundation
 *
 * Provides controlled vocabulary and validation for numeric gameplay parameters.
 */

import type {
  SemanticParameter,
  SemanticUnit,
  SemanticValueState,
  ExtractionStatus,
  SemanticTarget,
  SemanticTrigger,
  SemanticEffect,
  SemanticValue,
  SemanticRefinementRank
} from '../domain/types/semantics.ts';
import type { Element } from '../domain/types/common.ts';

export const RECOGNIZED_SEMANTIC_PARAMETERS: readonly SemanticParameter[] = [
  'ATK_PERCENT',
  'HP_PERCENT',
  'DEF_PERCENT',
  'CRIT_RATE_PERCENT',
  'CRIT_DAMAGE_PERCENT',
  'ENERGY_REGEN_PERCENT',
  'HEALING_BONUS_PERCENT',
  'ATK_FLAT',
  'HP_FLAT',
  'DEF_FLAT',
  'GENERIC_DAMAGE_PERCENT',
  'BASIC_ATTACK_DAMAGE_PERCENT',
  'HEAVY_ATTACK_DAMAGE_PERCENT',
  'SKILL_DAMAGE_PERCENT',
  'LIBERATION_DAMAGE_PERCENT',
  'COORDINATED_ATTACK_DAMAGE_PERCENT',
  'ALL_ATTRIBUTE_DAMAGE_PERCENT',
  'GLACIO_DAMAGE_PERCENT',
  'FUSION_DAMAGE_PERCENT',
  'ELECTRO_DAMAGE_PERCENT',
  'AERO_DAMAGE_PERCENT',
  'SPECTRO_DAMAGE_PERCENT',
  'HAVOC_DAMAGE_PERCENT',
  'DEF_SHRED_PERCENT',
  'ALL_ELEMENT_RES_SHRED_PERCENT',
  'GLACIO_RES_SHRED_PERCENT',
  'FUSION_RES_SHRED_PERCENT',
  'ELECTRO_RES_SHRED_PERCENT',
  'AERO_RES_SHRED_PERCENT',
  'SPECTRO_RES_SHRED_PERCENT',
  'HAVOC_RES_SHRED_PERCENT',
  'RESONANCE_ENERGY',
  'CONCERTO_ENERGY',
  'FORTE_RESOURCE',
  'SKILL_COOLDOWN_REDUCTION_PERCENT',
  'SKILL_CHARGES',
  'UNRESOLVED_PARAMETER'
] as const;

export const RECOGNIZED_SEMANTIC_UNITS: readonly SemanticUnit[] = [
  'PERCENT',
  'FLAT',
  'SECONDS',
  'STACKS',
  'CHARGES',
  'RATIO'
] as const;

export const RECOGNIZED_VALUE_STATES: readonly SemanticValueState[] = [
  'KNOWN',
  'UNKNOWN',
  'UNMODELED',
  'NOT_APPLICABLE',
  'DERIVED',
  'PARSED'
] as const;

export const RECOGNIZED_EXTRACTION_STATUSES: readonly ExtractionStatus[] = [
  'COMPLETE',
  'PARTIAL',
  'UNRESOLVED',
  'UNSUPPORTED'
] as const;

export const RECOGNIZED_TARGETS: readonly SemanticTarget[] = [
  'SELF',
  'ACTIVE_CHARACTER',
  'NEXT_RESONATOR',
  'TEAM',
  'ENEMY'
] as const;

export const RECOGNIZED_TRIGGERS: readonly SemanticTrigger[] = [
  'ON_BASIC_ATTACK',
  'ON_HEAVY_ATTACK',
  'ON_RESONANCE_SKILL',
  'ON_RESONANCE_LIBERATION',
  'ON_INTRO_SKILL',
  'ON_OUTRO_SKILL',
  'ON_HIT',
  'ON_CRIT',
  'ON_FIELD',
  'ON_SWAP',
  'UNRESOLVED_TRIGGER'
] as const;

/**
 * Returns whether a given string is a valid controlled SemanticParameter.
 */
export function isSemanticParameter(param: string): param is SemanticParameter {
  return (RECOGNIZED_SEMANTIC_PARAMETERS as readonly string[]).includes(param);
}

/**
 * Maps an element name to its corresponding damage bonus parameter.
 */
export function getElementDamageParameter(element: string): SemanticParameter {
  const norm = element.trim().toUpperCase();
  switch (norm) {
    case 'GLACIO':
      return 'GLACIO_DAMAGE_PERCENT';
    case 'FUSION':
      return 'FUSION_DAMAGE_PERCENT';
    case 'ELECTRO':
      return 'ELECTRO_DAMAGE_PERCENT';
    case 'AERO':
      return 'AERO_DAMAGE_PERCENT';
    case 'SPECTRO':
      return 'SPECTRO_DAMAGE_PERCENT';
    case 'HAVOC':
      return 'HAVOC_DAMAGE_PERCENT';
    case 'ALL':
    case 'ALL-ATTRIBUTE':
      return 'ALL_ATTRIBUTE_DAMAGE_PERCENT';
    default:
      return 'UNRESOLVED_PARAMETER';
  }
}

/**
 * Maps an element name to its corresponding RES shred parameter.
 */
export function getElementResShredParameter(element: string): SemanticParameter {
  const norm = element.trim().toUpperCase();
  switch (norm) {
    case 'GLACIO':
      return 'GLACIO_RES_SHRED_PERCENT';
    case 'FUSION':
      return 'FUSION_RES_SHRED_PERCENT';
    case 'ELECTRO':
      return 'ELECTRO_RES_SHRED_PERCENT';
    case 'AERO':
      return 'AERO_RES_SHRED_PERCENT';
    case 'SPECTRO':
      return 'SPECTRO_RES_SHRED_PERCENT';
    case 'HAVOC':
      return 'HAVOC_RES_SHRED_PERCENT';
    case 'ALL':
    case 'ALL-ELEMENT':
      return 'ALL_ELEMENT_RES_SHRED_PERCENT';
    default:
      return 'UNRESOLVED_PARAMETER';
  }
}

/**
 * Deterministically serializes a SemanticValue preserving all discriminated union fields.
 * Guarantees that identical rank mappings with different object insertion orders
 * produce identical serialized outputs.
 */
export function serializeSemanticValue(value: SemanticValue): string {
  switch (value.type) {
    case 'EXACT':
      return `EXACT:${value.value}:${value.unit}`;
    case 'RANGE':
      return `RANGE:${value.min}:${value.max}:${value.unit}`;
    case 'MULTI_RANK': {
      const sortedRanks = (Object.keys(value.ranks) as SemanticRefinementRank[])
        .sort((a, b) => a.localeCompare(b));
      const serializedRanks = sortedRanks.map((r) => {
        const rankVal = value.ranks[r];
        if (!rankVal) return `${r}:EMPTY`;
        return `${r}:[${serializeSemanticValue(rankVal)}]`;
      });
      return `MULTI_RANK:${serializedRanks.join(',')}:${value.unit}`;
    }
    case 'UNRESOLVED':
      return `UNRESOLVED:${value.reason}${value.rawText ? `:${value.rawText}` : ''}`;
  }
}

/**
 * Canonical element extraction from explicit field or element-specific parameter.
 */
export function extractCanonicalElement(
  param: SemanticParameter,
  explicitElement?: Element | 'All'
): string {
  if (explicitElement) return explicitElement;

  if (param.startsWith('GLACIO_')) return 'Glacio';
  if (param.startsWith('FUSION_')) return 'Fusion';
  if (param.startsWith('ELECTRO_')) return 'Electro';
  if (param.startsWith('AERO_')) return 'Aero';
  if (param.startsWith('SPECTRO_')) return 'Spectro';
  if (param.startsWith('HAVOC_')) return 'Havoc';
  if (param === 'ALL_ATTRIBUTE_DAMAGE_PERCENT' || param === 'ALL_ELEMENT_RES_SHRED_PERCENT') return 'All';

  return 'NONE';
}

/**
 * Computes a deterministic semantic identity signature for a SemanticEffect.
 * Used for safe deduplication auditing without false-positive collapse of
 * legitimate distinct effects (e.g. effects sharing parameter & value but
 * having distinct elements, conditions, durations, targets, categories, or stack limits).
 */
export function computeSemanticSignature(eff: SemanticEffect): string {
  const elemStr = extractCanonicalElement(eff.parameter, eff.element);
  const valStr = serializeSemanticValue(eff.value);

  const condStr = eff.condition
    ? `${eff.condition.trigger || 'NO_TRIG'}_${eff.condition.rawCondition || 'NO_RAW'}_${eff.condition.stackCount ?? 'NO_STACK'}_zone:${Boolean(eff.condition.zoneActive)}_buff:${Boolean(eff.condition.buffActive)}`
    : 'NO_COND';

  const durStr = eff.duration
    ? `${eff.duration.durationSeconds}_swap:${Boolean(eff.duration.removeOnSwap)}`
    : 'NO_DUR';

  const stackStr = eff.stacking
    ? `max:${eff.stacking.maxStacks}_dur:${eff.stacking.durationPerStackSeconds ?? 'none'}`
    : 'NO_STACKING';

  return [
    eff.source.entityId,
    eff.source.sourceCode || 'NO_CODE',
    eff.category,
    eff.target,
    eff.parameter,
    elemStr,
    valStr,
    condStr,
    durStr,
    stackStr
  ].join('|');
}
