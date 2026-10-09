/**
 * Wuthering Waves Character Pair Synergy Evaluator
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Converts approved Step 7 CharacterPairEvidenceProfiles into deterministic
 * CharacterPairSynergyProfiles.
 *
 * CRITICAL ARCHITECTURAL SAFEGUARDS:
 * 1. STRICT DIRECTIONALITY: A -> B is distinct from B -> A.
 * 2. NO NEW GAMEPLAY INFERENCE: Consumes only approved Step 7 evidence profiles.
 * 3. NO ANTI-SYNERGY: Absence of evidence is NO_EVIDENCE, never anti-synergy or negative score.
 * 4. ANTI-DOUBLE-COUNTING: Scores scale strictly by deduplicated independent evidence lineages.
 * 5. EPISTEMIC FIDELITY: CONTEXT_DEPENDENT, UNMODELED, UNKNOWN, NOT_APPLICABLE, NO_EVIDENCE
 *    strictly produce synergyScore: null.
 * 6. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import {
  CHARACTER_PAIR_SYNERGY_RULE_VERSION,
  SYNERGY_SCORE_SCALE_MIN,
  SYNERGY_SCORE_SCALE_MAX,
  INDEPENDENT_SYNERGY_BONUS_PER_LINEAGE,
  INDEPENDENT_SYNERGY_BONUS_MAX
} from './rules.ts';
import {
  deriveCharacterPairSynergyProfileId,
  compareCharacterPairSynergyProfile
} from './predicates.ts';
import { canonicalSortStrings } from '../predicates.ts';
import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyStatus,
  CharacterPairSynergyCategory,
  CharacterPairSynergyComponent,
  CharacterPairSynergyEvaluationOptions
} from './types.ts';
import type { CharacterPairEvidenceProfile } from '../types.ts';

/**
 * Maps Step 7 CharacterPairProfileStatus to Step 8 CharacterPairSynergyStatus.
 */
function resolveSynergyStatus(evidenceProfile: CharacterPairEvidenceProfile): CharacterPairSynergyStatus {
  switch (evidenceProfile.status) {
    case 'EVALUATED':
      return 'SYNERGY_SUPPORTED';
    case 'PARTIALLY_EVALUATED':
      return 'PARTIAL_SYNERGY';
    case 'MISSING_CONTEXT':
    case 'CONTEXT_MISMATCH':
      return 'CONTEXT_DEPENDENT';
    case 'UNMODELED':
      return 'UNMODELED';
    case 'UNKNOWN':
      return 'UNKNOWN';
    case 'NOT_APPLICABLE':
      return 'NOT_APPLICABLE';
    case 'EMPTY':
    default:
      return 'NO_EVIDENCE';
  }
}

/**
 * Qualifies mechanical synergy components from an approved CharacterPairEvidenceProfile.
 */
function qualifySynergyComponents(
  evidenceProfile: CharacterPairEvidenceProfile
): readonly CharacterPairSynergyComponent[] {
  const components: CharacterPairSynergyComponent[] = [];
  const qualTypes = new Set(evidenceProfile.qualificationTypes);
  const matchedDims = evidenceProfile.matchedDimensions;
  const hasEvaluated = evidenceProfile.evidenceScoreSummary.evaluatedCandidateCount > 0;

  // 1. Offensive Synergy
  if (qualTypes.has('OFFENSIVE_COMPATIBILITY_CANDIDATE') || matchedDims.some((d) => d.kind === 'OFFENSIVE')) {
    components.push({
      category: 'OFFENSIVE_SYNERGY',
      ruleCode: 'RULE_OFFENSIVE_SYNERGY',
      summary: 'Beneficial offensive stat or damage amplification interaction modeled between resonators',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 2. Elemental Synergy
  const elementDims = matchedDims.filter((d) => d.kind === 'ELEMENT' && d.value !== 'NONE');
  if (qualTypes.has('ELEMENT_COMPATIBILITY_CANDIDATE') || elementDims.length > 0) {
    components.push({
      category: 'ELEMENTAL_SYNERGY',
      ruleCode: 'RULE_ELEMENTAL_SYNERGY',
      summary: 'Structured canonical elemental alignment or elemental amplification matching',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 3. Action Synergy
  if (qualTypes.has('ACTION_COMPATIBILITY_CANDIDATE') || matchedDims.some((d) => d.kind === 'ACTION')) {
    components.push({
      category: 'ACTION_SYNERGY',
      ruleCode: 'RULE_ACTION_SYNERGY',
      summary: 'Exact gameplay action compatibility (Basic, Heavy, Skill, or Liberation) established',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 4. Transition Synergy
  if (qualTypes.has('TRANSITION_COMPATIBILITY_CANDIDATE') || matchedDims.some((d) => d.kind === 'TRANSITION')) {
    components.push({
      category: 'TRANSITION_SYNERGY',
      ruleCode: 'RULE_TRANSITION_SYNERGY',
      summary: 'Structured transition compatibility matching source and target character rotation linkage',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });

    // 4b. Intro / Outro Synergy
    components.push({
      category: 'INTRO_OUTRO_SYNERGY',
      ruleCode: 'RULE_INTRO_OUTRO_SYNERGY',
      summary: 'Matching Outro-to-Intro mechanical interaction established by structured evidence',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 5. Next Resonator Synergy
  // Valid ONLY if upstream evidence explicitly establishes an ordered next-resonator relationship
  // targeting this specific character (A -> NEXT_RESONATOR -> B).
  // Generic TEAM, ACTIVE_CHARACTER, generic transition, generic OUTRO/INTRO without explicit target identity fail closed.
  const hasExplicitTargetLink =
    qualTypes.has('EXPLICIT_TARGET_LINK') ||
    matchedDims.some((d) => d.kind === 'EXPLICIT_TARGET');

  const hasNextResonatorScope =
    matchedDims.some(
      (d) =>
        (d.kind === 'TARGET_SCOPE' || d.kind === 'TRANSITION') &&
        d.value === 'NEXT_RESONATOR'
    ) ||
    evidenceProfile.evidenceIds.some((id) => id.includes('NEXT_RESONATOR')) ||
    evidenceProfile.relationshipIds.some((id) => id.includes('NEXT_RESONATOR'));

  if (hasExplicitTargetLink && hasNextResonatorScope) {
    components.push({
      category: 'NEXT_RESONATOR_SYNERGY',
      ruleCode: 'RULE_NEXT_RESONATOR_SYNERGY',
      summary: 'Explicit NEXT_RESONATOR target transition directing effect specifically to the succeeding character',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 6. Targeting Synergy
  // Valid ONLY when approved upstream evidence establishes a meaningful structured source->target character relationship.
  // Generic target scopes (TEAM, ACTIVE_CHARACTER, NEXT_RESONATOR, SELF) do NOT create pairwise targeting synergy.
  if (hasExplicitTargetLink) {
    components.push({
      category: 'TARGETING_SYNERGY',
      ruleCode: 'RULE_TARGETING_SYNERGY',
      summary: 'Structured explicit target scope linkage establishing valid beneficiary relationship',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 7. Resource Synergy
  if (qualTypes.has('RESOURCE_COMPATIBILITY_CANDIDATE') || matchedDims.some((d) => d.kind === 'RESOURCE')) {
    components.push({
      category: 'RESOURCE_SYNERGY',
      ruleCode: 'RULE_RESOURCE_SYNERGY',
      summary: 'Structured energy, concerto, or combat resource provision established between resonators',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 8. Defensive Synergy
  if (qualTypes.has('DEFENSIVE_COMPATIBILITY_CANDIDATE') || matchedDims.some((d) => d.kind === 'DEFENSIVE')) {
    components.push({
      category: 'DEFENSIVE_SYNERGY',
      ruleCode: 'RULE_DEFENSIVE_SYNERGY',
      summary: 'Healing, shielding, defense reduction, or survivability support interaction established',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });
  }

  // 9. Mechanical Synergy
  if (qualTypes.has('MECHANICAL_COMPATIBILITY_CANDIDATE') || matchedDims.some((d) => d.kind === 'MECHANICAL')) {
    components.push({
      category: 'MECHANICAL_SYNERGY',
      ruleCode: 'RULE_MECHANICAL_SYNERGY',
      summary: 'Direct mechanical gameplay interaction such as coordinated attack triggers established',
      evidenceIds: evidenceProfile.evidenceIds,
      relationshipIds: evidenceProfile.relationshipIds,
      sourceFactIds: evidenceProfile.sourceFactIds,
      isEvaluated: hasEvaluated
    });

    // 9b. Coordinated Attack Synergy
    // Allowed ONLY when upstream structured evidence explicitly establishes coordinated-attack semantics between the pair.
    // Generic MECHANICAL candidate where recipient only has generic attack actions does NOT qualify.
    const hasCoordinatedRel =
      evidenceProfile.relationshipIds.some((id) => id.includes('COORDINATED_ATTACK_INTERACTION')) ||
      evidenceProfile.evidenceIds.some((id) => id.includes('COORDINATED_ATTACK_EVIDENCE'));

    const hasTargetCoordinatedParticipation =
      matchedDims.some((d) => d.kind === 'ACTION' && d.value === 'COORDINATED') ||
      evidenceProfile.relationshipIds.some((id) => id.includes('ACT:COORDINATED') && id.includes(evidenceProfile.targetResonatorId)) ||
      evidenceProfile.sourceFactIds.some((id) => id.startsWith(evidenceProfile.targetResonatorId) && (id.includes('COORDINATED') || id.includes('COORDINATED_ATTACK')));

    if (hasCoordinatedRel && hasTargetCoordinatedParticipation) {
      components.push({
        category: 'COORDINATED_ATTACK_SYNERGY',
        ruleCode: 'RULE_COORDINATED_ATTACK_SYNERGY',
        summary: 'Explicit coordinated attack interaction triggering damage during teammate field time',
        evidenceIds: evidenceProfile.evidenceIds,
        relationshipIds: evidenceProfile.relationshipIds,
        sourceFactIds: evidenceProfile.sourceFactIds,
        isEvaluated: hasEvaluated
      });
    }
  }

  return Object.freeze(components);
}

/**
 * Evaluates a single CharacterPairEvidenceProfile to produce a CharacterPairSynergyProfile.
 */
export function evaluateCharacterPairSynergy(
  evidenceProfile: CharacterPairEvidenceProfile,
  options?: CharacterPairSynergyEvaluationOptions
): CharacterPairSynergyProfile {
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? CHARACTER_PAIR_SYNERGY_RULE_VERSION;

  // Cross-patch rejection
  if (evidenceProfile.patchVersion !== patchVersion) {
    throw new Error(
      `Step 8 rejects cross-patch evidence profile '${evidenceProfile.id}' with patch '${evidenceProfile.patchVersion}'.`
    );
  }

  const profileId = deriveCharacterPairSynergyProfileId(
    patchVersion,
    evidenceProfile.sourceResonatorId,
    evidenceProfile.targetResonatorId,
    ruleVersion
  );

  const synergyStatus = resolveSynergyStatus(evidenceProfile);

  // If no evidence, fail safe with null score and empty components
  if (synergyStatus === 'NO_EVIDENCE') {
    return Object.freeze({
      id: profileId,
      patchVersion,
      ruleVersion,
      sourceResonatorId: evidenceProfile.sourceResonatorId,
      targetResonatorId: evidenceProfile.targetResonatorId,
      status: evidenceProfile.status,
      synergyStatus,
      synergyScore: null,
      components: Object.freeze([]),
      candidateIds: Object.freeze([]),
      evaluationIds: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      relationshipIds: Object.freeze([]),
      sourceFactIds: Object.freeze([]),
      qualificationTypes: Object.freeze([]),
      matchedDimensions: Object.freeze([]),
      positiveEvidenceTypes: Object.freeze([]),
      contextRequirements: Object.freeze([]),
      applicabilitySummary: evidenceProfile.applicabilitySummary,
      explanationCodes: Object.freeze(['STATUS_NO_EVIDENCE', 'NO_MODELED_BENEFICIAL_RELATIONSHIP']),
      provenance: evidenceProfile.provenance
    });
  }

  // Qualify mechanical synergy components
  const components = qualifySynergyComponents(evidenceProfile);
  const positiveEvidenceTypes = canonicalSortStrings(
    Array.from(new Set(components.map((c) => c.category)))
  ) as readonly CharacterPairSynergyCategory[];

  // Deterministic Score Calculation (Section 12)
  let synergyScore: number | null = null;

  if (synergyStatus === 'SYNERGY_SUPPORTED' || synergyStatus === 'PARTIAL_SYNERGY') {
    const baseScore = evidenceProfile.evidenceScoreSummary.maxCandidateScore;

    if (baseScore !== null && Number.isFinite(baseScore)) {
      const independentLineageCount = evidenceProfile.evidenceScoreSummary.independentEvaluatedEvidenceCount;
      const bonus = Math.min(
        INDEPENDENT_SYNERGY_BONUS_MAX,
        Math.max(0, (independentLineageCount - 1) * INDEPENDENT_SYNERGY_BONUS_PER_LINEAGE)
      );

      const rawScore = baseScore + bonus;
      synergyScore = Math.round(
        Math.min(SYNERGY_SCORE_SCALE_MAX, Math.max(SYNERGY_SCORE_SCALE_MIN, rawScore)) * 100
      ) / 100;
    }
  }

  // Explanation codes
  const explanationCodes: string[] = [`STATUS_${synergyStatus}`];
  if (synergyStatus === 'PARTIAL_SYNERGY') {
    explanationCodes.push('PARTIAL_EVALUATED_EVIDENCE');
  }
  if (synergyStatus === 'CONTEXT_DEPENDENT') {
    explanationCodes.push('CONTEXTUAL_EVIDENCE_REQUIRES_RUNTIME_CONDITIONS');
  }
  if (synergyStatus === 'UNMODELED') {
    explanationCodes.push('UNMODELED_MECHANICS_PRESENT');
  }
  if (evidenceProfile.evidenceScoreSummary.independentEvaluatedEvidenceCount > 1) {
    explanationCodes.push('MULTI_INDEPENDENT_EVIDENCE_LINEAGES');
  }
  for (const cat of positiveEvidenceTypes) {
    explanationCodes.push(`HAS_${cat}`);
  }

  return Object.freeze({
    id: profileId,
    patchVersion,
    ruleVersion,
    sourceResonatorId: evidenceProfile.sourceResonatorId,
    targetResonatorId: evidenceProfile.targetResonatorId,
    status: evidenceProfile.status,
    synergyStatus,
    synergyScore,
    components,
    candidateIds: evidenceProfile.candidateIds,
    evaluationIds: evidenceProfile.evaluationIds,
    evidenceIds: evidenceProfile.evidenceIds,
    relationshipIds: evidenceProfile.relationshipIds,
    sourceFactIds: evidenceProfile.sourceFactIds,
    qualificationTypes: evidenceProfile.qualificationTypes,
    matchedDimensions: evidenceProfile.matchedDimensions,
    positiveEvidenceTypes,
    contextRequirements: evidenceProfile.applicabilitySummary.missingContextDimensions,
    applicabilitySummary: evidenceProfile.applicabilitySummary,
    explanationCodes: Object.freeze(canonicalSortStrings(explanationCodes)),
    provenance: evidenceProfile.provenance
  });
}

/**
 * Evaluates an entire collection of CharacterPairEvidenceProfiles.
 * Returns canonically sorted array of CharacterPairSynergyProfiles.
 */
export function evaluateCharacterPairSynergies(
  evidenceProfiles: readonly CharacterPairEvidenceProfile[],
  options?: CharacterPairSynergyEvaluationOptions
): readonly CharacterPairSynergyProfile[] {
  const synergyProfiles = evidenceProfiles.map((p) => evaluateCharacterPairSynergy(p, options));
  synergyProfiles.sort(compareCharacterPairSynergyProfile);
  return Object.freeze(synergyProfiles);
}
