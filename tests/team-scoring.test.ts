import test from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreTeamForStage,
  compareTeamStageScores,
  sortTeamStageScores,
  generateTeamCandidates,
  TEAM_SCORING_CONFIG,
} from '../lib/engine/index.ts';

import type {
  TeamCandidate,
  TeamScoringContext,
  TeamGenerationContext,
  ResonatorBuild,
} from '../lib/domain/types/index.ts';

import {
  patchContext37,
  patchContext36,
  fullOwnedRoster,
  jinhsi,
  verina,
  jianxin,
  yangyang,
  futureResonator,
  ageOfHarvestWeapon,
  swordEmeraldGenesis,
  availableResonatorsList,
  stageHazardZone37,
  createSyntheticRoster,
} from './fixtures/domain-fixtures.ts';

import {
  resonantTowerFloor1,
  resonantTowerFloor4,
  hazardTowerFloor1,
  hazardTowerFloor3,
  echoingTowerFloor1,
  echoingTowerFloor4,
  allSeason40Stages,
} from './fixtures/season40-fixtures.ts';

test('Team Scoring - Basic Validation and Dimensional Breakdown', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  const validTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi, weapon: ageOfHarvestWeapon },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };

  const score = scoreTeamForStage(validTeam, resonantTowerFloor4, context);

  // 1. Must be valid
  assert.equal(score.valid, true, 'Valid candidate team must score as valid');
  assert.ok(score.totalScore > 0, 'Total score must be positive');
  assert.ok(score.totalScore <= 1000, 'Total score must not exceed 1000');

  // 2. Strict integer sum breakdown guarantee: sum(weightedScores) === totalScore
  const sumOfDimensions =
    score.dimensions.roleCoverage.weightedScore +
    score.dimensions.elementalMatchup.weightedScore +
    score.dimensions.enemyMatchup.weightedScore +
    score.dimensions.stageBuffCompatibility.weightedScore +
    score.dimensions.offensiveSynergy.weightedScore +
    score.dimensions.sustain.weightedScore +
    score.dimensions.resistanceUtility.weightedScore +
    score.dimensions.coordinatedAttackSynergy.weightedScore +
    score.dimensions.resourceSynergy.weightedScore;

  assert.equal(
    score.totalScore,
    sumOfDimensions,
    'Total score must equal exact sum of all 9 weighted dimension scores'
  );

  // 3. Evidence structure check
  assert.ok(score.evidence.length >= 5, 'Must provide structured evidence summary');
  assert.ok(score.dimensions.roleCoverage.evidence.length > 0);
  assert.ok(score.dimensions.elementalMatchup.evidence.length > 0);
  assert.ok(score.dimensions.stageBuffCompatibility.evidence.length > 0);
});

test('Team Scoring - Hard Rejection Handling', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  // 1. Team with unreleased character
  const futureTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
      { resonator: futureResonator }, // Unreleased in Patch 3.7 snapshot
    ],
  };
  const futureScore = scoreTeamForStage(futureTeam, resonantTowerFloor4, context);
  assert.equal(futureScore.valid, false, 'Candidate with unreleased resonator must be marked invalid');
  assert.equal(futureScore.totalScore, 0, 'Invalid candidate must score exactly 0');
  assert.ok(futureScore.warnings.length > 0, 'Must record rule violations');
  assert.ok(futureScore.evidence.some((e) => e.includes('HARD REJECTION')));

  // 2. Team with weapon type mismatch
  const invalidWeaponTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi, weapon: swordEmeraldGenesis }, // Sword on Broadblade
      { resonator: verina },
      { resonator: jianxin },
    ],
  };
  const invalidWeaponScore = scoreTeamForStage(invalidWeaponTeam, resonantTowerFloor4, context);
  assert.equal(invalidWeaponScore.valid, false);
  assert.equal(invalidWeaponScore.totalScore, 0);

  // 3. Cross-patch stage mismatch
  const mismatchContext: TeamScoringContext = {
    patchContext: patchContext36, // Context is Patch 3.6, but stage is Patch 3.7
    roster: fullOwnedRoster,
  };
  const validTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi, weapon: ageOfHarvestWeapon },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };
  const patchMismatchScore = scoreTeamForStage(validTeam, resonantTowerFloor4, mismatchContext);
  assert.equal(patchMismatchScore.valid, false, 'Cross-patch stage must trigger hard rejection');
  assert.equal(patchMismatchScore.totalScore, 0);
});

test('Team Scoring - Elemental Matchup Dimension Sensitivity', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  // Team A: Aero focus (Yangyang + Jianxin + Verina)
  // Evaluated against Resonant Tower Floor 4 (Aero Shred -10% area buff!)
  const aeroTeam: TeamCandidate = {
    members: [
      { resonator: yangyang, weapon: swordEmeraldGenesis },
      { resonator: jianxin },
      { resonator: verina },
    ],
  };
  const aeroScore = scoreTeamForStage(aeroTeam, resonantTowerFloor4, context);

  // Team B: Electro team against Mech Abomination (Mech Abomination has 40% Electro RES!)
  const electroResonator = {
    ...jinhsi,
    id: 'res-synth-electro',
    name: 'Electro Specialist',
    element: 'Electro' as const,
  };
  const electroRosterContext: TeamScoringContext = {
    patchContext: patchContext37,
    roster: {
      userId: 'test-user',
      resonatorIds: [electroResonator.id, verina.id, jianxin.id],
    },
  };
  const electroTeam: TeamCandidate = {
    members: [
      { resonator: electroResonator },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };
  const electroScore = scoreTeamForStage(electroTeam, resonantTowerFloor4, electroRosterContext);

  assert.ok(
    aeroScore.dimensions.elementalMatchup.score > electroScore.dimensions.elementalMatchup.score,
    `Aero team under Aero buff (${aeroScore.dimensions.elementalMatchup.score}) must score higher on elementalMatchup than Electro team facing 40% Electro RES (${electroScore.dimensions.elementalMatchup.score})`
  );
});

test('Team Scoring - Stage Buff Compatibility Dimension', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  // Team with Shielder (Jianxin) evaluated on Hazard Tower Floor 3 (has Shield Fusion Amp buff)
  const shielderTeam: TeamCandidate = {
    members: [
      { resonator: jianxin },
      { resonator: verina },
      { resonator: jinhsi },
    ],
  };
  const shielderScore = scoreTeamForStage(shielderTeam, hazardTowerFloor3, context);

  // Team without Shielder on Hazard Tower Floor 3
  const noShieldTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
      { resonator: yangyang },
    ],
  };
  const noShieldScore = scoreTeamForStage(noShieldTeam, hazardTowerFloor3, context);

  assert.ok(
    shielderScore.dimensions.stageBuffCompatibility.score >=
      noShieldScore.dimensions.stageBuffCompatibility.score,
    'Team with shielder should better match shield-based stage buffs'
  );
});

test('Team Scoring - Sustain Dimension Sensitivity to Threat Level', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  const fullSustainTeam: TeamCandidate = {
    members: [
      { resonator: verina }, // Healer
      { resonator: jianxin }, // Shielder
      { resonator: jinhsi },
    ],
  };

  const noSustainDps = {
    ...jinhsi,
    id: 'res-dps-nosustain',
    name: 'DPS No Sustain',
    roles: [{ code: 'MAIN_DPS', label: 'Main DPS', isPrimary: true }],
    abilities: [],
  };
  const noSustainContext: TeamScoringContext = {
    patchContext: patchContext37,
    roster: {
      resonatorIds: [jinhsi.id, yangyang.id, noSustainDps.id],
    },
  };
  const noSustainTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: yangyang },
      { resonator: noSustainDps },
    ],
  };

  // On Level 100 Boss Stage (hazardTowerFloor1: Impermanence Heron Boss)
  const bossSustainScore = scoreTeamForStage(fullSustainTeam, hazardTowerFloor1, context);
  const bossNoSustainScore = scoreTeamForStage(noSustainTeam, hazardTowerFloor1, noSustainContext);

  assert.ok(bossNoSustainScore.valid, 'Team without sustain is still valid');
  assert.ok(
    bossSustainScore.dimensions.sustain.score > bossNoSustainScore.dimensions.sustain.score,
    `Boss stage heavily penalizes lack of sustain: ${bossSustainScore.dimensions.sustain.score} vs ${bossNoSustainScore.dimensions.sustain.score}`
  );
});

test('Team Scoring - Determinism and Serialization Guarantee', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  const team: TeamCandidate = {
    members: [
      { resonator: jinhsi, weapon: ageOfHarvestWeapon },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };

  const score1 = scoreTeamForStage(team, resonantTowerFloor4, context);
  const score2 = scoreTeamForStage(team, resonantTowerFloor4, context);

  assert.equal(score1.totalScore, score2.totalScore);
  assert.equal(
    JSON.stringify(score1),
    JSON.stringify(score2),
    'Score output must be byte-for-byte identical across separate evaluation runs'
  );
});

test('Team Scoring - Deterministic Tie-Breaking Order', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  const teamA: TeamCandidate = {
    members: [
      { resonator: jinhsi, weapon: ageOfHarvestWeapon },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };

  const teamB: TeamCandidate = {
    members: [
      { resonator: yangyang, weapon: swordEmeraldGenesis },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };

  const scoreA = scoreTeamForStage(teamA, resonantTowerFloor4, context);
  const scoreB = scoreTeamForStage(teamB, resonantTowerFloor4, context);

  const sorted = sortTeamStageScores([scoreA, scoreB]);
  assert.equal(sorted.length, 2);

  // Sorting twice produces identical order
  const sortedAgain = sortTeamStageScores([scoreB, scoreA]);
  assert.equal(sorted[0].candidateKey, sortedAgain[0].candidateKey);
});

test('Team Scoring - Season 40 Canonical Stages Regression Test', () => {
  const context: TeamScoringContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  const candidate: TeamCandidate = {
    members: [
      { resonator: jinhsi, weapon: ageOfHarvestWeapon },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };

  const stageScores = new Map<string, number>();

  for (const stage of allSeason40Stages) {
    const stageScore = scoreTeamForStage(candidate, stage, context);
    assert.ok(stageScore.valid, `Must score validly for stage ${stage.id}`);
    assert.ok(stageScore.totalScore > 0);
    assert.ok(stageScore.totalScore <= 1000);

    // Sum breakdown check for all 6 stages
    const dimSum =
      stageScore.dimensions.roleCoverage.weightedScore +
      stageScore.dimensions.elementalMatchup.weightedScore +
      stageScore.dimensions.enemyMatchup.weightedScore +
      stageScore.dimensions.stageBuffCompatibility.weightedScore +
      stageScore.dimensions.offensiveSynergy.weightedScore +
      stageScore.dimensions.sustain.weightedScore +
      stageScore.dimensions.resistanceUtility.weightedScore +
      stageScore.dimensions.coordinatedAttackSynergy.weightedScore +
      stageScore.dimensions.resourceSynergy.weightedScore;
    assert.equal(stageScore.totalScore, dimSum);

    stageScores.set(stage.id, stageScore.totalScore);
  }

  // Verify that the 6 Season 40 stages do not produce identical flat scores across different environments
  const scoresArray = Array.from(stageScores.values());
  const uniqueScores = new Set(scoresArray);
  assert.ok(
    uniqueScores.size >= 3,
    `Stage scores must be stage-relative and reflect differing area effects/enemies: ${Array.from(stageScores.entries()).map(([k, v]) => `${k}:${v}`).join(', ')}`
  );
});

test('Team Scoring - 50+ Resonator Benchmark (Multi-Stage Hot Loop)', () => {
  const { roster, resonators } = createSyntheticRoster(50);

  const genContext: TeamGenerationContext = {
    patchContext: patchContext37,
    availableResonators: resonators,
  };

  // Generate 19,600 candidates
  const candidates = generateTeamCandidates(roster, genContext);
  assert.equal(candidates.length, 19600);

  const scoringContext: TeamScoringContext = {
    patchContext: patchContext37,
    roster,
  };

  // Evaluate across 3 distinct Season 40 stages (19,600 * 3 = 58,800 candidate-stage evaluations)
  const benchmarkStages = [resonantTowerFloor1, resonantTowerFloor4, hazardTowerFloor1];

  const startTime = performance.now();
  let evaluationsCount = 0;

  for (const stage of benchmarkStages) {
    for (const c of candidates) {
      const score = scoreTeamForStage(c, stage, scoringContext);
      if (score.valid) evaluationsCount++;
    }
  }

  const durationMs = performance.now() - startTime;
  const evalsPerSec = Math.round((evaluationsCount / durationMs) * 1000);

  console.log(
    `[BENCHMARK] ${candidates.length} candidates x ${benchmarkStages.length} stages = ${evaluationsCount} evaluations in ${durationMs.toFixed(2)}ms (${evalsPerSec} evals/sec)`
  );

  assert.equal(evaluationsCount, 19600 * 3, 'All 58,800 candidate-stage evaluations must complete successfully');
  assert.ok(
    durationMs < 10000,
    `58,800 candidate-stage evaluations took ${durationMs.toFixed(2)}ms (must be well under 10s)`
  );
});
