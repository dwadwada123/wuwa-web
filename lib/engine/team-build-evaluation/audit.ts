/**
 * Wuthering Waves Team Build Evaluation Production Auditor
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Implements strict runtime validation and audit checks for TeamBuildEvaluation
 * records, enforcing boundary safety, prohibited key exclusion, completeness algebra,
 * and epistemic fidelity.
 */

import {
  TEAM_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP20_RULE_VERSION,
  REQUIRED_STEP9_RULE_VERSION,
  TEAM_MEMBER_COUNT,
  TEAM_TOTAL_ASPECTS_COUNT,
  PROHIBITED_TEAM_BUILD_EVALUATION_KEYS,
  TEAM_BUILD_EVALUATION_EXPLANATION_CODES,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  deriveTeamBuildEvaluationId,
  compareTeamBuildEvaluations
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getTeamBuildEvaluationResult } from './repository.ts';
import type {
  TeamBuildEvaluation,
  TeamBuildEvaluationStatus,
  TeamBuildEvaluationResult
} from './types.ts';

/**
 * Normalizes a key name for prohibited key comparison by removing
 * hyphens, underscores, and whitespace, and converting to lowercase.
 */
export function normalizeProhibitedKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

const NORMALIZED_PROHIBITED_TEAM_BUILD_KEYS = new Set(
  PROHIBITED_TEAM_BUILD_EVALUATION_KEYS.map((k) => normalizeProhibitedKey(k))
);

/**
 * Asserts that no prohibited keys (e.g. combatPower, teamScore, dps, tier, metaRank)
 * appear anywhere in a record tree.
 */
export function assertNoProhibitedTeamBuildEvaluationKeys(
  record: unknown,
  path: string = 'root'
): void {
  if (record === null || record === undefined) return;
  if (typeof record !== 'object') return;

  if (Array.isArray(record)) {
    for (let i = 0; i < record.length; i++) {
      assertNoProhibitedTeamBuildEvaluationKeys(record[i], `${path}[${i}]`);
    }
    return;
  }

  const obj = record as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const normalized = normalizeProhibitedKey(key);
    if (NORMALIZED_PROHIBITED_TEAM_BUILD_KEYS.has(normalized)) {
      throw new Error(
        `Prohibited key '${key}' detected at '${path}.${key}'. Violates Step 21 boundary isolation.`
      );
    }
    assertNoProhibitedTeamBuildEvaluationKeys(obj[key], `${path}.${key}`);
  }
}

/**
 * Strictly audits a single TeamBuildEvaluation record against all contract invariants.
 */
export function auditSingleTeamBuildEvaluation(
  evaluation: TeamBuildEvaluation,
  expectedIndex?: number
): void {
  const prefix = `TeamBuildEvaluation[${evaluation.id}]`;

  // Invariant A: Patch version isolation
  if (evaluation.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `${prefix}: Invalid patchVersion '${evaluation.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  // Invariant B: Step 21 Rule version
  if (evaluation.ruleVersion !== TEAM_BUILD_EVALUATION_RULE_VERSION) {
    throw new Error(
      `${prefix}: Invalid ruleVersion '${evaluation.ruleVersion}'. Expected '${TEAM_BUILD_EVALUATION_RULE_VERSION}'.`
    );
  }

  // Invariant C: Exactly three distinct canonical Resonator members in lexicographical order
  if (!Array.isArray(evaluation.memberResonatorIds) || evaluation.memberResonatorIds.length !== TEAM_MEMBER_COUNT) {
    throw new Error(
      `${prefix}: memberResonatorIds must contain exactly ${TEAM_MEMBER_COUNT} members, got ${evaluation.memberResonatorIds?.length}.`
    );
  }
  for (let i = 0; i < TEAM_MEMBER_COUNT; i++) {
    const id = evaluation.memberResonatorIds[i];
    if (!id || typeof id !== 'string' || !isCanonicalResonatorId(id)) {
      throw new Error(`${prefix}: Non-canonical member ID '${id}' at index ${i}.`);
    }
  }
  if (
    evaluation.memberResonatorIds[0] >= evaluation.memberResonatorIds[1] ||
    evaluation.memberResonatorIds[1] >= evaluation.memberResonatorIds[2]
  ) {
    throw new Error(
      `${prefix}: memberResonatorIds is not strictly sorted lexicographically: [${evaluation.memberResonatorIds.join(', ')}].`
    );
  }

  // Invariant D: Deterministic ID derivation
  const expectedId = deriveTeamBuildEvaluationId(
    evaluation.memberResonatorIds,
    evaluation.patchVersion,
    evaluation.ruleVersion
  );
  if (evaluation.id !== expectedId) {
    throw new Error(
      `${prefix}: ID mismatch. Expected '${expectedId}', got '${evaluation.id}'.`
    );
  }

  // Invariant E: Upstream candidate ID
  const expectedCandidateId = `team-composition:${CANONICAL_PATCH_VERSION}:${evaluation.memberResonatorIds[0]}:${evaluation.memberResonatorIds[1]}:${evaluation.memberResonatorIds[2]}:${REQUIRED_STEP9_RULE_VERSION}`;
  if (evaluation.teamCandidateId !== expectedCandidateId) {
    throw new Error(
      `${prefix}: teamCandidateId mismatch. Expected '${expectedCandidateId}', got '${evaluation.teamCandidateId}'.`
    );
  }

  // Invariant F: Preserved member build evaluations
  if (!Array.isArray(evaluation.memberBuildEvaluations) || evaluation.memberBuildEvaluations.length !== TEAM_MEMBER_COUNT) {
    throw new Error(`${prefix}: memberBuildEvaluations must have exactly ${TEAM_MEMBER_COUNT} records.`);
  }
  for (let i = 0; i < TEAM_MEMBER_COUNT; i++) {
    const ev = evaluation.memberBuildEvaluations[i];
    if (!ev) {
      throw new Error(`${prefix}: Null member build evaluation at index ${i}.`);
    }
    if (ev.resonatorId !== evaluation.memberResonatorIds[i]) {
      throw new Error(
        `${prefix}: Member evaluation at index ${i} has resonatorId '${ev.resonatorId}', expected '${evaluation.memberResonatorIds[i]}'.`
      );
    }
    if (ev.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `${prefix}: Member evaluation '${ev.resonatorId}' has invalid patchVersion '${ev.patchVersion}'.`
      );
    }
    if (ev.ruleVersion !== REQUIRED_STEP20_RULE_VERSION) {
      throw new Error(
        `${prefix}: Member evaluation '${ev.resonatorId}' has invalid ruleVersion '${ev.ruleVersion}'.`
      );
    }
  }

  // Invariant G: Weapon aggregation facts
  const w = evaluation.weaponAggregation;
  if (w.compatibleCount + w.incompatibleCount + w.unequippedCount + w.unknownCount !== TEAM_MEMBER_COUNT) {
    throw new Error(
      `${prefix}: Weapon aggregation sum must equal ${TEAM_MEMBER_COUNT}. Got ${w.compatibleCount + w.incompatibleCount + w.unequippedCount + w.unknownCount}.`
    );
  }
  if (w.allCompatible !== (w.compatibleCount === TEAM_MEMBER_COUNT)) {
    throw new Error(`${prefix}: allCompatible flag does not match compatibleCount.`);
  }
  if (w.hasIncompatibleWeapon !== (w.incompatibleCount > 0)) {
    throw new Error(`${prefix}: hasIncompatibleWeapon flag does not match incompatibleCount.`);
  }

  // Invariant H: Echo loadout aggregation facts
  const e = evaluation.echoAggregation;
  const sonataSum =
    e.elementAlignedSonataCount +
    e.universalSonataCount +
    e.misalignedSonataCount +
    e.unequippedSonataCount +
    e.unknownSonataCount;
  if (sonataSum !== TEAM_MEMBER_COUNT) {
    throw new Error(`${prefix}: Sonata alignment sum must equal ${TEAM_MEMBER_COUNT}, got ${sonataSum}.`);
  }

  // Invariant I: Sonata interaction facts
  const s = evaluation.sonataInteraction;
  if (!Array.isArray(s.memberSonataCodes) || s.memberSonataCodes.length !== TEAM_MEMBER_COUNT) {
    throw new Error(`${prefix}: memberSonataCodes must have exactly ${TEAM_MEMBER_COUNT} elements.`);
  }
  for (let i = 0; i < TEAM_MEMBER_COUNT; i++) {
    if (s.memberSonataCodes[i] !== evaluation.memberBuildEvaluations[i].echoEvaluation.activeSonataSetCode) {
      throw new Error(
        `${prefix}: memberSonataCodes[${i}] mismatch with member evaluation activeSonataSetCode.`
      );
    }
  }
  if (s.stackingStatus !== 'UNMODELED') {
    throw new Error(`${prefix}: stackingStatus must be strictly 'UNMODELED', got '${s.stackingStatus}'.`);
  }
  if (s.hasDuplicateSonataSets !== (s.duplicateSonataCodes.length > 0)) {
    throw new Error(`${prefix}: hasDuplicateSonataSets flag does not match duplicateSonataCodes.`);
  }

  // Invariant J: Completeness metrics algebra
  const c = evaluation.completeness;
  if (c.totalTeamAspects !== TEAM_TOTAL_ASPECTS_COUNT) {
    throw new Error(
      `${prefix}: totalTeamAspects must be ${TEAM_TOTAL_ASPECTS_COUNT}, got ${c.totalTeamAspects}.`
    );
  }
  if (c.knownTeamAspects + c.unknownTeamAspects !== TEAM_TOTAL_ASPECTS_COUNT) {
    throw new Error(
      `${prefix}: Completeness invariant violated: knownTeamAspects (${c.knownTeamAspects}) + unknownTeamAspects (${c.unknownTeamAspects}) !== ${TEAM_TOTAL_ASPECTS_COUNT}.`
    );
  }
  const sumMemberKnown =
    evaluation.memberBuildEvaluations[0].completeness.knownAspects +
    evaluation.memberBuildEvaluations[1].completeness.knownAspects +
    evaluation.memberBuildEvaluations[2].completeness.knownAspects;
  if (c.knownTeamAspects !== sumMemberKnown) {
    throw new Error(
      `${prefix}: knownTeamAspects (${c.knownTeamAspects}) does not equal sum of member knownAspects (${sumMemberKnown}).`
    );
  }
  const sumMemberUnknown =
    evaluation.memberBuildEvaluations[0].completeness.unknownAspects +
    evaluation.memberBuildEvaluations[1].completeness.unknownAspects +
    evaluation.memberBuildEvaluations[2].completeness.unknownAspects;
  if (c.unknownTeamAspects !== sumMemberUnknown) {
    throw new Error(
      `${prefix}: unknownTeamAspects (${c.unknownTeamAspects}) does not equal sum of member unknownAspects (${sumMemberUnknown}).`
    );
  }
  const allNull = c.memberCompletenessRatios.every((r) => r === null);
  if (allNull) {
    if (c.teamCompletenessRatio !== null) {
      throw new Error(`${prefix}: teamCompletenessRatio must be null when all member ratios are null.`);
    }
  } else {
    const expectedRatio = Math.round((c.knownTeamAspects / TEAM_TOTAL_ASPECTS_COUNT) * 10000) / 10000;
    if (c.teamCompletenessRatio !== expectedRatio) {
      throw new Error(
        `${prefix}: teamCompletenessRatio mismatch. Expected ${expectedRatio}, got ${c.teamCompletenessRatio}.`
      );
    }
  }

  // Invariant K: Provenance safety
  const p = evaluation.provenance;
  if (p.source !== 'DERIVED_TEAM_BUILD_EVALUATION') {
    throw new Error(`${prefix}: Invalid provenance source '${p.source}'.`);
  }
  if (p.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`${prefix}: Invalid provenance patchVersion '${p.patchVersion}'.`);
  }
  if (p.ruleVersion !== TEAM_BUILD_EVALUATION_RULE_VERSION) {
    throw new Error(`${prefix}: Invalid provenance ruleVersion '${p.ruleVersion}'.`);
  }
  if (p.upstreamBuildEvaluationRuleVersion !== REQUIRED_STEP20_RULE_VERSION) {
    throw new Error(`${prefix}: Invalid upstreamBuildEvaluationRuleVersion '${p.upstreamBuildEvaluationRuleVersion}'.`);
  }
  if (p.upstreamTeamCandidateRuleVersion !== REQUIRED_STEP9_RULE_VERSION) {
    throw new Error(`${prefix}: Invalid upstreamTeamCandidateRuleVersion '${p.upstreamTeamCandidateRuleVersion}'.`);
  }

  // Invariant L: Explanation codes
  if (!evaluation.explanationCodes.includes(`STATUS_${evaluation.status}`)) {
    throw new Error(`${prefix}: Missing status explanation code 'STATUS_${evaluation.status}'.`);
  }
  if (!evaluation.explanationCodes.includes(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.SONATA_STACKING_UNMODELED)) {
    throw new Error(`${prefix}: Missing SONATA_STACKING_UNMODELED explanation code.`);
  }

  // Invariant M: Prohibited keys rejection
  assertNoProhibitedTeamBuildEvaluationKeys(evaluation, prefix);

  // Invariant N: Status precedence consistency
  const anyPatchMismatch = evaluation.memberBuildEvaluations.some((ev) => ev.status === 'PATCH_MISMATCH');
  const anyInvalid = evaluation.memberBuildEvaluations.some((ev) => ev.status === 'INVALID');
  const allBuildUnknown = evaluation.memberBuildEvaluations.every((ev) => ev.status === 'BUILD_UNKNOWN');
  const someBuildUnknown = evaluation.memberBuildEvaluations.some((ev) => ev.status === 'BUILD_UNKNOWN');
  const allUnequipped = evaluation.memberBuildEvaluations.every((ev) => ev.status === 'UNEQUIPPED');
  const allFullyEquipped = evaluation.memberBuildEvaluations.every((ev) => ev.status === 'FULLY_EQUIPPED');

  let expectedStatus: TeamBuildEvaluationStatus;
  if (anyPatchMismatch) {
    expectedStatus = 'PATCH_MISMATCH';
  } else if (anyInvalid) {
    expectedStatus = 'INVALID';
  } else if (evaluation.weaponAggregation.hasIncompatibleWeapon) {
    expectedStatus = 'INCOMPATIBLE_WEAPON';
  } else if (allBuildUnknown) {
    expectedStatus = 'BUILD_UNKNOWN';
  } else if (allUnequipped) {
    expectedStatus = 'UNEQUIPPED';
  } else if (allFullyEquipped) {
    expectedStatus = 'FULLY_EQUIPPED';
  } else if (someBuildUnknown) {
    expectedStatus = 'PARTIALLY_UNKNOWN';
  } else {
    expectedStatus = 'PARTIALLY_EQUIPPED';
  }

  if (evaluation.status !== expectedStatus) {
    throw new Error(
      `${prefix}: Status mismatch with precedence rule. Expected '${expectedStatus}', got '${evaluation.status}'.`
    );
  }

  // Invariant O: Sonata interaction status consistency
  let expectedInteractionStatus: 'EVALUATED' | 'UNKNOWN' | 'NOT_EQUIPPED';
  if (
    evaluation.echoAggregation.unknownSonataCount > 0 ||
    evaluation.memberBuildEvaluations.some(
      (ev) =>
        ev.status === 'BUILD_UNKNOWN' ||
        ev.status === 'PATCH_MISMATCH' ||
        ev.status === 'INVALID'
    )
  ) {
    expectedInteractionStatus = 'UNKNOWN';
  } else if (evaluation.echoAggregation.unequippedSonataCount === TEAM_MEMBER_COUNT) {
    expectedInteractionStatus = 'NOT_EQUIPPED';
  } else {
    expectedInteractionStatus = 'EVALUATED';
  }

  if (evaluation.sonataInteraction.interactionStatus !== expectedInteractionStatus) {
    throw new Error(
      `${prefix}: Sonata interactionStatus mismatch. Expected '${expectedInteractionStatus}', got '${evaluation.sonataInteraction.interactionStatus}'.`
    );
  }
}

/**
 * Audits an entire TeamBuildEvaluationResult container and all child records.
 */
export function auditTeamBuildEvaluations(result: TeamBuildEvaluationResult): void {
  if (!result) {
    throw new Error('TeamBuildEvaluationResult is null or undefined.');
  }

  if (result.patchId !== CANONICAL_PATCH_VERSION) {
    throw new Error(`Invalid patchId '${result.patchId}'. Expected '${CANONICAL_PATCH_VERSION}'.`);
  }

  if (result.ruleVersion !== TEAM_BUILD_EVALUATION_RULE_VERSION) {
    throw new Error(`Invalid ruleVersion '${result.ruleVersion}'. Expected '${TEAM_BUILD_EVALUATION_RULE_VERSION}'.`);
  }

  if (!Array.isArray(result.evaluations)) {
    throw new Error('evaluations property must be an array.');
  }

  if (result.evaluations.length !== result.summary.totalEvaluations) {
    throw new Error(
      `Summary totalEvaluations (${result.summary.totalEvaluations}) does not match evaluations length (${result.evaluations.length}).`
    );
  }

  // Check strict sorting and unique IDs
  const seenIds = new Set<string>();
  for (let i = 0; i < result.evaluations.length; i++) {
    const ev = result.evaluations[i];
    if (seenIds.has(ev.id)) {
      throw new Error(`Duplicate evaluation ID '${ev.id}' at index ${i}.`);
    }
    seenIds.add(ev.id);

    if (i > 0) {
      const prev = result.evaluations[i - 1];
      const cmp = compareTeamBuildEvaluations(prev, ev);
      if (cmp >= 0) {
        throw new Error(
          `Evaluations array is not strictly sorted at index ${i}. '${prev.id}' >= '${ev.id}'.`
        );
      }
    }

    auditSingleTeamBuildEvaluation(ev, i);
  }

  // Assert no prohibited keys in summary or result
  assertNoProhibitedTeamBuildEvaluationKeys(result.summary, 'result.summary');
  assertNoProhibitedTeamBuildEvaluationKeys(result.audit, 'result.audit');
}

/**
 * Runs a complete production audit on the default Patch 3.7 TeamBuildEvaluation catalog.
 */
export function runProductionTeamBuildEvaluationAudit(): TeamBuildEvaluationResult {
  const result = getTeamBuildEvaluationResult();
  auditTeamBuildEvaluations(result);
  return result;
}
