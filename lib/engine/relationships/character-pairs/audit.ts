/**
 * Wuthering Waves Character-Level Evidence Profile Auditor
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Audits CharacterPairEvidenceProfiles against strict Invariants A through AG.
 * Validates deterministic IDs, directional integrity, anti-double-counting,
 * epistemic safety, patch isolation, and upstream lineage reconciliation.
 */

import { auditProductionCapabilities } from '../../capabilities/builder.ts';
import { auditProductionRelationships } from '../audit.ts';
import { auditProductionInteractionEvidence } from '../composition/audit.ts';
import { getCompatibilityCandidates } from '../compatibility/repository.ts';
import { getCompatibilityEvaluations } from '../evaluation/repository.ts';
import { getCharacterPairEvidenceProfiles } from './repository.ts';
import {
  CHARACTER_PAIR_AGGREGATION_RULE_VERSION,
  PAIR_SCORE_SCALE_MIN,
  PAIR_SCORE_SCALE_MAX
} from './rules.ts';
import { deriveCharacterPairProfileId } from './predicates.ts';
import type {
  CharacterPairEvidenceProfile,
  CharacterPairProfileStatus,
  ProductionPairAuditMetrics
} from './types.ts';
import type { CompatibilityCandidate } from '../compatibility/types.ts';
import type { CompatibilityCandidateEvaluation } from '../evaluation/types.ts';

/** Prohibited keys that MUST NEVER exist on a CharacterPairEvidenceProfile */
const PROHIBITED_KEYS_ON_PROFILE: readonly string[] = [
  'characterPower',
  'characterStrength',
  'characterScore',
  'resonatorPower',
  'resonatorScore',
  'teamScore',
  'teamSynergy',
  'teamRanking',
  'bestTeam',
  'synergyScore',
  'dpsScore',
  'damageRanking',
  'metaRank',
  'tierList',
  'towerScore',
  'vigorScore',
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER',
  'BUFFER'
];

/**
 * Validates that an object contains zero prohibited property names or values.
 */
function assertNoProhibitedKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_PROFILE) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Audits a collection of CharacterPairEvidenceProfiles against Invariants A through AG.
 */
export function auditCharacterPairEvidenceProfiles(
  profilesInput?: readonly CharacterPairEvidenceProfile[],
  candidatesInput?: readonly CompatibilityCandidate[],
  evaluationsInput?: readonly CompatibilityCandidateEvaluation[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = CHARACTER_PAIR_AGGREGATION_RULE_VERSION
): ProductionPairAuditMetrics {
  const capList = auditProductionCapabilities().capabilities;
  const relList = auditProductionRelationships().relationships;
  const eviList = auditProductionInteractionEvidence().evidence;
  const candList = candidatesInput ?? getCompatibilityCandidates();
  const evalList = evaluationsInput ?? getCompatibilityEvaluations();
  const profList = profilesInput ?? getCharacterPairEvidenceProfiles();

  // Known Resonator IDs from capabilities
  const knownResonatorIdSet = new Set<string>();
  for (const cap of capList) {
    if (
      cap.provenance.sourceType === 'RESONATOR_ABILITY' ||
      cap.provenance.sourceType === 'RESONATOR_SEQUENCE'
    ) {
      knownResonatorIdSet.add(cap.entityId);
    }
  }

  // Upstream candidate & evaluation indexes
  const candidateIdMap = new Map<string, CompatibilityCandidate>();
  let includedResonatorCandidates = 0;
  let excludedNonResonatorCandidates = 0;

  for (const cand of candList) {
    candidateIdMap.set(cand.id, cand);
    if (knownResonatorIdSet.has(cand.sourceEntityId) && knownResonatorIdSet.has(cand.targetEntityId)) {
      includedResonatorCandidates++;
    } else {
      excludedNonResonatorCandidates++;
    }
  }

  const evaluationIdMap = new Map<string, CompatibilityCandidateEvaluation>();
  for (const ev of evalList) {
    evaluationIdMap.set(ev.id, ev);
  }

  const evidenceIdSet = new Set(eviList.map((e) => e.id));
  const relationshipIdSet = new Set(relList.map((r) => r.relationshipId));

  // Upstream source fact IDs
  const sourceFactIdSet = new Set<string>();
  for (const cand of candList) {
    for (const fid of cand.sourceFactIds) {
      sourceFactIdSet.add(fid);
    }
  }

  const seenProfileIds = new Set<string>();
  const seenPairs = new Set<string>();
  let duplicatePairIds = 0;
  let pairsWithScore = 0;
  let pairsWithoutScore = 0;
  let maxCandidatesPerPair = 0;
  let maxEvidencePerPair = 0;
  let maxSourceFactsPerPair = 0;

  const validScores: number[] = [];
  const uniqueResonatorsRepresented = new Set<string>();

  const pairsByStatus: Record<CharacterPairProfileStatus, number> = {
    EVALUATED: 0,
    PARTIALLY_EVALUATED: 0,
    MISSING_CONTEXT: 0,
    CONTEXT_MISMATCH: 0,
    UNMODELED: 0,
    UNKNOWN: 0,
    NOT_APPLICABLE: 0,
    EMPTY: 0
  };

  const scoreDistribution: Record<string, number> = {
    '0.00 - 19.99': 0,
    '20.00 - 39.99': 0,
    '40.00 - 59.99': 0,
    '60.00 - 79.99': 0,
    '80.00 - 100.00': 0
  };

  // Reconciled candidate ID tracker across all profiles
  const candidateEvaluationsEncountered = new Set<string>();

  for (const profile of profList) {
    // Invariant A: Valid patch
    if (profile.patchVersion !== expectedPatch) {
      throw new Error(`Audit failure: Profile '${profile.id}' has invalid patchVersion '${profile.patchVersion}'.`);
    }

    // Invariant B & C: Valid source and target Resonators
    if (!knownResonatorIdSet.has(profile.sourceResonatorId)) {
      throw new Error(`Audit failure: Profile '${profile.id}' has unknown source Resonator '${profile.sourceResonatorId}'.`);
    }
    if (!knownResonatorIdSet.has(profile.targetResonatorId)) {
      throw new Error(`Audit failure: Profile '${profile.id}' has unknown target Resonator '${profile.targetResonatorId}'.`);
    }

    uniqueResonatorsRepresented.add(profile.sourceResonatorId);
    uniqueResonatorsRepresented.add(profile.targetResonatorId);

    // Invariant D: Source and target directionality
    const pairKey = `${profile.sourceResonatorId}:::${profile.targetResonatorId}`;
    if (seenPairs.has(pairKey)) {
      throw new Error(`Audit failure: Duplicate directional pair profile detected for '${pairKey}'.`);
    }
    seenPairs.add(pairKey);

    // Invariant J: Deterministic ID
    const expectedId = deriveCharacterPairProfileId(
      expectedPatch,
      profile.sourceResonatorId,
      profile.targetResonatorId,
      expectedRuleVersion
    );
    if (profile.id !== expectedId) {
      throw new Error(`Audit failure: Profile ID mismatch. Expected '${expectedId}', got '${profile.id}'.`);
    }

    // Invariant L: Rule version
    if (profile.ruleVersion !== expectedRuleVersion) {
      throw new Error(`Audit failure: Profile '${profile.id}' has invalid ruleVersion '${profile.ruleVersion}'.`);
    }

    // Invariant M: Unique profile IDs
    if (seenProfileIds.has(profile.id)) {
      duplicatePairIds++;
      throw new Error(`Audit failure: Duplicate profile ID '${profile.id}'.`);
    }
    seenProfileIds.add(profile.id);

    // Invariant E, F, G, H, I: Lineage validity
    for (const cid of profile.candidateIds) {
      if (!candidateIdMap.has(cid)) {
        throw new Error(`Audit failure: Profile '${profile.id}' references unknown candidate '${cid}'.`);
      }
      if (candidateEvaluationsEncountered.has(cid)) {
        throw new Error(`Audit failure: Candidate '${cid}' mapped to multiple character pair profiles.`);
      }
      candidateEvaluationsEncountered.add(cid);
    }

    for (const evid of profile.evaluationIds) {
      if (!evaluationIdMap.has(evid)) {
        throw new Error(`Audit failure: Profile '${profile.id}' references unknown evaluation '${evid}'.`);
      }
    }

    for (const eid of profile.evidenceIds) {
      if (!evidenceIdSet.has(eid)) {
        throw new Error(`Audit failure: Profile '${profile.id}' references unknown evidence '${eid}'.`);
      }
    }

    for (const rid of profile.relationshipIds) {
      if (!relationshipIdSet.has(rid)) {
        throw new Error(`Audit failure: Profile '${profile.id}' references unknown relationship '${rid}'.`);
      }
    }

    for (const fid of profile.sourceFactIds) {
      if (!sourceFactIdSet.has(fid)) {
        throw new Error(`Audit failure: Profile '${profile.id}' references unknown source fact '${fid}'.`);
      }
    }

    // Lineage maximum tracking
    if (profile.candidateIds.length > maxCandidatesPerPair) {
      maxCandidatesPerPair = profile.candidateIds.length;
    }
    if (profile.evidenceIds.length > maxEvidencePerPair) {
      maxEvidencePerPair = profile.evidenceIds.length;
    }
    if (profile.sourceFactIds.length > maxSourceFactsPerPair) {
      maxSourceFactsPerPair = profile.sourceFactIds.length;
    }

    // Status accounting
    const status = profile.status;
    const existingStatusCount = pairsByStatus[status];
    pairsByStatus[status] = typeof existingStatusCount === 'number' ? existingStatusCount + 1 : 1;

    // Epistemic scoring safety checks
    const score = profile.evidenceScoreSummary.pairEvidenceScore;
    if (
      status === 'EMPTY' ||
      status === 'MISSING_CONTEXT' ||
      status === 'UNMODELED' ||
      status === 'UNKNOWN' ||
      status === 'NOT_APPLICABLE' ||
      status === 'CONTEXT_MISMATCH'
    ) {
      // Invariant P, Q, R, S, T, U, V: Must never receive active numerical score
      if (score !== null) {
        throw new Error(`Audit failure: Profile '${profile.id}' in status '${status}' has non-null score '${score}'.`);
      }
      pairsWithoutScore++;
    } else {
      // EVALUATED or PARTIALLY_EVALUATED
      if (score === null) {
        throw new Error(`Audit failure: Profile '${profile.id}' in status '${status}' has null pairEvidenceScore.`);
      }
      if (!Number.isFinite(score)) {
        throw new Error(`Audit failure: Profile '${profile.id}' score is not finite: '${score}'.`);
      }
      if (Number.isNaN(score)) {
        throw new Error(`Audit failure: Profile '${profile.id}' score is NaN.`);
      }
      if (score < PAIR_SCORE_SCALE_MIN || score > PAIR_SCORE_SCALE_MAX) {
        throw new Error(`Audit failure: Profile '${profile.id}' score '${score}' out of bounds [0, 100].`);
      }

      pairsWithScore++;
      validScores.push(score);

      // Score distribution buckets
      if (score < 20) {
        scoreDistribution['0.00 - 19.99']++;
      } else if (score < 40) {
        scoreDistribution['20.00 - 39.99']++;
      } else if (score < 60) {
        scoreDistribution['40.00 - 59.99']++;
      } else if (score < 80) {
        scoreDistribution['60.00 - 79.99']++;
      } else {
        scoreDistribution['80.00 - 100.00']++;
      }
    }

    // Invariant AA - AG: Scan prohibited keys
    assertNoProhibitedKeys(profile, profile.id);
  }

  // Statistical calculations
  let pairScoreMin: number | null = null;
  let pairScoreMax: number | null = null;
  let pairScoreAverage: number | null = null;
  let pairScoreMedian: number | null = null;

  if (validScores.length > 0) {
    pairScoreMin = Math.min(...validScores);
    pairScoreMax = Math.max(...validScores);
    const sum = validScores.reduce((acc, v) => acc + v, 0);
    pairScoreAverage = Math.round((sum / validScores.length) * 100) / 100;

    const sortedScores = [...validScores].sort((a, b) => a - b);
    const mid = Math.floor(sortedScores.length / 2);
    pairScoreMedian =
      sortedScores.length % 2 !== 0
        ? sortedScores[mid]
        : Math.round(((sortedScores[mid - 1] + sortedScores[mid]) / 2) * 100) / 100;
  }

  return Object.freeze({
    totalUpstreamCandidates: candList.length,
    totalUpstreamEvaluations: evalList.length,
    includedResonatorCandidates,
    excludedNonResonatorCandidates,

    totalModeledPairs: profList.length,
    totalMaterializedPairs: profList.length,
    uniquePairIds: seenProfileIds.size,
    duplicatePairIds,

    pairsWithScore,
    pairsWithoutScore,

    pairScoreMin,
    pairScoreMax,
    pairScoreAverage,
    pairScoreMedian,

    pairsByStatus: Object.freeze(pairsByStatus),
    scoreDistribution: Object.freeze(scoreDistribution),

    uniqueResonatorsRepresented: uniqueResonatorsRepresented.size,
    maxCandidatesPerPair,
    maxEvidencePerPair,
    maxSourceFactsPerPair,

    profiles: profList
  });
}
