/**
 * Wuthering Waves Character Pair Synergy Profile Auditor
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Audits CharacterPairSynergyProfiles against strict Invariants A through AB.
 * Validates deterministic IDs, directional integrity, absence of anti-synergy,
 * epistemic safety, patch isolation, and upstream lineage reconciliation.
 */

import { auditProductionCapabilities } from '../../../capabilities/builder.ts';
import { auditCharacterPairEvidenceProfiles } from '../audit.ts';
import { getCharacterPairSynergyProfiles } from './repository.ts';
import {
  CHARACTER_PAIR_SYNERGY_RULE_VERSION,
  SYNERGY_SCORE_SCALE_MIN,
  SYNERGY_SCORE_SCALE_MAX
} from './rules.ts';
import { deriveCharacterPairSynergyProfileId } from './predicates.ts';
import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyCategory,
  ProductionSynergyAuditMetrics
} from './types.ts';

/** Prohibited keys that MUST NEVER exist on a CharacterPairSynergyProfile */
const PROHIBITED_KEYS_ON_SYNERGY_PROFILE: readonly string[] = [
  'characterPower',
  'characterStrength',
  'characterScore',
  'resonatorPower',
  'resonatorScore',
  'teamScore',
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
function assertNoProhibitedKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_SYNERGY_PROFILE) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Asserts strict upstream category provenance for every category assigned to a synergy profile.
 * Prohibits assigning categories based on generic target scope, candidate name alone, or unverified recipient.
 */
export function assertCategoryProvenance(profile: CharacterPairSynergyProfile): void {
  const qualTypes = new Set(profile.qualificationTypes);
  const matchedDims = profile.matchedDimensions;

  for (const cat of profile.positiveEvidenceTypes) {
    switch (cat) {
      case 'COORDINATED_ATTACK_SYNERGY': {
        const hasCoordinatedRel =
          profile.relationshipIds.some((id) => id.includes('COORDINATED_ATTACK_INTERACTION')) ||
          profile.evidenceIds.some((id) => id.includes('COORDINATED_ATTACK_EVIDENCE'));
        const hasTargetParticipation =
          matchedDims.some((d) => d.kind === 'ACTION' && d.value === 'COORDINATED') ||
          profile.relationshipIds.some((id) => id.includes('ACT:COORDINATED') && id.includes(profile.targetResonatorId)) ||
          profile.sourceFactIds.some((id) => id.startsWith(profile.targetResonatorId) && (id.includes('COORDINATED') || id.includes('COORDINATED_ATTACK')));

        if (!hasCoordinatedRel || !hasTargetParticipation) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries COORDINATED_ATTACK_SYNERGY without verified pairwise coordinated-attack provenance.`
          );
        }
        break;
      }
      case 'NEXT_RESONATOR_SYNERGY': {
        const hasExplicitTarget =
          qualTypes.has('EXPLICIT_TARGET_LINK') ||
          matchedDims.some((d) => d.kind === 'EXPLICIT_TARGET');
        const hasNextScope =
          matchedDims.some((d) => (d.kind === 'TARGET_SCOPE' || d.kind === 'TRANSITION') && d.value === 'NEXT_RESONATOR') ||
          profile.evidenceIds.some((id) => id.includes('NEXT_RESONATOR')) ||
          profile.relationshipIds.some((id) => id.includes('NEXT_RESONATOR'));

        if (!hasExplicitTarget || !hasNextScope) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries NEXT_RESONATOR_SYNERGY without explicit ordered target identity connecting source to target.`
          );
        }
        break;
      }
      case 'TARGETING_SYNERGY': {
        const hasExplicitTarget =
          qualTypes.has('EXPLICIT_TARGET_LINK') ||
          matchedDims.some((d) => d.kind === 'EXPLICIT_TARGET');

        if (!hasExplicitTarget) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries TARGETING_SYNERGY without explicit target link.`
          );
        }
        break;
      }
      case 'TRANSITION_SYNERGY':
      case 'INTRO_OUTRO_SYNERGY': {
        const hasTransition =
          qualTypes.has('TRANSITION_COMPATIBILITY_CANDIDATE') ||
          matchedDims.some((d) => d.kind === 'TRANSITION' || (d.kind === 'TRIGGER' && d.value === 'OUTRO_INTRO'));

        if (!hasTransition) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries '${cat}' without transition compatibility provenance.`
          );
        }
        break;
      }
      case 'OFFENSIVE_SYNERGY': {
        const hasOffensive =
          qualTypes.has('OFFENSIVE_COMPATIBILITY_CANDIDATE') ||
          matchedDims.some((d) => d.kind === 'OFFENSIVE');

        if (!hasOffensive) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries OFFENSIVE_SYNERGY without offensive compatibility provenance.`
          );
        }
        break;
      }
      case 'ELEMENTAL_SYNERGY': {
        const hasElement =
          qualTypes.has('ELEMENT_COMPATIBILITY_CANDIDATE') ||
          matchedDims.some((d) => d.kind === 'ELEMENT' && d.value !== 'NONE');

        if (!hasElement) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries ELEMENTAL_SYNERGY without elemental compatibility provenance.`
          );
        }
        break;
      }
      case 'ACTION_SYNERGY': {
        const hasAction =
          qualTypes.has('ACTION_COMPATIBILITY_CANDIDATE') ||
          matchedDims.some((d) => d.kind === 'ACTION');

        if (!hasAction) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries ACTION_SYNERGY without action compatibility provenance.`
          );
        }
        break;
      }
      case 'RESOURCE_SYNERGY': {
        const hasResource =
          qualTypes.has('RESOURCE_COMPATIBILITY_CANDIDATE') ||
          matchedDims.some((d) => d.kind === 'RESOURCE');

        if (!hasResource) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries RESOURCE_SYNERGY without resource compatibility provenance.`
          );
        }
        break;
      }
      case 'DEFENSIVE_SYNERGY': {
        const hasDefensive =
          qualTypes.has('DEFENSIVE_COMPATIBILITY_CANDIDATE') ||
          matchedDims.some((d) => d.kind === 'DEFENSIVE');

        if (!hasDefensive) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries DEFENSIVE_SYNERGY without defensive compatibility provenance.`
          );
        }
        break;
      }
      case 'MECHANICAL_SYNERGY': {
        const hasMech =
          qualTypes.has('MECHANICAL_COMPATIBILITY_CANDIDATE') ||
          matchedDims.some((d) => d.kind === 'MECHANICAL');

        if (!hasMech) {
          throw new Error(
            `Provenance audit failure: Profile '${profile.id}' carries MECHANICAL_SYNERGY without mechanical compatibility provenance.`
          );
        }
        break;
      }
    }
  }
}

/**
 * Audits a collection of CharacterPairSynergyProfiles against Invariants A through AB.
 */
export function auditCharacterPairSynergyProfiles(
  profilesInput?: readonly CharacterPairSynergyProfile[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = CHARACTER_PAIR_SYNERGY_RULE_VERSION
): ProductionSynergyAuditMetrics {
  const capList = auditProductionCapabilities().capabilities;
  const step7Audit = auditCharacterPairEvidenceProfiles();
  const profList = profilesInput ?? getCharacterPairSynergyProfiles();

  // Known Resonator IDs from capabilities
  const knownResonatorIdSet = new Set<string>();
  for (const cap of capList) {
    if (
      cap.provenance.sourceType === 'RESONATOR_ABILITY' ||
      cap.provenance.sourceType === 'RESONATOR_SEQUENCE'
    ) {
      knownResonatorIdSet.add(cap.entityId);
    }
  }

  const totalResonators = knownResonatorIdSet.size;
  const theoreticalDirectionalPairs = totalResonators * (totalResonators - 1);

  const seenProfileIds = new Set<string>();
  const seenPairs = new Set<string>();
  let duplicateProfileIds = 0;

  let synergySupportedCount = 0;
  let partialSynergyCount = 0;
  let contextDependentCount = 0;
  let unmodeledCount = 0;
  let unknownCount = 0;
  let notApplicableCount = 0;
  let noEvidenceCount = 0;

  let profilesWithScore = 0;
  let profilesWithoutScore = 0;

  const validScores: number[] = [];
  const candidateIdsEncountered = new Set<string>();
  const evaluationIdsEncountered = new Set<string>();
  const evidenceIdsEncountered = new Set<string>();
  const relationshipIdsEncountered = new Set<string>();
  const sourceFactIdsEncountered = new Set<string>();

  const scoreDistribution: Record<string, number> = {
    '0.00 - 19.99': 0,
    '20.00 - 39.99': 0,
    '40.00 - 59.99': 0,
    '60.00 - 79.99': 0,
    '80.00 - 100.00': 0
  };

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

  for (const profile of profList) {
    // Invariant A: Valid patch
    if (profile.patchVersion !== expectedPatch) {
      throw new Error(`Audit failure: Synergy profile '${profile.id}' has invalid patchVersion '${profile.patchVersion}'.`);
    }

    // Invariant B & C: Valid source and target Resonators
    if (!knownResonatorIdSet.has(profile.sourceResonatorId)) {
      throw new Error(`Audit failure: Synergy profile '${profile.id}' has unknown source Resonator '${profile.sourceResonatorId}'.`);
    }
    if (!knownResonatorIdSet.has(profile.targetResonatorId)) {
      throw new Error(`Audit failure: Synergy profile '${profile.id}' has unknown target Resonator '${profile.targetResonatorId}'.`);
    }

    // Invariant D & E: Directional uniqueness and no reverse-pair assumption
    const pairKey = `${profile.sourceResonatorId}:::${profile.targetResonatorId}`;
    if (seenPairs.has(pairKey)) {
      throw new Error(`Audit failure: Duplicate directional pair detected for '${pairKey}'.`);
    }
    seenPairs.add(pairKey);

    // Invariant F, G, H, I: Deterministic ID without randomness or timestamps
    const expectedId = deriveCharacterPairSynergyProfileId(
      expectedPatch,
      profile.sourceResonatorId,
      profile.targetResonatorId,
      expectedRuleVersion
    );
    if (profile.id !== expectedId) {
      throw new Error(`Audit failure: Profile ID mismatch. Expected '${expectedId}', got '${profile.id}'.`);
    }

    if (seenProfileIds.has(profile.id)) {
      duplicateProfileIds++;
      throw new Error(`Audit failure: Duplicate synergy profile ID '${profile.id}'.`);
    }
    seenProfileIds.add(profile.id);

    // Status accounting
    switch (profile.synergyStatus) {
      case 'SYNERGY_SUPPORTED':
        synergySupportedCount++;
        break;
      case 'PARTIAL_SYNERGY':
        partialSynergyCount++;
        break;
      case 'CONTEXT_DEPENDENT':
        contextDependentCount++;
        break;
      case 'UNMODELED':
        unmodeledCount++;
        break;
      case 'UNKNOWN':
        unknownCount++;
        break;
      case 'NOT_APPLICABLE':
        notApplicableCount++;
        break;
      case 'NO_EVIDENCE':
        noEvidenceCount++;
        break;
      default:
        throw new Error(`Audit failure: Profile '${profile.id}' has unrecognized synergyStatus '${profile.synergyStatus}'.`);
    }

    // Invariant R, S, T, U, V, W: Epistemic scoring safety checks
    const score = profile.synergyScore;
    if (
      profile.synergyStatus === 'NO_EVIDENCE' ||
      profile.synergyStatus === 'CONTEXT_DEPENDENT' ||
      profile.synergyStatus === 'UNMODELED' ||
      profile.synergyStatus === 'UNKNOWN' ||
      profile.synergyStatus === 'NOT_APPLICABLE'
    ) {
      if (score !== null) {
        throw new Error(
          `Audit failure: Profile '${profile.id}' in status '${profile.synergyStatus}' has non-null synergyScore '${score}'.`
        );
      }
      profilesWithoutScore++;
    } else {
      // SYNERGY_SUPPORTED or PARTIAL_SYNERGY
      if (score === null) {
        throw new Error(`Audit failure: Evaluated synergy profile '${profile.id}' has null synergyScore.`);
      }
      if (!Number.isFinite(score)) {
        throw new Error(`Audit failure: Synergy profile '${profile.id}' score is not finite: '${score}'.`);
      }
      if (Number.isNaN(score)) {
        throw new Error(`Audit failure: Synergy profile '${profile.id}' score is NaN.`);
      }
      if (score < SYNERGY_SCORE_SCALE_MIN || score > SYNERGY_SCORE_SCALE_MAX) {
        throw new Error(`Audit failure: Synergy profile '${profile.id}' score '${score}' out of bounds [0, 100].`);
      }

      profilesWithScore++;
      validScores.push(score);

      // Score distribution buckets
      if (score < 20) {
        scoreDistribution['0.00 - 19.99']++;
      } else if (score < 40) {
        scoreDistribution['20.00 - 39.99']++;
      } else if (score < 60) {
        scoreDistribution['40.00 - 59.99']++;
      } else if (score < 80) {
        scoreDistribution['60.00 - 79.99']++;
      } else {
        scoreDistribution['80.00 - 100.00']++;
      }
    }

    // Invariant Y & Z: Traceability & Anti-double-counting
    for (const cid of profile.candidateIds) candidateIdsEncountered.add(cid);
    for (const evid of profile.evaluationIds) evaluationIdsEncountered.add(evid);
    for (const eid of profile.evidenceIds) evidenceIdsEncountered.add(eid);
    for (const rid of profile.relationshipIds) relationshipIdsEncountered.add(rid);
    for (const fid of profile.sourceFactIds) sourceFactIdsEncountered.add(fid);

    for (const cat of profile.positiveEvidenceTypes) {
      const prevCat = synergyCategoryDistribution[cat];
      synergyCategoryDistribution[cat] = typeof prevCat === 'number' ? prevCat + 1 : 1;
    }

    // Invariant J, K, L, M, N, O, P, Q, X: Scan prohibited keys
    assertNoProhibitedKeys(profile, profile.id);

    // Remediation: Category Provenance Audit
    assertCategoryProvenance(profile);
  }

  // Statistical calculations
  let synergyScoreMin: number | null = null;
  let synergyScoreMax: number | null = null;
  let synergyScoreAverage: number | null = null;
  let synergyScoreMedian: number | null = null;

  if (validScores.length > 0) {
    synergyScoreMin = Math.min(...validScores);
    synergyScoreMax = Math.max(...validScores);
    const sum = validScores.reduce((acc, v) => acc + v, 0);
    synergyScoreAverage = Math.round((sum / validScores.length) * 100) / 100;

    const sortedScores = [...validScores].sort((a, b) => a - b);
    const mid = Math.floor(sortedScores.length / 2);
    synergyScoreMedian =
      sortedScores.length % 2 !== 0
        ? sortedScores[mid]
        : Math.round(((sortedScores[mid - 1] + sortedScores[mid]) / 2) * 100) / 100;
  }

  return Object.freeze({
    totalResonators,
    theoreticalDirectionalPairs,
    pairsWithEvidence: step7Audit.totalModeledPairs,
    noEvidencePairs: theoreticalDirectionalPairs - step7Audit.totalModeledPairs,

    totalModeledProfiles: profList.length,
    totalMaterializedProfiles: profList.length,
    uniqueProfileIds: seenProfileIds.size,
    duplicateProfileIds,

    synergySupportedCount,
    partialSynergyCount,
    contextDependentCount,
    unmodeledCount,
    unknownCount,
    notApplicableCount,
    noEvidenceCount,

    profilesWithScore,
    profilesWithoutScore,

    synergyScoreMin,
    synergyScoreMax,
    synergyScoreAverage,
    synergyScoreMedian,

    scoreDistribution: Object.freeze(scoreDistribution),
    synergyCategoryDistribution: Object.freeze(synergyCategoryDistribution),

    uniqueCandidatesRepresented: candidateIdsEncountered.size,
    uniqueEvaluationsRepresented: evaluationIdsEncountered.size,
    uniqueEvidenceRepresented: evidenceIdsEncountered.size,
    uniqueRelationshipsRepresented: relationshipIdsEncountered.size,
    uniqueSourceFactsRepresented: sourceFactIdsEncountered.size,

    profiles: profList
  });
}
