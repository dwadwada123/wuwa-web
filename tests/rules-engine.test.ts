import test from 'node:test';
import assert from 'node:assert/strict';

import {
  // Evaluators
  evaluateResonator,
  evaluateBuild,
  evaluateTeam,
  evaluateElementalMatchup,
  evaluateStageBuffCompatibility,
  evaluateEnemyMatchup,
  validateStagePatch,
  validateCyclePatch,
  // Effect helpers
  hasEffectCategory,
  collectBuildEffects,
  collectTeamEffects,
  // Rule IDs
  RULE_RESONATOR_OWNED,
  RULE_RESONATOR_RELEASED,
  RULE_BUILD_WEAPON_TYPE_MATCH,
  RULE_BUILD_WEAPON_OWNED,
  RULE_TEAM_SIZE,
  RULE_NO_DUPLICATE_RESONATOR,
  RULE_ROLE_BALANCE,
  RULE_STAGE_PATCH_MATCH,
  RULE_CYCLE_PATCH_MATCH,
  RULE_STAGE_BUFF_COMPATIBILITY,
} from '../lib/engine/index.ts';

import type {
  TeamCandidate,
  RuleEvaluationContext,
  ToACycle,
  GameplayEffect,
} from '../lib/domain/types/index.ts';

import {
  patchContext37,
  patchContext36,
  fullOwnedRoster,
  partialOwnedRoster,
  jinhsi,
  verina,
  jianxin,
  yangyang,
  futureResonator,
  ageOfHarvestWeapon,
  swordEmeraldGenesis,
  bellBorneEcho,
  sierraGaleSonata,
  stageHazardZone37,
  stageHazardZone36,
  healEffect,
  shieldEffect,
  aeroResShredEffect,
  defShredEffect,
  dmgAmplifyEffect,
  coordAttackEffect,
  resourceGrantEffect,
  statBuffEffect,
  specialMechanicEffect,
  stateChangeEffect,
} from './fixtures/domain-fixtures.ts';

test('Rules Engine - Availability Rules', () => {
  const context37: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  // 1. Owned + Released
  const jinhsiResults = evaluateResonator(jinhsi, context37);
  const ownedRule = jinhsiResults.find((r) => r.ruleId === RULE_RESONATOR_OWNED);
  const releasedRule = jinhsiResults.find((r) => r.ruleId === RULE_RESONATOR_RELEASED);

  assert.ok(ownedRule?.passed, 'Owned resonator must pass ownership check');
  assert.equal(ownedRule?.severity, 'HARD');
  assert.ok(releasedRule?.passed, 'Released resonator must pass release check');
  assert.equal(releasedRule?.severity, 'HARD');

  // 2. Unowned + Released
  const partialContext: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: partialOwnedRoster, // missing Jianxin
  };
  const unownedResults = evaluateResonator(jianxin, partialContext);
  const unownedRule = unownedResults.find((r) => r.ruleId === RULE_RESONATOR_OWNED);
  assert.equal(unownedRule?.passed, false, 'Unowned resonator must fail ownership check');
  assert.equal(unownedRule?.severity, 'HARD');

  // 3. Owned + Future Release (relative to snapshot date)
  const rosterWithFuture: RuleEvaluationContext = {
    patchContext: patchContext37, // snapshotDate: 2026-09-14
    roster: {
      userId: 'test-user',
      resonatorIds: [futureResonator.id], // futureResonator releaseDate: 2026-11-01
    },
  };
  const futureResults = evaluateResonator(futureResonator, rosterWithFuture);
  const futureRule = futureResults.find((r) => r.ruleId === RULE_RESONATOR_RELEASED);
  assert.equal(futureRule?.passed, false, 'Future resonator must fail release check for past snapshot');
  assert.equal(futureRule?.severity, 'HARD');

  // 4. Build Weapon Type Mismatch
  const invalidWeaponBuild = {
    resonator: jinhsi, // Broadblade
    weapon: swordEmeraldGenesis, // Sword
  };
  const buildMismatchResults = evaluateBuild(invalidWeaponBuild, context37);
  const mismatchRule = buildMismatchResults.find((r) => r.ruleId === RULE_BUILD_WEAPON_TYPE_MATCH);
  assert.equal(mismatchRule?.passed, false, 'Mismatched weapon type must fail');
  assert.equal(mismatchRule?.severity, 'HARD');

  // 5. Valid Weapon Build
  const validWeaponBuild = {
    resonator: jinhsi,
    weapon: ageOfHarvestWeapon,
  };
  const validBuildResults = evaluateBuild(validWeaponBuild, context37);
  const validWeaponRule = validBuildResults.find((r) => r.ruleId === RULE_BUILD_WEAPON_TYPE_MATCH);
  assert.ok(validWeaponRule?.passed, 'Matching weapon type must pass');

  // 6. Unowned Weapon Build
  const unownedWeaponContext: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: {
      resonatorIds: [jinhsi.id],
      weaponIds: ['unrelated-weapon-id'], // ageOfHarvestWeapon not owned
    },
  };
  const unownedWeaponResults = evaluateBuild(validWeaponBuild, unownedWeaponContext);
  const weaponOwnedRule = unownedWeaponResults.find((r) => r.ruleId === RULE_BUILD_WEAPON_OWNED);
  assert.equal(weaponOwnedRule?.passed, false, 'Unowned weapon must fail build evaluation');
  assert.equal(weaponOwnedRule?.severity, 'HARD');
});

test('Rules Engine - Team Validation Hard Constraints', () => {
  const context: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  // 1. Valid 3-character team
  const validTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi, weapon: ageOfHarvestWeapon },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };
  const validReport = evaluateTeam(validTeam, context);
  assert.equal(validReport.isValid, true, 'Valid 3-character team must pass all HARD constraints');
  assert.equal(validReport.violations.filter((v) => v.severity === 'HARD').length, 0);

  // 2. Team size != 3 (e.g. 2 members)
  const undersizedTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
    ],
  };
  const underReport = evaluateTeam(undersizedTeam, context);
  assert.equal(underReport.isValid, false, 'Undersized team must be invalid');
  const sizeViolation = underReport.violations.find((v) => v.ruleId === RULE_TEAM_SIZE);
  assert.ok(sizeViolation, 'RULE_TEAM_SIZE violation must be generated');
  assert.equal(sizeViolation?.severity, 'HARD');

  // 3. Duplicate resonator
  const duplicateTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: jinhsi },
      { resonator: verina },
    ],
  };
  const dupReport = evaluateTeam(duplicateTeam, context);
  assert.equal(dupReport.isValid, false, 'Duplicate resonator team must be invalid');
  const dupViolation = dupReport.violations.find((v) => v.ruleId === RULE_NO_DUPLICATE_RESONATOR);
  assert.ok(dupViolation, 'RULE_NO_DUPLICATE_RESONATOR violation must be generated');
  assert.equal(dupViolation?.severity, 'HARD');

  // 4. Unowned member in team
  const unownedContext: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: partialOwnedRoster, // only jinhsi and verina owned
  };
  const unownedMemberTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
      { resonator: jianxin }, // unowned
    ],
  };
  const unownedReport = evaluateTeam(unownedMemberTeam, unownedContext);
  assert.equal(unownedReport.isValid, false, 'Team containing unowned member must be invalid');
  assert.ok(unownedReport.violations.some((v) => v.ruleId === RULE_RESONATOR_OWNED));

  // 5. Future unreleased member in team
  const rosterWithFuture: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: {
      resonatorIds: [jinhsi.id, verina.id, futureResonator.id],
    },
  };
  const futureTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
      { resonator: futureResonator },
    ],
  };
  const futureReport = evaluateTeam(futureTeam, rosterWithFuture);
  assert.equal(futureReport.isValid, false, 'Team containing future unreleased member must be invalid');
  assert.ok(futureReport.violations.some((v) => v.ruleId === RULE_RESONATOR_RELEASED));
});

test('Rules Engine - Roles and Combat Tags Normalization', () => {
  const context: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  const balancedTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi }, // MAIN_DPS
      { resonator: yangyang }, // SUB_DPS, SUPPORT
      { resonator: verina }, // SUPPORT, HEALER
    ],
  };
  const report = evaluateTeam(balancedTeam, context);

  // Check normalized roles propagation
  assert.ok(report.rolesPresent.includes('MAIN_DPS'), 'Must include MAIN_DPS');
  assert.ok(report.rolesPresent.includes('SUB_DPS'), 'Must include SUB_DPS');
  assert.ok(report.rolesPresent.includes('SUPPORT'), 'Must include SUPPORT');
  assert.ok(report.rolesPresent.includes('HEALER'), 'Must include HEALER');

  // Check normalized combat tags propagation
  assert.ok(report.combatTagsPresent.includes('SPECTRO_DMG'));
  assert.ok(report.combatTagsPresent.includes('AERO_DMG'));
  assert.ok(report.combatTagsPresent.includes('HEALING'));

  // Role balance soft rule passed
  const roleBalanceRule = report.results.find((r) => r.ruleId === RULE_ROLE_BALANCE);
  assert.ok(roleBalanceRule?.passed, 'Balanced team should pass role balance check');

  // Check team without DPS (all pure supports)
  const allSupportTeam: TeamCandidate = {
    members: [
      { resonator: verina },
      { resonator: jianxin },
      { resonator: verina },
    ],
  };
  const allSupportReport = evaluateTeam(allSupportTeam, context);
  const supportOnlyBalance = allSupportReport.results.find((r) => r.ruleId === RULE_ROLE_BALANCE);
  assert.equal(supportOnlyBalance?.passed, false, 'All-support team should fail role balance check');
  assert.equal(supportOnlyBalance?.severity, 'SOFT');
});

test('Rules Engine - Gameplay Effects Taxonomy (All 10 Categories)', () => {
  const allEffects: GameplayEffect[] = [
    statBuffEffect,
    dmgAmplifyEffect,
    coordAttackEffect,
    defShredEffect,
    aeroResShredEffect,
    healEffect,
    shieldEffect,
    specialMechanicEffect,
    resourceGrantEffect,
    stateChangeEffect,
  ];

  // Verify all 10 categories are identifiable deterministically
  assert.ok(hasEffectCategory(allEffects, 'STAT_BUFF'));
  assert.ok(hasEffectCategory(allEffects, 'DMG_AMPLIFY'));
  assert.ok(hasEffectCategory(allEffects, 'COORDINATED_ATTACK'));
  assert.ok(hasEffectCategory(allEffects, 'DEF_SHRED'));
  assert.ok(hasEffectCategory(allEffects, 'RES_SHRED'));
  assert.ok(hasEffectCategory(allEffects, 'HEALING'));
  assert.ok(hasEffectCategory(allEffects, 'SHIELD'));
  assert.ok(hasEffectCategory(allEffects, 'SPECIAL_MECHANIC'));
  assert.ok(hasEffectCategory(allEffects, 'RESOURCE_GRANT'));
  assert.ok(hasEffectCategory(allEffects, 'STATE_CHANGE'));

  // Test structured capability extraction on candidate team
  const testTeam: TeamCandidate = {
    members: [
      {
        resonator: jinhsi,
        weapon: ageOfHarvestWeapon, // provides STAT_BUFF
      },
      {
        resonator: verina, // provides HEALING, STAT_BUFF, RESOURCE_GRANT
      },
      {
        resonator: jianxin, // provides SHIELD, SPECIAL_MECHANIC
        echo: bellBorneEcho, // provides SHIELD
      },
    ],
  };

  const context: RuleEvaluationContext = {
    patchContext: patchContext37,
    roster: fullOwnedRoster,
  };

  const report = evaluateTeam(testTeam, context);
  assert.equal(report.hasHealing, true, 'Team with Verina has healing');
  assert.equal(report.hasShield, true, 'Team with Jianxin has shield');
  assert.equal(report.hasResourceGrant, true, 'Team with Verina has resource grant');
  assert.equal(report.hasDamageAmplify, true, 'Team with Jinhsi skill has damage amplify');
  assert.equal(report.hasCoordinatedAttack, false, 'Team has no coordinated attack');
  assert.equal(report.hasResistanceShred, false, 'Team has no RES shred');
});

test('Rules Engine - Elemental Matchup and Resistance Calculation', () => {
  // Test team with Aero damage and Aero RES shred (Yangyang outro)
  const aeroTeam: TeamCandidate = {
    members: [
      { resonator: yangyang, weapon: swordEmeraldGenesis }, // Aero, provides 0.10 Aero RES shred
      { resonator: jianxin }, // Aero
      { resonator: verina }, // Spectro
    ],
  };

  const contexts = evaluateElementalMatchup(aeroTeam, stageHazardZone37);

  // In stageHazardZone37:
  // Enemies have Aero base RES = 0.20
  // Area effect "Resonant Windcurrents" Aero RES modifier = -0.10
  // Team Aero RES shred = 0.10
  // Effective Aero RES = 0.20 + (-0.10) - 0.10 = 0.00
  const aeroCtx = contexts.find((c) => c.element === 'Aero');
  assert.ok(aeroCtx, 'Aero resistance context must be computed');
  assert.equal(aeroCtx?.baseResistance, 0.20);
  assert.equal(aeroCtx?.areaModifier, -0.10);
  assert.equal(aeroCtx?.teamShred, 0.10);
  assert.equal(aeroCtx?.effectiveResistance, 0.00);
  assert.equal(aeroCtx?.isAdvantaged, true, '0% effective resistance should be marked advantaged');

  // Electro resistance:
  // Boss Tempest Mephis has base Electro RES = 0.40
  // Area effect Electro modifier = 0
  // Team has no Electro shred = 0
  // Effective Electro RES = 0.40
  const electroCtx = contexts.find((c) => c.element === 'Electro');
  assert.ok(electroCtx, 'Electro resistance context must be computed');
  assert.equal(electroCtx?.baseResistance, 0.40);
  assert.equal(electroCtx?.effectiveResistance, 0.40);
  assert.equal(electroCtx?.isDisadvantaged, true, '40% effective resistance should be marked disadvantaged');
});

test('Rules Engine - ToA Stage Buff Compatibility', () => {
  // Candidate team:
  // Jianxin (Shield)
  // Yangyang (Aero, RES_SHRED, DEF_SHRED)
  // Verina (Spectro, Support)
  const matchingTeam: TeamCandidate = {
    members: [
      { resonator: jianxin },
      { resonator: yangyang },
      { resonator: verina },
    ],
  };

  const compatResult = evaluateStageBuffCompatibility(matchingTeam, stageHazardZone37);

  assert.equal(compatResult.benefited, true, 'Team should benefit from stage buffs');
  assert.ok(compatResult.matchedEffects.length >= 3, 'Should match multiple stage buffs');

  // Verify specific buff triggers
  const shieldBuff = compatResult.matchedEffects.find((m) => m.triggerCategory === 'SHIELD');
  assert.ok(shieldBuff, 'Shield stage buff must be matched by team with Jianxin');
  assert.ok(shieldBuff?.matchedByMemberIds.includes(jianxin.id));

  const aeroBuff = compatResult.matchedEffects.find((m) => m.triggerCategory === 'ELEMENTAL_AFFINITY');
  assert.ok(aeroBuff, 'Aero stage buff must be matched by Aero team members');
  assert.ok(aeroBuff?.matchedByMemberIds.includes(jianxin.id));
  assert.ok(aeroBuff?.matchedByMemberIds.includes(yangyang.id));

  const introBuff = compatResult.matchedEffects.find((m) => m.triggerCategory === 'INTRO_SKILL');
  assert.ok(introBuff, 'Intro skill stage buff must be matched');

  const debuffBuff = compatResult.matchedEffects.find((m) => m.triggerCategory === 'NEGATIVE_STATUS');
  assert.ok(debuffBuff, 'Debuff stage buff must be matched by team with shred');

  // Unmatched test: Team without shield
  const noShieldTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
      { resonator: yangyang },
    ],
  };
  const noShieldCompat = evaluateStageBuffCompatibility(noShieldTeam, stageHazardZone37);
  const unmatchedShield = noShieldCompat.unmatchedEffects.find((u) => u.description.includes('shield'));
  assert.ok(unmatchedShield, 'Shield buff must appear in unmatchedEffects when team has no shield');
});

test('Rules Engine - Enemy Matchup Facts', () => {
  const team: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };

  const facts = evaluateEnemyMatchup(team, stageHazardZone37);

  assert.equal(facts.enemyCount, 2, 'Stage has 2 enemy instances');
  assert.equal(facts.waveCount, 1, 'Stage has 1 wave');
  assert.equal(facts.bossPresence, true, 'Tempest Mephis is Overlord boss');
  assert.equal(facts.elitePresence, true, 'Chasm Guardian is Elite');
  assert.ok(facts.effectiveResistanceContexts.length > 0, 'Resistance contexts included');
  assert.ok(facts.relevantTeamEffects.length > 0, 'Relevant team counters included');
});

test('Rules Engine - Patch Isolation Hard Constraint', () => {
  const context37: RuleEvaluationContext = {
    patchContext: patchContext37, // Patch 3.7
    roster: fullOwnedRoster,
  };

  const validTeam: TeamCandidate = {
    members: [
      { resonator: jinhsi },
      { resonator: verina },
      { resonator: jianxin },
    ],
  };

  // 1. Evaluating Patch 3.7 stage with Patch 3.7 context -> PASS
  const stage37Check = validateStagePatch(stageHazardZone37, context37);
  assert.equal(stage37Check.passed, true);
  assert.equal(stage37Check.severity, 'HARD');

  const report37 = evaluateTeam(validTeam, context37, stageHazardZone37);
  assert.equal(report37.isValid, true, 'Team evaluation under matching patch must pass');

  // 2. Evaluating Patch 3.6 stage with Patch 3.7 context -> HARD VIOLATION
  const stage36Check = validateStagePatch(stageHazardZone36, context37);
  assert.equal(stage36Check.passed, false, 'Cross-patch evaluation must fail');
  assert.equal(stage36Check.severity, 'HARD');

  const report36 = evaluateTeam(validTeam, context37, stageHazardZone36);
  assert.equal(report36.isValid, false, 'Team evaluation under mismatched patch must be invalid');
  const patchViolation = report36.violations.find((v) => v.ruleId === RULE_STAGE_PATCH_MATCH);
  assert.ok(patchViolation, 'RULE_STAGE_PATCH_MATCH violation must be recorded');
  assert.equal(patchViolation?.severity, 'HARD');

  // 3. Cycle patch isolation check
  const cycle36: ToACycle = {
    id: 'cycle-s39',
    patchId: 'patch-3-6-uuid',
    cycleName: 'Season 39',
    startTime: '2026-08-01',
    endTime: '2026-08-28',
    towers: [],
  };
  const cycleCheck = validateCyclePatch(cycle36, context37);
  assert.equal(cycleCheck.passed, false, 'Cycle from different patch must fail patch isolation');
  assert.equal(cycleCheck.severity, 'HARD');
});
