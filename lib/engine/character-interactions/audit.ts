/**
 * Wuthering Waves Character Relationship & Interaction Production Auditor
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 *
 * Implements strict invariant auditing and forbidden property rejection.
 */

import { CHARACTER_INTERACTION_RULE_VERSION } from './rules.ts';
import {
  deriveConditionKey,
  deriveCharacterInteractionId,
  compareCharacterInteractionEvidence
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import type {
  CharacterInteractionEvidence,
  CharacterInteractionCompositionResult
} from './types.ts';

const PROHIBITED_KEYS = [
  'characterPower',
  'combatPower',
  'dps',
  'DPS',
  'damage',
  'rotationDps',
  'teamScore',
  'teamPower',
  'team',
  'optimalBuild',
  'rank',
  'toaScore',
  'vigorCost',
  'role',
  'metaRank',
  'metaScore',
  'tier',
  'tierList',
  'synergyScore',
  'relationshipScore',
  'characterScore'
];

/**
 * Asserts that no prohibited scoring, optimization, or meta keys exist on the record.
 */
export function assertNoProhibitedCharacterInteractionKeys(obj: unknown, path = 'interaction'): void {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    if (PROHIBITED_KEYS.includes(key)) {
      throw new Error(`Prohibited property '${key}' detected at ${path}.${key}. Step 17 forbids scoring, ranking, meta, and DPS.`);
    }
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      assertNoProhibitedCharacterInteractionKeys(val, `${path}.${key}`);
    }
  }
}

/**
 * Rigorous production auditor validating all Step 17 invariants.
 */
export function auditCharacterInteractions(result: CharacterInteractionCompositionResult): void {
  if (!result) {
    throw new Error('Audit failed: composition result is null or undefined.');
  }

  // Invariant A: Patch isolation
  if (result.patchId !== '3.7') {
    throw new Error(`Invariant A failure: patchId is '${result.patchId}'. Expected '3.7'.`);
  }

  // Invariant B: Rule version
  if (result.ruleVersion !== CHARACTER_INTERACTION_RULE_VERSION) {
    throw new Error(`Invariant B failure: ruleVersion is '${result.ruleVersion}'. Expected '${CHARACTER_INTERACTION_RULE_VERSION}'.`);
  }

  const seenIds = new Set<string>();
  let countAuth = 0;
  let countUnk = 0;
  let countUnm = 0;
  let countNotApp = 0;
  let countConf = 0;

  for (let i = 0; i < result.interactions.length; i++) {
    const item = result.interactions[i];
    const path = `interactions[${i}]`;

    assertNoProhibitedCharacterInteractionKeys(item, path);

    // Invariant C: Patch version on item
    if (item.patchVersion !== '3.7') {
      throw new Error(`Invariant C failure: patchVersion is '${item.patchVersion}' at ${path}.`);
    }

    // Invariant D: Rule version on item
    if (item.ruleVersion !== CHARACTER_INTERACTION_RULE_VERSION) {
      throw new Error(`Invariant D failure: ruleVersion is '${item.ruleVersion}' at ${path}.`);
    }

    // Invariant E: Canonical character references
    if (!isCanonicalResonatorId(item.sourceCharacterId)) {
      throw new Error(`Invariant E failure: sourceCharacterId '${item.sourceCharacterId}' is not canonical at ${path}.`);
    }
    if (!isCanonicalResonatorId(item.targetCharacterId)) {
      throw new Error(`Invariant E failure: targetCharacterId '${item.targetCharacterId}' is not canonical at ${path}.`);
    }

    // Invariant F: Self-interaction rule (A -> A rejected)
    if (item.sourceCharacterId === item.targetCharacterId) {
      throw new Error(`Invariant F failure: self-interaction '${item.sourceCharacterId} -> ${item.targetCharacterId}' detected at ${path}.`);
    }

    // Invariant G: Deterministic ID format
    const condKey = deriveConditionKey(item.condition);
    const expectedId = deriveCharacterInteractionId(
      item.sourceCharacterId,
      item.targetCharacterId,
      item.interactionType,
      condKey,
      CHARACTER_INTERACTION_RULE_VERSION
    );
    if (item.id !== expectedId) {
      throw new Error(`Invariant G failure: malformed ID '${item.id}' at ${path}. Expected '${expectedId}'.`);
    }

    // Invariant H: Unique IDs
    if (seenIds.has(item.id)) {
      throw new Error(`Invariant H failure: duplicate interaction ID '${item.id}' at ${path}.`);
    }
    seenIds.add(item.id);

    // Invariant I: Valid Provenance
    if (!item.provenance || item.provenance.patchVersion !== '3.7' || !item.provenance.sourceProvenance) {
      throw new Error(`Invariant I failure: invalid or missing provenance at ${path}.`);
    }

    // Count status
    if (item.evidenceStatus === 'AUTHORITATIVE') countAuth++;
    else if (item.evidenceStatus === 'UNKNOWN') countUnk++;
    else if (item.evidenceStatus === 'UNMODELED') countUnm++;
    else if (item.evidenceStatus === 'NOT_APPLICABLE') countNotApp++;
    else if (item.evidenceStatus === 'CONFLICTED') countConf++;
  }

  // Invariant J: Total ordering check
  for (let i = 0; i < result.interactions.length - 1; i++) {
    const cmp = compareCharacterInteractionEvidence(result.interactions[i], result.interactions[i + 1]);
    if (cmp > 0) {
      throw new Error(`Invariant J failure: out-of-order interaction records at indices ${i} and ${i + 1}.`);
    }
  }

  // Invariant K: Summary accounting reconciliation
  if (result.summary.total !== result.interactions.length) {
    throw new Error(`Invariant K failure: summary total ${result.summary.total} !== actual length ${result.interactions.length}.`);
  }
  if (result.summary.authoritative !== countAuth) {
    throw new Error(`Invariant K failure: summary authoritative ${result.summary.authoritative} !== actual ${countAuth}.`);
  }
  if (result.summary.unknown !== countUnk) {
    throw new Error(`Invariant K failure: summary unknown ${result.summary.unknown} !== actual ${countUnk}.`);
  }
  if (result.summary.unmodeled !== countUnm) {
    throw new Error(`Invariant K failure: summary unmodeled ${result.summary.unmodeled} !== actual ${countUnm}.`);
  }
  if (result.summary.notApplicable !== countNotApp) {
    throw new Error(`Invariant K failure: summary notApplicable ${result.summary.notApplicable} !== actual ${countNotApp}.`);
  }
  if (result.summary.conflicted !== countConf) {
    throw new Error(`Invariant K failure: summary conflicted ${result.summary.conflicted} !== actual ${countConf}.`);
  }
}
