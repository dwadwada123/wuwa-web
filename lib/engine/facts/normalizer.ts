/**
 * Wuthering Waves Deterministic Engine Fact Normalizer
 * Phase 6C Step 4: Deterministic Engine Consumption Layer
 *
 * Normalizes validated semantic facts into lossless, strongly typed engine facts.
 * Invariant:
 *   CONSUMABLE_STATIC is assigned ONLY when isStaticNumericEligible is true.
 *   UNMODELED, UNKNOWN, NOT_APPLICABLE, and REQUIRES_CONTEXT NEVER become numeric 0.
 */

import type {
  SemanticEffect,
  SemanticRefinementRank,
  ExtractionResult
} from '../../domain/types/semantics.ts';
import { PARSER_VERSION } from '../../semantics/parser.ts';
import { computeSemanticSignature } from '../../semantics/taxonomy.ts';
import type {
  EngineSemanticFact,
  EngineSemanticSafetyStatus,
  ParameterSafetyClassification
} from '../semantics/types.ts';
import {
  convertSemanticEffectToFact,
  resolveFactForRank,
  isStaticNumericEligible,
  getNumericValueSafe
} from '../semantics/safety-gate.ts';
import type {
  NormalizedEngineFact,
  EngineFactConsumptionState,
  FactNormalizationOptions,
  ProductionFactNormalizationMetrics
} from './types.ts';
import { runProductionSemanticsAudit } from '../../../scripts/production-semantics-audit.ts';

/**
 * Derives the canonical, deterministic factId for an EngineSemanticFact.
 * Strictly delegates to the approved Step 2 computeSemanticSignature().
 *
 * Guaranteed Dimensions in canonical factId:
 * - entityId (eff.source.entityId)
 * - sourceCode (eff.source.sourceCode)
 * - category (eff.category)
 * - target (eff.target)
 * - parameter (eff.parameter)
 * - element (extractCanonicalElement(eff.parameter, eff.element))
 * - serialized value (serializeSemanticValue(eff.value))
 * - condition (trigger, rawCondition, stackCount, zoneActive, buffActive)
 * - duration (durationSeconds, removeOnSwap)
 * - stacking (maxStacks, durationPerStackSeconds)
 *
 * For explicit weapon refinement ranks:
 * appends #${refinementRank} (e.g. canonicalSemanticSignature#R1).
 */
export function deriveCanonicalFactId(
  fact: EngineSemanticFact,
  refinementRank?: SemanticRefinementRank
): string {
  if (fact.effect) {
    const baseSignature = computeSemanticSignature(fact.effect);
    return refinementRank ? `${baseSignature}#${refinementRank}` : baseSignature;
  }

  // If fact was constructed without attached .effect but has semantic fields:
  if ('parameter' in fact && 'category' in fact && 'target' in fact && 'value' in fact) {
    const syntheticEffect: SemanticEffect = {
      id: `${fact.entityId}_${fact.sourceCode}_fact`,
      category: (fact as any).category,
      target: (fact as any).target,
      parameter: (fact as any).parameter,
      element: (fact as any).element,
      valueState:
        (fact as any).status === 'SAFE_EXPLICIT' || (fact as any).status === 'SAFE_DERIVED'
          ? 'PARSED'
          : ((fact as any).status as any),
      value: (fact as any).value,
      condition: (fact as any).condition,
      duration: (fact as any).duration,
      stacking: (fact as any).stacking,
      source: fact.provenance || {
        entityId: fact.entityId,
        entityName: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        sourceType: 'RESONATOR_ABILITY',
        sourceProvenance: 'patch_3_7_dataset.json',
        originalDescription: (fact as any).rawFragment || ''
      },
      extraction: {
        parserVersion: PARSER_VERSION,
        method: 'DETERMINISTIC_RULE_PARSER',
        extractionDate: '2026-10-08'
      }
    };
    const baseSignature = computeSemanticSignature(syntheticEffect);
    return refinementRank ? `${baseSignature}#${refinementRank}` : baseSignature;
  }

  // Unmodeled mechanical prose fragments that produced no structured SemanticEffect
  return `frag:${fact.entityId}:${fact.sourceCode}:${
    (fact as any).rawFragment || (fact as any).reason || 'unmodeled'
  }`;
}

/**
 * Normalizes an EngineSemanticFact into an immutable NormalizedEngineFact.
 * Pure, synchronous, and deterministic.
 */
export function normalizeEngineFact(
  fact: EngineSemanticFact,
  options?: FactNormalizationOptions
): NormalizedEngineFact {
  // 1. Explicit refinement rank resolution if requested
  let evaluatedFact: EngineSemanticFact = fact;
  let resolvedRank: SemanticRefinementRank | undefined = undefined;

  if (
    options?.refinementRank &&
    (fact.status === 'SAFE_EXPLICIT' || fact.status === 'SAFE_DERIVED') &&
    fact.value.type === 'MULTI_RANK'
  ) {
    evaluatedFact = resolveFactForRank(fact, options.refinementRank);
    resolvedRank = options.refinementRank;
  }

  // 2. Classify engine consumption state
  let consumptionState: EngineFactConsumptionState;
  if (evaluatedFact.status === 'NOT_APPLICABLE') {
    consumptionState = 'NOT_APPLICABLE';
  } else if (evaluatedFact.status === 'UNKNOWN') {
    consumptionState = 'UNKNOWN';
  } else if (evaluatedFact.status === 'UNMODELED') {
    consumptionState = 'UNMODELED';
  } else {
    // SAFE_EXPLICIT or SAFE_DERIVED
    if (isStaticNumericEligible(evaluatedFact)) {
      consumptionState = 'CONSUMABLE_STATIC';
    } else {
      consumptionState = 'CONSUMABLE_CONTEXTUAL';
    }
  }

  // 3. Extract static numeric value strictly through the approved Step 3 accessor
  let staticNumericValue: number | null = null;
  let unit = null;

  if (consumptionState === 'CONSUMABLE_STATIC') {
    const num = getNumericValueSafe(evaluatedFact);
    if (num !== null) {
      staticNumericValue = num.value;
      unit = num.unit;
    }
  } else if (
    (evaluatedFact.status === 'SAFE_EXPLICIT' || evaluatedFact.status === 'SAFE_DERIVED') &&
    'unit' in evaluatedFact.value
  ) {
    unit = (evaluatedFact.value as any).unit;
  }

  // 4. Derive stable, deterministic fact identity directly from Step 2 computeSemanticSignature
  const factId = deriveCanonicalFactId(evaluatedFact, resolvedRank);

  // 5. Construct normalized fact preserving all semantic dimensions
  return {
    factId,
    entityId: evaluatedFact.entityId,
    sourceCode: evaluatedFact.sourceCode,
    patchVersion: evaluatedFact.patchVersion,
    category: (evaluatedFact as any).category ?? 'SPECIAL_MECHANIC',
    parameter: (evaluatedFact as any).parameter ?? 'UNRESOLVED_PARAMETER',
    value: (evaluatedFact as any).value ?? {
      type: 'UNRESOLVED',
      reason: (evaluatedFact as any).reason || 'Unmodeled mechanical fragment'
    },
    staticNumericValue,
    unit,
    target: (evaluatedFact as any).target ?? (evaluatedFact as any).effect?.target ?? 'SELF',
    element: (evaluatedFact as any).element ?? 'NONE',
    condition: (evaluatedFact as any).condition,
    duration: (evaluatedFact as any).duration,
    stacking: (evaluatedFact as any).stacking,
    refinementRank: resolvedRank,
    semanticStatus: evaluatedFact.status,
    parameterSafety: (evaluatedFact as any).parameterSafety ?? 'NOT_ENGINE_CONSUMABLE',
    consumptionState,
    provenance: (evaluatedFact as any).provenance ?? {
      entityId: evaluatedFact.entityId,
      entityName: evaluatedFact.entityId,
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: evaluatedFact.sourceCode,
      patchVersion: evaluatedFact.patchVersion,
      sourceProvenance: 'patch_3_7_dataset.json',
      originalDescription: (evaluatedFact as any).rawFragment || ''
    },
    extraction: (evaluatedFact as any).effect?.extraction ?? {
      parserVersion: PARSER_VERSION,
      method: 'DETERMINISTIC_RULE_PARSER',
      extractionDate: '2026-10-08'
    },
    derivationFormula: (evaluatedFact as any).derivationFormula,
    reason: (evaluatedFact as any).reason,
    rawFragment: (evaluatedFact as any).rawFragment
  };
}

/**
 * Normalizes a raw SemanticEffect by converting it through the Step 3 safety gate
 * and producing a NormalizedEngineFact.
 */
export function normalizeSemanticEffect(
  effect: SemanticEffect,
  options?: FactNormalizationOptions
): NormalizedEngineFact {
  const fact = convertSemanticEffectToFact(effect);
  return normalizeEngineFact(fact, options);
}

/**
 * Normalizes all effects in an ExtractionResult.
 */
export function normalizeExtractionResult(
  result: ExtractionResult,
  options?: FactNormalizationOptions
): NormalizedEngineFact[] {
  return result.effects.map((eff) => normalizeSemanticEffect(eff, options));
}

/**
 * Runs the normalization pipeline across all 292 production semantic effects
 * from Patch 3.7 and computes deterministic aggregate metrics.
 */
export function runProductionFactNormalizationAudit(): ProductionFactNormalizationMetrics {
  const auditReport = runProductionSemanticsAudit();

  let consumableStaticCount = 0;
  let consumableContextualCount = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;

  const byParameter: Record<string, number> = {};
  const byTarget: Record<string, number> = {};
  const byElement: Record<string, number> = {};
  const byTrigger: Record<string, number> = {};
  const bySourceType: Record<string, number> = {};

  let directEngineFactCount = 0;
  let requiresContextCount = 0;
  let currentlyUnmodeledParamCount = 0;
  let notEngineConsumableParamCount = 0;

  let safeExplicitCount = 0;
  let safeDerivedCount = 0;
  let rawUnknownCount = 0;
  let rawUnmodeledCount = 0;
  let rawNotApplicableCount = 0;

  const facts: NormalizedEngineFact[] = [];

  for (const rec of auditReport.records) {
    for (const eff of rec.result.effects) {
      const normalized = normalizeSemanticEffect(eff);
      facts.push(normalized);

      // Consumption state accounting
      if (normalized.consumptionState === 'CONSUMABLE_STATIC') consumableStaticCount++;
      else if (normalized.consumptionState === 'CONSUMABLE_CONTEXTUAL') consumableContextualCount++;
      else if (normalized.consumptionState === 'UNMODELED') unmodeledCount++;
      else if (normalized.consumptionState === 'UNKNOWN') unknownCount++;
      else if (normalized.consumptionState === 'NOT_APPLICABLE') notApplicableCount++;

      // Breakdown tracking
      byParameter[normalized.parameter] = (byParameter[normalized.parameter] || 0) + 1;
      byTarget[normalized.target] = (byTarget[normalized.target] || 0) + 1;
      byElement[normalized.element] = (byElement[normalized.element] || 0) + 1;
      const trig = normalized.condition?.trigger || 'UNCONDITIONAL';
      byTrigger[trig] = (byTrigger[trig] || 0) + 1;
      bySourceType[normalized.provenance.sourceType] =
        (bySourceType[normalized.provenance.sourceType] || 0) + 1;

      // Parameter safety tracking
      if (normalized.parameterSafety === 'DIRECT_ENGINE_FACT') directEngineFactCount++;
      else if (normalized.parameterSafety === 'REQUIRES_CONTEXT') requiresContextCount++;
      else if (normalized.parameterSafety === 'CURRENTLY_UNMODELED') currentlyUnmodeledParamCount++;
      else if (normalized.parameterSafety === 'NOT_ENGINE_CONSUMABLE') notEngineConsumableParamCount++;

      // Semantic status tracking
      if (normalized.semanticStatus === 'SAFE_EXPLICIT') safeExplicitCount++;
      else if (normalized.semanticStatus === 'SAFE_DERIVED') safeDerivedCount++;
      else if (normalized.semanticStatus === 'UNKNOWN') rawUnknownCount++;
      else if (normalized.semanticStatus === 'UNMODELED') rawUnmodeledCount++;
      else if (normalized.semanticStatus === 'NOT_APPLICABLE') rawNotApplicableCount++;
    }
  }

  return {
    totalExtractedEffects: facts.length,
    byConsumptionState: {
      CONSUMABLE_STATIC: consumableStaticCount,
      CONSUMABLE_CONTEXTUAL: consumableContextualCount,
      UNMODELED: unmodeledCount,
      UNKNOWN: unknownCount,
      NOT_APPLICABLE: notApplicableCount
    },
    byParameter,
    byTarget,
    byElement,
    byTrigger,
    bySourceType,
    byParameterSafety: {
      DIRECT_ENGINE_FACT: directEngineFactCount,
      REQUIRES_CONTEXT: requiresContextCount,
      CURRENTLY_UNMODELED: currentlyUnmodeledParamCount,
      NOT_ENGINE_CONSUMABLE: notEngineConsumableParamCount
    },
    bySemanticStatus: {
      SAFE_EXPLICIT: safeExplicitCount,
      SAFE_DERIVED: safeDerivedCount,
      UNKNOWN: rawUnknownCount,
      UNMODELED: rawUnmodeledCount,
      NOT_APPLICABLE: rawNotApplicableCount
    },
    facts
  };
}
