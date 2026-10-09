/**
 * Wuthering Waves Gameplay Semantics Domain Model
 * Phase 6C Step 1: Semantic Representation Foundation
 *
 * Provides a strictly typed, deterministic semantic representation for
 * game effects, preventing silent false-zero or false-unconditional assumptions.
 */

import type { GameplayEffectCategory } from './gameplay-effects.ts';
import type { Element } from './common.ts';

/**
 * Distinguishes the epistemological status of a gameplay value.
 * Critical Invariant:
 *   UNKNOWN != ZERO
 *   UNMODELED != ZERO
 *   NOT_APPLICABLE != ZERO
 *   DERIVED != EXPLICIT
 *   PARSED != OFFICIAL
 */
export type SemanticValueState =
  | 'KNOWN' // Explicitly verified from authoritative source / datamine
  | 'UNKNOWN' // Observed in text/game but numeric magnitude is indeterminate
  | 'UNMODELED' // Complex mechanic not yet represented in numerical taxonomy
  | 'NOT_APPLICABLE' // Mechanic/scaling is intentionally not applicable
  | 'DERIVED' // Deterministically calculated from other explicit values
  | 'PARSED'; // Deterministically extracted from natural language prose

/**
 * Extraction status of a text fragment or complete ability/sequence node.
 */
export type ExtractionStatus =
  | 'COMPLETE' // All gameplay mechanics in text were successfully extracted
  | 'PARTIAL' // Some mechanics extracted, but unresolved fragments remain
  | 'UNRESOLVED' // Ambiguous modifiers present; cannot safely infer numeric value
  | 'UNSUPPORTED'; // Describes mechanics outside currently supported taxonomy

/**
 * Controlled taxonomy for numeric units.
 */
export type SemanticUnit =
  | 'PERCENT'
  | 'FLAT'
  | 'SECONDS'
  | 'STACKS'
  | 'CHARGES'
  | 'RATIO';

/**
 * Controlled taxonomy for numeric gameplay parameters supported in Patch 3.7.
 */
export type SemanticParameter =
  // Stat Buffs (Percentage)
  | 'ATK_PERCENT'
  | 'HP_PERCENT'
  | 'DEF_PERCENT'
  | 'CRIT_RATE_PERCENT'
  | 'CRIT_DAMAGE_PERCENT'
  | 'ENERGY_REGEN_PERCENT'
  | 'HEALING_BONUS_PERCENT'
  // Stat Buffs (Flat)
  | 'ATK_FLAT'
  | 'HP_FLAT'
  | 'DEF_FLAT'
  // Damage Category Bonuses & Amplifications
  | 'GENERIC_DAMAGE_PERCENT'
  | 'BASIC_ATTACK_DAMAGE_PERCENT'
  | 'HEAVY_ATTACK_DAMAGE_PERCENT'
  | 'SKILL_DAMAGE_PERCENT'
  | 'LIBERATION_DAMAGE_PERCENT'
  | 'COORDINATED_ATTACK_DAMAGE_PERCENT'
  // Attribute / Elemental Damage Buffs
  | 'ALL_ATTRIBUTE_DAMAGE_PERCENT'
  | 'GLACIO_DAMAGE_PERCENT'
  | 'FUSION_DAMAGE_PERCENT'
  | 'ELECTRO_DAMAGE_PERCENT'
  | 'AERO_DAMAGE_PERCENT'
  | 'SPECTRO_DAMAGE_PERCENT'
  | 'HAVOC_DAMAGE_PERCENT'
  // Resistance Shreds & DEF Reductions
  | 'DEF_SHRED_PERCENT'
  | 'ALL_ELEMENT_RES_SHRED_PERCENT'
  | 'GLACIO_RES_SHRED_PERCENT'
  | 'FUSION_RES_SHRED_PERCENT'
  | 'ELECTRO_RES_SHRED_PERCENT'
  | 'AERO_RES_SHRED_PERCENT'
  | 'SPECTRO_RES_SHRED_PERCENT'
  | 'HAVOC_RES_SHRED_PERCENT'
  // Energy & Resource Management
  | 'RESONANCE_ENERGY'
  | 'CONCERTO_ENERGY'
  | 'FORTE_RESOURCE'
  | 'SKILL_COOLDOWN_REDUCTION_PERCENT'
  | 'SKILL_CHARGES'
  // Fallback for unclassified parameters
  | 'UNRESOLVED_PARAMETER';

export interface SingleSemanticValue {
  type: 'EXACT';
  value: number;
  unit: SemanticUnit;
}

export interface RangeSemanticValue {
  type: 'RANGE';
  min: number;
  max: number;
  unit: SemanticUnit;
}

export type SemanticRefinementRank = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface MultiRankSemanticValue {
  type: 'MULTI_RANK';
  ranks: Partial<Record<SemanticRefinementRank, SingleSemanticValue | RangeSemanticValue>>;
  unit: SemanticUnit;
}

export interface UnresolvedSemanticValue {
  type: 'UNRESOLVED';
  rawText?: string;
  reason: string;
}

export type SemanticValue =
  | SingleSemanticValue
  | RangeSemanticValue
  | MultiRankSemanticValue
  | UnresolvedSemanticValue;

/**
 * Valid gameplay effect targets.
 */
export type SemanticTarget =
  | 'SELF'
  | 'ACTIVE_CHARACTER'
  | 'NEXT_RESONATOR'
  | 'TEAM'
  | 'ENEMY';

/**
 * Observed conditional triggers in Patch 3.7.
 */
export type SemanticTrigger =
  | 'ON_BASIC_ATTACK'
  | 'ON_HEAVY_ATTACK'
  | 'ON_RESONANCE_SKILL'
  | 'ON_RESONANCE_LIBERATION'
  | 'ON_INTRO_SKILL'
  | 'ON_OUTRO_SKILL'
  | 'ON_HIT'
  | 'ON_CRIT'
  | 'ON_FIELD'
  | 'ON_SWAP'
  | 'UNRESOLVED_TRIGGER';

export interface SemanticCondition {
  trigger?: SemanticTrigger;
  zoneActive?: boolean;
  buffActive?: boolean;
  stackCount?: number;
  stackOperator?: 'EXACT' | 'AT_LEAST' | 'PER_STACK';
  rawCondition?: string;
}

export interface SemanticDuration {
  durationSeconds: number;
  removeOnSwap?: boolean;
}

export interface SemanticStacking {
  maxStacks: number;
  durationPerStackSeconds?: number;
}

export type SemanticSourceType =
  | 'RESONATOR_ABILITY'
  | 'RESONATOR_SEQUENCE'
  | 'WEAPON_PASSIVE'
  | 'WEAPON_REFINEMENT'
  | 'ECHO_SKILL'
  | 'SONATA_EFFECT'
  | 'TOA_AREA_EFFECT';

export interface SourceReference {
  entityId: string;
  entityName: string;
  sourceType: SemanticSourceType;
  sourceCode?: string; // e.g. 'S1', 'OutroSkill', 'Passive'
  patchVersion: string; // strictly '3.7'
  sourceProvenance: string;
  originalDescription: string;
}

export interface ExtractionProvenance {
  parserVersion: string;
  method: 'DETERMINISTIC_RULE_PARSER';
  extractionDate: string;
}

export interface SemanticEffect {
  id: string; // Deterministic RFC-like or scoped identifier
  source: SourceReference;
  category: GameplayEffectCategory;
  target: SemanticTarget;
  parameter: SemanticParameter;
  element?: Element | 'All';
  value: SemanticValue;
  valueState: SemanticValueState;
  condition?: SemanticCondition;
  duration?: SemanticDuration;
  stacking?: SemanticStacking;
  extraction: ExtractionProvenance;
}

export interface ExtractionResult {
  status: ExtractionStatus;
  effects: SemanticEffect[];
  unresolvedFragments: string[];
  originalText: string;
  parserVersion: string;
  sourceReference?: SourceReference;
}

export interface ExtractionContext {
  entityId?: string;
  entityName?: string;
  sourceType?: SemanticSourceType;
  sourceCode?: string;
  patchVersion?: string;
  sourceProvenance?: string;
  defaultTarget?: SemanticTarget;
}
