/**
 * Deterministic Team Candidate Generator
 *
 * Generates canonical, hard-rule-filtered 3-resonator team candidates
 * from an owned roster and execution context (Roster-only or Stage-aware).
 */

import type {
  OwnedRoster,
  Resonator,
  ResonatorBuild,
  TeamGenerationContext,
  GeneratedTeamCandidate,
  CandidateMetadata,
  RuleEvaluationContext,
} from '../../domain/types/index.ts';
import { evaluateBuildAvailability } from '../rules/availability.ts';
import { validateStagePatch } from '../rules/patch-isolation.ts';
import { evaluateTeam } from '../evaluator.ts';
import { evaluateStageBuffCompatibility } from '../rules/stage-compatibility.ts';
import { evaluateEnemyMatchup } from '../rules/enemy-matchup.ts';
import { generate3Combinations } from './combinations.ts';
import { createCanonicalTeamKey, canonicalizeTeamMembers } from './canonicalize.ts';

/**
 * Normalizes available resonators into a fast lookup map.
 */
function toResonatorMap(
  available: Resonator[] | Map<string, Resonator>
): Map<string, Resonator> {
  if (available instanceof Map) return available;
  const map = new Map<string, Resonator>();
  for (const r of available) {
    map.set(r.id, r);
  }
  return map;
}

/**
 * Normalizes builds into a fast lookup map.
 */
function toBuildMap(
  builds?: Map<string, ResonatorBuild> | ResonatorBuild[] | Record<string, ResonatorBuild>
): Map<string, ResonatorBuild> {
  if (!builds) return new Map();
  if (builds instanceof Map) return builds;
  const map = new Map<string, ResonatorBuild>();
  if (Array.isArray(builds)) {
    for (const b of builds) {
      map.set(b.resonator.id, b);
    }
  } else {
    for (const [id, b] of Object.entries(builds)) {
      map.set(id, b);
    }
  }
  return map;
}

/**
 * Creates a single GeneratedTeamCandidate from 3 members if it satisfies all hard rules.
 */
export function createTeamCandidate(
  members: ResonatorBuild[],
  context: TeamGenerationContext,
  roster: OwnedRoster
): GeneratedTeamCandidate | null {
  if (members.length !== 3) return null;

  const ruleContext: RuleEvaluationContext = {
    patchContext: context.patchContext,
    roster,
  };

  // Stage patch isolation check
  if (context.stage) {
    const patchCheck = validateStagePatch(context.stage, ruleContext);
    if (!patchCheck.passed) return null;
  }

  const canonicalMembers = canonicalizeTeamMembers(members);
  const canonicalKey = createCanonicalTeamKey(canonicalMembers.map((m) => m.resonator.id));

  const validationReport = evaluateTeam(
    { members: canonicalMembers },
    ruleContext,
    context.stage
  );

  if (!validationReport.isValid) return null;

  const metadata: CandidateMetadata = {
    rolesPresent: validationReport.rolesPresent,
    combatTagsPresent: validationReport.combatTagsPresent,
    elementsPresent: validationReport.elementsPresent,
    hasHealing: validationReport.hasHealing,
    hasShield: validationReport.hasShield,
    hasDamageAmplify: validationReport.hasDamageAmplify,
    hasResistanceShred: validationReport.hasResistanceShred,
    hasDefShred: validationReport.hasDefShred,
    hasCoordinatedAttack: validationReport.hasCoordinatedAttack,
    hasResourceGrant: validationReport.hasResourceGrant,
  };

  if (context.stage) {
    const stageCompat = evaluateStageBuffCompatibility(
      { members: canonicalMembers },
      context.stage
    );
    const enemyFacts = evaluateEnemyMatchup(
      { members: canonicalMembers },
      context.stage
    );

    metadata.stageFacts = {
      stageId: context.stage.id,
      patchId: context.stage.patchId,
      benefited: stageCompat.benefited,
      matchedEffects: stageCompat.matchedEffects,
      unmatchedEffects: stageCompat.unmatchedEffects,
      effectiveResistanceContexts: enemyFacts.effectiveResistanceContexts,
      enemyCount: enemyFacts.enemyCount,
      bossPresence: enemyFacts.bossPresence,
      elitePresence: enemyFacts.elitePresence,
      waveCount: enemyFacts.waveCount,
      relevantTeamEffects: enemyFacts.relevantTeamEffects,
    };
  }

  return {
    id: canonicalKey,
    canonicalKey,
    members: canonicalMembers,
    metadata,
    validationReport,
  };
}

/**
 * Generates all valid 3-resonator team candidates for a given roster and context.
 * Operates purely in-memory with deterministic sorting.
 */
export function generateTeamCandidates(
  roster: OwnedRoster,
  context: TeamGenerationContext
): GeneratedTeamCandidate[] {
  const resonatorMap = toResonatorMap(context.availableResonators);
  const buildMap = toBuildMap(context.builds);

  const ruleContext: RuleEvaluationContext = {
    patchContext: context.patchContext,
    roster,
  };

  // 1. HARD RULE: Check stage patch isolation upfront
  if (context.stage) {
    const patchCheck = validateStagePatch(context.stage, ruleContext);
    if (!patchCheck.passed) {
      return [];
    }
  }

  // 2. Pre-filter eligible resonators
  // Deduplicate roster resonator IDs
  const uniqueOwnedIds = Array.from(new Set(roster.resonatorIds));
  const eligibleBuilds: ResonatorBuild[] = [];

  for (const resId of uniqueOwnedIds) {
    const resonator = resonatorMap.get(resId);
    if (!resonator) continue;

    const build = buildMap.get(resId) || { resonator };

    // Validate single-resonator availability & build constraints
    const buildResults = evaluateBuildAvailability(build, ruleContext);
    const hasHardViolation = buildResults.some((r) => !r.passed && r.severity === 'HARD');

    if (!hasHardViolation) {
      eligibleBuilds.push(build);
    }
  }

  // Need at least 3 eligible resonators to form any team
  if (eligibleBuilds.length < 3) {
    return [];
  }

  // Sort eligible builds by resonator ID for canonical combination order
  eligibleBuilds.sort((a, b) => a.resonator.id.localeCompare(b.resonator.id));

  // 3. Generate unordered 3-combinations: C(N, 3)
  const combinations = generate3Combinations(eligibleBuilds);

  // 4. Validate team combinations & construct candidate pool
  const candidates: GeneratedTeamCandidate[] = [];

  for (const [b1, b2, b3] of combinations) {
    const canonicalMembers: [ResonatorBuild, ResonatorBuild, ResonatorBuild] = [b1, b2, b3];
    const canonicalKey = `${b1.resonator.id}:${b2.resonator.id}:${b3.resonator.id}`;

    const candidateObj = { members: canonicalMembers };
    const validationReport = evaluateTeam(candidateObj, ruleContext, context.stage);

    // Hard rule filter: reject candidate if any hard rule fails
    if (!validationReport.isValid) {
      continue;
    }

    // Extract structured metadata
    const metadata: CandidateMetadata = {
      rolesPresent: validationReport.rolesPresent,
      combatTagsPresent: validationReport.combatTagsPresent,
      elementsPresent: validationReport.elementsPresent,
      hasHealing: validationReport.hasHealing,
      hasShield: validationReport.hasShield,
      hasDamageAmplify: validationReport.hasDamageAmplify,
      hasResistanceShred: validationReport.hasResistanceShred,
      hasDefShred: validationReport.hasDefShred,
      hasCoordinatedAttack: validationReport.hasCoordinatedAttack,
      hasResourceGrant: validationReport.hasResourceGrant,
    };

    if (context.stage) {
      const stageCompat = evaluateStageBuffCompatibility(candidateObj, context.stage);
      const enemyFacts = evaluateEnemyMatchup(candidateObj, context.stage);

      metadata.stageFacts = {
        stageId: context.stage.id,
        patchId: context.stage.patchId,
        benefited: stageCompat.benefited,
        matchedEffects: stageCompat.matchedEffects,
        unmatchedEffects: stageCompat.unmatchedEffects,
        effectiveResistanceContexts: enemyFacts.effectiveResistanceContexts,
        enemyCount: enemyFacts.enemyCount,
        bossPresence: enemyFacts.bossPresence,
        elitePresence: enemyFacts.elitePresence,
        waveCount: enemyFacts.waveCount,
        relevantTeamEffects: enemyFacts.relevantTeamEffects,
      };
    }

    candidates.push({
      id: canonicalKey,
      canonicalKey,
      members: canonicalMembers,
      metadata,
      validationReport,
    });
  }

  // 5. Deterministic sorting by canonical key
  candidates.sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));

  return candidates;
}
