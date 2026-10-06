/**
 * Deterministic Stage Explanation Analyzer
 *
 * Produces structured per-stage explanations grounded in:
 * - Stage identity & floor context
 * - Exact score breakdown & top dimensions
 * - Area effect activations & unutilized buffs
 * - Enemy class, wave count & resistance interactions
 * - Functional role coverage & tag synergy
 * - Offensive gameplay capabilities
 * - Sustain demand relative to threat
 * - Per-member Vigor impact & remaining reserve
 * - Local vs Global opportunity-cost tradeoffs
 */

import type {
  ToAStage,
  TeamCandidate,
  EffectiveResistanceContext,
} from '../../domain/types/index.ts';
import type { TeamStageScore, ScoreDimension } from '../scoring/types.ts';
import type { StageAssignment } from '../optimization/types.ts';
import { evaluateStageBuffCompatibility } from '../rules/stage-compatibility.ts';
import { evaluateEnemyMatchup } from '../rules/enemy-matchup.ts';
import { evaluateElementalMatchup } from '../rules/elemental-matchup.ts';
import { extractTeamRoles } from '../rules/roles-tags.ts';
import {
  teamHasHealing,
  teamHasShield,
  teamHasDamageAmplify,
  teamHasResistanceShred,
  teamHasDefShred,
  teamHasCoordinatedAttack,
  teamHasResourceGrant,
  extractResShredValue,
} from '../rules/gameplay-effects.ts';
import type {
  StageExplanation,
  StageScoreBreakdown,
  DimensionScoreExplanation,
  TopDimensionContributor,
  ResourceExplanation,
  MemberVigorImpact,
  ExplanationReason,
} from './types.ts';

const DIMENSION_NAMES: Record<keyof TeamStageScore['dimensions'], string> = {
  roleCoverage: 'Role Coverage',
  elementalMatchup: 'Elemental Matchup',
  enemyMatchup: 'Enemy Matchup',
  stageBuffCompatibility: 'Stage Buff Compatibility',
  offensiveSynergy: 'Offensive Synergy',
  sustain: 'Sustain Suitability',
  resistanceUtility: 'Resistance Utility',
  coordinatedAttackSynergy: 'Coordinated Attack Synergy',
  resourceSynergy: 'Resource Synergy',
};

/**
 * Deterministically parses stage tower name and floor index.
 */
export function parseStageIdentity(stage: ToAStage): { towerName: string; floor: number } {
  const idLower = stage.id.toLowerCase();
  let towerName = 'Tower of Adversity';

  if (idLower.includes('hazard')) {
    towerName = 'Hazard Tower';
  } else if (idLower.includes('resonant') || idLower.includes('resonance')) {
    towerName = 'Resonant Tower';
  } else if (idLower.includes('echoing') || idLower.includes('echo')) {
    towerName = 'Echoing Tower';
  } else {
    for (const ae of stage.areaEffects) {
      const aeNameLower = ae.name.toLowerCase();
      if (aeNameLower.includes('hazard')) {
        towerName = 'Hazard Tower';
        break;
      }
      if (aeNameLower.includes('resonant')) {
        towerName = 'Resonant Tower';
        break;
      }
      if (aeNameLower.includes('echoing')) {
        towerName = 'Echoing Tower';
        break;
      }
    }
  }

  const floor = stage.stageIndex > 0 ? stage.stageIndex : 1;
  return { towerName, floor };
}

/**
 * Constructs structured score breakdown from existing Phase 4C score dimensions.
 * Does not re-score or invent new numbers.
 */
export function buildStageScoreBreakdown(teamScore: TeamStageScore): StageScoreBreakdown {
  const dims = teamScore.dimensions;
  const dimensionKeys = Object.keys(dims) as Array<keyof TeamStageScore['dimensions']>;

  const dimensionsMap: Record<string, DimensionScoreExplanation> = {};
  const topContributors: TopDimensionContributor[] = [];

  for (const key of dimensionKeys) {
    const d: ScoreDimension = dims[key];
    const dimExplanation: DimensionScoreExplanation = {
      score: d.score,
      maxScore: d.maxScore,
      weight: d.weight,
      weightedScore: d.weightedScore,
      evidence: [...d.evidence],
    };
    dimensionsMap[key] = dimExplanation;

    topContributors.push({
      dimensionKey: key,
      name: DIMENSION_NAMES[key] || key,
      weightedScore: d.weightedScore,
      maxWeight: d.weight,
      percentageOfMax: d.weight > 0 ? Math.round((d.weightedScore / d.weight) * 100) : 0,
    });
  }

  // Sort top contributors deterministically: weightedScore descending, then dimensionKey ascending
  topContributors.sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    return a.dimensionKey.localeCompare(b.dimensionKey);
  });

  return {
    totalScore: teamScore.totalScore,
    maxTotalScore: 1000,
    dimensions: dimensionsMap as StageScoreBreakdown['dimensions'],
    topContributors,
  };
}

/**
 * Deterministically explains stage area effect utilization.
 */
export function explainAreaEffects(
  team: TeamCandidate,
  stage: ToAStage
): { utilized: ExplanationReason[]; unmatched: ExplanationReason[] } {
  const compat = evaluateStageBuffCompatibility(team, stage);
  const utilized: ExplanationReason[] = [];
  const unmatched: ExplanationReason[] = [];

  // Sort matched effects deterministically by areaEffectId
  const sortedMatched = [...compat.matchedEffects].sort((a, b) =>
    a.areaEffectId.localeCompare(b.areaEffectId)
  );

  for (const m of sortedMatched) {
    utilized.push({
      code: 'AREA_EFFECT_UTILIZED',
      category: 'AREA_EFFECT',
      importance: 'PRIMARY',
      title: `Utilized Stage Buff: ${m.name}`,
      facts: {
        areaEffectId: m.areaEffectId,
        name: m.name,
        triggerCategory: m.triggerCategory,
        reason: m.reason,
        matchedByMemberIds: [...m.matchedByMemberIds].sort(),
      },
    });
  }

  // Sort unmatched effects deterministically by areaEffectId
  const sortedUnmatched = [...compat.unmatchedEffects].sort((a, b) =>
    a.areaEffectId.localeCompare(b.areaEffectId)
  );

  for (const u of sortedUnmatched) {
    unmatched.push({
      code: 'AREA_EFFECT_UNMATCHED',
      category: 'AREA_EFFECT',
      importance: 'INFO',
      title: `Unutilized Stage Buff: ${u.name}`,
      facts: {
        areaEffectId: u.areaEffectId,
        name: u.name,
        reason: u.reason,
      },
    });
  }

  return { utilized, unmatched };
}

/**
 * Deterministically explains enemy composition and resistance interactions.
 */
export function explainEnemyMatchup(
  team: TeamCandidate,
  stage: ToAStage
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];
  const enemyFacts = evaluateEnemyMatchup(team, stage);
  const elementalContexts = evaluateElementalMatchup(team, stage);

  // 1. Encounter Class (Boss / Elite / Swarm)
  if (enemyFacts.bossPresence) {
    reasons.push({
      code: 'ENEMY_BOSS_ENCOUNTER',
      category: 'ENEMY_MATCHUP',
      importance: 'PRIMARY',
      title: 'Boss-Class Encounter',
      facts: {
        bossPresence: true,
        elitePresence: enemyFacts.elitePresence,
        enemyCount: enemyFacts.enemyCount,
        waveCount: enemyFacts.waveCount,
        relevantTeamEffects: [...enemyFacts.relevantTeamEffects].sort(),
      },
    });
  } else if (enemyFacts.elitePresence) {
    reasons.push({
      code: 'ENEMY_ELITE_ENCOUNTER',
      category: 'ENEMY_MATCHUP',
      importance: 'SECONDARY',
      title: 'Elite-Class Mob Encounter',
      facts: {
        bossPresence: false,
        elitePresence: true,
        enemyCount: enemyFacts.enemyCount,
        waveCount: enemyFacts.waveCount,
        relevantTeamEffects: [...enemyFacts.relevantTeamEffects].sort(),
      },
    });
  } else {
    reasons.push({
      code: 'ENEMY_SWARM_ENCOUNTER',
      category: 'ENEMY_MATCHUP',
      importance: 'INFO',
      title: 'Standard Mob Encounter',
      facts: {
        bossPresence: false,
        elitePresence: false,
        enemyCount: enemyFacts.enemyCount,
        waveCount: enemyFacts.waveCount,
      },
    });
  }

  // 2. Shield Bar Modifier Counter
  const hasShieldBar = stage.waves.some((w) =>
    w.enemyInstances.some((inst) =>
      inst.enemy.modifiers?.some((m) => m.modifierType === 'SHIELD_BAR' && m.isActive)
    )
  );

  if (hasShieldBar) {
    reasons.push({
      code: 'ENEMY_SHIELD_BAR_COUNTER',
      category: 'ENEMY_MATCHUP',
      importance: 'SECONDARY',
      title: 'Shield Bar Toughness Encounter',
      facts: {
        hasShieldBar: true,
        teamHasResistanceShred: teamHasResistanceShred(team),
        teamHasDefShred: teamHasDefShred(team),
      },
    });
  }

  // 3. Elemental Resistance Interactions for elements present in team
  const teamElements = Array.from(new Set(team.members.map((m) => m.resonator.element))).sort();
  const relevantContexts = elementalContexts
    .filter((ctx) => teamElements.includes(ctx.element as any))
    .sort((a, b) => a.element.localeCompare(b.element));

  for (const ctx of relevantContexts) {
    reasons.push({
      code: 'ELEMENTAL_RESISTANCE_INTERACTION',
      category: 'STAGE_MATCHUP',
      importance: 'PRIMARY',
      title: `Elemental Matchup: ${ctx.element} (${Math.round(ctx.effectiveResistance * 100)}% Effective RES)`,
      facts: {
        element: ctx.element,
        baseResistance: ctx.baseResistance,
        areaModifier: ctx.areaModifier,
        teamShred: ctx.teamShred,
        effectiveResistance: ctx.effectiveResistance,
        isAdvantaged: ctx.isAdvantaged,
        isDisadvantaged: ctx.isDisadvantaged,
      },
    });
  }

  return reasons;
}

/**
 * Deterministically explains team functional role balance.
 */
export function explainRoleCoverage(team: TeamCandidate): ExplanationReason {
  const roles = extractTeamRoles(team).sort();
  const hasDps = roles.some((r) => r.toUpperCase().includes('DPS'));
  const hasSupport = roles.some(
    (r) =>
      r.toUpperCase().includes('SUPPORT') ||
      r.toUpperCase().includes('HEAL') ||
      r.toUpperCase().includes('SHIELD')
  );

  const memberRoles = team.members.map((m) => ({
    resonatorId: m.resonator.id,
    name: m.resonator.name,
    roles: m.resonator.roles.map((r) => r.code).sort(),
  })).sort((a, b) => a.resonatorId.localeCompare(b.resonatorId));

  return {
    code: 'ROLE_COVERAGE_COMPOSITION',
    category: 'ROLE_COVERAGE',
    importance: 'SECONDARY',
    title: 'Functional Role Balance',
    facts: {
      rolesPresent: roles,
      hasDps,
      hasSupport,
      isBalanced: hasDps && hasSupport,
      memberRoles,
    },
  };
}

/**
 * Deterministically explains offensive synergy capabilities across team members.
 */
export function explainOffensiveSynergies(team: TeamCandidate): ExplanationReason {
  const hasDmgAmp = teamHasDamageAmplify(team);
  const hasResShred = teamHasResistanceShred(team);
  const hasDefShred = teamHasDefShred(team);
  const hasCoord = teamHasCoordinatedAttack(team);
  const hasResource = teamHasResourceGrant(team);

  const capabilitiesPresent: string[] = [];
  if (hasDmgAmp) capabilitiesPresent.push('DMG_AMPLIFY');
  if (hasResShred) capabilitiesPresent.push('RES_SHRED');
  if (hasDefShred) capabilitiesPresent.push('DEF_SHRED');
  if (hasCoord) capabilitiesPresent.push('COORDINATED_ATTACK');
  if (hasResource) capabilitiesPresent.push('RESOURCE_GRANT');
  capabilitiesPresent.sort();

  return {
    code: 'OFFENSIVE_SYNERGY_CAPABILITIES',
    category: 'OFFENSIVE_SYNERGY',
    importance: 'SECONDARY',
    title: 'Offensive Synergy & Buff Stacking',
    facts: {
      capabilitiesPresent,
      hasDamageAmplify: hasDmgAmp,
      hasResistanceShred: hasResShred,
      hasDefShred: hasDefShred,
      hasCoordinatedAttack: hasCoord,
      hasResourceGrant: hasResource,
    },
  };
}

/**
 * Deterministically explains whether sustain was necessary and contributed to score.
 */
export function explainSustain(
  team: TeamCandidate,
  stage: ToAStage,
  teamScore: TeamStageScore
): ExplanationReason {
  const hasHealing = teamHasHealing(team);
  const hasShield = teamHasShield(team);
  const isHighThreat = stage.waves.some((w) =>
    w.enemyInstances.some(
      (inst) => inst.enemy.enemyClass === 'Overlord' || inst.enemy.enemyClass === 'Calamity'
    )
  );

  if (isHighThreat) {
    if (hasHealing || hasShield) {
      return {
        code: 'SUSTAIN_HIGH_THREAT_SATISFIED',
        category: 'SUSTAIN',
        importance: 'SECONDARY',
        title: 'Sustain Matchup for High-Threat Boss',
        facts: {
          isHighThreat: true,
          hasHealing,
          hasShield,
          sustainScore: teamScore.dimensions.sustain.score,
          weightedScore: teamScore.dimensions.sustain.weightedScore,
        },
      };
    }
    return {
      code: 'SUSTAIN_HIGH_THREAT_DEFICIT',
      category: 'SUSTAIN',
      importance: 'SECONDARY',
      title: 'High-Threat Boss Stage Without Dedicated Sustain',
      facts: {
        isHighThreat: true,
        hasHealing: false,
        hasShield: false,
        sustainScore: teamScore.dimensions.sustain.score,
        weightedScore: teamScore.dimensions.sustain.weightedScore,
      },
    };
  }

  return {
    code: 'SUSTAIN_LOW_THREAT_OFFENSIVE_PRIORITY',
    category: 'SUSTAIN',
    importance: 'INFO',
    title: 'Low-Threat Stage: Offensive Suitability Prioritized',
    facts: {
      isHighThreat: false,
      hasHealing,
      hasShield,
      sustainScore: teamScore.dimensions.sustain.score,
      weightedScore: teamScore.dimensions.sustain.weightedScore,
    },
  };
}

/**
 * Tracks stage Vigor consumption and remaining per-member reserve.
 */
export function explainStageVigor(
  assignment: StageAssignment,
  runningUsage: Map<string, number>,
  capacities: Map<string, number>,
  defaultCapacity: number
): { impact: ResourceExplanation; reason: ExplanationReason } {
  const membersImpact: MemberVigorImpact[] = [];

  for (const m of assignment.team.members) {
    const id = m.resonator.id;
    const capacity = capacities.get(id) ?? defaultCapacity;
    const usedBefore = runningUsage.get(id) ?? 0;
    const stageCost = assignment.vigorCost;
    const usedAfter = usedBefore + stageCost;
    const remaining = Math.max(0, capacity - usedAfter);

    runningUsage.set(id, usedAfter);

    membersImpact.push({
      resonatorId: id,
      name: m.resonator.name,
      stageCost,
      usedBeforeStage: usedBefore,
      usedAfterStage: usedAfter,
      capacity,
      remainingAfterStage: remaining,
    });
  }

  // Sort member impacts deterministically by resonatorId
  membersImpact.sort((a, b) => a.resonatorId.localeCompare(b.resonatorId));

  const totalConsumed = assignment.vigorCost * assignment.team.members.length;
  const summary = `Floor vigor cost: ${assignment.vigorCost} per member (${totalConsumed} total across 3 resonators).`;

  const impact: ResourceExplanation = {
    stageCost: assignment.vigorCost,
    characterVigorConsumed: totalConsumed,
    members: membersImpact,
    summary,
  };

  const reason: ExplanationReason = {
    code: 'VIGOR_STAGE_ALLOCATION',
    category: 'VIGOR',
    importance: 'SECONDARY',
    title: `Vigor Allocation: Floor Cost ${assignment.vigorCost}`,
    facts: {
      stageCost: assignment.vigorCost,
      characterVigorConsumed: totalConsumed,
      members: membersImpact.map((mi) => ({
        resonatorId: mi.resonatorId,
        name: mi.name,
        cost: mi.stageCost,
        remaining: mi.remainingAfterStage,
        capacity: mi.capacity,
      })),
    },
  };

  return { impact, reason };
}

/**
 * Compares stage assignment against local stage maximum to explain opportunity-cost tradeoffs.
 */
export function explainStageTradeoffs(
  assignment: StageAssignment,
  maxLocalCandidateScore?: number
): ExplanationReason {
  if (maxLocalCandidateScore !== undefined) {
    if (assignment.teamScore.totalScore >= maxLocalCandidateScore) {
      return {
        code: 'STAGE_OPTIMAL_LOCAL_AND_GLOBAL',
        category: 'GLOBAL_OPTIMIZATION',
        importance: 'PRIMARY',
        title: 'Local and Global Maximum Fit',
        facts: {
          stageScore: assignment.teamScore.totalScore,
          maxLocalScore: maxLocalCandidateScore,
          scoreDeficit: 0,
          isLocalPeak: true,
        },
      };
    }

    const deficit = maxLocalCandidateScore - assignment.teamScore.totalScore;
    return {
      code: 'STAGE_GLOBAL_OPPORTUNITY_TRADEOFF',
      category: 'TRADEOFF',
      importance: 'PRIMARY',
      title: 'Global Opportunity-Cost Tradeoff',
      facts: {
        stageScore: assignment.teamScore.totalScore,
        maxLocalScore: maxLocalCandidateScore,
        scoreDeficit: deficit,
        isLocalPeak: false,
        reason:
          'A higher locally scoring team was assigned to another stage or reserved to preserve overall multi-stage total score.',
      },
    };
  }

  return {
    code: 'STAGE_GLOBAL_ASSIGNMENT_COHERENT',
    category: 'GLOBAL_OPTIMIZATION',
    importance: 'PRIMARY',
    title: 'Globally Coherent Team Selection',
    facts: {
      stageScore: assignment.teamScore.totalScore,
      isLocalPeak: true,
    },
  };
}

/**
 * Builds complete StageExplanation for an assignment.
 */
export function buildStageExplanation(
  assignment: StageAssignment,
  stage: ToAStage,
  runningUsage: Map<string, number>,
  capacities: Map<string, number>,
  defaultCapacity: number,
  maxLocalCandidateScore?: number
): StageExplanation {
  const { towerName, floor } = parseStageIdentity(stage);
  const scoreBreakdown = buildStageScoreBreakdown(assignment.teamScore);
  const areaEffects = explainAreaEffects(assignment.team, stage);
  const enemyReasons = explainEnemyMatchup(assignment.team, stage);
  const roleReason = explainRoleCoverage(assignment.team);
  const synergyReason = explainOffensiveSynergies(assignment.team);
  const sustainReason = explainSustain(assignment.team, stage, assignment.teamScore);
  const { impact, reason: vigorReason } = explainStageVigor(
    assignment,
    runningUsage,
    capacities,
    defaultCapacity
  );
  const tradeoffReason = explainStageTradeoffs(assignment, maxLocalCandidateScore);

  // Group reasons into primaryReasons, supportingReasons, tradeoffs
  const primaryReasons: ExplanationReason[] = [];
  const supportingReasons: ExplanationReason[] = [];
  const tradeoffs: ExplanationReason[] = [];

  // Top score contributor reason
  if (scoreBreakdown.topContributors.length > 0) {
    const top = scoreBreakdown.topContributors[0];
    primaryReasons.push({
      code: 'SCORE_PRIMARY_DRIVER',
      category: 'STAGE_MATCHUP',
      importance: 'PRIMARY',
      title: `Primary Score Driver: ${top.name}`,
      facts: {
        dimension: top.dimensionKey,
        name: top.name,
        weightedScore: top.weightedScore,
        maxWeight: top.maxWeight,
        percentageOfMax: top.percentageOfMax,
      },
    });
  }

  // Add utilized area effects as primary reasons
  primaryReasons.push(...areaEffects.utilized);

  // Add primary enemy reasons (e.g. boss encounter, elemental matchup)
  for (const r of enemyReasons) {
    if (r.importance === 'PRIMARY') {
      primaryReasons.push(r);
    } else {
      supportingReasons.push(r);
    }
  }

  // Supporting reasons: role coverage, offensive synergy, sustain, vigor, unutilized area effects
  supportingReasons.push(roleReason);
  supportingReasons.push(synergyReason);
  supportingReasons.push(sustainReason);
  supportingReasons.push(vigorReason);
  supportingReasons.push(...areaEffects.unmatched);

  // Tradeoffs
  tradeoffs.push(tradeoffReason);

  // Sort each list deterministically: importance -> category -> code -> title
  const sortReasons = (list: ExplanationReason[]) => {
    list.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      if (a.code !== b.code) {
        return a.code.localeCompare(b.code);
      }
      return a.title.localeCompare(b.title);
    });
  };

  sortReasons(primaryReasons);
  sortReasons(supportingReasons);
  sortReasons(tradeoffs);

  return {
    stageKey: `${stage.patchId}:${stage.id}`,
    towerName,
    floor,
    selectedTeamKey: assignment.teamKey,
    score: assignment.teamScore.totalScore,
    scoreBreakdown,
    primaryReasons,
    supportingReasons,
    tradeoffs,
    resourceImpact: impact,
  };
}
