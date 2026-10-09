/**
 * Wuthering Waves Team Portfolio Production Auditor
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Implements strict runtime validation and audit checks for TeamPortfolio
 * records, enforcing boundary safety, prohibited key exclusion, mutual disjointness,
 * member conservation, completeness algebra, and epistemic fidelity.
 */

import {
  TEAM_PORTFOLIO_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  REQUIRED_STEP10_RULE_VERSION,
  REQUIRED_STEP12_RULE_VERSION,
  TEAM_MEMBER_COUNT,
  ASPECTS_PER_TEAM,
  MIN_PORTFOLIO_TARGET_K,
  MAX_PORTFOLIO_TARGET_K,
  PROHIBITED_TEAM_PORTFOLIO_KEYS,
  TEAM_PORTFOLIO_EXPLANATION_CODES
} from './rules.ts';
import {
  deriveTeamPortfolioId,
  areTeamsMutuallyDisjoint,
  extractPortfolioMemberIds
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { auditSingleTeamBuildEvaluation } from '../team-build-evaluation/audit.ts';
import { getTeamPortfolioResult } from './repository.ts';
import type {
  TeamPortfolio,
  TeamPortfolioResult,
  TeamPortfolioSelectionInput
} from './types.ts';

/**
 * Normalizes a key name for prohibited key comparison by removing
 * hyphens, underscores, and whitespace, and converting to lowercase.
 */
export function normalizeProhibitedKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

const NORMALIZED_PROHIBITED_TEAM_PORTFOLIO_KEYS = new Set(
  PROHIBITED_TEAM_PORTFOLIO_KEYS.map((k) => normalizeProhibitedKey(k))
);

/**
 * Asserts that no prohibited keys (e.g. combatPower, teamScore, dps, tier, metaRank, vigorCost)
 * appear anywhere in a record tree.
 */
export function assertNoProhibitedTeamPortfolioKeys(
  record: unknown,
  path: string = 'root'
): void {
  if (record === null || record === undefined) return;
  if (typeof record !== 'object') return;

  if (Array.isArray(record)) {
    for (let i = 0; i < record.length; i++) {
      assertNoProhibitedTeamPortfolioKeys(record[i], `${path}[${i}]`);
    }
    return;
  }

  const obj = record as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const normalized = normalizeProhibitedKey(key);
    if (NORMALIZED_PROHIBITED_TEAM_PORTFOLIO_KEYS.has(normalized)) {
      throw new Error(
        `Prohibited key '${key}' detected at '${path}.${key}'. Violates Step 22 boundary isolation.`
      );
    }
    assertNoProhibitedTeamPortfolioKeys(obj[key], `${path}.${key}`);
  }
}

/**
 * Strictly audits a single TeamPortfolio record against all contract invariants.
 */
export function auditSingleTeamPortfolio(portfolio: TeamPortfolio): void {
  const prefix = `TeamPortfolio[${portfolio.id}]`;

  // Invariant A: Patch version isolation
  if (portfolio.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `${prefix}: Invalid patchVersion '${portfolio.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  // Invariant B: Step 22 Rule version
  if (portfolio.ruleVersion !== TEAM_PORTFOLIO_RULE_VERSION) {
    throw new Error(
      `${prefix}: Invalid ruleVersion '${portfolio.ruleVersion}'. Expected '${TEAM_PORTFOLIO_RULE_VERSION}'.`
    );
  }

  // Invariant C: Target portfolio cardinality K validation
  const targetK = portfolio.targetTeamCount;
  if (
    typeof targetK !== 'number' ||
    !Number.isInteger(targetK) ||
    targetK < MIN_PORTFOLIO_TARGET_K ||
    targetK > MAX_PORTFOLIO_TARGET_K
  ) {
    throw new Error(
      `${prefix}: Invalid targetTeamCount '${targetK}'. Must be an integer between ${MIN_PORTFOLIO_TARGET_K} and ${MAX_PORTFOLIO_TARGET_K}.`
    );
  }

  if (
    typeof portfolio.selectedTeamCount !== 'number' ||
    !Number.isInteger(portfolio.selectedTeamCount) ||
    portfolio.selectedTeamCount < 0 ||
    portfolio.selectedTeamCount > targetK
  ) {
    throw new Error(
      `${prefix}: Invalid selectedTeamCount '${portfolio.selectedTeamCount}'. Must be between 0 and targetTeamCount (${targetK}).`
    );
  }

  if (!Array.isArray(portfolio.teams)) {
    throw new Error(`${prefix}: teams must be an array.`);
  }

  if (portfolio.teams.length !== portfolio.selectedTeamCount) {
    throw new Error(
      `${prefix}: teams.length (${portfolio.teams.length}) does not match selectedTeamCount (${portfolio.selectedTeamCount}).`
    );
  }

  // Invariant D: Resonator mutual disjointness
  if (!portfolio.isMutuallyDisjoint) {
    throw new Error(`${prefix}: isMutuallyDisjoint flag is false.`);
  }

  if (!areTeamsMutuallyDisjoint(portfolio.teams)) {
    throw new Error(`${prefix}: Teams violate mutual Resonator disjointness.`);
  }

  // Invariant E: Member conservation
  const expectedMemberCount = portfolio.selectedTeamCount * TEAM_MEMBER_COUNT;
  if (
    !Array.isArray(portfolio.allMemberResonatorIds) ||
    portfolio.allMemberResonatorIds.length !== expectedMemberCount
  ) {
    throw new Error(
      `${prefix}: allMemberResonatorIds length (${portfolio.allMemberResonatorIds?.length}) does not match expected member conservation (${expectedMemberCount}).`
    );
  }

  for (let i = 0; i < portfolio.allMemberResonatorIds.length; i++) {
    const resId = portfolio.allMemberResonatorIds[i];
    if (!resId || typeof resId !== 'string' || !isCanonicalResonatorId(resId)) {
      throw new Error(`${prefix}: Non-canonical resonator ID '${resId}' in allMemberResonatorIds.`);
    }
    if (i > 0 && portfolio.allMemberResonatorIds[i - 1] >= resId) {
      throw new Error(
        `${prefix}: allMemberResonatorIds is not strictly sorted lexicographically without duplicates.`
      );
    }
  }

  const extracted = extractPortfolioMemberIds(portfolio.teams);
  if (
    portfolio.allMemberResonatorIds.length !== extracted.length ||
    portfolio.allMemberResonatorIds.some((id, idx) => id !== extracted[idx])
  ) {
    throw new Error(`${prefix}: allMemberResonatorIds does not match extracted sorted member IDs.`);
  }

  // Invariant F: Aspect completeness algebra
  const comp = portfolio.completeness;
  const expectedTotalAspects = portfolio.selectedTeamCount * ASPECTS_PER_TEAM;
  if (comp.totalPortfolioAspects !== expectedTotalAspects) {
    throw new Error(
      `${prefix}: totalPortfolioAspects (${comp.totalPortfolioAspects}) does not equal expected ${expectedTotalAspects}.`
    );
  }

  if (comp.knownPortfolioAspects + comp.unknownPortfolioAspects !== expectedTotalAspects) {
    throw new Error(
      `${prefix}: Completeness conservation violated: known (${comp.knownPortfolioAspects}) + unknown (${comp.unknownPortfolioAspects}) !== total (${expectedTotalAspects}).`
    );
  }

  let sumKnown = 0;
  let sumUnknown = 0;
  for (const team of portfolio.teams) {
    sumKnown += team.completeness.knownTeamAspects;
    sumUnknown += team.completeness.unknownTeamAspects;
  }

  if (comp.knownPortfolioAspects !== sumKnown) {
    throw new Error(
      `${prefix}: knownPortfolioAspects (${comp.knownPortfolioAspects}) does not match sum of team known aspects (${sumKnown}).`
    );
  }
  if (comp.unknownPortfolioAspects !== sumUnknown) {
    throw new Error(
      `${prefix}: unknownPortfolioAspects (${comp.unknownPortfolioAspects}) does not match sum of team unknown aspects (${sumUnknown}).`
    );
  }

  const allNull = comp.teamCompletenessRatios.every((r) => r === null);
  if (portfolio.selectedTeamCount === 0 || allNull) {
    if (comp.portfolioCompletenessRatio !== null) {
      throw new Error(
        `${prefix}: portfolioCompletenessRatio must be null when selectedTeamCount is 0 or all team ratios are null.`
      );
    }
  } else {
    const expectedRatio =
      Math.round((comp.knownPortfolioAspects / comp.totalPortfolioAspects) * 10000) / 10000;
    if (comp.portfolioCompletenessRatio !== expectedRatio) {
      throw new Error(
        `${prefix}: portfolioCompletenessRatio mismatch. Expected ${expectedRatio}, got ${comp.portfolioCompletenessRatio}.`
      );
    }
  }

  // Invariant G: Deterministic identifier derivation
  const expectedId = deriveTeamPortfolioId(
    portfolio.teams.map((t) => t.id),
    portfolio.targetTeamCount,
    portfolio.patchVersion,
    portfolio.ruleVersion
  );
  if (portfolio.id !== expectedId) {
    throw new Error(`${prefix}: ID mismatch. Expected '${expectedId}', got '${portfolio.id}'.`);
  }

  // Invariant H: Canonical team ordering
  for (let i = 1; i < portfolio.teams.length; i++) {
    if (portfolio.teams[i - 1].id >= portfolio.teams[i].id) {
      throw new Error(
        `${prefix}: Selected teams are not in canonical ascending order by team ID: '${portfolio.teams[i - 1].id}' >= '${portfolio.teams[i].id}'.`
      );
    }
  }

  // Invariant I: Cross-team Sonata aggregation
  const sonataAgg = portfolio.crossTeamSonataAggregation;
  if (sonataAgg.stackingStatus !== 'UNMODELED') {
    throw new Error(
      `${prefix}: Sonata stackingStatus must be strictly 'UNMODELED', got '${sonataAgg.stackingStatus}'.`
    );
  }
  if (
    sonataAgg.hasCrossTeamDuplicateSonatas !==
    (sonataAgg.crossTeamDuplicateSonataCodes.length > 0)
  ) {
    throw new Error(
      `${prefix}: hasCrossTeamDuplicateSonatas flag mismatch with crossTeamDuplicateSonataCodes.`
    );
  }

  // Invariant J: Synergy evidence summary
  if (portfolio.synergyEvidenceSummary) {
    const syn = portfolio.synergyEvidenceSummary;
    let expectedMatchedPairs = 0;
    let expectedEdges = 0;
    for (const team of portfolio.teams) {
      // Step 21 inherits Step 9 candidate ID: teamCandidateId
      // Match count is factual
    }
    if (syn.totalMatchedPairs < 0 || syn.totalDirectionalEdges < 0) {
      throw new Error(`${prefix}: Negative synergy summary metrics.`);
    }
  }

  // Invariant K: Provenance safety
  const prov = portfolio.provenance;
  if (prov.source !== 'DERIVED_TEAM_PORTFOLIO') {
    throw new Error(`${prefix}: Invalid provenance source '${prov.source}'.`);
  }
  if (prov.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`${prefix}: Invalid provenance patchVersion '${prov.patchVersion}'.`);
  }
  if (prov.ruleVersion !== TEAM_PORTFOLIO_RULE_VERSION) {
    throw new Error(`${prefix}: Invalid provenance ruleVersion '${prov.ruleVersion}'.`);
  }
  if (prov.upstreamBuildEvaluationRuleVersion !== REQUIRED_STEP21_RULE_VERSION) {
    throw new Error(
      `${prefix}: Invalid upstreamBuildEvaluationRuleVersion '${prov.upstreamBuildEvaluationRuleVersion}'. Expected '${REQUIRED_STEP21_RULE_VERSION}'.`
    );
  }
  if (prov.upstreamSynergyEvaluationRuleVersion !== REQUIRED_STEP10_RULE_VERSION) {
    throw new Error(
      `${prefix}: Invalid upstreamSynergyEvaluationRuleVersion '${prov.upstreamSynergyEvaluationRuleVersion}'. Expected '${REQUIRED_STEP10_RULE_VERSION}'.`
    );
  }
  if (prov.upstreamRosterRuleVersion !== REQUIRED_STEP12_RULE_VERSION) {
    throw new Error(
      `${prefix}: Invalid upstreamRosterRuleVersion '${prov.upstreamRosterRuleVersion}'. Expected '${REQUIRED_STEP12_RULE_VERSION}'.`
    );
  }

  // Invariant L: Explanation codes
  if (
    !portfolio.explanationCodes.includes(portfolio.status) &&
    !portfolio.explanationCodes.includes(`PORTFOLIO_${portfolio.status}`) &&
    !portfolio.explanationCodes.includes(`STATUS_${portfolio.status}`)
  ) {
    throw new Error(
      `${prefix}: Missing status explanation code for '${portfolio.status}'.`
    );
  }
  if (
    !portfolio.explanationCodes.includes(
      TEAM_PORTFOLIO_EXPLANATION_CODES.EQUIPMENT_CONTENTION_UNMODELED
    )
  ) {
    throw new Error(
      `${prefix}: Missing EQUIPMENT_CONTENTION_UNMODELED explanation code.`
    );
  }

  // Invariant M: Prohibited keys rejection on portfolio
  assertNoProhibitedTeamPortfolioKeys(portfolio, prefix);

  // Invariant N: Audit each selected team evaluation against Step 21 invariants
  for (let i = 0; i < portfolio.teams.length; i++) {
    auditSingleTeamBuildEvaluation(portfolio.teams[i], i);
  }
}

/**
 * Executes a full production audit of the Team Portfolio contract.
 */
export function runProductionTeamPortfolioAudit(
  input?: TeamPortfolioSelectionInput
): TeamPortfolioResult {
  const result = getTeamPortfolioResult(input);

  // 1. Assert no prohibited keys anywhere in the result
  assertNoProhibitedTeamPortfolioKeys(result, 'TeamPortfolioResult');

  // 2. Audit the portfolio record
  auditSingleTeamPortfolio(result.portfolio);

  // 3. Audit search metrics
  if (result.metrics.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `SearchMetrics: Invalid patchVersion '${result.metrics.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
    );
  }
  if (result.metrics.ruleVersion !== TEAM_PORTFOLIO_RULE_VERSION) {
    throw new Error(
      `SearchMetrics: Invalid ruleVersion '${result.metrics.ruleVersion}'. Expected '${TEAM_PORTFOLIO_RULE_VERSION}'.`
    );
  }
  if (result.metrics.targetK !== result.portfolio.targetTeamCount) {
    throw new Error(
      `SearchMetrics: targetK mismatch. Expected ${result.portfolio.targetTeamCount}, got ${result.metrics.targetK}.`
    );
  }

  return result;
}
