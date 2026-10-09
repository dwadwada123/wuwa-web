/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluator
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Implements deterministic evaluation and evidence-strength scoring for
 * approved Step 9 TeamCompositionCandidate objects.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. TEAM COMPOSITION EVIDENCE SCORE != TEAM POWER != TEAM DPS != TOA FITNESS.
 * 2. Pure offline function: zero network, zero LLMs, zero random IDs, zero timestamps.
 * 3. Anti-double-counting: Takes strongest valid evaluated pair synergy evidence for
 *    PAIR_EVIDENCE_STRENGTH. Never sums duplicate pair representations.
 * 4. Epistemic gating: NO_EVIDENCE, MISSING_CONTEXT, CONTEXT_MISMATCH, UNMODELED,
 *    UNKNOWN, and NOT_APPLICABLE strictly yield totalScore: null and components: [].
 * 5. Bounded in [0.00, 100.00], rounded to 2 decimal places.
 */

import type { SourceReference, RuntimeEvaluationContext } from '../../capabilities/types.ts';
import type { CharacterPairSynergyProfile } from '../../relationships/character-pairs/synergy/types.ts';
import type { TeamCompositionCandidate, TeamDirectionalPairEdge } from '../types.ts';
import {
  TEAM_COMPOSITION_EVALUATION_RULE_VERSION,
  MAX_PAIR_EVIDENCE_STRENGTH,
  MAX_EVIDENCE_COVERAGE,
  MAX_INDEPENDENT_LINEAGE_COVERAGE,
  MAX_DIRECTIONAL_SUPPORT,
  MAX_SYNERGY_CATEGORY_DIVERSITY,
  MAX_CONTEXT_CERTAINTY,
  getEvidenceCoverageScore,
  getIndependentLineageScore,
  getDirectionalSupportScore,
  getCategoryDiversityScore,
  getContextCertaintyScore,
  EMPTY_TEAM_EVALUATION_PROVENANCE
} from './rules.ts';
import {
  deriveTeamCompositionEvaluationId,
  roundToTwoDecimals,
  clampScore
} from './predicates.ts';
import type {
  TeamCompositionCandidateEvaluation,
  TeamCompositionEvaluationStatus,
  TeamCompositionEvaluationOptions,
  TeamCompositionScoreComponent
} from './types.ts';

/**
 * Creates an index map for O(1) profile lookups by both profile ID and pair key.
 */
export function createSynergyProfileMap(
  profiles: readonly CharacterPairSynergyProfile[]
): Map<string, CharacterPairSynergyProfile> {
  const map = new Map<string, CharacterPairSynergyProfile>();
  for (const p of profiles) {
    map.set(p.id, p);
    map.set(`${p.sourceResonatorId}:::${p.targetResonatorId}`, p);
  }
  return map;
}

/**
 * Helper to retrieve a CharacterPairSynergyProfile for a given directional pair edge.
 */
function getProfileForEdge(
  edge: TeamDirectionalPairEdge,
  pairMap: Map<string, CharacterPairSynergyProfile>
): CharacterPairSynergyProfile | undefined {
  const byId = pairMap.get(edge.synergyProfileId);
  if (byId) return byId;
  return pairMap.get(`${edge.sourceResonatorId}:::${edge.targetResonatorId}`);
}

/**
 * Evaluates runtime context requirements against provided evaluation context.
 */
function evaluateContextRequirements(
  requirements: readonly string[],
  context?: RuntimeEvaluationContext
): 'MATCH' | 'MISMATCH' | 'MISSING' {
  if (requirements.length === 0) return 'MATCH';
  if (!context) return 'MISSING';

  // Check if context has any explicit mismatching keys or satisfied conditions
  const contextKeys = Object.keys(context);
  if (contextKeys.length === 0) return 'MISSING';

  // If required fields exist in context, verify they match
  let allSatisfied = true;
  for (const req of requirements) {
    const val = (context as Record<string, unknown>)[req];
    if (val === undefined) {
      allSatisfied = false;
    } else if (val === false || val === null) {
      return 'MISMATCH';
    }
  }

  return allSatisfied ? 'MATCH' : 'MISSING';
}

/**
 * Deterministically evaluates a single TeamCompositionCandidate.
 */
export function evaluateTeamCompositionCandidate(
  candidate: TeamCompositionCandidate,
  synergyProfilesOrMap: readonly CharacterPairSynergyProfile[] | Map<string, CharacterPairSynergyProfile>,
  options?: TeamCompositionEvaluationOptions
): TeamCompositionCandidateEvaluation {
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? TEAM_COMPOSITION_EVALUATION_RULE_VERSION;
  const evaluationId = deriveTeamCompositionEvaluationId(patchVersion, candidate.id, ruleVersion);

  const pairMap =
    synergyProfilesOrMap instanceof Map
      ? synergyProfilesOrMap
      : createSynergyProfileMap(synergyProfilesOrMap);

  // Determine initial status based on Step 9 candidate status
  let status: TeamCompositionEvaluationStatus;

  switch (candidate.qualificationStatus) {
    case 'NO_PAIRWISE_EVIDENCE':
      status = 'NO_EVIDENCE';
      break;
    case 'UNKNOWN':
      status = 'UNKNOWN';
      break;
    case 'NOT_APPLICABLE':
      status = 'NOT_APPLICABLE';
      break;
    case 'UNMODELED':
      status = 'UNMODELED';
      break;
    case 'CONTEXT_DEPENDENT': {
      const contextResult = evaluateContextRequirements(candidate.contextRequirements, options?.context);
      if (contextResult === 'MATCH') {
        status = 'EVALUATED';
      } else if (contextResult === 'MISMATCH') {
        status = 'CONTEXT_MISMATCH';
      } else {
        status = 'MISSING_CONTEXT';
      }
      break;
    }
    case 'PARTIALLY_QUALIFIED':
      status = 'PARTIALLY_EVALUATED';
      break;
    case 'QUALIFIED':
      status = 'EVALUATED';
      break;
    default:
      status = 'UNKNOWN';
  }

  // If status is blocked or no-evidence, fail-closed with null score and empty components
  if (
    status === 'NO_EVIDENCE' ||
    status === 'UNKNOWN' ||
    status === 'NOT_APPLICABLE' ||
    status === 'UNMODELED' ||
    status === 'MISSING_CONTEXT' ||
    status === 'CONTEXT_MISMATCH'
  ) {
    const blockedReason = `STATUS_${status}`;
    const explanationCodes = Object.freeze([
      blockedReason,
      'EVALUATION_BLOCKED',
      'NO_EVALUATED_SCORE',
      `QUALIFICATION_${candidate.qualificationStatus}`
    ]);

    return Object.freeze({
      id: evaluationId,
      candidateId: candidate.id,
      patchVersion,
      ruleVersion,
      evaluationStatus: status,
      totalScore: null,
      components: Object.freeze([]),
      candidateQualificationStatus: candidate.qualificationStatus,
      pairSynergyProfileIds: candidate.pairSynergyProfileIds,
      pairEvidenceProfileIds: candidate.pairEvidenceProfileIds,
      evidenceIds: candidate.supportingEvidenceIds,
      relationshipIds: candidate.supportingRelationshipIds,
      sourceFactIds: candidate.supportingSourceFactIds,
      matchedPairCount: candidate.matchedPairCount,
      directionalEdgeCount: candidate.directionalEdgeCount,
      independentEvidenceLineageCount: candidate.independentEvidenceLineageCount,
      contextRequirements: candidate.contextRequirements,
      applicabilitySummary: candidate.applicabilitySummary,
      explanationCodes,
      provenance: candidate.supportingEvidenceIds.length > 0
        ? candidate.provenance
        : EMPTY_TEAM_EVALUATION_PROVENANCE
    });
  }

  // --- Calculate Evaluated Score Components ---
  // 1. PAIR_EVIDENCE_STRENGTH (Max 35.0)
  // Anti-double-counting: Find strongest valid evaluated pair score from Step 8 profiles.
  let maxPairScore: number | null = null;
  const strongestEvidenceIdSet = new Set<string>();
  const strongestRelationshipIdSet = new Set<string>();
  const strongestSourceFactIdSet = new Set<string>();

  for (const edge of candidate.directionalPairEdges) {
    const profile = getProfileForEdge(edge, pairMap);
    if (
      profile &&
      profile.synergyScore !== null &&
      Number.isFinite(profile.synergyScore) &&
      profile.synergyScore > 0 &&
      (profile.synergyStatus === 'SYNERGY_SUPPORTED' || profile.synergyStatus === 'PARTIAL_SYNERGY')
    ) {
      if (maxPairScore === null || profile.synergyScore > maxPairScore) {
        maxPairScore = profile.synergyScore;
        strongestEvidenceIdSet.clear();
        strongestRelationshipIdSet.clear();
        strongestSourceFactIdSet.clear();
        for (const id of profile.evidenceIds) strongestEvidenceIdSet.add(id);
        for (const id of profile.relationshipIds) strongestRelationshipIdSet.add(id);
        for (const id of profile.sourceFactIds) strongestSourceFactIdSet.add(id);
      } else if (profile.synergyScore === maxPairScore) {
        for (const id of profile.evidenceIds) strongestEvidenceIdSet.add(id);
        for (const id of profile.relationshipIds) strongestRelationshipIdSet.add(id);
        for (const id of profile.sourceFactIds) strongestSourceFactIdSet.add(id);
      }
    }
  }

  // If no evaluated pair scores exist among edges, fail-closed
  if (maxPairScore === null) {
    const explanationCodes = Object.freeze([
      'STATUS_MISSING_CONTEXT',
      'EVALUATION_BLOCKED',
      'NO_EVALUATED_SCORE',
      'NO_EVALUATED_PAIR_SCORE'
    ]);
    return Object.freeze({
      id: evaluationId,
      candidateId: candidate.id,
      patchVersion,
      ruleVersion,
      evaluationStatus: 'MISSING_CONTEXT',
      totalScore: null,
      components: Object.freeze([]),
      candidateQualificationStatus: candidate.qualificationStatus,
      pairSynergyProfileIds: candidate.pairSynergyProfileIds,
      pairEvidenceProfileIds: candidate.pairEvidenceProfileIds,
      evidenceIds: candidate.supportingEvidenceIds,
      relationshipIds: candidate.supportingRelationshipIds,
      sourceFactIds: candidate.supportingSourceFactIds,
      matchedPairCount: candidate.matchedPairCount,
      directionalEdgeCount: candidate.directionalEdgeCount,
      independentEvidenceLineageCount: candidate.independentEvidenceLineageCount,
      contextRequirements: candidate.contextRequirements,
      applicabilitySummary: candidate.applicabilitySummary,
      explanationCodes,
      provenance: candidate.provenance
    });
  }

  const pairEvidenceStrengthValue = roundToTwoDecimals(
    (maxPairScore / 100.0) * MAX_PAIR_EVIDENCE_STRENGTH
  );

  const pairStrengthComponent: TeamCompositionScoreComponent = Object.freeze({
    dimension: 'PAIR_EVIDENCE_STRENGTH',
    ruleCode: 'RULE_PAIR_EVIDENCE_STRENGTH',
    value: pairEvidenceStrengthValue,
    maxValue: MAX_PAIR_EVIDENCE_STRENGTH,
    evidenceIds: Object.freeze(Array.from(strongestEvidenceIdSet).sort((a, b) => a.localeCompare(b))),
    relationshipIds: Object.freeze(Array.from(strongestRelationshipIdSet).sort((a, b) => a.localeCompare(b))),
    sourceFactIds: Object.freeze(Array.from(strongestSourceFactIdSet).sort((a, b) => a.localeCompare(b))),
    reasonCodes: Object.freeze([
      'STRONGEST_EVALUATED_PAIR_SYNERGY',
      `BASE_SCORE_${maxPairScore}`
    ])
  });

  // 2. EVIDENCE_COVERAGE (Max 20.0)
  const evidenceCoverageValue = getEvidenceCoverageScore(candidate.matchedPairCount);
  const evidenceCoverageComponent: TeamCompositionScoreComponent = Object.freeze({
    dimension: 'EVIDENCE_COVERAGE',
    ruleCode: 'RULE_EVIDENCE_COVERAGE',
    value: evidenceCoverageValue,
    maxValue: MAX_EVIDENCE_COVERAGE,
    evidenceIds: candidate.supportingEvidenceIds,
    relationshipIds: candidate.supportingRelationshipIds,
    sourceFactIds: candidate.supportingSourceFactIds,
    reasonCodes: Object.freeze([`MATCHED_PAIRS_${candidate.matchedPairCount}`])
  });

  // 3. INDEPENDENT_LINEAGE_COVERAGE (Max 15.0)
  const lineageCoverageValue = getIndependentLineageScore(candidate.independentEvidenceLineageCount);
  const lineageCoverageComponent: TeamCompositionScoreComponent = Object.freeze({
    dimension: 'INDEPENDENT_LINEAGE_COVERAGE',
    ruleCode: 'RULE_INDEPENDENT_LINEAGE_COVERAGE',
    value: lineageCoverageValue,
    maxValue: MAX_INDEPENDENT_LINEAGE_COVERAGE,
    evidenceIds: candidate.supportingEvidenceIds,
    relationshipIds: candidate.supportingRelationshipIds,
    sourceFactIds: candidate.supportingSourceFactIds,
    reasonCodes: Object.freeze([`INDEPENDENT_LINEAGES_${candidate.independentEvidenceLineageCount}`])
  });

  // 4. DIRECTIONAL_SUPPORT (Max 10.0)
  const directionalSupportValue = getDirectionalSupportScore(candidate.directionalEdgeCount);
  const directionalSupportComponent: TeamCompositionScoreComponent = Object.freeze({
    dimension: 'DIRECTIONAL_SUPPORT',
    ruleCode: 'RULE_DIRECTIONAL_SUPPORT',
    value: directionalSupportValue,
    maxValue: MAX_DIRECTIONAL_SUPPORT,
    evidenceIds: candidate.supportingEvidenceIds,
    relationshipIds: candidate.supportingRelationshipIds,
    sourceFactIds: candidate.supportingSourceFactIds,
    reasonCodes: Object.freeze([`DIRECTIONAL_EDGES_${candidate.directionalEdgeCount}`])
  });

  // 5. SYNERGY_CATEGORY_DIVERSITY (Max 10.0)
  const categoryDiversityValue = getCategoryDiversityScore(candidate.supportingSynergyCategories.length);
  const categoryDiversityComponent: TeamCompositionScoreComponent = Object.freeze({
    dimension: 'SYNERGY_CATEGORY_DIVERSITY',
    ruleCode: 'RULE_SYNERGY_CATEGORY_DIVERSITY',
    value: categoryDiversityValue,
    maxValue: MAX_SYNERGY_CATEGORY_DIVERSITY,
    evidenceIds: candidate.supportingEvidenceIds,
    relationshipIds: candidate.supportingRelationshipIds,
    sourceFactIds: candidate.supportingSourceFactIds,
    reasonCodes: Object.freeze(
      candidate.supportingSynergyCategories.map((c) => `CATEGORY_${c}`)
    )
  });

  // 6. CONTEXT_CERTAINTY (Max 10.0)
  const isContextFree = candidate.contextRequirements.length === 0;
  const contextCertaintyValue = getContextCertaintyScore(status, isContextFree);
  const contextCertaintyComponent: TeamCompositionScoreComponent = Object.freeze({
    dimension: 'CONTEXT_CERTAINTY',
    ruleCode: 'RULE_CONTEXT_CERTAINTY',
    value: contextCertaintyValue,
    maxValue: MAX_CONTEXT_CERTAINTY,
    evidenceIds: candidate.supportingEvidenceIds,
    relationshipIds: candidate.supportingRelationshipIds,
    sourceFactIds: candidate.supportingSourceFactIds,
    reasonCodes: Object.freeze([
      `STATUS_${status}`,
      isContextFree ? 'CONTEXT_FREE' : 'CONTEXT_SATISFIED'
    ])
  });

  const components: readonly TeamCompositionScoreComponent[] = Object.freeze([
    pairStrengthComponent,
    evidenceCoverageComponent,
    lineageCoverageComponent,
    directionalSupportComponent,
    categoryDiversityComponent,
    contextCertaintyComponent
  ]);

  const rawScore =
    pairEvidenceStrengthValue +
    evidenceCoverageValue +
    lineageCoverageValue +
    directionalSupportValue +
    categoryDiversityValue +
    contextCertaintyValue;

  const totalScore = roundToTwoDecimals(clampScore(rawScore));

  const explanationCodes = Object.freeze([
    `STATUS_${status}`,
    'EVALUATION_SCORED',
    `MATCHED_PAIRS_${candidate.matchedPairCount}`,
    `DIRECTIONAL_EDGES_${candidate.directionalEdgeCount}`,
    `INDEPENDENT_LINEAGES_${candidate.independentEvidenceLineageCount}`,
    `DISTINCT_CATEGORIES_${candidate.supportingSynergyCategories.length}`,
    `SCORE_${totalScore}`
  ]);

  return Object.freeze({
    id: evaluationId,
    candidateId: candidate.id,
    patchVersion,
    ruleVersion,
    evaluationStatus: status,
    totalScore,
    components,
    candidateQualificationStatus: candidate.qualificationStatus,
    pairSynergyProfileIds: candidate.pairSynergyProfileIds,
    pairEvidenceProfileIds: candidate.pairEvidenceProfileIds,
    evidenceIds: candidate.supportingEvidenceIds,
    relationshipIds: candidate.supportingRelationshipIds,
    sourceFactIds: candidate.supportingSourceFactIds,
    matchedPairCount: candidate.matchedPairCount,
    directionalEdgeCount: candidate.directionalEdgeCount,
    independentEvidenceLineageCount: candidate.independentEvidenceLineageCount,
    contextRequirements: candidate.contextRequirements,
    applicabilitySummary: candidate.applicabilitySummary,
    explanationCodes,
    provenance: candidate.provenance
  });
}

/**
 * Deterministically evaluates an array of TeamCompositionCandidates.
 */
export function evaluateTeamCompositionCandidates(
  candidates: readonly TeamCompositionCandidate[],
  synergyProfilesOrMap: readonly CharacterPairSynergyProfile[] | Map<string, CharacterPairSynergyProfile>,
  options?: TeamCompositionEvaluationOptions
): readonly TeamCompositionCandidateEvaluation[] {
  const pairMap =
    synergyProfilesOrMap instanceof Map
      ? synergyProfilesOrMap
      : createSynergyProfileMap(synergyProfilesOrMap);

  const evaluations: TeamCompositionCandidateEvaluation[] = [];

  for (const candidate of candidates) {
    const evaluation = evaluateTeamCompositionCandidate(candidate, pairMap, options);
    if (options?.includeBlockedEvaluations === false && evaluation.totalScore === null) {
      continue;
    }
    evaluations.push(evaluation);
  }

  return Object.freeze(evaluations);
}
