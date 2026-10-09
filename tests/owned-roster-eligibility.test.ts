/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Test Suite
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Strict validation and verification covering:
 * - Roster normalization & canonicalization
 * - Strict patch isolation & unknown ID fail-closed
 * - Exact 3-member ownership predicate
 * - Step 11 rank and score immutability (ZERO recalculation/reranking)
 * - UNRANKABLE candidate preservation
 * - Permutation invariance
 * - Upstream provenance preservation
 * - Repository query APIs and filter determinism
 * - Metrics reconciliation across full candidate space (34,220)
 * - Fixtures: empty, 1-character, 2-character, 3-character, full 60-character
 * - Static safety & determinism (20 repeated runs byte-for-byte identical)
 * - Upstream rule version immutability (7.8.1, 7.9.1, 7.10.1, 7.11.1, 7.12.1)
 * - Canonical dataset SHA-256 integrity
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  OWNED_ROSTER_ELIGIBILITY_RULE_VERSION,
  ROSTER_EXPLANATION_CODES,
  EMPTY_ROSTER_ELIGIBILITY_PROVENANCE,
  deriveTeamCompositionEligibilityId,
  normalizeOwnedRoster,
  compareTeamCompositionRosterEligibility,
  isEligibleCandidate,
  isPartiallyOwnedCandidate,
  isNotOwnedCandidate,
  matchesTeamCompositionEligibilityFilter,
  evaluateCandidateRosterEligibility,
  evaluateRosterEligibility,
  getEligibility,
  getAllCandidateEligibilities,
  getEligibleCandidates,
  getIneligibleCandidates,
  getEligibleRankedCandidates,
  getEligibilitySummary,
  auditTeamCompositionRosterEligibility,
  assertNoProhibitedRosterKeys,
  PROHIBITED_KEYS_ON_ROSTER,
  explainTeamCompositionRosterEligibility
} from '../lib/engine/roster/index.ts';

import type {
  OwnedRosterSnapshot,
  TeamCompositionRosterEligibility
} from '../lib/engine/roster/types.ts';

import {
  getTeamCompositionRankings,
  getRankingById,
  getRankingByCandidateId
} from '../lib/engine/team-composition/ranking/repository.ts';
import { getKnownResonatorIds } from '../lib/engine/team-composition/repository.ts';
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../lib/engine/relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../lib/engine/team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../lib/engine/team-composition/evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../lib/engine/team-composition/ranking/rules.ts';

const mockProvenance = Object.freeze({
  entityId: 'TEST_USER',
  entityName: 'Test User Roster',
  sourceType: 'RESONATOR_ABILITY' as const,
  sourceCode: 'TEST_ROSTER',
  patchVersion: '3.7',
  sourceProvenance: 'test_roster_snapshot',
  originalDescription: 'Test roster snapshot description'
});

const allResonators = getKnownResonatorIds();

// ---------------------------------------------------------------------------
// 1–10: ROSTER NORMALIZATION & CANONICALIZATION CONTRACT
// ---------------------------------------------------------------------------

test('1. Valid roster is accepted and canonicalized', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'Mortefi', 'Verina'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster);
  assert.equal(normalized.isValid, true);
  assert.deepEqual(normalized.canonicalOwnedIds, ['Jiyan', 'Mortefi', 'Verina']);
  assert.equal(normalized.ownedIdSet.has('Jiyan'), true);
  assert.equal(normalized.ownedIdSet.has('Mortefi'), true);
  assert.equal(normalized.ownedIdSet.has('Verina'), true);
  assert.equal(normalized.ownedIdSet.has('Calcharo'), false);
});

test('2. Empty roster is accepted as valid', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster);
  assert.equal(normalized.isValid, true);
  assert.equal(normalized.canonicalOwnedIds.length, 0);
  assert.equal(normalized.ownedIdSet.size, 0);
  assert.equal(normalized.invalidIds.length, 0);
});

test('3. Duplicate IDs are handled deterministically via deduplication', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'Mortefi', 'Jiyan', 'Verina', 'Mortefi', 'Jiyan'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster);
  assert.equal(normalized.isValid, true);
  assert.equal(normalized.canonicalOwnedIds.length, 3);
  assert.deepEqual(normalized.canonicalOwnedIds, ['Jiyan', 'Mortefi', 'Verina']);
});

test('4. Unknown Resonator ID is rejected and fails closed', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'UnknownHero', 'Verina'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster);
  assert.equal(normalized.isValid, false);
  assert.equal(normalized.canonicalOwnedIds.length, 0);
  assert.equal(normalized.ownedIdSet.size, 0);
  assert.deepEqual(normalized.invalidIds, ['UnknownHero']);
  assert.ok(normalized.validationError?.includes('UnknownHero'));
});

test('5. Malformed/empty Resonator ID is rejected and fails closed', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', '', '   ', 'Verina'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster);
  assert.equal(normalized.isValid, false);
  assert.ok(normalized.invalidIds.length > 0);
});

test('6. Canonical ordering is sorted deterministically via localeCompare', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Yinlin', 'Calcharo', 'Baizhi', 'Aalto'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster);
  assert.equal(normalized.isValid, true);
  assert.deepEqual(normalized.canonicalOwnedIds, ['Aalto', 'Baizhi', 'Calcharo', 'Yinlin']);
});

test('7. Input order invariance: permutations produce identical canonical snapshot', () => {
  const roster1: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Verina', 'Jiyan', 'Mortefi'],
    provenance: mockProvenance
  };
  const roster2: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Mortefi', 'Verina', 'Jiyan'],
    provenance: mockProvenance
  };
  const norm1 = normalizeOwnedRoster(roster1);
  const norm2 = normalizeOwnedRoster(roster2);
  assert.deepEqual(norm1.canonicalOwnedIds, norm2.canonicalOwnedIds);
});

test('8. Patch 3.7 is accepted', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster);
  assert.equal(normalized.isValid, true);
  assert.equal(normalized.patchVersion, '3.7');
});

test('9. Wrong patch version is rejected and fails closed', () => {
  const roster = {
    patchVersion: '3.8' as const,
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster as unknown as OwnedRosterSnapshot);
  assert.equal(normalized.isValid, false);
  assert.ok(normalized.validationError?.includes('Patch mismatch'));
});

test('10. Cross-patch isolation: non-3.7 patch string fails closed', () => {
  const roster = {
    patchVersion: '1.0' as const,
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const normalized = normalizeOwnedRoster(roster as unknown as OwnedRosterSnapshot);
  assert.equal(normalized.isValid, false);
});

// ---------------------------------------------------------------------------
// 11–18: ELIGIBILITY PREDICATE & MEMBERSHIP CONTRACT
// ---------------------------------------------------------------------------

test('11. All 3 members owned → ELIGIBLE and isEligible = true', () => {
  const rankings = getTeamCompositionRankings();
  const sampleRanking = rankings.find((r) => r.rankingStatus === 'RANKED')!;
  const [m1, m2, m3] = sampleRanking.memberResonatorIds;

  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [m1, m2, m3],
    provenance: mockProvenance
  };
  const norm = normalizeOwnedRoster(roster);
  const eligibility = evaluateCandidateRosterEligibility(sampleRanking, norm);

  assert.equal(eligibility.eligibilityStatus, 'ELIGIBLE');
  assert.equal(eligibility.isEligible, true);
  assert.equal(eligibility.ownedMemberResonatorIds.length, 3);
  assert.equal(eligibility.missingMemberResonatorIds.length, 0);
  assert.ok(eligibility.explanationCodes.includes(ROSTER_EXPLANATION_CODES.ROSTER_ELIGIBLE_ALL_MEMBERS_OWNED));
});

test('12. Exactly 2 members owned → PARTIALLY_OWNED and isEligible = false', () => {
  const rankings = getTeamCompositionRankings();
  const sampleRanking = rankings.find((r) => r.rankingStatus === 'RANKED')!;
  const [m1, m2] = sampleRanking.memberResonatorIds;

  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [m1, m2],
    provenance: mockProvenance
  };
  const norm = normalizeOwnedRoster(roster);
  const eligibility = evaluateCandidateRosterEligibility(sampleRanking, norm);

  assert.equal(eligibility.eligibilityStatus, 'PARTIALLY_OWNED');
  assert.equal(eligibility.isEligible, false);
  assert.equal(eligibility.ownedMemberResonatorIds.length, 2);
  assert.equal(eligibility.missingMemberResonatorIds.length, 1);
});

test('13. Exactly 1 member owned → PARTIALLY_OWNED and isEligible = false', () => {
  const rankings = getTeamCompositionRankings();
  const sampleRanking = rankings.find((r) => r.rankingStatus === 'RANKED')!;
  const [m1] = sampleRanking.memberResonatorIds;

  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [m1],
    provenance: mockProvenance
  };
  const norm = normalizeOwnedRoster(roster);
  const eligibility = evaluateCandidateRosterEligibility(sampleRanking, norm);

  assert.equal(eligibility.eligibilityStatus, 'PARTIALLY_OWNED');
  assert.equal(eligibility.isEligible, false);
  assert.equal(eligibility.ownedMemberResonatorIds.length, 1);
  assert.equal(eligibility.missingMemberResonatorIds.length, 2);
});

test('14. Zero members owned → NOT_OWNED and isEligible = false', () => {
  const rankings = getTeamCompositionRankings();
  const sampleRanking = rankings.find((r) => r.rankingStatus === 'RANKED')!;

  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const norm = normalizeOwnedRoster(roster);
  const eligibility = evaluateCandidateRosterEligibility(sampleRanking, norm);

  assert.equal(eligibility.eligibilityStatus, 'NOT_OWNED');
  assert.equal(eligibility.isEligible, false);
  assert.equal(eligibility.ownedMemberResonatorIds.length, 0);
  assert.equal(eligibility.missingMemberResonatorIds.length, 3);
  assert.ok(eligibility.explanationCodes.includes(ROSTER_EXPLANATION_CODES.ROSTER_NONE_OWNED));
});

test('15. Missing first member correctly identified in missingMemberResonatorIds', () => {
  const rankings = getTeamCompositionRankings();
  const sample = rankings[0];
  const [, m2, m3] = sample.memberResonatorIds;

  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: [m2, m3],
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(sample, norm);
  assert.deepEqual(eligibility.missingMemberResonatorIds, [sample.memberResonatorIds[0]]);
  assert.equal(eligibility.isEligible, false);
});

test('16. Missing second member correctly identified in missingMemberResonatorIds', () => {
  const rankings = getTeamCompositionRankings();
  const sample = rankings[0];
  const [m1, , m3] = sample.memberResonatorIds;

  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: [m1, m3],
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(sample, norm);
  assert.deepEqual(eligibility.missingMemberResonatorIds, [sample.memberResonatorIds[1]]);
  assert.equal(eligibility.isEligible, false);
});

test('17. Missing third member correctly identified in missingMemberResonatorIds', () => {
  const rankings = getTeamCompositionRankings();
  const sample = rankings[0];
  const [m1, m2] = sample.memberResonatorIds;

  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: [m1, m2],
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(sample, norm);
  assert.deepEqual(eligibility.missingMemberResonatorIds, [sample.memberResonatorIds[2]]);
  assert.equal(eligibility.isEligible, false);
});

test('18. All members missing identifies all 3 in missingMemberResonatorIds', () => {
  const rankings = getTeamCompositionRankings();
  const sample = rankings[0];

  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(sample, norm);
  assert.deepEqual(eligibility.missingMemberResonatorIds, sample.memberResonatorIds);
  assert.equal(eligibility.isEligible, false);
});

// ---------------------------------------------------------------------------
// 19–26: STEP 11 RANK & SCORE PRESERVATION CONTRACT
// ---------------------------------------------------------------------------

test('19. Step 11 rank is copied exactly from upstream ranking', () => {
  const rankings = getTeamCompositionRankings();
  const rank1 = rankings[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: rank1.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(rank1, norm);
  assert.equal(eligibility.step11Rank, 1);
  assert.equal(eligibility.step11Rank, rank1.rank);
});

test('20. Step 11 totalScore is copied exactly from upstream ranking', () => {
  const rankings = getTeamCompositionRankings();
  const rank1 = rankings[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: rank1.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(rank1, norm);
  assert.equal(eligibility.step11TotalScore, rank1.totalScore);
});

test('21. RANKED status is preserved exactly', () => {
  const rankings = getTeamCompositionRankings();
  const ranked = rankings.find((r) => r.rankingStatus === 'RANKED')!;
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: ranked.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(ranked, norm);
  assert.equal(eligibility.step11RankingStatus, 'RANKED');
});

test('22. UNRANKABLE status is preserved exactly', () => {
  const rankings = getTeamCompositionRankings();
  const unrankable = rankings.find((r) => r.rankingStatus === 'UNRANKABLE')!;
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: unrankable.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(unrankable, norm);
  assert.equal(eligibility.step11RankingStatus, 'UNRANKABLE');
});

test('23. Null rank is preserved exactly for unrankable candidate', () => {
  const rankings = getTeamCompositionRankings();
  const unrankable = rankings.find((r) => r.rankingStatus === 'UNRANKABLE')!;
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: unrankable.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(unrankable, norm);
  assert.equal(eligibility.step11Rank, null);
});

test('24. Null score is preserved exactly for unrankable candidate', () => {
  const rankings = getTeamCompositionRankings();
  const unrankable = rankings.find((r) => r.rankingStatus === 'UNRANKABLE')!;
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: unrankable.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(unrankable, norm);
  assert.equal(eligibility.step11TotalScore, null);
});

test('25. No reranking occurs when filtering candidates by roster', () => {
  const rankings = getTeamCompositionRankings();
  // Take rank 5 and rank 10
  const r5 = rankings.find((r) => r.rank === 5)!;
  const r10 = rankings.find((r) => r.rank === 10)!;

  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [...r5.memberResonatorIds, ...r10.memberResonatorIds],
    provenance: mockProvenance
  };

  const eligibleRanked = getEligibleRankedCandidates(roster);
  const foundR5 = eligibleRanked.find((e) => e.candidateId === r5.candidateId);
  const foundR10 = eligibleRanked.find((e) => e.candidateId === r10.candidateId);

  assert.ok(foundR5);
  assert.ok(foundR10);
  assert.equal(foundR5.step11Rank, 5);
  assert.equal(foundR10.step11Rank, 10);
  // Must NOT be re-indexed to 1 and 2!
});

test('26. No score recalculation occurs during eligibility evaluation', () => {
  const rankings = getTeamCompositionRankings();
  const r1 = rankings[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: r1.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(r1, norm);
  assert.equal(eligibility.step11TotalScore, r1.totalScore);
});

// ---------------------------------------------------------------------------
// 27–30: CANDIDATE IDENTITY & PERMUTATION INVARIANCE CONTRACT
// ---------------------------------------------------------------------------

test('27. Canonical team identity matches Step 9 canonical unordered triple', () => {
  const rankings = getTeamCompositionRankings();
  const r = rankings[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: r.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(r, norm);
  assert.deepEqual(eligibility.memberResonatorIds, r.memberResonatorIds);
  assert.equal(eligibility.candidateId, r.candidateId);
});

test('28. Permutations of member IDs resolve to the same canonical candidate', () => {
  const rankings = getTeamCompositionRankings();
  const r = rankings[0];
  const [a, b, c] = r.memberResonatorIds;

  const permutations = [
    [a, b, c],
    [a, c, b],
    [b, a, c],
    [b, c, a],
    [c, a, b],
    [c, b, a]
  ];

  for (const p of permutations) {
    const norm = normalizeOwnedRoster({
      patchVersion: '3.7',
      ownedResonatorIds: p,
      provenance: mockProvenance
    });
    const eligibility = evaluateCandidateRosterEligibility(r, norm);
    assert.equal(eligibility.candidateId, r.candidateId);
    assert.equal(eligibility.isEligible, true);
    assert.equal(eligibility.eligibilityStatus, 'ELIGIBLE');
  }
});

test('29. No duplicate eligibility records produced across enumeration', () => {
  const rankings = getTeamCompositionRankings().slice(0, 100);
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  });
  const eligibilities = rankings.map((r) => evaluateCandidateRosterEligibility(r, norm));
  const ids = new Set(eligibilities.map((e) => e.id));
  assert.equal(ids.size, eligibilities.length);
});

test('30. Candidate ID is preserved exactly', () => {
  const rankings = getTeamCompositionRankings();
  const r = rankings[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: r.memberResonatorIds,
    provenance: mockProvenance
  });
  const eligibility = evaluateCandidateRosterEligibility(r, norm);
  assert.equal(eligibility.candidateId, r.candidateId);
});

// ---------------------------------------------------------------------------
// 31–36: UPSTREAM LINEAGE & PROVENANCE PRESERVATION CONTRACT
// ---------------------------------------------------------------------------

test('31. candidateId is preserved from upstream ranking', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({ patchVersion: '3.7', ownedResonatorIds: [], provenance: mockProvenance });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.equal(e.candidateId, r.candidateId);
});

test('32. rankingId is preserved from upstream ranking', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({ patchVersion: '3.7', ownedResonatorIds: [], provenance: mockProvenance });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.equal(e.rankingId, r.id);
});

test('33. evaluationId is preserved from upstream ranking', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({ patchVersion: '3.7', ownedResonatorIds: [], provenance: mockProvenance });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.equal(e.evaluationId, r.evaluationId);
});

test('34. evidenceIds are preserved from upstream ranking', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({ patchVersion: '3.7', ownedResonatorIds: [], provenance: mockProvenance });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.deepEqual(e.evidenceIds, r.evidenceIds);
});

test('35. relationshipIds are preserved from upstream ranking', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({ patchVersion: '3.7', ownedResonatorIds: [], provenance: mockProvenance });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.deepEqual(e.relationshipIds, r.relationshipIds);
});

test('36. sourceFactIds are preserved from upstream ranking', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({ patchVersion: '3.7', ownedResonatorIds: [], provenance: mockProvenance });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.deepEqual(e.sourceFactIds, r.sourceFactIds);
});

// ---------------------------------------------------------------------------
// 37–40: STATUS GATING & FAIL-CLOSED BOUNDARIES
// ---------------------------------------------------------------------------

test('37. Invalid roster fails closed with INVALID_ROSTER and isEligible = false', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: ['InvalidResonator'],
    provenance: mockProvenance
  });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.equal(e.eligibilityStatus, 'INVALID_ROSTER');
  assert.equal(e.isEligible, false);
  assert.ok(e.explanationCodes.includes(ROSTER_EXPLANATION_CODES.ROSTER_INVALID));
});

test('38. Patch mismatch fails closed with PATCH_MISMATCH and isEligible = false', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.8' as unknown as '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  });
  const e = evaluateCandidateRosterEligibility(r, norm);
  assert.equal(e.eligibilityStatus, 'PATCH_MISMATCH');
  assert.equal(e.isEligible, false);
  assert.ok(e.explanationCodes.includes(ROSTER_EXPLANATION_CODES.ROSTER_PATCH_MISMATCH));
});

test('39. Invalid candidate reference fails gracefully in getEligibility', () => {
  const result = getEligibility('non-existent-candidate-id', {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  });
  assert.equal(result, undefined);
});

test('40. Unrankable fully-owned candidate remains ELIGIBLE but step11RankingStatus is UNRANKABLE', () => {
  const rankings = getTeamCompositionRankings();
  const unrankable = rankings.find((r) => r.rankingStatus === 'UNRANKABLE')!;
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: unrankable.memberResonatorIds,
    provenance: mockProvenance
  });
  const e = evaluateCandidateRosterEligibility(unrankable, norm);

  assert.equal(e.eligibilityStatus, 'ELIGIBLE');
  assert.equal(e.isEligible, true);
  assert.equal(e.step11RankingStatus, 'UNRANKABLE');
  assert.equal(e.step11Rank, null);
  assert.equal(e.step11TotalScore, null);
  assert.ok(e.explanationCodes.includes(ROSTER_EXPLANATION_CODES.STEP11_UNRANKABLE_PRESERVED));
});

// ---------------------------------------------------------------------------
// 41–47: REPOSITORY QUERY APIS & ORDER PRESERVATION
// ---------------------------------------------------------------------------

test('41. getEligibility returns correct record for valid candidate ID', () => {
  const r = getTeamCompositionRankings()[0];
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: r.memberResonatorIds,
    provenance: mockProvenance
  };
  const result = getEligibility(r.candidateId, roster);
  assert.ok(result);
  assert.equal(result.candidateId, r.candidateId);
  assert.equal(result.isEligible, true);
});

test('42. getEligibleCandidates returns only isEligible === true', () => {
  const r = getTeamCompositionRankings()[0];
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: r.memberResonatorIds,
    provenance: mockProvenance
  };
  const eligible = getEligibleCandidates(roster);
  assert.ok(eligible.length >= 1);
  for (const e of eligible) {
    assert.equal(e.isEligible, true);
    assert.equal(e.eligibilityStatus, 'ELIGIBLE');
  }
});

test('43. getIneligibleCandidates returns only isEligible === false', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const ineligible = getIneligibleCandidates(roster);
  assert.ok(ineligible.length > 0);
  for (const e of ineligible) {
    assert.equal(e.isEligible, false);
  }
});

test('44. getEligibilitySummary produces consistent summary metrics', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'Mortefi', 'Verina'],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.totalCandidates, 34220);
  assert.equal(summary.eligibleCandidates, 1);
  assert.equal(summary.partiallyOwnedCandidates, 4959);
  assert.equal(summary.notOwnedCandidates, 29260);
  assert.equal(
    summary.eligibleCandidates + summary.partiallyOwnedCandidates + summary.notOwnedCandidates,
    34220
  );
});

test('45. getEligibleRankedCandidates preserves Step 11 rank order without gaps removed', () => {
  const rankings = getTeamCompositionRankings();
  const r1 = rankings[0];
  const r3 = rankings[2];

  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [...r1.memberResonatorIds, ...r3.memberResonatorIds],
    provenance: mockProvenance
  };

  const eligibleRanked = getEligibleRankedCandidates(roster);
  const foundR1 = eligibleRanked.find((e) => e.candidateId === r1.candidateId);
  const foundR3 = eligibleRanked.find((e) => e.candidateId === r3.candidateId);

  assert.ok(foundR1);
  assert.ok(foundR3);
  assert.equal(foundR1.step11Rank, 1);
  assert.equal(foundR3.step11Rank, 3);
  assert.ok(foundR1.step11Rank! < foundR3.step11Rank!);
});

test('46. Filtering preserves Step 11 ordering across candidates', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const allEligible = getEligibleRankedCandidates(roster);
  for (let i = 1; i < allEligible.length; i++) {
    assert.ok(allEligible[i - 1].step11Rank! <= allEligible[i].step11Rank!);
  }
});

test('47. Pagination/filter determinism: filtering by resonatorId works predictably', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'Mortefi', 'Verina'],
    provenance: mockProvenance
  };
  const filtered = getAllCandidateEligibilities(roster, { resonatorId: 'Jiyan' });
  for (const item of filtered) {
    assert.ok(item.memberResonatorIds.includes('Jiyan'));
  }
});

// ---------------------------------------------------------------------------
// 48–53: PRODUCTION METRICS & RECONCILIATION CONTRACT
// ---------------------------------------------------------------------------

test('48. Candidate count reconciles to exactly 34,220 across full space', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.totalCandidates, 34220);
});

test('49. Eligible count is 0 for empty roster', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.eligibleCandidates, 0);
});

test('50. Partial count for single-character roster matches C(59, 2) = 1,711', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.partiallyOwnedCandidates, 1711);
});

test('51. Not-owned count for single-character roster matches 34,220 - 1,711 = 32,509', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.notOwnedCandidates, 32509);
});

test('52. Ranked eligible count for full roster equals Step 11 totalRankableCount (10,095)', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.rankedEligibleCandidates, 10095);
});

test('53. Unrankable eligible count for full roster equals 34,220 - 10,095 = 24,125', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.unrankableEligibleCandidates, 24125);
});

// ---------------------------------------------------------------------------
// 54–58: STATIC SAFETY & CODE INTEGRITY CONTRACT
// ---------------------------------------------------------------------------

test('54. Source tree contains zero network calls (fetch, axios, http)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/roster');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('fetch('), false, `Network fetch found in ${file}`);
    assert.equal(content.includes('axios'), false, `Axios found in ${file}`);
    assert.equal(content.includes('http:'), false, `http found in ${file}`);
    assert.equal(content.includes('https:'), false, `https found in ${file}`);
  }
});

test('55. Source tree contains zero LLM references (openai, gemini, llm)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/roster');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('openai'), false, `OpenAI found in ${file}`);
    assert.equal(content.includes('gemini'), false, `Gemini found in ${file}`);
    assert.equal(content.includes('llm'), false, `LLM found in ${file}`);
  }
});

test('56. Source tree contains zero nondeterministic time/random calls', () => {
  const dir = path.join(process.cwd(), 'lib/engine/roster');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Math.random'), false, `Math.random in ${file}`);
    assert.equal(content.includes('Date.now'), false, `Date.now in ${file}`);
    assert.equal(content.includes('new Date'), false, `new Date in ${file}`);
    assert.equal(content.includes('randomUUID'), false, `randomUUID in ${file}`);
  }
});

test('57. Source tree contains zero numeric fallbacks (?? 0, || 0)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/roster');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('?? 0'), false, `?? 0 in ${file}`);
    assert.equal(content.includes('|| 0'), false, `|| 0 in ${file}`);
  }
});

test('58. Source tree contains zero raw parser bypass', () => {
  const dir = path.join(process.cwd(), 'lib/engine/roster');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('parseRaw'), false, `raw parser access in ${file}`);
    assert.equal(content.includes('raw_descriptions'), false, `raw descriptions in ${file}`);
  }
});

// ---------------------------------------------------------------------------
// 59–60: DETERMINISM & REPEATABILITY CONTRACT
// ---------------------------------------------------------------------------

test('59. Repeated execution: 20 repeated runs produce byte-for-byte identical output', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Augusta', 'Hiyuki', 'Suoming', 'Jiyan', 'Mortefi'],
    provenance: mockProvenance
  };

  const sampleRankings = getTeamCompositionRankings().slice(0, 50);
  const baseline = JSON.stringify(evaluateRosterEligibility(sampleRankings, roster));

  for (let i = 0; i < 20; i++) {
    const run = JSON.stringify(evaluateRosterEligibility(sampleRankings, roster));
    assert.equal(run, baseline, `Run ${i} was not identical to baseline`);
  }
});

test('60. Roster permutation invariance: input order does not alter output', () => {
  const rA: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Augusta', 'Hiyuki', 'Suoming'],
    provenance: mockProvenance
  };
  const rB: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Suoming', 'Augusta', 'Hiyuki'],
    provenance: mockProvenance
  };

  const sampleRankings = getTeamCompositionRankings().slice(0, 50);
  const runA = JSON.stringify(evaluateRosterEligibility(sampleRankings, rA));
  const runB = JSON.stringify(evaluateRosterEligibility(sampleRankings, rB));
  assert.equal(runA, runB);
});

// ---------------------------------------------------------------------------
// 61–65: FIXTURES VALIDATION CONTRACT
// ---------------------------------------------------------------------------

test('61. Empty roster fixture: ELIGIBLE = 0, PARTIALLY = 0, NOT_OWNED = 34,220', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.eligibleCandidates, 0);
  assert.equal(summary.partiallyOwnedCandidates, 0);
  assert.equal(summary.notOwnedCandidates, 34220);
});

test('62. Single-character roster fixture: ELIGIBLE = 0, PARTIALLY = 1,711, NOT_OWNED = 32,509', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.eligibleCandidates, 0);
  assert.equal(summary.partiallyOwnedCandidates, 1711);
  assert.equal(summary.notOwnedCandidates, 32509);
});

test('63. Two-character roster fixture: ELIGIBLE = 0, PARTIALLY = 3,364, NOT_OWNED = 30,856', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'Mortefi'],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.eligibleCandidates, 0);
  assert.equal(summary.partiallyOwnedCandidates, 3364);
  assert.equal(summary.notOwnedCandidates, 30856);
});

test('64. Three-character roster fixture: ELIGIBLE = 1, PARTIALLY = 4,959, NOT_OWNED = 29,260', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'Mortefi', 'Verina'],
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.eligibleCandidates, 1);
  assert.equal(summary.partiallyOwnedCandidates, 4959);
  assert.equal(summary.notOwnedCandidates, 29260);
});

test('65. Full 60-character roster fixture: ELIGIBLE = 34,220, PARTIALLY = 0, NOT_OWNED = 0', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const summary = getEligibilitySummary(roster);
  assert.equal(summary.eligibleCandidates, 34220);
  assert.equal(summary.partiallyOwnedCandidates, 0);
  assert.equal(summary.notOwnedCandidates, 0);
});

// ---------------------------------------------------------------------------
// 66–70: AUDIT & INVARIANTS CONTRACT
// ---------------------------------------------------------------------------

test('66. Production auditor passes Invariants A through AL on full roster', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const audit = auditTeamCompositionRosterEligibility(roster);
  assert.equal(audit.totalCandidates, 34220);
  assert.equal(audit.eligibleCount, 34220);
  assert.equal(audit.partiallyOwnedCount, 0);
  assert.equal(audit.notOwnedCount, 0);
  assert.equal(audit.rankedEligibleCount, 10095);
  assert.equal(audit.unrankableEligibleCount, 24125);
  assert.equal(audit.uniqueEligibilityIds, 34220);
  assert.equal(audit.duplicateEligibilityIds, 0);
});

test('67. Upstream rule versions remain strictly unchanged', () => {
  assert.equal(CHARACTER_PAIR_SYNERGY_RULE_VERSION, '7.8.1');
  assert.equal(TEAM_COMPOSITION_RULE_VERSION, '7.9.1');
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
  assert.equal(TEAM_COMPOSITION_RANKING_RULE_VERSION, '7.11.1');
  assert.equal(OWNED_ROSTER_ELIGIBILITY_RULE_VERSION, '7.12.1');
});

test('68. Canonical Patch 3.7 dataset remains byte-for-byte unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  const buffer = fs.readFileSync(datasetPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  assert.equal(hash, '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9');
});

test('69. explainTeamCompositionRosterEligibility produces human-readable explanation', () => {
  const r = getTeamCompositionRankings()[0];
  const norm = normalizeOwnedRoster({
    patchVersion: '3.7',
    ownedResonatorIds: r.memberResonatorIds,
    provenance: mockProvenance
  });
  const e = evaluateCandidateRosterEligibility(r, norm);
  const explanation = explainTeamCompositionRosterEligibility(e);

  assert.equal(explanation.isEligible, true);
  assert.equal(explanation.step11Rank, 1);
  assert.ok(explanation.summary.includes('fully eligible'));
  assert.ok(explanation.summary.includes('#1'));
});

test('70. Prohibited keys assertion catches forbidden properties', () => {
  assert.throws(() => {
    assertNoProhibitedRosterKeys({ teamPower: 9000 });
  }, /Prohibited key 'teamPower'/);

  assert.throws(() => {
    assertNoProhibitedRosterKeys({ metaRank: 1 });
  }, /Prohibited key 'metaRank'/);

  assert.throws(() => {
    assertNoProhibitedRosterKeys({ toaScore: 50 });
  }, /Prohibited key 'toaScore'/);
});
