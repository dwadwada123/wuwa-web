/**
 * Wuthering Waves Gameplay Capability Predicates & Classifiers
 * Phase 7 Step 1: Deterministic Gameplay Capability Contract
 *
 * Provides pure, deterministic functions to classify capabilities,
 * perform multi-dimensional filtering, and sort canonically.
 *
 * CENTRAL INVARIANT:
 * These predicates classify capabilities.
 * They DO NOT score, rank, weight, or compare meta value.
 */

import type {
  GameplayCapability,
  GameplayCapabilityCategory,
  GameplayCapabilityKind,
  GameplayActionType,
  CapabilityFilter,
  NormalizedEngineFact,
  SemanticTarget,
  Element,
  CapabilityContextRequirement,
  CapabilityContextRequirementDimension,
  CapabilityRequiredContext,
  RuntimeEvaluationContext
} from './types.ts';
import {
  isElementSpecificFact,
  getRequiredElement,
  isAllElementFact
} from '../facts/context/evaluator.ts';

/**
 * Result structure for capability context requirement analysis.
 */
export interface CapabilityRequirementsResult {
  readonly primary: CapabilityContextRequirement;
  readonly dimensions: readonly CapabilityContextRequirementDimension[];
  readonly requiredContext?: CapabilityRequiredContext;
}

/**
 * Deterministically analyzes a NormalizedEngineFact to derive its runtime context requirements.
 * Reuses approved Phase 6C Step 5 evaluator rules.
 */
export function determineContextRequirements(
  fact: NormalizedEngineFact
): CapabilityRequirementsResult {
  if (
    fact.consumptionState === 'UNMODELED' ||
    fact.semanticStatus === 'UNMODELED' ||
    fact.parameterSafety === 'CURRENTLY_UNMODELED' ||
    fact.value.type === 'UNRESOLVED'
  ) {
    return {
      primary: 'UNMODELED',
      dimensions: Object.freeze(['UNMODELED']),
      requiredContext: undefined
    };
  }

  const dims: CapabilityContextRequirementDimension[] = [];
  const req: Record<string, any> = {};

  // 1. Element Requirement
  if (isElementSpecificFact(fact)) {
    dims.push('ELEMENT');
    const reqElem =
      getRequiredElement(fact) ||
      (fact.element !== 'NONE' && fact.element !== 'All' ? (fact.element as Element) : undefined);
    if (reqElem) {
      req.element = reqElem;
    }
  }

  // 2. Action Requirement
  if (fact.parameterSafety === 'REQUIRES_CONTEXT') {
    dims.push('ACTION');
    switch (fact.parameter) {
      case 'BASIC_ATTACK_DAMAGE_PERCENT':
        req.actionType = 'BASIC_ATTACK';
        break;
      case 'HEAVY_ATTACK_DAMAGE_PERCENT':
        req.actionType = 'HEAVY_ATTACK';
        break;
      case 'SKILL_DAMAGE_PERCENT':
      case 'SKILL_CHARGES':
      case 'SKILL_COOLDOWN_REDUCTION_PERCENT':
        req.actionType = 'RESONANCE_SKILL';
        break;
      case 'LIBERATION_DAMAGE_PERCENT':
        req.actionType = 'RESONANCE_LIBERATION';
        break;
      case 'GENERIC_DAMAGE_PERCENT':
        req.actionType = 'ANY_ACTION';
        break;
      default:
        req.actionType = 'SPECIFIED_ACTION';
        break;
    }
  }

  // 3. Trigger Requirement
  if (fact.condition?.trigger) {
    dims.push('TRIGGER');
    req.trigger = fact.condition.trigger;
  }

  // 4. Zone Requirement
  if (fact.condition?.zoneActive !== undefined) {
    dims.push('ZONE_STATE');
    req.zoneActive = fact.condition.zoneActive;
  }

  // 5. Buff Requirement
  if (fact.condition?.buffActive !== undefined) {
    dims.push('BUFF_STATE');
    req.buffActive = fact.condition.buffActive;
  }

  // 6. Stack Requirement
  if (
    fact.condition?.stackCount !== undefined ||
    fact.condition?.stackOperator !== undefined ||
    (fact.condition?.rawCondition && fact.condition.rawCondition.toLowerCase().includes('stack'))
  ) {
    dims.push('STACK_COUNT');
    if (fact.condition?.stackCount !== undefined) req.stackCount = fact.condition.stackCount;
    if (fact.condition?.stackOperator !== undefined) req.stackOperator = fact.condition.stackOperator;
  }

  // 7. Refinement Rank Requirement (MULTI_RANK weapon values)
  if (fact.value.type === 'MULTI_RANK' && !fact.refinementRank) {
    dims.push('REFINEMENT_RANK');
    req.refinementRank = true;
  }

  // Active character identity requirement for SELF targets
  if (fact.target === 'SELF') {
    req.activeCharacterId = fact.entityId;
  }

  let primary: CapabilityContextRequirement;
  if (dims.length === 0) {
    primary = 'NONE';
  } else if (dims.length === 1) {
    primary = dims[0] as CapabilityContextRequirement;
  } else {
    primary = 'COMPOSITE';
  }

  return {
    primary,
    dimensions: Object.freeze(dims),
    requiredContext:
      dims.length > 0 || req.activeCharacterId
        ? Object.freeze(req as CapabilityRequiredContext)
        : undefined
  };
}

/**
 * Deterministically derives the capability kind from a validated NormalizedEngineFact.
 */
export function determineCapabilityKind(fact: NormalizedEngineFact): GameplayCapabilityKind {
  const p = fact.parameter;
  const t = fact.target;
  const c = fact.category;

  // Stat buffs (stat-level amplifications)
  if (p === 'ATK_PERCENT' || p === 'ATK_FLAT') return 'ATK_AMPLIFICATION';
  if (p === 'HP_PERCENT' || p === 'HP_FLAT') return 'HP_AMPLIFICATION';
  if (p === 'DEF_PERCENT' || p === 'DEF_FLAT') return 'DEF_AMPLIFICATION';
  if (p === 'CRIT_RATE_PERCENT') return 'CRIT_RATE_AMPLIFICATION';
  if (p === 'CRIT_DAMAGE_PERCENT') return 'CRIT_DAMAGE_AMPLIFICATION';
  if (p === 'ENERGY_REGEN_PERCENT' || p === 'RESONANCE_ENERGY' || p === 'CONCERTO_ENERGY') {
    return 'ENERGY_REGENERATION';
  }
  if (p === 'HEALING_BONUS_PERCENT') return 'HEALING_BONUS';
  if (p === 'SKILL_COOLDOWN_REDUCTION_PERCENT' || p === 'SKILL_CHARGES') {
    return 'COOLDOWN_REDUCTION';
  }
  if (p === 'DEF_SHRED_PERCENT') return 'DEFENSE_SHRED';
  if (p === 'ALL_ELEMENT_RES_SHRED_PERCENT' || p.endsWith('_RES_SHRED_PERCENT')) {
    return 'RESISTANCE_SHRED';
  }
  if (p === 'ALL_ATTRIBUTE_DAMAGE_PERCENT') return 'ALL_ATTRIBUTE_DAMAGE_AMPLIFICATION';

  // Elemental damage bonuses (Fusion, Glacio, etc.)
  if (
    p.endsWith('_DAMAGE_PERCENT') &&
    ![
      'GENERIC_DAMAGE_PERCENT',
      'BASIC_ATTACK_DAMAGE_PERCENT',
      'HEAVY_ATTACK_DAMAGE_PERCENT',
      'SKILL_DAMAGE_PERCENT',
      'LIBERATION_DAMAGE_PERCENT',
      'COORDINATED_ATTACK_DAMAGE_PERCENT',
      'ALL_ATTRIBUTE_DAMAGE_PERCENT'
    ].includes(p)
  ) {
    return 'ELEMENTAL_DAMAGE_AMPLIFICATION';
  }

  // Attack-specific damage contributions vs support amplifications
  if (p === 'BASIC_ATTACK_DAMAGE_PERCENT') {
    return t === 'SELF' ? 'BASIC_ATTACK_DAMAGE' : 'BASIC_ATTACK_DAMAGE_AMPLIFICATION';
  }
  if (p === 'HEAVY_ATTACK_DAMAGE_PERCENT') {
    return t === 'SELF' ? 'HEAVY_ATTACK_DAMAGE' : 'HEAVY_ATTACK_DAMAGE_AMPLIFICATION';
  }
  if (p === 'SKILL_DAMAGE_PERCENT') {
    return t === 'SELF' ? 'RESONANCE_SKILL_DAMAGE' : 'SKILL_DAMAGE_AMPLIFICATION';
  }
  if (p === 'LIBERATION_DAMAGE_PERCENT') {
    return t === 'SELF' ? 'RESONANCE_LIBERATION_DAMAGE' : 'LIBERATION_DAMAGE_AMPLIFICATION';
  }
  if (p === 'GENERIC_DAMAGE_PERCENT') {
    return t === 'SELF' ? 'GENERIC_DAMAGE' : 'GENERIC_DAMAGE_AMPLIFICATION';
  }
  if (p === 'COORDINATED_ATTACK_DAMAGE_PERCENT') {
    return t === 'SELF' ? 'COORDINATED_ATTACK_DAMAGE' : 'COORDINATED_ATTACK_AMPLIFICATION';
  }

  // Categorical mechanisms
  if (c === 'HEALING') return 'HEALING_PROVISION';
  if (c === 'SHIELD') return 'SHIELD_PROVISION';
  if (p === 'FORTE_RESOURCE') return 'FORTE_RESOURCE_MANAGEMENT';

  return 'SPECIAL_MECHANIC';
}

/**
 * Deterministically derives the high-level capability category from kind and context.
 */
export function determineCapabilityCategory(
  kind: GameplayCapabilityKind,
  target: SemanticTarget,
  element: Element | 'All' | 'NONE'
): GameplayCapabilityCategory {
  switch (kind) {
    case 'BASIC_ATTACK_DAMAGE':
    case 'HEAVY_ATTACK_DAMAGE':
    case 'RESONANCE_SKILL_DAMAGE':
    case 'RESONANCE_LIBERATION_DAMAGE':
    case 'GENERIC_DAMAGE':
    case 'COORDINATED_ATTACK_DAMAGE':
      return 'DAMAGE';

    case 'ATK_AMPLIFICATION':
    case 'CRIT_RATE_AMPLIFICATION':
    case 'CRIT_DAMAGE_AMPLIFICATION':
    case 'ALL_ATTRIBUTE_DAMAGE_AMPLIFICATION':
    case 'SKILL_DAMAGE_AMPLIFICATION':
    case 'BASIC_ATTACK_DAMAGE_AMPLIFICATION':
    case 'HEAVY_ATTACK_DAMAGE_AMPLIFICATION':
    case 'LIBERATION_DAMAGE_AMPLIFICATION':
    case 'COORDINATED_ATTACK_AMPLIFICATION':
    case 'DEFENSE_SHRED':
    case 'GENERIC_DAMAGE_AMPLIFICATION':
      return 'OFFENSIVE_SUPPORT';

    case 'ELEMENTAL_DAMAGE_AMPLIFICATION':
    case 'RESISTANCE_SHRED':
      return element !== 'NONE' ? 'ELEMENTAL_INTERACTION' : 'OFFENSIVE_SUPPORT';

    case 'HP_AMPLIFICATION':
    case 'DEF_AMPLIFICATION':
    case 'HEALING_BONUS':
    case 'HEALING_PROVISION':
    case 'SHIELD_PROVISION':
      return 'DEFENSIVE_SURVIVABILITY';

    case 'ENERGY_REGENERATION':
    case 'COOLDOWN_REDUCTION':
    case 'FORTE_RESOURCE_MANAGEMENT':
      return 'RESOURCE_COMBAT';

    case 'SPECIAL_MECHANIC':
    default:
      return 'SPECIAL_MECHANIC';
  }
}

/**
 * Derives explicit gameplay action type from sourceCode, parameter, or trigger.
 * Fails closed to undefined when action cannot be proven.
 */
export function determineActionType(fact: NormalizedEngineFact): GameplayActionType | undefined {
  const src = fact.sourceCode.toUpperCase();
  const param = fact.parameter;
  const trigger = fact.condition?.trigger;

  // 1. Check Outro
  if (src === 'OUTRO_SKILL' || src.includes('OUTRO') || trigger === 'ON_OUTRO_SKILL') {
    return 'OUTRO';
  }

  // 2. Check Intro
  if (src === 'INTRO_SKILL' || src.includes('INTRO') || trigger === 'ON_INTRO_SKILL') {
    return 'INTRO';
  }

  // 3. Check Coordinated Attack
  if (param === 'COORDINATED_ATTACK_DAMAGE_PERCENT') {
    return 'COORDINATED';
  }

  // 4. Check Basic Attack
  if (
    param === 'BASIC_ATTACK_DAMAGE_PERCENT' ||
    src === 'BASIC_ATTACK' ||
    src === 'NORMAL_ATTACK' ||
    trigger === 'ON_BASIC_ATTACK'
  ) {
    return 'BASIC';
  }

  // 5. Check Heavy Attack
  if (param === 'HEAVY_ATTACK_DAMAGE_PERCENT' || src === 'HEAVY_ATTACK' || trigger === 'ON_HEAVY_ATTACK') {
    return 'HEAVY';
  }

  // 6. Check Resonance Skill
  if (
    param === 'SKILL_DAMAGE_PERCENT' ||
    src === 'RESONANCE_SKILL' ||
    src === 'SKILL' ||
    trigger === 'ON_RESONANCE_SKILL'
  ) {
    return 'SKILL';
  }

  // 7. Check Resonance Liberation
  if (
    param === 'LIBERATION_DAMAGE_PERCENT' ||
    src === 'RESONANCE_LIBERATION' ||
    src === 'LIBERATION' ||
    trigger === 'ON_RESONANCE_LIBERATION'
  ) {
    return 'LIBERATION';
  }

  return undefined;
}

/**
 * Derives a stable, deterministic capability identity string.
 */
export function deriveCapabilityId(
  entityId: string,
  sourceCode: string,
  kind: GameplayCapabilityKind,
  target: SemanticTarget,
  element: Element | 'All' | 'NONE',
  factId: string
): string {
  return `cap:${entityId}:${sourceCode}:${kind}:${target}:${element}:${factId}`;
}

// ============================================================================
// PURE CAPABILITY PREDICATES (CLASSIFIERS, NOT SCORERS)
// ============================================================================

/**
 * Evaluates whether a capability contributes to direct damage output.
 */
export function isDamageCapability(cap: GameplayCapability): boolean {
  return (
    cap.category === 'DAMAGE' ||
    cap.kind === 'BASIC_ATTACK_DAMAGE' ||
    cap.kind === 'HEAVY_ATTACK_DAMAGE' ||
    cap.kind === 'RESONANCE_SKILL_DAMAGE' ||
    cap.kind === 'RESONANCE_LIBERATION_DAMAGE' ||
    cap.kind === 'GENERIC_DAMAGE' ||
    cap.kind === 'COORDINATED_ATTACK_DAMAGE'
  );
}

/**
 * Evaluates whether a capability provides offensive buffs, damage amplification, or defense/res shred.
 */
export function isOffensiveSupportCapability(cap: GameplayCapability): boolean {
  return (
    cap.category === 'OFFENSIVE_SUPPORT' ||
    cap.kind === 'ATK_AMPLIFICATION' ||
    cap.kind === 'CRIT_RATE_AMPLIFICATION' ||
    cap.kind === 'CRIT_DAMAGE_AMPLIFICATION' ||
    cap.kind === 'ALL_ATTRIBUTE_DAMAGE_AMPLIFICATION' ||
    cap.kind === 'ELEMENTAL_DAMAGE_AMPLIFICATION' ||
    cap.kind === 'SKILL_DAMAGE_AMPLIFICATION' ||
    cap.kind === 'BASIC_ATTACK_DAMAGE_AMPLIFICATION' ||
    cap.kind === 'HEAVY_ATTACK_DAMAGE_AMPLIFICATION' ||
    cap.kind === 'LIBERATION_DAMAGE_AMPLIFICATION' ||
    cap.kind === 'COORDINATED_ATTACK_AMPLIFICATION' ||
    cap.kind === 'DEFENSE_SHRED' ||
    cap.kind === 'RESISTANCE_SHRED' ||
    cap.kind === 'GENERIC_DAMAGE_AMPLIFICATION'
  );
}

/**
 * Evaluates whether a capability provides defensive survivability (HP, DEF, healing, shields).
 */
export function isDefensiveCapability(cap: GameplayCapability): boolean {
  return (
    cap.category === 'DEFENSIVE_SURVIVABILITY' ||
    cap.kind === 'HP_AMPLIFICATION' ||
    cap.kind === 'DEF_AMPLIFICATION' ||
    cap.kind === 'HEALING_BONUS' ||
    cap.kind === 'HEALING_PROVISION' ||
    cap.kind === 'SHIELD_PROVISION'
  );
}

/**
 * Evaluates whether a capability provides resource, energy, or cooldown benefits.
 */
export function isResourceCapability(cap: GameplayCapability): boolean {
  return (
    cap.category === 'RESOURCE_COMBAT' ||
    cap.kind === 'ENERGY_REGENERATION' ||
    cap.kind === 'COOLDOWN_REDUCTION' ||
    cap.kind === 'FORTE_RESOURCE_MANAGEMENT'
  );
}

/**
 * Evaluates whether a capability is element-specific or elemental interaction.
 */
export function isElementalCapability(cap: GameplayCapability): boolean {
  return (
    cap.element !== 'NONE' ||
    cap.category === 'ELEMENTAL_INTERACTION' ||
    cap.kind === 'ELEMENTAL_DAMAGE_AMPLIFICATION'
  );
}

/**
 * Evaluates whether a capability targets teammates, the next resonator, active character, or outro/intro.
 */
export function isTeamInteractionCapability(cap: GameplayCapability): boolean {
  return (
    cap.target === 'TEAM' ||
    cap.target === 'NEXT_RESONATOR' ||
    cap.target === 'ACTIVE_CHARACTER' ||
    cap.actionType === 'OUTRO' ||
    cap.actionType === 'INTRO' ||
    cap.conditions?.trigger === 'ON_OUTRO_SKILL' ||
    cap.conditions?.trigger === 'ON_INTRO_SKILL'
  );
}

/**
 * Evaluates whether a capability is tied to an Outro skill.
 */
export function isOutroCapability(cap: GameplayCapability): boolean {
  return (
    cap.actionType === 'OUTRO' ||
    cap.sourceCode === 'OUTRO_SKILL' ||
    cap.conditions?.trigger === 'ON_OUTRO_SKILL'
  );
}

/**
 * Evaluates whether a capability is tied to an Intro skill.
 */
export function isIntroCapability(cap: GameplayCapability): boolean {
  return (
    cap.actionType === 'INTRO' ||
    cap.sourceCode === 'INTRO_SKILL' ||
    cap.conditions?.trigger === 'ON_INTRO_SKILL'
  );
}

/**
 * Evaluates whether a capability's origin fact is CONSUMABLE_STATIC.
 * NOTE: A static fact with an element requirement still requires runtime element context before calculation!
 */
export function isStaticCapability(cap: GameplayCapability): boolean {
  return cap.isStatic;
}

/**
 * Evaluates whether a capability's origin fact is CONSUMABLE_CONTEXTUAL.
 */
export function isContextualCapability(cap: GameplayCapability): boolean {
  return cap.isContextual;
}

/**
 * Evaluates whether a capability is completely context-free and immediately consumable
 * without supplying any runtime evaluation context.
 *
 * Rules:
 * - Must have known finite numeric value
 * - Must NOT be UNMODELED, UNKNOWN, or NOT_APPLICABLE
 * - Must NOT require ELEMENT (e.g. Fusion +20% returns false)
 * - Must NOT require ACTION, TRIGGER, ZONE, BUFF, STACK, or REFINEMENT
 * - element = NONE and element = All (without conditions) return true
 */
export function isContextFreeCapability(cap: GameplayCapability): boolean {
  if (cap.status === 'UNMODELED' || cap.status === 'UNKNOWN' || cap.status === 'NOT_APPLICABLE') {
    return false;
  }
  if (!cap.isNumericValueKnown || cap.numericValue === null) {
    return false;
  }
  return cap.contextRequirement === 'NONE' && !cap.requiresRuntimeContext;
}

/**
 * Pure, deterministic evaluation of whether a capability is immediately consumable
 * under the provided runtime evaluation context (or context-free if context is omitted).
 *
 * Fails closed if required context dimensions are missing or mismatched.
 * Never produces numeric values from unmodeled mechanics.
 */
export function isImmediatelyConsumableCapability(
  cap: GameplayCapability,
  context?: RuntimeEvaluationContext
): boolean {
  if (cap.status === 'UNMODELED' || cap.status === 'UNKNOWN' || cap.status === 'NOT_APPLICABLE') {
    return false;
  }
  if (!cap.isNumericValueKnown || cap.numericValue === null) {
    return false;
  }

  // If no runtime context is supplied, only context-free capabilities are consumable
  if (!context) {
    return isContextFreeCapability(cap);
  }

  // Target character check for SELF effects
  if (cap.target === 'SELF' && context.activeCharacterId && context.activeCharacterId !== cap.entityId) {
    return false;
  }

  // 1. Element Requirement
  if (cap.requiresElement) {
    if (!context.element) return false;
    const requiredElem =
      cap.requiredContext?.element ??
      (cap.element !== 'NONE' && cap.element !== 'All' ? cap.element : undefined);
    if (context.element !== requiredElem) return false;
  } else if (cap.element === 'All' && context.element) {
    const VALID_ELEMENTS = new Set(['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'All']);
    if (!VALID_ELEMENTS.has(context.element)) return false;
  }

  // 2. Action Requirement
  if (cap.requiresAction) {
    if (!context.actionType) return false;
    const reqAction = cap.requiredContext?.actionType;
    if (reqAction && reqAction !== 'ANY_ACTION' && context.actionType !== reqAction) {
      return false;
    }
  }

  // 3. Trigger Requirement
  if (cap.requiresTrigger) {
    if (!context.trigger) return false;
    if (cap.requiredContext?.trigger && context.trigger !== cap.requiredContext.trigger) {
      return false;
    }
  }

  // 4. Zone State Requirement
  if (cap.requiresZone) {
    if (context.zoneActive === undefined) return false;
    if (
      cap.requiredContext?.zoneActive !== undefined &&
      context.zoneActive !== cap.requiredContext.zoneActive
    ) {
      return false;
    }
  }

  // 5. Buff State Requirement
  if (cap.requiresBuff) {
    if (context.buffActive === undefined) return false;
    if (
      cap.requiredContext?.buffActive !== undefined &&
      context.buffActive !== cap.requiredContext.buffActive
    ) {
      return false;
    }
  }

  // 6. Stack Count Requirement
  if (cap.requiresStack) {
    if (context.stackCount === undefined) return false;
    if (cap.requiredContext?.stackCount !== undefined) {
      const op = cap.requiredContext.stackOperator;
      if (op === 'AT_LEAST' && context.stackCount < cap.requiredContext.stackCount) return false;
      if (op === 'EXACT' && context.stackCount !== cap.requiredContext.stackCount) return false;
    }
  }

  // 7. Refinement Rank Requirement
  if (cap.requiresRefinement) {
    if (!context.refinementRank) return false;
  }

  return true;
}

/**
 * Evaluates whether a capability is unmodeled in the numeric engine.
 */
export function isUnmodeledCapability(cap: GameplayCapability): boolean {
  return cap.status === 'UNMODELED';
}

/**
 * Evaluates whether a capability is fully modeled statically.
 */
export function isModeledCapability(cap: GameplayCapability): boolean {
  return cap.status === 'MODELED';
}

// ============================================================================
// FILTERING & CANONICAL SORTING
// ============================================================================

/**
 * Evaluates whether a capability satisfies the given filter criteria.
 * Strict AND logic across all specified fields.
 */
export function matchesCapabilityFilter(
  cap: GameplayCapability,
  filter?: CapabilityFilter
): boolean {
  if (!filter) return true;

  const matchField = <T>(val: T, filterVal: T | readonly T[] | undefined): boolean => {
    if (filterVal === undefined) return true;
    if (Array.isArray(filterVal)) return (filterVal as readonly T[]).includes(val);
    return val === filterVal;
  };

  if (!matchField(cap.entityId, filter.entityId)) return false;
  if (!matchField(cap.sourceCode, filter.sourceCode)) return false;
  if (!matchField(cap.kind, filter.kind)) return false;
  if (!matchField(cap.category, filter.category)) return false;
  if (!matchField(cap.parameter, filter.parameter)) return false;
  if (!matchField(cap.target, filter.target)) return false;
  if (!matchField(cap.element, filter.element)) return false;
  if (!matchField(cap.actionType, filter.actionType)) return false;
  if (!matchField(cap.status, filter.status)) return false;
  if (!matchField(cap.contextRequirement, filter.contextRequirement)) return false;
  if (filter.isStatic !== undefined && cap.isStatic !== filter.isStatic) return false;
  if (filter.isContextual !== undefined && cap.isContextual !== filter.isContextual) return false;
  if (filter.requiresRuntimeContext !== undefined && cap.requiresRuntimeContext !== filter.requiresRuntimeContext) return false;
  if (filter.isContextFree !== undefined && cap.isContextFree !== filter.isContextFree) return false;
  if (filter.isNumericValueKnown !== undefined && cap.isNumericValueKnown !== filter.isNumericValueKnown) return false;
  if (filter.requiresElement !== undefined && cap.requiresElement !== filter.requiresElement) return false;
  if (filter.requiresAction !== undefined && cap.requiresAction !== filter.requiresAction) return false;
  if (filter.requiresTrigger !== undefined && cap.requiresTrigger !== filter.requiresTrigger) return false;
  if (filter.patchVersion !== undefined && cap.patchVersion !== filter.patchVersion) return false;

  return true;
}

/**
 * Deterministic comparison function enforcing canonical ordering:
 * 1. entityId
 * 2. sourceCode
 * 3. kind
 * 4. parameter
 * 5. target
 * 6. element
 * 7. capabilityId
 */
export function compareCapabilities(a: GameplayCapability, b: GameplayCapability): number {
  const entityCmp = a.entityId.localeCompare(b.entityId);
  if (entityCmp !== 0) return entityCmp;

  const sourceCmp = a.sourceCode.localeCompare(b.sourceCode);
  if (sourceCmp !== 0) return sourceCmp;

  const kindCmp = a.kind.localeCompare(b.kind);
  if (kindCmp !== 0) return kindCmp;

  const paramCmp = a.parameter.localeCompare(b.parameter);
  if (paramCmp !== 0) return paramCmp;

  const targetCmp = a.target.localeCompare(b.target);
  if (targetCmp !== 0) return targetCmp;

  const elemCmp = a.element.localeCompare(b.element);
  if (elemCmp !== 0) return elemCmp;

  return a.capabilityId.localeCompare(b.capabilityId);
}

/**
 * Returns a new frozen array sorted by canonical capability ordering.
 */
export function sortCapabilities(
  caps: readonly GameplayCapability[]
): readonly GameplayCapability[] {
  return Object.freeze([...caps].sort(compareCapabilities));
}
