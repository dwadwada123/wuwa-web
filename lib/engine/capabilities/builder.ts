/**
 * Wuthering Waves Deterministic Gameplay Capability Builder
 * Phase 7 Step 1: Deterministic Gameplay Capability Contract
 *
 * Implements deterministic conversion of NormalizedEngineFacts into immutable
 * GameplayCapability models.
 *
 * CENTRAL INVARIANTS:
 * 1. A CAPABILITY IS NOT A SCORE. No scores, weights, priorities, or rankings.
 * 2. Deterministic, pure, synchronous, offline domain representation.
 * 3. Consumes strictly from Phase 6C engine facts (NormalizedEngineFact).
 * 4. Never fabricates numeric values or converts unmodeled/unknown to 0.
 * 5. Full traceability back to exact canonical factId.
 * 6. Strictly immutable and canonically ordered output.
 */

import type { NormalizedEngineFact } from '../facts/types.ts';
import type {
  GameplayCapability,
  CapabilityStatus,
  CapabilityContextRequirement,
  ProductionCapabilityMetrics
} from './types.ts';
import {
  determineCapabilityKind,
  determineCapabilityCategory,
  determineActionType,
  deriveCapabilityId,
  determineContextRequirements,
  sortCapabilities
} from './predicates.ts';
import { runProductionFactNormalizationAudit } from '../facts/normalizer.ts';

/**
 * Validates that an input collection of NormalizedEngineFacts conforms strictly to
 * the Patch 3.7 trust boundary contract.
 * Rejects cross-patch facts and duplicate fact identities.
 */
export function validateCapabilityInputFacts(
  facts: readonly NormalizedEngineFact[],
  expectedPatch: string = '3.7'
): void {
  if (!Array.isArray(facts)) {
    throw new Error('Capability builder requires a valid array of NormalizedEngineFact.');
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];

    if (!fact || typeof fact !== 'object') {
      throw new Error(`Capability builder encountered invalid fact at index ${i}.`);
    }

    if (!fact.factId || typeof fact.factId !== 'string') {
      throw new Error(`Fact at index ${i} is missing a canonical factId.`);
    }

    if (!fact.entityId || typeof fact.entityId !== 'string') {
      throw new Error(`Fact '${fact.factId}' is missing entityId.`);
    }

    if (!fact.sourceCode || typeof fact.sourceCode !== 'string') {
      throw new Error(`Fact '${fact.factId}' is missing sourceCode.`);
    }

    // Strict patch isolation: reject non-3.7 facts at trust boundary
    if (fact.patchVersion !== expectedPatch) {
      throw new Error(
        `Capability builder rejects cross-patch fact '${fact.factId}' with patchVersion '${fact.patchVersion}'. Expected '${expectedPatch}'.`
      );
    }

    // Strict duplicate detection: duplicate canonical fact IDs violate collection invariants
    if (seenIds.has(fact.factId)) {
      throw new Error(
        `Duplicate factId detected at capability trust boundary: '${fact.factId}'.`
      );
    }
    seenIds.add(fact.factId);
  }
}

/**
 * Builds a single immutable GameplayCapability from a verified NormalizedEngineFact.
 * Pure and deterministic.
 */
export function buildGameplayCapability(fact: NormalizedEngineFact): GameplayCapability {
  const kind = determineCapabilityKind(fact);
  const category = determineCapabilityCategory(kind, fact.target, fact.element);
  const actionType = determineActionType(fact);
  const capabilityId = deriveCapabilityId(
    fact.entityId,
    fact.sourceCode,
    kind,
    fact.target,
    fact.element,
    fact.factId
  );

  const {
    primary: contextRequirement,
    dimensions: contextRequirements,
    requiredContext
  } = determineContextRequirements(fact);

  const isStatic = fact.consumptionState === 'CONSUMABLE_STATIC';
  const isContextual = fact.consumptionState === 'CONSUMABLE_CONTEXTUAL';

  let status: CapabilityStatus;
  switch (fact.consumptionState) {
    case 'CONSUMABLE_STATIC':
      status = 'MODELED';
      break;
    case 'CONSUMABLE_CONTEXTUAL':
      status = 'CONTEXTUAL';
      break;
    case 'UNMODELED':
      status = 'UNMODELED';
      break;
    case 'UNKNOWN':
      status = 'UNKNOWN';
      break;
    case 'NOT_APPLICABLE':
    default:
      status = 'NOT_APPLICABLE';
      break;
  }

  // Value state determination:
  // Facts with exact values preserve their known numeric magnitude.
  // Facts with UNRESOLVED, unmodeled, unknown, or non-applicable states strictly remain null (never 0).
  const isUnmodeledOrUnknown =
    status === 'UNMODELED' ||
    status === 'UNKNOWN' ||
    status === 'NOT_APPLICABLE' ||
    fact.value.type === 'UNRESOLVED' ||
    fact.consumptionState === 'UNMODELED' ||
    fact.consumptionState === 'UNKNOWN' ||
    fact.consumptionState === 'NOT_APPLICABLE';

  const isNumericValueKnown =
    !isUnmodeledOrUnknown &&
    ((fact.value.type === 'EXACT' && Number.isFinite(fact.value.value)) ||
      (fact.staticNumericValue !== null && Number.isFinite(fact.staticNumericValue)));

  const numericValue = isNumericValueKnown
    ? fact.staticNumericValue !== null
      ? fact.staticNumericValue
      : fact.value.type === 'EXACT'
        ? fact.value.value
        : null
    : null;

  // Requirement dimension convenience flags
  const requiresElement = contextRequirements.includes('ELEMENT');
  const requiresAction = contextRequirements.includes('ACTION');
  const requiresTrigger = contextRequirements.includes('TRIGGER');
  const requiresZone = contextRequirements.includes('ZONE_STATE');
  const requiresBuff = contextRequirements.includes('BUFF_STATE');
  const requiresStack = contextRequirements.includes('STACK_COUNT');
  const requiresRefinement = contextRequirements.includes('REFINEMENT_RANK');

  const requiresRuntimeContext = contextRequirement !== 'NONE';
  const isContextFree = !requiresRuntimeContext && isNumericValueKnown;

  return Object.freeze({
    capabilityId,
    entityId: fact.entityId,
    sourceCode: fact.sourceCode,
    patchVersion: fact.patchVersion,
    kind,
    category,
    parameter: fact.parameter,
    target: fact.target,
    element: fact.element,
    actionType,
    conditions: fact.condition ? Object.freeze({ ...fact.condition }) : undefined,
    duration: fact.duration ? Object.freeze({ ...fact.duration }) : undefined,
    stacking: fact.stacking ? Object.freeze({ ...fact.stacking }) : undefined,
    refinementRank: fact.refinementRank,
    contextRequirement,
    contextRequirements,
    requiredContext,
    requiresRuntimeContext,
    isContextFree,
    isNumericValueKnown,
    requiresElement,
    requiresAction,
    requiresTrigger,
    requiresZone,
    requiresBuff,
    requiresStack,
    requiresRefinement,
    isStatic,
    isContextual,
    status,
    semanticStatus: fact.semanticStatus,
    consumptionState: fact.consumptionState,
    parameterSafety: fact.parameterSafety,
    numericValue,
    unit: fact.unit,
    factIds: Object.freeze([fact.factId]),
    provenance: Object.freeze({ ...fact.provenance })
  });
}

/**
 * Builds an immutable, canonically sorted collection of GameplayCapability domain models
 * from an input array of NormalizedEngineFacts.
 * Rejects invalid or cross-patch facts and avoids mutating inputs.
 */
export function buildGameplayCapabilities(
  facts: readonly NormalizedEngineFact[],
  expectedPatch: string = '3.7'
): readonly GameplayCapability[] {
  validateCapabilityInputFacts(facts, expectedPatch);

  const capabilities = facts.map((fact) => buildGameplayCapability(fact));
  return sortCapabilities(capabilities);
}

/**
 * Audits the complete Patch 3.7 production dataset (292 normalized facts),
 * building and reporting full multi-dimensional capability accounting.
 */
export function auditProductionCapabilities(): ProductionCapabilityMetrics {
  const normAudit = runProductionFactNormalizationAudit();
  const facts = normAudit.facts;
  const capabilities = buildGameplayCapabilities(facts, '3.7');

  let modeledCount = 0;
  let contextualCount = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;

  let valueKnownCount = 0;
  let valueUnknownCount = 0;

  let contextFreeCount = 0;
  let elementRequirementCount = 0;
  let actionRequirementCount = 0;
  let triggerRequirementCount = 0;
  let compositeRequirementCount = 0;
  let unmodeledRequirementCount = 0;

  let totalRequiringElement = 0;
  let totalRequiringAction = 0;
  let totalRequiringTrigger = 0;
  let totalRequiringStack = 0;
  let totalRequiringRefinement = 0;
  let totalRequiringZone = 0;
  let totalRequiringBuff = 0;

  const byContextRequirement: Record<CapabilityContextRequirement, number> = {
    NONE: 0,
    ELEMENT: 0,
    ACTION: 0,
    TRIGGER: 0,
    ZONE_STATE: 0,
    BUFF_STATE: 0,
    STACK_COUNT: 0,
    REFINEMENT_RANK: 0,
    COMPOSITE: 0,
    UNMODELED: 0
  };

  const byEntity: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byTarget: Record<string, number> = {};
  const byElement: Record<string, number> = {};
  const byParameter: Record<string, number> = {};

  for (const cap of capabilities) {
    if (cap.status === 'MODELED') modeledCount++;
    else if (cap.status === 'CONTEXTUAL') contextualCount++;
    else if (cap.status === 'UNMODELED') unmodeledCount++;
    else if (cap.status === 'UNKNOWN') unknownCount++;
    else if (cap.status === 'NOT_APPLICABLE') notApplicableCount++;

    if (cap.isNumericValueKnown) valueKnownCount++;
    else valueUnknownCount++;

    const currentReqCount = byContextRequirement[cap.contextRequirement];
    byContextRequirement[cap.contextRequirement] = currentReqCount !== undefined ? currentReqCount + 1 : 1;

    if (cap.contextRequirement === 'NONE') contextFreeCount++;
    else if (cap.contextRequirement === 'ELEMENT') elementRequirementCount++;
    else if (cap.contextRequirement === 'ACTION') actionRequirementCount++;
    else if (cap.contextRequirement === 'TRIGGER') triggerRequirementCount++;
    else if (cap.contextRequirement === 'COMPOSITE') compositeRequirementCount++;
    else if (cap.contextRequirement === 'UNMODELED') unmodeledRequirementCount++;

    if (cap.requiresElement) totalRequiringElement++;
    if (cap.requiresAction) totalRequiringAction++;
    if (cap.requiresTrigger) totalRequiringTrigger++;
    if (cap.requiresStack) totalRequiringStack++;
    if (cap.requiresRefinement) totalRequiringRefinement++;
    if (cap.requiresZone) totalRequiringZone++;
    if (cap.requiresBuff) totalRequiringBuff++;

    const entityCount = byEntity[cap.entityId];
    byEntity[cap.entityId] = entityCount !== undefined ? entityCount + 1 : 1;

    const kindCount = byKind[cap.kind];
    byKind[cap.kind] = kindCount !== undefined ? kindCount + 1 : 1;

    const catCount = byCategory[cap.category];
    byCategory[cap.category] = catCount !== undefined ? catCount + 1 : 1;

    const targetCount = byTarget[cap.target];
    byTarget[cap.target] = targetCount !== undefined ? targetCount + 1 : 1;

    const elemCount = byElement[cap.element];
    byElement[cap.element] = elemCount !== undefined ? elemCount + 1 : 1;

    const paramCount = byParameter[cap.parameter];
    byParameter[cap.parameter] = paramCount !== undefined ? paramCount + 1 : 1;
  }

  return {
    totalInputFacts: facts.length,
    totalCapabilities: capabilities.length,
    valueKnownCount,
    valueUnknownCount,
    contextFreeCount,
    elementRequirementCount,
    actionRequirementCount,
    triggerRequirementCount,
    compositeRequirementCount,
    unmodeledRequirementCount,
    byContextRequirement,
    totalRequiringElement,
    totalRequiringAction,
    totalRequiringTrigger,
    totalRequiringStack,
    totalRequiringRefinement,
    totalRequiringZone,
    totalRequiringBuff,
    modeledCount,
    contextualCount,
    unmodeledCount,
    unknownCount,
    notApplicableCount,
    byEntity,
    byKind,
    byCategory,
    byTarget,
    byElement,
    byParameter,
    capabilities
  };
}
