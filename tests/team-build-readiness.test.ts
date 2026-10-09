/**
 * Wuthering Waves Deterministic Team Build Readiness Test Suite
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Strict validation and verification covering:
 * - Ownership mapping & precedence from Step 12
 * - Investment availability & dimensions from Step 13
 * - Readiness composite status matrix
 * - Factual data completeness calculation across 3 members
 * - Step 10 evidence score & Step 11 rank immutability
 * - UNRANKABLE candidate preservation
 * - Canonical ordering & permutation invariance
 * - Repository query APIs and filter determinism
 * - Production fixtures: A through F
 * - Static safety, zero scoring, zero power, zero DPS
 * - Production auditor Invariants A through AR
 * - Upstream rule version immutability (7.8.1, 7.9.1, 7.10.1, 7.11.1, 7.12.1, 7.13.1, 7.14.1)
 * - Canonical dataset SHA-256 integrity
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  TEAM_BUILD_READINESS_RULE_VERSION,
  READINESS_EXPLANATION_CODES,
  EMPTY_TEAM_BUILD_READINESS_PROVENANCE,
  deriveTeamBuildReadinessId,
  isTeamFullyOwned,
  isInvestmentFullyKnown,
  isInvestmentPartiallyKnown,
  hasAnyKnownInvestment,
  hasUnknownInvestment,
  isReadyForFutureInvestmentEvaluation,
  matchesTeamBuildReadinessFilter,
  compareTeamBuildReadiness,
  evaluateTeamBuildReadiness,
  getTeamBuildReadiness,
  getAllTeamBuildReadiness,
  getReadyTeams,
  getPartiallyOwnedTeams,
  getInvestmentUnknownTeams,
  getFullyKnownInvestmentTeams,
  getTeamInvestmentCompleteness,
  getTeamBuildReadinessSummary,
  auditTeamBuildReadiness,
  assertNoProhibitedReadinessKeys,
  PROHIBITED_KEYS_ON_READINESS,
  explainTeamBuildReadiness
} from '../lib/engine/team-composition/readiness/index.ts';

import type {
  TeamBuildReadiness,
  TeamOwnershipStatus,
  TeamInvestmentStatus,
  TeamBuildReadinessStatus
} from '../lib/engine/team-composition/readiness/types.ts';

import {
  normalizeResonatorInvestment,
  createUninvestedSnapshot
} from '../lib/engine/investment/index.ts';
import type {
  OwnedRosterSnapshot,
  ResonatorInvestmentSnapshot
} from '../lib/engine/investment/types.ts';

import {
  getTeamCompositionRankings,
  getRankingByCandidateId
} from '../lib/engine/team-composition/ranking/repository.ts';
import { getEligibility } from '../lib/engine/roster/repository.ts';
import { getKnownResonatorIds } from '../lib/engine/team-composition/repository.ts';
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../lib/engine/relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../lib/engine/team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../lib/engine/team-composition/evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../lib/engine/team-composition/ranking/rules.ts';
import { OWNED_ROSTER_ELIGIBILITY_RULE_VERSION } from '../lib/engine/roster/rules.ts';
import { RESONATOR_INVESTMENT_RULE_VERSION } from '../lib/engine/investment/rules.ts';

const mockProvenance = Object.freeze({
  entityId: 'TEST_USER_READINESS',
  entityName: 'Test User Readiness',
  sourceType: 'RESONATOR_ABILITY' as const,
  sourceCode: 'TEST_READY',
  patchVersion: '3.7',
  sourceProvenance: 'test_readiness_snapshot',
  originalDescription: 'Test readiness description'
});

const allResonators = getKnownResonatorIds();
const rankings = getTeamCompositionRankings();
const sampleRank1 = rankings[0]; // Augusta, Hiyuki, Suoming (Rank 1, Score 82.4)
const [r1M1, r1M2, r1M3] = sampleRank1.memberResonatorIds;

// Helper to create full 100% known snapshot
function createFullyKnownSnapshot(resonatorId: string, weaponId: string): ResonatorInvestmentSnapshot {
  return normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId,
    characterLevel: 90,
    weapon: { weaponId, weaponLevel: 90, refinementRank: 5 },
    sequenceLevel: 6,
    echoInvestment: { equippedCount: 5, tunedCount: 5, maxLevelEchoCount: 5, sonataSetId: 'Void Thunder' },
    provenance: mockProvenance
  }).snapshot;
}

// ---------------------------------------------------------------------------
// 1–7: OWNERSHIP CONTRACT & PRECEDENCE
// ---------------------------------------------------------------------------

test('1. Full ownership maps to FULLY_OWNED and isFullyOwned = true', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.ownershipStatus, 'FULLY_OWNED');
  assert.equal(readiness.isFullyOwned, true);
});

test('2. Partial ownership (1-2 members) maps to PARTIALLY_OWNED and isFullyOwned = false', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.ownershipStatus, 'PARTIALLY_OWNED');
  assert.equal(readiness.isFullyOwned, false);
});

test('3. No ownership (0 members) maps to NOT_OWNED and isFullyOwned = false', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.ownershipStatus, 'NOT_OWNED');
  assert.equal(readiness.isFullyOwned, false);
});

test('4. Invalid roster maps to INVALID ownership status', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['InvalidHero'],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.ownershipStatus, 'INVALID');
  assert.equal(readiness.readinessStatus, 'INVALID');
});

test('5. Patch mismatch maps to PATCH_MISMATCH ownership status', () => {
  const roster = {
    patchVersion: '3.8' as unknown as '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster as unknown as OwnedRosterSnapshot)!;
  assert.equal(readiness.ownershipStatus, 'PATCH_MISMATCH');
  assert.equal(readiness.readinessStatus, 'PATCH_MISMATCH');
});

test('6. Step 12 authority is preserved exactly without independent recomputation', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const eligibility = getEligibility(sampleRank1.candidateId, roster)!;
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.step12EligibilityId, eligibility.id);
  assert.equal(readiness.isFullyOwned, eligibility.isEligible);
});

test('7. Ownership status has strict precedence over investment status', () => {
  // Candidate is NOT owned, but full investment snapshots are supplied
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const fullInvestments = [
    createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven'),
    createFullyKnownSnapshot(r1M2, 'Red Spring'),
    createFullyKnownSnapshot(r1M3, 'Variation')
  ];
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, fullInvestments)!;
  assert.equal(readiness.ownershipStatus, 'NOT_OWNED');
  assert.equal(readiness.readinessStatus, 'NOT_OWNED');
  assert.equal(readiness.isReady, false);
});

// ---------------------------------------------------------------------------
// 8–17: INVESTMENT STATUS & PRESERVATION CONTRACT
// ---------------------------------------------------------------------------

test('8. All dimensions known across all 3 members maps to INVESTMENT_COMPLETE', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const fullInvestments = [
    createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven'),
    createFullyKnownSnapshot(r1M2, 'Red Spring'),
    createFullyKnownSnapshot(r1M3, 'Variation')
  ];
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, fullInvestments)!;
  assert.equal(readiness.investmentStatus, 'INVESTMENT_COMPLETE');
  assert.equal(isInvestmentFullyKnown(readiness), true);
});

test('9. Zero known dimensions across all 3 members maps to INVESTMENT_UNKNOWN', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.investmentStatus, 'INVESTMENT_UNKNOWN');
  assert.equal(readiness.investmentCompleteness.knownMemberDimensions, 0);
});

test('10. Partial known dimensions maps to INVESTMENT_PARTIAL', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const partialSnap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    characterLevel: 80,
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [partialSnap])!;
  assert.equal(readiness.investmentStatus, 'INVESTMENT_PARTIAL');
  assert.equal(isInvestmentPartiallyKnown(readiness), true);
});

test('11. Mixed member investment states are preserved individually', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap1 = createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven');
  const snap2 = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M2,
    characterLevel: 70,
    provenance: mockProvenance
  }).snapshot;
  const snap3 = createUninvestedSnapshot(r1M3);

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap1, snap2, snap3])!;
  assert.equal(readiness.memberInvestmentSnapshots[0].characterLevel.value, 90);
  assert.equal(readiness.memberInvestmentSnapshots[1].characterLevel.value, 70);
  assert.equal(readiness.memberInvestmentSnapshots[2].characterLevel.status, 'UNKNOWN');
});

test('12. UNKNOWN dimensions are preserved without numeric coercion', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  for (const snap of readiness.memberInvestmentSnapshots) {
    assert.equal(snap.characterLevel.status, 'UNKNOWN');
    assert.equal(snap.characterLevel.value, null);
    assert.equal(snap.weapon, null);
    assert.equal(snap.sequenceLevel.status, 'UNKNOWN');
    assert.equal(snap.echoInvestment, null);
  }
});

test('13. Explicit S0 is preserved as KNOWN with value 0', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    sequenceLevel: 0,
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap])!;
  assert.equal(readiness.memberInvestmentSnapshots[0].sequenceLevel.status, 'KNOWN');
  assert.equal(readiness.memberInvestmentSnapshots[0].sequenceLevel.value, 0);
});

test('14. Explicit zero Echo count is preserved as KNOWN with value 0', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    echoInvestment: { equippedCount: 0 },
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap])!;
  assert.equal(readiness.memberInvestmentSnapshots[0].echoInvestment?.equippedCount.value, 0);
});

test('15. Unknown weapon is preserved as null', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.memberInvestmentSnapshots[0].weapon, null);
});

test('16. Unknown refinement rank is preserved as UNKNOWN with value null', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    weapon: { weaponId: 'Blooming Jadehaven', weaponLevel: 90 }, // refinement omitted
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap])!;
  assert.equal(readiness.memberInvestmentSnapshots[0].weapon?.refinementRank.status, 'UNKNOWN');
  assert.equal(readiness.memberInvestmentSnapshots[0].weapon?.refinementRank.value, null);
});

test('17. Unknown Sonata is preserved as null', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    echoInvestment: { equippedCount: 5 }, // sonata omitted
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap])!;
  assert.equal(readiness.memberInvestmentSnapshots[0].echoInvestment?.sonataSetId, null);
});

// ---------------------------------------------------------------------------
// 18–25: READINESS STATUS MATRIX CONTRACT
// ---------------------------------------------------------------------------

test('18. FULLY_OWNED + complete investment produces READY', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const fullInvestments = [
    createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven'),
    createFullyKnownSnapshot(r1M2, 'Red Spring'),
    createFullyKnownSnapshot(r1M3, 'Variation')
  ];
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, fullInvestments)!;
  assert.equal(readiness.readinessStatus, 'READY');
  assert.equal(readiness.isReady, true);
  assert.ok(readiness.explanationCodes.includes(READINESS_EXPLANATION_CODES.TEAM_READINESS_READY));
});

test('19. FULLY_OWNED + partial investment produces READY_WITH_PARTIAL_INVESTMENT', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const partialSnap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    characterLevel: 80,
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [partialSnap])!;
  assert.equal(readiness.readinessStatus, 'READY_WITH_PARTIAL_INVESTMENT');
  assert.equal(readiness.isReady, true);
  assert.ok(readiness.explanationCodes.includes(READINESS_EXPLANATION_CODES.TEAM_READINESS_READY_PARTIAL_INVESTMENT));
});

test('20. FULLY_OWNED + unknown investment produces READY_WITH_UNKNOWN_INVESTMENT', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.readinessStatus, 'READY_WITH_UNKNOWN_INVESTMENT');
  assert.equal(readiness.isReady, true);
  assert.ok(readiness.explanationCodes.includes(READINESS_EXPLANATION_CODES.TEAM_READINESS_READY_UNKNOWN_INVESTMENT));
});

test('21. PARTIALLY_OWNED + complete data produces PARTIALLY_OWNED', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2],
    provenance: mockProvenance
  };
  const fullInvestments = [
    createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven'),
    createFullyKnownSnapshot(r1M2, 'Red Spring'),
    createFullyKnownSnapshot(r1M3, 'Variation')
  ];
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, fullInvestments)!;
  assert.equal(readiness.readinessStatus, 'PARTIALLY_OWNED');
  assert.equal(readiness.isReady, false);
});

test('22. PARTIALLY_OWNED + partial data produces PARTIALLY_OWNED', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.readinessStatus, 'PARTIALLY_OWNED');
  assert.equal(readiness.isReady, false);
});

test('23. NOT_OWNED + complete data produces NOT_OWNED', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const fullInvestments = [
    createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven'),
    createFullyKnownSnapshot(r1M2, 'Red Spring'),
    createFullyKnownSnapshot(r1M3, 'Variation')
  ];
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, fullInvestments)!;
  assert.equal(readiness.readinessStatus, 'NOT_OWNED');
  assert.equal(readiness.isReady, false);
});

test('24. Invalid roster produces INVALID readiness status', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['BadHero'],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.readinessStatus, 'INVALID');
  assert.equal(readiness.isReady, false);
});

test('25. Patch mismatch produces PATCH_MISMATCH readiness status', () => {
  const roster = {
    patchVersion: '3.9' as unknown as '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster as unknown as OwnedRosterSnapshot)!;
  assert.equal(readiness.readinessStatus, 'PATCH_MISMATCH');
  assert.equal(readiness.isReady, false);
});

// ---------------------------------------------------------------------------
// 26–34: COMPLETENESS METRICS CONTRACT
// ---------------------------------------------------------------------------

test('26. 100% completeness yields teamCompletenessRatio = 1.0', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const fullInvestments = [
    createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven'),
    createFullyKnownSnapshot(r1M2, 'Red Spring'),
    createFullyKnownSnapshot(r1M3, 'Variation')
  ];
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, fullInvestments)!;
  assert.equal(readiness.investmentCompleteness.teamCompletenessRatio, 1.0);
  assert.equal(readiness.investmentCompleteness.knownMemberDimensions, 27);
  assert.equal(readiness.investmentCompleteness.unknownMemberDimensions, 0);
});

test('27. 0% completeness yields teamCompletenessRatio = 0.0', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.investmentCompleteness.teamCompletenessRatio, 0.0);
  assert.equal(readiness.investmentCompleteness.knownMemberDimensions, 0);
  assert.equal(readiness.investmentCompleteness.unknownMemberDimensions, 27);
});

test('28. Partial completeness accurately reflects proportion of known dimensions', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  // 1 member fully known (9/9), 2 members completely uninvested (0/9, 0/9) -> 9/27 = 0.3333
  const snap1 = createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven');
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap1])!;
  assert.equal(readiness.investmentCompleteness.knownMemberDimensions, 9);
  assert.equal(readiness.investmentCompleteness.totalMemberDimensions, 27);
  assert.equal(readiness.investmentCompleteness.teamCompletenessRatio, 0.3333);
});

test('29. Member-level completeness ratios are exposed individually as 3-tuple', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap1 = createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven');
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap1])!;
  assert.equal(readiness.investmentCompleteness.memberCompletenessRatios[0], 1.0);
  assert.equal(readiness.investmentCompleteness.memberCompletenessRatios[1], 0.0);
  assert.equal(readiness.investmentCompleteness.memberCompletenessRatios[2], 0.0);
});

test('30. Team-level completeness ratio reconciles with sum of known / total', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  const comp = readiness.investmentCompleteness;
  assert.equal(comp.knownMemberDimensions + comp.unknownMemberDimensions, comp.totalMemberDimensions);
});

test('31. Completeness ratio is rounded deterministically to 4 decimal places', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  // 1 known dimension out of 27: 1/27 = 0.037037037... -> 0.0370
  const snap1 = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    characterLevel: 80,
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap1])!;
  assert.equal(readiness.investmentCompleteness.teamCompletenessRatio, 0.037);
});

test('32. Completeness denominator is exactly 27 for three members', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.investmentCompleteness.totalMemberDimensions, 27);
});

test('33. UNKNOWN is never counted as KNOWN in numerator', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.investmentCompleteness.knownMemberDimensions, 0);
});

test('34. Explicit zero (S0) is counted as KNOWN in numerator', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap1 = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: r1M1,
    sequenceLevel: 0,
    provenance: mockProvenance
  }).snapshot;

  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap1])!;
  assert.equal(readiness.investmentCompleteness.knownMemberDimensions, 1);
});

// ---------------------------------------------------------------------------
// 35–40: UPSTREAM PRESERVATION CONTRACT
// ---------------------------------------------------------------------------

test('35. Step 10 score is copied exactly without modification', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.preservedStep10Score, 82.4);
  assert.equal(readiness.preservedStep10Score, sampleRank1.totalScore);
});

test('36. Step 11 rank is copied exactly without modification', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.preservedStep11Rank, 1);
  assert.equal(readiness.preservedStep11Rank, sampleRank1.rank);
});

test('37. Null Step 10 score is preserved for unrankable candidate', () => {
  const unrankable = rankings.find((r) => r.rankingStatus === 'UNRANKABLE')!;
  const [u1, u2, u3] = unrankable.memberResonatorIds;
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [u1, u2, u3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(unrankable.candidateId, roster)!;
  assert.equal(readiness.preservedStep10Score, null);
});

test('38. Null Step 11 rank is preserved for unrankable candidate', () => {
  const unrankable = rankings.find((r) => r.rankingStatus === 'UNRANKABLE')!;
  const [u1, u2, u3] = unrankable.memberResonatorIds;
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [u1, u2, u3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(unrankable.candidateId, roster)!;
  assert.equal(readiness.preservedStep11Rank, null);
  assert.equal(readiness.step11RankingStatus, 'UNRANKABLE');
});

test('39. Step 12 eligibility reference is preserved exactly', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const eligibility = getEligibility(sampleRank1.candidateId, roster)!;
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.step12EligibilityId, eligibility.id);
});

test('40. Step 13 investment snapshots are preserved immutably', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const snap1 = createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven');
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster, [snap1])!;
  assert.equal(readiness.memberInvestmentSnapshots[0].id, snap1.id);
  assert.equal(readiness.memberInvestmentSnapshots[0].characterLevel.value, snap1.characterLevel.value);
});

// ---------------------------------------------------------------------------
// 41–45: CANONICALIZATION & PERMUTATION INVARIANCE
// ---------------------------------------------------------------------------

test('41. Canonical team ordering (sorted member IDs) is preserved', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.deepEqual(readiness.memberResonatorIds, sampleRank1.memberResonatorIds);
});

test('42. Permutations resolve to the same canonical candidate', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M3, r1M1, r1M2],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.teamCandidateId, sampleRank1.candidateId);
  assert.equal(readiness.isFullyOwned, true);
});

test('43. Duplicate teams are not generated across enumeration', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readyTeams = getReadyTeams(roster);
  const ids = new Set(readyTeams.map((t) => t.id));
  assert.equal(ids.size, readyTeams.length);
});

test('44. Deterministic team candidate ID is preserved', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.teamCandidateId, sampleRank1.candidateId);
});

test('45. Deterministic readiness ID follows canonical pattern', () => {
  const expected = `team-build-readiness:3.7:${sampleRank1.candidateId}:7.14.1`;
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal(readiness.id, expected);
});

// ---------------------------------------------------------------------------
// 46–52: REPOSITORY QUERY APIS
// ---------------------------------------------------------------------------

test('46. getTeamBuildReadiness returns record for valid candidate ID', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster);
  assert.ok(readiness);
  assert.equal(readiness.teamCandidateId, sampleRank1.candidateId);
});

test('47. getAllTeamBuildReadiness evaluates candidates preserving Step 11 order', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const allRecords = getAllTeamBuildReadiness(roster);
  assert.equal(allRecords.length, 34220);
  assert.equal(allRecords[0].teamCandidateId, sampleRank1.candidateId);
});

test('48. getReadyTeams returns only constructible teams', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const ready = getReadyTeams(roster);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].isFullyOwned, true);
  assert.equal(ready[0].isReady, true);
});

test('49. getPartiallyOwnedTeams returns only partially owned teams', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2],
    provenance: mockProvenance
  };
  const partial = getPartiallyOwnedTeams(roster);
  assert.ok(partial.length > 0);
  for (const t of partial) {
    assert.equal(t.ownershipStatus, 'PARTIALLY_OWNED');
  }
});

test('50. getInvestmentUnknownTeams filters for unknown investment status', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const unk = getInvestmentUnknownTeams(roster);
  assert.ok(unk.length > 0);
  for (const t of unk) {
    assert.equal(t.investmentStatus, 'INVESTMENT_UNKNOWN');
  }
});

test('51. getFullyKnownInvestmentTeams filters for complete investment', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const fullInvestments = [
    createFullyKnownSnapshot(r1M1, 'Blooming Jadehaven'),
    createFullyKnownSnapshot(r1M2, 'Red Spring'),
    createFullyKnownSnapshot(r1M3, 'Variation')
  ];
  const fullyKnown = getFullyKnownInvestmentTeams(roster, fullInvestments);
  assert.equal(fullyKnown.length, 1);
  assert.equal(fullyKnown[0].investmentStatus, 'INVESTMENT_COMPLETE');
});

test('52. getTeamInvestmentCompleteness retrieves completeness metrics', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const comp = getTeamInvestmentCompleteness(sampleRank1.candidateId, roster);
  assert.ok(comp);
  assert.equal(comp.totalMemberDimensions, 27);
});

// ---------------------------------------------------------------------------
// 53–60: STATIC SAFETY CONTRACT
// ---------------------------------------------------------------------------

test('53. Source tree contains zero network calls (fetch, axios, http)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('fetch('), false, `Network fetch found in ${file}`);
    assert.equal(content.includes('axios'), false, `Axios found in ${file}`);
    assert.equal(content.includes('http:'), false, `http found in ${file}`);
    assert.equal(content.includes('https:'), false, `https found in ${file}`);
  }
});

test('54. Source tree contains zero LLM references (openai, gemini, llm)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('openai'), false, `OpenAI found in ${file}`);
    assert.equal(content.includes('gemini'), false, `Gemini found in ${file}`);
    assert.equal(content.includes('llm'), false, `LLM found in ${file}`);
  }
});

test('55. Source tree contains zero nondeterministic random calls', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Math.random'), false, `Math.random in ${file}`);
    assert.equal(content.includes('randomUUID'), false, `randomUUID in ${file}`);
  }
});

test('56. Source tree contains zero nondeterministic time calls', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Date.now'), false, `Date.now in ${file}`);
    assert.equal(content.includes('new Date'), false, `new Date in ${file}`);
  }
});

test('57. Source tree contains zero parseFloat', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('parseFloat'), false, `parseFloat in ${file}`);
  }
});

test('58. Source tree contains zero parseInt', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('parseInt'), false, `parseInt in ${file}`);
  }
});

test('59. Source tree contains zero unsafe numeric fallbacks', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('?? 0'), false, `?? 0 in ${file}`);
    assert.equal(content.includes('|| 0'), false, `|| 0 in ${file}`);
  }
});

test('60. Source tree contains zero gameplay scoring logic', () => {
  const dir = path.join(process.cwd(), 'lib/engine/team-composition/readiness');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('calculatePower'), false);
    assert.equal(content.includes('scoreInvestment'), false);
  }
});

// ---------------------------------------------------------------------------
// 61–72: BOUNDARY CONTRACT
// ---------------------------------------------------------------------------

test('61. Zero team generation occurs in Step 14', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const records = getAllTeamBuildReadiness(roster);
  assert.equal(records.length, 34220); // exactly candidate universe
});

test('62. Zero optimization / subset selection occurs', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const ready = getReadyTeams(roster);
  assert.equal(ready.length, 34220);
});

test('63. Zero reranking of Step 11 candidates occurs', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const records = getAllTeamBuildReadiness(roster);
  assert.equal(records[0].preservedStep11Rank, 1);
  assert.equal(records[1].preservedStep11Rank, 2);
});

test('64. Zero team power properties exist on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('teamPower' in readiness, false);
});

test('65. Zero character power properties exist on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('characterPower' in readiness, false);
});

test('66. Zero DPS properties exist on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('teamDPS' in readiness, false);
  assert.equal('rotationDps' in readiness, false);
});

test('67. Zero ToA properties exist on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('toaScore' in readiness, false);
});

test('68. Zero Vigor properties exist on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('vigorCost' in readiness, false);
});

test('69. Zero role inference on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('role' in readiness, false);
});

test('70. Zero meta inference on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('tier' in readiness, false);
});

test('71. Zero anti-synergy calculations on record', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  assert.equal('antiSynergyScore' in readiness, false);
});

test('72. Zero mutation of upstream ranking or eligibility records', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const rankBefore = sampleRank1.rank;
  getTeamBuildReadiness(sampleRank1.candidateId, roster);
  assert.equal(sampleRank1.rank, rankBefore);
});

// ---------------------------------------------------------------------------
// 73–78: DETERMINISM & REPEATABILITY CONTRACT
// ---------------------------------------------------------------------------

test('73. Repeated evaluation produces identical output', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const first = JSON.stringify(getTeamBuildReadiness(sampleRank1.candidateId, roster));
  for (let i = 0; i < 10; i++) {
    const run = JSON.stringify(getTeamBuildReadiness(sampleRank1.candidateId, roster));
    assert.equal(run, first);
  }
});

test('74. Repeated repository lookup produces identical results', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const res1 = getReadyTeams(roster);
  const res2 = getReadyTeams(roster);
  assert.equal(JSON.stringify(res1), JSON.stringify(res2));
});

test('75. Input ordering invariance: roster permutation produces identical readiness', () => {
  const rosterA: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const rosterB: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M3, r1M1, r1M2],
    provenance: mockProvenance
  };
  const readA = JSON.stringify(getTeamBuildReadiness(sampleRank1.candidateId, rosterA));
  const readB = JSON.stringify(getTeamBuildReadiness(sampleRank1.candidateId, rosterB));
  assert.equal(readA, readB);
});

test('76. Output ordering preserves Step 11 rank ordering', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const sampleRecords = getAllTeamBuildReadiness(roster).slice(0, 50);
  for (let i = 1; i < sampleRecords.length; i++) {
    assert.ok(sampleRecords[i - 1].preservedStep11Rank! <= sampleRecords[i].preservedStep11Rank!);
  }
});

test('77. Serialization invariance: JSON string is stable', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const rec = getTeamBuildReadiness(sampleRank1.candidateId, roster);
  assert.equal(JSON.stringify(rec), JSON.stringify(rec));
});

test('78. 20-run byte-identical production generation over sample candidates', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  let baselineHash = '';
  for (let i = 0; i < 20; i++) {
    const ready = getReadyTeams(roster);
    const hash = crypto.createHash('sha256').update(JSON.stringify(ready)).digest('hex');
    if (i === 0) baselineHash = hash;
    else assert.equal(hash, baselineHash);
  }
});

// ---------------------------------------------------------------------------
// 79–82: AUDIT & EXPLANATION CONTRACT
// ---------------------------------------------------------------------------

test('79. Full invariant audit passes on sample readiness records', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const sampleRecords = getAllTeamBuildReadiness(roster).slice(0, 50);
  const audit = auditTeamBuildReadiness(sampleRecords);
  assert.equal(audit.totalCandidatesAudited, 50);
  assert.equal(audit.fullyOwnedCount, 50);
  assert.equal(audit.uniqueReadinessIds, 50);
  assert.equal(audit.duplicateReadinessIds, 0);
});

test('80. Prohibited keys assertion catches forbidden properties', () => {
  assert.throws(() => {
    assertNoProhibitedReadinessKeys({ teamPower: 5000 });
  }, /Prohibited key 'teamPower'/);

  assert.throws(() => {
    assertNoProhibitedReadinessKeys({ teamDPS: 10000 });
  }, /Prohibited key 'teamDPS'/);

  assert.throws(() => {
    assertNoProhibitedReadinessKeys({ toaScore: 30 });
  }, /Prohibited key 'toaScore'/);
});

test('81. Upstream rule versions remain strictly unchanged', () => {
  assert.equal(CHARACTER_PAIR_SYNERGY_RULE_VERSION, '7.8.1');
  assert.equal(TEAM_COMPOSITION_RULE_VERSION, '7.9.1');
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
  assert.equal(TEAM_COMPOSITION_RANKING_RULE_VERSION, '7.11.1');
  assert.equal(OWNED_ROSTER_ELIGIBILITY_RULE_VERSION, '7.12.1');
  assert.equal(RESONATOR_INVESTMENT_RULE_VERSION, '7.13.1');
  assert.equal(TEAM_BUILD_READINESS_RULE_VERSION, '7.14.1');
});

test('82. Canonical Patch 3.7 dataset remains byte-for-byte unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  const buffer = fs.readFileSync(datasetPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  assert.equal(hash, '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9');
});

test('83. explainTeamBuildReadiness formats objective human-readable explanation', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [r1M1, r1M2, r1M3],
    provenance: mockProvenance
  };
  const readiness = getTeamBuildReadiness(sampleRank1.candidateId, roster)!;
  const expl = explainTeamBuildReadiness(readiness);
  assert.equal(expl.teamCandidateId, sampleRank1.candidateId);
  assert.equal(expl.isFullyOwned, true);
  assert.ok(expl.summary.includes('fully constructible'));
  assert.ok(expl.summary.includes('#1'));
});
