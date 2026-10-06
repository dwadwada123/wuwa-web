/**
 * Deterministic Team-vs-Stage Scorer
 *
 * Evaluates candidate team suitability against a specific ToA stage.
 * Produces structured, explainable dimensional breakdowns and aggregate score [0..1000].
 */

import type {
  TeamCandidate,
  ToAStage,
  RuleEvaluationContext,
} from '../../domain/types/index.ts';
import { evaluateTeam } from '../evaluator.ts';
import { getCandidateKey } from '../team-generation/canonicalize.ts';
import type { TeamStageScore, TeamScoringContext, ScoreDimension } from './types.ts';
import { TEAM_SCORING_CONFIG } from './config.ts';

import { scoreRoleCoverage } from './dimensions/role-coverage.ts';
import { scoreElementalMatchup } from './dimensions/elemental-matchup.ts';
import { scoreEnemyMatchup } from './dimensions/enemy-matchup.ts';
import { scoreStageBuffCompatibility } from './dimensions/stage-buff.ts';
import { scoreOffensiveSynergy } from './dimensions/offensive-synergy.ts';
import { scoreSustain } from './dimensions/sustain.ts';
import { scoreResistanceUtility } from './dimensions/resistance-utility.ts';
import { scoreCoordinatedAttackSynergy } from './dimensions/coordinated-attack.ts';
import { scoreResourceSynergy } from './dimensions/resource-synergy.ts';

function createZeroDimension(weight: number, evidence: string[]): ScoreDimension {
  return {
    score: 0,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore: 0,
    evidence,
  };
}

/**
 * Pure evaluation function scoring a candidate team against a specific ToA stage.
 */
export function scoreTeamForStage(
  candidate: TeamCandidate,
  stage: ToAStage,
  context: TeamScoringContext
): TeamStageScore {
  const candidateKey = getCandidateKey(candidate);
  const stageKey = `${stage.patchId}:${stage.id}`;

  const ruleContext: RuleEvaluationContext = {
    patchContext: context.patchContext,
    roster: context.roster,
  };

  // Phase 4A deterministic evaluation
  const report = evaluateTeam(candidate, ruleContext, stage);

  // If hard-invalid, return zero score and documented violations
  if (!report.isValid) {
    const hardEvidence = report.violations.map(
      (v) => `HARD REJECTION [${v.ruleId}]: ${v.reason}`
    );

    return {
      candidateKey,
      stageKey,
      valid: false,
      totalScore: 0,
      dimensions: {
        roleCoverage: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.roleCoverage,
          hardEvidence
        ),
        elementalMatchup: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.elementalMatchup,
          hardEvidence
        ),
        enemyMatchup: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.enemyMatchup,
          hardEvidence
        ),
        stageBuffCompatibility: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.stageBuffCompatibility,
          hardEvidence
        ),
        offensiveSynergy: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.offensiveSynergy,
          hardEvidence
        ),
        sustain: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.sustain,
          hardEvidence
        ),
        resistanceUtility: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.resistanceUtility,
          hardEvidence
        ),
        coordinatedAttackSynergy: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.coordinatedAttackSynergy,
          hardEvidence
        ),
        resourceSynergy: createZeroDimension(
          TEAM_SCORING_CONFIG.weights.resourceSynergy,
          hardEvidence
        ),
      },
      evidence: hardEvidence,
      warnings: report.violations,
    };
  }

  // Evaluate all 9 dimensions
  const roleCoverage = scoreRoleCoverage(candidate, report);
  const elementalMatchup = scoreElementalMatchup(candidate, stage);
  const enemyMatchup = scoreEnemyMatchup(candidate, stage, report);
  const stageBuffCompatibility = scoreStageBuffCompatibility(candidate, stage);
  const offensiveSynergy = scoreOffensiveSynergy(candidate, report);
  const sustain = scoreSustain(candidate, stage, report);
  const resistanceUtility = scoreResistanceUtility(candidate, report);
  const coordinatedAttackSynergy = scoreCoordinatedAttackSynergy(candidate, stage, report);
  const resourceSynergy = scoreResourceSynergy(candidate, report);

  // Sum exact integer weighted contributions
  const totalScore =
    roleCoverage.weightedScore +
    elementalMatchup.weightedScore +
    enemyMatchup.weightedScore +
    stageBuffCompatibility.weightedScore +
    offensiveSynergy.weightedScore +
    sustain.weightedScore +
    resistanceUtility.weightedScore +
    coordinatedAttackSynergy.weightedScore +
    resourceSynergy.weightedScore;

  // Aggregate high-level evidence summary
  const summaryEvidence: string[] = [
    `Stage Fit: Total Score ${totalScore} / ${TEAM_SCORING_CONFIG.maxTotalScore}`,
    `Stage Buffs: ${stageBuffCompatibility.score}/100 (weighted: ${stageBuffCompatibility.weightedScore})`,
    `Elemental Alignment: ${elementalMatchup.score}/100 (weighted: ${elementalMatchup.weightedScore})`,
    `Offensive Synergy: ${offensiveSynergy.score}/100 (weighted: ${offensiveSynergy.weightedScore})`,
    `Role Balance: ${roleCoverage.score}/100 (weighted: ${roleCoverage.weightedScore})`,
    `Enemy Threat Fit: ${enemyMatchup.score}/100 (weighted: ${enemyMatchup.weightedScore})`,
    `Resistance Utility: ${resistanceUtility.score}/100 (weighted: ${resistanceUtility.weightedScore})`,
    `Sustain: ${sustain.score}/100 (weighted: ${sustain.weightedScore})`,
    `Coordinated Attacks: ${coordinatedAttackSynergy.score}/100 (weighted: ${coordinatedAttackSynergy.weightedScore})`,
    `Resource Synergy: ${resourceSynergy.score}/100 (weighted: ${resourceSynergy.weightedScore})`,
  ];

  return {
    candidateKey,
    stageKey,
    valid: true,
    totalScore,
    dimensions: {
      roleCoverage,
      elementalMatchup,
      enemyMatchup,
      stageBuffCompatibility,
      offensiveSynergy,
      sustain,
      resistanceUtility,
      coordinatedAttackSynergy,
      resourceSynergy,
    },
    evidence: summaryEvidence,
    warnings: report.violations.filter((v) => v.severity === 'SOFT'),
  };
}
