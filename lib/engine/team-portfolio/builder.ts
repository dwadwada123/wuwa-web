/**
 * Wuthering Waves Team Portfolio Builder
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Implements deterministic input validation, portfolio selection orchestration,
 * factual metrics aggregation, and result building.
 */

import {
  TEAM_PORTFOLIO_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  REQUIRED_STEP10_RULE_VERSION,
  REQUIRED_STEP12_RULE_VERSION,
  DEFAULT_PORTFOLIO_TARGET_K,
  MIN_PORTFOLIO_TARGET_K,
  MAX_PORTFOLIO_TARGET_K,
  TEAM_MEMBER_COUNT,
  ASPECTS_PER_TEAM,
  TEAM_PORTFOLIO_EXPLANATION_CODES,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  deriveTeamPortfolioId,
  areTeamsMutuallyDisjoint,
  extractPortfolioMemberIds
} from './predicates.ts';
import { solveTeamPortfolio } from './solver.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getAllTeamBuildEvaluations } from '../team-build-evaluation/repository.ts';
import { getTeamCompositionEvaluations } from '../team-composition/evaluation/repository.ts';
import { getKnownResonatorIds } from '../team-composition/repository.ts';
import type {
  TeamPortfolio,
  TeamPortfolioStatus,
  TeamPortfolioBuildStatus,
  TeamPortfolioCompletenessMetrics,
  CrossTeamSonataAggregation,
  PortfolioSynergyEvidenceSummary,
  TeamPortfolioProvenance,
  TeamPortfolioSearchMetrics,
  TeamPortfolioSelectionInput,
  TeamPortfolioResult,
  TeamBuildEvaluation,
  TeamCompositionCandidateEvaluation,
  OwnedRosterSnapshot
} from './types.ts';

/**
 * Deterministically validates, solves, and builds a TeamPortfolio record.
 */
export function selectTeamPortfolio(
  input?: TeamPortfolioSelectionInput
): TeamPortfolioResult {
  // 1. Strict Patch Isolation
  const patchId = input?.patchId ?? CANONICAL_PATCH_VERSION;
  if (!patchId || typeof patchId !== 'string' || patchId.trim() !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchId '${patchId}'. Step 22 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  // 2. Validate Target Portfolio Cardinality K
  const targetK = input?.targetK ?? DEFAULT_PORTFOLIO_TARGET_K;
  if (
    typeof targetK !== 'number' ||
    !Number.isInteger(targetK) ||
    targetK < MIN_PORTFOLIO_TARGET_K ||
    targetK > MAX_PORTFOLIO_TARGET_K
  ) {
    throw new Error(
      `Invalid targetK '${targetK}'. Must be an integer between ${MIN_PORTFOLIO_TARGET_K} and ${MAX_PORTFOLIO_TARGET_K}.`
    );
  }

  const allowPartial = input?.allowPartial ?? false;

  // 3. Resolve & Validate Owned Roster
  const canonicalResonatorIds = new Set<string>(getKnownResonatorIds());

  let ownedResonatorIds: Set<string>;
  if (input?.ownedRoster !== undefined) {
    const rawRoster = input.ownedRoster;
    ownedResonatorIds = new Set<string>();

    let listToValidate: readonly string[];
    if (Array.isArray(rawRoster)) {
      listToValidate = rawRoster;
    } else if (rawRoster && typeof rawRoster === 'object' && 'ownedResonatorIds' in rawRoster) {
      const snap = rawRoster as OwnedRosterSnapshot;
      if (snap.patchVersion !== CANONICAL_PATCH_VERSION) {
        throw new Error(
          `OwnedRoster patchVersion '${snap.patchVersion}' mismatch. Expected '${CANONICAL_PATCH_VERSION}'.`
        );
      }
      listToValidate = snap.ownedResonatorIds;
    } else {
      throw new Error('ownedRoster must be an array of Resonator IDs or an OwnedRosterSnapshot.');
    }

    for (let i = 0; i < listToValidate.length; i++) {
      const rId = listToValidate[i];
      if (!rId || typeof rId !== 'string' || !canonicalResonatorIds.has(rId)) {
        throw new Error(
          `Non-canonical Resonator ID '${rId}' at index ${i} in owned roster.`
        );
      }
      ownedResonatorIds.add(rId);
    }
  } else {
    // Default: full canonical Patch 3.7 roster
    ownedResonatorIds = canonicalResonatorIds;
  }

  // 4. Resolve Candidate Team Build Evaluations
  const candidateBuildEvals =
    input?.teamBuildEvaluations ?? getAllTeamBuildEvaluations();

  // Validate candidate records integrity
  const seenCandidateIds = new Set<string>();
  for (let i = 0; i < candidateBuildEvals.length; i++) {
    const cand = candidateBuildEvals[i];
    if (!cand) {
      throw new Error(`Null TeamBuildEvaluation record at index ${i}.`);
    }
    if (cand.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `TeamBuildEvaluation at index ${i} has Invalid patchVersion '${cand.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
      );
    }
    if (cand.ruleVersion !== REQUIRED_STEP21_RULE_VERSION) {
      throw new Error(
        `TeamBuildEvaluation at index ${i} has Invalid ruleVersion '${cand.ruleVersion}'. Expected '${REQUIRED_STEP21_RULE_VERSION}'.`
      );
    }
    if (cand.memberResonatorIds.length !== TEAM_MEMBER_COUNT) {
      throw new Error(
        `TeamBuildEvaluation '${cand.id}' has invalid member count ${cand.memberResonatorIds.length}.`
      );
    }
    if (seenCandidateIds.has(cand.id)) {
      throw new Error(`Duplicate TeamBuildEvaluation ID '${cand.id}' in candidate pool.`);
    }
    seenCandidateIds.add(cand.id);
  }

  // 5. Resolve Synergy Evaluations Map
  let synergyMap: Map<string, TeamCompositionCandidateEvaluation> | undefined;
  const rawSynergyEvals = input?.synergyEvaluations ?? getTeamCompositionEvaluations();
  if (rawSynergyEvals && rawSynergyEvals.length > 0) {
    synergyMap = new Map();
    for (const syn of rawSynergyEvals) {
      synergyMap.set(syn.candidateId, syn);
    }
  }

  // 6. Execute Deterministic Solver
  const solverResult = solveTeamPortfolio(
    candidateBuildEvals,
    targetK,
    ownedResonatorIds,
    synergyMap,
    allowPartial
  );

  const selectedTeams = solverResult.selectedTeams;
  const selectedTeamCount = selectedTeams.length;
  const isMutuallyDisjoint = areTeamsMutuallyDisjoint(selectedTeams);
  const allMemberResonatorIds = extractPortfolioMemberIds(selectedTeams);

  // 7. Determine Overall Status
  let status: TeamPortfolioStatus;
  if (solverResult.isInfeasible) {
    status = 'INFEASIBLE_PORTFOLIO';
  } else if (solverResult.isPartial) {
    status = 'PARTIAL_PORTFOLIO';
  } else {
    // If all teams are fully equipped, optimal; else feasible
    const allFullyEquipped =
      selectedTeams.length === targetK &&
      selectedTeams.every((t) => t.status === 'FULLY_EQUIPPED');
    status = allFullyEquipped ? 'OPTIMAL_PORTFOLIO' : 'FEASIBLE_PORTFOLIO';
  }

  // 8. Determine Portfolio Build Status
  let buildStatus: TeamPortfolioBuildStatus;
  if (selectedTeamCount === 0) {
    buildStatus = 'UNAVAILABLE';
  } else if (selectedTeams.every((t) => t.status === 'FULLY_EQUIPPED')) {
    buildStatus = 'FULLY_EQUIPPED_PORTFOLIO';
  } else if (selectedTeams.some((t) => t.status === 'INCOMPATIBLE_WEAPON')) {
    buildStatus = 'CONTAINS_INCOMPATIBLE_WEAPON';
  } else if (selectedTeams.every((t) => t.status === 'BUILD_UNKNOWN')) {
    buildStatus = 'BUILD_UNKNOWN_PORTFOLIO';
  } else if (selectedTeams.some((t) => t.status === 'BUILD_UNKNOWN')) {
    buildStatus = 'PARTIALLY_UNKNOWN_PORTFOLIO';
  } else {
    buildStatus = 'PARTIALLY_EQUIPPED_PORTFOLIO';
  }

  // 9. Aggregate Completeness Metrics
  const totalPortfolioAspects = selectedTeamCount * ASPECTS_PER_TEAM;
  let knownPortfolioAspects = 0;
  let unknownPortfolioAspects = 0;
  const teamCompletenessRatios: (number | null)[] = [];

  for (const team of selectedTeams) {
    knownPortfolioAspects += team.completeness.knownTeamAspects;
    unknownPortfolioAspects += team.completeness.unknownTeamAspects;
    teamCompletenessRatios.push(team.completeness.teamCompletenessRatio);
  }

  const allNullRatios =
    teamCompletenessRatios.length > 0 &&
    teamCompletenessRatios.every((r) => r === null);

  const portfolioCompletenessRatio =
    selectedTeamCount === 0 || allNullRatios
      ? null
      : Math.round((knownPortfolioAspects / totalPortfolioAspects) * 10000) / 10000;

  const completeness: TeamPortfolioCompletenessMetrics = Object.freeze({
    targetTeamCount: targetK,
    selectedTeamCount,
    totalPortfolioAspects,
    knownPortfolioAspects,
    unknownPortfolioAspects,
    teamCompletenessRatios: Object.freeze(teamCompletenessRatios),
    portfolioCompletenessRatio
  });

  // 10. Cross-Team Sonata Set Aggregation Facts
  const sonataTeamFreq = new Map<string, number>();
  for (const team of selectedTeams) {
    const teamCodes = new Set(team.sonataInteraction.distinctActiveSonataCodes);
    for (const code of teamCodes) {
      sonataTeamFreq.set(code, (sonataTeamFreq.get(code) ?? 0) + 1);
    }
  }

  const distinctActiveSonataCodes = Object.freeze(
    Array.from(sonataTeamFreq.keys()).sort((a, b) => a.localeCompare(b))
  );

  const crossTeamDuplicateSonataCodes = Object.freeze(
    Array.from(sonataTeamFreq.entries())
      .filter(([_, count]) => count > 1)
      .map(([code]) => code)
      .sort((a, b) => a.localeCompare(b))
  );

  const hasCrossTeamDuplicateSonatas = crossTeamDuplicateSonataCodes.length > 0;

  const crossTeamSonataAggregation: CrossTeamSonataAggregation = Object.freeze({
    distinctActiveSonataCodes,
    crossTeamDuplicateSonataCodes,
    hasCrossTeamDuplicateSonatas,
    stackingStatus: 'UNMODELED'
  });

  // 11. Upstream Synergy Evidence Summary
  let totalSynergyScore = 0;
  let rankedTeamsCount = 0;
  let totalMatchedPairs = 0;
  let totalDirectionalEdges = 0;

  for (const team of selectedTeams) {
    const synEval = synergyMap?.get(team.teamCandidateId);
    if (synEval) {
      if (synEval.totalScore !== null) {
        totalSynergyScore += synEval.totalScore;
        rankedTeamsCount++;
      }
      totalMatchedPairs += synEval.matchedPairCount;
      totalDirectionalEdges += synEval.directionalEdgeCount;
    }
  }

  const roundedTotalSynergyScore =
    rankedTeamsCount > 0 ? Math.round(totalSynergyScore * 100) / 100 : null;

  const averageSynergyScore =
    rankedTeamsCount > 0
      ? Math.round((totalSynergyScore / rankedTeamsCount) * 100) / 100
      : null;

  const synergyEvidenceSummary: PortfolioSynergyEvidenceSummary = Object.freeze({
    totalSynergyScore: roundedTotalSynergyScore,
    rankedTeamsCount,
    totalMatchedPairs,
    totalDirectionalEdges,
    averageSynergyScore
  });

  // 12. Explanation Codes
  const explanationCodes: string[] = [status, `STATUS_${status}`];
  if (isMutuallyDisjoint) {
    explanationCodes.push(TEAM_PORTFOLIO_EXPLANATION_CODES.ALL_TEAMS_MUTUALLY_DISJOINT);
  }
  if (selectedTeamCount > 0) {
    explanationCodes.push(TEAM_PORTFOLIO_EXPLANATION_CODES.ALL_TEAMS_FULLY_OWNED);
  }
  if (buildStatus === 'FULLY_EQUIPPED_PORTFOLIO') {
    explanationCodes.push(TEAM_PORTFOLIO_EXPLANATION_CODES.ALL_TEAMS_FULLY_EQUIPPED);
  } else if (buildStatus === 'CONTAINS_INCOMPATIBLE_WEAPON') {
    explanationCodes.push(TEAM_PORTFOLIO_EXPLANATION_CODES.CONTAINS_INCOMPATIBLE_WEAPON);
  }
  if (hasCrossTeamDuplicateSonatas) {
    explanationCodes.push(TEAM_PORTFOLIO_EXPLANATION_CODES.HAS_CROSS_TEAM_DUPLICATE_SONATAS);
  } else {
    explanationCodes.push(TEAM_PORTFOLIO_EXPLANATION_CODES.NO_CROSS_TEAM_DUPLICATE_SONATAS);
  }
  explanationCodes.push(TEAM_PORTFOLIO_EXPLANATION_CODES.EQUIPMENT_CONTENTION_UNMODELED);

  // 13. Provenance
  const selectedTeamEvaluationIds = Object.freeze(selectedTeams.map((t) => t.id));

  const provenance: TeamPortfolioProvenance = Object.freeze({
    source: 'DERIVED_TEAM_PORTFOLIO',
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_PORTFOLIO_RULE_VERSION,
    targetTeamCount: targetK,
    selectedTeamCount,
    selectedTeamEvaluationIds,
    upstreamBuildEvaluationRuleVersion: REQUIRED_STEP21_RULE_VERSION,
    upstreamSynergyEvaluationRuleVersion: REQUIRED_STEP10_RULE_VERSION,
    upstreamRosterRuleVersion: REQUIRED_STEP12_RULE_VERSION
  });

  // 14. Deterministic Identifier
  const id = deriveTeamPortfolioId(
    selectedTeams.map((t) => t.id),
    targetK,
    CANONICAL_PATCH_VERSION,
    TEAM_PORTFOLIO_RULE_VERSION
  );

  // 15. Search Diagnostic Metrics
  const metrics: TeamPortfolioSearchMetrics = Object.freeze({
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_PORTFOLIO_RULE_VERSION,
    targetK,
    ownedResonatorCount: ownedResonatorIds.size,
    candidatePoolSize: candidateBuildEvals.length,
    eligibleCandidatesCount: candidateBuildEvals.filter((t) =>
      t.memberResonatorIds.every((m) => ownedResonatorIds.has(m))
    ).length,
    combinationsExplored: solverResult.combinationsExplored,
    solverStatus: status,
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });

  const portfolio: TeamPortfolio = Object.freeze({
    id,
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_PORTFOLIO_RULE_VERSION,
    targetTeamCount: targetK,
    selectedTeamCount,
    teams: Object.freeze([...selectedTeams]),
    allMemberResonatorIds,
    isMutuallyDisjoint,
    status,
    buildStatus,
    completeness,
    crossTeamSonataAggregation,
    synergyEvidenceSummary,
    explanationCodes: Object.freeze(explanationCodes),
    infeasibilityReasons: solverResult.infeasibilityReasons.length > 0
      ? Object.freeze([...solverResult.infeasibilityReasons])
      : undefined,
    provenance
  });

  return Object.freeze({
    patchId: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_PORTFOLIO_RULE_VERSION,
    portfolio,
    metrics
  });
}
