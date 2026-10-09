/**
 * Wuthering Waves Deterministic Team Composition Candidate Generator
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Generates canonical, order-independent 3-character team composition candidates
 * from approved Step 8 CharacterPairSynergyProfiles.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. ZERO TEAM SCORES: No numeric score, rating, or power ranking is computed.
 * 2. EXACT CARDINALITY: Strictly 3 distinct Resonators.
 * 3. ORDER INDEPENDENCE: Canonical [minId, midId, maxId] member identity.
 * 4. DIRECTIONAL FIDELITY: Preserves A -> B distinct from B -> A in directional edges.
 * 5. NO TRANSITIVE INFERENCE: A -> B and B -> C does NOT create A -> C edge.
 * 6. NO ROLE MODELING: Zero DPS, Sub-DPS, Support, Healer, Buffer concepts.
 * 7. LINEAGE DEDUPLICATION: Multiple references to the same underlying fact or evidence
 *    never inflate independent lineage counts.
 */

import {
  TEAM_COMPOSITION_RULE_VERSION,
  TEAM_MEMBER_COUNT,
  MIN_MATCHED_PAIRS_FOR_QUALIFICATION,
  EMPTY_TEAM_PROVENANCE
} from './rules.ts';
import {
  canonicalizeTeamMembers,
  deriveTeamCompositionCandidateId,
  compareTeamCompositionCandidate
} from './predicates.ts';
import type {
  TeamCompositionCandidate,
  TeamDirectionalPairEdge,
  TeamApplicabilitySummary,
  TeamCompositionQualificationStatus,
  TeamCompositionQualificationType,
  TeamCompositionOptions,
  CharacterPairSynergyProfile,
  CharacterPairSynergyCategory,
  SourceReference
} from './types.ts';

/**
 * Deterministically sorts a collection of unique strings using localeCompare.
 */
function canonicalSortStrings(items: readonly string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b));
}

/**
 * Builds a fast lookup key for a directional pair.
 */
function makePairKey(sourceResonatorId: string, targetResonatorId: string): string {
  return `${sourceResonatorId}:::${targetResonatorId}`;
}

/**
 * Derives the Step 7 evidence profile ID from a Step 8 synergy profile.
 */
function deriveStep7EvidenceProfileId(
  sourceResonatorId: string,
  targetResonatorId: string,
  patchVersion: string = '3.7'
): string {
  return `pair-evidence:${patchVersion}:${sourceResonatorId}:${targetResonatorId}:7.7.1`;
}

/**
 * Generates a single TeamCompositionCandidate for three distinct Resonators.
 */
export function generateTeamCompositionCandidate(
  members: readonly string[],
  synergyProfilesOrMap: readonly CharacterPairSynergyProfile[] | Map<string, CharacterPairSynergyProfile>,
  options?: TeamCompositionOptions
): TeamCompositionCandidate {
  const [a, b, c] = canonicalizeTeamMembers(members);
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? TEAM_COMPOSITION_RULE_VERSION;
  const candidateId = deriveTeamCompositionCandidateId(patchVersion, [a, b, c], ruleVersion);

  // Build profile lookup map if an array was passed
  const pairMap: Map<string, CharacterPairSynergyProfile> =
    synergyProfilesOrMap instanceof Map
      ? synergyProfilesOrMap
      : new Map(synergyProfilesOrMap.map((p) => [makePairKey(p.sourceResonatorId, p.targetResonatorId), p]));

  // The 3 unordered pairs in canonical order
  const unorderedPairs: ReadonlyArray<readonly [string, string]> = Object.freeze([
    [a, b],
    [a, c],
    [b, c]
  ]);

  // Inspect the 6 possible directional pairings
  const directionalPairEdges: TeamDirectionalPairEdge[] = [];
  const pairSynergyProfileIds = new Set<string>();
  const pairEvidenceProfileIds = new Set<string>();
  const sourceFactIdSet = new Set<string>();
  const evidenceIdSet = new Set<string>();
  const relationshipIdSet = new Set<string>();
  const categorySet = new Set<CharacterPairSynergyCategory>();
  const contextReqSet = new Set<string>();

  let evaluatedPairCount = 0;
  let partiallyEvaluatedPairCount = 0;
  let contextDependentPairCount = 0;
  let unmodeledPairCount = 0;
  let unknownPairCount = 0;
  let notApplicablePairCount = 0;
  let noEvidencePairCount = 0;

  let matchedPairCount = 0;
  let primaryProvenance: SourceReference | null = null;

  for (const [r1, r2] of unorderedPairs) {
    const pForward = pairMap.get(makePairKey(r1, r2));
    const pReverse = pairMap.get(makePairKey(r2, r1));

    const sForward = pForward?.synergyStatus ?? 'NO_EVIDENCE';
    const sReverse = pReverse?.synergyStatus ?? 'NO_EVIDENCE';

    const forwardHasQualifying = Boolean(
      pForward &&
      (sForward === 'SYNERGY_SUPPORTED' ||
        sForward === 'PARTIAL_SYNERGY' ||
        sForward === 'CONTEXT_DEPENDENT' ||
        sForward === 'UNMODELED')
    );
    const reverseHasQualifying = Boolean(
      pReverse &&
      (sReverse === 'SYNERGY_SUPPORTED' ||
        sReverse === 'PARTIAL_SYNERGY' ||
        sReverse === 'CONTEXT_DEPENDENT' ||
        sReverse === 'UNMODELED')
    );

    // Record forward directional edge if qualifying
    if (pForward && forwardHasQualifying) {
      directionalPairEdges.push({
        sourceResonatorId: r1,
        targetResonatorId: r2,
        synergyProfileId: pForward.id,
        synergyStatus: pForward.synergyStatus,
        synergyCategories: pForward.positiveEvidenceTypes,
        evidenceIds: pForward.evidenceIds,
        relationshipIds: pForward.relationshipIds
      });
      pairSynergyProfileIds.add(pForward.id);
      pairEvidenceProfileIds.add(deriveStep7EvidenceProfileId(r1, r2, patchVersion));
      for (const id of pForward.sourceFactIds) sourceFactIdSet.add(id);
      for (const id of pForward.evidenceIds) evidenceIdSet.add(id);
      for (const id of pForward.relationshipIds) relationshipIdSet.add(id);
      for (const cat of pForward.positiveEvidenceTypes) categorySet.add(cat);
      for (const req of pForward.contextRequirements) contextReqSet.add(req);
      if (!primaryProvenance) primaryProvenance = pForward.provenance;
    }

    // Record reverse directional edge if qualifying
    if (pReverse && reverseHasQualifying) {
      directionalPairEdges.push({
        sourceResonatorId: r2,
        targetResonatorId: r1,
        synergyProfileId: pReverse.id,
        synergyStatus: pReverse.synergyStatus,
        synergyCategories: pReverse.positiveEvidenceTypes,
        evidenceIds: pReverse.evidenceIds,
        relationshipIds: pReverse.relationshipIds
      });
      pairSynergyProfileIds.add(pReverse.id);
      pairEvidenceProfileIds.add(deriveStep7EvidenceProfileId(r2, r1, patchVersion));
      for (const id of pReverse.sourceFactIds) sourceFactIdSet.add(id);
      for (const id of pReverse.evidenceIds) evidenceIdSet.add(id);
      for (const id of pReverse.relationshipIds) relationshipIdSet.add(id);
      for (const cat of pReverse.positiveEvidenceTypes) categorySet.add(cat);
      for (const req of pReverse.contextRequirements) contextReqSet.add(req);
      if (!primaryProvenance) primaryProvenance = pReverse.provenance;
    }

    // Determine unordered pair connectivity and applicability
    if (forwardHasQualifying || reverseHasQualifying) {
      matchedPairCount++;
    }

    if (sForward === 'UNKNOWN' || sReverse === 'UNKNOWN') {
      unknownPairCount++;
    } else if (
      (sForward === 'NOT_APPLICABLE' || sReverse === 'NOT_APPLICABLE') &&
      !forwardHasQualifying &&
      !reverseHasQualifying
    ) {
      notApplicablePairCount++;
    } else if (sForward === 'SYNERGY_SUPPORTED' || sReverse === 'SYNERGY_SUPPORTED') {
      const hasPartialOrContext =
        sForward === 'PARTIAL_SYNERGY' ||
        sReverse === 'PARTIAL_SYNERGY' ||
        sForward === 'CONTEXT_DEPENDENT' ||
        sReverse === 'CONTEXT_DEPENDENT' ||
        sForward === 'UNMODELED' ||
        sReverse === 'UNMODELED';
      if (hasPartialOrContext) {
        partiallyEvaluatedPairCount++;
      } else {
        evaluatedPairCount++;
      }
    } else if (sForward === 'PARTIAL_SYNERGY' || sReverse === 'PARTIAL_SYNERGY') {
      partiallyEvaluatedPairCount++;
    } else if (sForward === 'CONTEXT_DEPENDENT' || sReverse === 'CONTEXT_DEPENDENT') {
      contextDependentPairCount++;
    } else if (sForward === 'UNMODELED' || sReverse === 'UNMODELED') {
      unmodeledPairCount++;
    } else {
      noEvidencePairCount++;
    }
  }

  // Sort directional edges canonically: source ascending, target ascending
  directionalPairEdges.sort((e1, e2) => {
    if (e1.sourceResonatorId !== e2.sourceResonatorId) {
      return e1.sourceResonatorId.localeCompare(e2.sourceResonatorId);
    }
    return e1.targetResonatorId.localeCompare(e2.targetResonatorId);
  });

  const applicabilitySummary: TeamApplicabilitySummary = Object.freeze({
    evaluatedPairCount,
    partiallyEvaluatedPairCount,
    contextDependentPairCount,
    unmodeledPairCount,
    unknownPairCount,
    notApplicablePairCount,
    noEvidencePairCount,
    missingContextDimensions: Object.freeze(canonicalSortStrings(Array.from(contextReqSet)))
  });

  // Determine structural qualification status
  let qualificationStatus: TeamCompositionQualificationStatus;

  if (unknownPairCount > 0) {
    // Fail-closed on any unknown evidence
    qualificationStatus = 'UNKNOWN';
  } else if (notApplicablePairCount > 0 && matchedPairCount === 0) {
    // Upstream not applicable established
    qualificationStatus = 'NOT_APPLICABLE';
  } else if (matchedPairCount < MIN_MATCHED_PAIRS_FOR_QUALIFICATION) {
    // Less than 2 distinct pairwise connections -> fails structural Rule A
    qualificationStatus = 'NO_PAIRWISE_EVIDENCE';
  } else {
    // Structural pair threshold met (matchedPairCount >= 2)
    if (
      evaluatedPairCount >= MIN_MATCHED_PAIRS_FOR_QUALIFICATION &&
      partiallyEvaluatedPairCount === 0 &&
      contextDependentPairCount === 0 &&
      unmodeledPairCount === 0
    ) {
      qualificationStatus = 'QUALIFIED';
    } else if (evaluatedPairCount + partiallyEvaluatedPairCount >= 1) {
      qualificationStatus = 'PARTIALLY_QUALIFIED';
    } else if (contextDependentPairCount >= 1) {
      qualificationStatus = 'CONTEXT_DEPENDENT';
    } else if (unmodeledPairCount >= 1) {
      qualificationStatus = 'UNMODELED';
    } else {
      qualificationStatus = 'NO_PAIRWISE_EVIDENCE';
    }
  }

  // Determine qualification types
  const qualificationTypes: TeamCompositionQualificationType[] = [];

  if (
    qualificationStatus !== 'NO_PAIRWISE_EVIDENCE' &&
    qualificationStatus !== 'UNKNOWN' &&
    qualificationStatus !== 'NOT_APPLICABLE'
  ) {
    if (matchedPairCount === 2) {
      qualificationTypes.push('TWO_PAIR_SYNERGY_EDGES');
    } else if (matchedPairCount === 3) {
      qualificationTypes.push('THREE_PAIR_SYNERGY_EDGES');
    }

    // Directional synergy chain check: exists permutation (X, Y, Z) where X -> Y and Y -> Z
    const permutations: ReadonlyArray<readonly [string, string, string]> = [
      [a, b, c], [a, c, b],
      [b, a, c], [b, c, a],
      [c, a, b], [c, b, a]
    ];

    const hasDirectionalChain = permutations.some(([x, y, z]) => {
      const hasXtoY = directionalPairEdges.some(
        (e) => e.sourceResonatorId === x && e.targetResonatorId === y
      );
      const hasYtoZ = directionalPairEdges.some(
        (e) => e.sourceResonatorId === y && e.targetResonatorId === z
      );
      return hasXtoY && hasYtoZ;
    });

    if (hasDirectionalChain) {
      qualificationTypes.push('DIRECTIONAL_SYNERGY_CHAIN');
    }

    if (categorySet.size >= 2) {
      qualificationTypes.push('MULTI_CATEGORY_PAIR_SUPPORT');
    }

    if (contextDependentPairCount > 0) {
      qualificationTypes.push('CONTEXTUAL_PAIR_SUPPORT');
    }

    if (unmodeledPairCount > 0) {
      qualificationTypes.push('UNMODELED_PAIR_SUPPORT');
    }
  }

  qualificationTypes.sort((t1, t2) => t1.localeCompare(t2));

  // Machine-readable explanation codes
  const explanationCodes: string[] = [`STATUS_${qualificationStatus}`];
  if (qualificationStatus === 'PARTIALLY_QUALIFIED') {
    explanationCodes.push('PARTIAL_EVALUATED_TEAM');
  } else if (qualificationStatus === 'CONTEXT_DEPENDENT') {
    explanationCodes.push('CONTEXTUAL_PAIR_SYNERGY_PRESENT');
  } else if (qualificationStatus === 'UNMODELED') {
    explanationCodes.push('UNMODELED_PAIR_SYNERGY_PRESENT');
  } else if (qualificationStatus === 'UNKNOWN') {
    explanationCodes.push('UNKNOWN_UPSTREAM_EVIDENCE');
  } else if (qualificationStatus === 'NOT_APPLICABLE') {
    explanationCodes.push('NOT_APPLICABLE_UPSTREAM_EVIDENCE');
  } else if (qualificationStatus === 'NO_PAIRWISE_EVIDENCE') {
    if (matchedPairCount === 0) {
      explanationCodes.push('NO_PAIRWISE_SYNERGY_EVIDENCE');
    } else {
      explanationCodes.push('INSUFFICIENT_PAIR_EDGES');
    }
  }

  if (matchedPairCount === 2) {
    explanationCodes.push('TWO_PAIR_EDGES_CONNECTED');
  } else if (matchedPairCount === 3) {
    explanationCodes.push('THREE_PAIR_EDGES_CONNECTED');
  }

  for (const qType of qualificationTypes) {
    explanationCodes.push(`HAS_${qType}`);
  }

  const supportingSynergyCategories = canonicalSortStrings(
    Array.from(categorySet)
  ) as readonly CharacterPairSynergyCategory[];

  for (const cat of supportingSynergyCategories) {
    explanationCodes.push(`HAS_${cat}`);
  }

  const sortedExplanationCodes = canonicalSortStrings(explanationCodes);

  return Object.freeze({
    id: candidateId,
    patchVersion,
    ruleVersion,
    memberResonatorIds: Object.freeze([a, b, c]) as readonly [string, string, string],
    pairSynergyProfileIds: Object.freeze(canonicalSortStrings(Array.from(pairSynergyProfileIds))),
    pairEvidenceProfileIds: Object.freeze(canonicalSortStrings(Array.from(pairEvidenceProfileIds))),
    supportingSourceFactIds: Object.freeze(canonicalSortStrings(Array.from(sourceFactIdSet))),
    supportingEvidenceIds: Object.freeze(canonicalSortStrings(Array.from(evidenceIdSet))),
    supportingRelationshipIds: Object.freeze(canonicalSortStrings(Array.from(relationshipIdSet))),
    directionalPairEdges: Object.freeze(directionalPairEdges),
    qualificationStatus,
    qualificationTypes: Object.freeze(qualificationTypes),
    supportingSynergyCategories,
    matchedPairCount,
    directionalEdgeCount: directionalPairEdges.length,
    independentEvidenceLineageCount: evidenceIdSet.size,
    contextRequirements: applicabilitySummary.missingContextDimensions,
    applicabilitySummary,
    explanationCodes: Object.freeze(sortedExplanationCodes),
    provenance: primaryProvenance ?? EMPTY_TEAM_PROVENANCE
  });
}

/**
 * Generates all team composition candidates for an input list of Resonators and Step 8 profiles.
 * Enumerates all theoretical C(N, 3) triples deterministically.
 */
export function generateTeamCompositionCandidates(
  resonatorIds: readonly string[],
  synergyProfiles: readonly CharacterPairSynergyProfile[],
  options?: TeamCompositionOptions
): readonly TeamCompositionCandidate[] {
  const sortedResonators = canonicalSortStrings(Array.from(new Set(resonatorIds)));
  const n = sortedResonators.length;

  if (n < TEAM_MEMBER_COUNT) {
    return Object.freeze([]);
  }

  const pairMap = new Map<string, CharacterPairSynergyProfile>();
  for (const p of synergyProfiles) {
    pairMap.set(makePairKey(p.sourceResonatorId, p.targetResonatorId), p);
  }

  const candidates: TeamCompositionCandidate[] = [];
  const includeEmpty = options?.includeEmptyTriples ?? false;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const triple = [sortedResonators[i], sortedResonators[j], sortedResonators[k]];
        const candidate = generateTeamCompositionCandidate(triple, pairMap, options);

        if (includeEmpty || candidate.qualificationStatus !== 'NO_PAIRWISE_EVIDENCE') {
          candidates.push(candidate);
        }
      }
    }
  }

  candidates.sort(compareTeamCompositionCandidate);
  return Object.freeze(candidates);
}
