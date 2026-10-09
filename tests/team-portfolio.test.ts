/**
 * Wuthering Waves Team Portfolio Selection & Optimization Contract Tests
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Verifies all required contract dimensions from prompt Section 11:
 * 1. Contract identity, patch isolation, and rule versions
 * 2. Configurable cardinality K validation and boundaries
 * 3. Strict input validation and fail-closed behavior
 * 4. Owned roster validation and infeasibility semantics
 * 5. Resonator mutual disjointness invariant
 * 6. Member conservation invariant
 * 7. Aspect completeness conservation and algebra
 * 8. Deterministic identifier derivation and permutation invariance
 * 9. Canonical team ordering
 * 10. Lexicographic optimization objective hierarchy
 * 11. Exhaustive small-instance optimality proof
 * 12. Cross-team Sonata aggregation facts
 * 13. Deep immutability of portfolio result
 * 14. Prohibited-key rejection across casing and delimiters
 * 15. Production catalog portfolio audit
 * 16. Twenty-run byte-identical determinism
 * 17. Factual presentation formatting
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  TEAM_PORTFOLIO_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  REQUIRED_STEP10_RULE_VERSION,
  REQUIRED_STEP12_RULE_VERSION,
  DEFAULT_PORTFOLIO_TARGET_K,
  MIN_PORTFOLIO_TARGET_K,
  MAX_PORTFOLIO_TARGET_K,
  TEAM_MEMBER_COUNT,
  ASPECTS_PER_TEAM,
  TEAM_PORTFOLIO_EXPLANATION_CODES,
  PROHIBITED_TEAM_PORTFOLIO_KEYS
} from '../lib/engine/team-portfolio/rules.ts';
import {
  deriveTeamPortfolioId,
  areTeamsMutuallyDisjoint,
  extractPortfolioMemberIds
} from '../lib/engine/team-portfolio/predicates.ts';
import {
  selectTeamPortfolio
} from '../lib/engine/team-portfolio/builder.ts';
import {
  getTeamPortfolioResult,
  getDefaultTeamPortfolio,
  selectTeamPortfolioForRoster,
  clearTeamPortfolioCache
} from '../lib/engine/team-portfolio/repository.ts';
import {
  normalizeProhibitedKey,
  assertNoProhibitedTeamPortfolioKeys,
  auditSingleTeamPortfolio,
  runProductionTeamPortfolioAudit
} from '../lib/engine/team-portfolio/audit.ts';
import {
  formatTeamPortfolioExplanation
} from '../lib/engine/team-portfolio/index.ts';
import { getAllTeamBuildEvaluations } from '../lib/engine/team-build-evaluation/repository.ts';
import { getKnownResonatorIds } from '../lib/engine/team-composition/repository.ts';
import type {
  TeamPortfolio,
  TeamBuildEvaluation,
  TeamCompositionCandidateEvaluation,
  OwnedRosterSnapshot
} from '../lib/engine/team-portfolio/types.ts';

// Helper to construct a mock TeamBuildEvaluation for testing
function createMockTeamBuildEvaluation(
  memberA: string,
  memberB: string,
  memberC: string,
  overrides?: {
    status?: TeamBuildEvaluation['status'];
    knownAspects?: number;
    hasIncompatibleWeapon?: boolean;
    activeSonatas?: [string, string, string];
  }
): TeamBuildEvaluation {
  const sorted = [memberA, memberB, memberC].sort((a, b) => a.localeCompare(b));
  const id = `team-build:3.7:${sorted.join(':')}:7.21.1`;
  const teamCandidateId = `team-composition:3.7:${sorted.join(':')}:7.9.1`;
  const knownAspects = overrides?.knownAspects ?? 18;
  const unknownAspects = 18 - knownAspects;
  const hasIncompatible = overrides?.hasIncompatibleWeapon ?? false;
  const sonatas = overrides?.activeSonatas ?? ['FREEZING_FROST', 'MOLTEN_RIFT', 'SIERRA_GALE'];

  return Object.freeze({
    id,
    patchVersion: '3.7',
    ruleVersion: '7.21.1',
    teamCandidateId,
    memberResonatorIds: Object.freeze(sorted) as unknown as readonly [string, string, string],
    memberBuildEvaluations: Object.freeze([
      {
        id: `char-build:3.7:${sorted[0]}:7.20.1`,
        patchVersion: '3.7',
        ruleVersion: '7.20.1',
        resonatorId: sorted[0],
        status: 'FULLY_EQUIPPED',
        weaponEvaluation: {
          weaponId: 'weapon_1',
          weaponType: 'SWORD',
          isCompatible: !hasIncompatible,
          compatibilityStatus: hasIncompatible ? 'INCOMPATIBLE' : 'COMPATIBLE',
          level: 90,
          refinementRank: 1,
          status: hasIncompatible ? 'INCOMPATIBLE' : 'KNOWN'
        },
        echoEvaluation: {
          equippedCount: 5,
          activeSonataSetCode: sonatas[0],
          isElementAligned: true,
          status: 'FULLY_EQUIPPED'
        },
        completeness: {
          totalAspects: 6,
          knownAspects: Math.floor(knownAspects / 3),
          unknownAspects: 6 - Math.floor(knownAspects / 3),
          completenessRatio: Math.floor(knownAspects / 3) / 6
        },
        explanationCodes: ['STATUS_FULLY_EQUIPPED'],
        provenance: {
          source: 'DERIVED_CHARACTER_BUILD_EVALUATION',
          patchVersion: '3.7',
          ruleVersion: '7.20.1',
          resonatorId: sorted[0],
          upstreamDecisionContextRuleVersion: '7.19.1',
          upstreamSnapshotRuleVersion: '7.13.1'
        }
      },
      {
        id: `char-build:3.7:${sorted[1]}:7.20.1`,
        patchVersion: '3.7',
        ruleVersion: '7.20.1',
        resonatorId: sorted[1],
        status: 'FULLY_EQUIPPED',
        weaponEvaluation: {
          weaponId: 'weapon_2',
          weaponType: 'SWORD',
          isCompatible: true,
          compatibilityStatus: 'COMPATIBLE',
          level: 90,
          refinementRank: 1,
          status: 'KNOWN'
        },
        echoEvaluation: {
          equippedCount: 5,
          activeSonataSetCode: sonatas[1],
          isElementAligned: true,
          status: 'FULLY_EQUIPPED'
        },
        completeness: {
          totalAspects: 6,
          knownAspects: Math.floor(knownAspects / 3),
          unknownAspects: 6 - Math.floor(knownAspects / 3),
          completenessRatio: Math.floor(knownAspects / 3) / 6
        },
        explanationCodes: ['STATUS_FULLY_EQUIPPED'],
        provenance: {
          source: 'DERIVED_CHARACTER_BUILD_EVALUATION',
          patchVersion: '3.7',
          ruleVersion: '7.20.1',
          resonatorId: sorted[1],
          upstreamDecisionContextRuleVersion: '7.19.1',
          upstreamSnapshotRuleVersion: '7.13.1'
        }
      },
      {
        id: `char-build:3.7:${sorted[2]}:7.20.1`,
        patchVersion: '3.7',
        ruleVersion: '7.20.1',
        resonatorId: sorted[2],
        status: 'FULLY_EQUIPPED',
        weaponEvaluation: {
          weaponId: 'weapon_3',
          weaponType: 'SWORD',
          isCompatible: true,
          compatibilityStatus: 'COMPATIBLE',
          level: 90,
          refinementRank: 1,
          status: 'KNOWN'
        },
        echoEvaluation: {
          equippedCount: 5,
          activeSonataSetCode: sonatas[2],
          isElementAligned: true,
          status: 'FULLY_EQUIPPED'
        },
        completeness: {
          totalAspects: 6,
          knownAspects: knownAspects - 2 * Math.floor(knownAspects / 3),
          unknownAspects: 6 - (knownAspects - 2 * Math.floor(knownAspects / 3)),
          completenessRatio: (knownAspects - 2 * Math.floor(knownAspects / 3)) / 6
        },
        explanationCodes: ['STATUS_FULLY_EQUIPPED'],
        provenance: {
          source: 'DERIVED_CHARACTER_BUILD_EVALUATION',
          patchVersion: '3.7',
          ruleVersion: '7.20.1',
          resonatorId: sorted[2],
          upstreamDecisionContextRuleVersion: '7.19.1',
          upstreamSnapshotRuleVersion: '7.13.1'
        }
      }
    ]) as unknown as readonly [any, any, any],
    weaponAggregation: Object.freeze({
      compatibleCount: hasIncompatible ? 2 : 3,
      incompatibleCount: hasIncompatible ? 1 : 0,
      unequippedCount: 0,
      unknownCount: 0,
      allCompatible: !hasIncompatible,
      hasIncompatibleWeapon: hasIncompatible
    }),
    echoAggregation: Object.freeze({
      equippedCount: 3,
      elementAlignedSonataCount: 3,
      universalSonataCount: 0,
      misalignedSonataCount: 0,
      unequippedSonataCount: 0,
      unknownSonataCount: 0
    }),
    sonataInteraction: Object.freeze({
      memberSonataCodes: Object.freeze(sonatas),
      distinctActiveSonataCodes: Object.freeze(Array.from(new Set(sonatas)).sort()),
      duplicateSonataCodes: Object.freeze([]),
      hasDuplicateSonataSets: false,
      interactionStatus: 'EVALUATED',
      stackingStatus: 'UNMODELED'
    }),
    completeness: Object.freeze({
      totalTeamAspects: 18,
      knownTeamAspects: knownAspects,
      unknownTeamAspects: unknownAspects,
      memberCompletenessRatios: Object.freeze([1, 1, 1]) as unknown as readonly [number | null, number | null, number | null],
      teamCompletenessRatio: Math.round((knownAspects / 18) * 10000) / 10000
    }),
    status: overrides?.status ?? (hasIncompatible ? 'INCOMPATIBLE_WEAPON' : 'FULLY_EQUIPPED'),
    explanationCodes: Object.freeze([
      overrides?.status ? `STATUS_${overrides.status}` : hasIncompatible ? 'STATUS_INCOMPATIBLE_WEAPON' : 'STATUS_FULLY_EQUIPPED',
      'SONATA_STACKING_UNMODELED'
    ]),
    provenance: Object.freeze({
      source: 'DERIVED_TEAM_BUILD_EVALUATION',
      patchVersion: '3.7',
      ruleVersion: '7.21.1',
      teamCandidateId,
      memberBuildEvaluationIds: Object.freeze([
        `char-build:3.7:${sorted[0]}:7.20.1`,
        `char-build:3.7:${sorted[1]}:7.20.1`,
        `char-build:3.7:${sorted[2]}:7.20.1`
      ]) as unknown as readonly [string, string, string],
      upstreamBuildEvaluationRuleVersion: '7.20.1',
      upstreamTeamCandidateRuleVersion: '7.9.1'
    })
  });
}

function createMockSynergyEvaluation(
  memberA: string,
  memberB: string,
  memberC: string,
  totalScore: number
): TeamCompositionCandidateEvaluation {
  const sorted = [memberA, memberB, memberC].sort((a, b) => a.localeCompare(b));
  const candidateId = `team-composition:3.7:${sorted.join(':')}:7.9.1`;
  return Object.freeze({
    id: `team-composition-evaluation:3.7:${candidateId}:7.10.1`,
    candidateId,
    patchVersion: '3.7',
    ruleVersion: '7.10.1',
    candidateQualificationStatus: 'QUALIFIED',
    evaluationStatus: 'EVALUATED',
    totalScore,
    components: Object.freeze([]),
    matchedPairCount: 3,
    directionalEdgeCount: 6,
    independentEvidenceLineageCount: 9,
    contextRequirements: Object.freeze([]),
    applicabilitySummary: Object.freeze({
      evaluatedPairCount: 3,
      partiallyEvaluatedPairCount: 0,
      contextDependentPairCount: 0,
      unmodeledPairCount: 0,
      unknownPairCount: 0,
      notApplicablePairCount: 0,
      noEvidencePairCount: 0,
      missingContextDimensions: Object.freeze([])
    }),
    pairSynergyProfileIds: Object.freeze([]),
    pairEvidenceProfileIds: Object.freeze([]),
    evidenceIds: Object.freeze([]),
    relationshipIds: Object.freeze([]),
    sourceFactIds: Object.freeze([]),
    explanationCodes: Object.freeze(['STATUS_EVALUATED']),
    provenance: Object.freeze({
      entityId: 'SYSTEM',
      entityName: 'Step 10 Evaluation',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'EVAL',
      patchVersion: '3.7',
      sourceProvenance: 'Test Mock',
      originalDescription: 'Test mock'
    })
  });
}

// -----------------------------------------------------------------------------
// TEST SUITE
// -----------------------------------------------------------------------------

test('1. Contract Identity, Patch Isolation, and Rule Versions', () => {
  assert.strictEqual(TEAM_PORTFOLIO_RULE_VERSION, '7.22.1');
  assert.strictEqual(CANONICAL_PATCH_VERSION, '3.7');
  assert.strictEqual(REQUIRED_STEP21_RULE_VERSION, '7.21.1');
  assert.strictEqual(REQUIRED_STEP10_RULE_VERSION, '7.10.1');
  assert.strictEqual(REQUIRED_STEP12_RULE_VERSION, '7.12.1');
  assert.strictEqual(DEFAULT_PORTFOLIO_TARGET_K, 3);
  assert.strictEqual(MIN_PORTFOLIO_TARGET_K, 1);
  assert.strictEqual(MAX_PORTFOLIO_TARGET_K, 20);
  assert.strictEqual(TEAM_MEMBER_COUNT, 3);
  assert.strictEqual(ASPECTS_PER_TEAM, 18);
});

test('2. Target Cardinality K Validation and Boundaries', () => {
  const validKValues = [1, 2, 3, 5, 10, 20];
  for (const k of validKValues) {
    const id = deriveTeamPortfolioId([], k);
    assert.ok(id.includes(`:${k}:`), `ID should include target K ${k}`);
  }

  const invalidKValues = [0, -1, -5, 21, 100, 2.5, NaN, Infinity, -Infinity];
  for (const badK of invalidKValues) {
    assert.throws(
      () => selectTeamPortfolio({ targetK: badK }),
      /Invalid targetK/,
      `Should reject invalid targetK ${badK}`
    );
  }
});

test('3. Strict Input Validation and Fail-Closed Behavior', () => {
  // Invalid patchId
  assert.throws(
    () => selectTeamPortfolio({ patchId: '3.6' as any }),
    /Invalid patchId/
  );
  assert.throws(
    () => selectTeamPortfolio({ patchId: '' as any }),
    /Invalid patchId/
  );

  // Non-canonical Resonator ID in owned roster array
  assert.throws(
    () => selectTeamPortfolio({ ownedRoster: ['fake_resonator_999'] }),
    /Non-canonical Resonator ID/
  );

  // Duplicate candidates in input candidate pool
  const t1 = createMockTeamBuildEvaluation('jiyan', 'mortefi', 'verina');
  assert.throws(
    () => selectTeamPortfolio({ teamBuildEvaluations: [t1, t1] }),
    /Duplicate TeamBuildEvaluation ID/
  );

  // Candidate with invalid patch version
  const badPatchCand = { ...t1, patchVersion: '3.6' } as any;
  assert.throws(
    () => selectTeamPortfolio({ teamBuildEvaluations: [badPatchCand] }),
    /Invalid patchVersion/
  );

  // Candidate with invalid rule version
  const badRuleCand = { ...t1, ruleVersion: '7.20.1' } as any;
  assert.throws(
    () => selectTeamPortfolio({ teamBuildEvaluations: [badRuleCand] }),
    /Invalid ruleVersion/
  );
});

test('4. Owned Roster Snapshot Validation & Infeasibility Semantics', () => {
  const known = getKnownResonatorIds();
  assert.ok(known.length >= 20, 'Should have sufficient known Resonators in Patch 3.7');

  // Owned roster with fewer than 3*K Resonators (e.g. 5 resonators for K=2, which needs 6)
  const smallRoster = known.slice(0, 5);
  const result = selectTeamPortfolio({
    ownedRoster: smallRoster,
    targetK: 2
  });

  assert.strictEqual(result.portfolio.status, 'INFEASIBLE_PORTFOLIO');
  assert.strictEqual(result.portfolio.selectedTeamCount, 0);
  assert.strictEqual(result.portfolio.teams.length, 0);
  assert.strictEqual(result.portfolio.allMemberResonatorIds.length, 0);
  assert.strictEqual(result.portfolio.completeness.portfolioCompletenessRatio, null);
  assert.ok(result.portfolio.infeasibilityReasons);
  assert.ok(
    result.portfolio.infeasibilityReasons.some((r) => r.includes('Insufficient owned Resonators'))
  );

  // Partial portfolio allowed
  const partialResult = selectTeamPortfolio({
    ownedRoster: known.slice(0, 3), // Exactly 3 resonators
    targetK: 3,
    allowPartial: true
  });
  // Can only form at most 1 team with 3 resonators
  assert.strictEqual(partialResult.portfolio.status, 'PARTIAL_PORTFOLIO');
  assert.strictEqual(partialResult.portfolio.selectedTeamCount, 1);
  assert.strictEqual(partialResult.portfolio.teams.length, 1);
});

test('5. Resonator Mutual Disjointness Invariant', () => {
  // Construct 3 candidates:
  // T1: [A, B, C]
  // T2: [C, D, E] (overlaps with T1 on C)
  // T3: [D, E, F] (overlaps with T2)
  // T4: [G, H, I] (disjoint with T1)
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5, r6, r7, r8] = known.slice(0, 9);

  const t1 = createMockTeamBuildEvaluation(r0, r1, r2);
  const t2 = createMockTeamBuildEvaluation(r2, r3, r4);
  const t3 = createMockTeamBuildEvaluation(r1, r4, r5);
  const t4 = createMockTeamBuildEvaluation(r6, r7, r8);

  // Requested K = 2: T1 and T4 are mutually disjoint! T2 overlaps with both T1 and T3.
  const result = selectTeamPortfolio({
    teamBuildEvaluations: [t1, t2, t3, t4],
    targetK: 2
  });

  assert.strictEqual(result.portfolio.status, 'OPTIMAL_PORTFOLIO');
  assert.strictEqual(result.portfolio.selectedTeamCount, 2);
  assert.strictEqual(result.portfolio.isMutuallyDisjoint, true);
  assert.ok(areTeamsMutuallyDisjoint(result.portfolio.teams));

  const teamIds = result.portfolio.teams.map((t) => t.id);
  assert.ok(teamIds.includes(t1.id));
  assert.ok(teamIds.includes(t4.id));
  assert.ok(!teamIds.includes(t2.id));
});

test('6. Member Conservation Invariant', () => {
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5] = known.slice(0, 6);

  const t1 = createMockTeamBuildEvaluation(r0, r1, r2);
  const t2 = createMockTeamBuildEvaluation(r3, r4, r5);

  const result = selectTeamPortfolio({
    teamBuildEvaluations: [t1, t2],
    targetK: 2
  });

  assert.strictEqual(result.portfolio.selectedTeamCount, 2);
  assert.strictEqual(
    result.portfolio.allMemberResonatorIds.length,
    2 * TEAM_MEMBER_COUNT
  );
  // Strictly sorted lexicographically
  for (let i = 1; i < result.portfolio.allMemberResonatorIds.length; i++) {
    assert.ok(
      result.portfolio.allMemberResonatorIds[i - 1] <
        result.portfolio.allMemberResonatorIds[i]
    );
  }
});

test('7. Aspect Completeness Conservation and Algebra', () => {
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5] = known.slice(0, 6);

  const t1 = createMockTeamBuildEvaluation(r0, r1, r2, { knownAspects: 15 });
  const t2 = createMockTeamBuildEvaluation(r3, r4, r5, { knownAspects: 12 });

  const result = selectTeamPortfolio({
    teamBuildEvaluations: [t1, t2],
    targetK: 2
  });

  const comp = result.portfolio.completeness;
  assert.strictEqual(comp.totalPortfolioAspects, 2 * ASPECTS_PER_TEAM); // 36
  assert.strictEqual(comp.knownPortfolioAspects, 15 + 12); // 27
  assert.strictEqual(comp.unknownPortfolioAspects, 36 - 27); // 9
  assert.strictEqual(
    comp.knownPortfolioAspects + comp.unknownPortfolioAspects,
    comp.totalPortfolioAspects
  );

  const expectedRatio = Math.round((27 / 36) * 10000) / 10000; // 0.75
  assert.strictEqual(comp.portfolioCompletenessRatio, expectedRatio);
});

test('8. Deterministic ID Derivation and Permutation Invariance', () => {
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5] = known.slice(0, 6);

  const t1 = createMockTeamBuildEvaluation(r0, r1, r2);
  const t2 = createMockTeamBuildEvaluation(r3, r4, r5);

  const resultA = selectTeamPortfolio({
    teamBuildEvaluations: [t1, t2],
    targetK: 2
  });

  const resultB = selectTeamPortfolio({
    teamBuildEvaluations: [t2, t1], // Reverse input order
    targetK: 2
  });

  assert.strictEqual(resultA.portfolio.id, resultB.portfolio.id);
  assert.deepStrictEqual(
    resultA.portfolio.teams.map((t) => t.id),
    resultB.portfolio.teams.map((t) => t.id)
  );
  assert.deepStrictEqual(
    resultA.portfolio.allMemberResonatorIds,
    resultB.portfolio.allMemberResonatorIds
  );
});

test('9. Canonical Team Ordering', () => {
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5] = known.slice(0, 6);

  const t1 = createMockTeamBuildEvaluation(r0, r1, r2);
  const t2 = createMockTeamBuildEvaluation(r3, r4, r5);

  const result = selectTeamPortfolio({
    teamBuildEvaluations: [t2, t1],
    targetK: 2
  });

  // Verify teams are strictly sorted by team.id ascending
  for (let i = 1; i < result.portfolio.teams.length; i++) {
    assert.ok(
      result.portfolio.teams[i - 1].id < result.portfolio.teams[i].id
    );
  }
});

test('10. Lexicographic Optimization Objective Hierarchy', () => {
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5] = known.slice(0, 6);

  // Scenario 1: Weapon compatibility dominates synergy score
  // Candidate A: fully compatible weapon, lower synergy (100)
  // Candidate B: incompatible weapon, higher synergy (500)
  const tA = createMockTeamBuildEvaluation(r0, r1, r2, { hasIncompatibleWeapon: false });
  const tB = createMockTeamBuildEvaluation(r3, r4, r5, { hasIncompatibleWeapon: true });
  const synA = createMockSynergyEvaluation(r0, r1, r2, 100);
  const synB = createMockSynergyEvaluation(r3, r4, r5, 500);

  // When only one can be selected (K = 1)
  const resultWeapon = selectTeamPortfolio({
    teamBuildEvaluations: [tA, tB],
    synergyEvaluations: [synA, synB],
    targetK: 1
  });

  assert.strictEqual(
    resultWeapon.portfolio.teams[0].weaponAggregation.hasIncompatibleWeapon,
    false,
    'Compatible weapon must be strictly preferred over incompatible weapon despite lower synergy'
  );

  // Scenario 2: Build qualification dominates synergy score
  const tFull = createMockTeamBuildEvaluation(r0, r1, r2, { status: 'FULLY_EQUIPPED' });
  const tPart = createMockTeamBuildEvaluation(r3, r4, r5, { status: 'PARTIALLY_EQUIPPED' });
  const synFull = createMockSynergyEvaluation(r0, r1, r2, 50);
  const synPart = createMockSynergyEvaluation(r3, r4, r5, 200);

  const resultBuild = selectTeamPortfolio({
    teamBuildEvaluations: [tPart, tFull],
    synergyEvaluations: [synPart, synFull],
    targetK: 1
  });

  assert.strictEqual(
    resultBuild.portfolio.teams[0].status,
    'FULLY_EQUIPPED',
    'FULLY_EQUIPPED status must be strictly preferred over PARTIALLY_EQUIPPED'
  );

  // Scenario 3: Equal build and weapons -> higher completeness preferred
  const tComp18 = createMockTeamBuildEvaluation(r0, r1, r2, { knownAspects: 18 });
  const tComp12 = createMockTeamBuildEvaluation(r3, r4, r5, { knownAspects: 12 });
  const synComp18 = createMockSynergyEvaluation(r0, r1, r2, 10);
  const synComp12 = createMockSynergyEvaluation(r3, r4, r5, 50);

  const resultComp = selectTeamPortfolio({
    teamBuildEvaluations: [tComp12, tComp18],
    synergyEvaluations: [synComp12, synComp18],
    targetK: 1
  });

  assert.strictEqual(
    resultComp.portfolio.completeness.knownPortfolioAspects,
    18,
    'Higher known aspects must be preferred over lower aspects'
  );

  // Scenario 4: Equal build, weapons, and completeness -> higher synergy preferred
  const tSyn1 = createMockTeamBuildEvaluation(r0, r1, r2, { knownAspects: 18 });
  const tSyn2 = createMockTeamBuildEvaluation(r3, r4, r5, { knownAspects: 18 });
  const syn1 = createMockSynergyEvaluation(r0, r1, r2, 350);
  const syn2 = createMockSynergyEvaluation(r3, r4, r5, 120);

  const resultSyn = selectTeamPortfolio({
    teamBuildEvaluations: [tSyn1, tSyn2],
    synergyEvaluations: [syn1, syn2],
    targetK: 1
  });

  assert.strictEqual(
    resultSyn.portfolio.teams[0].id,
    tSyn1.id,
    'Higher synergy score must be preferred when build aspects are identical'
  );
});

test('11. Exhaustive Small-Instance Optimality Proof', () => {
  // 6 Resonators: r0, r1, r2, r3, r4, r5
  // Candidate pool:
  // C1: [r0, r1, r2] (fully equipped, synergy 200)
  // C2: [r3, r4, r5] (fully equipped, synergy 150)
  // C3: [r0, r3, r4] (overlaps with C1 & C2, synergy 500)
  // C4: [r1, r2, r5] (overlaps with C1 & C2, synergy 400)
  // For K = 2:
  // Feasible pairs:
  // - Pair (C1, C2): disjoint! Both fully equipped. Synergy = 200 + 150 = 350.
  // - Pair (C3, C4): disjoint! Both fully equipped. Synergy = 500 + 400 = 900.
  // The optimizer must evaluate both and choose (C3, C4) due to higher synergy sum!
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5] = known.slice(0, 6);

  const c1 = createMockTeamBuildEvaluation(r0, r1, r2);
  const c2 = createMockTeamBuildEvaluation(r3, r4, r5);
  const c3 = createMockTeamBuildEvaluation(r0, r3, r4);
  const c4 = createMockTeamBuildEvaluation(r1, r2, r5);

  const s1 = createMockSynergyEvaluation(r0, r1, r2, 200);
  const s2 = createMockSynergyEvaluation(r3, r4, r5, 150);
  const s3 = createMockSynergyEvaluation(r0, r3, r4, 500);
  const s4 = createMockSynergyEvaluation(r1, r2, r5, 400);

  const result = selectTeamPortfolio({
    teamBuildEvaluations: [c1, c2, c3, c4],
    synergyEvaluations: [s1, s2, s3, s4],
    targetK: 2
  });

  assert.strictEqual(result.portfolio.status, 'OPTIMAL_PORTFOLIO');
  const selectedIds = result.portfolio.teams.map((t) => t.id);
  assert.ok(selectedIds.includes(c3.id), 'Must select C3 for higher synergy');
  assert.ok(selectedIds.includes(c4.id), 'Must select C4 for higher synergy');
  assert.strictEqual(result.portfolio.synergyEvidenceSummary?.totalSynergyScore, 900);
});

test('12. Cross-Team Sonata Aggregation Facts', () => {
  const known = getKnownResonatorIds();
  const [r0, r1, r2, r3, r4, r5] = known.slice(0, 6);

  // Team 1 has FREEZING_FROST, MOLTEN_RIFT, SIERRA_GALE
  // Team 2 has FREEZING_FROST, CELESTIAL_LIGHT, VOID_THUNDER
  // -> FREEZING_FROST is equipped on both teams!
  const t1 = createMockTeamBuildEvaluation(r0, r1, r2, {
    activeSonatas: ['FREEZING_FROST', 'MOLTEN_RIFT', 'SIERRA_GALE']
  });
  const t2 = createMockTeamBuildEvaluation(r3, r4, r5, {
    activeSonatas: ['FREEZING_FROST', 'CELESTIAL_LIGHT', 'VOID_THUNDER']
  });

  const result = selectTeamPortfolio({
    teamBuildEvaluations: [t1, t2],
    targetK: 2
  });

  const agg = result.portfolio.crossTeamSonataAggregation;
  assert.strictEqual(agg.stackingStatus, 'UNMODELED');
  assert.strictEqual(agg.hasCrossTeamDuplicateSonatas, true);
  assert.ok(agg.crossTeamDuplicateSonataCodes.includes('FREEZING_FROST'));
  assert.ok(
    result.portfolio.explanationCodes.includes(
      TEAM_PORTFOLIO_EXPLANATION_CODES.HAS_CROSS_TEAM_DUPLICATE_SONATAS
    )
  );
});

test('13. Deep Immutability of Portfolio Result', () => {
  const known = getKnownResonatorIds();
  const [r0, r1, r2] = known.slice(0, 3);
  const t1 = createMockTeamBuildEvaluation(r0, r1, r2);

  const result = selectTeamPortfolio({
    teamBuildEvaluations: [t1],
    targetK: 1
  });

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.portfolio));
  assert.ok(Object.isFrozen(result.portfolio.teams));
  assert.ok(Object.isFrozen(result.portfolio.allMemberResonatorIds));
  assert.ok(Object.isFrozen(result.portfolio.explanationCodes));
  assert.ok(Object.isFrozen(result.portfolio.provenance));
  assert.ok(Object.isFrozen(result.metrics));

  assert.throws(() => {
    (result.portfolio as any).targetTeamCount = 99;
  });
  assert.throws(() => {
    (result.portfolio.teams as any).push(t1);
  });
});

test('14. Prohibited-Key Rejection Across Casing and Delimiters', () => {
  // Test normalization
  assert.strictEqual(normalizeProhibitedKey('combatPower'), 'combatpower');
  assert.strictEqual(normalizeProhibitedKey('team_score'), 'teamscore');
  assert.strictEqual(normalizeProhibitedKey('Meta-Rank'), 'metarank');
  assert.strictEqual(normalizeProhibitedKey('vigor_cost'), 'vigorcost');

  // assertNoProhibitedTeamPortfolioKeys should pass on clean object
  assert.doesNotThrow(() => {
    assertNoProhibitedTeamPortfolioKeys({ validField: 'hello', numbers: [1, 2, 3] });
  });

  // Rejects prohibited keys
  for (const badKey of ['combatPower', 'teamScore', 'dps', 'damage', 'tier', 'metaRank', 'vigorCost']) {
    assert.throws(
      () => assertNoProhibitedTeamPortfolioKeys({ [badKey]: 100 }),
      /Prohibited key/,
      `Should reject ${badKey}`
    );
  }

  // Nested prohibited key
  assert.throws(
    () =>
      assertNoProhibitedTeamPortfolioKeys({
        nested: {
          items: [{ 'rotation-dps': 5000 }]
        }
      }),
    /Prohibited key/
  );
});

test('15. Production Catalog Portfolio Audit (K = 3)', () => {
  clearTeamPortfolioCache();
  const result = runProductionTeamPortfolioAudit();

  assert.strictEqual(result.patchId, '3.7');
  assert.strictEqual(result.ruleVersion, '7.22.1');
  assert.strictEqual(result.portfolio.patchVersion, '3.7');
  assert.strictEqual(result.portfolio.ruleVersion, '7.22.1');
  assert.strictEqual(result.portfolio.targetTeamCount, 3);
  assert.strictEqual(result.portfolio.selectedTeamCount, 3);
  assert.strictEqual(result.portfolio.status, 'FEASIBLE_PORTFOLIO');
  assert.strictEqual(result.portfolio.isMutuallyDisjoint, true);
  assert.strictEqual(result.portfolio.allMemberResonatorIds.length, 9);
  assert.strictEqual(result.portfolio.completeness.totalPortfolioAspects, 54);
  assert.ok(result.portfolio.provenance);

  // Audits single portfolio strictly
  assert.doesNotThrow(() => {
    auditSingleTeamPortfolio(result.portfolio);
  });
});

test('16. Twenty-Run Byte-Identical Determinism', () => {
  clearTeamPortfolioCache();

  const hashes: string[] = [];
  for (let i = 0; i < 20; i++) {
    // Bust cache to test fresh deterministic execution
    clearTeamPortfolioCache();
    const res = selectTeamPortfolio();
    const serialized = JSON.stringify(res);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    hashes.push(hash);
  }

  const firstHash = hashes[0];
  assert.ok(firstHash, 'Should generate valid SHA-256 hash');
  for (let i = 1; i < hashes.length; i++) {
    assert.strictEqual(
      hashes[i],
      firstHash,
      `Run ${i + 1} produced different hash from run 1`
    );
  }
});

test('17. Factual Presentation Formatting', () => {
  const defaultPort = getDefaultTeamPortfolio();
  const text = formatTeamPortfolioExplanation(defaultPort);

  assert.ok(text.includes('Team Portfolio: team-portfolio:3.7:3:'));
  assert.ok(text.includes('Status: FEASIBLE_PORTFOLIO'));
  assert.ok(text.includes('MUTUALLY DISJOINT'));
  assert.ok(text.includes('Completeness:'));
  assert.ok(text.includes('Notice: Equipment contention across teams is unmodeled.'));

  // Ensure no prohibited words appear in presentation
  for (const prohibited of ['combat power', 'tier list', 'meta rank', 'dps', 'vigor']) {
    assert.strictEqual(
      text.toLowerCase().includes(prohibited),
      false,
      `Presentation should not include prohibited word '${prohibited}'`
    );
  }
});
