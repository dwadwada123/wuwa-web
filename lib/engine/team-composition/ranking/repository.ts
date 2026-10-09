/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranking Repository
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Provides query, lookup, slicing, and caching operations over
 * TeamCompositionEvidenceRanking records.
 */

import {
  getTeamCompositionEvaluations,
  getCandidateById
} from '../evaluation/repository.ts';
import { rankTeamCompositionCandidates } from './ranker.ts';
import { matchesTeamCompositionRankingFilter } from './predicates.ts';
import type {
  TeamCompositionEvidenceRanking,
  TeamCompositionRankingFilter,
  TeamCompositionRankingOptions
} from './types.ts';

let _cachedProductionRankings: readonly TeamCompositionEvidenceRanking[] | null = null;
let _cachedRankingById: Map<string, TeamCompositionEvidenceRanking> | null = null;
let _cachedRankingByCandidateId: Map<string, TeamCompositionEvidenceRanking> | null = null;
let _cachedRankedList: readonly TeamCompositionEvidenceRanking[] | null = null;
let _cachedUnrankableList: readonly TeamCompositionEvidenceRanking[] | null = null;

/**
 * Clears the in-memory ranking cache.
 */
export function clearRankingCache(): void {
  _cachedProductionRankings = null;
  _cachedRankingById = null;
  _cachedRankingByCandidateId = null;
  _cachedRankedList = null;
  _cachedUnrankableList = null;
}

/**
 * Initializes the baseline production ranking cache if not already populated.
 */
function ensureProductionRankingsLoaded(): readonly TeamCompositionEvidenceRanking[] {
  if (!_cachedProductionRankings) {
    const evaluations = getTeamCompositionEvaluations();
    const rankings = rankTeamCompositionCandidates(evaluations, getCandidateById, {
      includeUnrankable: true
    });

    _cachedProductionRankings = rankings;

    const byId = new Map<string, TeamCompositionEvidenceRanking>();
    const byCandidateId = new Map<string, TeamCompositionEvidenceRanking>();
    const ranked: TeamCompositionEvidenceRanking[] = [];
    const unrankable: TeamCompositionEvidenceRanking[] = [];

    for (const r of rankings) {
      byId.set(r.id, r);
      byCandidateId.set(r.candidateId, r);
      if (r.rankingStatus === 'RANKED') {
        ranked.push(r);
      } else {
        unrankable.push(r);
      }
    }

    _cachedRankingById = byId;
    _cachedRankingByCandidateId = byCandidateId;
    _cachedRankedList = Object.freeze(ranked);
    _cachedUnrankableList = Object.freeze(unrankable);
  }
  return _cachedProductionRankings;
}

/**
 * Retrieves team composition rankings matching optional filter and options.
 */
export function getTeamCompositionRankings(
  filter?: TeamCompositionRankingFilter,
  options?: TeamCompositionRankingOptions
): readonly TeamCompositionEvidenceRanking[] {
  ensureProductionRankingsLoaded();

  let results: readonly TeamCompositionEvidenceRanking[];

  if (options?.includeUnrankable === false) {
    results = _cachedRankedList!;
  } else {
    results = _cachedProductionRankings!;
  }

  if (filter) {
    results = Object.freeze(
      results.filter((r) => matchesTeamCompositionRankingFilter(r, filter))
    );
  }

  return results;
}

/**
 * Alias for getTeamCompositionRankings with explicit filter query semantics.
 */
export const queryTeamCompositionRankings = getTeamCompositionRankings;

/**
 * Fast O(1) lookup of a ranking record by its ranking ID.
 */
export function getRankingById(id: string): TeamCompositionEvidenceRanking | undefined {
  ensureProductionRankingsLoaded();
  return _cachedRankingById?.get(id);
}

/**
 * Fast O(1) lookup of a ranking record by its Step 9 candidate ID.
 */
export function getRankingByCandidateId(
  candidateId: string
): TeamCompositionEvidenceRanking | undefined {
  ensureProductionRankingsLoaded();
  return _cachedRankingByCandidateId?.get(candidateId);
}

/**
 * Retrieves the numeric rank for a given candidate ID, or null if unrankable.
 */
export function getRank(candidateId: string): number | null {
  const ranking = getRankingByCandidateId(candidateId);
  return ranking?.rank ?? null;
}

/**
 * Retrieves all rankable candidates ordered 1..N.
 */
export function getAllRanked(): readonly TeamCompositionEvidenceRanking[] {
  ensureProductionRankingsLoaded();
  return _cachedRankedList!;
}

/**
 * Retrieves all unrankable candidates with null rank.
 */
export function getAllUnrankable(): readonly TeamCompositionEvidenceRanking[] {
  ensureProductionRankingsLoaded();
  return _cachedUnrankableList!;
}

/**
 * Retrieves the top N highest-ranked deterministic evidence-supported candidates.
 * SEMANTIC DISTINCTION: This returns the highest-supported evidence candidates,
 * NOT the "best teams in gameplay".
 */
export function getTopRanked(limit: number): readonly TeamCompositionEvidenceRanking[] {
  if (limit <= 0) return Object.freeze([]);
  const ranked = getAllRanked();
  return Object.freeze(ranked.slice(0, limit));
}

/**
 * Retrieves an offset/limit interval of ranked candidates.
 */
export function getRankedRange(
  offset: number,
  limit: number
): readonly TeamCompositionEvidenceRanking[] {
  if (limit <= 0 || offset < 0) return Object.freeze([]);
  const ranked = getAllRanked();
  return Object.freeze(ranked.slice(offset, offset + limit));
}
