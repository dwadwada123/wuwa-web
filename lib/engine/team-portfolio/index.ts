/**
 * Wuthering Waves Deterministic Team Portfolio Barrel Export
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Re-exports public types, rules, predicates, solver, builder, repository APIs,
 * auditor, and presentation utilities for Step 22.
 */

export * from './types.ts';
export {
  TEAM_PORTFOLIO_RULE_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  REQUIRED_STEP10_RULE_VERSION,
  REQUIRED_STEP12_RULE_VERSION,
  DEFAULT_PORTFOLIO_TARGET_K,
  MIN_PORTFOLIO_TARGET_K,
  MAX_PORTFOLIO_TARGET_K,
  ASPECTS_PER_TEAM,
  TEAM_PORTFOLIO_EXPLANATION_CODES,
  EMPTY_TEAM_PORTFOLIO_PROVENANCE,
  PROHIBITED_TEAM_PORTFOLIO_KEYS,
  type ProhibitedTeamPortfolioKey
} from './rules.ts';
export * from './predicates.ts';
export * from './solver.ts';
export * from './builder.ts';
export * from './repository.ts';
export {
  normalizeProhibitedKey as normalizeTeamPortfolioProhibitedKey,
  assertNoProhibitedTeamPortfolioKeys,
  auditSingleTeamPortfolio,
  runProductionTeamPortfolioAudit
} from './audit.ts';

import type { TeamPortfolio } from './types.ts';

/**
 * Formats a factual, human-readable presentation explanation for a
 * TeamPortfolio record.
 * Never introduces subjective judgments, power scores, or tier ratings.
 */
export function formatTeamPortfolioExplanation(portfolio: TeamPortfolio): string {
  const lines: string[] = [
    `Team Portfolio: ${portfolio.id}`,
    `Status: ${portfolio.status} (Selected: ${portfolio.selectedTeamCount}/${portfolio.targetTeamCount} teams)`,
    `Build Status: ${portfolio.buildStatus}`,
    `Resonator Disjointness: ${portfolio.isMutuallyDisjoint ? 'MUTUALLY DISJOINT' : 'OVERLAPPING'} (${portfolio.allMemberResonatorIds.length} Resonators)`
  ];

  const comp = portfolio.completeness;
  lines.push(
    `Completeness: ${comp.portfolioCompletenessRatio !== null ? (comp.portfolioCompletenessRatio * 100).toFixed(1) + '%' : 'UNKNOWN'} (${comp.knownPortfolioAspects}/${comp.totalPortfolioAspects} aspects known)`
  );

  const sonata = portfolio.crossTeamSonataAggregation;
  lines.push(
    `Cross-Team Sonatas: [${sonata.distinctActiveSonataCodes.join(', ')}] (Duplicates: ${sonata.hasCrossTeamDuplicateSonatas ? sonata.crossTeamDuplicateSonataCodes.join(', ') : 'None'}, Stacking: ${sonata.stackingStatus})`
  );

  if (portfolio.synergyEvidenceSummary) {
    const syn = portfolio.synergyEvidenceSummary;
    lines.push(
      `Synergy Evidence: Total Score: ${syn.totalSynergyScore ?? 'N/A'}, Pairs: ${syn.totalMatchedPairs}, Edges: ${syn.totalDirectionalEdges}`
    );
  }

  lines.push(`Notice: Equipment contention across teams is unmodeled.`);

  return lines.join('\n');
}
