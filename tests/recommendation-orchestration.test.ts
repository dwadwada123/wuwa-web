/**
 * Wuthering Waves Deterministic End-to-End Recommendation Orchestration Contract Test Suite
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Exhaustively tests contract identity, strict input validation, upstream contract integration (Steps 19-23),
 * status semantics, independent adversarial auditing, cache isolation, twenty-run determinism,
 * regression safety, and realistic Season 40 full-pipeline fixtures.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  REQUIRED_STEP19_RULE_VERSION,
  REQUIRED_STEP20_RULE_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  REQUIRED_STEP22_RULE_VERSION,
  REQUIRED_STEP23_RULE_VERSION,
  DEFAULT_PORTFOLIO_TARGET_K,
  MAX_RESONATOR_VIGOR,
  CANONICAL_STAGE_COUNT,
  PROHIBITED_RECOMMENDATION_KEYS
} from '../lib/engine/recommendation-orchestration/rules.ts';

import {
  orchestrateRecommendations,
  getRecommendationOrchestrationResult,
  getDefaultEndToEndRecommendation,
  orchestrateRecommendationsForRoster,
  clearRecommendationOrchestrationCache,
  auditSingleRecommendationOrchestration,
  auditRecommendationOrchestrationResult,
  formatRecommendationOrchestrationExplanation,
  deriveSnapshotFingerprint,
  deriveRecommendationOrchestrationId,
  validateRecommendationOrchestrationInput,
  assertNoProhibitedRecommendationKeys,
  type RecommendationOrchestrationInput,
  type EndToEndRecommendation,
  type ResonatorInvestmentSnapshot
} from '../lib/engine/recommendation-orchestration/index.ts';

import {
  deepClone,
  deepFreeze
} from '../lib/engine/recommendation-orchestration/predicates.ts';

import { TOA_ALLOCATION_RULE_VERSION } from '../lib/engine/toa-allocation/rules.ts';
import { TEAM_PORTFOLIO_RULE_VERSION } from '../lib/engine/team-portfolio/rules.ts';
import { TEAM_BUILD_EVALUATION_RULE_VERSION } from '../lib/engine/team-build-evaluation/rules.ts';
import { CHARACTER_BUILD_EVALUATION_RULE_VERSION } from '../lib/engine/character-build-evaluation/rules.ts';
import { CHARACTER_DECISION_CONTEXT_RULE_VERSION } from '../lib/engine/character-decision-context/rules.ts';
import { getKnownResonatorIds } from '../lib/engine/team-composition/repository.ts';

// 9 representative canonical Resonators for tests
const NINE_OWNED_RESONATORS = Object.freeze([
  'Jinhsi',
  'Changli',
  'Shorekeeper',
  'Xiangli Yao',
  'Yinlin',
  'Verina',
  'Jiyan',
  'Mortefi',
  'Baizhi'
]);

function makeTestInvestmentSnapshot(
  resonatorId: string,
  weaponConfig?: {
    weaponId: string;
    weaponLevel?: number;
    refinementRank?: number;
  },
  echoConfig?: {
    sonataSetId: string;
    equippedCount?: number;
    tunedCount?: number;
    maxLevelCount?: number;
  }
): ResonatorInvestmentSnapshot {
  return {
    id: `resonator-investment:3.7:${resonatorId}:7.13.1`,
    patchVersion: '3.7',
    ruleVersion: '7.13.1',
    resonatorId,
    characterLevel: { status: 'KNOWN', value: 90 },
    sequenceLevel: { status: 'KNOWN', value: 0 },
    weapon: weaponConfig
      ? {
          weaponId: weaponConfig.weaponId,
          weaponLevel: { status: 'KNOWN', value: weaponConfig.weaponLevel ?? 90 },
          refinementRank: { status: 'KNOWN', value: weaponConfig.refinementRank ?? 1 },
          compatibilityStatus: 'KNOWN_COMPATIBLE',
          provenance: {
            entityId: 'SYSTEM',
            entityName: 'WeaponInvestment',
            sourceType: 'RESONATOR_ABILITY',
            sourceCode: 'WEAPON_TEST',
            patchVersion: '3.7',
            sourceProvenance: 'Test',
            originalDescription: 'Test'
          }
        }
      : null,
    echoInvestment: echoConfig
      ? {
          equippedCount: { status: 'KNOWN', value: echoConfig.equippedCount ?? 5 },
          tunedCount: { status: 'KNOWN', value: echoConfig.tunedCount ?? 5 },
          maxLevelEchoCount: { status: 'KNOWN', value: echoConfig.maxLevelCount ?? 5 },
          sonataSetId: echoConfig.sonataSetId,
          provenance: {
            entityId: 'SYSTEM',
            entityName: 'EchoInvestment',
            sourceType: 'RESONATOR_ABILITY',
            sourceCode: 'ECHO_TEST',
            patchVersion: '3.7',
            sourceProvenance: 'Test',
            originalDescription: 'Test'
          }
        }
      : null,
    provenance: {
      entityId: 'SYSTEM',
      entityName: 'ResonatorInvestment',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'RESONATOR_TEST',
      patchVersion: '3.7',
      sourceProvenance: 'Test',
      originalDescription: 'Test'
    }
  };
}

test('Step 24 - 1. Valid end-to-end input with owned Resonators', () => {
  clearRecommendationOrchestrationCache();
  const input: RecommendationOrchestrationInput = {
    patchId: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    ownedRoster: NINE_OWNED_RESONATORS,
    targetK: 3,
    allowPartial: false
  };

  const result = orchestrateRecommendations(input);
  assert.ok(result);
  assert.equal(result.patchId, CANONICAL_PATCH_VERSION);
  assert.equal(result.ruleVersion, RECOMMENDATION_ORCHESTRATION_RULE_VERSION);
  assert.equal(result.seasonId, CANONICAL_SEASON_ID);

  const rec = result.recommendation;
  assert.ok(rec.id.startsWith(`rec-orch:${CANONICAL_PATCH_VERSION}:${CANONICAL_SEASON_ID}:`));
  assert.ok(
    rec.status === 'OPTIMAL_RECOMMENDATION' ||
    rec.status === 'FEASIBLE_RECOMMENDATION' ||
    rec.status === 'NO_FEASIBLE_ALLOCATION'
  );
  assert.equal(rec.inputSnapshot.ownedResonatorCount, 9);
  assert.equal(rec.inputSnapshot.targetK, 3);

  const auditReport = auditSingleRecommendationOrchestration(rec);
  assert.equal(auditReport.isValid, true, `Audit violations: ${JSON.stringify(auditReport.violations)}`);
  assert.equal(auditReport.violations.length, 0);
});

test('Step 24 - 2. Invalid input snapshot rejected at the orchestration boundary', () => {
  // Invalid patch
  assert.throws(
    () => orchestrateRecommendations({ patchId: '3.6' as any }),
    /Invalid patchId/
  );

  // Invalid season
  assert.throws(
    () => orchestrateRecommendations({ seasonId: 'season:99' as any }),
    /Invalid seasonId/
  );

  // Invalid rule version
  assert.throws(
    () => orchestrateRecommendations({ ruleVersion: '7.23.0' as any }),
    /Invalid ruleVersion/
  );

  // Invalid targetK (< 1)
  assert.throws(
    () => orchestrateRecommendations({ targetK: 0 }),
    /targetK/
  );

  // Invalid targetK (> 20)
  assert.throws(
    () => orchestrateRecommendations({ targetK: 25 }),
    /targetK/
  );

  // Negative investment level
  assert.throws(
    () =>
      orchestrateRecommendations({
        investmentSnapshots: [
          {
            resonatorId: 'Jinhsi',
            patchVersion: '3.7',
            ruleVersion: '7.13.1',
            level: -1,
            chain: 0
          } as any
        ]
      }),
    /level/
  );

  // Malformed resonator ID
  assert.throws(
    () =>
      orchestrateRecommendations({
        ownedRoster: ['invalid resonator!']
      }),
    /Non-canonical Resonator ID/
  );
});

test('Step 24 - 3. Unknown or unowned Resonator rejected or excluded according to contract', () => {
  // Empty resonator id
  assert.throws(
    () => orchestrateRecommendations({ ownedRoster: [''] }),
    /invalid or empty/
  );

  // Non-canonical resonator name
  assert.throws(
    () => orchestrateRecommendations({ ownedRoster: ['fake_resonator_123'] }),
    /Non-canonical Resonator ID/
  );

  // When a subset of 3 Resonators is owned, only those 3 can appear in the portfolio
  const threeOwned = ['Jinhsi', 'Yuanwu', 'Verina'];
  const res = orchestrateRecommendations({
    ownedRoster: threeOwned,
    targetK: 1,
    allowPartial: true
  });

  if (res.recommendation.portfolio) {
    for (const member of res.recommendation.portfolio.allMemberResonatorIds) {
      assert.ok(threeOwned.includes(member), `Unowned member ${member} was used!`);
    }
  }
});

test('Step 24 - 4. Upstream character evaluation failure handling (insufficient roster < 3)', () => {
  // Fewer than 3 resonators cannot form any team
  const res = orchestrateRecommendations({
    ownedRoster: ['Jinhsi', 'Verina'],
    targetK: 1
  });

  assert.equal(res.recommendation.status, 'INSUFFICIENT_ROSTER');
  assert.equal(res.recommendation.portfolio, null);
  assert.equal(res.recommendation.toaAllocation, null);
  assert.ok(res.recommendation.infeasibilityReasons);
  assert.ok(res.recommendation.infeasibilityReasons.length > 0);

  const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
  assert.equal(auditReport.isValid, true);
});

test('Step 24 - 5. Upstream team evaluation failure handling (incompatible roster cannot form teams)', () => {
  // If targetK=2 is requested with only 3 resonators, cannot form 2 disjoint teams:
  const res = orchestrateRecommendations({
    ownedRoster: ['Jinhsi', 'Yuanwu', 'Verina'],
    targetK: 2, // requires 6 resonators
    allowPartial: false
  });

  assert.equal(res.recommendation.status, 'NO_FEASIBLE_PORTFOLIO');
  assert.ok(res.recommendation.portfolio);
  assert.equal(res.recommendation.portfolio.status, 'INFEASIBLE_PORTFOLIO');
  assert.equal(res.recommendation.toaAllocation?.status, 'INFEASIBLE_ALLOCATION');

  const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
  assert.equal(auditReport.isValid, true);
});

test('Step 24 - 6. No valid portfolio handling', () => {
  const res = orchestrateRecommendations({
    ownedRoster: ['Jinhsi', 'Yuanwu', 'Verina'],
    targetK: 3, // impossible with 3 resonators
    allowPartial: false
  });

  assert.equal(res.recommendation.status, 'NO_FEASIBLE_PORTFOLIO');
  const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
  assert.equal(auditReport.isValid, true);
});

test('Step 24 - 7. Valid portfolio but infeasible ToA allocation', () => {
  // 1 team (3 resonators) attempting to clear all 12 stages without allowPartial.
  // Total cost = 40 vigor. 1 team only has 10 vigor each resonator. Max vigor clearable = 10 vigor!
  const res = orchestrateRecommendations({
    ownedRoster: ['Jinhsi', 'Yuanwu', 'Verina'],
    targetK: 1,
    allowPartial: false
  });

  assert.ok(res.recommendation.portfolio);
  assert.ok(
    res.recommendation.portfolio.status === 'OPTIMAL_PORTFOLIO' ||
    res.recommendation.portfolio.status === 'FEASIBLE_PORTFOLIO'
  );
  assert.equal(res.recommendation.status, 'NO_FEASIBLE_ALLOCATION');
  assert.equal(res.recommendation.toaAllocation?.status, 'INFEASIBLE_ALLOCATION');

  const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
  assert.equal(auditReport.isValid, true);
});

test('Step 24 - 8. Complete optimal allocation with reachable target stages', () => {
  clearRecommendationOrchestrationCache();
  // Target 4 floors of Resonant Tower (costs 1, 2, 3, 4 = 10 vigor per resonator).
  // 3 owned resonators (1 team) have 10 vigor each, clearing all 4 requested stages completely (total 30 vigor consumed).
  const res = orchestrateRecommendations({
    ownedRoster: ['Jinhsi', 'Yuanwu', 'Verina'],
    targetK: 1,
    targetStageIds: [
      'toa-resonant-floor-1',
      'toa-resonant-floor-2',
      'toa-resonant-floor-3',
      'toa-resonant-floor-4'
    ],
    allowPartial: false
  });

  assert.ok(
    res.recommendation.status === 'OPTIMAL_RECOMMENDATION' ||
    res.recommendation.status === 'FEASIBLE_RECOMMENDATION'
  );
  assert.ok(res.recommendation.portfolio);
  assert.ok(res.recommendation.toaAllocation);
  assert.equal(res.recommendation.toaAllocation.completeness.assignedStageCount, 4);
  assert.equal(res.recommendation.toaAllocation.completeness.totalVigorConsumed, 30);

  const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
  assert.equal(auditReport.isValid, true);
  assert.equal(auditReport.violations.length, 0);
});

test('Step 24 - 9. Complete feasible allocation involving valid fallback/partially equipped teams', () => {
  const res = orchestrateRecommendations({
    targetStageIds: [
      'toa-resonant-floor-1',
      'toa-resonant-floor-2',
      'toa-resonant-floor-3',
      'toa-resonant-floor-4'
    ]
  });
  if (res.recommendation.status === 'FEASIBLE_RECOMMENDATION') {
    assert.equal(res.recommendation.provenance.hasFallbackEquipment, true);
    const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
    assert.equal(auditReport.isValid, true);
  }
});

test('Step 24 - 10. Partial allocation when explicitly permitted', () => {
  // 1 team (3 resonators), allowPartial: true
  const res = orchestrateRecommendations({
    ownedRoster: ['Jinhsi', 'Yuanwu', 'Verina'],
    targetK: 1,
    allowPartial: true
  });

  assert.equal(res.recommendation.status, 'PARTIAL_RECOMMENDATION');
  assert.ok(res.recommendation.toaAllocation);
  assert.equal(res.recommendation.toaAllocation.status, 'PARTIAL_ALLOCATION');
  assert.ok(res.recommendation.toaAllocation.completeness.assignedStageCount > 0);
  assert.ok(res.recommendation.toaAllocation.completeness.assignedStageCount < 12);

  const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
  assert.equal(auditReport.isValid, true);
});

test('Step 24 - 11. Empty target stage list produces fail-closed INFEASIBLE_ALLOCATION', () => {
  const res = orchestrateRecommendations({
    targetStageIds: []
  });
  assert.equal(res.recommendation.status, 'NO_FEASIBLE_ALLOCATION');
  assert.equal(res.recommendation.inputSnapshot.targetStageCount, 0);
  assert.ok(res.recommendation.toaAllocation);
  assert.equal(res.recommendation.toaAllocation.status, 'INFEASIBLE_ALLOCATION');
  const auditReport = auditSingleRecommendationOrchestration(res.recommendation);
  assert.equal(auditReport.isValid, true);
});

test('Step 24 - 12. Patch-version mismatch rejected in audit', () => {
  const res = orchestrateRecommendations();
  const tampered = {
    ...res.recommendation,
    patchVersion: '3.6'
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'PATCH_MISMATCH'));
});

test('Step 24 - 13. Season-version mismatch rejected in audit', () => {
  const res = orchestrateRecommendations();
  const tampered = {
    ...res.recommendation,
    seasonId: 'season:99'
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'SEASON_MISMATCH'));
});

test('Step 24 - 14. Upstream rule-version mismatch rejected in audit', () => {
  const res = orchestrateRecommendations();
  const tampered = {
    ...res.recommendation,
    provenance: {
      ...res.recommendation.provenance,
      step23RuleVersion: '7.23.0' // mismatched
    }
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'UPSTREAM_RULE_MISMATCH'));
});

test('Step 24 - 15. Tampered upstream output rejected in audit', () => {
  const res = orchestrateRecommendations();
  assert.ok(res.recommendation.portfolio);
  const tampered = {
    ...res.recommendation,
    portfolio: {
      ...res.recommendation.portfolio,
      selectedTeamCount: 99 // tampered
    }
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'UPSTREAM_PORTFOLIO_AUDIT_FAILED'));
});

test('Step 24 - 16. Tampered aggregate status rejected in audit', () => {
  // Create an infeasible recommendation
  const res = orchestrateRecommendations({
    ownedRoster: ['Jinhsi', 'Yuanwu', 'Verina'],
    targetK: 1,
    allowPartial: false
  });
  assert.equal(res.recommendation.status, 'NO_FEASIBLE_ALLOCATION');

  // Tamper to pretend it is OPTIMAL_RECOMMENDATION
  const tampered = {
    ...res.recommendation,
    status: 'OPTIMAL_RECOMMENDATION'
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'STATUS_INCONSISTENCY'));
});

test('Step 24 - 17. Contradictory provenance rejected in audit', () => {
  const res = orchestrateRecommendations();
  const tampered = {
    ...res.recommendation,
    provenance: {
      ...res.recommendation.provenance,
      snapshotFingerprint: 'tampered-fake-fingerprint'
    }
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'PROVENANCE_FINGERPRINT_MISMATCH'));
});

test('Step 24 - 18. Vigor accounting discrepancy rejected in audit', () => {
  const res = orchestrateRecommendations({
    targetStageIds: [
      'toa-resonant-floor-1',
      'toa-resonant-floor-2',
      'toa-resonant-floor-3',
      'toa-resonant-floor-4'
    ]
  });
  assert.ok(res.recommendation.toaAllocation);
  assert.ok(res.recommendation.toaAllocation.vigorAccounting.length > 0);

  const tamperedVigor = res.recommendation.toaAllocation.vigorAccounting.map((va, idx) => {
    if (idx === 0) {
      return { ...va, vigorConsumed: 15 }; // exceeds max 10
    }
    return va;
  });

  const tampered = {
    ...res.recommendation,
    toaAllocation: {
      ...res.recommendation.toaAllocation,
      vigorAccounting: tamperedVigor
    }
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'VIGOR_CAPACITY_EXCEEDED'));
});

test('Step 24 - 19. Duplicate Resonator or unowned Resonator in portfolio rejected in audit', () => {
  const threeOwned = ['Jinhsi', 'Yuanwu', 'Verina'];
  const res = orchestrateRecommendations({
    ownedRoster: threeOwned,
    targetK: 1,
    allowPartial: true
  });

  assert.ok(res.recommendation.portfolio);
  // Introduce unowned resonator into portfolio
  const tampered = {
    ...res.recommendation,
    portfolio: {
      ...res.recommendation.portfolio,
      allMemberResonatorIds: ['Jinhsi', 'unowned-resonator-xyz', 'Verina']
    }
  } as unknown as EndToEndRecommendation;

  const auditReport = auditSingleRecommendationOrchestration(tampered);
  assert.equal(auditReport.isValid, false);
  assert.ok(auditReport.violations.some((v) => v.code === 'UNOWNED_CHARACTER_IN_PORTFOLIO'));
});

test('Step 24 - 20. Deep mutation attempts against returned results throw', () => {
  const res = orchestrateRecommendations();
  assert.throws(() => {
    (res as any).patchId = '3.6';
  }, TypeError);

  assert.throws(() => {
    (res.recommendation as any).status = 'HACKED';
  }, TypeError);

  assert.throws(() => {
    (res.recommendation.inputSnapshot as any).targetK = 999;
  }, TypeError);
});

test('Step 24 - 21. Cache isolation and memoization', () => {
  clearRecommendationOrchestrationCache();
  const res1 = getDefaultEndToEndRecommendation();
  const res2 = getDefaultEndToEndRecommendation();
  // Same reference due to memoization
  assert.equal(res1, res2);

  // Clear cache and retrieve again
  clearRecommendationOrchestrationCache();
  const res3 = getDefaultEndToEndRecommendation();
  assert.notEqual(res1, res3); // fresh instance
  assert.deepEqual(res1, res3); // bitwise equivalent data
});

test('Step 24 - 22. Repeated-run determinism (20 runs bit-identical)', () => {
  clearRecommendationOrchestrationCache();
  const input: RecommendationOrchestrationInput = {
    ownedRoster: NINE_OWNED_RESONATORS,
    targetK: 3,
    allowPartial: false
  };

  const runs: string[] = [];
  for (let i = 0; i < 20; i++) {
    const res = orchestrateRecommendations(input);
    const serialized = JSON.stringify(res);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    runs.push(hash);
  }

  const firstHash = runs[0];
  for (let i = 1; i < runs.length; i++) {
    assert.equal(runs[i], firstHash, `Run ${i} produced diverging hash!`);
  }
});

test('Step 24 - 23. Canonical serialization and fingerprint stability', () => {
  const s1 = deriveSnapshotFingerprint({
    ownedResonatorCount: 3,
    ownedResonatorIds: ['Aalto', 'Baizhi', 'Chixia'],
    investmentSnapshotCount: 0,
    targetK: 1,
    targetStageCount: 12,
    targetStageIds: ['s1', 's2'],
    allowPartial: false
  });

  const s2 = deriveSnapshotFingerprint({
    ownedResonatorCount: 3,
    ownedResonatorIds: ['Aalto', 'Baizhi', 'Chixia'],
    investmentSnapshotCount: 0,
    targetK: 1,
    targetStageCount: 12,
    targetStageIds: ['s1', 's2'],
    allowPartial: false
  });

  assert.equal(s1, s2);
  assert.equal(s1.length, 64);
});

test('Step 24 - 24. Upstream frozen contracts Steps 19-23 remain intact and unchanged', () => {
  assert.equal(CHARACTER_DECISION_CONTEXT_RULE_VERSION, '7.19.1');
  assert.equal(CHARACTER_BUILD_EVALUATION_RULE_VERSION, '7.20.1');
  assert.equal(TEAM_BUILD_EVALUATION_RULE_VERSION, '7.21.1');
  assert.equal(TEAM_PORTFOLIO_RULE_VERSION, '7.22.1');
  assert.equal(TOA_ALLOCATION_RULE_VERSION, '7.23.1');
  assert.equal(REQUIRED_STEP19_RULE_VERSION, '7.19.1');
  assert.equal(REQUIRED_STEP20_RULE_VERSION, '7.20.1');
  assert.equal(REQUIRED_STEP21_RULE_VERSION, '7.21.1');
  assert.equal(REQUIRED_STEP22_RULE_VERSION, '7.22.1');
  assert.equal(REQUIRED_STEP23_RULE_VERSION, '7.23.1');
});

test('Step 24 - 25. Realistic full-pipeline fixture with Season 40 data', () => {
  clearRecommendationOrchestrationCache();
  const result = getRecommendationOrchestrationResult();
  const rec = result.recommendation;

  assert.ok(rec);
  assert.equal(rec.patchVersion, '3.7');
  assert.equal(rec.seasonId, 'season:40');
  assert.equal(rec.ruleVersion, '7.24.1');
  // Default run (K=3, 12 stages, allowPartial=false) mathematically yields NO_FEASIBLE_ALLOCATION (30 < 40 Vigor)
  assert.equal(rec.status, 'NO_FEASIBLE_ALLOCATION');
  assert.ok(rec.portfolio);
  assert.equal(rec.portfolio.teams.length, 3);
  assert.ok(rec.toaAllocation);
  assert.equal(rec.toaAllocation.status, 'INFEASIBLE_ALLOCATION');

  // Verify explanation formatter runs cleanly and contains exact solver results
  const explanation = formatRecommendationOrchestrationExplanation(rec);
  assert.ok(explanation);
  assert.ok(explanation.includes('=== END-TO-END RECOMMENDATION PIPELINE'));
  assert.ok(explanation.includes('Tower of Adversity Allocation (0/12 stages, status: INFEASIBLE_ALLOCATION)'));

  // Ensure no prohibited keys or subjective words in explanation
  assertNoProhibitedRecommendationKeys(rec);

  // Independent audit passes
  const auditReport = auditSingleRecommendationOrchestration(rec);
  assert.equal(auditReport.isValid, true);
  assert.equal(auditReport.violations.length, 0);

  // Demonstrate complete 4-stage clear on Resonant Tower
  const res4 = orchestrateRecommendations({
    targetStageIds: [
      'toa-resonant-floor-1',
      'toa-resonant-floor-2',
      'toa-resonant-floor-3',
      'toa-resonant-floor-4'
    ]
  });
  assert.ok(
    res4.recommendation.status === 'OPTIMAL_RECOMMENDATION' ||
    res4.recommendation.status === 'FEASIBLE_RECOMMENDATION'
  );
  assert.equal(res4.recommendation.toaAllocation?.completeness.assignedStageCount, 4);
  const audit4 = auditSingleRecommendationOrchestration(res4.recommendation);
  assert.equal(audit4.isValid, true);
  assert.equal(audit4.violations.length, 0);
});

test('Step 24 - 26. FINDING S24-001: Step 21 in pipeline & user investment state propagation', () => {
  clearRecommendationOrchestrationCache();
  const jinhsiInv = makeTestInvestmentSnapshot(
    'Jinhsi',
    { weaponId: 'Ages of Harvest', weaponLevel: 90, refinementRank: 2 },
    { sonataSetId: 'Celestial Light', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );
  const changliInv = makeTestInvestmentSnapshot(
    'Changli',
    { weaponId: 'Blazing Brilliance', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'Molten Rift', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );
  const shorekeeperInv = makeTestInvestmentSnapshot(
    'Shorekeeper',
    { weaponId: 'Stellar Symphony', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'Rejuvenating Glow', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );

  const input: RecommendationOrchestrationInput = {
    patchId: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    ownedRoster: NINE_OWNED_RESONATORS,
    investmentSnapshots: [jinhsiInv, changliInv, shorekeeperInv],
    targetK: 3,
    allowPartial: false
  };

  const result = orchestrateRecommendations(input);
  assert.ok(result);
  const rec = result.recommendation;

  // Step 20 recognizes investment state: Jinhsi, Changli, Shorekeeper are FULLY_EQUIPPED
  const jinhsiEval = rec.characterBuildEvaluations.find((e) => e.resonatorId === 'Jinhsi');
  assert.ok(jinhsiEval, 'Jinhsi build evaluation must be present');
  assert.equal(jinhsiEval.status, 'FULLY_EQUIPPED');
  assert.equal(jinhsiEval.weaponEvaluation.weaponId, 'Ages of Harvest');
  assert.equal(jinhsiEval.weaponEvaluation.refinementRank, 2);
  assert.equal(jinhsiEval.echoEvaluation.activeSonataSetName, 'Celestial Light');
  assert.equal(jinhsiEval.echoEvaluation.activeSonataSetCode, 'CELESTIAL_LIGHT');

  const changliEval = rec.characterBuildEvaluations.find((e) => e.resonatorId === 'Changli');
  assert.ok(changliEval, 'Changli build evaluation must be present');
  assert.equal(changliEval.status, 'FULLY_EQUIPPED');
  assert.equal(changliEval.weaponEvaluation.weaponId, 'Blazing Brilliance');

  const shorekeeperEval = rec.characterBuildEvaluations.find((e) => e.resonatorId === 'Shorekeeper');
  assert.ok(shorekeeperEval, 'Shorekeeper build evaluation must be present');
  assert.equal(shorekeeperEval.status, 'FULLY_EQUIPPED');
  assert.equal(shorekeeperEval.weaponEvaluation.weaponId, 'Stellar Symphony');

  // Step 21 & Step 22: Portfolio teams preserve and use evaluated build state
  assert.ok(rec.portfolio);
  assert.equal(rec.portfolio.teams.length, 3);
  for (const team of rec.portfolio.teams) {
    for (const memberId of team.memberResonatorIds) {
      const memberEval = team.memberBuildEvaluations.find((m) => m.resonatorId === memberId);
      assert.ok(memberEval, `Member evaluation for ${memberId} must exist in team`);
      if (memberId === 'Jinhsi') {
        assert.equal(memberEval.weaponEvaluation.weaponId, 'Ages of Harvest');
        assert.equal(memberEval.weaponEvaluation.refinementRank, 2);
        assert.equal(memberEval.status, 'FULLY_EQUIPPED');
      } else if (memberId === 'Changli') {
        assert.equal(memberEval.weaponEvaluation.weaponId, 'Blazing Brilliance');
        assert.equal(memberEval.status, 'FULLY_EQUIPPED');
      } else if (memberId === 'Shorekeeper') {
        assert.equal(memberEval.weaponEvaluation.weaponId, 'Stellar Symphony');
        assert.equal(memberEval.status, 'FULLY_EQUIPPED');
      }
    }
  }

  // Step 23 ToA assignments refer to teams selected by portfolio
  if (rec.toaAllocation) {
    const portfolioTeamIds = new Set(rec.portfolio.teams.map((t) => t.id));
    for (const a of rec.toaAllocation.assignments) {
      if (a.isAssigned && a.team) {
        assert.ok(
          portfolioTeamIds.has(a.team.id),
          `ToA assignment refers to team ${a.team.id} not in selected portfolio`
        );
      }
    }
  }

  // Independent audits pass cleanly
  const auditReport = auditSingleRecommendationOrchestration(rec);
  assert.equal(auditReport.isValid, true, `Violations: ${JSON.stringify(auditReport.violations)}`);
  const resultAudit = auditRecommendationOrchestrationResult(result);
  assert.equal(resultAudit.isValid, true, `Result violations: ${JSON.stringify(resultAudit.violations)}`);
});

test('Step 24 - 27. FINDING S24-002: Cross-contract independent adversarial tamper detection', () => {
  clearRecommendationOrchestrationCache();
  const jinhsiInv = makeTestInvestmentSnapshot(
    'Jinhsi',
    { weaponId: 'Ages of Harvest', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'Celestial Light' }
  );

  const baseResult = orchestrateRecommendations({
    ownedRoster: NINE_OWNED_RESONATORS,
    investmentSnapshots: [jinhsiInv],
    targetK: 3,
    allowPartial: false
  });
  assert.equal(auditSingleRecommendationOrchestration(baseResult.recommendation).isValid, true);

  // Subtest A: Empty characterBuildEvaluations when ownedResonatorCount >= 3
  const tamperedEmptyChars = deepClone(baseResult.recommendation) as any;
  tamperedEmptyChars.characterBuildEvaluations = [];
  const repA = auditSingleRecommendationOrchestration(tamperedEmptyChars);
  assert.equal(repA.isValid, false);
  assert.ok(repA.violations.some((v) => v.code === 'MISSING_CHARACTER_BUILD_EVALUATIONS'));

  // Subtest B: Missing character evaluation for a selected team member
  const tamperedMissingMember = deepClone(baseResult.recommendation) as any;
  tamperedMissingMember.characterBuildEvaluations = tamperedMissingMember.characterBuildEvaluations.filter(
    (e: any) => e.resonatorId !== 'Jinhsi'
  );
  const repB = auditSingleRecommendationOrchestration(tamperedMissingMember);
  assert.equal(repB.isValid, false);
  assert.ok(
    repB.violations.some(
      (v) =>
        v.code === 'MISSING_CHARACTER_EVALUATION_FOR_TEAM_MEMBER' ||
        v.code === 'INCOMPLETE_CHARACTER_BUILD_EVALUATIONS'
    )
  );

  // Subtest C: Substituted character build evaluation
  const tamperedSubstituted = deepClone(baseResult.recommendation) as any;
  const jIndex = tamperedSubstituted.characterBuildEvaluations.findIndex((e: any) => e.resonatorId === 'Jinhsi');
  if (jIndex >= 0) {
    const orig = tamperedSubstituted.characterBuildEvaluations[jIndex];
    tamperedSubstituted.characterBuildEvaluations[jIndex] = {
      ...orig,
      weaponEvaluation: {
        ...orig.weaponEvaluation,
        weaponId: 'Broadblade of Night' // substituted weapon
      }
    };
  }
  const repC = auditSingleRecommendationOrchestration(tamperedSubstituted);
  assert.equal(repC.isValid, false);
  assert.ok(repC.violations.some((v) => v.code === 'SUBSTITUTED_CHARACTER_BUILD_EVALUATION'));

  // Subtest D: ToA assignment referencing unselected team
  if (baseResult.recommendation.toaAllocation && baseResult.recommendation.portfolio) {
    const tamperedUnselectedTeam = deepClone(baseResult.recommendation) as any;
    if (tamperedUnselectedTeam.toaAllocation.assignments.length > 0) {
      tamperedUnselectedTeam.toaAllocation.assignments[0] = {
        ...tamperedUnselectedTeam.toaAllocation.assignments[0],
        isAssigned: true,
        team: {
          ...tamperedUnselectedTeam.portfolio.teams[0],
          id: 'team-composition:3.7:fake1:fake2:fake3:7.9.1'
        }
      };
      const repD = auditSingleRecommendationOrchestration(tamperedUnselectedTeam);
      assert.equal(repD.isValid, false);
      assert.ok(repD.violations.some((v) => v.code === 'UNSELECTED_PORTFOLIO_TEAM_ASSIGNED'));
    }
  }

  // Subtest E: Changed member IDs between portfolio and ToA assignment
  if (baseResult.recommendation.toaAllocation && baseResult.recommendation.portfolio) {
    const tamperedMemberMismatch = deepClone(baseResult.recommendation) as any;
    if (tamperedMemberMismatch.toaAllocation.assignments.length > 0) {
      const pTeam = tamperedMemberMismatch.portfolio.teams[0];
      tamperedMemberMismatch.toaAllocation.assignments[0] = {
        ...tamperedMemberMismatch.toaAllocation.assignments[0],
        isAssigned: true,
        team: {
          ...pTeam,
          memberResonatorIds: ['Aalto', pTeam.memberResonatorIds[1], pTeam.memberResonatorIds[2]]
        }
      };
      const repE = auditSingleRecommendationOrchestration(tamperedMemberMismatch);
      assert.equal(repE.isValid, false);
      assert.ok(repE.violations.some((v) => v.code === 'TEAM_MEMBER_MISMATCH_IN_TOA_ASSIGNMENT'));
    }
  }

  // Subtest F: Mismatched provenance.portfolioId
  const tamperedProvPort = deepClone(baseResult.recommendation) as any;
  tamperedProvPort.provenance = {
    ...tamperedProvPort.provenance,
    portfolioId: 'tampered-portfolio-id-12345'
  };
  const repF = auditSingleRecommendationOrchestration(tamperedProvPort);
  assert.equal(repF.isValid, false);
  assert.ok(repF.violations.some((v) => v.code === 'PORTFOLIO_PROVENANCE_ID_MISMATCH'));

  // Subtest G: Mismatched provenance.toaAllocationId
  const tamperedProvToa = deepClone(baseResult.recommendation) as any;
  tamperedProvToa.provenance = {
    ...tamperedProvToa.provenance,
    toaAllocationId: 'tampered-toa-id-12345'
  };
  const repG = auditSingleRecommendationOrchestration(tamperedProvToa);
  assert.equal(repG.isValid, false);
  assert.ok(repG.violations.some((v) => v.code === 'TOA_ALLOCATION_PROVENANCE_ID_MISMATCH'));
});

test('Step 24 - 28. FINDING S24-003: Fail-closed status derivation table-driven tests', () => {
  clearRecommendationOrchestrationCache();

  // Test that orchestrateRecommendations handles status derivation properly
  const baseResult = orchestrateRecommendations({
    targetStageIds: ['toa-resonant-floor-1']
  });
  assert.ok(baseResult);

  // Table of upstream status combinations to verify fail-closed behavior in audit
  const statusTestCases = [
    {
      name: 'INVALID_PORTFOLIO must be rejected by auditor if marked FEASIBLE',
      portfolioStatus: 'INVALID_PORTFOLIO',
      toaStatus: 'FEASIBLE_ALLOCATION',
      claimedStatus: 'FEASIBLE_RECOMMENDATION' as const,
      expectedViolation: 'STATUS_INCONSISTENCY'
    },
    {
      name: 'PATCH_MISMATCH in portfolio must be rejected by auditor if marked FEASIBLE',
      portfolioStatus: 'PATCH_MISMATCH',
      toaStatus: 'FEASIBLE_ALLOCATION',
      claimedStatus: 'FEASIBLE_RECOMMENDATION' as const,
      expectedViolation: 'STATUS_INCONSISTENCY'
    },
    {
      name: 'Unknown portfolio status must be rejected by auditor if marked FEASIBLE',
      portfolioStatus: 'UNKNOWN_PORTFOLIO_STATE',
      toaStatus: 'OPTIMAL_ALLOCATION',
      claimedStatus: 'FEASIBLE_RECOMMENDATION' as const,
      expectedViolation: 'STATUS_INCONSISTENCY'
    },
    {
      name: 'OPTIMAL_RECOMMENDATION claimed when portfolio is only FEASIBLE must be rejected',
      portfolioStatus: 'FEASIBLE_PORTFOLIO',
      toaStatus: 'OPTIMAL_ALLOCATION',
      claimedStatus: 'OPTIMAL_RECOMMENDATION' as const,
      expectedViolation: 'STATUS_INCONSISTENCY'
    },
    {
      name: 'OPTIMAL_RECOMMENDATION claimed when ToA is only FEASIBLE must be rejected',
      portfolioStatus: 'OPTIMAL_PORTFOLIO',
      toaStatus: 'FEASIBLE_ALLOCATION',
      claimedStatus: 'OPTIMAL_RECOMMENDATION' as const,
      expectedViolation: 'STATUS_INCONSISTENCY'
    }
  ];

  for (const tc of statusTestCases) {
    const tampered = deepClone(baseResult.recommendation) as any;
    tampered.status = tc.claimedStatus;
    if (tampered.portfolio) {
      tampered.portfolio.status = tc.portfolioStatus;
    }
    if (tampered.toaAllocation) {
      tampered.toaAllocation.status = tc.toaStatus;
    }
    // Update ID to match claimed status for identifier check
    tampered.id = deriveRecommendationOrchestrationId(
      tc.claimedStatus,
      tampered.inputSnapshot.snapshotFingerprint,
      tampered.seasonId,
      tampered.patchVersion,
      tampered.ruleVersion
    );
    const rep = auditSingleRecommendationOrchestration(tampered);
    assert.equal(rep.isValid, false, `Expected failure for case: ${tc.name}`);
    assert.ok(
      rep.violations.some((v) => v.code === tc.expectedViolation),
      `Expected violation ${tc.expectedViolation} for case: ${tc.name}`
    );
  }
});

test('Step 24 - 29. FINDING S24-004: Canonical input fingerprint sensitivity & stability', () => {
  const baseSnap = makeTestInvestmentSnapshot(
    'Jinhsi',
    { weaponId: 'Ages of Harvest', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'Celestial Light', equippedCount: 5 }
  );

  const baseInput = {
    patchVersion: '3.7',
    seasonId: 'season:40',
    ownedResonatorIds: ['Changli', 'Jinhsi', 'Shorekeeper'],
    targetK: 1,
    targetStageIds: ['s1', 's2'],
    allowPartial: false,
    investmentSnapshots: [baseSnap]
  };

  const baseFingerprint = deriveSnapshotFingerprint(baseInput);
  assert.equal(baseFingerprint.length, 64);

  // 1. Identical input produces identical fingerprint
  const identicalFingerprint = deriveSnapshotFingerprint({ ...baseInput });
  assert.equal(identicalFingerprint, baseFingerprint);

  // 2. Reordered independent snapshots in array produces identical fingerprint
  const changliSnap = makeTestInvestmentSnapshot('Changli', { weaponId: 'Blazing Brilliance' });
  const fpA = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: [baseSnap, changliSnap]
  });
  const fpB = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: [changliSnap, baseSnap]
  });
  assert.equal(fpA, fpB);

  // 3. Changing weapon identity changes fingerprint
  const diffWeaponSnap = makeTestInvestmentSnapshot('Jinhsi', { weaponId: 'Lustrous Razor' });
  const fpDiffWeapon = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: [diffWeaponSnap]
  });
  assert.notEqual(fpDiffWeapon, baseFingerprint);

  // 4. Changing weapon refinement changes fingerprint
  const diffRefineSnap = makeTestInvestmentSnapshot('Jinhsi', {
    weaponId: 'Ages of Harvest',
    refinementRank: 5
  });
  const fpDiffRefine = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: [diffRefineSnap]
  });
  assert.notEqual(fpDiffRefine, baseFingerprint);

  // 5. Changing character level changes fingerprint
  const diffLvlSnap: ResonatorInvestmentSnapshot = {
    ...baseSnap,
    characterLevel: { status: 'KNOWN', value: 80 }
  };
  const fpDiffLvl = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: [diffLvlSnap]
  });
  assert.notEqual(fpDiffLvl, baseFingerprint);

  // 6. Changing Sonata set changes fingerprint
  const diffSonataSnap = makeTestInvestmentSnapshot(
    'Jinhsi',
    { weaponId: 'Ages of Harvest' },
    { sonataSetId: 'Sierra Gale' }
  );
  const fpDiffSonata = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: [diffSonataSnap]
  });
  assert.notEqual(fpDiffSonata, baseFingerprint);

  // 7. Changing patch version changes fingerprint
  const fpDiffPatch = deriveSnapshotFingerprint({
    ...baseInput,
    patchVersion: '3.8'
  });
  assert.notEqual(fpDiffPatch, baseFingerprint);

  // 8. Changing season ID changes fingerprint
  const fpDiffSeason = deriveSnapshotFingerprint({
    ...baseInput,
    seasonId: 'season:41'
  });
  assert.notEqual(fpDiffSeason, baseFingerprint);

  // 9. Changing targetK changes fingerprint
  const fpDiffK = deriveSnapshotFingerprint({
    ...baseInput,
    targetK: 2
  });
  assert.notEqual(fpDiffK, baseFingerprint);

  // 10. Changing allowPartial changes fingerprint
  const fpDiffPartial = deriveSnapshotFingerprint({
    ...baseInput,
    allowPartial: true
  });
  assert.notEqual(fpDiffPartial, baseFingerprint);

  // 11. Changing owned roster changes fingerprint
  const fpDiffRoster = deriveSnapshotFingerprint({
    ...baseInput,
    ownedResonatorIds: ['Changli', 'Jinhsi', 'Verina']
  });
  assert.notEqual(fpDiffRoster, baseFingerprint);

  // 12. Empty snapshots handled deterministically
  const fpEmpty1 = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: []
  });
  const fpEmpty2 = deriveSnapshotFingerprint({
    ...baseInput,
    investmentSnapshots: undefined,
    investmentSnapshotCount: 0
  });
  assert.equal(fpEmpty1, fpEmpty2);
});

test('Step 24 - 30. FINDING S24-005: auditRecommendationOrchestrationResult metrics verification & tampering', () => {
  clearRecommendationOrchestrationCache();
  const result = orchestrateRecommendations({
    targetStageIds: [
      'toa-resonant-floor-1',
      'toa-resonant-floor-2'
    ]
  });

  // Valid result passes
  const validAudit = auditRecommendationOrchestrationResult(result);
  assert.equal(validAudit.isValid, true, `Violations: ${JSON.stringify(validAudit.violations)}`);
  assert.equal(validAudit.violations.length, 0);

  // Mutating assignedStageCount triggers violation
  const tAssigned = deepClone(result) as any;
  tAssigned.metrics.assignedStageCount = 999;
  const repAssigned = auditRecommendationOrchestrationResult(tAssigned);
  assert.equal(repAssigned.isValid, false);
  assert.ok(repAssigned.violations.some((v) => v.code === 'METRICS_ASSIGNED_STAGE_COUNT_MISMATCH'));

  // Mutating totalVigorConsumed triggers violation
  const tVigor = deepClone(result) as any;
  tVigor.metrics.totalVigorConsumed = 999;
  const repVigor = auditRecommendationOrchestrationResult(tVigor);
  assert.equal(repVigor.isValid, false);
  assert.ok(repVigor.violations.some((v) => v.code === 'METRICS_TOTAL_VIGOR_CONSUMED_MISMATCH'));

  // Mutating distinctResonatorsUsedCount triggers violation
  const tDistinct = deepClone(result) as any;
  tDistinct.metrics.distinctResonatorsUsedCount = 999;
  const repDistinct = auditRecommendationOrchestrationResult(tDistinct);
  assert.equal(repDistinct.isValid, false);
  assert.ok(repDistinct.violations.some((v) => v.code === 'METRICS_DISTINCT_RESONATORS_USED_MISMATCH'));

  // Mutating stageCoverageRatio triggers violation
  const tRatio = deepClone(result) as any;
  tRatio.metrics.stageCoverageRatio = 0.5;
  const repRatio = auditRecommendationOrchestrationResult(tRatio);
  assert.equal(repRatio.isValid, false);
  assert.ok(repRatio.violations.some((v) => v.code === 'METRICS_STAGE_COVERAGE_RATIO_MISMATCH'));

  // Mutating ownedResonatorCount triggers violation
  const tRoster = deepClone(result) as any;
  tRoster.metrics.ownedResonatorCount = 999;
  const repRoster = auditRecommendationOrchestrationResult(tRoster);
  assert.equal(repRoster.isValid, false);
  assert.ok(repRoster.violations.some((v) => v.code === 'METRICS_OWNED_RESONATOR_COUNT_MISMATCH'));

  // Null result handled
  const repNull = auditRecommendationOrchestrationResult(null as any);
  assert.equal(repNull.isValid, false);
  assert.ok(repNull.violations.some((v) => v.code === 'NULL_RESULT'));

  // Absent portfolio/allocation (insufficient roster < 3)
  const rosterResult = orchestrateRecommendations({ ownedRoster: ['Jinhsi'] });
  assert.equal(rosterResult.recommendation.status, 'INSUFFICIENT_ROSTER');
  const rosterAudit = auditRecommendationOrchestrationResult(rosterResult);
  assert.equal(rosterAudit.isValid, true, `Roster audit violations: ${JSON.stringify(rosterAudit.violations)}`);
});

test('Step 24 - 31. FINDING S24-006: Deep-clone contract, cycle safety, and unsupported type rejection', () => {
  // 1. Plain objects, arrays, primitives, nested objects clone and freeze correctly
  const sample = {
    str: 'test',
    num: 42,
    bool: true,
    nil: null,
    arr: [1, 2, { deep: 'value' }],
    nested: { a: 1, b: [3, 4] }
  };
  const cloned = deepClone(sample);
  assert.deepEqual(cloned, sample);
  assert.notEqual(cloned, sample);
  assert.notEqual(cloned.nested, sample.nested);
  assert.notEqual(cloned.arr, sample.arr);

  const frozen = deepFreeze(sample);
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.nested));
  assert.ok(Object.isFrozen(frozen.arr));

  // 2. Cycle-safety: circular objects do not cause infinite recursion
  const circular: any = { name: 'cycle' };
  circular.self = circular;
  const clonedCycle = deepClone(circular);
  assert.equal(clonedCycle.name, 'cycle');
  assert.equal(clonedCycle.self, clonedCycle);

  // 3. Unsupported types reject with TypeError
  assert.throws(() => deepClone(new Map() as any), TypeError);
  assert.throws(() => deepClone(new Set() as any), TypeError);
  assert.throws(() => deepClone(new Date() as any), TypeError);
  assert.throws(() => deepClone(new Uint8Array(5) as any), TypeError);
  class CustomClass { x = 1; }
  assert.throws(() => deepClone(new CustomClass() as any), TypeError);

  assert.throws(() => deepFreeze(new Map() as any), TypeError);
  assert.throws(() => deepFreeze(new Set() as any), TypeError);
  assert.throws(() => deepFreeze(new Date() as any), TypeError);
  assert.throws(() => deepFreeze(new CustomClass() as any), TypeError);
});
