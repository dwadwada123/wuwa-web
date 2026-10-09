/**
 * Wuthering Waves Character Interaction Profile Production Auditor
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 *
 * Implements strict invariant auditing and forbidden property rejection.
 */

import {
  CHARACTER_INTERACTION_PROFILE_RULE_VERSION,
  PROHIBITED_PROFILE_KEYS
} from './rules.ts';
import {
  deriveCharacterProfileId,
  compareCharacterInteractionProfiles
} from './predicates.ts';
import {
  compareCharacterInteractionEvidence
} from '../character-interactions/predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import type {
  CharacterInteractionProfile,
  CharacterInteractionProfileAggregationResult
} from './types.ts';

/**
 * Asserts that no prohibited scoring, optimization, or meta keys exist on the record.
 */
export function assertNoProhibitedCharacterProfileKeys(obj: unknown, path = 'profile'): void {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    if (PROHIBITED_PROFILE_KEYS.includes(key)) {
      throw new Error(`Prohibited property '${key}' detected at ${path}.${key}. Step 18 forbids scoring, ranking, meta, and DPS.`);
    }
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      assertNoProhibitedCharacterProfileKeys(val, `${path}.${key}`);
    }
  }
}

/**
 * Rigorous production auditor validating all Step 18 invariants.
 */
export function auditCharacterInteractionProfiles(
  result: CharacterInteractionProfileAggregationResult
): void {
  if (!result) {
    throw new Error('Audit failed: aggregation result is null or undefined.');
  }

  assertNoProhibitedCharacterProfileKeys(result, 'aggregationResult');

  // Invariant A: Patch isolation
  if (result.patchId !== '3.7') {
    throw new Error(`Invariant A failure: patchId is '${result.patchId}'. Expected '3.7'.`);
  }

  // Invariant B: Rule version
  if (result.ruleVersion !== CHARACTER_INTERACTION_PROFILE_RULE_VERSION) {
    throw new Error(`Invariant B failure: ruleVersion is '${result.ruleVersion}'. Expected '${CHARACTER_INTERACTION_PROFILE_RULE_VERSION}'.`);
  }

  const seenProfileIds = new Set<string>();
  const seenCharacterIds = new Set<string>();
  let sumOutgoing = 0;
  let sumIncoming = 0;
  let activeOutgoingChars = 0;
  let activeIncomingChars = 0;

  for (let i = 0; i < result.profiles.length; i++) {
    const profile = result.profiles[i];
    const path = `profiles[${i}]`;

    assertNoProhibitedCharacterProfileKeys(profile, path);

    // Invariant C: Patch version on profile
    if (profile.patchVersion !== '3.7') {
      throw new Error(`Invariant C failure: patchVersion is '${profile.patchVersion}' at ${path}.`);
    }

    // Invariant D: Rule version on profile
    if (profile.ruleVersion !== CHARACTER_INTERACTION_PROFILE_RULE_VERSION) {
      throw new Error(`Invariant D failure: ruleVersion is '${profile.ruleVersion}' at ${path}.`);
    }

    // Invariant E: Canonical character reference
    if (!isCanonicalResonatorId(profile.characterId)) {
      throw new Error(`Invariant E failure: characterId '${profile.characterId}' is not canonical at ${path}.`);
    }

    if (seenCharacterIds.has(profile.characterId)) {
      throw new Error(`Invariant E failure: duplicate characterId '${profile.characterId}' at ${path}.`);
    }
    seenCharacterIds.add(profile.characterId);

    // Invariant F: Deterministic ID format
    const expectedId = deriveCharacterProfileId(profile.characterId, '3.7', CHARACTER_INTERACTION_PROFILE_RULE_VERSION);
    if (profile.id !== expectedId) {
      throw new Error(`Invariant F failure: malformed ID '${profile.id}' at ${path}. Expected '${expectedId}'.`);
    }

    // Invariant G: Unique profile IDs
    if (seenProfileIds.has(profile.id)) {
      throw new Error(`Invariant G failure: duplicate profile ID '${profile.id}' at ${path}.`);
    }
    seenProfileIds.add(profile.id);

    // Invariant H: Outgoing edge directionality & validation
    let outAuth = 0;
    let outUnk = 0;
    let outUnm = 0;
    let outNotApp = 0;
    let outConf = 0;
    const distinctTargets = new Set<string>();

    for (let j = 0; j < profile.outgoing.length; j++) {
      const edge = profile.outgoing[j];
      const edgePath = `${path}.outgoing[${j}]`;

      if (edge.sourceCharacterId !== profile.characterId) {
        throw new Error(`Invariant H failure: outgoing edge source '${edge.sourceCharacterId}' !== '${profile.characterId}' at ${edgePath}.`);
      }
      if (edge.targetCharacterId === profile.characterId) {
        throw new Error(`Invariant H failure: self-interaction detected at ${edgePath}.`);
      }
      if (edge.patchVersion !== '3.7' || edge.ruleVersion !== '7.17.1') {
        throw new Error(`Invariant H failure: invalid patch/rule version on edge at ${edgePath}.`);
      }

      distinctTargets.add(edge.targetCharacterId);
      if (edge.evidenceStatus === 'AUTHORITATIVE') outAuth++;
      else if (edge.evidenceStatus === 'UNKNOWN') outUnk++;
      else if (edge.evidenceStatus === 'UNMODELED') outUnm++;
      else if (edge.evidenceStatus === 'NOT_APPLICABLE') outNotApp++;
      else if (edge.evidenceStatus === 'CONFLICTED') outConf++;

      // Check edge ordering
      if (j > 0) {
        const cmp = compareCharacterInteractionEvidence(profile.outgoing[j - 1], edge);
        if (cmp > 0) {
          throw new Error(`Invariant H failure: out-of-order outgoing edges at indices ${j - 1} and ${j} in ${path}.`);
        }
      }
    }

    // Invariant I: Incoming edge directionality & validation
    let inAuth = 0;
    let inUnk = 0;
    let inUnm = 0;
    let inNotApp = 0;
    let inConf = 0;
    const distinctSources = new Set<string>();

    for (let j = 0; j < profile.incoming.length; j++) {
      const edge = profile.incoming[j];
      const edgePath = `${path}.incoming[${j}]`;

      if (edge.targetCharacterId !== profile.characterId) {
        throw new Error(`Invariant I failure: incoming edge target '${edge.targetCharacterId}' !== '${profile.characterId}' at ${edgePath}.`);
      }
      if (edge.sourceCharacterId === profile.characterId) {
        throw new Error(`Invariant I failure: self-interaction detected at ${edgePath}.`);
      }
      if (edge.patchVersion !== '3.7' || edge.ruleVersion !== '7.17.1') {
        throw new Error(`Invariant I failure: invalid patch/rule version on edge at ${edgePath}.`);
      }

      distinctSources.add(edge.sourceCharacterId);
      if (edge.evidenceStatus === 'AUTHORITATIVE') inAuth++;
      else if (edge.evidenceStatus === 'UNKNOWN') inUnk++;
      else if (edge.evidenceStatus === 'UNMODELED') inUnm++;
      else if (edge.evidenceStatus === 'NOT_APPLICABLE') inNotApp++;
      else if (edge.evidenceStatus === 'CONFLICTED') inConf++;

      // Check edge ordering
      if (j > 0) {
        const cmp = compareCharacterInteractionEvidence(profile.incoming[j - 1], edge);
        if (cmp > 0) {
          throw new Error(`Invariant I failure: out-of-order incoming edges at indices ${j - 1} and ${j} in ${path}.`);
        }
      }
    }

    // Invariant J: Profile summary reconciliation
    const s = profile.summary;
    if (s.outgoingTotal !== profile.outgoing.length) {
      throw new Error(`Invariant J failure: outgoingTotal ${s.outgoingTotal} !== ${profile.outgoing.length} at ${path}.`);
    }
    if (s.incomingTotal !== profile.incoming.length) {
      throw new Error(`Invariant J failure: incomingTotal ${s.incomingTotal} !== ${profile.incoming.length} at ${path}.`);
    }
    if (s.outgoingAuthoritative !== outAuth) {
      throw new Error(`Invariant J failure: outgoingAuthoritative mismatch at ${path}.`);
    }
    if (s.incomingAuthoritative !== inAuth) {
      throw new Error(`Invariant J failure: incomingAuthoritative mismatch at ${path}.`);
    }
    if (s.outgoingUnknown !== outUnk) {
      throw new Error(`Invariant J failure: outgoingUnknown mismatch at ${path}.`);
    }
    if (s.incomingUnknown !== inUnk) {
      throw new Error(`Invariant J failure: incomingUnknown mismatch at ${path}.`);
    }
    if (s.outgoingUnmodeled !== outUnm) {
      throw new Error(`Invariant J failure: outgoingUnmodeled mismatch at ${path}.`);
    }
    if (s.incomingUnmodeled !== inUnm) {
      throw new Error(`Invariant J failure: incomingUnmodeled mismatch at ${path}.`);
    }
    if (s.outgoingNotApplicable !== outNotApp) {
      throw new Error(`Invariant J failure: outgoingNotApplicable mismatch at ${path}.`);
    }
    if (s.incomingNotApplicable !== inNotApp) {
      throw new Error(`Invariant J failure: incomingNotApplicable mismatch at ${path}.`);
    }
    if (s.outgoingConflicted !== outConf) {
      throw new Error(`Invariant J failure: outgoingConflicted mismatch at ${path}.`);
    }
    if (s.incomingConflicted !== inConf) {
      throw new Error(`Invariant J failure: incomingConflicted mismatch at ${path}.`);
    }
    if (s.distinctOutgoingTargets !== distinctTargets.size) {
      throw new Error(`Invariant J failure: distinctOutgoingTargets mismatch at ${path}.`);
    }
    if (s.distinctIncomingSources !== distinctSources.size) {
      throw new Error(`Invariant J failure: distinctIncomingSources mismatch at ${path}.`);
    }

    sumOutgoing += profile.outgoing.length;
    sumIncoming += profile.incoming.length;
    if (profile.outgoing.length > 0) activeOutgoingChars++;
    if (profile.incoming.length > 0) activeIncomingChars++;

    // Check profile ordering
    if (i > 0) {
      const cmp = compareCharacterInteractionProfiles(result.profiles[i - 1], profile);
      if (cmp > 0) {
        throw new Error(`Invariant K failure: out-of-order profiles at indices ${i - 1} and ${i}.`);
      }
    }
  }

  // Invariant L: Overall summary reconciliation
  if (result.summary.totalProfiles !== result.profiles.length) {
    throw new Error(`Invariant L failure: totalProfiles mismatch.`);
  }
  if (result.summary.totalOutgoingIndexed !== sumOutgoing) {
    throw new Error(`Invariant L failure: totalOutgoingIndexed mismatch.`);
  }
  if (result.summary.totalIncomingIndexed !== sumIncoming) {
    throw new Error(`Invariant L failure: totalIncomingIndexed mismatch.`);
  }
  if (result.summary.charactersWithOutgoing !== activeOutgoingChars) {
    throw new Error(`Invariant L failure: charactersWithOutgoing mismatch.`);
  }
  if (result.summary.charactersWithIncoming !== activeIncomingChars) {
    throw new Error(`Invariant L failure: charactersWithIncoming mismatch.`);
  }
}
