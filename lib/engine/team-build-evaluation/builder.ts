/**
 * Wuthering Waves Team Build Evaluation Builder
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Implements deterministic evaluation, compatibility inspection, summary calculation,
 * and ordering for TeamBuildEvaluation records.
 *
 * CENTRAL INVARIANTS:
 * 1. FACTUAL BUILD QUALIFICATION ONLY: Evaluates equipment compatibility, Sonata set presence,
 *    and completeness across the 3 team members. ZERO team power, ZERO combat strength, ZERO DPS.
 * 2. ZERO SCORING / ZERO RECOMMENDATIONS: Does not score builds, rank teams, or suggest loadouts.
 * 3. STRICT CARDINALITY: Exactly three distinct canonical Resonators per team candidate.
 * 4. PURE DETERMINISM: Offline, zero network, zero LLMs, zero random IDs, zero timestamps.
 * 5. STRICT PATCH ISOLATION: Bound strictly to Patch 3.7. Rejects cross-patch inputs.
 * 6. INPUT IMMUTABILITY: Upstream Step 20 evaluations and candidate records remain untouched.
 * 7. UNMODELED MECHANICS: Cross-character Sonata buff stacking/conflict mechanics are strictly 'UNMODELED'.
 * 8. COMPLETENESS ALGEBRA: Total aspects = 18. knownTeamAspects + unknownTeamAspects === 18 always.
 */

import {
  TEAM_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP20_RULE_VERSION,
  REQUIRED_STEP9_RULE_VERSION,
  TEAM_MEMBER_COUNT,
  TEAM_TOTAL_ASPECTS_COUNT,
  TEAM_BUILD_EVALUATION_EXPLANATION_CODES,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  deriveTeamBuildEvaluationId,
  compareTeamBuildEvaluations
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getAllCharacterBuildEvaluations } from '../character-build-evaluation/repository.ts';
import { getTeamCompositionCandidates } from '../team-composition/repository.ts';
import type { TeamCompositionCandidate } from '../team-composition/types.ts';
import type {
  TeamBuildEvaluation,
  TeamBuildEvaluationStatus,
  TeamWeaponBuildAggregation,
  TeamEchoLoadoutAggregation,
  TeamSonataInteractionEvaluation,
  TeamBuildCompletenessMetrics,
  TeamBuildEvaluationProvenance,
  TeamBuildEvaluationInput,
  TeamBuildEvaluationResult,
  TeamBuildEvaluationResultSummary,
  TeamBuildEvaluationAuditMetrics,
  CharacterBuildEvaluation
} from './types.ts';

/**
 * Deterministically evaluates the build qualification for a single 3-Resonator team candidate
 * given their approved Step 20 CharacterBuildEvaluation records.
 */
export function evaluateTeamBuild(
  candidateOrMembers: TeamCompositionCandidate | readonly [string, string, string] | readonly string[],
  memberEvaluations: ReadonlyMap<string, CharacterBuildEvaluation> | readonly CharacterBuildEvaluation[],
  patchId: string = CANONICAL_PATCH_VERSION
): TeamBuildEvaluation {
  // 1. Strict Patch Isolation
  if (!patchId || typeof patchId !== 'string' || patchId.trim() !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchId '${patchId}'. Step 21 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  // 2. Resolve Candidate Members and IDs
  let rawMembers: readonly string[];
  let teamCandidateId: string;

  if (candidateOrMembers && typeof candidateOrMembers === 'object' && 'memberResonatorIds' in candidateOrMembers) {
    const candidate = candidateOrMembers as TeamCompositionCandidate;
    if (candidate.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `Candidate patchVersion '${candidate.patchVersion}' mismatch. Expected '${CANONICAL_PATCH_VERSION}'.`
      );
    }
    if (candidate.ruleVersion !== REQUIRED_STEP9_RULE_VERSION) {
      throw new Error(
        `Candidate ruleVersion '${candidate.ruleVersion}' mismatch. Expected '${REQUIRED_STEP9_RULE_VERSION}'.`
      );
    }
    rawMembers = candidate.memberResonatorIds;
    teamCandidateId = candidate.id;
  } else if (Array.isArray(candidateOrMembers)) {
    rawMembers = candidateOrMembers;
    if (rawMembers.length !== TEAM_MEMBER_COUNT) {
      throw new Error(
        `Team candidate must contain exactly ${TEAM_MEMBER_COUNT} members, got ${rawMembers.length}.`
      );
    }
    const sortedRaw = [...rawMembers].sort((a, b) => a.localeCompare(b));
    teamCandidateId = `team-composition:${CANONICAL_PATCH_VERSION}:${sortedRaw[0]}:${sortedRaw[1]}:${sortedRaw[2]}:${REQUIRED_STEP9_RULE_VERSION}`;
  } else {
    throw new Error('candidateOrMembers must be a TeamCompositionCandidate or a 3-element Resonator array.');
  }

  // Validate member array length
  if (rawMembers.length !== TEAM_MEMBER_COUNT) {
    throw new Error(
      `Team candidate must contain exactly ${TEAM_MEMBER_COUNT} members, got ${rawMembers.length}.`
    );
  }

  // Validate canonical identities
  const distinctSet = new Set<string>();
  for (let i = 0; i < rawMembers.length; i++) {
    const memberId = rawMembers[i];
    if (!memberId || typeof memberId !== 'string' || !isCanonicalResonatorId(memberId)) {
      throw new Error(
        `Member '${memberId}' at index ${i} is not a canonical Patch ${CANONICAL_PATCH_VERSION} Resonator.`
      );
    }
    if (distinctSet.has(memberId)) {
      throw new Error(
        `Duplicate Resonator '${memberId}' in team candidate. Teams must contain exactly 3 distinct members.`
      );
    }
    distinctSet.add(memberId);
  }

  // Canonicalize member order lexicographically [minId, midId, maxId]
  const sortedMembers = Object.freeze([...rawMembers].sort((a, b) => a.localeCompare(b))) as unknown as readonly [string, string, string];

  // 3. Resolve Member Evaluations Map
  let evalMap: ReadonlyMap<string, CharacterBuildEvaluation>;
  if (Array.isArray(memberEvaluations)) {
    evalMap = new Map((memberEvaluations as readonly CharacterBuildEvaluation[]).map((ev) => [ev.resonatorId, ev]));
  } else {
    evalMap = memberEvaluations as ReadonlyMap<string, CharacterBuildEvaluation>;
  }



  const memberEvals: [CharacterBuildEvaluation, CharacterBuildEvaluation, CharacterBuildEvaluation] = [
    evalMap.get(sortedMembers[0])!,
    evalMap.get(sortedMembers[1])!,
    evalMap.get(sortedMembers[2])!
  ];

  for (let i = 0; i < sortedMembers.length; i++) {
    const memberId = sortedMembers[i];
    const ev = memberEvals[i];
    if (!ev) {
      throw new Error(`Missing CharacterBuildEvaluation for member '${memberId}'.`);
    }
    if (ev.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `CharacterBuildEvaluation for '${memberId}' has patchVersion '${ev.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
      );
    }
    if (ev.ruleVersion !== REQUIRED_STEP20_RULE_VERSION) {
      throw new Error(
        `CharacterBuildEvaluation for '${memberId}' has ruleVersion '${ev.ruleVersion}'. Expected '${REQUIRED_STEP20_RULE_VERSION}'.`
      );
    }
    if (ev.resonatorId !== memberId) {
      throw new Error(
        `CharacterBuildEvaluation resonatorId mismatch. Expected '${memberId}', got '${ev.resonatorId}'.`
      );
    }
  }

  // 4. Team-level Weapon Aggregation
  let compatibleCount = 0;
  let incompatibleCount = 0;
  let unequippedCount = 0;
  let unknownCount = 0;

  for (const ev of memberEvals) {
    switch (ev.weaponEvaluation.compatibility) {
      case 'COMPATIBLE':
        compatibleCount++;
        break;
      case 'INCOMPATIBLE':
        incompatibleCount++;
        break;
      case 'NOT_EQUIPPED':
        unequippedCount++;
        break;
      case 'UNKNOWN':
        unknownCount++;
        break;
    }
  }

  const allCompatible = compatibleCount === TEAM_MEMBER_COUNT;
  const hasIncompatibleWeapon = incompatibleCount > 0;

  const weaponAggregation: TeamWeaponBuildAggregation = Object.freeze({
    compatibleCount,
    incompatibleCount,
    unequippedCount,
    unknownCount,
    allCompatible,
    hasIncompatibleWeapon
  });

  // 5. Team-level Echo Loadout Aggregation
  let echoEquippedCount = 0;
  let elementAlignedSonataCount = 0;
  let universalSonataCount = 0;
  let misalignedSonataCount = 0;
  let unequippedSonataCount = 0;
  let unknownSonataCount = 0;

  for (const ev of memberEvals) {
    if (ev.echoEvaluation.hasLoadout) {
      echoEquippedCount++;
    }
    switch (ev.echoEvaluation.sonataAlignment) {
      case 'ELEMENT_ALIGNED':
        elementAlignedSonataCount++;
        break;
      case 'UNIVERSAL':
        universalSonataCount++;
        break;
      case 'MISALIGNED':
        misalignedSonataCount++;
        break;
      case 'NOT_EQUIPPED':
        unequippedSonataCount++;
        break;
      case 'UNKNOWN':
        unknownSonataCount++;
        break;
    }
  }

  const echoAggregation: TeamEchoLoadoutAggregation = Object.freeze({
    equippedCount: echoEquippedCount,
    elementAlignedSonataCount,
    universalSonataCount,
    misalignedSonataCount,
    unequippedSonataCount,
    unknownSonataCount
  });

  // 6. Sonata Interaction & Duplicate Analysis
  const memberSonataCodes: readonly [string | null, string | null, string | null] = Object.freeze([
    memberEvals[0].echoEvaluation.activeSonataSetCode,
    memberEvals[1].echoEvaluation.activeSonataSetCode,
    memberEvals[2].echoEvaluation.activeSonataSetCode
  ]);

  const sonataFreq = new Map<string, number>();
  for (const code of memberSonataCodes) {
    if (code !== null) {
      sonataFreq.set(code, (sonataFreq.get(code) ?? 0) + 1);
    }
  }

  const distinctActiveSonataCodes = Object.freeze(
    Array.from(sonataFreq.keys()).sort((a, b) => a.localeCompare(b))
  );

  const duplicateSonataCodes = Object.freeze(
    Array.from(sonataFreq.entries())
      .filter(([_, count]) => count > 1)
      .map(([code]) => code)
      .sort((a, b) => a.localeCompare(b))
  );

  const hasDuplicateSonataSets = duplicateSonataCodes.length > 0;

  let interactionStatus: 'EVALUATED' | 'UNKNOWN' | 'NOT_EQUIPPED';
  if (
    unknownSonataCount > 0 ||
    memberEvals.some(
      (ev) =>
        ev.status === 'BUILD_UNKNOWN' ||
        ev.status === 'PATCH_MISMATCH' ||
        ev.status === 'INVALID'
    )
  ) {
    interactionStatus = 'UNKNOWN';
  } else if (unequippedSonataCount === TEAM_MEMBER_COUNT) {
    interactionStatus = 'NOT_EQUIPPED';
  } else {
    interactionStatus = 'EVALUATED';
  }

  const sonataInteraction: TeamSonataInteractionEvaluation = Object.freeze({
    memberSonataCodes,
    distinctActiveSonataCodes,
    hasDuplicateSonataSets,
    duplicateSonataCodes,
    stackingStatus: 'UNMODELED',
    interactionStatus
  });

  // 7. Team Build Completeness Metrics
  const knownTeamAspects =
    memberEvals[0].completeness.knownAspects +
    memberEvals[1].completeness.knownAspects +
    memberEvals[2].completeness.knownAspects;

  const unknownTeamAspects =
    memberEvals[0].completeness.unknownAspects +
    memberEvals[1].completeness.unknownAspects +
    memberEvals[2].completeness.unknownAspects;

  const memberCompletenessRatios: readonly [number | null, number | null, number | null] = Object.freeze([
    memberEvals[0].completeness.completenessRatio,
    memberEvals[1].completeness.completenessRatio,
    memberEvals[2].completeness.completenessRatio
  ]);

  const allNullRatios =
    memberCompletenessRatios[0] === null &&
    memberCompletenessRatios[1] === null &&
    memberCompletenessRatios[2] === null;

  const teamCompletenessRatio = allNullRatios
    ? null
    : Math.round((knownTeamAspects / TEAM_TOTAL_ASPECTS_COUNT) * 10000) / 10000;

  const completeness: TeamBuildCompletenessMetrics = Object.freeze({
    totalTeamAspects: TEAM_TOTAL_ASPECTS_COUNT,
    knownTeamAspects,
    unknownTeamAspects,
    memberCompletenessRatios,
    teamCompletenessRatio
  });

  // 8. Overall Status Derivation (Closed Precedence Hierarchy)
  let status: TeamBuildEvaluationStatus;
  const anyPatchMismatch = memberEvals.some((ev) => ev.status === 'PATCH_MISMATCH');
  const anyInvalid = memberEvals.some((ev) => ev.status === 'INVALID');
  const allBuildUnknown = memberEvals.every((ev) => ev.status === 'BUILD_UNKNOWN');
  const someBuildUnknown = memberEvals.some((ev) => ev.status === 'BUILD_UNKNOWN');
  const allUnequipped = memberEvals.every((ev) => ev.status === 'UNEQUIPPED');
  const allFullyEquipped = memberEvals.every((ev) => ev.status === 'FULLY_EQUIPPED');

  if (anyPatchMismatch) {
    status = 'PATCH_MISMATCH';
  } else if (anyInvalid) {
    status = 'INVALID';
  } else if (hasIncompatibleWeapon) {
    status = 'INCOMPATIBLE_WEAPON';
  } else if (allBuildUnknown) {
    status = 'BUILD_UNKNOWN';
  } else if (allUnequipped) {
    status = 'UNEQUIPPED';
  } else if (allFullyEquipped) {
    status = 'FULLY_EQUIPPED';
  } else if (someBuildUnknown) {
    status = 'PARTIALLY_UNKNOWN';
  } else {
    status = 'PARTIALLY_EQUIPPED';
  }

  // 9. Explanation Codes
  const explanationCodes: string[] = [
    `STATUS_${status}`
  ];

  if (allCompatible) {
    explanationCodes.push(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.ALL_WEAPONS_COMPATIBLE);
  }
  if (hasIncompatibleWeapon) {
    explanationCodes.push(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.HAS_INCOMPATIBLE_WEAPON);
  }
  if (echoEquippedCount === TEAM_MEMBER_COUNT) {
    explanationCodes.push(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.ALL_MEMBERS_EQUIPPED);
  }
  if (hasDuplicateSonataSets) {
    explanationCodes.push(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.DUPLICATE_SONATA_SETS_PRESENT);
  }
  explanationCodes.push(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.SONATA_STACKING_UNMODELED);
  if (knownTeamAspects === TEAM_TOTAL_ASPECTS_COUNT) {
    explanationCodes.push(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.ALL_MEMBERS_BUILD_COMPLETE);
  }

  // 10. Provenance
  const provenance: TeamBuildEvaluationProvenance = Object.freeze({
    source: 'DERIVED_TEAM_BUILD_EVALUATION',
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_BUILD_EVALUATION_RULE_VERSION,
    teamCandidateId,
    memberBuildEvaluationIds: Object.freeze([
      memberEvals[0].id,
      memberEvals[1].id,
      memberEvals[2].id
    ]) as unknown as readonly [string, string, string],
    upstreamBuildEvaluationRuleVersion: REQUIRED_STEP20_RULE_VERSION,
    upstreamTeamCandidateRuleVersion: REQUIRED_STEP9_RULE_VERSION
  });

  // 11. Deterministic Identifier
  const id = deriveTeamBuildEvaluationId(sortedMembers, patchId, TEAM_BUILD_EVALUATION_RULE_VERSION);

  return Object.freeze({
    id,
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_BUILD_EVALUATION_RULE_VERSION,
    teamCandidateId,
    memberResonatorIds: sortedMembers,
    status,
    memberBuildEvaluations: Object.freeze([
      memberEvals[0],
      memberEvals[1],
      memberEvals[2]
    ]) as unknown as readonly [CharacterBuildEvaluation, CharacterBuildEvaluation, CharacterBuildEvaluation],
    weaponAggregation,
    echoAggregation,
    sonataInteraction,
    completeness,
    explanationCodes: Object.freeze(explanationCodes),
    provenance
  });
}

/**
 * Builds a deterministic collection of TeamBuildEvaluation records across
 * requested candidate triples or production Step 9 candidates.
 */
export function buildTeamBuildEvaluations(
  input?: TeamBuildEvaluationInput
): TeamBuildEvaluationResult {
  const patchId = input?.patchId ?? CANONICAL_PATCH_VERSION;
  if (!patchId || typeof patchId !== 'string' || patchId.trim() !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchId '${patchId}'. Step 21 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  // 1. Resolve & Validate CharacterBuildEvaluations
  const evalMap = new Map<string, CharacterBuildEvaluation>();
  const rawCharEvals = input?.characterBuildEvaluations ?? getAllCharacterBuildEvaluations();

  for (let i = 0; i < rawCharEvals.length; i++) {
    const ev = rawCharEvals[i];
    if (!ev) {
      throw new Error(`Null CharacterBuildEvaluation record at index ${i}.`);
    }
    if (!ev.resonatorId || !isCanonicalResonatorId(ev.resonatorId)) {
      throw new Error(
        `Character ID '${ev?.resonatorId}' in build evaluation at index ${i} is not a canonical Patch ${CANONICAL_PATCH_VERSION} Resonator.`
      );
    }
    if (ev.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `CharacterBuildEvaluation record for '${ev.resonatorId}' has invalid patchVersion '${ev.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
      );
    }
    if (ev.ruleVersion !== REQUIRED_STEP20_RULE_VERSION) {
      throw new Error(
        `CharacterBuildEvaluation record for '${ev.resonatorId}' has invalid ruleVersion '${ev.ruleVersion}'. Expected '${REQUIRED_STEP20_RULE_VERSION}'.`
      );
    }
    if (evalMap.has(ev.resonatorId)) {
      throw new Error(`Duplicate CharacterBuildEvaluation record for character '${ev.resonatorId}'.`);
    }
    evalMap.set(ev.resonatorId, ev);
  }

  // 2. Resolve Candidate Triples
  type CanonicalTriple = readonly [string, string, string];
  const candidateTriples: CanonicalTriple[] = [];
  const seenCandidateKeys = new Set<string>();
  const usedCharacterIds = new Set<string>();

  if (input?.teamCandidates !== undefined) {
    if (input.teamCandidates.length === 0) {
      throw new Error('teamCandidates cannot be an empty array.');
    }

    for (let i = 0; i < input.teamCandidates.length; i++) {
      const triple = input.teamCandidates[i];
      if (!Array.isArray(triple) || triple.length !== TEAM_MEMBER_COUNT) {
        throw new Error(
          `Candidate triple at index ${i} must have exactly ${TEAM_MEMBER_COUNT} members, got ${triple?.length ?? 0}.`
        );
      }
      const distinct = new Set<string>();
      for (let j = 0; j < triple.length; j++) {
        const id = triple[j];
        if (!id || typeof id !== 'string' || !isCanonicalResonatorId(id)) {
          throw new Error(
            `Non-canonical Resonator ID '${id}' in candidate triple at index ${i}, member ${j}.`
          );
        }
        if (distinct.has(id)) {
          throw new Error(
            `Duplicate Resonator '${id}' in candidate triple at index ${i}. Must contain distinct members.`
          );
        }
        distinct.add(id);
      }

      const sorted = [...triple].sort((a, b) => a.localeCompare(b)) as [string, string, string];
      const key = `${sorted[0]}:::${sorted[1]}:::${sorted[2]}`;

      if (!seenCandidateKeys.has(key)) {
        seenCandidateKeys.add(key);
        candidateTriples.push(sorted);
        usedCharacterIds.add(sorted[0]);
        usedCharacterIds.add(sorted[1]);
        usedCharacterIds.add(sorted[2]);
      }
    }

    // Extra records rejection when characterBuildEvaluations was explicitly supplied
    if (input.characterBuildEvaluations !== undefined) {
      for (const ev of input.characterBuildEvaluations) {
        if (!usedCharacterIds.has(ev.resonatorId)) {
          throw new Error(
            `Extra character build evaluation record for '${ev.resonatorId}' not present in requested team candidates.`
          );
        }
      }
    }
  } else {
    // Default: production Step 9 candidates
    const step9Candidates = getTeamCompositionCandidates();
    for (const c of step9Candidates) {
      const sorted = c.memberResonatorIds;
      const key = `${sorted[0]}:::${sorted[1]}:::${sorted[2]}`;
      if (!seenCandidateKeys.has(key)) {
        seenCandidateKeys.add(key);
        candidateTriples.push(sorted);
        usedCharacterIds.add(sorted[0]);
        usedCharacterIds.add(sorted[1]);
        usedCharacterIds.add(sorted[2]);
      }
    }
  }

  // 3. Evaluate Each Candidate
  const evaluations: TeamBuildEvaluation[] = [];
  let totalFullyEquipped = 0;
  let totalPartiallyEquipped = 0;
  let totalUnequipped = 0;
  let totalIncompatibleWeapon = 0;
  let totalBuildUnknown = 0;
  let totalPartiallyUnknown = 0;
  let totalAllWeaponsCompatible = 0;
  let totalWithDuplicateSonataSets = 0;
  let completenessSum = 0;
  let completenessCount = 0;

  for (const triple of candidateTriples) {
    const evaluation = evaluateTeamBuild(triple, evalMap, patchId);
    evaluations.push(evaluation);

    switch (evaluation.status) {
      case 'FULLY_EQUIPPED':
        totalFullyEquipped++;
        break;
      case 'PARTIALLY_EQUIPPED':
        totalPartiallyEquipped++;
        break;
      case 'UNEQUIPPED':
        totalUnequipped++;
        break;
      case 'INCOMPATIBLE_WEAPON':
        totalIncompatibleWeapon++;
        break;
      case 'BUILD_UNKNOWN':
        totalBuildUnknown++;
        break;
      case 'PARTIALLY_UNKNOWN':
        totalPartiallyUnknown++;
        break;
    }

    if (evaluation.weaponAggregation.allCompatible) {
      totalAllWeaponsCompatible++;
    }
    if (evaluation.sonataInteraction.hasDuplicateSonataSets) {
      totalWithDuplicateSonataSets++;
    }
    if (evaluation.completeness.teamCompletenessRatio !== null) {
      completenessSum += evaluation.completeness.teamCompletenessRatio;
      completenessCount++;
    }
  }

  // Deterministic stable sorting
  evaluations.sort(compareTeamBuildEvaluations);

  const averageTeamCompletenessRatio =
    completenessCount > 0
      ? Math.round((completenessSum / completenessCount) * 10000) / 10000
      : null;

  const summary: TeamBuildEvaluationResultSummary = Object.freeze({
    totalEvaluations: evaluations.length,
    totalFullyEquipped,
    totalPartiallyEquipped,
    totalUnequipped,
    totalIncompatibleWeapon,
    totalBuildUnknown,
    totalPartiallyUnknown,
    totalAllWeaponsCompatible,
    totalWithDuplicateSonataSets,
    averageTeamCompletenessRatio
  });

  const uniqueCandidateIds = new Set(evaluations.map((e) => e.teamCandidateId)).size;

  const audit: TeamBuildEvaluationAuditMetrics = Object.freeze({
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_BUILD_EVALUATION_RULE_VERSION,
    totalEvaluations: evaluations.length,
    uniqueTeamCandidateIds: uniqueCandidateIds,
    characterBuildEvaluationsMatched: usedCharacterIds.size,
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });

  return Object.freeze({
    patchId: CANONICAL_PATCH_VERSION,
    ruleVersion: TEAM_BUILD_EVALUATION_RULE_VERSION,
    evaluations: Object.freeze(evaluations),
    summary,
    audit
  });
}
