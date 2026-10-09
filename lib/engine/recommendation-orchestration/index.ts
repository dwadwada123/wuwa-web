/**
 * Wuthering Waves Deterministic End-to-End Recommendation Orchestration Contract
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Barrel export and factual presentation explanation formatter.
 */

export * from './types.ts';
export {
  RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
  RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES,
  PROHIBITED_RECOMMENDATION_KEYS,
  type ProhibitedRecommendationKey,
  PROHIBITED_RECOMMENDATION_ORCHESTRATION_KEYS,
  type ProhibitedRecommendationOrchestrationKey
} from './rules.ts';

export {
  deriveSnapshotFingerprint,
  deriveRecommendationOrchestrationId,
  validateRecommendationOrchestrationInput,
  assertNoProhibitedRecommendationKeys
} from './predicates.ts';

export { orchestrateRecommendations } from './builder.ts';

export {
  clearRecommendationOrchestrationCache,
  getRecommendationOrchestrationResult,
  getDefaultEndToEndRecommendation,
  orchestrateRecommendationsForRoster
} from './repository.ts';

export {
  auditSingleRecommendationOrchestration,
  auditRecommendationOrchestrationResult,
  type RecommendationOrchestrationAuditViolation,
  type RecommendationOrchestrationAuditReport
} from './audit.ts';

import type { EndToEndRecommendation } from './types.ts';

/**
 * Formats a factual, human-readable presentation explanation for an EndToEndRecommendation record.
 * Never introduces subjective judgments, combat power, DPS, or tier ratings.
 */
export function formatRecommendationOrchestrationExplanation(
  rec: EndToEndRecommendation
): string {
  const snap = rec.inputSnapshot;
  const lines: string[] = [
    `=== END-TO-END RECOMMENDATION PIPELINE (${rec.seasonId} - Patch ${rec.patchVersion}) ===`,
    `Recommendation ID: ${rec.id}`,
    `Rule Version: ${rec.ruleVersion}`,
    `Status: ${rec.status}`,
    `Owned Roster: ${snap.ownedResonatorCount} Resonators, ${snap.investmentSnapshotCount} investment records`,
    `Target Constraints: K=${snap.targetK} teams, ${snap.targetStageCount} stages (allowPartial: ${snap.allowPartial})`
  ];

  if (rec.portfolio) {
    lines.push(`Selected Portfolio (${rec.portfolio.selectedTeamCount} teams, status: ${rec.portfolio.status}):`);
    for (let i = 0; i < rec.portfolio.teams.length; i++) {
      const t = rec.portfolio.teams[i];
      lines.push(`  • [Team ${i + 1}] ${t.memberResonatorIds.join(' + ')} (Status: ${t.status})`);
    }
  } else {
    lines.push('Selected Portfolio: NONE');
  }

  if (rec.toaAllocation) {
    const completeness = rec.toaAllocation.completeness;
    lines.push(
      `Tower of Adversity Allocation (${completeness.assignedStageCount}/${completeness.targetStageCount} stages, status: ${rec.toaAllocation.status}):`
    );
    lines.push(
      `  • Vigor Consumed: ${completeness.totalVigorConsumed} across ${rec.toaAllocation.distinctResonatorsUsedCount} Resonators`
    );
    for (const a of rec.toaAllocation.assignments) {
      if (a.isAssigned && a.team) {
        lines.push(
          `  • [${a.stage.towerName} F${a.stage.stageIndex}] -> ${a.team.memberResonatorIds.join(' + ')} (Vigor Cost: ${a.vigorCost})`
        );
      } else {
        lines.push(
          `  • [${a.stage.towerName} F${a.stage.stageIndex}] -> UNASSIGNED`
        );
      }
    }
  } else {
    lines.push('Tower of Adversity Allocation: NONE');
  }

  if (rec.infeasibilityReasons && rec.infeasibilityReasons.length > 0) {
    lines.push('Infeasibility Reasons:');
    for (const r of rec.infeasibilityReasons) {
      lines.push(`  • ${r}`);
    }
  }

  lines.push('Audit Notice: All upstream contracts (Steps 19-23) deterministically verified without LLM mutation.');
  lines.push('================================================================================');

  return lines.join('\n');
}
