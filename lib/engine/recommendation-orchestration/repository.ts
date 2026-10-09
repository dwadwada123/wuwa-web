/**
 * Wuthering Waves Deterministic Recommendation Orchestration Repository
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Provides query, memoization, and caching operations for EndToEndRecommendation records.
 */

import { orchestrateRecommendations } from './builder.ts';
import type {
  RecommendationOrchestrationResult,
  RecommendationOrchestrationInput,
  EndToEndRecommendation
} from './types.ts';

let _cachedDefaultResult: RecommendationOrchestrationResult | null = null;

/**
 * Clears the in-memory memoized recommendation orchestration cache for test isolation and cache eviction.
 */
export function clearRecommendationOrchestrationCache(): void {
  _cachedDefaultResult = null;
}

/**
 * Retrieves or builds the memoized default production RecommendationOrchestrationResult for Patch 3.7.
 */
export function getRecommendationOrchestrationResult(
  input?: RecommendationOrchestrationInput
): RecommendationOrchestrationResult {
  const isDefault =
    !input ||
    (!input.patchId &&
      !input.seasonId &&
      input.targetK === undefined &&
      !input.ownedRoster &&
      !input.investmentSnapshots &&
      !input.targetStageIds &&
      input.allowPartial === undefined);

  if (isDefault) {
    if (!_cachedDefaultResult) {
      _cachedDefaultResult = orchestrateRecommendations();
    }
    return _cachedDefaultResult;
  }

  return orchestrateRecommendations(input);
}

/**
 * Retrieves the default canonical EndToEndRecommendation record for Patch 3.7.
 */
export function getDefaultEndToEndRecommendation(): EndToEndRecommendation {
  return getRecommendationOrchestrationResult().recommendation;
}

/**
 * Convenience helper to orchestrate recommendations for an explicit owned roster.
 */
export function orchestrateRecommendationsForRoster(
  ownedResonatorIds: readonly string[],
  targetK?: number,
  allowPartial?: boolean
): RecommendationOrchestrationResult {
  return orchestrateRecommendations({
    ownedRoster: ownedResonatorIds,
    targetK,
    allowPartial
  });
}
