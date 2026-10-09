/**
 * Wuthering Waves Deterministic Team Portfolio Selection & Optimization Types
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Defines contracts representing the deterministic selection of a portfolio of
 * mutually disjoint, eligible 3-Resonator teams from an existing candidate pool and
 * player owned roster.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. DISJOINT TEAM PORTFOLIO SELECTION ONLY, NEVER COMBAT POWER:
 *    Selects an optimal disjoint subset of teams based on validated build qualification,
 *    data completeness, and upstream synergy evidence.
 *    ZERO damage calculations, ZERO combat power, ZERO DPS, ZERO tier ratings, ZERO meta ranks.
 * 2. NO TOWER OF ADVERSITY FLOOR ASSIGNMENT / NO VIGOR ALLOCATION:
 *    Step 22 does NOT assign teams to specific ToA floors or deduct Vigor stamina.
 *    Those scheduling mechanics belong strictly to Step 23.
 * 3. STRICT CARDINALITY & MUTUAL DISJOINTNESS:
 *    Configurable target K teams (default: 3). No Resonator may appear in more than one team:
 *    members(Ti) ∩ members(Tj) = ∅ for all i ≠ j.
 * 4. STRICT PATCH ISOLATION:
 *    Bound strictly to Patch 3.7. Rejects cross-patch inputs.
 * 5. PURE DETERMINISM:
 *    Offline, zero network, zero LLMs, zero random seeds, zero timestamps.
 * 6. UNMODELED MECHANICS REMAIN UNMODELED:
 *    Cross-team inventory weapon contention and buff interactions are strictly 'UNMODELED'.
 * 7. COMPLETENESS ALGEBRA:
 *    totalPortfolioAspects = 18 * selectedTeamCount.
 *    knownPortfolioAspects + unknownPortfolioAspects === totalPortfolioAspects always.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type { OwnedRosterSnapshot } from '../roster/types.ts';
import type {
  TeamBuildEvaluation,
  TeamBuildEvaluationStatus
} from '../team-build-evaluation/types.ts';
import type { TeamCompositionCandidateEvaluation } from '../team-composition/evaluation/types.ts';

export type {
  SourceReference,
  OwnedRosterSnapshot,
  TeamBuildEvaluation,
  TeamBuildEvaluationStatus,
  TeamCompositionCandidateEvaluation
};

/**
 * Closed status taxonomy for overall Team Portfolio feasibility and optimization outcome.
 */
export type TeamPortfolioStatus =
  | 'OPTIMAL_PORTFOLIO'    // Exactly K mutually disjoint eligible teams found and selected under full optimization
  | 'FEASIBLE_PORTFOLIO'   // Exactly K mutually disjoint eligible teams selected under fallback/uninvested qualification
  | 'PARTIAL_PORTFOLIO'    // Fewer than K disjoint teams found before candidate pool/roster was exhausted (only if allowPartial: true)
  | 'INFEASIBLE_PORTFOLIO' // Could not construct K mutually disjoint teams from the available eligible candidates
  | 'INVALID_PORTFOLIO'    // Malformed input, invalid K, duplicate candidates, or non-canonical Resonator IDs
  | 'PATCH_MISMATCH';      // Input patch mismatch rejected

/**
 * Closed status taxonomy describing factual build qualification across the selected portfolio.
 */
export type TeamPortfolioBuildStatus =
  | 'FULLY_EQUIPPED_PORTFOLIO'      // All selected teams have FULLY_EQUIPPED status
  | 'PARTIALLY_EQUIPPED_PORTFOLIO'  // Zero incompatible weapons; at least one team has equipped loadout
  | 'CONTAINS_INCOMPATIBLE_WEAPON'  // At least one selected team has an INCOMPATIBLE weapon
  | 'BUILD_UNKNOWN_PORTFOLIO'       // All selected teams have BUILD_UNKNOWN status
  | 'PARTIALLY_UNKNOWN_PORTFOLIO'   // Mixed known and BUILD_UNKNOWN evidence
  | 'UNAVAILABLE';                  // Infeasible or invalid portfolio (zero teams selected)

/**
 * Factual data completeness metrics aggregated across the selected portfolio.
 * 18 aspects per team * selectedTeamCount.
 * NEVER a gameplay power score!
 */
export interface TeamPortfolioCompletenessMetrics {
  /** Requested portfolio size (K) */
  readonly targetTeamCount: number;
  /** Actual number of teams selected in portfolio */
  readonly selectedTeamCount: number;
  /** Total tracked build aspects across portfolio (18 * selectedTeamCount) */
  readonly totalPortfolioAspects: number;
  /** Total known aspects across portfolio */
  readonly knownPortfolioAspects: number;
  /** Total unknown aspects across portfolio */
  readonly unknownPortfolioAspects: number;
  /** Per-team completeness ratios [team0, ..., teamK-1] */
  readonly teamCompletenessRatios: readonly (number | null)[];
  /** Overall portfolio completeness ratio in [0.0000, 1.0000] or null */
  readonly portfolioCompletenessRatio: number | null;
}

/**
 * Factual aggregation of Echo loadouts and active Sonata sets across all selected teams.
 */
export interface CrossTeamSonataAggregation {
  /** Sorted, deduplicated active Sonata set codes present anywhere in the portfolio */
  readonly distinctActiveSonataCodes: readonly string[];
  /** Sonata set codes equipped by multiple distinct teams in the portfolio */
  readonly crossTeamDuplicateSonataCodes: readonly string[];
  /** Whether any Sonata set code is active on more than one team */
  readonly hasCrossTeamDuplicateSonatas: boolean;
  /** Cross-team buff interaction status: strictly UNMODELED */
  readonly stackingStatus: 'UNMODELED';
}

/**
 * Aggregated summary of upstream Step 10 synergy evidence across the selected teams.
 */
export interface PortfolioSynergyEvidenceSummary {
  /** Sum of Step 10 synergy scores for teams with evaluable scores (or null if none) */
  readonly totalSynergyScore: number | null;
  /** Number of teams in portfolio with non-null Step 10 synergy score */
  readonly rankedTeamsCount: number;
  /** Total matched pairwise synergy connections across the portfolio */
  readonly totalMatchedPairs: number;
  /** Total directional synergy edges across the portfolio */
  readonly totalDirectionalEdges: number;
  /** Average synergy score across ranked teams or null */
  readonly averageSynergyScore: number | null;
}

/**
 * Lineage provenance for a derived TeamPortfolio record.
 */
export interface TeamPortfolioProvenance {
  readonly source: 'DERIVED_TEAM_PORTFOLIO';
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.22.1';
  readonly targetTeamCount: number;
  readonly selectedTeamCount: number;
  readonly selectedTeamEvaluationIds: readonly string[];
  readonly upstreamBuildEvaluationRuleVersion: '7.21.1';
  readonly upstreamSynergyEvaluationRuleVersion: '7.10.1';
  readonly upstreamRosterRuleVersion: '7.12.1';
}

/**
 * Authoritative TeamPortfolio contract.
 * Represents the deterministic selection and qualification of K mutually disjoint teams.
 */
export interface TeamPortfolio {
  /** Deterministic identifier: team-portfolio:3.7:<K>:<sortedTeamIds>:7.22.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: strictly '7.22.1' */
  readonly ruleVersion: '7.22.1';
  /** Requested portfolio size */
  readonly targetTeamCount: number;
  /** Actual count of teams in portfolio */
  readonly selectedTeamCount: number;
  /** Canonical sorted tuple of evaluated teams */
  readonly teams: readonly TeamBuildEvaluation[];
  /** Canonical sorted tuple of all distinct Resonator IDs in portfolio */
  readonly allMemberResonatorIds: readonly string[];
  /** Strict invariant: pairwise disjoint check */
  readonly isMutuallyDisjoint: boolean;
  /** Overall portfolio feasibility/optimality status */
  readonly status: TeamPortfolioStatus;
  /** Portfolio build qualification status */
  readonly buildStatus: TeamPortfolioBuildStatus;
  /** Aggregated build completeness metrics */
  readonly completeness: TeamPortfolioCompletenessMetrics;
  /** Cross-team Sonata set aggregation facts */
  readonly crossTeamSonataAggregation: CrossTeamSonataAggregation;
  /** Upstream synergy evidence summary */
  readonly synergyEvidenceSummary: PortfolioSynergyEvidenceSummary;
  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Factual reasons if portfolio is infeasible or partial */
  readonly infeasibilityReasons?: readonly string[];
  /** Provenance lineage */
  readonly provenance: TeamPortfolioProvenance;
}

/**
 * Diagnostic metrics for portfolio search and solver execution.
 */
export interface TeamPortfolioSearchMetrics {
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.22.1';
  readonly targetK: number;
  readonly ownedResonatorCount: number;
  readonly candidatePoolSize: number;
  readonly eligibleCandidatesCount: number;
  readonly combinationsExplored: number;
  readonly solverStatus: TeamPortfolioStatus;
  readonly verifiedAt: string;
}

/**
 * Input configuration for selecting a team portfolio.
 */
export interface TeamPortfolioSelectionInput {
  /** Target patch version: strictly '3.7' */
  readonly patchId?: string;
  /** Requested portfolio size K (default: 3) */
  readonly targetK?: number;
  /** Whether to return partial solution if exact K cannot be formed (default: false) */
  readonly allowPartial?: boolean;
  /** Owned player roster snapshot or string array of owned Resonator IDs */
  readonly ownedRoster?: OwnedRosterSnapshot | readonly string[];
  /** Candidate pool of Step 21 TeamBuildEvaluations (defaults to production catalog) */
  readonly teamBuildEvaluations?: readonly TeamBuildEvaluation[];
  /** Upstream Step 10 TeamCompositionCandidateEvaluations for synergy evidence */
  readonly synergyEvaluations?: readonly TeamCompositionCandidateEvaluation[];
}

/**
 * Root result container for a TeamPortfolio selection operation.
 */
export interface TeamPortfolioResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.22.1';
  readonly portfolio: TeamPortfolio;
  readonly metrics: TeamPortfolioSearchMetrics;
}
