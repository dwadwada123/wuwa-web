/**
 * Wuthering Waves Deterministic Recommendation Orchestration Audit
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Provides independent, adversarial verification of EndToEndRecommendation and
 * RecommendationOrchestrationResult records, checking cross-contract linkages,
 * provenance identity, ownership constraints, status consistency,
 * Vigor accounting alignment, derivable metrics re-computation, and absence of prohibited keys.
 */

import {
  RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  REQUIRED_STEP19_RULE_VERSION,
  REQUIRED_STEP20_RULE_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  REQUIRED_STEP22_RULE_VERSION,
  REQUIRED_STEP23_RULE_VERSION,
  MAX_RESONATOR_VIGOR,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  assertNoProhibitedRecommendationKeys,
  deriveSnapshotFingerprint,
  deriveRecommendationOrchestrationId
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { auditSingleTeamPortfolio } from '../team-portfolio/audit.ts';
import { auditSingleToAAllocation } from '../toa-allocation/audit.ts';
import type { TeamBuildEvaluation } from '../team-build-evaluation/types.ts';
import type { CharacterBuildEvaluation } from '../character-build-evaluation/types.ts';
import type {
  EndToEndRecommendation,
  RecommendationOrchestrationResult,
  RecommendationOrchestrationStatus
} from './types.ts';

export interface RecommendationOrchestrationAuditViolation {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export interface RecommendationOrchestrationAuditReport {
  readonly isValid: boolean;
  readonly recommendationId: string;
  readonly status: RecommendationOrchestrationStatus;
  readonly violations: readonly RecommendationOrchestrationAuditViolation[];
  readonly verifiedAt: string;
}

/**
 * Independently audits an EndToEndRecommendation record against all contract invariants.
 */
export function auditSingleRecommendationOrchestration(
  recommendation: EndToEndRecommendation
): RecommendationOrchestrationAuditReport {
  const violations: RecommendationOrchestrationAuditViolation[] = [];

  // 1. Prohibited keys audit
  try {
    assertNoProhibitedRecommendationKeys(recommendation);
  } catch (err) {
    violations.push({
      code: 'PROHIBITED_KEY_DETECTED',
      message: (err as Error).message
    });
  }

  // 2. Identity and version invariants
  if (recommendation.patchVersion !== CANONICAL_PATCH_VERSION) {
    violations.push({
      code: 'PATCH_MISMATCH',
      message: `recommendation.patchVersion '${recommendation.patchVersion}' !== '${CANONICAL_PATCH_VERSION}'`
    });
  }
  if (recommendation.ruleVersion !== RECOMMENDATION_ORCHESTRATION_RULE_VERSION) {
    violations.push({
      code: 'RULE_VERSION_MISMATCH',
      message: `recommendation.ruleVersion '${recommendation.ruleVersion}' !== '${RECOMMENDATION_ORCHESTRATION_RULE_VERSION}'`
    });
  }
  if (recommendation.seasonId !== CANONICAL_SEASON_ID) {
    violations.push({
      code: 'SEASON_MISMATCH',
      message: `recommendation.seasonId '${recommendation.seasonId}' !== '${CANONICAL_SEASON_ID}'`
    });
  }

  // 3. Provenance verification
  const prov = recommendation.provenance;
  if (!prov || prov.source !== 'DERIVED_END_TO_END_RECOMMENDATION') {
    violations.push({
      code: 'INVALID_PROVENANCE_SOURCE',
      message: `Provenance source '${prov?.source}' is invalid.`
    });
  }
  if (prov.step19RuleVersion !== REQUIRED_STEP19_RULE_VERSION) {
    violations.push({
      code: 'UPSTREAM_RULE_MISMATCH',
      message: `step19RuleVersion '${prov.step19RuleVersion}' !== '${REQUIRED_STEP19_RULE_VERSION}'`
    });
  }
  if (prov.step20RuleVersion !== REQUIRED_STEP20_RULE_VERSION) {
    violations.push({
      code: 'UPSTREAM_RULE_MISMATCH',
      message: `step20RuleVersion '${prov.step20RuleVersion}' !== '${REQUIRED_STEP20_RULE_VERSION}'`
    });
  }
  if (prov.step21RuleVersion !== REQUIRED_STEP21_RULE_VERSION) {
    violations.push({
      code: 'UPSTREAM_RULE_MISMATCH',
      message: `step21RuleVersion '${prov.step21RuleVersion}' !== '${REQUIRED_STEP21_RULE_VERSION}'`
    });
  }
  if (prov.step22RuleVersion !== REQUIRED_STEP22_RULE_VERSION) {
    violations.push({
      code: 'UPSTREAM_RULE_MISMATCH',
      message: `step22RuleVersion '${prov.step22RuleVersion}' !== '${REQUIRED_STEP22_RULE_VERSION}'`
    });
  }
  if (prov.step23RuleVersion !== REQUIRED_STEP23_RULE_VERSION) {
    violations.push({
      code: 'UPSTREAM_RULE_MISMATCH',
      message: `step23RuleVersion '${prov.step23RuleVersion}' !== '${REQUIRED_STEP23_RULE_VERSION}'`
    });
  }

  // Provenance identity checks
  if (recommendation.portfolio === null) {
    if (prov.portfolioId !== null) {
      violations.push({
        code: 'PORTFOLIO_PROVENANCE_ID_MISMATCH',
        message: `Portfolio is null but provenance.portfolioId is '${prov.portfolioId}'.`
      });
    }
  } else {
    if (prov.portfolioId !== recommendation.portfolio.id) {
      violations.push({
        code: 'PORTFOLIO_PROVENANCE_ID_MISMATCH',
        message: `provenance.portfolioId '${prov.portfolioId}' !== embedded portfolio.id '${recommendation.portfolio.id}'.`
      });
    }
  }

  if (recommendation.toaAllocation === null) {
    if (prov.toaAllocationId !== null) {
      violations.push({
        code: 'TOA_ALLOCATION_PROVENANCE_ID_MISMATCH',
        message: `ToA allocation is null but provenance.toaAllocationId is '${prov.toaAllocationId}'.`
      });
    }
  } else {
    if (prov.toaAllocationId !== recommendation.toaAllocation.id) {
      violations.push({
        code: 'TOA_ALLOCATION_PROVENANCE_ID_MISMATCH',
        message: `provenance.toaAllocationId '${prov.toaAllocationId}' !== embedded toaAllocation.id '${recommendation.toaAllocation.id}'.`
      });
    }
  }

  // 4. Input snapshot fingerprint integrity
  const snap = recommendation.inputSnapshot;
  const expectedFingerprint = deriveSnapshotFingerprint({
    patchVersion: snap.patchVersion,
    seasonId: snap.seasonId,
    ownedResonatorCount: snap.ownedResonatorCount,
    ownedResonatorIds: snap.ownedResonatorIds,
    investmentSnapshotCount: snap.investmentSnapshotCount,
    investmentSnapshots: snap.investmentSnapshots,
    targetK: snap.targetK,
    targetStageCount: snap.targetStageCount,
    targetStageIds: snap.targetStageIds,
    allowPartial: snap.allowPartial
  });
  if (snap.snapshotFingerprint !== expectedFingerprint) {
    violations.push({
      code: 'SNAPSHOT_FINGERPRINT_MISMATCH',
      message: `snap.snapshotFingerprint '${snap.snapshotFingerprint}' !== calculated '${expectedFingerprint}'.`
    });
  }
  if (prov.snapshotFingerprint !== expectedFingerprint) {
    violations.push({
      code: 'PROVENANCE_FINGERPRINT_MISMATCH',
      message: `prov.snapshotFingerprint '${prov.snapshotFingerprint}' !== calculated '${expectedFingerprint}'.`
    });
  }

  // 5. Deterministic identifier verification
  const expectedId = deriveRecommendationOrchestrationId(
    recommendation.status,
    expectedFingerprint,
    recommendation.seasonId,
    recommendation.patchVersion,
    recommendation.ruleVersion
  );
  if (recommendation.id !== expectedId) {
    violations.push({
      code: 'IDENTIFIER_DERIVATION_MISMATCH',
      message: `recommendation.id '${recommendation.id}' !== expected '${expectedId}'.`
    });
  }

  // 6. Roster ownership invariant: every character in portfolio & ToA must be in ownedResonatorIds
  const ownedSet = new Set(snap.ownedResonatorIds);
  if (recommendation.portfolio) {
    for (const rId of recommendation.portfolio.allMemberResonatorIds) {
      if (!ownedSet.has(rId)) {
        violations.push({
          code: 'UNOWNED_CHARACTER_IN_PORTFOLIO',
          message: `Portfolio contains Resonator '${rId}' not present in owned roster snapshot.`
        });
      }
    }
  }

  if (recommendation.toaAllocation) {
    for (const va of recommendation.toaAllocation.vigorAccounting) {
      if (va.vigorConsumed > 0 && !ownedSet.has(va.resonatorId)) {
        violations.push({
          code: 'UNOWNED_CHARACTER_IN_TOA_ALLOCATION',
          message: `ToA stage allocation assigned Resonator '${va.resonatorId}' not present in owned roster snapshot.`
        });
      }
    }
  }

  // 7. Missing character evaluation records check
  if (snap.ownedResonatorCount >= 3 && recommendation.status !== 'INSUFFICIENT_ROSTER') {
    if (!recommendation.characterBuildEvaluations || recommendation.characterBuildEvaluations.length === 0) {
      violations.push({
        code: 'MISSING_CHARACTER_BUILD_EVALUATIONS',
        message: 'characterBuildEvaluations collection is empty when ownedResonatorCount >= 3.'
      });
    } else if (recommendation.characterBuildEvaluations.length !== snap.ownedResonatorCount) {
      violations.push({
        code: 'INCOMPLETE_CHARACTER_BUILD_EVALUATIONS',
        message: `characterBuildEvaluations count (${recommendation.characterBuildEvaluations.length}) !== ownedResonatorCount (${snap.ownedResonatorCount}).`
      });
    }
  } else if (snap.ownedResonatorCount < 3) {
    if (recommendation.characterBuildEvaluations && recommendation.characterBuildEvaluations.length > 0) {
      violations.push({
        code: 'UNEXPECTED_CHARACTER_BUILD_EVALUATIONS',
        message: 'characterBuildEvaluations must be empty when ownedResonatorCount < 3.'
      });
    }
  }

  // 8. Character build evaluation map & resonator verification
  const charEvalMap = new Map<string, CharacterBuildEvaluation>();
  if (recommendation.characterBuildEvaluations) {
    for (const ev of recommendation.characterBuildEvaluations) {
      if (!ev || !ev.resonatorId || !isCanonicalResonatorId(ev.resonatorId)) {
        violations.push({
          code: 'INVALID_RESONATOR_ID_IN_EVALUATIONS',
          message: `Non-canonical Resonator ID '${ev?.resonatorId}' in character build evaluations.`
        });
        continue;
      }
      if (!ownedSet.has(ev.resonatorId)) {
        violations.push({
          code: 'UNOWNED_CHARACTER_IN_BUILD_EVALUATIONS',
          message: `characterBuildEvaluations contains Resonator '${ev.resonatorId}' not present in owned roster snapshot.`
        });
      }
      if (charEvalMap.has(ev.resonatorId)) {
        violations.push({
          code: 'DUPLICATE_CHARACTER_BUILD_EVALUATION',
          message: `Duplicate character build evaluation for Resonator '${ev.resonatorId}'.`
        });
      }
      charEvalMap.set(ev.resonatorId, ev);
    }
  }

  // 9. Character-build-to-team linkage
  if (recommendation.portfolio) {
    for (const team of recommendation.portfolio.teams) {
      for (const memberId of team.memberResonatorIds) {
        const step20Eval = charEvalMap.get(memberId);
        if (!step20Eval) {
          violations.push({
            code: 'MISSING_CHARACTER_EVALUATION_FOR_TEAM_MEMBER',
            message: `Selected portfolio team member '${memberId}' has no corresponding character build evaluation.`
          });
          continue;
        }

        const step21MemberEval = team.memberBuildEvaluations.find((m) => m.resonatorId === memberId);
        if (!step21MemberEval) {
          violations.push({
            code: 'MISSING_TEAM_MEMBER_BUILD_EVALUATION',
            message: `Team '${team.id}' is missing embedded member build evaluation for '${memberId}'.`
          });
          continue;
        }

        // Project and compare canonical fields required to agree
        const mismatches: string[] = [];
        if (step20Eval.resonatorId !== step21MemberEval.resonatorId) mismatches.push('resonatorId');
        if (step20Eval.status !== step21MemberEval.status) mismatches.push('status');
        if (step20Eval.patchVersion !== step21MemberEval.patchVersion) mismatches.push('patchVersion');
        if (step20Eval.ruleVersion !== step21MemberEval.ruleVersion) mismatches.push('ruleVersion');
        if (step20Eval.element !== step21MemberEval.element) mismatches.push('element');
        if (step20Eval.weaponType !== step21MemberEval.weaponType) mismatches.push('weaponType');
        if (step20Eval.rarity !== step21MemberEval.rarity) mismatches.push('rarity');

        if (step20Eval.weaponEvaluation.isEquipped !== step21MemberEval.weaponEvaluation.isEquipped) {
          mismatches.push('weapon.isEquipped');
        }
        if (step20Eval.weaponEvaluation.weaponId !== step21MemberEval.weaponEvaluation.weaponId) {
          mismatches.push('weapon.weaponId');
        }
        if (step20Eval.weaponEvaluation.compatibility !== step21MemberEval.weaponEvaluation.compatibility) {
          mismatches.push('weapon.compatibility');
        }
        if (step20Eval.weaponEvaluation.weaponLevel !== step21MemberEval.weaponEvaluation.weaponLevel) {
          mismatches.push('weapon.weaponLevel');
        }
        if (step20Eval.weaponEvaluation.refinementRank !== step21MemberEval.weaponEvaluation.refinementRank) {
          mismatches.push('weapon.refinementRank');
        }

        if (step20Eval.echoEvaluation.equippedCount !== step21MemberEval.echoEvaluation.equippedCount) {
          mismatches.push('echo.equippedCount');
        }
        if (step20Eval.echoEvaluation.activeSonataSetCode !== step21MemberEval.echoEvaluation.activeSonataSetCode) {
          mismatches.push('echo.activeSonataSetCode');
        }
        if (step20Eval.echoEvaluation.sonataAlignment !== step21MemberEval.echoEvaluation.sonataAlignment) {
          mismatches.push('echo.sonataAlignment');
        }

        if (mismatches.length > 0) {
          violations.push({
            code: 'SUBSTITUTED_CHARACTER_BUILD_EVALUATION',
            message: `Character build evaluation for '${memberId}' does not match team member evaluation. Mismatched fields: ${mismatches.join(', ')}.`
          });
        }
      }
    }
  }

  // 10. Portfolio-to-ToA linkage
  if (recommendation.toaAllocation) {
    if (!recommendation.portfolio) {
      const assigned = recommendation.toaAllocation.assignments.filter((a) => a.isAssigned);
      if (assigned.length > 0) {
        violations.push({
          code: 'TOA_ASSIGNMENT_WITHOUT_PORTFOLIO',
          message: 'ToA allocation contains assigned stages but recommendation portfolio is null.'
        });
      }
    } else {
      const portfolioTeamMap = new Map<string, TeamBuildEvaluation>();
      for (const t of recommendation.portfolio.teams) {
        portfolioTeamMap.set(t.id, t);
      }

      for (const a of recommendation.toaAllocation.assignments) {
        if (a.isAssigned) {
          if (!a.team) {
            violations.push({
              code: 'ASSIGNED_STAGE_MISSING_TEAM',
              message: `ToA stage '${a.stage.stageId}' is marked assigned but team is null.`
            });
            continue;
          }
          const pTeam = portfolioTeamMap.get(a.team.id);
          if (!pTeam) {
            violations.push({
              code: 'UNSELECTED_PORTFOLIO_TEAM_ASSIGNED',
              message: `ToA assignment references team '${a.team.id}' absent from selected portfolio.`
            });
            continue;
          }

          // Verify exact member IDs and order
          if (a.team.memberResonatorIds.length !== pTeam.memberResonatorIds.length) {
            violations.push({
              code: 'TEAM_MEMBER_MISMATCH_IN_TOA_ASSIGNMENT',
              message: `ToA assigned team member count (${a.team.memberResonatorIds.length}) !== portfolio team member count (${pTeam.memberResonatorIds.length}).`
            });
          } else {
            for (let i = 0; i < a.team.memberResonatorIds.length; i++) {
              if (a.team.memberResonatorIds[i] !== pTeam.memberResonatorIds[i]) {
                violations.push({
                  code: 'TEAM_MEMBER_MISMATCH_IN_TOA_ASSIGNMENT',
                  message: `ToA assigned team member at index ${i} '${a.team.memberResonatorIds[i]}' !== portfolio team member '${pTeam.memberResonatorIds[i]}'.`
                });
              }
            }
          }

          if (a.team.status !== pTeam.status) {
            violations.push({
              code: 'TEAM_STATUS_MISMATCH_IN_TOA_ASSIGNMENT',
              message: `ToA assigned team status '${a.team.status}' !== portfolio team status '${pTeam.status}'.`
            });
          }
        }
      }
    }
  }

  // 11. Upstream Sub-Contract Audits
  if (recommendation.portfolio) {
    try {
      auditSingleTeamPortfolio(recommendation.portfolio);
    } catch (err) {
      violations.push({
        code: 'UPSTREAM_PORTFOLIO_AUDIT_FAILED',
        message: (err as Error).message
      });
    }
  }

  if (recommendation.toaAllocation) {
    try {
      const toaAudit = auditSingleToAAllocation(recommendation.toaAllocation);
      if (!toaAudit.isValid) {
        violations.push({
          code: 'UPSTREAM_TOA_AUDIT_FAILED',
          message: `Upstream ToA stage allocation audit failed with ${toaAudit.violations.length} violation(s): ${toaAudit.violations.map((v) => v.code).join(', ')}`
        });
      }
    } catch (err) {
      violations.push({
        code: 'UPSTREAM_TOA_AUDIT_FAILED',
        message: (err as Error).message
      });
    }
  }

  // 12. Vigor Accounting Invariants
  if (recommendation.toaAllocation) {
    for (const va of recommendation.toaAllocation.vigorAccounting) {
      if (va.vigorConsumed > MAX_RESONATOR_VIGOR) {
        violations.push({
          code: 'VIGOR_CAPACITY_EXCEEDED',
          message: `Resonator '${va.resonatorId}' consumed ${va.vigorConsumed} Vigor, exceeding maximum ${MAX_RESONATOR_VIGOR}.`
        });
      }
    }
  }

  // 13. Status Taxonomy Consistency
  const status = recommendation.status;
  const portfolio = recommendation.portfolio;
  const toa = recommendation.toaAllocation;

  if (status === 'INSUFFICIENT_ROSTER') {
    if (snap.ownedResonatorCount >= 3) {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: `Status is 'INSUFFICIENT_ROSTER' but owned roster has ${snap.ownedResonatorCount} members (>= 3).`
      });
    }
    if (portfolio !== null || toa !== null) {
      violations.push({
        code: 'INSUFFICIENT_ROSTER_NON_NULL_RESULTS',
        message: "Status is 'INSUFFICIENT_ROSTER' but portfolio or toaAllocation is non-null."
      });
    }
  } else if (status === 'NO_FEASIBLE_PORTFOLIO') {
    if (!portfolio || portfolio.status !== 'INFEASIBLE_PORTFOLIO') {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: `Status is 'NO_FEASIBLE_PORTFOLIO' but portfolio status is '${portfolio?.status}'.`
      });
    }
  } else if (status === 'NO_FEASIBLE_ALLOCATION') {
    if (!toa || toa.status !== 'INFEASIBLE_ALLOCATION') {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: `Status is 'NO_FEASIBLE_ALLOCATION' but ToA allocation status is '${toa?.status}'.`
      });
    }
  } else if (status === 'PARTIAL_RECOMMENDATION') {
    if (!snap.allowPartial) {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: "Status is 'PARTIAL_RECOMMENDATION' but allowPartial is false."
      });
    }
    if (!toa || (toa.status !== 'PARTIAL_ALLOCATION' && portfolio?.status !== 'PARTIAL_PORTFOLIO')) {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: "Status is 'PARTIAL_RECOMMENDATION' but neither ToA nor portfolio is PARTIAL."
      });
    }
  } else if (status === 'OPTIMAL_RECOMMENDATION') {
    if (!portfolio || portfolio.status !== 'OPTIMAL_PORTFOLIO') {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: `Status is 'OPTIMAL_RECOMMENDATION' but portfolio status is '${portfolio?.status}'.`
      });
    }
    if (!toa || toa.status !== 'OPTIMAL_ALLOCATION') {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: `Status is 'OPTIMAL_RECOMMENDATION' but ToA allocation status is '${toa?.status}'.`
      });
    }
    if (toa && toa.completeness.assignedStageCount !== snap.targetStageCount) {
      violations.push({
        code: 'OPTIMAL_STATUS_WITH_PARTIAL_COVERAGE',
        message: `Status is 'OPTIMAL_RECOMMENDATION' but stage coverage is ${toa.completeness.assignedStageCount}/${snap.targetStageCount}.`
      });
    }
  } else if (status === 'FEASIBLE_RECOMMENDATION') {
    const isPortFeasible = portfolio?.status === 'OPTIMAL_PORTFOLIO' || portfolio?.status === 'FEASIBLE_PORTFOLIO';
    const isToaFeasible = toa?.status === 'OPTIMAL_ALLOCATION' || toa?.status === 'FEASIBLE_ALLOCATION';
    if (!isPortFeasible || !isToaFeasible) {
      violations.push({
        code: 'STATUS_INCONSISTENCY',
        message: `Status is 'FEASIBLE_RECOMMENDATION' but upstream status is not feasible/optimal: portfolio='${portfolio?.status}', toa='${toa?.status}'.`
      });
    }
    if (!toa || toa.completeness.assignedStageCount !== snap.targetStageCount) {
      violations.push({
        code: 'FEASIBLE_STATUS_WITH_PARTIAL_COVERAGE',
        message: `Status is 'FEASIBLE_RECOMMENDATION' but stage coverage is incomplete (${toa?.completeness.assignedStageCount}/${snap.targetStageCount}).`
      });
    }
  }

  const report: RecommendationOrchestrationAuditReport = Object.freeze({
    isValid: violations.length === 0,
    recommendationId: recommendation.id,
    status: recommendation.status,
    violations: Object.freeze(violations.map((v) => Object.freeze({ ...v }))),
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });

  return report;
}

/**
 * Independently audits a complete RecommendationOrchestrationResult container,
 * verifying result-level attributes, embedding recommendation invariants, and re-deriving
 * all quantitative metrics from authoritative embedded sub-contracts.
 */
export function auditRecommendationOrchestrationResult(
  result: RecommendationOrchestrationResult
): RecommendationOrchestrationAuditReport {
  const violations: RecommendationOrchestrationAuditViolation[] = [];

  if (!result || typeof result !== 'object') {
    return Object.freeze({
      isValid: false,
      recommendationId: 'UNKNOWN',
      status: 'INVALID_INPUT' as RecommendationOrchestrationStatus,
      violations: Object.freeze([{ code: 'NULL_RESULT', message: 'Result is null or not an object.' }]),
      verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
    });
  }

  // 1. Audit result container boundaries
  if (result.patchId !== CANONICAL_PATCH_VERSION) {
    violations.push({
      code: 'RESULT_PATCH_MISMATCH',
      message: `result.patchId '${result.patchId}' !== '${CANONICAL_PATCH_VERSION}'.`
    });
  }
  if (result.ruleVersion !== RECOMMENDATION_ORCHESTRATION_RULE_VERSION) {
    violations.push({
      code: 'RESULT_RULE_VERSION_MISMATCH',
      message: `result.ruleVersion '${result.ruleVersion}' !== '${RECOMMENDATION_ORCHESTRATION_RULE_VERSION}'.`
    });
  }
  if (result.seasonId !== CANONICAL_SEASON_ID) {
    violations.push({
      code: 'RESULT_SEASON_MISMATCH',
      message: `result.seasonId '${result.seasonId}' !== '${CANONICAL_SEASON_ID}'.`
    });
  }

  // 2. Audit embedded recommendation
  const recAudit = auditSingleRecommendationOrchestration(result.recommendation);
  violations.push(...recAudit.violations);

  // 3. Independently verify derivable metrics
  const metrics = result.metrics;
  const rec = result.recommendation;
  const snap = rec.inputSnapshot;

  if (!metrics) {
    violations.push({
      code: 'MISSING_METRICS',
      message: 'Result metrics container is missing.'
    });
  } else {
    if (metrics.patchVersion !== CANONICAL_PATCH_VERSION) {
      violations.push({
        code: 'METRICS_PATCH_MISMATCH',
        message: `metrics.patchVersion '${metrics.patchVersion}' !== '${CANONICAL_PATCH_VERSION}'.`
      });
    }
    if (metrics.ruleVersion !== RECOMMENDATION_ORCHESTRATION_RULE_VERSION) {
      violations.push({
        code: 'METRICS_RULE_VERSION_MISMATCH',
        message: `metrics.ruleVersion '${metrics.ruleVersion}' !== '${RECOMMENDATION_ORCHESTRATION_RULE_VERSION}'.`
      });
    }
    if (metrics.seasonId !== CANONICAL_SEASON_ID) {
      violations.push({
        code: 'METRICS_SEASON_MISMATCH',
        message: `metrics.seasonId '${metrics.seasonId}' !== '${CANONICAL_SEASON_ID}'.`
      });
    }
    if (metrics.verifiedAt !== OFFLINE_DETERMINISTIC_AUDIT_STAMP) {
      violations.push({
        code: 'METRICS_VERIFIED_AT_MISMATCH',
        message: `metrics.verifiedAt '${metrics.verifiedAt}' !== '${OFFLINE_DETERMINISTIC_AUDIT_STAMP}'.`
      });
    }

    // Input-derived metrics
    if (metrics.ownedResonatorCount !== snap.ownedResonatorCount) {
      violations.push({
        code: 'METRICS_OWNED_RESONATOR_COUNT_MISMATCH',
        message: `metrics.ownedResonatorCount ${metrics.ownedResonatorCount} !== snap.ownedResonatorCount ${snap.ownedResonatorCount}.`
      });
    }
    if (metrics.targetTeamCount !== snap.targetK) {
      violations.push({
        code: 'METRICS_TARGET_TEAM_COUNT_MISMATCH',
        message: `metrics.targetTeamCount ${metrics.targetTeamCount} !== snap.targetK ${snap.targetK}.`
      });
    }
    if (metrics.targetStageCount !== snap.targetStageCount) {
      violations.push({
        code: 'METRICS_TARGET_STAGE_COUNT_MISMATCH',
        message: `metrics.targetStageCount ${metrics.targetStageCount} !== snap.targetStageCount ${snap.targetStageCount}.`
      });
    }

    // Evaluation count metric
    if (metrics.evaluatedCharacterCount !== rec.characterBuildEvaluations.length) {
      violations.push({
        code: 'METRICS_EVALUATED_CHARACTER_COUNT_MISMATCH',
        message: `metrics.evaluatedCharacterCount ${metrics.evaluatedCharacterCount} !== rec.characterBuildEvaluations.length ${rec.characterBuildEvaluations.length}.`
      });
    }

    // Portfolio metrics
    const expectedSelectedTeamCount = rec.portfolio ? rec.portfolio.selectedTeamCount : 0;
    if (metrics.selectedTeamCount !== expectedSelectedTeamCount) {
      violations.push({
        code: 'METRICS_SELECTED_TEAM_COUNT_MISMATCH',
        message: `metrics.selectedTeamCount ${metrics.selectedTeamCount} !== expected ${expectedSelectedTeamCount}.`
      });
    }

    // ToA allocation metrics
    if (rec.toaAllocation) {
      const assignedStages = rec.toaAllocation.assignments.filter((a) => a.isAssigned && a.team !== null);
      const expectedAssignedCount = assignedStages.length;
      if (metrics.assignedStageCount !== expectedAssignedCount) {
        violations.push({
          code: 'METRICS_ASSIGNED_STAGE_COUNT_MISMATCH',
          message: `metrics.assignedStageCount ${metrics.assignedStageCount} !== expected ${expectedAssignedCount}.`
        });
      }

      const expectedVigorConsumed = rec.toaAllocation.vigorAccounting.reduce(
        (sum, va) => sum + va.vigorConsumed,
        0
      );
      if (metrics.totalVigorConsumed !== expectedVigorConsumed) {
        violations.push({
          code: 'METRICS_TOTAL_VIGOR_CONSUMED_MISMATCH',
          message: `metrics.totalVigorConsumed ${metrics.totalVigorConsumed} !== expected ${expectedVigorConsumed}.`
        });
      }

      const distinctUsedResonators = new Set<string>();
      for (const a of assignedStages) {
        if (a.team) {
          for (const m of a.team.memberResonatorIds) {
            distinctUsedResonators.add(m);
          }
        }
      }
      if (metrics.distinctResonatorsUsedCount !== distinctUsedResonators.size) {
        violations.push({
          code: 'METRICS_DISTINCT_RESONATORS_USED_MISMATCH',
          message: `metrics.distinctResonatorsUsedCount ${metrics.distinctResonatorsUsedCount} !== expected ${distinctUsedResonators.size}.`
        });
      }

      const expectedCoverageRatio =
        snap.targetStageCount > 0 ? expectedAssignedCount / snap.targetStageCount : 0;
      if (Math.abs(metrics.stageCoverageRatio - expectedCoverageRatio) > 0.00001) {
        violations.push({
          code: 'METRICS_STAGE_COVERAGE_RATIO_MISMATCH',
          message: `metrics.stageCoverageRatio ${metrics.stageCoverageRatio} !== expected ${expectedCoverageRatio}.`
        });
      }
    } else {
      if (metrics.assignedStageCount !== 0) {
        violations.push({
          code: 'METRICS_ASSIGNED_STAGE_COUNT_MISMATCH',
          message: `metrics.assignedStageCount must be 0 when toaAllocation is null, got ${metrics.assignedStageCount}.`
        });
      }
      if (metrics.totalVigorConsumed !== 0) {
        violations.push({
          code: 'METRICS_TOTAL_VIGOR_CONSUMED_MISMATCH',
          message: `metrics.totalVigorConsumed must be 0 when toaAllocation is null, got ${metrics.totalVigorConsumed}.`
        });
      }
      if (metrics.distinctResonatorsUsedCount !== 0) {
        violations.push({
          code: 'METRICS_DISTINCT_RESONATORS_USED_MISMATCH',
          message: `metrics.distinctResonatorsUsedCount must be 0 when toaAllocation is null, got ${metrics.distinctResonatorsUsedCount}.`
        });
      }
      if (metrics.stageCoverageRatio !== 0) {
        violations.push({
          code: 'METRICS_STAGE_COVERAGE_RATIO_MISMATCH',
          message: `metrics.stageCoverageRatio must be 0 when toaAllocation is null, got ${metrics.stageCoverageRatio}.`
        });
      }
    }
  }

  return Object.freeze({
    isValid: violations.length === 0,
    recommendationId: result.recommendation?.id ?? 'UNKNOWN',
    status: result.recommendation?.status ?? 'INVALID_INPUT',
    violations: Object.freeze(violations.map((v) => Object.freeze({ ...v }))),
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });
}
