/**
 * Wuthering Waves Character Decision Context Production Auditor
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Implements strict runtime validation and audit checks for CharacterDecisionContext
 * records, enforcing boundary safety, prohibited key exclusion, and epistemic fidelity.
 */

import {
  CHARACTER_DECISION_CONTEXT_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP16_RULE_VERSION,
  REQUIRED_STEP18_RULE_VERSION,
  PROHIBITED_DECISION_CONTEXT_KEYS,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  compareCharacterDecisionContexts,
  deriveCharacterDecisionContextId
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getCharacterDecisionContextResult } from './repository.ts';
import type {
  CharacterDecisionContext,
  CharacterDecisionContextResult
} from './types.ts';

/**
 * Normalizes a key name for prohibited key comparison by removing
 * hyphens, underscores, and whitespace, and converting to lowercase.
 */
export function normalizeProhibitedKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

const NORMALIZED_PROHIBITED_DECISION_CONTEXT_KEYS = new Set(
  PROHIBITED_DECISION_CONTEXT_KEYS.map((k) => normalizeProhibitedKey(k))
);

/**
 * Asserts that no prohibited keys (e.g. characterPower, dps, metaRank, teamScore, team_score)
 * appear anywhere in a record tree.
 */
export function assertNoProhibitedDecisionContextKeys(record: unknown, path: string = 'root'): void {
  if (record === null || record === undefined) return;
  if (typeof record !== 'object') return;

  if (Array.isArray(record)) {
    for (let i = 0; i < record.length; i++) {
      assertNoProhibitedDecisionContextKeys(record[i], `${path}[${i}]`);
    }
    return;
  }

  const obj = record as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const normalized = normalizeProhibitedKey(key);
    if (NORMALIZED_PROHIBITED_DECISION_CONTEXT_KEYS.has(normalized)) {
      throw new Error(
        `Prohibited key '${key}' detected at '${path}.${key}'. Violates Step 19 boundary isolation.`
      );
    }
    assertNoProhibitedDecisionContextKeys(obj[key], `${path}.${key}`);
  }
}

/**
 * Strictly audits a single CharacterDecisionContext record.
 */
export function auditSingleCharacterDecisionContext(
  context: CharacterDecisionContext,
  expectedIndex?: number
): void {
  const prefix = `Context[${context.characterId}]`;

  // Invariant A: Patch version isolation
  if (context.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`${prefix}: Invalid patchVersion '${context.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`);
  }

  // Invariant B: Step 19 Rule version
  if (context.ruleVersion !== CHARACTER_DECISION_CONTEXT_RULE_VERSION) {
    throw new Error(`${prefix}: Invalid ruleVersion '${context.ruleVersion}'. Expected '${CHARACTER_DECISION_CONTEXT_RULE_VERSION}'.`);
  }

  // Invariant C: Canonical Resonator identity
  if (!isCanonicalResonatorId(context.characterId)) {
    throw new Error(`${prefix}: Non-canonical characterId '${context.characterId}'.`);
  }

  // Invariant D: Deterministic ID derivation
  const expectedId = deriveCharacterDecisionContextId(
    context.characterId,
    CANONICAL_PATCH_VERSION,
    CHARACTER_DECISION_CONTEXT_RULE_VERSION
  );
  if (context.id !== expectedId) {
    throw new Error(`${prefix}: ID mismatch. Expected '${expectedId}', got '${context.id}'.`);
  }

  // Invariant E: Step 16 Evaluation integrity
  const ev = context.evaluation;
  if (!ev) {
    throw new Error(`${prefix}: Missing Step 16 evaluation.`);
  }
  if (ev.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`${prefix}: Evaluation patchVersion mismatch '${ev.patchVersion}'.`);
  }
  if (ev.ruleVersion !== REQUIRED_STEP16_RULE_VERSION) {
    throw new Error(`${prefix}: Evaluation ruleVersion mismatch '${ev.ruleVersion}'. Expected '${REQUIRED_STEP16_RULE_VERSION}'.`);
  }
  if (ev.resonatorId !== context.characterId) {
    throw new Error(`${prefix}: Evaluation resonatorId '${ev.resonatorId}' does not match characterId '${context.characterId}'.`);
  }

  // Invariant F: Step 18 Interaction Profile integrity
  const prof = context.interactionProfile;
  if (!prof) {
    throw new Error(`${prefix}: Missing Step 18 interaction profile.`);
  }
  if (prof.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`${prefix}: Profile patchVersion mismatch '${prof.patchVersion}'.`);
  }
  if (prof.ruleVersion !== REQUIRED_STEP18_RULE_VERSION) {
    throw new Error(`${prefix}: Profile ruleVersion mismatch '${prof.ruleVersion}'. Expected '${REQUIRED_STEP18_RULE_VERSION}'.`);
  }
  if (prof.characterId !== context.characterId) {
    throw new Error(`${prefix}: Profile characterId '${prof.characterId}' does not match characterId '${context.characterId}'.`);
  }

  // Invariant G: Summary count reconciliation
  const s = context.summary;
  if (!s.hasEvaluation) {
    throw new Error(`${prefix}: Summary hasEvaluation must be true.`);
  }
  if (s.evaluationStatus !== ev.status) {
    throw new Error(`${prefix}: Summary evaluationStatus '${s.evaluationStatus}' mismatch with evaluation.status '${ev.status}'.`);
  }
  if (s.evaluationScore !== ev.evaluationScore) {
    throw new Error(`${prefix}: Summary evaluationScore mismatch with evaluation.evaluationScore.`);
  }
  if (s.outgoingInteractionCount !== prof.summary.outgoingTotal) {
    throw new Error(`${prefix}: Summary outgoingInteractionCount mismatch with profile outgoingTotal.`);
  }
  if (s.incomingInteractionCount !== prof.summary.incomingTotal) {
    throw new Error(`${prefix}: Summary incomingInteractionCount mismatch with profile incomingTotal.`);
  }
  if (s.authoritativeOutgoingCount !== prof.summary.outgoingAuthoritative) {
    throw new Error(`${prefix}: Summary authoritativeOutgoingCount mismatch.`);
  }
  if (s.authoritativeIncomingCount !== prof.summary.incomingAuthoritative) {
    throw new Error(`${prefix}: Summary authoritativeIncomingCount mismatch.`);
  }
  if (s.unknownOutgoingCount !== prof.summary.outgoingUnknown) {
    throw new Error(`${prefix}: Summary unknownOutgoingCount mismatch.`);
  }
  if (s.unknownIncomingCount !== prof.summary.incomingUnknown) {
    throw new Error(`${prefix}: Summary unknownIncomingCount mismatch.`);
  }
  if (s.unmodeledOutgoingCount !== prof.summary.outgoingUnmodeled) {
    throw new Error(`${prefix}: Summary unmodeledOutgoingCount mismatch.`);
  }
  if (s.unmodeledIncomingCount !== prof.summary.incomingUnmodeled) {
    throw new Error(`${prefix}: Summary unmodeledIncomingCount mismatch.`);
  }
  if (s.conflictedOutgoingCount !== prof.summary.outgoingConflicted) {
    throw new Error(`${prefix}: Summary conflictedOutgoingCount mismatch.`);
  }
  if (s.conflictedIncomingCount !== prof.summary.incomingConflicted) {
    throw new Error(`${prefix}: Summary conflictedIncomingCount mismatch.`);
  }
  if (s.distinctOutgoingTargets !== prof.summary.distinctOutgoingTargets) {
    throw new Error(`${prefix}: Summary distinctOutgoingTargets mismatch.`);
  }
  if (s.distinctIncomingSources !== prof.summary.distinctIncomingSources) {
    throw new Error(`${prefix}: Summary distinctIncomingSources mismatch.`);
  }

  // Invariant H: Immutability
  if (!Object.isFrozen(context)) {
    throw new Error(`${prefix}: Context object must be frozen.`);
  }
  if (!Object.isFrozen(context.summary)) {
    throw new Error(`${prefix}: Context summary must be frozen.`);
  }
  if (!Object.isFrozen(context.provenance)) {
    throw new Error(`${prefix}: Context provenance must be frozen.`);
  }

  // Invariant I: Prohibited keys
  assertNoProhibitedDecisionContextKeys(context, prefix);
}

/**
 * Audits a complete CharacterDecisionContextResult collection against all production invariants.
 */
export function auditCharacterDecisionContexts(result: CharacterDecisionContextResult): void {
  if (!result) {
    throw new Error('Audit failed: result is null or undefined.');
  }

  if (result.patchId !== CANONICAL_PATCH_VERSION) {
    throw new Error(`Audit failed: patchId '${result.patchId}' must be strictly '${CANONICAL_PATCH_VERSION}'.`);
  }

  if (result.ruleVersion !== CHARACTER_DECISION_CONTEXT_RULE_VERSION) {
    throw new Error(`Audit failed: ruleVersion '${result.ruleVersion}' must be strictly '${CHARACTER_DECISION_CONTEXT_RULE_VERSION}'.`);
  }

  if (!Object.isFrozen(result)) {
    throw new Error('Audit failed: Result container must be frozen.');
  }
  if (!Object.isFrozen(result.contexts)) {
    throw new Error('Audit failed: Result contexts array must be frozen.');
  }
  if (!Object.isFrozen(result.summary)) {
    throw new Error('Audit failed: Result summary must be frozen.');
  }
  if (!Object.isFrozen(result.audit)) {
    throw new Error('Audit failed: Result audit metrics must be frozen.');
  }

  const seenIds = new Set<string>();
  const contexts = result.contexts;

  let totalEvaluated = 0;
  let totalPartiallyEvaluated = 0;
  let totalInvestmentUnknown = 0;
  let totalWithOutgoingInteractions = 0;
  let totalWithIncomingInteractions = 0;
  let totalUnderlyingInteractions = 0;

  for (let i = 0; i < contexts.length; i++) {
    const ctx = contexts[i];
    auditSingleCharacterDecisionContext(ctx, i);

    if (seenIds.has(ctx.characterId)) {
      throw new Error(`Audit failed: Duplicate characterId '${ctx.characterId}' in contexts list.`);
    }
    seenIds.add(ctx.characterId);

    if (i > 0) {
      const prev = contexts[i - 1];
      if (compareCharacterDecisionContexts(prev, ctx) >= 0) {
        throw new Error(
          `Audit failed: Contexts out of canonical deterministic order at index ${i}: '${prev.characterId}' >= '${ctx.characterId}'.`
        );
      }
    }

    if (ctx.summary.evaluationStatus === 'EVALUATED') totalEvaluated++;
    if (ctx.summary.evaluationStatus === 'PARTIALLY_EVALUATED') totalPartiallyEvaluated++;
    if (ctx.summary.evaluationStatus === 'INVESTMENT_UNKNOWN') totalInvestmentUnknown++;
    if (ctx.summary.outgoingInteractionCount > 0) totalWithOutgoingInteractions++;
    if (ctx.summary.incomingInteractionCount > 0) totalWithIncomingInteractions++;
    totalUnderlyingInteractions += ctx.summary.outgoingInteractionCount;
  }

  // Summary count verification
  const s = result.summary;
  if (s.totalContexts !== contexts.length) {
    throw new Error(`Audit failed: summary totalContexts (${s.totalContexts}) !== contexts.length (${contexts.length}).`);
  }
  if (s.totalEvaluated !== totalEvaluated) {
    throw new Error(`Audit failed: summary totalEvaluated mismatch.`);
  }
  if (s.totalPartiallyEvaluated !== totalPartiallyEvaluated) {
    throw new Error(`Audit failed: summary totalPartiallyEvaluated mismatch.`);
  }
  if (s.totalInvestmentUnknown !== totalInvestmentUnknown) {
    throw new Error(`Audit failed: summary totalInvestmentUnknown mismatch.`);
  }
  if (s.totalWithOutgoingInteractions !== totalWithOutgoingInteractions) {
    throw new Error(`Audit failed: summary totalWithOutgoingInteractions mismatch.`);
  }
  if (s.totalWithIncomingInteractions !== totalWithIncomingInteractions) {
    throw new Error(`Audit failed: summary totalWithIncomingInteractions mismatch.`);
  }
  if (s.totalUnderlyingInteractions !== totalUnderlyingInteractions) {
    throw new Error(`Audit failed: summary totalUnderlyingInteractions mismatch.`);
  }

  // Audit metrics verification
  const a = result.audit;
  if (a.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`Audit failed: audit patchVersion mismatch.`);
  }
  if (a.ruleVersion !== CHARACTER_DECISION_CONTEXT_RULE_VERSION) {
    throw new Error(`Audit failed: audit ruleVersion mismatch.`);
  }
  if (a.totalContexts !== contexts.length) {
    throw new Error(`Audit failed: audit totalContexts mismatch.`);
  }
  if (a.uniqueCharacterIds !== contexts.length) {
    throw new Error(`Audit failed: audit uniqueCharacterIds mismatch.`);
  }
  if (a.evaluationsMatched !== contexts.length) {
    throw new Error(`Audit failed: audit evaluationsMatched mismatch.`);
  }
  if (a.profilesMatched !== contexts.length) {
    throw new Error(`Audit failed: audit profilesMatched mismatch.`);
  }
  if (a.verifiedAt !== OFFLINE_DETERMINISTIC_AUDIT_STAMP) {
    throw new Error(`Audit failed: audit verifiedAt must be '${OFFLINE_DETERMINISTIC_AUDIT_STAMP}'.`);
  }

  // Tree-wide prohibited key assertion
  assertNoProhibitedDecisionContextKeys(result, 'result');
}

/**
 * Runs a complete production audit on default canonical Patch 3.7 contexts.
 */
export function runProductionCharacterDecisionContextAudit(): CharacterDecisionContextResult {
  const result = getCharacterDecisionContextResult();
  auditCharacterDecisionContexts(result);
  return result;
}
