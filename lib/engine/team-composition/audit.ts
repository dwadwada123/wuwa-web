/**
 * Wuthering Waves Team Composition Candidate Auditor
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Audits TeamCompositionCandidates against strict Invariants A through AH.
 * Validates deterministic IDs, order independence, exact cardinality, directional integrity,
 * absence of anti-synergy, zero team scoring, epistemic safety, patch isolation,
 * and upstream Step 8 lineage reconciliation.
 */

import { auditProductionCapabilities } from '../capabilities/builder.ts';
import { auditCharacterPairSynergyProfiles } from '../relationships/character-pairs/synergy/audit.ts';
import { getCharacterPairSynergyProfiles } from '../relationships/character-pairs/synergy/repository.ts';
import { getTeamCompositionCandidates, getKnownResonatorIds } from './repository.ts';
import {
  TEAM_COMPOSITION_RULE_VERSION,
  TEAM_MEMBER_COUNT,
  MIN_MATCHED_PAIRS_FOR_QUALIFICATION
} from './rules.ts';
import {
  canonicalizeTeamMembers,
  deriveTeamCompositionCandidateId
} from './predicates.ts';
import type {
  TeamCompositionCandidate,
  TeamCompositionQualificationType,
  CharacterPairSynergyCategory,
  ProductionTeamAuditMetrics
} from './types.ts';

/** Prohibited keys that MUST NEVER exist on a TeamCompositionCandidate */
const PROHIBITED_KEYS_ON_CANDIDATE: readonly string[] = [
  'characterPower',
  'characterStrength',
  'characterScore',
  'resonatorPower',
  'resonatorScore',
  'teamScore',
  'teamPower',
  'teamSynergy',
  'teamRanking',
  'bestTeam',
  'dpsScore',
  'damageGain',
  'teamDamageIncrease',
  'damageRanking',
  'metaRank',
  'tierList',
  'towerScore',
  'vigorScore',
  'antiSynergyScore',
  'conflictScore',
  'incompatibilityPenalty',
  'negativeSynergy',
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER',
  'BUFFER'
];

/**
 * Validates that an object contains zero prohibited property names or values.
 */
export function assertNoProhibitedKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_CANDIDATE) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Audits a collection of TeamCompositionCandidates against Invariants A through AH.
 */
export function auditTeamCompositionCandidates(
  candidatesInput?: readonly TeamCompositionCandidate[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = TEAM_COMPOSITION_RULE_VERSION
): ProductionTeamAuditMetrics {
  const capList = auditProductionCapabilities().capabilities;
  const step8Audit = auditCharacterPairSynergyProfiles();
  const step8Profiles = getCharacterPairSynergyProfiles();
  const knownResonators = getKnownResonatorIds();
  const knownResonatorIdSet = new Set(knownResonators);

  const totalResonators = knownResonators.length;
  // C(N, 3) = N * (N - 1) * (N - 2) / 6
  const theoreticalTriples = (totalResonators * (totalResonators - 1) * (totalResonators - 2)) / 6;

  // Index Step 8 profiles by pair key
  const step8ProfileMap = new Map<string, typeof step8Profiles[0]>();
  for (const p of step8Profiles) {
    step8ProfileMap.set(`${p.sourceResonatorId}:::${p.targetResonatorId}`, p);
  }

  const candidateList =
    candidatesInput ?? getTeamCompositionCandidates({ includeEmptyTriples: true });

  const seenCandidateIds = new Set<string>();
  const seenTriples = new Set<string>();
  let duplicateCandidateIds = 0;

  let qualifiedCount = 0;
  let partiallyQualifiedCount = 0;
  let contextDependentCount = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  let noPairwiseEvidenceCount = 0;

  const matchedPairCountDistribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const directionalEdgeCountDistribution: Record<number, number> = {};
  const independentEvidenceLineageCountDistribution: Record<number, number> = {};
  const synergyCategoryDistribution: Record<CharacterPairSynergyCategory, number> = {
    OFFENSIVE_SYNERGY: 0,
    ELEMENTAL_SYNERGY: 0,
    ACTION_SYNERGY: 0,
    TRANSITION_SYNERGY: 0,
    RESOURCE_SYNERGY: 0,
    DEFENSIVE_SYNERGY: 0,
    MECHANICAL_SYNERGY: 0,
    TARGETING_SYNERGY: 0,
    COORDINATED_ATTACK_SYNERGY: 0,
    NEXT_RESONATOR_SYNERGY: 0,
    INTRO_OUTRO_SYNERGY: 0
  };
  const qualificationTypeDistribution: Record<TeamCompositionQualificationType, number> = {
    TWO_PAIR_SYNERGY_EDGES: 0,
    THREE_PAIR_SYNERGY_EDGES: 0,
    DIRECTIONAL_SYNERGY_CHAIN: 0,
    MULTI_CATEGORY_PAIR_SUPPORT: 0,
    CONTEXTUAL_PAIR_SUPPORT: 0,
    UNMODELED_PAIR_SUPPORT: 0
  };

  let unidirectionalOnlyPairs = 0;
  let bidirectionalPairs = 0;

  for (const candidate of candidateList) {
    // Invariant U, S, T, V, W, X, Y: Prohibited keys check
    assertNoProhibitedKeys(candidate);

    // Invariant A: Patch version must be exactly 3.7
    if (candidate.patchVersion !== expectedPatch) {
      throw new Error(
        `Invariant A violation: Candidate '${candidate.id}' patchVersion '${candidate.patchVersion}' !== '${expectedPatch}'.`
      );
    }

    // Invariant: Rule version
    if (candidate.ruleVersion !== expectedRuleVersion) {
      throw new Error(
        `Rule version violation: Candidate '${candidate.id}' ruleVersion '${candidate.ruleVersion}' !== '${expectedRuleVersion}'.`
      );
    }

    // Invariant B: Exactly 3 members
    if (candidate.memberResonatorIds.length !== TEAM_MEMBER_COUNT) {
      throw new Error(
        `Invariant B violation: Candidate '${candidate.id}' has ${candidate.memberResonatorIds.length} members; expected ${TEAM_MEMBER_COUNT}.`
      );
    }

    const [a, b, c] = candidate.memberResonatorIds;

    // Invariant C: All members distinct
    if (a === b || b === c || a === c) {
      throw new Error(
        `Invariant C violation: Candidate '${candidate.id}' contains duplicate members: [${a}, ${b}, ${c}].`
      );
    }

    // Invariant D: All members exist in known Resonators
    if (!knownResonatorIdSet.has(a) || !knownResonatorIdSet.has(b) || !knownResonatorIdSet.has(c)) {
      throw new Error(
        `Invariant D violation: Candidate '${candidate.id}' contains unknown Resonator member.`
      );
    }

    // Invariant E & G: Canonical order & deterministic ID
    const canonicalMembers = canonicalizeTeamMembers([a, b, c]);
    if (a !== canonicalMembers[0] || b !== canonicalMembers[1] || c !== canonicalMembers[2]) {
      throw new Error(
        `Invariant E violation: Candidate '${candidate.id}' members [${a}, ${b}, ${c}] are not canonically sorted.`
      );
    }

    const expectedId = deriveTeamCompositionCandidateId(expectedPatch, [a, b, c], expectedRuleVersion);
    if (candidate.id !== expectedId) {
      throw new Error(
        `Invariant G violation: Candidate '${candidate.id}' ID mismatch; expected '${expectedId}'.`
      );
    }

    // Invariant F: Exactly one ID per canonical triple (deduplication)
    const tripleKey = `${a}:::${b}:::${c}`;
    if (seenTriples.has(tripleKey)) {
      duplicateCandidateIds++;
      throw new Error(`Invariant F violation: Duplicate canonical triple detected for '${tripleKey}'.`);
    }
    seenTriples.add(tripleKey);

    if (seenCandidateIds.has(candidate.id)) {
      duplicateCandidateIds++;
    }
    seenCandidateIds.add(candidate.id);

    // Invariant H: No UUID / random / timestamps
    if (
      candidate.id.includes('uuid') ||
      candidate.id.includes('null') ||
      candidate.id.includes('undefined') ||
      /\d{4}-\d{2}-\d{2}/.test(candidate.id)
    ) {
      throw new Error(`Invariant H violation: Suspicious non-deterministic candidate ID '${candidate.id}'.`);
    }

    // Invariants I, J, K, L: Directional edges integrity
    const memberSet = new Set([a, b, c]);
    for (const edge of candidate.directionalPairEdges) {
      if (!memberSet.has(edge.sourceResonatorId) || !memberSet.has(edge.targetResonatorId)) {
        throw new Error(
          `Invariant K violation: Edge '${edge.sourceResonatorId} -> ${edge.targetResonatorId}' refers to non-member in candidate '${candidate.id}'.`
        );
      }
      if (edge.sourceResonatorId === edge.targetResonatorId) {
        throw new Error(
          `Invariant C violation: Self-loop edge '${edge.sourceResonatorId}' in candidate '${candidate.id}'.`
        );
      }

      // Invariant I & J: Edge must match an authentic Step 8 profile
      const pairKey = `${edge.sourceResonatorId}:::${edge.targetResonatorId}`;
      const actualStep8Profile = step8ProfileMap.get(pairKey);
      if (!actualStep8Profile) {
        throw new Error(
          `Invariant I/J violation: Edge '${pairKey}' in candidate '${candidate.id}' has no matching Step 8 profile.`
        );
      }
      if (actualStep8Profile.synergyStatus !== edge.synergyStatus) {
        throw new Error(
          `Status drift: Edge '${pairKey}' status '${edge.synergyStatus}' !== Step 8 status '${actualStep8Profile.synergyStatus}'.`
        );
      }
    }

    // Invariant M & N & Directionality Accounting (Section 4)
    const pairsChecked = [
      [a, b], [a, c], [b, c]
    ];
    let candidateUni = 0;
    let candidateBi = 0;
    const seenEdgesInCandidate = new Set<string>();

    for (const edge of candidate.directionalPairEdges) {
      const edgeKey = `${edge.sourceResonatorId}:::${edge.targetResonatorId}`;
      if (seenEdgesInCandidate.has(edgeKey)) {
        throw new Error(
          `Invariant L violation: Duplicate directional profile '${edgeKey}' in candidate '${candidate.id}'.`
        );
      }
      seenEdgesInCandidate.add(edgeKey);
    }

    for (const [p1, p2] of pairsChecked) {
      const hasFwd = candidate.directionalPairEdges.some(
        (e) => e.sourceResonatorId === p1 && e.targetResonatorId === p2
      );
      const hasRev = candidate.directionalPairEdges.some(
        (e) => e.sourceResonatorId === p2 && e.targetResonatorId === p1
      );
      if (hasFwd && hasRev) {
        candidateBi++;
        bidirectionalPairs++;
      } else if (hasFwd || hasRev) {
        candidateUni++;
        unidirectionalOnlyPairs++;
      }
    }

    // Per-team mathematical invariants (Section 4)
    if (candidate.matchedPairCount !== candidateUni + candidateBi) {
      throw new Error(
        `Per-team invariant violation in '${candidate.id}': matchedPairCount (${candidate.matchedPairCount}) !== uni (${candidateUni}) + bi (${candidateBi}).`
      );
    }
    if (candidate.directionalEdgeCount !== candidateUni + 2 * candidateBi) {
      throw new Error(
        `Per-team invariant violation in '${candidate.id}': directionalEdgeCount (${candidate.directionalEdgeCount}) !== uni (${candidateUni}) + 2*bi (${candidateBi}).`
      );
    }
    if (candidate.matchedPairCount > 3) {
      throw new Error(`Per-team invariant violation: matchedPairCount > 3 in '${candidate.id}'.`);
    }
    if (candidate.directionalEdgeCount > 6) {
      throw new Error(`Per-team invariant violation: directionalEdgeCount > 6 in '${candidate.id}'.`);
    }

    // Invariant Z, AA, AB, AC: Status constraints
    if (candidate.qualificationStatus === 'QUALIFIED') {
      qualifiedCount++;
      if (candidate.matchedPairCount < MIN_MATCHED_PAIRS_FOR_QUALIFICATION) {
        throw new Error(
          `Structural qualification violation: Candidate '${candidate.id}' marked QUALIFIED with only ${candidate.matchedPairCount} matched pairs.`
        );
      }
    } else if (candidate.qualificationStatus === 'PARTIALLY_QUALIFIED') {
      partiallyQualifiedCount++;
      if (candidate.matchedPairCount < MIN_MATCHED_PAIRS_FOR_QUALIFICATION) {
        throw new Error(
          `Structural qualification violation: Candidate '${candidate.id}' marked PARTIALLY_QUALIFIED with only ${candidate.matchedPairCount} matched pairs.`
        );
      }
    } else if (candidate.qualificationStatus === 'CONTEXT_DEPENDENT') {
      contextDependentCount++;
      if (candidate.matchedPairCount < MIN_MATCHED_PAIRS_FOR_QUALIFICATION) {
        throw new Error(
          `Contextual qualification violation: Candidate '${candidate.id}' marked CONTEXT_DEPENDENT with only ${candidate.matchedPairCount} matched pairs.`
        );
      }
    } else if (candidate.qualificationStatus === 'UNMODELED') {
      unmodeledCount++;
    } else if (candidate.qualificationStatus === 'UNKNOWN') {
      unknownCount++;
    } else if (candidate.qualificationStatus === 'NOT_APPLICABLE') {
      notApplicableCount++;
    } else if (candidate.qualificationStatus === 'NO_PAIRWISE_EVIDENCE') {
      noPairwiseEvidenceCount++;
    }

    // Structural metrics distribution
    matchedPairCountDistribution[candidate.matchedPairCount] =
      (matchedPairCountDistribution[candidate.matchedPairCount] || 0) + 1;
    directionalEdgeCountDistribution[candidate.directionalEdgeCount] =
      (directionalEdgeCountDistribution[candidate.directionalEdgeCount] || 0) + 1;
    independentEvidenceLineageCountDistribution[candidate.independentEvidenceLineageCount] =
      (independentEvidenceLineageCountDistribution[candidate.independentEvidenceLineageCount] || 0) + 1;

    // Categories and qualification types distributions
    for (const cat of candidate.supportingSynergyCategories) {
      if (cat in synergyCategoryDistribution) {
        synergyCategoryDistribution[cat]++;
      }
    }
    for (const qType of candidate.qualificationTypes) {
      if (qType in qualificationTypeDistribution) {
        qualificationTypeDistribution[qType]++;
      }
    }
  }

  // Aggregate Mathematical Reconciliation (Section 3 & 6)
  const totalConnectedPairOccurrences = candidateList.reduce((acc, c) => acc + c.matchedPairCount, 0);
  const totalDirectionalEdges = candidateList.reduce((acc, c) => acc + c.directionalEdgeCount, 0);

  if (totalConnectedPairOccurrences !== unidirectionalOnlyPairs + bidirectionalPairs) {
    throw new Error(
      `Aggregate mathematical invariant violation: totalConnectedPairOccurrences (${totalConnectedPairOccurrences}) !== U (${unidirectionalOnlyPairs}) + B (${bidirectionalPairs}).`
    );
  }
  if (totalDirectionalEdges !== unidirectionalOnlyPairs + 2 * bidirectionalPairs) {
    throw new Error(
      `Aggregate mathematical invariant violation: totalDirectionalEdges (${totalDirectionalEdges}) !== U (${unidirectionalOnlyPairs}) + 2*B (${bidirectionalPairs}).`
    );
  }

  return Object.freeze({
    totalResonators,
    theoreticalTriples,
    triplesWithEvidence: candidateList.filter((c) => c.qualificationStatus !== 'NO_PAIRWISE_EVIDENCE').length,
    noEvidenceTriples: theoreticalTriples - candidateList.filter((c) => c.qualificationStatus !== 'NO_PAIRWISE_EVIDENCE').length,
    totalModeledCandidates: candidateList.filter((c) => c.qualificationStatus !== 'NO_PAIRWISE_EVIDENCE').length,
    totalMaterializedCandidates: candidateList.length,
    uniqueCandidateIds: seenCandidateIds.size,
    duplicateCandidateIds,
    qualifiedCount,
    partiallyQualifiedCount,
    contextDependentCount,
    unmodeledCount,
    unknownCount,
    notApplicableCount,
    noPairwiseEvidenceCount,
    totalConnectedPairOccurrences,
    totalDirectionalEdges,
    matchedPairCountDistribution: Object.freeze(matchedPairCountDistribution),
    directionalEdgeCountDistribution: Object.freeze(directionalEdgeCountDistribution),
    independentEvidenceLineageCountDistribution: Object.freeze(independentEvidenceLineageCountDistribution),
    synergyCategoryDistribution: Object.freeze(synergyCategoryDistribution),
    qualificationTypeDistribution: Object.freeze(qualificationTypeDistribution),
    directionalityStats: Object.freeze({
      unidirectionalOnlyPairs,
      bidirectionalPairs
    }),
    candidates: candidateList
  });
}
