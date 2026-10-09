/**
 * Wuthering Waves Deterministic Character Interaction Evidence Composer
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 *
 * Implements deterministic composition, normalization, deduplication, conflict detection,
 * and provenance preservation for character-to-character interaction evidence.
 *
 * CENTRAL INVARIANTS:
 * 1. STRICT DIRECTIONALITY: A -> B != B -> A. Reverse edges are NEVER fabricated.
 * 2. SELF-INTERACTION REJECTION: A -> A is rejected.
 * 3. NO GAMEPLAY SCORING: Strictly evidence facts, no synergy scores, power scores, or DPS.
 * 4. DETERMINISTIC TOTAL ORDERING & DEDUPLICATION: Pure reproducible outputs.
 * 5. CONFLICT PRESERVATION: Conflicting evidence is marked CONFLICTED, never silently resolved.
 */

import {
  CHARACTER_INTERACTION_RULE_VERSION,
  VALID_CHARACTER_INTERACTION_TYPES,
  VALID_CHARACTER_INTERACTION_CATEGORIES,
  VALID_CHARACTER_INTERACTION_STATUSES,
  INTERACTION_REASON_CODES,
  createDefaultStep17Provenance
} from './rules.ts';
import {
  deriveConditionKey,
  deriveCharacterInteractionId,
  compareCharacterInteractionEvidence,
  canonicalSortStrings
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getCharacterPairSynergyProfiles } from '../relationships/character-pairs/synergy/repository.ts';
import type {
  CharacterInteractionEvidence,
  CharacterInteractionCompositionInput,
  CharacterInteractionCompositionResult,
  CharacterInteractionCompositionSummary,
  CharacterInteractionCompositionAudit,
  CharacterInteractionType,
  CharacterInteractionCategory,
  CharacterInteractionStatus,
  CharacterInteractionCondition,
  ApprovedCharacterRelationship,
  ApprovedInteractionEvidence,
  CharacterPairSynergyProfile,
  CharacterPairSynergyCategory,
  Element,
  GameplayActionType,
  SemanticParameter,
  SourceReference
} from './types.ts';

interface InteractionDraft {
  readonly sourceCharacterId: string;
  readonly targetCharacterId: string;
  readonly interactionType: CharacterInteractionType;
  readonly evidenceStatus: CharacterInteractionStatus;
  readonly category: CharacterInteractionCategory;
  readonly condition?: CharacterInteractionCondition;
  readonly effectValue: number | null;
  readonly unit: string | null;
  readonly sourceCapabilityIds: readonly string[];
  readonly relationshipIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly sourceFactIds: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly provenance: SourceReference;
}

/**
 * Maps a Step 8 CharacterPairSynergyCategory into canonical Step 17 types and categories.
 */
function mapSynergyCategory(cat: CharacterPairSynergyCategory): {
  readonly interactionType: CharacterInteractionType;
  readonly category: CharacterInteractionCategory;
} {
  switch (cat) {
    case 'OFFENSIVE_SYNERGY':
      return { interactionType: 'DAMAGE_AMPLIFICATION', category: 'OFFENSIVE' };
    case 'ELEMENTAL_SYNERGY':
      return { interactionType: 'ELEMENTAL_SYNERGY', category: 'ELEMENTAL' };
    case 'ACTION_SYNERGY':
      return { interactionType: 'ACTION_AMPLIFICATION', category: 'OFFENSIVE' };
    case 'TRANSITION_SYNERGY':
    case 'NEXT_RESONATOR_SYNERGY':
    case 'INTRO_OUTRO_SYNERGY':
      return { interactionType: 'OUTRO_INTRO_HANDOFF', category: 'TRANSITION' };
    case 'RESOURCE_SYNERGY':
      return { interactionType: 'RESOURCE_GENERATION', category: 'RESOURCE' };
    case 'DEFENSIVE_SYNERGY':
      return { interactionType: 'HEALING_SUPPORT', category: 'DEFENSIVE' };
    case 'COORDINATED_ATTACK_SYNERGY':
      return { interactionType: 'COORDINATED_ATTACK', category: 'OFFENSIVE' };
    case 'TARGETING_SYNERGY':
    case 'MECHANICAL_SYNERGY':
    default:
      return { interactionType: 'MECHANICAL_TRIGGER', category: 'MECHANICAL' };
  }
}

/**
 * Extracts condition requirements from Step 8 matched dimensions.
 */
function extractConditionFromMatchedDimensions(
  profile: CharacterPairSynergyProfile
): CharacterInteractionCondition | undefined {
  let elementReq: Element | 'All' | 'NONE' | undefined;
  let actionReq: GameplayActionType | undefined;
  let paramReq: SemanticParameter | undefined;

  for (const dim of profile.matchedDimensions) {
    if (dim.kind === 'ELEMENT' && dim.value) {
      elementReq = dim.value as Element;
    } else if (dim.kind === 'ACTION' && dim.value) {
      actionReq = dim.value as GameplayActionType;
    }
  }

  if (!elementReq && !actionReq && !paramReq) {
    return undefined;
  }

  return Object.freeze({
    elementRequirement: elementReq,
    actionTypeRequirement: actionReq,
    parameterRequirement: paramReq
  });
}

/**
 * Composes drafts from canonical Step 8 CharacterPairSynergyProfiles.
 */
function composeDraftsFromSynergyProfiles(): InteractionDraft[] {
  const profiles = getCharacterPairSynergyProfiles();
  const drafts: InteractionDraft[] = [];

  for (const p of profiles) {
    // Self-relationship rule: reject/skip A -> A
    if (p.sourceResonatorId === p.targetResonatorId) {
      continue;
    }

    // Skip NO_EVIDENCE pairs (epistemic honesty: absence of evidence is not an interaction)
    if (p.synergyStatus === 'NO_EVIDENCE') {
      continue;
    }

    // Extract condition from matched dimensions
    const cond = extractConditionFromMatchedDimensions(p);

    for (const comp of p.components) {
      const { interactionType, category } = mapSynergyCategory(comp.category);

      let status: CharacterInteractionStatus;
      if (p.synergyStatus === 'SYNERGY_SUPPORTED') {
        status = 'AUTHORITATIVE';
      } else if (p.synergyStatus === 'PARTIAL_SYNERGY') {
        status = comp.isEvaluated ? 'AUTHORITATIVE' : 'UNKNOWN';
      } else if (p.synergyStatus === 'CONTEXT_DEPENDENT') {
        status = 'UNKNOWN';
      } else if (p.synergyStatus === 'UNMODELED') {
        status = 'UNMODELED';
      } else if (p.synergyStatus === 'NOT_APPLICABLE') {
        status = 'NOT_APPLICABLE';
      } else {
        status = 'UNKNOWN';
      }

      const reasonCodes: string[] = [INTERACTION_REASON_CODES.APPROVED_EVIDENCE_COMPOSED];
      if (cond) {
        reasonCodes.push(INTERACTION_REASON_CODES.CONDITION_PRESERVED);
      }
      if (status === 'UNKNOWN') {
        reasonCodes.push(INTERACTION_REASON_CODES.UNKNOWN_PRESERVED);
      } else if (status === 'UNMODELED') {
        reasonCodes.push(INTERACTION_REASON_CODES.UNMODELED_PRESERVED);
      } else if (status === 'NOT_APPLICABLE') {
        reasonCodes.push(INTERACTION_REASON_CODES.NOT_APPLICABLE_PRESERVED);
      }

      drafts.push({
        sourceCharacterId: p.sourceResonatorId,
        targetCharacterId: p.targetResonatorId,
        interactionType,
        evidenceStatus: status,
        category,
        condition: cond,
        effectValue: null,
        unit: null,
        sourceCapabilityIds: Object.freeze([]),
        relationshipIds: comp.relationshipIds,
        evidenceIds: comp.evidenceIds,
        sourceFactIds: comp.sourceFactIds,
        reasonCodes: Object.freeze(reasonCodes),
        provenance: p.provenance
      });
    }
  }

  return drafts;
}

/**
 * Validates and converts custom approved relationships into interaction drafts.
 */
function processCustomRelationships(
  relationships: readonly (ApprovedCharacterRelationship | any)[]
): InteractionDraft[] {
  const drafts: InteractionDraft[] = [];

  for (let i = 0; i < relationships.length; i++) {
    const r = relationships[i];
    const path = `sourceRelationships[${i}]`;

    if (!r.patchVersion || r.patchVersion !== '3.7') {
      throw new Error(`Invalid or missing patchVersion on ${path}. Strictly '3.7' required.`);
    }

    const sourceChar = r.sourceCharacterId || r.provenance?.entityId;
    const targetChar = r.targetCharacterId;

    if (!sourceChar || !isCanonicalResonatorId(sourceChar)) {
      throw new Error(`Invalid or unknown source character '${sourceChar}' at ${path}.`);
    }
    if (!targetChar || !isCanonicalResonatorId(targetChar)) {
      throw new Error(`Invalid or unknown target character '${targetChar}' at ${path}.`);
    }

    // Invariant: Self-interaction rejected
    if (sourceChar === targetChar) {
      throw new Error(`Self-interaction '${sourceChar} -> ${targetChar}' rejected at ${path}.`);
    }

    if (!r.provenance || !r.provenance.sourceProvenance) {
      throw new Error(`Missing or invalid provenance at ${path}.`);
    }

    let interactionType: CharacterInteractionType;
    if (VALID_CHARACTER_INTERACTION_TYPES.includes(r.relationshipType)) {
      interactionType = r.relationshipType;
    } else {
      interactionType = 'MECHANICAL_TRIGGER';
    }

    let category: CharacterInteractionCategory = r.category || 'MECHANICAL';
    if (!VALID_CHARACTER_INTERACTION_CATEGORIES.includes(category)) {
      category = 'MECHANICAL';
    }

    drafts.push({
      sourceCharacterId: sourceChar,
      targetCharacterId: targetChar,
      interactionType,
      evidenceStatus: 'AUTHORITATIVE',
      category,
      condition: r.condition,
      effectValue: r.effectValue !== undefined ? r.effectValue : null,
      unit: r.unit || null,
      sourceCapabilityIds: r.sourceCapabilityIds || Object.freeze([]),
      relationshipIds: r.relationshipIds || (r.id ? Object.freeze([r.id]) : Object.freeze([])),
      evidenceIds: Object.freeze([]),
      sourceFactIds: r.sourceFactIds || Object.freeze([]),
      reasonCodes: Object.freeze([INTERACTION_REASON_CODES.APPROVED_EVIDENCE_COMPOSED]),
      provenance: r.provenance
    });
  }

  return drafts;
}

/**
 * Validates and converts custom approved interactions into interaction drafts.
 */
function processCustomInteractions(
  interactions: readonly (ApprovedInteractionEvidence | any)[]
): InteractionDraft[] {
  const drafts: InteractionDraft[] = [];

  for (let i = 0; i < interactions.length; i++) {
    const item = interactions[i];
    const path = `sourceInteractions[${i}]`;

    if (!item.patchVersion || item.patchVersion !== '3.7') {
      throw new Error(`Invalid or missing patchVersion on ${path}. Strictly '3.7' required.`);
    }

    const sourceChar = item.sourceCharacterId || item.sourceEntityId || item.provenance?.entityId;
    const targetChar = item.targetCharacterId || item.targetEntityId;

    if (!sourceChar || !isCanonicalResonatorId(sourceChar)) {
      throw new Error(`Invalid or unknown source character '${sourceChar}' at ${path}.`);
    }
    if (!targetChar || !isCanonicalResonatorId(targetChar)) {
      throw new Error(`Invalid or unknown target character '${targetChar}' at ${path}.`);
    }

    // Invariant: Self-interaction rejected
    if (sourceChar === targetChar) {
      throw new Error(`Self-interaction '${sourceChar} -> ${targetChar}' rejected at ${path}.`);
    }

    if (!item.provenance || !item.provenance.sourceProvenance) {
      throw new Error(`Missing or invalid provenance at ${path}.`);
    }

    let interactionType: CharacterInteractionType;
    if (VALID_CHARACTER_INTERACTION_TYPES.includes(item.interactionType)) {
      interactionType = item.interactionType;
    } else {
      interactionType = 'MECHANICAL_TRIGGER';
    }

    let category: CharacterInteractionCategory = item.category || 'MECHANICAL';
    if (!VALID_CHARACTER_INTERACTION_CATEGORIES.includes(category)) {
      category = 'MECHANICAL';
    }

    let status: CharacterInteractionStatus = item.evidenceStatus || 'AUTHORITATIVE';
    if (!VALID_CHARACTER_INTERACTION_STATUSES.includes(status)) {
      status = 'UNKNOWN';
    }

    drafts.push({
      sourceCharacterId: sourceChar,
      targetCharacterId: targetChar,
      interactionType,
      evidenceStatus: status,
      category,
      condition: item.condition,
      effectValue: item.effectValue !== undefined ? item.effectValue : null,
      unit: item.unit || null,
      sourceCapabilityIds: item.sourceCapabilityIds || Object.freeze([]),
      relationshipIds: item.relationshipIds || Object.freeze([]),
      evidenceIds: item.evidenceIds || (item.id ? Object.freeze([item.id]) : Object.freeze([])),
      sourceFactIds: item.sourceFactIds || Object.freeze([]),
      reasonCodes: Object.freeze([INTERACTION_REASON_CODES.APPROVED_EVIDENCE_COMPOSED]),
      provenance: item.provenance
    });
  }

  return drafts;
}

/**
 * Main composition engine for Step 17.
 * Deterministically composes approved character relationship & interaction evidence.
 */
export function composeCharacterInteractions(
  input?: CharacterInteractionCompositionInput
): CharacterInteractionCompositionResult {
  // 1. Validate Input Contract
  if (input) {
    if (!input.patchId || input.patchId !== '3.7') {
      throw new Error(`Invalid patch context '${input.patchId}'. Step 17 strictly requires Patch '3.7'.`);
    }
    if (input.ruleVersion !== CHARACTER_INTERACTION_RULE_VERSION) {
      throw new Error(`Invalid ruleVersion '${input.ruleVersion}'. Step 17 strictly requires '${CHARACTER_INTERACTION_RULE_VERSION}'.`);
    }
  }

  // 2. Gather Drafts
  const drafts: InteractionDraft[] = [];

  if (input?.sourceRelationships && input.sourceRelationships.length > 0) {
    drafts.push(...processCustomRelationships(input.sourceRelationships));
  }
  if (input?.sourceInteractions && input.sourceInteractions.length > 0) {
    drafts.push(...processCustomInteractions(input.sourceInteractions));
  }

  // If no custom inputs supplied, load canonical Step 8 synergy evidence catalog
  if (!input?.sourceRelationships && !input?.sourceInteractions) {
    drafts.push(...composeDraftsFromSynergyProfiles());
  }

  // 3. Deduplicate and Detect Conflicts
  // Group drafts by logical identity: (sourceCharacterId, targetCharacterId, interactionType, conditionKey)
  const groupedMap = new Map<string, InteractionDraft[]>();

  for (const draft of drafts) {
    const condKey = deriveConditionKey(draft.condition);
    const key = `${draft.sourceCharacterId}:::${draft.targetCharacterId}:::${draft.interactionType}:::${condKey}`;
    const list = groupedMap.get(key);
    if (!list) {
      groupedMap.set(key, [draft]);
    } else {
      list.push(draft);
    }
  }

  let deduplicatedCount = 0;
  let conflictsDetected = 0;
  const composedInteractions: CharacterInteractionEvidence[] = [];

  for (const [key, group] of groupedMap.entries()) {
    const first = group[0];
    const condKey = deriveConditionKey(first.condition);

    if (group.length === 1) {
      const id = deriveCharacterInteractionId(
        first.sourceCharacterId,
        first.targetCharacterId,
        first.interactionType,
        condKey,
        CHARACTER_INTERACTION_RULE_VERSION
      );

      composedInteractions.push(Object.freeze({
        id,
        patchVersion: '3.7',
        ruleVersion: CHARACTER_INTERACTION_RULE_VERSION,
        sourceCharacterId: first.sourceCharacterId,
        targetCharacterId: first.targetCharacterId,
        interactionType: first.interactionType,
        evidenceStatus: first.evidenceStatus,
        category: first.category,
        condition: first.condition,
        effectValue: first.effectValue,
        unit: first.unit,
        sourceCapabilityIds: canonicalSortStrings(first.sourceCapabilityIds),
        relationshipIds: canonicalSortStrings(first.relationshipIds),
        evidenceIds: canonicalSortStrings(first.evidenceIds),
        sourceFactIds: canonicalSortStrings(first.sourceFactIds),
        reasonCodes: canonicalSortStrings(first.reasonCodes),
        provenance: first.provenance
      }));
    } else {
      // Multiple records for the same logical identity -> check for contradictions
      let hasConflict = false;
      const refValue = first.effectValue;
      const refStatus = first.evidenceStatus;
      const refUnit = first.unit;

      for (let j = 1; j < group.length; j++) {
        const item = group[j];

        // Conflict check 1: Numeric value mismatch
        if (refValue !== null && item.effectValue !== null && Math.abs(refValue - item.effectValue) > 0.0001) {
          hasConflict = true;
          break;
        }

        // Conflict check 2: Status contradiction (e.g. AUTHORITATIVE vs NOT_APPLICABLE)
        if (
          (refStatus === 'AUTHORITATIVE' && item.evidenceStatus === 'NOT_APPLICABLE') ||
          (refStatus === 'NOT_APPLICABLE' && item.evidenceStatus === 'AUTHORITATIVE')
        ) {
          hasConflict = true;
          break;
        }

        // Conflict check 3: Unit mismatch
        if (refUnit !== null && item.unit !== null && refUnit !== item.unit) {
          hasConflict = true;
          break;
        }
      }

      const mergedCapIds = new Set<string>();
      const mergedRelIds = new Set<string>();
      const mergedEviIds = new Set<string>();
      const mergedFactIds = new Set<string>();
      const mergedReasonCodes = new Set<string>();

      for (const item of group) {
        for (const cid of item.sourceCapabilityIds) mergedCapIds.add(cid);
        for (const rid of item.relationshipIds) mergedRelIds.add(rid);
        for (const eid of item.evidenceIds) mergedEviIds.add(eid);
        for (const fid of item.sourceFactIds) mergedFactIds.add(fid);
        for (const rc of item.reasonCodes) mergedReasonCodes.add(rc);
      }

      let finalStatus: CharacterInteractionStatus;
      if (hasConflict) {
        finalStatus = 'CONFLICTED';
        conflictsDetected++;
        mergedReasonCodes.add(INTERACTION_REASON_CODES.CONFLICT_DETECTED);
      } else {
        finalStatus = first.evidenceStatus;
        deduplicatedCount += (group.length - 1);
        mergedReasonCodes.add(INTERACTION_REASON_CODES.DEDUPLICATED);
      }

      const id = deriveCharacterInteractionId(
        first.sourceCharacterId,
        first.targetCharacterId,
        first.interactionType,
        condKey,
        CHARACTER_INTERACTION_RULE_VERSION
      );

      composedInteractions.push(Object.freeze({
        id,
        patchVersion: '3.7',
        ruleVersion: CHARACTER_INTERACTION_RULE_VERSION,
        sourceCharacterId: first.sourceCharacterId,
        targetCharacterId: first.targetCharacterId,
        interactionType: first.interactionType,
        evidenceStatus: finalStatus,
        category: first.category,
        condition: first.condition,
        effectValue: hasConflict ? null : first.effectValue,
        unit: hasConflict ? null : first.unit,
        sourceCapabilityIds: canonicalSortStrings(Array.from(mergedCapIds)),
        relationshipIds: canonicalSortStrings(Array.from(mergedRelIds)),
        evidenceIds: canonicalSortStrings(Array.from(mergedEviIds)),
        sourceFactIds: canonicalSortStrings(Array.from(mergedFactIds)),
        reasonCodes: canonicalSortStrings(Array.from(mergedReasonCodes)),
        provenance: first.provenance
      }));
    }
  }

  // 4. Deterministic Total Ordering
  composedInteractions.sort(compareCharacterInteractionEvidence);

  // 5. Accounting Summary
  let authoritativeCount = 0;
  let unknownCount = 0;
  let unmodeledCount = 0;
  let notApplicableCount = 0;
  let conflictedCount = 0;

  for (const item of composedInteractions) {
    if (item.evidenceStatus === 'AUTHORITATIVE') authoritativeCount++;
    else if (item.evidenceStatus === 'UNKNOWN') unknownCount++;
    else if (item.evidenceStatus === 'UNMODELED') unmodeledCount++;
    else if (item.evidenceStatus === 'NOT_APPLICABLE') notApplicableCount++;
    else if (item.evidenceStatus === 'CONFLICTED') conflictedCount++;
  }

  const summary: CharacterInteractionCompositionSummary = Object.freeze({
    total: composedInteractions.length,
    authoritative: authoritativeCount,
    unknown: unknownCount,
    unmodeled: unmodeledCount,
    notApplicable: notApplicableCount,
    conflicted: conflictedCount,
    deduplicated: deduplicatedCount
  });

  const audit: CharacterInteractionCompositionAudit = Object.freeze({
    deterministic: true,
    patchIsolated: true,
    provenanceValidated: true,
    conflictsDetected
  });

  return Object.freeze({
    patchId: '3.7',
    ruleVersion: CHARACTER_INTERACTION_RULE_VERSION,
    interactions: Object.freeze(composedInteractions),
    summary,
    audit
  });
}
