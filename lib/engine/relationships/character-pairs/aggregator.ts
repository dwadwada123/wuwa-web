/**
 * Wuthering Waves Character-Level Evidence Aggregator
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Aggregates already-approved Step 6 candidate evaluations into directional
 * CharacterPairEvidenceProfiles connecting two specific Resonators.
 *
 * CRITICAL ARCHITECTURAL SAFEGUARDS:
 * 1. STRICT DIRECTIONALITY: A -> B is distinct from B -> A.
 * 2. NO NEW INTERACTION INFERENCE: Aggregates only what Steps 1-6 established.
 * 3. ANTI-DOUBLE-COUNTING: Grouping by canonical evidence lineage prevents multiple
 *    candidates from the same underlying fact from multiplying pair evidence scores.
 * 4. EPISTEMIC FIDELITY: EMPTY, UNMODELED, UNKNOWN, NOT_APPLICABLE, MISSING_CONTEXT
 *    strictly produce pairEvidenceScore: null.
 * 5. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import {
  CHARACTER_PAIR_AGGREGATION_RULE_VERSION,
  PAIR_SCORE_SCALE_MIN,
  PAIR_SCORE_SCALE_MAX,
  INDEPENDENT_EVIDENCE_BONUS_PER_ITEM,
  INDEPENDENT_EVIDENCE_BONUS_MAX,
  EMPTY_PAIR_PROVENANCE
} from './rules.ts';
import {
  deriveCharacterPairProfileId,
  canonicalSortStrings,
  compareCharacterPairProfile
} from './predicates.ts';
import type {
  CharacterPairEvidenceProfile,
  CharacterPairProfileStatus,
  CharacterPairEvidenceScoreSummary,
  CharacterPairComponentSummary,
  CharacterPairApplicabilitySummary,
  CharacterPairAggregationOptions,
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateMatchedDimension,
  CandidateMatchedDimensionKind,
  CompatibilityCandidateEvaluation
} from './types.ts';
import type { CompatibilityCandidate } from '../compatibility/types.ts';
import type { SourceReference } from '../../capabilities/types.ts';

const VALID_QUAL_TYPES: readonly CandidateQualificationType[] = [
  'EXPLICIT_TARGET_LINK',
  'ACTION_COMPATIBILITY_CANDIDATE',
  'ELEMENT_COMPATIBILITY_CANDIDATE',
  'TRANSITION_COMPATIBILITY_CANDIDATE',
  'TARGET_SCOPE_COMPATIBILITY_CANDIDATE',
  'RESOURCE_COMPATIBILITY_CANDIDATE',
  'DEFENSIVE_COMPATIBILITY_CANDIDATE',
  'OFFENSIVE_COMPATIBILITY_CANDIDATE',
  'MECHANICAL_COMPATIBILITY_CANDIDATE'
];

const VALID_DIM_KINDS: readonly CandidateMatchedDimensionKind[] = [
  'ACTION',
  'ELEMENT',
  'TRANSITION',
  'TRIGGER',
  'TARGET_SCOPE',
  'RESOURCE',
  'DEFENSIVE',
  'OFFENSIVE',
  'MECHANICAL',
  'EXPLICIT_TARGET'
];

/**
 * Creates an empty component summary.
 */
function createEmptyComponentSummary(): CharacterPairComponentSummary {
  const byType: Record<CandidateQualificationType, number> = {
    EXPLICIT_TARGET_LINK: 0,
    ACTION_COMPATIBILITY_CANDIDATE: 0,
    ELEMENT_COMPATIBILITY_CANDIDATE: 0,
    TRANSITION_COMPATIBILITY_CANDIDATE: 0,
    TARGET_SCOPE_COMPATIBILITY_CANDIDATE: 0,
    RESOURCE_COMPATIBILITY_CANDIDATE: 0,
    DEFENSIVE_COMPATIBILITY_CANDIDATE: 0,
    OFFENSIVE_COMPATIBILITY_CANDIDATE: 0,
    MECHANICAL_COMPATIBILITY_CANDIDATE: 0
  };

  const byNature: Record<CandidateQualificationNature, number> = {
    EXPLICIT: 0,
    DIMENSIONAL: 0
  };

  const byDim: Record<CandidateMatchedDimensionKind, number> = {
    ACTION: 0,
    ELEMENT: 0,
    TRANSITION: 0,
    TRIGGER: 0,
    TARGET_SCOPE: 0,
    RESOURCE: 0,
    DEFENSIVE: 0,
    OFFENSIVE: 0,
    MECHANICAL: 0,
    EXPLICIT_TARGET: 0
  };

  return {
    countsByQualificationType: Object.freeze(byType),
    countsByQualificationNature: Object.freeze(byNature),
    countsByDimensionKind: Object.freeze(byDim),
    countsByRuleCode: Object.freeze({})
  };
}

/**
 * Builds an EMPTY profile for a resonator pair that has zero modeled compatibility candidates.
 * Absence of evidence is strictly NOT negative evidence or anti-synergy.
 */
export function buildEmptyCharacterPairProfile(
  sourceResonatorId: string,
  targetResonatorId: string,
  patchVersion: '3.7' = '3.7',
  ruleVersion: '7.7.1' = CHARACTER_PAIR_AGGREGATION_RULE_VERSION
): CharacterPairEvidenceProfile {
  const profileId = deriveCharacterPairProfileId(patchVersion, sourceResonatorId, targetResonatorId, ruleVersion);

  return Object.freeze({
    id: profileId,
    patchVersion,
    ruleVersion,
    sourceResonatorId,
    targetResonatorId,
    status: 'EMPTY' as const,

    candidateIds: Object.freeze([]),
    evaluationIds: Object.freeze([]),
    evidenceIds: Object.freeze([]),
    relationshipIds: Object.freeze([]),
    sourceFactIds: Object.freeze([]),

    qualificationTypes: Object.freeze([]),
    qualificationNatures: Object.freeze([]),
    matchedDimensions: Object.freeze([]),

    componentSummary: createEmptyComponentSummary(),

    evidenceScoreSummary: Object.freeze({
      evaluatedCandidateCount: 0,
      uniqueEvidenceCount: 0,
      uniqueRelationshipCount: 0,
      uniqueSourceFactCount: 0,
      independentEvaluatedEvidenceCount: 0,
      maxCandidateScore: null,
      averageCandidateScore: null,
      pairEvidenceScore: null
    }),

    applicabilitySummary: Object.freeze({
      evaluatedCount: 0,
      missingContextCount: 0,
      contextMismatchCount: 0,
      unmodeledCount: 0,
      unknownCount: 0,
      notApplicableCount: 0,
      missingContextDimensions: Object.freeze([])
    }),

    explanationCodes: Object.freeze(['STATUS_EMPTY', 'NO_MODELED_EVIDENCE']),
    provenance: Object.freeze({
      ...EMPTY_PAIR_PROVENANCE,
      entityId: sourceResonatorId,
      entityName: `${sourceResonatorId} -> ${targetResonatorId} Pair`
    })
  });
}

/**
 * Aggregates a single directional character pair (sourceResonatorId -> targetResonatorId)
 * from pre-filtered candidate evaluations and candidate models.
 */
export function aggregateCharacterPairEvidence(
  sourceResonatorId: string,
  targetResonatorId: string,
  evaluations: readonly CompatibilityCandidateEvaluation[],
  candidates: readonly CompatibilityCandidate[],
  options?: CharacterPairAggregationOptions
): CharacterPairEvidenceProfile {
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? CHARACTER_PAIR_AGGREGATION_RULE_VERSION;

  if (evaluations.length === 0 || candidates.length === 0) {
    return buildEmptyCharacterPairProfile(sourceResonatorId, targetResonatorId, patchVersion, ruleVersion);
  }

  // Cross-patch rejection
  for (const ev of evaluations) {
    if (ev.patchVersion !== patchVersion) {
      throw new Error(`Step 7 rejects cross-patch evaluation '${ev.id}' with patch '${ev.patchVersion}'.`);
    }
  }
  for (const cand of candidates) {
    if (cand.patchVersion !== patchVersion) {
      throw new Error(`Step 7 rejects cross-patch candidate '${cand.id}' with patch '${cand.patchVersion}'.`);
    }
  }

  const profileId = deriveCharacterPairProfileId(patchVersion, sourceResonatorId, targetResonatorId, ruleVersion);

  // Lineage collection & deduplication
  const candidateIdSet = new Set<string>();
  const evaluationIdSet = new Set<string>();
  const evidenceIdSet = new Set<string>();
  const relationshipIdSet = new Set<string>();
  const sourceFactIdSet = new Set<string>();
  const qualTypeSet = new Set<CandidateQualificationType>();
  const qualNatureSet = new Set<CandidateQualificationNature>();
  const matchedDimMap = new Map<string, CandidateMatchedDimension>();
  const ruleCodeCountMap: Record<string, number> = {};

  const byType: Record<CandidateQualificationType, number> = {
    EXPLICIT_TARGET_LINK: 0,
    ACTION_COMPATIBILITY_CANDIDATE: 0,
    ELEMENT_COMPATIBILITY_CANDIDATE: 0,
    TRANSITION_COMPATIBILITY_CANDIDATE: 0,
    TARGET_SCOPE_COMPATIBILITY_CANDIDATE: 0,
    RESOURCE_COMPATIBILITY_CANDIDATE: 0,
    DEFENSIVE_COMPATIBILITY_CANDIDATE: 0,
    OFFENSIVE_COMPATIBILITY_CANDIDATE: 0,
    MECHANICAL_COMPATIBILITY_CANDIDATE: 0
  };

  const byNature: Record<CandidateQualificationNature, number> = {
    EXPLICIT: 0,
    DIMENSIONAL: 0
  };

  const byDimKind: Record<CandidateMatchedDimensionKind, number> = {
    ACTION: 0,
    ELEMENT: 0,
    TRANSITION: 0,
    TRIGGER: 0,
    TARGET_SCOPE: 0,
    RESOURCE: 0,
    DEFENSIVE: 0,
    OFFENSIVE: 0,
    MECHANICAL: 0,
    EXPLICIT_TARGET: 0
  };

  for (const cand of candidates) {
    candidateIdSet.add(cand.id);
    for (const eid of cand.evidenceIds) evidenceIdSet.add(eid);
    for (const rid of cand.relationshipIds) relationshipIdSet.add(rid);
    for (const fid of cand.sourceFactIds) sourceFactIdSet.add(fid);

    qualTypeSet.add(cand.qualificationType);
    qualNatureSet.add(cand.qualificationNature);

    const prevTypeCount = byType[cand.qualificationType];
    byType[cand.qualificationType] = typeof prevTypeCount === 'number' ? prevTypeCount + 1 : 1;

    const prevNatureCount = byNature[cand.qualificationNature];
    byNature[cand.qualificationNature] = typeof prevNatureCount === 'number' ? prevNatureCount + 1 : 1;

    for (const dim of cand.matchedDimensions) {
      const key = `${dim.kind}:${dim.value}`;
      if (!matchedDimMap.has(key)) {
        matchedDimMap.set(key, dim);
      }
      const prevDimCount = byDimKind[dim.kind];
      byDimKind[dim.kind] = typeof prevDimCount === 'number' ? prevDimCount + 1 : 1;
    }
  }

  // Applicability & Epistemic accounting
  let evaluatedCount = 0;
  let missingContextCount = 0;
  let contextMismatchCount = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  const missingContextDimsSet = new Set<string>();

  // Map candidate ID to evaluation
  const candEvalMap = new Map<string, CompatibilityCandidateEvaluation>();
  for (const ev of evaluations) {
    evaluationIdSet.add(ev.id);
    candEvalMap.set(ev.candidateId, ev);

    if (ev.evaluationStatus === 'EVALUATED') {
      evaluatedCount++;
    } else if (ev.evaluationStatus === 'MISSING_CONTEXT') {
      missingContextCount++;
    } else if (ev.evaluationStatus === 'CONTEXT_MISMATCH') {
      contextMismatchCount++;
    } else if (ev.evaluationStatus === 'UNMODELED') {
      unmodeledCount++;
    } else if (ev.evaluationStatus === 'UNKNOWN') {
      unknownCount++;
    } else if (ev.evaluationStatus === 'NOT_APPLICABLE') {
      notApplicableCount++;
    }

    for (const dim of ev.applicability.missingDimensions) {
      missingContextDimsSet.add(dim);
    }

    for (const comp of ev.components) {
      const prevRuleCount = ruleCodeCountMap[comp.ruleCode];
      ruleCodeCountMap[comp.ruleCode] = typeof prevRuleCount === 'number' ? prevRuleCount + 1 : 1;
    }
  }

  // Derive aggregate epistemic status
  let status: CharacterPairProfileStatus;
  if (evaluations.length === 0) {
    status = 'EMPTY';
  } else if (evaluatedCount > 0) {
    if (missingContextCount > 0 || unmodeledCount > 0 || contextMismatchCount > 0) {
      status = 'PARTIALLY_EVALUATED';
    } else {
      status = 'EVALUATED';
    }
  } else if (missingContextCount > 0) {
    status = 'MISSING_CONTEXT';
  } else if (unmodeledCount > 0) {
    status = 'UNMODELED';
  } else if (contextMismatchCount > 0) {
    status = 'CONTEXT_MISMATCH';
  } else if (unknownCount > 0) {
    status = 'UNKNOWN';
  } else if (notApplicableCount > 0) {
    status = 'NOT_APPLICABLE';
  } else {
    status = 'EMPTY';
  }

  // Lineage-Aware Anti-Double-Counting Score Aggregation
  let maxCandidateScore: number | null = null;
  let averageCandidateScore: number | null = null;
  let pairEvidenceScore: number | null = null;
  let independentEvaluatedEvidenceCount = 0;

  if (evaluatedCount > 0) {
    // Group evaluated candidates by primary canonical evidence ID
    const evaluatedEvidenceScores = new Map<string, number>();
    const allEvaluatedCandidateScores: number[] = [];

    for (const cand of candidates) {
      const ev = candEvalMap.get(cand.id);
      if (ev && ev.evaluationStatus === 'EVALUATED' && ev.totalScore !== null) {
        allEvaluatedCandidateScores.push(ev.totalScore);

        // Group by primary evidence ID
        const primaryEvidenceId = cand.evidenceIds[0] || cand.id;
        const currentBest = evaluatedEvidenceScores.get(primaryEvidenceId);
        if (currentBest === undefined || ev.totalScore > currentBest) {
          evaluatedEvidenceScores.set(primaryEvidenceId, ev.totalScore);
        }
      }
    }

    const independentScores = Array.from(evaluatedEvidenceScores.values());
    independentEvaluatedEvidenceCount = independentScores.length;

    if (independentScores.length > 0) {
      maxCandidateScore = Math.max(...allEvaluatedCandidateScores);

      const sumIndep = independentScores.reduce((acc, val) => acc + val, 0);
      averageCandidateScore = Math.round((sumIndep / independentScores.length) * 100) / 100;

      // Primary evidence baseline: strongest evaluated independent evidence
      const baseEvidenceScore = Math.max(...independentScores);

      // Multi-lineage bonus: awarded strictly per additional distinct independent evidence record
      const multiLineageBonus = Math.min(
        INDEPENDENT_EVIDENCE_BONUS_MAX,
        (independentScores.length - 1) * INDEPENDENT_EVIDENCE_BONUS_PER_ITEM
      );

      const rawAggregatedScore = baseEvidenceScore + multiLineageBonus;
      pairEvidenceScore = Math.round(
        Math.min(PAIR_SCORE_SCALE_MAX, Math.max(PAIR_SCORE_SCALE_MIN, rawAggregatedScore)) * 100
      ) / 100;
    }
  }

  // Structured explanation codes
  const explanationCodes: string[] = [`STATUS_${status}`];
  if (status === 'PARTIALLY_EVALUATED') {
    explanationCodes.push('PARTIAL_EVALUATED_EVIDENCE');
  }
  if (missingContextCount > 0) {
    explanationCodes.push('CONTEXTUAL_EVIDENCE_PRESENT');
  }
  if (unmodeledCount > 0) {
    explanationCodes.push('UNMODELED_EVIDENCE_PRESENT');
  }
  if (independentEvaluatedEvidenceCount > 1) {
    explanationCodes.push('MULTI_INDEPENDENT_EVIDENCE');
  }
  for (const qType of qualTypeSet) {
    explanationCodes.push(`HAS_${qType}`);
  }

  // Canonical sorting of collections
  const sortedCandidateIds = canonicalSortStrings(Array.from(candidateIdSet));
  const sortedEvaluationIds = canonicalSortStrings(Array.from(evaluationIdSet));
  const sortedEvidenceIds = canonicalSortStrings(Array.from(evidenceIdSet));
  const sortedRelationshipIds = canonicalSortStrings(Array.from(relationshipIdSet));
  const sortedSourceFactIds = canonicalSortStrings(Array.from(sourceFactIdSet));

  const sortedQualTypes = Array.from(qualTypeSet).sort((a, b) => a.localeCompare(b));
  const sortedQualNatures = Array.from(qualNatureSet).sort((a, b) => a.localeCompare(b));
  const sortedMatchedDimensions = Array.from(matchedDimMap.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.value.localeCompare(b.value);
  });

  const provenance: SourceReference = candidates[0]?.provenance ?? EMPTY_PAIR_PROVENANCE;

  return Object.freeze({
    id: profileId,
    patchVersion,
    ruleVersion,
    sourceResonatorId,
    targetResonatorId,
    status,

    candidateIds: Object.freeze(sortedCandidateIds),
    evaluationIds: Object.freeze(sortedEvaluationIds),
    evidenceIds: Object.freeze(sortedEvidenceIds),
    relationshipIds: Object.freeze(sortedRelationshipIds),
    sourceFactIds: Object.freeze(sortedSourceFactIds),

    qualificationTypes: Object.freeze(sortedQualTypes),
    qualificationNatures: Object.freeze(sortedQualNatures),
    matchedDimensions: Object.freeze(sortedMatchedDimensions),

    componentSummary: Object.freeze({
      countsByQualificationType: Object.freeze(byType),
      countsByQualificationNature: Object.freeze(byNature),
      countsByDimensionKind: Object.freeze(byDimKind),
      countsByRuleCode: Object.freeze(ruleCodeCountMap)
    }),

    evidenceScoreSummary: Object.freeze({
      evaluatedCandidateCount: evaluatedCount,
      uniqueEvidenceCount: evidenceIdSet.size,
      uniqueRelationshipCount: relationshipIdSet.size,
      uniqueSourceFactCount: sourceFactIdSet.size,
      independentEvaluatedEvidenceCount,
      maxCandidateScore,
      averageCandidateScore,
      pairEvidenceScore
    }),

    applicabilitySummary: Object.freeze({
      evaluatedCount,
      missingContextCount,
      contextMismatchCount,
      unmodeledCount,
      unknownCount,
      notApplicableCount,
      missingContextDimensions: Object.freeze(canonicalSortStrings(Array.from(missingContextDimsSet)))
    }),

    explanationCodes: Object.freeze(canonicalSortStrings(explanationCodes)),
    provenance: Object.freeze(provenance)
  });
}

/**
 * Aggregates all character pairs across the entire candidate evaluation set.
 * Returns deterministically sorted array of CharacterPairEvidenceProfiles.
 */
export function aggregateCharacterPairEvidences(
  evaluations: readonly CompatibilityCandidateEvaluation[],
  candidates: readonly CompatibilityCandidate[],
  knownResonatorIds?: ReadonlySet<string>,
  options?: CharacterPairAggregationOptions
): readonly CharacterPairEvidenceProfile[] {
  // Index candidates and evaluations
  const candMap = new Map<string, CompatibilityCandidate>();
  for (const c of candidates) {
    candMap.set(c.id, c);
  }

  const evalMap = new Map<string, CompatibilityCandidateEvaluation>();
  for (const ev of evaluations) {
    evalMap.set(ev.candidateId, ev);
  }

  // Derive known resonator IDs if not provided
  const resIdSet = new Set<string>();
  if (knownResonatorIds && knownResonatorIds.size > 0) {
    for (const id of knownResonatorIds) resIdSet.add(id);
  } else {
    for (const c of candidates) {
      if (
        c.sourceCapability.provenance.sourceType === 'RESONATOR_ABILITY' ||
        c.sourceCapability.provenance.sourceType === 'RESONATOR_SEQUENCE'
      ) {
        resIdSet.add(c.sourceEntityId);
      }
      if (
        c.targetCapability.provenance.sourceType === 'RESONATOR_ABILITY' ||
        c.targetCapability.provenance.sourceType === 'RESONATOR_SEQUENCE'
      ) {
        resIdSet.add(c.targetEntityId);
      }
    }
  }

  // Group candidate pairs by directional resonator key (source -> target)
  const pairCandMap = new Map<string, CompatibilityCandidate[]>();
  const pairEvalMap = new Map<string, CompatibilityCandidateEvaluation[]>();

  for (const cand of candidates) {
    // Only include pairs where BOTH source and target are Resonators
    if (!resIdSet.has(cand.sourceEntityId) || !resIdSet.has(cand.targetEntityId)) {
      continue;
    }

    const key = `${cand.sourceEntityId}:::${cand.targetEntityId}`;
    if (!pairCandMap.has(key)) {
      pairCandMap.set(key, []);
      pairEvalMap.set(key, []);
    }
    pairCandMap.get(key)!.push(cand);

    const ev = evalMap.get(cand.id);
    if (ev) {
      pairEvalMap.get(key)!.push(ev);
    }
  }

  const profiles: CharacterPairEvidenceProfile[] = [];

  // Build profiles for all modeled pairs
  for (const [key, pairCands] of pairCandMap.entries()) {
    const [sourceId, targetId] = key.split(':::');
    const pairEvals = pairEvalMap.get(key) || [];
    const profile = aggregateCharacterPairEvidence(sourceId, targetId, pairEvals, pairCands, options);
    profiles.push(profile);
  }

  // Optionally include empty pairs for all combinations
  if (options?.includeEmptyPairs) {
    const sortedResIds = Array.from(resIdSet).sort((a, b) => a.localeCompare(b));
    for (const src of sortedResIds) {
      for (const tgt of sortedResIds) {
        if (src === tgt) continue; // Resonators do not pair with themselves in distinct team positions
        const key = `${src}:::${tgt}`;
        if (!pairCandMap.has(key)) {
          profiles.push(buildEmptyCharacterPairProfile(src, tgt, '3.7', options?.ruleVersion));
        }
      }
    }
  }

  // Canonical ordering
  profiles.sort(compareCharacterPairProfile);

  return Object.freeze(profiles);
}
