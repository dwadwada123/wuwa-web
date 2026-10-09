/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranking Auditor
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Audits TeamCompositionEvidenceRanking records against Invariants A through AL.
 * Strictly verifies deterministic IDs, contiguous unique ranks (1..N), score immutability,
 * fail-closed null gating for unrankables, and complete absence of gameplay/meta inferences.
 */

import { auditTeamCompositionEvaluations } from '../evaluation/audit.ts';
import {
  getTeamCompositionEvaluations,
  getCandidateById,
  getEvaluationById
} from '../evaluation/repository.ts';
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../../relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../evaluation/rules.ts';
import {
  TEAM_COMPOSITION_RANKING_RULE_VERSION,
  TOTAL_THEORETICAL_TEAMS
} from './rules.ts';
import {
  deriveTeamCompositionRankingId,
  isRanked,
  isUnrankable
} from './predicates.ts';
import { getTeamCompositionRankings } from './repository.ts';
import type {
  TeamCompositionRankingStatus,
  TeamCompositionEvaluationStatus,
  TeamCompositionEvidenceRanking,
  ProductionTeamRankingAuditMetrics
} from './types.ts';

/** Prohibited keys that MUST NEVER exist on a TeamCompositionEvidenceRanking */
export const PROHIBITED_KEYS_ON_RANKING: readonly string[] = Object.freeze([
  'characterPower',
  'characterStrength',
  'characterScore',
  'resonatorPower',
  'resonatorScore',
  'teamPower',
  'teamDPS',
  'teamDps',
  'rotationDps',
  'dpsScore',
  'damageGain',
  'teamDamageIncrease',
  'damageRanking',
  'teamRanking',
  'bestTeam',
  'optimalTeam',
  'teamViability',
  'metaRank',
  'metaScore',
  'tierList',
  'topMeta',
  'toaScore',
  'towerScore',
  'vigorScore',
  'antiSynergyScore',
  'conflictScore',
  'incompatibilityPenalty',
  'negativeSynergy',
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER',
  'BUFFER'
]);

/**
 * Validates that an object contains zero prohibited property names or values.
 */
export function assertNoProhibitedRankingKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedRankingKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_RANKING) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedRankingKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Audits a collection of TeamCompositionEvidenceRanking records against Invariants A through AL.
 */
export function auditTeamCompositionRankings(
  rankingsInput?: readonly TeamCompositionEvidenceRanking[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = TEAM_COMPOSITION_RANKING_RULE_VERSION
): ProductionTeamRankingAuditMetrics {
  const step10Audit = auditTeamCompositionEvaluations();
  const rankings = rankingsInput ?? getTeamCompositionRankings();

  const totalCandidates = rankings.length;
  if (totalCandidates === 0) {
    throw new Error('Audit failure: Zero team composition rankings provided for audit.');
  }

  // Invariant P: totalCandidateCount === 34,220
  if (totalCandidates !== TOTAL_THEORETICAL_TEAMS) {
    throw new Error(
      `Invariant P failure: Total rankings ${totalCandidates} !== expected theoretical count ${TOTAL_THEORETICAL_TEAMS}.`
    );
  }

  // Verify upstream rule versions
  if (CHARACTER_PAIR_SYNERGY_RULE_VERSION !== '7.8.1') {
    throw new Error(`Upstream Step 8 rule version modified: ${CHARACTER_PAIR_SYNERGY_RULE_VERSION} !== '7.8.1'.`);
  }
  if (TEAM_COMPOSITION_RULE_VERSION !== '7.9.1') {
    throw new Error(`Upstream Step 9 rule version modified: ${TEAM_COMPOSITION_RULE_VERSION} !== '7.9.1'.`);
  }
  if (TEAM_COMPOSITION_EVALUATION_RULE_VERSION !== '7.10.1') {
    throw new Error(`Upstream Step 10 rule version modified: ${TEAM_COMPOSITION_EVALUATION_RULE_VERSION} !== '7.10.1'.`);
  }

  const seenRankingIds = new Set<string>();
  const seenRanks = new Set<number>();
  let duplicateRanksCount = 0;

  let rankedCount = 0;
  let unrankableCount = 0;

  const rankingStatusDistribution: Record<TeamCompositionRankingStatus, number> = {
    RANKED: 0,
    UNRANKABLE: 0
  };

  const evaluationStatusDistribution: Record<TeamCompositionEvaluationStatus, number> = {
    EVALUATED: 0,
    PARTIALLY_EVALUATED: 0,
    MISSING_CONTEXT: 0,
    CONTEXT_MISMATCH: 0,
    UNMODELED: 0,
    UNKNOWN: 0,
    NOT_APPLICABLE: 0,
    NO_EVIDENCE: 0
  };

  const unrankableReasonDistribution: Record<string, number> = {};

  const tieBreakStats = {
    scoreTiesEncountered: 0,
    resolvedByMatchedPairs: 0,
    resolvedByIndependentLineages: 0,
    resolvedByDirectionalEdges: 0,
    resolvedByCategoryDiversity: 0,
    resolvedByCanonicalMembers: 0,
    resolvedByCandidateId: 0
  };

  let minRank: number | null = null;
  let maxRank: number | null = null;
  let minScore: number | null = null;
  let maxScore: number | null = null;

  const expectedRankableCount = step10Audit.evaluationsWithScore;

  const rankedRecords: TeamCompositionEvidenceRanking[] = [];

  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    const path = `rankings[${i}]`;

    // Static safety check on object structure
    assertNoProhibitedRankingKeys(r, path);

    // Invariant A: patchVersion === '3.7'
    if (r.patchVersion !== expectedPatch) {
      throw new Error(`Invariant A failure: patchVersion is '${r.patchVersion}', expected '${expectedPatch}'.`);
    }

    // Invariant B: ruleVersion === '7.11.1'
    if (r.ruleVersion !== expectedRuleVersion) {
      throw new Error(`Invariant B failure: ruleVersion is '${r.ruleVersion}', expected '${expectedRuleVersion}'.`);
    }

    // Invariant C: candidate exists
    const candidate = getCandidateById(r.candidateId);
    if (!candidate) {
      throw new Error(`Invariant C failure: Ranking '${r.id}' references unknown candidate '${r.candidateId}'.`);
    }

    // Invariant D & E: evaluation exists and references candidate correctly
    const evaluation = getEvaluationById(r.evaluationId);
    if (!evaluation) {
      throw new Error(`Invariant D failure: Ranking '${r.id}' references unknown evaluation '${r.evaluationId}'.`);
    }
    if (evaluation.candidateId !== r.candidateId) {
      throw new Error(
        `Invariant E failure: Evaluation candidateId '${evaluation.candidateId}' !== ranking candidateId '${r.candidateId}'.`
      );
    }

    // Invariant F: member count exactly 3
    if (r.memberResonatorIds.length !== 3) {
      throw new Error(`Invariant F failure: Candidate '${r.candidateId}' does not have exactly 3 members.`);
    }

    // Invariant G: canonical team identity preserved
    if (
      r.memberResonatorIds[0] !== candidate.memberResonatorIds[0] ||
      r.memberResonatorIds[1] !== candidate.memberResonatorIds[1] ||
      r.memberResonatorIds[2] !== candidate.memberResonatorIds[2]
    ) {
      throw new Error(`Invariant G failure: Member identity mismatch for candidate '${r.candidateId}'.`);
    }

    // Invariant T: no duplicate ranking IDs
    if (seenRankingIds.has(r.id)) {
      throw new Error(`Invariant T failure: Duplicate ranking ID detected: '${r.id}'.`);
    }
    seenRankingIds.add(r.id);

    // Invariant U: deterministic ranking ID derivation
    const expectedId = deriveTeamCompositionRankingId(expectedPatch, r.candidateId, expectedRuleVersion);
    if (r.id !== expectedId) {
      throw new Error(`Invariant U failure: Ranking ID '${r.id}' !== expected deterministic ID '${expectedId}'.`);
    }

    // Invariant H & S: totalScore exactly matches Step 10 evaluation without mutation
    if (r.totalScore !== evaluation.totalScore) {
      throw new Error(
        `Invariant H/S failure: Score mutated for candidate '${r.candidateId}': ${r.totalScore} !== ${evaluation.totalScore}.`
      );
    }

    // Invariant O: totalRankableCount is correct
    if (r.totalRankableCount !== expectedRankableCount) {
      throw new Error(
        `Invariant O failure: totalRankableCount ${r.totalRankableCount} !== expected ${expectedRankableCount}.`
      );
    }

    // Status accounting
    rankingStatusDistribution[r.rankingStatus]++;
    evaluationStatusDistribution[r.evaluationStatus]++;

    if (r.rankingStatus === 'RANKED') {
      rankedCount++;
      rankedRecords.push(r);

      // Invariant J, K, L: rank is non-null integer >= 1
      if (r.rank === null || !Number.isInteger(r.rank) || r.rank < 1) {
        throw new Error(`Invariant J-L failure: Invalid rank ${r.rank} for RANKED candidate at ${path}.`);
      }

      // Invariant Q: score is finite and non-null
      if (r.totalScore === null || !Number.isFinite(r.totalScore)) {
        throw new Error(`Invariant Q failure: Non-finite score ${r.totalScore} for RANKED candidate at ${path}.`);
      }

      // Invariant M: unique ranks
      if (seenRanks.has(r.rank)) {
        duplicateRanksCount++;
        throw new Error(`Invariant M failure: Duplicate rank ${r.rank} encountered at ${path}.`);
      }
      seenRanks.add(r.rank);

      if (minRank === null || r.rank < minRank) minRank = r.rank;
      if (maxRank === null || r.rank > maxRank) maxRank = r.rank;
      if (minScore === null || r.totalScore < minScore) minScore = r.totalScore;
      if (maxScore === null || r.totalScore > maxScore) maxScore = r.totalScore;
    } else {
      unrankableCount++;

      // Invariant I & R: rank is null and score is null for UNRANKABLE
      if (r.rank !== null) {
        throw new Error(`Invariant I failure: UNRANKABLE candidate has non-null rank ${r.rank} at ${path}.`);
      }
      if (r.totalScore !== null) {
        throw new Error(`Invariant R failure: UNRANKABLE candidate has non-null score ${r.totalScore} at ${path}.`);
      }

      const prevCount = unrankableReasonDistribution[r.evaluationStatus];
      unrankableReasonDistribution[r.evaluationStatus] = typeof prevCount === 'number' ? prevCount + 1 : 1;
    }
  }

  // Invariant N: ranks are contiguous 1..N
  if (rankedCount !== expectedRankableCount) {
    throw new Error(
      `Invariant N failure: Ranked count ${rankedCount} !== expected rankable count ${expectedRankableCount}.`
    );
  }
  if (minRank !== null && minRank !== 1) {
    throw new Error(`Invariant N failure: Minimum rank is ${minRank}, expected 1.`);
  }
  if (maxRank !== null && maxRank !== expectedRankableCount) {
    throw new Error(`Invariant N failure: Maximum rank is ${maxRank}, expected ${expectedRankableCount}.`);
  }

  // Verify tie-breaking statistics among sorted ranked records
  rankedRecords.sort((a, b) => a.rank! - b.rank!);
  for (let i = 1; i < rankedRecords.length; i++) {
    const prev = rankedRecords[i - 1];
    const curr = rankedRecords[i];

    if (prev.totalScore === curr.totalScore) {
      tieBreakStats.scoreTiesEncountered++;

      if (prev.matchedPairCount !== curr.matchedPairCount) {
        tieBreakStats.resolvedByMatchedPairs++;
      } else if (prev.independentEvidenceLineageCount !== curr.independentEvidenceLineageCount) {
        tieBreakStats.resolvedByIndependentLineages++;
      } else if (prev.directionalEdgeCount !== curr.directionalEdgeCount) {
        tieBreakStats.resolvedByDirectionalEdges++;
      } else if (prev.supportingSynergyCategories.length !== curr.supportingSynergyCategories.length) {
        tieBreakStats.resolvedByCategoryDiversity++;
      } else {
        const prevMem = prev.memberResonatorIds.join(':');
        const currMem = curr.memberResonatorIds.join(':');
        if (prevMem !== currMem) {
          tieBreakStats.resolvedByCanonicalMembers++;
        } else {
          tieBreakStats.resolvedByCandidateId++;
        }
      }
    }
  }

  // Reconciliation checks
  if (rankedCount + unrankableCount !== totalCandidates) {
    throw new Error(
      `Reconciliation failure: ranked (${rankedCount}) + unrankable (${unrankableCount}) !== total (${totalCandidates}).`
    );
  }

  return Object.freeze({
    totalCandidates,
    totalRankableCount: expectedRankableCount,
    totalUnrankableCount: unrankableCount,
    rankedCount,
    unrankableCount,

    minRank,
    maxRank,
    uniqueRanksCount: seenRanks.size,
    duplicateRanksCount,

    minScore,
    maxScore,

    rankingStatusDistribution: Object.freeze(rankingStatusDistribution),
    evaluationStatusDistribution: Object.freeze(evaluationStatusDistribution),
    unrankableReasonDistribution: Object.freeze(unrankableReasonDistribution),
    tieBreakStats: Object.freeze(tieBreakStats),

    rankings
  });
}
