/**
 * Wuthering Waves Team Portfolio Repository
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Provides query, selection, and caching operations for TeamPortfolio records.
 */

import { selectTeamPortfolio } from './builder.ts';
import type {
  TeamPortfolio,
  TeamPortfolioResult,
  TeamPortfolioSelectionInput
} from './types.ts';

let _cachedPortfolioResult: TeamPortfolioResult | null = null;

/**
 * Solves or retrieves the authoritative production TeamPortfolioResult for Patch 3.7.
 * Uses an in-memory memoized cache for default zero-argument calls.
 */
export function getTeamPortfolioResult(
  input?: TeamPortfolioSelectionInput
): TeamPortfolioResult {
  const isDefault =
    !input ||
    (!input.patchId &&
      input.targetK === undefined &&
      !input.ownedRoster &&
      !input.teamBuildEvaluations &&
      !input.synergyEvaluations &&
      input.allowPartial === undefined);

  if (isDefault) {
    if (!_cachedPortfolioResult) {
      _cachedPortfolioResult = selectTeamPortfolio();
    }
    return _cachedPortfolioResult;
  }

  return selectTeamPortfolio(input);
}

/**
 * Retrieves the default canonical TeamPortfolio record for Patch 3.7 (K = 3, full catalog).
 */
export function getDefaultTeamPortfolio(): TeamPortfolio {
  return getTeamPortfolioResult().portfolio;
}

/**
 * Convenience helper to solve a portfolio for an explicit owned roster.
 */
export function selectTeamPortfolioForRoster(
  ownedResonatorIds: readonly string[],
  targetK?: number,
  allowPartial?: boolean
): TeamPortfolioResult {
  return selectTeamPortfolio({
    ownedRoster: ownedResonatorIds,
    targetK,
    allowPartial
  });
}

/**
 * Resets the in-memory memoized cache for test isolation and cache eviction.
 */
export function clearTeamPortfolioCache(): void {
  _cachedPortfolioResult = null;
}
