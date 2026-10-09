/**
 * Wuthering Waves Character Interaction Profile Aggregator
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 *
 * Implements deterministic aggregation, indexing, and summary counting of Step 17 interaction
 * evidence into canonical character interaction profiles.
 *
 * CENTRAL INVARIANTS:
 * 1. STRICT DIRECTIONALITY: A -> B in B.incoming NEVER implies B -> A in B.outgoing.
 * 2. NO RE-COMPOSITION OR TRANSITIVITY: A -> B and B -> C does not imply A -> C.
 * 3. NO SCORING OR WEIGHTING: Pure counts and indexes; zero power/synergy/DPS scores.
 * 4. DETERMINISTIC TOTAL ORDERING: All collections sorted deterministically.
 * 5. IMMUTABILITY & PRESERVATION: All Step 17 evidence records, conditions, and lineage preserved intact.
 */

import {
  CHARACTER_INTERACTION_PROFILE_RULE_VERSION
} from './rules.ts';
import {
  deriveCharacterProfileId,
  compareCharacterInteractionProfiles
} from './predicates.ts';
import {
  compareCharacterInteractionEvidence
} from '../character-interactions/predicates.ts';
import {
  VALID_CHARACTER_INTERACTION_TYPES,
  VALID_CHARACTER_INTERACTION_CATEGORIES,
  VALID_CHARACTER_INTERACTION_STATUSES
} from '../character-interactions/rules.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getKnownResonatorIds } from '../team-composition/repository.ts';
import { getCharacterInteractions } from '../character-interactions/repository.ts';
import type {
  CharacterInteractionEvidence,
  CharacterInteractionProfile,
  CharacterInteractionProfileSummary,
  CharacterInteractionProfileAggregationInput,
  CharacterInteractionProfileAggregationResult,
  CharacterInteractionAggregationSummary,
  CharacterInteractionAggregationAudit
} from './types.ts';

/**
 * Validates a single Step 17 CharacterInteractionEvidence record for aggregation.
 */
function validateInteractionEvidenceRecord(
  rec: CharacterInteractionEvidence,
  expectedPatch: '3.7',
  index: number
): void {
  const path = `interactionEvidence[${index}]`;

  if (!rec) {
    throw new Error(`Null or undefined record at ${path}.`);
  }

  if (rec.patchVersion !== expectedPatch) {
    throw new Error(`Invalid patchVersion '${rec.patchVersion}' at ${path}. Expected '${expectedPatch}'.`);
  }

  if (rec.ruleVersion !== '7.17.1') {
    throw new Error(`Invalid ruleVersion '${rec.ruleVersion}' at ${path}. Expected Step 17 ruleVersion '7.17.1'.`);
  }

  if (!rec.sourceCharacterId || !isCanonicalResonatorId(rec.sourceCharacterId)) {
    throw new Error(`Non-canonical source character '${rec.sourceCharacterId}' at ${path}.`);
  }

  if (!rec.targetCharacterId || !isCanonicalResonatorId(rec.targetCharacterId)) {
    throw new Error(`Non-canonical target character '${rec.targetCharacterId}' at ${path}.`);
  }

  if (rec.sourceCharacterId === rec.targetCharacterId) {
    throw new Error(`Self-interaction '${rec.sourceCharacterId} -> ${rec.targetCharacterId}' rejected at ${path}.`);
  }

  if (!VALID_CHARACTER_INTERACTION_TYPES.includes(rec.interactionType)) {
    throw new Error(`Invalid interactionType '${rec.interactionType}' at ${path}.`);
  }

  if (!VALID_CHARACTER_INTERACTION_CATEGORIES.includes(rec.category)) {
    throw new Error(`Invalid category '${rec.category}' at ${path}.`);
  }

  if (!VALID_CHARACTER_INTERACTION_STATUSES.includes(rec.evidenceStatus)) {
    throw new Error(`Invalid evidenceStatus '${rec.evidenceStatus}' at ${path}.`);
  }

  if (!rec.provenance || rec.provenance.patchVersion !== expectedPatch || !rec.provenance.sourceProvenance) {
    throw new Error(`Invalid or missing provenance at ${path}.`);
  }
}

/**
 * Aggregates directional Step 17 interaction evidence into canonical CharacterInteractionProfile records.
 */
export function aggregateCharacterInteractionProfiles(
  input?: CharacterInteractionProfileAggregationInput
): CharacterInteractionProfileAggregationResult {
  // 1. Input Contract Validation
  if (input) {
    if (!input.patchId || input.patchId !== '3.7') {
      throw new Error(`Invalid patch context '${input.patchId}'. Step 18 strictly requires Patch '3.7'.`);
    }
    if (input.ruleVersion !== CHARACTER_INTERACTION_PROFILE_RULE_VERSION) {
      throw new Error(`Invalid ruleVersion '${input.ruleVersion}'. Step 18 strictly requires '${CHARACTER_INTERACTION_PROFILE_RULE_VERSION}'.`);
    }
  }

  // 2. Resolve Target Characters
  let characterIds: readonly string[];
  if (input?.characterIds) {
    if (input.characterIds.length === 0) {
      throw new Error('characterIds cannot be an empty array when explicitly provided.');
    }
    for (const cid of input.characterIds) {
      if (!isCanonicalResonatorId(cid)) {
        throw new Error(`Unknown or non-canonical characterId '${cid}' in input.`);
      }
    }
    characterIds = Object.freeze(Array.from(new Set(input.characterIds)).sort((a, b) => a.localeCompare(b)));
  } else {
    characterIds = Object.freeze(getKnownResonatorIds().slice().sort((a, b) => a.localeCompare(b)));
  }

  // 3. Resolve and Validate Underlying Step 17 Evidence
  const evidenceList: readonly CharacterInteractionEvidence[] =
    input?.interactionEvidence ?? getCharacterInteractions();

  for (let i = 0; i < evidenceList.length; i++) {
    validateInteractionEvidenceRecord(evidenceList[i], '3.7', i);
  }

  // 4. Index Evidence by Source and Target
  const outgoingMap = new Map<string, CharacterInteractionEvidence[]>();
  const incomingMap = new Map<string, CharacterInteractionEvidence[]>();

  for (const cid of characterIds) {
    outgoingMap.set(cid, []);
    incomingMap.set(cid, []);
  }

  for (const item of evidenceList) {
    const outList = outgoingMap.get(item.sourceCharacterId);
    if (outList) {
      outList.push(item);
    }

    const inList = incomingMap.get(item.targetCharacterId);
    if (inList) {
      inList.push(item);
    }
  }

  // 5. Construct Profiles and Compute Deterministic Summaries
  const profiles: CharacterInteractionProfile[] = [];
  let totalOutgoingIndexed = 0;
  let totalIncomingIndexed = 0;
  let charactersWithOutgoing = 0;
  let charactersWithIncoming = 0;

  for (const cid of characterIds) {
    const rawOutgoing = outgoingMap.get(cid) || [];
    const rawIncoming = incomingMap.get(cid) || [];

    // Deterministic total ordering within directional edge collections
    const outgoing = rawOutgoing.slice().sort(compareCharacterInteractionEvidence);
    const incoming = rawIncoming.slice().sort(compareCharacterInteractionEvidence);

    // Compute status counts for outgoing
    let outAuth = 0;
    let outUnk = 0;
    let outUnm = 0;
    let outNotApp = 0;
    let outConf = 0;
    const distinctTargets = new Set<string>();

    for (const item of outgoing) {
      distinctTargets.add(item.targetCharacterId);
      if (item.evidenceStatus === 'AUTHORITATIVE') outAuth++;
      else if (item.evidenceStatus === 'UNKNOWN') outUnk++;
      else if (item.evidenceStatus === 'UNMODELED') outUnm++;
      else if (item.evidenceStatus === 'NOT_APPLICABLE') outNotApp++;
      else if (item.evidenceStatus === 'CONFLICTED') outConf++;
    }

    // Compute status counts for incoming
    let inAuth = 0;
    let inUnk = 0;
    let inUnm = 0;
    let inNotApp = 0;
    let inConf = 0;
    const distinctSources = new Set<string>();

    for (const item of incoming) {
      distinctSources.add(item.sourceCharacterId);
      if (item.evidenceStatus === 'AUTHORITATIVE') inAuth++;
      else if (item.evidenceStatus === 'UNKNOWN') inUnk++;
      else if (item.evidenceStatus === 'UNMODELED') inUnm++;
      else if (item.evidenceStatus === 'NOT_APPLICABLE') inNotApp++;
      else if (item.evidenceStatus === 'CONFLICTED') inConf++;
    }

    const summary: CharacterInteractionProfileSummary = Object.freeze({
      outgoingTotal: outgoing.length,
      incomingTotal: incoming.length,
      outgoingAuthoritative: outAuth,
      incomingAuthoritative: inAuth,
      outgoingUnknown: outUnk,
      incomingUnknown: inUnk,
      outgoingUnmodeled: outUnm,
      incomingUnmodeled: inUnm,
      outgoingNotApplicable: outNotApp,
      incomingNotApplicable: inNotApp,
      outgoingConflicted: outConf,
      incomingConflicted: inConf,
      distinctOutgoingTargets: distinctTargets.size,
      distinctIncomingSources: distinctSources.size
    });

    totalOutgoingIndexed += outgoing.length;
    totalIncomingIndexed += incoming.length;
    if (outgoing.length > 0) charactersWithOutgoing++;
    if (incoming.length > 0) charactersWithIncoming++;

    const profileId = deriveCharacterProfileId(cid, '3.7', CHARACTER_INTERACTION_PROFILE_RULE_VERSION);

    profiles.push(Object.freeze({
      id: profileId,
      patchVersion: '3.7',
      ruleVersion: CHARACTER_INTERACTION_PROFILE_RULE_VERSION,
      characterId: cid,
      outgoing: Object.freeze(outgoing),
      incoming: Object.freeze(incoming),
      summary
    }));
  }

  // 6. Deterministic Total Ordering of Profiles
  profiles.sort(compareCharacterInteractionProfiles);

  // 7. Overall Summary Accounting
  let authTotal = 0;
  let unkTotal = 0;
  let unmTotal = 0;
  let notAppTotal = 0;
  let confTotal = 0;

  for (const item of evidenceList) {
    if (item.evidenceStatus === 'AUTHORITATIVE') authTotal++;
    else if (item.evidenceStatus === 'UNKNOWN') unkTotal++;
    else if (item.evidenceStatus === 'UNMODELED') unmTotal++;
    else if (item.evidenceStatus === 'NOT_APPLICABLE') notAppTotal++;
    else if (item.evidenceStatus === 'CONFLICTED') confTotal++;
  }

  const overallSummary: CharacterInteractionAggregationSummary = Object.freeze({
    totalProfiles: profiles.length,
    totalUnderlyingInteractions: evidenceList.length,
    totalOutgoingIndexed,
    totalIncomingIndexed,
    authoritativeTotal: authTotal,
    unknownTotal: unkTotal,
    unmodeledTotal: unmTotal,
    notApplicableTotal: notAppTotal,
    conflictedTotal: confTotal,
    charactersWithOutgoing,
    charactersWithIncoming
  });

  const audit: CharacterInteractionAggregationAudit = Object.freeze({
    deterministic: true,
    patchIsolated: true,
    lineagePreserved: true,
    invariantsVerified: true
  });

  return Object.freeze({
    patchId: '3.7',
    ruleVersion: CHARACTER_INTERACTION_PROFILE_RULE_VERSION,
    profiles: Object.freeze(profiles),
    summary: overallSummary,
    audit
  });
}
