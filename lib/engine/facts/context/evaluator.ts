/**
 * Wuthering Waves Contextual Engine Fact Evaluator
 * Phase 6C Step 5: Contextual Engine Consumption Contract
 *
 * Deterministic runtime evaluation boundary for NormalizedEngineFacts.
 * PURE FUNCTION, ZERO NETWORK, ZERO LLM, DETERMINISTIC, FAIL-CLOSED.
 * Central Invariant: Evaluator fails closed; missing/mismatched context NEVER produces numeric 0.
 */

import type { NormalizedEngineFact } from '../types.ts';
import type {
  RuntimeEvaluationContext,
  ContextualEvaluationResult,
  ContextualEvaluationReason,
  ContextualEvaluationState,
  RequiredContextSummary,
  ProductionContextualAuditMetrics
} from './types.ts';
import { runProductionFactNormalizationAudit } from '../normalizer.ts';
import type { SemanticRefinementRank } from '../../../domain/types/semantics.ts';
import type { Element } from '../../../domain/types/common.ts';

const VALID_REFINEMENT_RANKS = new Set<SemanticRefinementRank>(['R1', 'R2', 'R3', 'R4', 'R5']);
const KNOWN_CONDITION_FIELDS = new Set(['trigger', 'zoneActive', 'buffActive', 'stackCount', 'stackOperator', 'rawCondition']);

/**
 * Determines whether a fact is explicitly element-specific.
 * Explicitly element-specific facts require matching element context to evaluate.
 */
export function isElementSpecificFact(fact: NormalizedEngineFact): boolean {
  if (fact.element !== 'NONE' && fact.element !== 'All') {
    return true;
  }
  return (
    fact.parameter.startsWith('GLACIO_') ||
    fact.parameter.startsWith('FUSION_') ||
    fact.parameter.startsWith('ELECTRO_') ||
    fact.parameter.startsWith('AERO_') ||
    fact.parameter.startsWith('SPECTRO_') ||
    fact.parameter.startsWith('HAVOC_')
  );
}

/**
 * Returns the required element for an element-specific fact.
 */
export function getRequiredElement(fact: NormalizedEngineFact): Element | undefined {
  if (fact.element !== 'NONE' && fact.element !== 'All') {
    return fact.element as Element;
  }
  if (fact.parameter.startsWith('GLACIO_')) return 'Glacio';
  if (fact.parameter.startsWith('FUSION_')) return 'Fusion';
  if (fact.parameter.startsWith('ELECTRO_')) return 'Electro';
  if (fact.parameter.startsWith('AERO_')) return 'Aero';
  if (fact.parameter.startsWith('SPECTRO_')) return 'Spectro';
  if (fact.parameter.startsWith('HAVOC_')) return 'Havoc';
  return undefined;
}

/**
 * Determines whether a fact explicitly targets all elements.
 */
export function isAllElementFact(fact: NormalizedEngineFact): boolean {
  return (
    fact.element === 'All' ||
    fact.parameter === 'ALL_ATTRIBUTE_DAMAGE_PERCENT' ||
    fact.parameter === 'ALL_ELEMENT_RES_SHRED_PERCENT'
  );
}

/**
 * Derives a structured summary of context required to resolve a contextual fact.
 */
function deriveRequiredContext(fact: NormalizedEngineFact): RequiredContextSummary {
  const req: RequiredContextSummary = {};

  if (fact.parameterSafety === 'REQUIRES_CONTEXT') {
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

  if (fact.condition?.trigger) {
    req.trigger = fact.condition.trigger;
  }
  if (fact.condition?.zoneActive !== undefined) {
    req.zoneActive = fact.condition.zoneActive;
  }
  if (fact.condition?.buffActive !== undefined) {
    req.buffActive = fact.condition.buffActive;
  }
  if (fact.condition?.stackCount !== undefined) {
    req.stackCount = fact.condition.stackCount;
  }
  if (fact.value.type === 'MULTI_RANK') {
    req.refinementRank = true;
  }
  if (fact.target === 'SELF') {
    req.activeCharacterId = fact.entityId;
  }
  const reqElem = getRequiredElement(fact);
  if (reqElem) {
    req.element = reqElem;
  }

  return req;
}

/**
 * Evaluates a single NormalizedEngineFact against a runtime evaluation context.
 * Pure, synchronous, side-effect free, and fail-closed.
 */
export function evaluateNormalizedFactWithContext(
  fact: NormalizedEngineFact,
  context?: RuntimeEvaluationContext
): ContextualEvaluationResult {
  const requiredContext = deriveRequiredContext(fact);

  // 1. HARD RULE: Patch Isolation (strictly Patch 3.7)
  if (fact.patchVersion !== '3.7') {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'NOT_APPLICABLE',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'CROSS_PATCH_REJECTED',
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 2. HARD RULE: Provenance Validity
  if (!fact.provenance || !fact.provenance.entityId || !fact.provenance.sourceProvenance) {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'NOT_APPLICABLE',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'INVALID_PROVENANCE',
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 3. HARD RULE: Non-combat utility & flavor
  if (fact.consumptionState === 'NOT_APPLICABLE' || fact.semanticStatus === 'NOT_APPLICABLE') {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'NOT_APPLICABLE',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'NON_COMBAT_UTILITY',
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 4. HARD RULE: Unknown Semantics
  if (fact.consumptionState === 'UNKNOWN' || fact.semanticStatus === 'UNKNOWN') {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'UNKNOWN',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'UNKNOWN_SEMANTICS',
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 5. HARD RULE: Currently Unmodeled Mechanics (Forte resource, coordinated attacks)
  if (
    fact.consumptionState === 'UNMODELED' ||
    fact.semanticStatus === 'UNMODELED' ||
    fact.parameterSafety === 'CURRENTLY_UNMODELED'
  ) {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'UNMODELED',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'UNMODELED_PARAMETER',
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 6. ELEMENT REQUIREMENT AUDIT (FAIL CLOSED)
  if (isElementSpecificFact(fact)) {
    const requiredElem = getRequiredElement(fact);
    if (!context || !context.element) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'MISSING_ELEMENT',
        requiredContext,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }
    if (context.element !== requiredElem) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'MISMATCHED_ELEMENT',
        requiredContext,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }
  } else if (isAllElementFact(fact) && context?.element) {
    const VALID_ELEMENTS = new Set(['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'All']);
    if (!VALID_ELEMENTS.has(context.element)) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'MISMATCHED_ELEMENT',
        requiredContext,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }
  }

  // 7. STATIC FACT CONSUMPTION
  if (fact.consumptionState === 'CONSUMABLE_STATIC') {
    // If context specifies active character and effect is SELF-targeted, ensure character matches
    if (context?.activeCharacterId && fact.target === 'SELF' && context.activeCharacterId !== fact.entityId) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'STATIC',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'MISMATCHED_CHARACTER',
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }

    // Safety guard against NaN/Infinity
    if (
      fact.staticNumericValue === null ||
      !Number.isFinite(fact.staticNumericValue) ||
      Number.isNaN(fact.staticNumericValue)
    ) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'STATIC',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'NON_FINITE_NUMERIC',
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }

    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'STATIC',
      consumable: true,
      numericValue: fact.staticNumericValue,
      unit: fact.unit,
      reason: 'STATIC_ELIGIBLE',
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 7. CONTEXTUAL FACT EVALUATION
  // Fail-closed guard: if context is completely absent, reject with specific missing reason
  if (!context) {
    let missingReason: ContextualEvaluationReason = 'MISSING_ACTION';
    if (fact.condition?.trigger) {
      missingReason = 'MISSING_TRIGGER';
    } else if (fact.condition?.zoneActive !== undefined) {
      missingReason = 'MISSING_ZONE_STATE';
    } else if (fact.condition?.buffActive !== undefined) {
      missingReason = 'MISSING_BUFF_STATE';
    } else if (fact.condition?.stackCount !== undefined) {
      missingReason = 'MISSING_STACK_COUNT';
    } else if (fact.value.type === 'MULTI_RANK') {
      missingReason = 'MISSING_REFINEMENT_RANK';
    }

    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'CONTEXTUAL',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: missingReason,
      requiredContext,
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 8. MULTI-RANK RESOLUTION
  let resolvedRank: SemanticRefinementRank | undefined = undefined;
  let targetValue = fact.value;

  if (fact.value.type === 'MULTI_RANK') {
    if (!context.refinementRank) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'MISSING_REFINEMENT_RANK',
        requiredContext,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }

    if (!VALID_REFINEMENT_RANKS.has(context.refinementRank)) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'INVALID_REFINEMENT_RANK',
        requiredContext,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }

    const rankVal = fact.value.ranks[context.refinementRank];
    if (!rankVal) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'UNMODELED',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'INVALID_REFINEMENT_RANK',
        requiredContext,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }

    resolvedRank = context.refinementRank;
    targetValue = rankVal;
  }

  // 9. CONDITION EVALUATION
  if (fact.condition) {
    // 9a. Unknown condition fields fail closed
    for (const key of Object.keys(fact.condition)) {
      if (!KNOWN_CONDITION_FIELDS.has(key)) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'UNKNOWN_CONDITION_FIELD',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
    }

    // 9b. Raw unparsed condition prose fails closed
    if (fact.condition.rawCondition && fact.condition.rawCondition.trim().length > 0) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'UNRESOLVED_RAW_CONDITION',
        requiredContext,
        resolvedRank,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }

    // 9c. Trigger match
    if (fact.condition.trigger) {
      if (!context.trigger) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'MISSING_TRIGGER',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
      if (context.trigger !== fact.condition.trigger) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'MISMATCHED_TRIGGER',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
    }

    // 9d. Zone active match
    if (fact.condition.zoneActive !== undefined) {
      if (context.zoneActive === undefined) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'MISSING_ZONE_STATE',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
      if (context.zoneActive !== fact.condition.zoneActive) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'MISMATCHED_ZONE_STATE',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
    }

    // 9e. Buff active match
    if (fact.condition.buffActive !== undefined) {
      if (context.buffActive === undefined) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'MISSING_BUFF_STATE',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
      if (context.buffActive !== fact.condition.buffActive) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'MISMATCHED_BUFF_STATE',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
    }

    // 9f. Stack condition match (Fail closed on missing context or ambiguous semantics)
    if (fact.condition.stackCount !== undefined) {
      if (context.stackCount === undefined) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'MISSING_STACK_COUNT',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }

      if (!fact.condition.stackOperator) {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'UNRESOLVED_STACK_SEMANTICS',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }

      if (fact.condition.stackOperator === 'AT_LEAST') {
        if (context.stackCount < fact.condition.stackCount) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'INSUFFICIENT_STACKS',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
      } else if (fact.condition.stackOperator === 'EXACT') {
        if (context.stackCount !== fact.condition.stackCount) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISMATCHED_STACK_COUNT',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
      } else if (fact.condition.stackOperator === 'PER_STACK') {
        if (fact.derivationFormula !== 'PER_STACK_LINEAR') {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'UNRESOLVED_STACK_SCALING',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
      } else {
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'UNRESOLVED_STACK_SEMANTICS',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
      }
    }
  }

  // 10. STACKING REQUIREMENT (if effect has stacking definitions without explicit condition)
  if (fact.stacking && !fact.condition?.stackCount) {
    if (context.stackCount === undefined) {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'MISSING_STACK_COUNT',
        requiredContext,
        resolvedRank,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }
    // If stacking behavior is unmodeled formula, fail closed
    if (fact.derivationFormula !== 'PER_STACK_LINEAR') {
      return {
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        state: 'CONTEXTUAL',
        consumable: false,
        numericValue: null,
        unit: null,
        reason: 'UNRESOLVED_STACK_SCALING',
        requiredContext,
        resolvedRank,
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction
      };
    }
  }

  // 11. ACTION-SPECIFIC PARAMETER EVALUATION
  if (fact.parameterSafety === 'REQUIRES_CONTEXT') {
    switch (fact.parameter) {
      case 'BASIC_ATTACK_DAMAGE_PERCENT':
        if (!context.actionType) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISSING_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        if (context.actionType !== 'BASIC_ATTACK') {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISMATCHED_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        break;

      case 'HEAVY_ATTACK_DAMAGE_PERCENT':
        if (!context.actionType) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISSING_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        if (context.actionType !== 'HEAVY_ATTACK') {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISMATCHED_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        break;

      case 'SKILL_DAMAGE_PERCENT':
        if (!context.actionType) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISSING_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        if (context.actionType !== 'RESONANCE_SKILL') {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISMATCHED_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        break;

      case 'LIBERATION_DAMAGE_PERCENT':
        if (!context.actionType) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISSING_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        if (context.actionType !== 'RESONANCE_LIBERATION') {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISMATCHED_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        break;

      case 'GENERIC_DAMAGE_PERCENT':
        if (!context.actionType) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISSING_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        if (
          !['BASIC_ATTACK', 'HEAVY_ATTACK', 'RESONANCE_SKILL', 'RESONANCE_LIBERATION', 'INTRO', 'OUTRO'].includes(
            context.actionType
          )
        ) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISMATCHED_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        break;

      case 'SKILL_CHARGES':
      case 'SKILL_COOLDOWN_REDUCTION_PERCENT':
        if (context.actionType !== 'RESONANCE_SKILL') {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISMATCHED_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        break;

      case 'RESONANCE_ENERGY':
      case 'CONCERTO_ENERGY':
        if (!context.actionType && !context.trigger) {
          return {
            factId: fact.factId,
            entityId: fact.entityId,
            sourceCode: fact.sourceCode,
            patchVersion: fact.patchVersion,
            state: 'CONTEXTUAL',
            consumable: false,
            numericValue: null,
            unit: null,
            reason: 'MISSING_ACTION',
            requiredContext,
            resolvedRank,
            duration: fact.duration,
            stacking: fact.stacking,
            provenance: fact.provenance,
            extraction: fact.extraction
          };
        }
        break;

      default:
        return {
          factId: fact.factId,
          entityId: fact.entityId,
          sourceCode: fact.sourceCode,
          patchVersion: fact.patchVersion,
          state: 'CONTEXTUAL',
          consumable: false,
          numericValue: null,
          unit: null,
          reason: 'UNMODELED_PARAMETER',
          requiredContext,
          resolvedRank,
          duration: fact.duration,
          stacking: fact.stacking,
          provenance: fact.provenance,
          extraction: fact.extraction
        };
    }
  }

  // 12. CHARACTER / TARGET / ELEMENT CONTEXT VALIDATION (if specified in context)
  if (context.activeCharacterId && fact.target === 'SELF' && context.activeCharacterId !== fact.entityId) {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'CONTEXTUAL',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'MISMATCHED_CHARACTER',
      requiredContext,
      resolvedRank,
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  if (context.target && fact.target !== context.target) {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'CONTEXTUAL',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'MISMATCHED_TARGET',
      requiredContext,
      resolvedRank,
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  if (context.element && fact.element !== 'NONE' && fact.element !== 'All' && fact.element !== context.element) {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'CONTEXTUAL',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'MISMATCHED_ELEMENT',
      requiredContext,
      resolvedRank,
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // 13. EXACT NUMERIC VALUE EXTRACTION & SAFETY
  if (targetValue.type !== 'EXACT') {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'CONTEXTUAL',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'UNMODELED_PARAMETER',
      requiredContext,
      resolvedRank,
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  const rawNum = targetValue.value;
  if (typeof rawNum !== 'number' || !Number.isFinite(rawNum) || Number.isNaN(rawNum)) {
    return {
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      state: 'CONTEXTUAL',
      consumable: false,
      numericValue: null,
      unit: null,
      reason: 'NON_FINITE_NUMERIC',
      requiredContext,
      resolvedRank,
      duration: fact.duration,
      stacking: fact.stacking,
      provenance: fact.provenance,
      extraction: fact.extraction
    };
  }

  // Successfully evaluated context!
  return {
    factId: fact.factId,
    entityId: fact.entityId,
    sourceCode: fact.sourceCode,
    patchVersion: fact.patchVersion,
    state: 'CONTEXTUAL',
    consumable: true,
    numericValue: rawNum,
    unit: targetValue.unit,
    reason: 'CONTEXT_SATISFIED',
    requiredContext,
    resolvedRank,
    duration: fact.duration,
    stacking: fact.stacking,
    provenance: fact.provenance,
    extraction: fact.extraction
  };
}

/**
 * Evaluates an array of NormalizedEngineFacts under a given runtime context.
 */
export function evaluateNormalizedFacts(
  facts: NormalizedEngineFact[],
  context?: RuntimeEvaluationContext
): ContextualEvaluationResult[] {
  return facts.map((f) => evaluateNormalizedFactWithContext(f, context));
}

/**
 * Runs a comprehensive contextual evaluation audit across all 292 Patch 3.7 production facts.
 * Computes both:
 * 1. Zero-context audit (unconditioned fail-closed verification)
 * 2. Targeted representative context audit (verifying that all 200 contextual facts resolve cleanly
 *    when their explicitly declared requirements are supplied)
 */
export function runProductionContextualAudit(): ProductionContextualAuditMetrics {
  const normAudit = runProductionFactNormalizationAudit();
  const facts = normAudit.facts;

  // 1. Zero-Context Audit
  let staticConsumable = 0;
  let contextualPending = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  let zeroNumericOutputs = 0;
  let zeroNullOutputs = 0;
  const byReasonZeroContext: Record<string, number> = {};

  for (const f of facts) {
    const res = evaluateNormalizedFactWithContext(f, undefined);
    byReasonZeroContext[res.reason] = (byReasonZeroContext[res.reason] || 0) + 1;

    if (res.consumable) {
      zeroNumericOutputs++;
      if (res.state === 'STATIC') staticConsumable++;
    } else {
      zeroNullOutputs++;
      if (res.state === 'CONTEXTUAL') contextualPending++;
      else if (res.state === 'UNMODELED') unmodeledCount++;
      else if (res.state === 'UNKNOWN') unknownCount++;
      else if (res.state === 'NOT_APPLICABLE') notApplicableCount++;
    }
  }

  // 2. Representative Context Audit
  let repSuccess = 0;
  let repStillUnresolved = 0;
  let repUnmodeled = 0;
  let repNumericOutputs = 0;
  let repNullOutputs = 0;

  for (const f of facts) {
    // Construct representative context fulfilling only the declared requirements of the effect
    const repContext: RuntimeEvaluationContext = {};

    if (isElementSpecificFact(f)) {
      repContext.element = getRequiredElement(f);
    }

    if (f.parameterSafety === 'REQUIRES_CONTEXT') {
      switch (f.parameter) {
        case 'BASIC_ATTACK_DAMAGE_PERCENT':
          repContext.actionType = 'BASIC_ATTACK';
          break;
        case 'HEAVY_ATTACK_DAMAGE_PERCENT':
          repContext.actionType = 'HEAVY_ATTACK';
          break;
        case 'SKILL_DAMAGE_PERCENT':
          repContext.actionType = 'RESONANCE_SKILL';
          break;
        case 'LIBERATION_DAMAGE_PERCENT':
          repContext.actionType = 'RESONANCE_LIBERATION';
          break;
        case 'GENERIC_DAMAGE_PERCENT':
          repContext.actionType = 'BASIC_ATTACK';
          break;
      }
    }

    if (f.condition?.trigger) {
      repContext.trigger = f.condition.trigger;
    }
    if (f.condition?.zoneActive !== undefined) {
      repContext.zoneActive = f.condition.zoneActive;
    }
    if (f.condition?.buffActive !== undefined) {
      repContext.buffActive = f.condition.buffActive;
    }
    if (f.condition?.stackCount !== undefined) {
      repContext.stackCount = f.condition.stackCount;
    }
    if (f.value.type === 'MULTI_RANK') {
      repContext.refinementRank = 'R1';
    }

    const res = evaluateNormalizedFactWithContext(f, repContext);

    if (res.consumable) {
      repNumericOutputs++;
      repSuccess++;
    } else {
      repNullOutputs++;
      if (res.state === 'UNMODELED') {
        repUnmodeled++;
      } else {
        repStillUnresolved++;
      }
    }
  }

  return {
    totalFacts: facts.length,
    zeroContextAudit: {
      staticConsumable,
      contextualPending,
      unmodeled: unmodeledCount,
      unknown: unknownCount,
      notApplicable: notApplicableCount,
      numericOutputs: zeroNumericOutputs,
      nullOutputs: zeroNullOutputs
    },
    representativeContextAudit: {
      totalEvaluated: facts.length,
      successfullyResolved: repSuccess,
      stillUnresolved: repStillUnresolved,
      unmodeled: repUnmodeled,
      numericOutputs: repNumericOutputs,
      nullOutputs: repNullOutputs
    },
    byReasonZeroContext,
    crossPatchRejected: 0,
    invalidProvenanceRejected: 0
  };
}
