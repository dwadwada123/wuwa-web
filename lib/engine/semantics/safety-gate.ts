/**
 * Wuthering Waves Semantic-to-Engine Safety Gate
 * Phase 6C Step 3: Semantic Integration Contract & Safety Gate
 *
 * Enforces deterministic conversion of semantic effects into engine-facing facts.
 * Invariant:
 *   EXPLICITLY REPRESENTED SEMANTICS MAY BE USED.
 *   UNRESOLVED / UNMODELED / UNKNOWN SEMANTICS MUST NEVER SILENTLY BECOME ZERO.
 */

import type {
  SemanticEffect,
  SemanticParameter,
  SemanticUnit,
  SingleSemanticValue,
  RangeSemanticValue,
  MultiRankSemanticValue,
  SemanticRefinementRank,
  SemanticCondition,
  ExtractionResult
} from '../../domain/types/semantics.ts';
import type { Element } from '../../domain/types/common.ts';
import { extractCanonicalElement } from '../../semantics/taxonomy.ts';
import type {
  EngineSemanticSafetyStatus,
  ParameterSafetyClassification,
  EngineSemanticFact,
  RuntimeEvaluationContext,
  ProductionEngineIntegrationMetrics
} from './types.ts';
import { runProductionSemanticsAudit } from '../../../scripts/production-semantics-audit.ts';

/**
 * Classifies parameter safety for combat calculations.
 */
export function classifyParameterSafety(param: SemanticParameter): ParameterSafetyClassification {
  switch (param) {
    // Direct context-independent engine facts
    case 'ATK_PERCENT':
    case 'HP_PERCENT':
    case 'DEF_PERCENT':
    case 'CRIT_RATE_PERCENT':
    case 'CRIT_DAMAGE_PERCENT':
    case 'ENERGY_REGEN_PERCENT':
    case 'HEALING_BONUS_PERCENT':
    case 'ATK_FLAT':
    case 'HP_FLAT':
    case 'DEF_FLAT':
    case 'ALL_ATTRIBUTE_DAMAGE_PERCENT':
    case 'GLACIO_DAMAGE_PERCENT':
    case 'FUSION_DAMAGE_PERCENT':
    case 'ELECTRO_DAMAGE_PERCENT':
    case 'AERO_DAMAGE_PERCENT':
    case 'SPECTRO_DAMAGE_PERCENT':
    case 'HAVOC_DAMAGE_PERCENT':
    case 'DEF_SHRED_PERCENT':
    case 'ALL_ELEMENT_RES_SHRED_PERCENT':
    case 'GLACIO_RES_SHRED_PERCENT':
    case 'FUSION_RES_SHRED_PERCENT':
    case 'ELECTRO_RES_SHRED_PERCENT':
    case 'AERO_RES_SHRED_PERCENT':
    case 'SPECTRO_RES_SHRED_PERCENT':
    case 'HAVOC_RES_SHRED_PERCENT':
      return 'DIRECT_ENGINE_FACT';

    // Valid combat mechanics that require action/rotation context
    case 'BASIC_ATTACK_DAMAGE_PERCENT':
    case 'HEAVY_ATTACK_DAMAGE_PERCENT':
    case 'SKILL_DAMAGE_PERCENT':
    case 'LIBERATION_DAMAGE_PERCENT':
    case 'GENERIC_DAMAGE_PERCENT':
    case 'SKILL_CHARGES':
    case 'SKILL_COOLDOWN_REDUCTION_PERCENT':
    case 'RESONANCE_ENERGY':
    case 'CONCERTO_ENERGY':
      return 'REQUIRES_CONTEXT';

    // Mechanics requiring complex runtime state machines
    case 'FORTE_RESOURCE':
    case 'COORDINATED_ATTACK_DAMAGE_PERCENT':
      return 'CURRENTLY_UNMODELED';

    // Fallbacks
    case 'UNRESOLVED_PARAMETER':
    default:
      return 'NOT_ENGINE_CONSUMABLE';
  }
}

/**
 * Maps existing SemanticEffect value-state and attributes to engine safety status.
 */
export function classifySemanticEffectSafety(effect: SemanticEffect): EngineSemanticSafetyStatus {
  // 1. Patch isolation hard gate
  if (effect.source.patchVersion !== '3.7') {
    return 'NOT_APPLICABLE';
  }

  // 2. Non-combat utility or explicit not applicable
  if (effect.valueState === 'NOT_APPLICABLE') {
    return 'NOT_APPLICABLE';
  }

  // 3. Explicit unknown status
  if (effect.valueState === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  // 4. Explicit unmodeled status
  if (effect.valueState === 'UNMODELED') {
    return 'UNMODELED';
  }

  // 5. Check discriminated value type
  if (effect.value.type === 'UNRESOLVED') {
    const reasonLower = effect.value.reason.toLowerCase();
    if (
      reasonLower.includes('unmodeled') ||
      reasonLower.includes('state') ||
      reasonLower.includes('stack') ||
      reasonLower.includes('gauge')
    ) {
      return 'UNMODELED';
    }
    return 'UNKNOWN';
  }

  // 6. Check parameter safety classification
  const paramSafety = classifyParameterSafety(effect.parameter);
  if (paramSafety === 'CURRENTLY_UNMODELED') {
    return 'UNMODELED';
  }

  if (paramSafety === 'NOT_ENGINE_CONSUMABLE') {
    return 'NOT_APPLICABLE';
  }

  // 7. Safe states
  if (effect.valueState === 'DERIVED') {
    return 'SAFE_DERIVED';
  }

  if (effect.valueState === 'PARSED' || effect.valueState === 'KNOWN') {
    return 'SAFE_EXPLICIT';
  }

  return 'UNKNOWN';
}

/**
 * Converts a SemanticEffect into an immutable EngineSemanticFact.
 */
export function convertSemanticEffectToFact(effect: SemanticEffect): EngineSemanticFact {
  // Validate patch isolation
  if (effect.source.patchVersion !== '3.7') {
    return {
      status: 'NOT_APPLICABLE',
      effect,
      entityId: effect.source.entityId,
      sourceCode: effect.source.sourceCode || 'root',
      patchVersion: effect.source.patchVersion,
      reason: `Patch isolation rejection: effect patch '${effect.source.patchVersion}' is incompatible with engine Patch 3.7 context`,
      provenance: effect.source
    };
  }

  const safety = classifySemanticEffectSafety(effect);
  const paramSafety = classifyParameterSafety(effect.parameter);
  const element = effect.element ?? (extractCanonicalElement(effect.parameter) as Element | 'All' | 'NONE');

  switch (safety) {
    case 'SAFE_EXPLICIT':
      if (effect.value.type === 'UNRESOLVED') {
        return {
          status: 'UNMODELED',
          effect,
          entityId: effect.source.entityId,
          sourceCode: effect.source.sourceCode || 'root',
          patchVersion: effect.source.patchVersion,
          parameter: effect.parameter,
          reason: effect.value.reason,
          provenance: effect.source
        };
      }
      return {
        status: 'SAFE_EXPLICIT',
        effect,
        entityId: effect.source.entityId,
        sourceCode: effect.source.sourceCode || 'root',
        patchVersion: effect.source.patchVersion,
        category: effect.category,
        target: effect.target,
        parameter: effect.parameter,
        element,
        value: effect.value,
        condition: effect.condition,
        duration: effect.duration,
        stacking: effect.stacking,
        parameterSafety: paramSafety,
        provenance: effect.source
      };

    case 'SAFE_DERIVED':
      return {
        status: 'SAFE_DERIVED',
        effect,
        entityId: effect.source.entityId,
        sourceCode: effect.source.sourceCode || 'root',
        patchVersion: effect.source.patchVersion,
        category: effect.category,
        target: effect.target,
        parameter: effect.parameter,
        element,
        value: effect.value as SingleSemanticValue | RangeSemanticValue | MultiRankSemanticValue,
        derivationFormula: (effect as any).derivationFormula || 'Deterministic domain fact derivation',
        condition: effect.condition,
        duration: effect.duration,
        stacking: effect.stacking,
        parameterSafety: paramSafety,
        provenance: effect.source
      };

    case 'UNKNOWN':
      return {
        status: 'UNKNOWN',
        effect,
        entityId: effect.source.entityId,
        sourceCode: effect.source.sourceCode || 'root',
        patchVersion: effect.source.patchVersion,
        parameter: effect.parameter,
        parameterSafety: paramSafety,
        reason: effect.value.type === 'UNRESOLVED' ? effect.value.reason : 'Magnitude or trigger condition is indeterminate',
        provenance: effect.source
      };

    case 'UNMODELED':
      return {
        status: 'UNMODELED',
        effect,
        entityId: effect.source.entityId,
        sourceCode: effect.source.sourceCode || 'root',
        patchVersion: effect.source.patchVersion,
        parameter: effect.parameter,
        parameterSafety: paramSafety,
        reason:
          paramSafety === 'CURRENTLY_UNMODELED'
            ? `Parameter '${effect.parameter}' requires an unmodeled combat state machine or gauge meter`
            : effect.value.type === 'UNRESOLVED'
            ? effect.value.reason
            : 'Mechanic is unmodeled in current numerical engine',
        provenance: effect.source
      };

    case 'NOT_APPLICABLE':
      return {
        status: 'NOT_APPLICABLE',
        effect,
        entityId: effect.source.entityId,
        sourceCode: effect.source.sourceCode || 'root',
        patchVersion: effect.source.patchVersion,
        parameter: effect.parameter,
        parameterSafety: paramSafety,
        reason: 'Effect does not apply to combat engine calculations (non-combat utility or flavor)',
        provenance: effect.source
      };
  }
}

/**
 * Converts a complete ExtractionResult into engine-facing facts, preserving both
 * structured effects and unmodeled/unsupported fragments without silent loss.
 */
export function convertExtractionResultToFacts(result: ExtractionResult): EngineSemanticFact[] {
  const facts: EngineSemanticFact[] = [];

  // 1. Structured effects
  for (const eff of result.effects) {
    facts.push(convertSemanticEffectToFact(eff));
  }

  // 2. Unresolved fragments
  for (const frag of result.unresolvedFragments) {
    const isNonCombat = /\b(?:cook(?:ing|ed)?|dish(?:es)?|craft(?:ing)?|synthesiz(?:e|ing)?|stamina)\b/i.test(frag);
    facts.push({
      status: isNonCombat ? 'NOT_APPLICABLE' : 'UNMODELED',
      entityId: result.sourceReference?.entityId || 'unknown_entity',
      sourceCode: result.sourceReference?.sourceCode || 'root',
      patchVersion: result.sourceReference?.patchVersion || '3.7',
      reason: isNonCombat
        ? 'Non-combat utility fragment'
        : 'Unconsumed mechanical prose requiring unmodeled combat system',
      rawFragment: frag,
      provenance: result.sourceReference
    });
  }

  return facts;
}

/**
 * Resolves MULTI_RANK values for a requested refinement rank.
 * Invariant: If the requested rank is missing, returns UNMODELED, NEVER numeric 0.
 */
export function resolveFactForRank(
  fact: EngineSemanticFact,
  rank: SemanticRefinementRank
): EngineSemanticFact {
  if (fact.status !== 'SAFE_EXPLICIT' && fact.status !== 'SAFE_DERIVED') {
    return fact;
  }

  if (fact.value.type !== 'MULTI_RANK') {
    return fact;
  }

  const rankVal = fact.value.ranks[rank];
  if (!rankVal) {
    return {
      status: 'UNMODELED',
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      parameter: fact.parameter,
      reason: `Refinement rank ${rank} is unmodeled or unavailable for ${fact.entityId}`,
      provenance: fact.provenance
    };
  }

  return {
    ...fact,
    value: rankVal
  };
}

/**
 * Evaluates whether a SemanticCondition is strictly static-safe (requires zero runtime context).
 *
 * Audit classification of SemanticCondition fields:
 * - trigger: RUNTIME_CONTEXT_REQUIRED (action/event timing)
 * - zoneActive: RUNTIME_CONTEXT_REQUIRED (runtime field/zone presence)
 * - buffActive: RUNTIME_CONTEXT_REQUIRED (runtime character buff state)
 * - stackCount: RUNTIME_CONTEXT_REQUIRED (runtime stack accumulation threshold)
 * - rawCondition: RUNTIME_CONTEXT_REQUIRED (unresolved threshold/state requirement)
 * - any unknown property on condition: UNKNOWN -> reject
 *
 * Fail-closed rule:
 * If condition is undefined or empty object with zero active fields -> STATIC_SAFE.
 * If ANY condition field is active, runtime-dependent, or unknown -> REJECT (false).
 */
export function isConditionStaticSafe(condition?: SemanticCondition): boolean {
  if (!condition) {
    return true; // No condition attached -> context-free
  }

  // 1. Audit known runtime fields
  if (condition.trigger !== undefined) {
    return false; // RUNTIME_CONTEXT_REQUIRED
  }

  if (condition.zoneActive !== undefined && condition.zoneActive !== false) {
    return false; // RUNTIME_CONTEXT_REQUIRED
  }

  if (condition.buffActive !== undefined && condition.buffActive !== false) {
    return false; // RUNTIME_CONTEXT_REQUIRED
  }

  if (condition.stackCount !== undefined && condition.stackCount > 0) {
    return false; // RUNTIME_CONTEXT_REQUIRED
  }

  if (condition.rawCondition !== undefined && condition.rawCondition.trim().length > 0) {
    return false; // RUNTIME_CONTEXT_REQUIRED / UNRESOLVED
  }

  if (condition.stackOperator !== undefined) {
    return false; // RUNTIME_CONTEXT_REQUIRED
  }

  // 2. Audit for unknown condition fields (fail closed on arbitrary extra properties)
  const knownKeys = new Set(['trigger', 'zoneActive', 'buffActive', 'stackCount', 'stackOperator', 'rawCondition']);
  for (const key of Object.keys(condition)) {
    if (!knownKeys.has(key)) {
      return false; // UNKNOWN -> reject
    }
  }

  return true;
}

/**
 * Determines whether an EngineSemanticFact is eligible for static numeric extraction.
 *
 * Requirements for static numeric extraction:
 * 1. Semantic status is SAFE_EXPLICIT or SAFE_DERIVED.
 * 2. Parameter safety is strictly DIRECT_ENGINE_FACT (never REQUIRES_CONTEXT, UNMODELED, or NOT_CONSUMABLE).
 * 3. Value is EXACT (not MULTI_RANK, RANGE, or UNRESOLVED).
 * 4. Patch isolation is verified (strictly '3.7').
 * 5. Provenance is verified (valid entity reference).
 * 6. SAFE_DERIVED requires supported non-empty derivationFormula.
 * 7. Condition is strictly STATIC_SAFE via isConditionStaticSafe (no runtime triggers, states, stacks, thresholds, or unknown fields).
 */
export function isStaticNumericEligible(fact: EngineSemanticFact): boolean {
  // 1. Semantic certainty: must be SAFE_EXPLICIT or SAFE_DERIVED
  if (fact.status !== 'SAFE_EXPLICIT' && fact.status !== 'SAFE_DERIVED') {
    return false;
  }

  // 2. Parameter safety: must be strictly DIRECT_ENGINE_FACT
  if (fact.parameterSafety !== 'DIRECT_ENGINE_FACT') {
    return false;
  }

  // 3. Value exactness: must be EXACT (rejects MULTI_RANK, RANGE, UNRESOLVED)
  if (fact.value.type !== 'EXACT') {
    return false;
  }

  // 4. Patch isolation: must be strictly Patch 3.7
  if (fact.patchVersion !== '3.7') {
    return false;
  }

  // 5. Provenance validity: must have valid entity provenance
  if (!fact.provenance || !fact.provenance.entityId) {
    return false;
  }

  // 6. SAFE_DERIVED verification: must have supported derivation formula
  if (fact.status === 'SAFE_DERIVED') {
    if (
      !fact.derivationFormula ||
      typeof fact.derivationFormula !== 'string' ||
      fact.derivationFormula.trim().length === 0
    ) {
      return false;
    }
  }

  // 7. Condition static safety: fail closed on triggers, runtime states, or unknown fields
  if (!isConditionStaticSafe(fact.condition)) {
    return false;
  }

  return true;
}

/**
 * Safely extracts numeric value if and only if the fact is strictly eligible
 * for static numeric consumption.
 *
 * CRITICAL INVARIANTS:
 * - SAFE_EXPLICIT + REQUIRES_CONTEXT -> returns null (NEVER returns 0)
 * - SAFE_EXPLICIT + conditional trigger -> returns null (NEVER returns 0)
 * - SAFE_EXPLICIT + runtime state/stack condition -> returns null (NEVER returns 0)
 * - UNKNOWN -> returns null (NEVER returns 0)
 * - UNMODELED -> returns null (NEVER returns 0)
 * - NOT_APPLICABLE -> returns null (NEVER returns 0)
 * - Missing value / MULTI_RANK -> returns null (NEVER returns 0)
 */
export function getNumericValueSafe(
  fact: EngineSemanticFact
): { value: number; unit: SemanticUnit } | null {
  if (!isStaticNumericEligible(fact)) {
    return null;
  }

  const safeFact = fact as Extract<EngineSemanticFact, { status: 'SAFE_EXPLICIT' | 'SAFE_DERIVED' }>;
  if (safeFact.value.type === 'EXACT') {
    return { value: safeFact.value.value, unit: safeFact.value.unit };
  }

  return null;
}

/**
 * Context-aware numeric accessor for evaluating contextual and conditional semantic facts.
 *
 * Safely verifies required action/rotation context and triggers without simulating full combat.
 * Rejects incomplete, mismatched, or unknown context deterministically (fail closed).
 *
 * CRITICAL INVARIANT: Returns null if required context is missing, mismatched, or unsupported; NEVER returns 0.
 */
export function getNumericValueWithContext(
  fact: EngineSemanticFact,
  context?: RuntimeEvaluationContext
): { value: number; unit: SemanticUnit } | null {
  if (fact.status !== 'SAFE_EXPLICIT' && fact.status !== 'SAFE_DERIVED') {
    return null;
  }

  // Multi-rank resolution if rank context is provided
  let evaluatedFact: EngineSemanticFact = fact;
  if (fact.value.type === 'MULTI_RANK') {
    if (!context?.refinementRank) {
      return null;
    }
    evaluatedFact = resolveFactForRank(fact, context.refinementRank);
    if (evaluatedFact.status !== 'SAFE_EXPLICIT' && evaluatedFact.status !== 'SAFE_DERIVED') {
      return null;
    }
  }

  const safeFact = evaluatedFact as Extract<EngineSemanticFact, { status: 'SAFE_EXPLICIT' | 'SAFE_DERIVED' }>;
  if (safeFact.value.type !== 'EXACT') {
    return null;
  }

  // 1. Verify condition requirements (fail-closed on unknown conditions or unresolved rawCondition)
  if (safeFact.condition) {
    // Fail-closed on unknown condition fields
    const knownKeys = new Set(['trigger', 'zoneActive', 'buffActive', 'stackCount', 'stackOperator', 'rawCondition']);
    for (const key of Object.keys(safeFact.condition)) {
      if (!knownKeys.has(key)) {
        return null; // UNKNOWN condition field -> reject
      }
    }

    // Fail-closed on unparsed rawCondition prose
    if (safeFact.condition.rawCondition && safeFact.condition.rawCondition.trim().length > 0) {
      return null;
    }

    // Trigger check
    if (safeFact.condition.trigger) {
      if (!context?.trigger || context.trigger !== safeFact.condition.trigger) {
        return null;
      }
    }

    // Zone state check
    if (safeFact.condition.zoneActive) {
      if (context?.zoneActive !== true) {
        return null;
      }
    }

    // Buff state check
    if (safeFact.condition.buffActive) {
      if (context?.buffActive !== true) {
        return null;
      }
    }

    // Stack count check
    if (safeFact.condition.stackCount !== undefined && safeFact.condition.stackCount > 0) {
      if (context?.stackCount === undefined || context.stackCount < safeFact.condition.stackCount) {
        return null;
      }
    }
  }

  // 2. Verify parameter context requirements
  if (safeFact.parameterSafety === 'REQUIRES_CONTEXT') {
    if (!context) {
      return null;
    }

    switch (safeFact.parameter) {
      case 'BASIC_ATTACK_DAMAGE_PERCENT':
        if (context.actionType !== 'BASIC_ATTACK') return null;
        break;
      case 'HEAVY_ATTACK_DAMAGE_PERCENT':
        if (context.actionType !== 'HEAVY_ATTACK') return null;
        break;
      case 'SKILL_DAMAGE_PERCENT':
        if (context.actionType !== 'RESONANCE_SKILL') return null;
        break;
      case 'LIBERATION_DAMAGE_PERCENT':
        if (context.actionType !== 'RESONANCE_LIBERATION') return null;
        break;
      case 'GENERIC_DAMAGE_PERCENT':
        // Requires explicit action type context
        if (!context.actionType) return null;
        break;
      case 'SKILL_CHARGES':
      case 'SKILL_COOLDOWN_REDUCTION_PERCENT':
        if (context.actionType !== 'RESONANCE_SKILL') return null;
        break;
      case 'RESONANCE_ENERGY':
      case 'CONCERTO_ENERGY':
        // Energy grants require at least action or trigger context
        if (!context.actionType && !context.trigger) return null;
        break;
      default:
        return null;
    }
  }

  if (safeFact.parameterSafety === 'CURRENTLY_UNMODELED' || safeFact.parameterSafety === 'NOT_ENGINE_CONSUMABLE') {
    return null;
  }

  return { value: safeFact.value.value, unit: safeFact.value.unit };
}

/**
 * Runs the semantic-to-engine safety gate over all 292 production extracted effects
 * from Patch 3.7 and computes integration metrics.
 */
export function runProductionEngineIntegrationAudit(): ProductionEngineIntegrationMetrics {
  const auditReport = runProductionSemanticsAudit();

  let safeExplicitCount = 0;
  let safeDerivedCount = 0;
  let unknownCount = 0;
  let unmodeledCount = 0;
  let notApplicableCount = 0;

  let directEngineFactCount = 0;
  let requiresContextCount = 0;
  let currentlyUnmodeledParamCount = 0;
  let notEngineConsumableParamCount = 0;

  let staticNumericEligibleCount = 0;
  let staticNumericRejectedCount = 0;
  let rejectedActionContextCount = 0;
  let rejectedTriggerContextCount = 0;
  let rejectedUnmodeledMechanicCount = 0;

  const targetBreakdown: Record<string, number> = {};
  const elementBreakdown: Record<string, number> = {};
  const conditionTriggerBreakdown: Record<string, number> = {};
  const rejectedEffects: ProductionEngineIntegrationMetrics['effectsRejectedFromDirectEngineUse'] = [];

  for (const rec of auditReport.records) {
    for (const eff of rec.result.effects) {
      const fact = convertSemanticEffectToFact(eff);
      const paramSafety = classifyParameterSafety(eff.parameter);
      const trig = eff.condition?.trigger || 'UNCONDITIONAL';

      // Safety count
      if (fact.status === 'SAFE_EXPLICIT') safeExplicitCount++;
      else if (fact.status === 'SAFE_DERIVED') safeDerivedCount++;
      else if (fact.status === 'UNKNOWN') unknownCount++;
      else if (fact.status === 'UNMODELED') unmodeledCount++;
      else if (fact.status === 'NOT_APPLICABLE') notApplicableCount++;

      // Parameter safety count
      if (paramSafety === 'DIRECT_ENGINE_FACT') directEngineFactCount++;
      else if (paramSafety === 'REQUIRES_CONTEXT') requiresContextCount++;
      else if (paramSafety === 'CURRENTLY_UNMODELED') currentlyUnmodeledParamCount++;
      else if (paramSafety === 'NOT_ENGINE_CONSUMABLE') notEngineConsumableParamCount++;

      // Static numeric eligibility tracking
      if (isStaticNumericEligible(fact)) {
        staticNumericEligibleCount++;
      } else {
        staticNumericRejectedCount++;
        if (paramSafety === 'CURRENTLY_UNMODELED' || fact.status === 'UNMODELED') {
          rejectedUnmodeledMechanicCount++;
        } else if (paramSafety === 'REQUIRES_CONTEXT') {
          rejectedActionContextCount++;
        } else if (trig !== 'UNCONDITIONAL') {
          rejectedTriggerContextCount++;
        }
      }

      // Breakdown tracking
      targetBreakdown[eff.target] = (targetBreakdown[eff.target] || 0) + 1;
      const elem = eff.element ?? extractCanonicalElement(eff.parameter);
      elementBreakdown[elem] = (elementBreakdown[elem] || 0) + 1;
      conditionTriggerBreakdown[trig] = (conditionTriggerBreakdown[trig] || 0) + 1;

      // Rejection tracking: effects not safe for direct static consumption
      if (!isStaticNumericEligible(fact)) {
        rejectedEffects.push({
          effectId: eff.id,
          entityId: eff.source.entityId,
          sourceCode: eff.source.sourceCode || 'root',
          parameter: eff.parameter,
          safetyStatus: fact.status,
          parameterSafety: paramSafety,
          reason:
            fact.status === 'UNMODELED'
              ? (fact as any).reason
              : paramSafety === 'REQUIRES_CONTEXT'
              ? `Action/rotation context required for parameter '${eff.parameter}'`
              : trig !== 'UNCONDITIONAL'
              ? `Conditional trigger '${trig}' requires runtime trigger context`
              : 'Effect requires unmodeled combat system'
        });
      }
    }
  }

  return {
    totalExtractedEffects: auditReport.totals.totalSemanticEffectsExtracted,
    safetyCounts: {
      SAFE_EXPLICIT: safeExplicitCount,
      SAFE_DERIVED: safeDerivedCount,
      UNKNOWN: unknownCount,
      UNMODELED: unmodeledCount,
      NOT_APPLICABLE: notApplicableCount
    },
    parameterSafetyBreakdown: {
      DIRECT_ENGINE_FACT: directEngineFactCount,
      REQUIRES_CONTEXT: requiresContextCount,
      CURRENTLY_UNMODELED: currentlyUnmodeledParamCount,
      NOT_ENGINE_CONSUMABLE: notEngineConsumableParamCount
    },
    staticNumericEligibility: {
      STATIC_NUMERIC_ELIGIBLE: staticNumericEligibleCount,
      STATIC_NUMERIC_REJECTED: staticNumericRejectedCount,
      rejectionBreakdown: {
        REQUIRES_ACTION_CONTEXT: rejectedActionContextCount,
        REQUIRES_TRIGGER_CONTEXT: rejectedTriggerContextCount,
        UNMODELED_COMBAT_MECHANIC: rejectedUnmodeledMechanicCount
      }
    },
    targetBreakdown,
    elementBreakdown,
    conditionTriggerBreakdown,
    effectsRejectedFromDirectEngineUse: rejectedEffects
  };
}
