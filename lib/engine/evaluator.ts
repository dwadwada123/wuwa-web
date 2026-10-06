/**
 * Pure Deterministic Rules Engine Evaluator Facade
 *
 * Exposes core evaluation APIs for Resonators, Builds, Teams, and ToA Stages.
 * Free of side-effects, network calls, or database dependencies.
 */

import type {
  Resonator,
  ResonatorBuild,
  TeamCandidate,
  ToAStage,
  RuleEvaluationContext,
  RuleResult,
  TeamValidationReport,
  StageBuffCompatibilityResult,
  EffectiveResistanceContext,
  EnemyMatchupFacts,
} from '../domain/types/index.ts';
import {
  evaluateResonatorAvailability,
  evaluateBuildAvailability,
} from './rules/availability.ts';
import { validateTeam } from './rules/team-validation.ts';
import {
  evaluateElementalMatchup,
  evaluateTeamElementalRules,
} from './rules/elemental-matchup.ts';
import { evaluateStageBuffCompatibility } from './rules/stage-compatibility.ts';
import { evaluateEnemyMatchup } from './rules/enemy-matchup.ts';
import { validateStagePatch } from './rules/patch-isolation.ts';

/**
 * Evaluates a single Resonator's availability under the provided context.
 */
export function evaluateResonator(
  resonator: Resonator,
  context: RuleEvaluationContext
): RuleResult[] {
  return evaluateResonatorAvailability(resonator, context);
}

/**
 * Evaluates a Resonator build's validity and availability under the provided context.
 */
export function evaluateBuild(
  build: ResonatorBuild,
  context: RuleEvaluationContext
): RuleResult[] {
  return evaluateBuildAvailability(build, context);
}

/**
 * Evaluates a 3-member team candidate against all hard and soft rules.
 * If a ToA stage is provided, also checks patch isolation, elemental matchup,
 * stage buff compatibility, and enemy composition.
 */
export function evaluateTeam(
  candidate: TeamCandidate,
  context: RuleEvaluationContext,
  stage?: ToAStage
): TeamValidationReport {
  const report = validateTeam(candidate, context);

  if (stage) {
    // 1. HARD RULE: Patch isolation
    const patchCheck = validateStagePatch(stage, context);
    report.results.push(patchCheck);
    if (!patchCheck.passed) {
      report.isValid = false;
      report.violations.push({
        ruleId: patchCheck.ruleId,
        severity: patchCheck.severity as 'HARD',
        reason: patchCheck.reason,
        evidence: patchCheck.evidence,
      });
    }

    // 2. Elemental matchup rules
    const elementalResults = evaluateTeamElementalRules(candidate, stage);
    for (const res of elementalResults) {
      report.results.push(res);
      if (!res.passed && res.severity === 'SOFT') {
        report.violations.push({
          ruleId: res.ruleId,
          severity: 'SOFT',
          reason: res.reason,
          evidence: res.evidence,
        });
      }
    }

    // 3. Stage buff compatibility rules
    const stageBuffRes = evaluateStageBuffCompatibility(candidate, stage);
    for (const res of stageBuffRes.results) {
      report.results.push(res);
      if (!res.passed && res.severity === 'SOFT') {
        report.violations.push({
          ruleId: res.ruleId,
          severity: 'SOFT',
          reason: res.reason,
          evidence: res.evidence,
        });
      }
    }

    // 4. Enemy matchup rules
    const enemyFacts = evaluateEnemyMatchup(candidate, stage);
    for (const res of enemyFacts.results) {
      report.results.push(res);
      if (!res.passed && res.severity === 'SOFT') {
        report.violations.push({
          ruleId: res.ruleId,
          severity: 'SOFT',
          reason: res.reason,
          evidence: res.evidence,
        });
      }
    }
  }

  return report;
}

export {
  evaluateElementalMatchup,
  evaluateStageBuffCompatibility,
  evaluateEnemyMatchup,
};
