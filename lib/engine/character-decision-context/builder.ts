/**
 * Wuthering Waves Character Decision Context Builder
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Implements deterministic pairing, validation, summary calculation, and
 * ordering for CharacterDecisionContext records.
 *
 * CENTRAL INVARIANTS:
 * 1. ZERO SCORING: Strictly context aggregation; never weights, scores, or DPS.
 * 2. ZERO TEAM DECISION: Does not generate teams or recommend teammates.
 * 3. ZERO ROLE INFERENCE: No heuristic role categorization.
 * 4. PURE DETERMINISM: Offline, zero network, zero LLMs, zero timestamps.
 * 5. STRICT PATCH ISOLATION: Patch 3.7 bound only.
 * 6. INPUT IMMUTABILITY: Upstream evaluations and profiles remain untouched.
 */

import {
  CHARACTER_DECISION_CONTEXT_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP16_RULE_VERSION,
  REQUIRED_STEP18_RULE_VERSION,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  deriveCharacterDecisionContextId,
  compareCharacterDecisionContexts
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getKnownResonatorIds } from '../team-composition/repository.ts';
import { getAllCharacterEvaluations } from '../character-evaluation/repository.ts';
import { getAllCharacterInteractionProfiles } from '../character-interaction-profiles/repository.ts';
import type {
  CharacterDecisionContext,
  CharacterDecisionContextSummary,
  CharacterDecisionContextProvenance,
  CharacterDecisionContextInput,
  CharacterDecisionContextResult,
  CharacterDecisionContextResultSummary,
  CharacterDecisionContextAuditMetrics,
  CharacterEvaluation,
  CharacterInteractionProfile
} from './types.ts';

/**
 * Builds a single deterministic CharacterDecisionContext from a matching
 * Step 16 evaluation and Step 18 interaction profile.
 */
export function buildCharacterDecisionContext(
  evaluation: CharacterEvaluation,
  interactionProfile: CharacterInteractionProfile,
  patchId: string = CANONICAL_PATCH_VERSION
): CharacterDecisionContext {
  if (!evaluation) {
    throw new Error('Evaluation is required to build CharacterDecisionContext.');
  }
  if (!interactionProfile) {
    throw new Error('InteractionProfile is required to build CharacterDecisionContext.');
  }

  // Patch validation
  if (patchId !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchId '${patchId}'. Step 19 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }
  if (evaluation.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Evaluation patchVersion '${evaluation.patchVersion}' mismatch. Expected '${CANONICAL_PATCH_VERSION}'.`
    );
  }
  if (interactionProfile.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `InteractionProfile patchVersion '${interactionProfile.patchVersion}' mismatch. Expected '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  // Upstream rule version validation
  if (evaluation.ruleVersion !== REQUIRED_STEP16_RULE_VERSION) {
    throw new Error(
      `Incompatible evaluation ruleVersion '${evaluation.ruleVersion}'. Expected '${REQUIRED_STEP16_RULE_VERSION}'.`
    );
  }
  if (interactionProfile.ruleVersion !== REQUIRED_STEP18_RULE_VERSION) {
    throw new Error(
      `Incompatible interactionProfile ruleVersion '${interactionProfile.ruleVersion}'. Expected '${REQUIRED_STEP18_RULE_VERSION}'.`
    );
  }

  // Character identity validation
  const charId = evaluation.resonatorId;
  if (!isCanonicalResonatorId(charId)) {
    throw new Error(`Invalid canonical Resonator ID '${charId}'.`);
  }
  if (interactionProfile.characterId !== charId) {
    throw new Error(
      `Mismatched character IDs: evaluation has '${charId}', profile has '${interactionProfile.characterId}'.`
    );
  }

  const id = deriveCharacterDecisionContextId(
    charId,
    CANONICAL_PATCH_VERSION,
    CHARACTER_DECISION_CONTEXT_RULE_VERSION
  );

  const contextSummary: CharacterDecisionContextSummary = Object.freeze({
    hasEvaluation: true,
    evaluationStatus: evaluation.status,
    evaluationScore: evaluation.evaluationScore,
    outgoingInteractionCount: interactionProfile.summary.outgoingTotal,
    incomingInteractionCount: interactionProfile.summary.incomingTotal,
    authoritativeOutgoingCount: interactionProfile.summary.outgoingAuthoritative,
    authoritativeIncomingCount: interactionProfile.summary.incomingAuthoritative,
    unknownOutgoingCount: interactionProfile.summary.outgoingUnknown,
    unknownIncomingCount: interactionProfile.summary.incomingUnknown,
    unmodeledOutgoingCount: interactionProfile.summary.outgoingUnmodeled,
    unmodeledIncomingCount: interactionProfile.summary.incomingUnmodeled,
    conflictedOutgoingCount: interactionProfile.summary.outgoingConflicted,
    conflictedIncomingCount: interactionProfile.summary.incomingConflicted,
    distinctOutgoingTargets: interactionProfile.summary.distinctOutgoingTargets,
    distinctIncomingSources: interactionProfile.summary.distinctIncomingSources
  });

  const provenance: CharacterDecisionContextProvenance = Object.freeze({
    source: 'DERIVED_DECISION_CONTEXT',
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_DECISION_CONTEXT_RULE_VERSION,
    evaluationId: evaluation.id,
    profileId: interactionProfile.id,
    upstreamEvaluationRuleVersion: evaluation.ruleVersion,
    upstreamProfileRuleVersion: interactionProfile.ruleVersion
  });

  return Object.freeze({
    id,
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_DECISION_CONTEXT_RULE_VERSION,
    characterId: charId,
    evaluation,
    interactionProfile,
    contextSummary,
    summary: contextSummary,
    provenance
  });
}

/**
 * Builds a deterministic collection of CharacterDecisionContext records.
 */
export function buildCharacterDecisionContexts(
  input?: CharacterDecisionContextInput
): CharacterDecisionContextResult {
  const patchId = input?.patchId ?? CANONICAL_PATCH_VERSION;
  if (patchId !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchId '${patchId}'. Step 19 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  const evaluations = input?.evaluations ?? getAllCharacterEvaluations();
  const profiles = input?.interactionProfiles ?? getAllCharacterInteractionProfiles();

  // Validate and index evaluations by resonatorId
  const evalMap = new Map<string, CharacterEvaluation>();
  for (let i = 0; i < evaluations.length; i++) {
    const ev = evaluations[i];
    if (!ev) {
      throw new Error(`Null evaluation record at index ${i}.`);
    }
    if (!ev.resonatorId || !isCanonicalResonatorId(ev.resonatorId)) {
      throw new Error(
        `Character ID '${ev?.resonatorId}' in evaluation record at index ${i} is not a canonical Patch 3.7 Resonator.`
      );
    }
    if (ev.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `Evaluation record for '${ev.resonatorId}' has invalid patchVersion '${ev.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
      );
    }
    if (ev.ruleVersion !== REQUIRED_STEP16_RULE_VERSION) {
      throw new Error(
        `Evaluation record for '${ev.resonatorId}' has invalid ruleVersion '${ev.ruleVersion}'. Expected '${REQUIRED_STEP16_RULE_VERSION}'.`
      );
    }
    if (evalMap.has(ev.resonatorId)) {
      throw new Error(`Duplicate evaluation record for character '${ev.resonatorId}'.`);
    }
    evalMap.set(ev.resonatorId, ev);
  }

  // Validate and index interaction profiles by characterId
  const profileMap = new Map<string, CharacterInteractionProfile>();
  for (let i = 0; i < profiles.length; i++) {
    const prof = profiles[i];
    if (!prof) {
      throw new Error(`Null interaction profile record at index ${i}.`);
    }
    if (!prof.characterId || !isCanonicalResonatorId(prof.characterId)) {
      throw new Error(
        `Character ID '${prof?.characterId}' in interaction profile record at index ${i} is not a canonical Patch 3.7 Resonator.`
      );
    }
    if (prof.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `Profile record for '${prof.characterId}' has invalid patchVersion '${prof.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
      );
    }
    if (prof.ruleVersion !== REQUIRED_STEP18_RULE_VERSION) {
      throw new Error(
        `Profile record for '${prof.characterId}' has invalid ruleVersion '${prof.ruleVersion}'. Expected '${REQUIRED_STEP18_RULE_VERSION}'.`
      );
    }
    if (profileMap.has(prof.characterId)) {
      throw new Error(`Duplicate interaction profile record for character '${prof.characterId}'.`);
    }
    profileMap.set(prof.characterId, prof);
  }

  // Determine character IDs to build contexts for
  const targetCharacterIds = input?.characterIds ?? getKnownResonatorIds();
  const targetSet = new Set<string>();

  for (const charId of targetCharacterIds) {
    if (targetSet.has(charId)) {
      throw new Error(`Duplicate character ID '${charId}' in requested characterIds.`);
    }
    targetSet.add(charId);

    if (!isCanonicalResonatorId(charId)) {
      throw new Error(`Character ID '${charId}' is not a canonical Patch 3.7 Resonator.`);
    }
  }

  // Validate that no extra records exist when catalog inputs are explicitly supplied
  if (input?.evaluations) {
    for (const ev of evaluations) {
      if (!targetSet.has(ev.resonatorId)) {
        throw new Error(
          `Extra evaluation record for character '${ev.resonatorId}' not present in requested target characters.`
        );
      }
    }
  }

  if (input?.interactionProfiles) {
    for (const prof of profiles) {
      if (!targetSet.has(prof.characterId)) {
        throw new Error(
          `Extra interaction profile record for character '${prof.characterId}' not present in requested target characters.`
        );
      }
    }
  }

  const contexts: CharacterDecisionContext[] = [];

  for (const charId of targetCharacterIds) {
    const ev = evalMap.get(charId);
    if (!ev) {
      throw new Error(`Missing Step 16 evaluation for character '${charId}'.`);
    }

    const prof = profileMap.get(charId);
    if (!prof) {
      throw new Error(`Missing Step 18 interaction profile for character '${charId}'.`);
    }

    const context = buildCharacterDecisionContext(ev, prof, patchId);
    contexts.push(context);
  }

  // Sort deterministically
  contexts.sort(compareCharacterDecisionContexts);
  const frozenContexts = Object.freeze(contexts);

  // Compute aggregate summary counts
  let totalEvaluated = 0;
  let totalPartiallyEvaluated = 0;
  let totalInvestmentUnknown = 0;
  let totalWithOutgoingInteractions = 0;
  let totalWithIncomingInteractions = 0;
  let totalUnderlyingInteractions = 0;

  for (const ctx of frozenContexts) {
    if (ctx.summary.evaluationStatus === 'EVALUATED') totalEvaluated++;
    if (ctx.summary.evaluationStatus === 'PARTIALLY_EVALUATED') totalPartiallyEvaluated++;
    if (ctx.summary.evaluationStatus === 'INVESTMENT_UNKNOWN') totalInvestmentUnknown++;
    if (ctx.summary.outgoingInteractionCount > 0) totalWithOutgoingInteractions++;
    if (ctx.summary.incomingInteractionCount > 0) totalWithIncomingInteractions++;
    totalUnderlyingInteractions += ctx.summary.outgoingInteractionCount;
  }

  const resultSummary: CharacterDecisionContextResultSummary = Object.freeze({
    totalContexts: frozenContexts.length,
    totalEvaluated,
    totalPartiallyEvaluated,
    totalInvestmentUnknown,
    totalWithOutgoingInteractions,
    totalWithIncomingInteractions,
    totalUnderlyingInteractions
  });

  const audit: CharacterDecisionContextAuditMetrics = Object.freeze({
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_DECISION_CONTEXT_RULE_VERSION,
    totalContexts: frozenContexts.length,
    uniqueCharacterIds: frozenContexts.length,
    canonicalResonatorCoverage: frozenContexts.length,
    evaluationsMatched: frozenContexts.length,
    profilesMatched: frozenContexts.length,
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });

  return Object.freeze({
    patchId: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_DECISION_CONTEXT_RULE_VERSION,
    contexts: frozenContexts,
    summary: resultSummary,
    audit
  });
}
