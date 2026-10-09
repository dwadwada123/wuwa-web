/**
 * Wuthering Waves Deterministic Recommendation Orchestration Builder
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Implements deterministic end-to-end pipeline orchestration, input snapshot processing,
 * status derivation, metrics aggregation, and result building across Steps 19–23.
 */

import {
  RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  DEFAULT_PORTFOLIO_TARGET_K,
  REQUIRED_STEP19_RULE_VERSION,
  REQUIRED_STEP20_RULE_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  REQUIRED_STEP22_RULE_VERSION,
  REQUIRED_STEP23_RULE_VERSION,
  RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  deepClone,
  deepFreeze,
  deriveSnapshotFingerprint,
  deriveRecommendationOrchestrationId,
  validateRecommendationOrchestrationInput,
  assertNoProhibitedRecommendationKeys
} from './predicates.ts';
import {
  getCharacterBuildEvaluationResult,
  getAllCharacterBuildEvaluations
} from '../character-build-evaluation/repository.ts';
import { buildTeamBuildEvaluations } from '../team-build-evaluation/builder.ts';
import { getAllTeamBuildEvaluations } from '../team-build-evaluation/repository.ts';
import { selectTeamPortfolio } from '../team-portfolio/builder.ts';
import { allocateToAStages } from '../toa-allocation/builder.ts';
import { getCanonicalSeason40Stages } from '../toa-allocation/repository.ts';
import { getKnownResonatorIds } from '../team-composition/repository.ts';
import type { CharacterBuildEvaluation } from '../character-build-evaluation/types.ts';
import type { TeamBuildEvaluation } from '../team-build-evaluation/types.ts';
import type {
  RecommendationOrchestrationInput,
  RecommendationOrchestrationResult,
  RecommendationOrchestrationStatus,
  ValidatedInputSnapshotSummary,
  RecommendationOrchestrationMetrics,
  RecommendationOrchestrationProvenance,
  EndToEndRecommendation,
  OwnedRosterSnapshot,
  ResonatorInvestmentSnapshot
} from './types.ts';

/**
 * Orchestrates an end-to-end recommendation pipeline across character builds,
 * disjoint portfolio optimization, and ToA Vigor stage allocation.
 */
export function orchestrateRecommendations(
  input?: RecommendationOrchestrationInput
): RecommendationOrchestrationResult {
  // 1. Strict input validation
  validateRecommendationOrchestrationInput(input);

  const patchVersion = CANONICAL_PATCH_VERSION;
  const ruleVersion = RECOMMENDATION_ORCHESTRATION_RULE_VERSION;
  const seasonId: typeof CANONICAL_SEASON_ID = (input?.seasonId as typeof CANONICAL_SEASON_ID) ?? CANONICAL_SEASON_ID;
  const targetK = input?.targetK ?? DEFAULT_PORTFOLIO_TARGET_K;
  const allowPartial = input?.allowPartial ?? false;

  // 2. Resolve canonical owned Resonator roster
  let ownedResonatorIds: readonly string[];
  if (input?.ownedRoster !== undefined) {
    let rawIds: readonly string[];
    if (Array.isArray(input.ownedRoster)) {
      rawIds = input.ownedRoster;
    } else {
      rawIds = (input.ownedRoster as OwnedRosterSnapshot).ownedResonatorIds;
    }
    const deduplicated = Array.from(new Set(rawIds)).sort((a, b) => a.localeCompare(b));
    ownedResonatorIds = Object.freeze(deduplicated);
  } else {
    // Default: full canonical Patch 3.7 roster
    ownedResonatorIds = Object.freeze(
      Array.from(new Set(getKnownResonatorIds())).sort((a, b) => a.localeCompare(b))
    );
  }

  // 3. Resolve target stage IDs
  let targetStageIds: readonly string[];
  if (input?.targetStageIds !== undefined) {
    targetStageIds = Object.freeze([...input.targetStageIds]);
  } else {
    const fullStages = getCanonicalSeason40Stages();
    targetStageIds = Object.freeze(fullStages.map((s) => s.stageId));
  }

  // 4. Calculate input snapshot summary and deterministic fingerprint
  const investmentCount = input?.investmentSnapshots ? input.investmentSnapshots.length : 0;
  const investmentSnapshots: readonly ResonatorInvestmentSnapshot[] = input?.investmentSnapshots
    ? Object.freeze([...input.investmentSnapshots].sort((a, b) => a.resonatorId.localeCompare(b.resonatorId)))
    : Object.freeze([]);

  const snapshotSummaryBase = {
    patchVersion: CANONICAL_PATCH_VERSION as '3.7',
    seasonId,
    ownedResonatorCount: ownedResonatorIds.length,
    ownedResonatorIds,
    investmentSnapshotCount: investmentCount,
    investmentSnapshots,
    targetK,
    targetStageCount: targetStageIds.length,
    targetStageIds,
    allowPartial
  };
  const snapshotFingerprint = deriveSnapshotFingerprint(snapshotSummaryBase);
  const inputSnapshot: ValidatedInputSnapshotSummary = Object.freeze({
    ...snapshotSummaryBase,
    snapshotFingerprint
  });

  // 5. Early Boundary: Insufficient roster (< 3 Resonators cannot form a team)
  if (ownedResonatorIds.length < 3) {
    const status: RecommendationOrchestrationStatus = 'INSUFFICIENT_ROSTER';
    const id = deriveRecommendationOrchestrationId(
      status,
      snapshotFingerprint,
      seasonId,
      patchVersion,
      ruleVersion
    );

    const explanationCodes = [
      RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES.STATUS_INSUFFICIENT_ROSTER
    ];
    const infeasibilityReasons = [
      'Owned roster has fewer than 3 Resonators. Minimum 3 distinct Resonators required to form a single team candidate.'
    ];

    const provenance: RecommendationOrchestrationProvenance = Object.freeze({
      source: 'DERIVED_END_TO_END_RECOMMENDATION',
      patchVersion: CANONICAL_PATCH_VERSION,
      ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
      seasonId,
      snapshotFingerprint,
      step19RuleVersion: REQUIRED_STEP19_RULE_VERSION,
      step20RuleVersion: REQUIRED_STEP20_RULE_VERSION,
      step21RuleVersion: REQUIRED_STEP21_RULE_VERSION,
      step22RuleVersion: REQUIRED_STEP22_RULE_VERSION,
      step23RuleVersion: REQUIRED_STEP23_RULE_VERSION,
      portfolioId: null,
      toaAllocationId: null,
      allowPartial,
      allRequestedStagesCovered: false,
      hasFallbackEquipment: false
    });

    const metrics: RecommendationOrchestrationMetrics = Object.freeze({
      patchVersion: CANONICAL_PATCH_VERSION,
      ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
      seasonId,
      ownedResonatorCount: ownedResonatorIds.length,
      evaluatedCharacterCount: 0,
      selectedTeamCount: 0,
      targetTeamCount: targetK,
      assignedStageCount: 0,
      targetStageCount: targetStageIds.length,
      stageCoverageRatio: 0,
      totalVigorConsumed: 0,
      distinctResonatorsUsedCount: 0,
      verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
    });

    const recommendation: EndToEndRecommendation = Object.freeze({
      id,
      patchVersion: CANONICAL_PATCH_VERSION,
      ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
      seasonId,
      status,
      inputSnapshot,
      characterBuildEvaluations: Object.freeze([]),
      portfolio: null,
      toaAllocation: null,
      explanationCodes: Object.freeze(explanationCodes),
      infeasibilityReasons: Object.freeze(infeasibilityReasons),
      provenance
    });

    const result: RecommendationOrchestrationResult = Object.freeze({
      patchId: CANONICAL_PATCH_VERSION,
      ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
      seasonId,
      recommendation,
      metrics
    });

    const frozen = deepFreeze(deepClone(result));
    assertNoProhibitedRecommendationKeys(frozen);
    return frozen;
  }

  // 6. Stage 1 & 2: Character Build & Team Build Evaluations (Step 20 & Step 21)
  let allCharacterBuildEvaluations: readonly CharacterBuildEvaluation[];
  let teamBuildEvaluations: readonly TeamBuildEvaluation[];

  if (input?.investmentSnapshots && input.investmentSnapshots.length > 0) {
    const charBuildResult = getCharacterBuildEvaluationResult({
      patchId: CANONICAL_PATCH_VERSION,
      investmentSnapshots: input.investmentSnapshots
    });
    allCharacterBuildEvaluations = charBuildResult.evaluations;

    const teamBuildResult = buildTeamBuildEvaluations({
      patchId: CANONICAL_PATCH_VERSION,
      characterBuildEvaluations: allCharacterBuildEvaluations
    });
    teamBuildEvaluations = teamBuildResult.evaluations;
  } else {
    allCharacterBuildEvaluations = getAllCharacterBuildEvaluations();
    teamBuildEvaluations = getAllTeamBuildEvaluations();
  }

  // Preserve and embed only the evaluated character builds for the owned roster
  const ownedSet = new Set(ownedResonatorIds);
  const characterBuildEvaluations = Object.freeze(
    allCharacterBuildEvaluations.filter((ev) => ownedSet.has(ev.resonatorId))
  );

  // 7. Stage 3: Team Portfolio Selection & Optimization (Step 22)
  const portfolioInput = {
    patchId: CANONICAL_PATCH_VERSION,
    targetK,
    ownedRoster: ownedResonatorIds,
    teamBuildEvaluations,
    allowPartial
  };
  const portfolioResult = selectTeamPortfolio(portfolioInput);
  const portfolio = portfolioResult.portfolio;

  // 8. Stage 4: Tower of Adversity Vigor Allocation & Scheduling (Step 23)
  const toaInput = {
    patchId: CANONICAL_PATCH_VERSION,
    seasonId,
    portfolio,
    ownedRoster: ownedResonatorIds,
    targetStageIds,
    allowPartial
  };
  const toaResult = allocateToAStages(toaInput);
  const toaAllocation = toaResult.allocation;

  // 9. Derive Aggregate Recommendation Status (Fail-Closed)
  let status: RecommendationOrchestrationStatus;
  let infeasibilityReasons: string[] | undefined = undefined;

  const portfolioStatus = portfolio.status as string;
  const toaStatus = toaAllocation.status as string;

  if (
    portfolioStatus === 'INVALID_PORTFOLIO' ||
    portfolioStatus === 'PATCH_MISMATCH' ||
    portfolioStatus === 'INVALID' ||
    toaStatus === 'PATCH_MISMATCH' ||
    toaStatus === 'INVALID'
  ) {
    status = 'UPSTREAM_EVALUATION_FAILED';
    infeasibilityReasons = [
      `Upstream evaluation returned invalid or mismatched status: portfolio='${portfolioStatus}', toa='${toaStatus}'.`
    ];
  } else if (portfolio.status === 'INFEASIBLE_PORTFOLIO') {
    status = 'NO_FEASIBLE_PORTFOLIO';
    infeasibilityReasons = portfolio.infeasibilityReasons
      ? [...portfolio.infeasibilityReasons]
      : ['Could not construct requested portfolio teams within owned roster constraints.'];
  } else if (toaAllocation.status === 'INFEASIBLE_ALLOCATION') {
    status = 'NO_FEASIBLE_ALLOCATION';
    infeasibilityReasons = toaAllocation.infeasibilityReasons
      ? [...toaAllocation.infeasibilityReasons]
      : ['Could not allocate requested target stages within Resonator Vigor capacities.'];
  } else if (
    toaAllocation.status === 'PARTIAL_ALLOCATION' ||
    portfolio.status === 'PARTIAL_PORTFOLIO'
  ) {
    if (allowPartial) {
      status = 'PARTIAL_RECOMMENDATION';
    } else {
      status = 'NO_FEASIBLE_ALLOCATION';
      infeasibilityReasons = ['Partial allocation occurred but allowPartial is false.'];
    }
  } else if (
    portfolio.status === 'OPTIMAL_PORTFOLIO' &&
    toaAllocation.status === 'OPTIMAL_ALLOCATION' &&
    toaAllocation.completeness.assignedStageCount === targetStageIds.length &&
    targetStageIds.length > 0
  ) {
    status = 'OPTIMAL_RECOMMENDATION';
  } else if (
    (portfolio.status === 'OPTIMAL_PORTFOLIO' || portfolio.status === 'FEASIBLE_PORTFOLIO') &&
    (toaAllocation.status === 'OPTIMAL_ALLOCATION' || toaAllocation.status === 'FEASIBLE_ALLOCATION') &&
    toaAllocation.completeness.assignedStageCount === targetStageIds.length &&
    targetStageIds.length > 0
  ) {
    status = 'FEASIBLE_RECOMMENDATION';
  } else {
    // Fail closed on any unrecognized or contradictory status
    status = 'UPSTREAM_EVALUATION_FAILED';
    infeasibilityReasons = [
      `Unrecognized or contradictory upstream status combination: portfolio='${portfolioStatus}', toa='${toaStatus}'.`
    ];
  }

  // 10. Assemble Explanation Codes
  const explanationCodes: string[] = [
    `STATUS_${status}`,
    RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES.ALL_RESONATOR_VIGOR_PRESERVED,
    RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES.PORTFOLIO_CONSTRUCTIBILITY_VERIFIED
  ];

  if (toaAllocation.status === 'OPTIMAL_ALLOCATION') {
    explanationCodes.push(RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES.STAGE_ALLOCATION_OPTIMAL);
  } else if (toaAllocation.status === 'FEASIBLE_ALLOCATION') {
    explanationCodes.push(RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES.STAGE_ALLOCATION_FEASIBLE);
  } else if (toaAllocation.status === 'PARTIAL_ALLOCATION') {
    explanationCodes.push(RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES.STAGE_ALLOCATION_PARTIAL);
  } else {
    explanationCodes.push(RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES.STAGE_ALLOCATION_INFEASIBLE);
  }

  // 11. Assemble Provenance
  const allRequestedStagesCovered =
    toaAllocation.completeness.assignedStageCount === targetStageIds.length &&
    targetStageIds.length > 0;
  const hasFallbackEquipment =
    portfolio.buildStatus !== 'FULLY_EQUIPPED_PORTFOLIO' ||
    toaAllocation.status === 'FEASIBLE_ALLOCATION';

  const provenance: RecommendationOrchestrationProvenance = Object.freeze({
    source: 'DERIVED_END_TO_END_RECOMMENDATION',
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
    seasonId,
    snapshotFingerprint,
    step19RuleVersion: REQUIRED_STEP19_RULE_VERSION,
    step20RuleVersion: REQUIRED_STEP20_RULE_VERSION,
    step21RuleVersion: REQUIRED_STEP21_RULE_VERSION,
    step22RuleVersion: REQUIRED_STEP22_RULE_VERSION,
    step23RuleVersion: REQUIRED_STEP23_RULE_VERSION,
    portfolioId: portfolio.id,
    toaAllocationId: toaAllocation.id,
    allowPartial,
    allRequestedStagesCovered,
    hasFallbackEquipment
  });

  // 12. Assemble Metrics
  const targetStageCount = targetStageIds.length;
  const assignedStageCount = toaAllocation.completeness.assignedStageCount;
  const stageCoverageRatio = targetStageCount > 0 ? assignedStageCount / targetStageCount : 0;

  const metrics: RecommendationOrchestrationMetrics = Object.freeze({
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
    seasonId,
    ownedResonatorCount: ownedResonatorIds.length,
    evaluatedCharacterCount: characterBuildEvaluations.length,
    selectedTeamCount: portfolio.selectedTeamCount,
    targetTeamCount: targetK,
    assignedStageCount,
    targetStageCount,
    stageCoverageRatio,
    totalVigorConsumed: toaAllocation.completeness.totalVigorConsumed,
    distinctResonatorsUsedCount: toaAllocation.distinctResonatorsUsedCount,
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });

  // 13. Assemble Unique Identifier
  const id = deriveRecommendationOrchestrationId(
    status,
    snapshotFingerprint,
    seasonId,
    patchVersion,
    ruleVersion
  );

  // 14. Assemble Core Recommendation
  const recommendation: EndToEndRecommendation = Object.freeze({
    id,
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
    seasonId,
    status,
    inputSnapshot,
    characterBuildEvaluations,
    portfolio,
    toaAllocation,
    explanationCodes: Object.freeze(explanationCodes),
    infeasibilityReasons: infeasibilityReasons ? Object.freeze(infeasibilityReasons) : undefined,
    provenance
  });

  const result: RecommendationOrchestrationResult = Object.freeze({
    patchId: CANONICAL_PATCH_VERSION,
    ruleVersion: RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
    seasonId,
    recommendation,
    metrics
  });

  // 15. Cycle-safe deep freeze and deep clone
  const deeplyFrozenResult = deepFreeze(deepClone(result));
  assertNoProhibitedRecommendationKeys(deeplyFrozenResult);
  return deeplyFrozenResult;
}
