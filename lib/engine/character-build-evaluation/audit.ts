/**
 * Wuthering Waves Character Build Evaluation Production Auditor
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Implements strict runtime validation and audit checks for CharacterBuildEvaluation
 * records, enforcing boundary safety, prohibited key exclusion, and epistemic fidelity.
 */

import {
  CHARACTER_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP19_RULE_VERSION,
  REQUIRED_STEP13_RULE_VERSION,
  CANONICAL_RESONATOR_METADATA,
  CANONICAL_WEAPON_METADATA,
  CANONICAL_SONATA_METADATA,
  getCanonicalSonataMetadata,
  PROHIBITED_BUILD_EVALUATION_KEYS,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  compareCharacterBuildEvaluations,
  deriveCharacterBuildEvaluationId
} from './predicates.ts';
import {
  isCanonicalResonatorId,
  isCanonicalWeaponId,
  isCanonicalSonataId
} from '../investment/predicates.ts';
import { getCharacterBuildEvaluationResult } from './repository.ts';
import type {
  CharacterBuildEvaluation,
  CharacterBuildEvaluationResult
} from './types.ts';

/**
 * Normalizes a key name for prohibited key comparison by removing
 * hyphens, underscores, and whitespace, and converting to lowercase.
 */
export function normalizeProhibitedKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

const NORMALIZED_PROHIBITED_BUILD_EVALUATION_KEYS = new Set(
  PROHIBITED_BUILD_EVALUATION_KEYS.map((k) => normalizeProhibitedKey(k))
);

/**
 * Asserts that no prohibited keys (e.g. characterPower, dps, metaRank, teamScore, team_score)
 * appear anywhere in a record tree.
 */
export function assertNoProhibitedBuildEvaluationKeys(record: unknown, path: string = 'root'): void {
  if (record === null || record === undefined) return;
  if (typeof record !== 'object') return;

  if (Array.isArray(record)) {
    for (let i = 0; i < record.length; i++) {
      assertNoProhibitedBuildEvaluationKeys(record[i], `${path}[${i}]`);
    }
    return;
  }

  const obj = record as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const normalized = normalizeProhibitedKey(key);
    if (NORMALIZED_PROHIBITED_BUILD_EVALUATION_KEYS.has(normalized)) {
      throw new Error(
        `Prohibited key '${key}' detected at '${path}.${key}'. Violates Step 20 boundary isolation.`
      );
    }
    assertNoProhibitedBuildEvaluationKeys(obj[key], `${path}.${key}`);
  }
}

/**
 * Strictly audits a single CharacterBuildEvaluation record.
 */
export function auditSingleCharacterBuildEvaluation(
  evaluation: CharacterBuildEvaluation,
  expectedIndex?: number
): void {
  const prefix = `BuildEvaluation[${evaluation.resonatorId}]`;

  // Invariant A: Patch version isolation
  if (evaluation.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`${prefix}: Invalid patchVersion '${evaluation.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`);
  }

  // Invariant B: Step 20 Rule version
  if (evaluation.ruleVersion !== CHARACTER_BUILD_EVALUATION_RULE_VERSION) {
    throw new Error(`${prefix}: Invalid ruleVersion '${evaluation.ruleVersion}'. Expected '${CHARACTER_BUILD_EVALUATION_RULE_VERSION}'.`);
  }

  // Invariant C: Canonical Resonator identity
  if (!isCanonicalResonatorId(evaluation.resonatorId)) {
    throw new Error(`${prefix}: Non-canonical resonatorId '${evaluation.resonatorId}'.`);
  }

  // Invariant D: Deterministic ID derivation
  const expectedId = deriveCharacterBuildEvaluationId(
    evaluation.resonatorId,
    CANONICAL_PATCH_VERSION,
    CHARACTER_BUILD_EVALUATION_RULE_VERSION
  );
  if (evaluation.id !== expectedId) {
    throw new Error(`${prefix}: ID mismatch. Expected '${expectedId}', got '${evaluation.id}'.`);
  }

  // Invariant E: Canonical Resonator metadata consistency
  const resMeta = CANONICAL_RESONATOR_METADATA[evaluation.resonatorId];
  if (!resMeta) {
    throw new Error(`${prefix}: Missing canonical metadata.`);
  }
  if (evaluation.element !== resMeta.element) {
    throw new Error(`${prefix}: Element mismatch. Expected '${resMeta.element}', got '${evaluation.element}'.`);
  }
  if (evaluation.weaponType !== resMeta.weaponType) {
    throw new Error(`${prefix}: WeaponType mismatch. Expected '${resMeta.weaponType}', got '${evaluation.weaponType}'.`);
  }
  if (evaluation.rarity !== resMeta.rarity) {
    throw new Error(`${prefix}: Rarity mismatch. Expected ${resMeta.rarity}, got ${evaluation.rarity}.`);
  }

  // Invariant F: Weapon evaluation integrity
  const w = evaluation.weaponEvaluation;
  if (!w) {
    throw new Error(`${prefix}: Missing weaponEvaluation.`);
  }
  if (w.resonatorWeaponType !== resMeta.weaponType) {
    throw new Error(`${prefix}: weaponEvaluation.resonatorWeaponType mismatch.`);
  }
  if (w.isEquipped) {
    if (!w.weaponId) {
      throw new Error(`${prefix}: isEquipped is true but weaponId is null.`);
    }
    if (isCanonicalWeaponId(w.weaponId)) {
      const wMeta = CANONICAL_WEAPON_METADATA[w.weaponId];
      if (w.weaponType !== wMeta.weaponType) {
        throw new Error(`${prefix}: weaponType '${w.weaponType}' does not match canonical weapon metadata '${wMeta.weaponType}'.`);
      }
      const expectedCompat = wMeta.weaponType === resMeta.weaponType ? 'COMPATIBLE' : 'INCOMPATIBLE';
      if (w.compatibility !== expectedCompat) {
        throw new Error(`${prefix}: compatibility '${w.compatibility}' mismatch. Expected '${expectedCompat}'.`);
      }
    }
  } else {
    if (w.compatibility !== 'NOT_EQUIPPED') {
      throw new Error(`${prefix}: isEquipped is false but compatibility is '${w.compatibility}'.`);
    }
  }

  // Invariant G: Echo loadout evaluation integrity
  const e = evaluation.echoEvaluation;
  if (!e) {
    throw new Error(`${prefix}: Missing echoEvaluation.`);
  }
  if (e.hasLoadout) {
    if (e.equippedCount !== null && (e.equippedCount < 0 || e.equippedCount > 5)) {
      throw new Error(`${prefix}: echo equippedCount out of bounds [0, 5].`);
    }
    if (e.tunedCount !== null && (e.tunedCount < 0 || e.tunedCount > 5)) {
      throw new Error(`${prefix}: echo tunedCount out of bounds [0, 5].`);
    }
    if (e.maxLevelCount !== null && (e.maxLevelCount < 0 || e.maxLevelCount > 5)) {
      throw new Error(`${prefix}: echo maxLevelCount out of bounds [0, 5].`);
    }
    if (e.activeSonataSetCode && isCanonicalSonataId(e.activeSonataSetCode)) {
      const sMeta = getCanonicalSonataMetadata(e.activeSonataSetCode);
      if (sMeta) {
        const expectedAlign = sMeta.alignmentType === 'UNIVERSAL'
          ? 'UNIVERSAL'
          : (sMeta.element === resMeta.element ? 'ELEMENT_ALIGNED' : 'MISALIGNED');
        if (e.sonataAlignment !== expectedAlign) {
          throw new Error(`${prefix}: sonataAlignment '${e.sonataAlignment}' mismatch. Expected '${expectedAlign}'.`);
        }
      }
    }
  } else {
    if (e.sonataAlignment !== 'NOT_EQUIPPED') {
      throw new Error(`${prefix}: hasLoadout is false but sonataAlignment is '${e.sonataAlignment}'.`);
    }
  }

  // Invariant H: Completeness metrics integrity
  const c = evaluation.completeness;
  if (!c) {
    throw new Error(`${prefix}: Missing completeness metrics.`);
  }
  if (c.totalAspects !== 6) {
    throw new Error(`${prefix}: totalAspects must be 6.`);
  }
  if (c.knownAspects + c.unknownAspects !== 6) {
    throw new Error(
      `${prefix}: knownAspects (${c.knownAspects}) + unknownAspects (${c.unknownAspects}) !== 6.`
    );
  }
  if (c.completenessRatio !== null && (c.completenessRatio < 0 || c.completenessRatio > 1)) {
    throw new Error(`${prefix}: completenessRatio out of bounds [0.0000, 1.0000].`);
  }

  // Invariant I: Immutability
  if (!Object.isFrozen(evaluation)) {
    throw new Error(`${prefix}: Evaluation object must be frozen.`);
  }
  if (!Object.isFrozen(evaluation.weaponEvaluation)) {
    throw new Error(`${prefix}: weaponEvaluation must be frozen.`);
  }
  if (!Object.isFrozen(evaluation.echoEvaluation)) {
    throw new Error(`${prefix}: echoEvaluation must be frozen.`);
  }
  if (!Object.isFrozen(evaluation.completeness)) {
    throw new Error(`${prefix}: completeness must be frozen.`);
  }
  if (!Object.isFrozen(evaluation.provenance)) {
    throw new Error(`${prefix}: provenance must be frozen.`);
  }

  // Invariant J: Tree-wide prohibited keys
  assertNoProhibitedBuildEvaluationKeys(evaluation, prefix);
}

/**
 * Audits a complete CharacterBuildEvaluationResult collection against all production invariants.
 */
export function auditCharacterBuildEvaluations(result: CharacterBuildEvaluationResult): void {
  if (!result) {
    throw new Error('Audit failed: result is null or undefined.');
  }

  if (result.patchId !== CANONICAL_PATCH_VERSION) {
    throw new Error(`Audit failed: patchId '${result.patchId}' must be strictly '${CANONICAL_PATCH_VERSION}'.`);
  }

  if (result.ruleVersion !== CHARACTER_BUILD_EVALUATION_RULE_VERSION) {
    throw new Error(`Audit failed: ruleVersion '${result.ruleVersion}' must be strictly '${CHARACTER_BUILD_EVALUATION_RULE_VERSION}'.`);
  }

  if (!Object.isFrozen(result)) {
    throw new Error('Audit failed: Result container must be frozen.');
  }
  if (!Object.isFrozen(result.evaluations)) {
    throw new Error('Audit failed: Result evaluations array must be frozen.');
  }
  if (!Object.isFrozen(result.summary)) {
    throw new Error('Audit failed: Result summary must be frozen.');
  }
  if (!Object.isFrozen(result.audit)) {
    throw new Error('Audit failed: Result audit metrics must be frozen.');
  }

  const seenIds = new Set<string>();
  const evals = result.evaluations;

  let totalFullyEquipped = 0;
  let totalPartiallyEquipped = 0;
  let totalUnequipped = 0;
  let totalIncompatibleWeapon = 0;
  let totalBuildUnknown = 0;
  let totalElementAligned = 0;
  let totalUniversalSonata = 0;
  let totalMisalignedSonata = 0;

  for (let i = 0; i < evals.length; i++) {
    const ev = evals[i];
    auditSingleCharacterBuildEvaluation(ev, i);

    if (seenIds.has(ev.resonatorId)) {
      throw new Error(`Audit failed: Duplicate resonatorId '${ev.resonatorId}' in evaluations list.`);
    }
    seenIds.add(ev.resonatorId);

    if (i > 0) {
      const prev = evals[i - 1];
      if (compareCharacterBuildEvaluations(prev, ev) >= 0) {
        throw new Error(
          `Audit failed: Evaluations out of canonical deterministic order at index ${i}: '${prev.resonatorId}' >= '${ev.resonatorId}'.`
        );
      }
    }

    if (ev.status === 'FULLY_EQUIPPED') totalFullyEquipped++;
    else if (ev.status === 'PARTIALLY_EQUIPPED') totalPartiallyEquipped++;
    else if (ev.status === 'UNEQUIPPED') totalUnequipped++;
    else if (ev.status === 'INCOMPATIBLE_WEAPON') totalIncompatibleWeapon++;
    else if (ev.status === 'BUILD_UNKNOWN') totalBuildUnknown++;

    if (ev.echoEvaluation.sonataAlignment === 'ELEMENT_ALIGNED') totalElementAligned++;
    else if (ev.echoEvaluation.sonataAlignment === 'UNIVERSAL') totalUniversalSonata++;
    else if (ev.echoEvaluation.sonataAlignment === 'MISALIGNED') totalMisalignedSonata++;
  }

  // Summary count verification
  const s = result.summary;
  if (s.totalEvaluations !== evals.length) {
    throw new Error(`Audit failed: summary totalEvaluations (${s.totalEvaluations}) !== evals.length (${evals.length}).`);
  }
  if (s.totalFullyEquipped !== totalFullyEquipped) {
    throw new Error(`Audit failed: summary totalFullyEquipped mismatch.`);
  }
  if (s.totalPartiallyEquipped !== totalPartiallyEquipped) {
    throw new Error(`Audit failed: summary totalPartiallyEquipped mismatch.`);
  }
  if (s.totalUnequipped !== totalUnequipped) {
    throw new Error(`Audit failed: summary totalUnequipped mismatch.`);
  }
  if (s.totalIncompatibleWeapon !== totalIncompatibleWeapon) {
    throw new Error(`Audit failed: summary totalIncompatibleWeapon mismatch.`);
  }
  if (s.totalBuildUnknown !== totalBuildUnknown) {
    throw new Error(`Audit failed: summary totalBuildUnknown mismatch.`);
  }
  if (s.totalElementAligned !== totalElementAligned) {
    throw new Error(`Audit failed: summary totalElementAligned mismatch.`);
  }
  if (s.totalUniversalSonata !== totalUniversalSonata) {
    throw new Error(`Audit failed: summary totalUniversalSonata mismatch.`);
  }
  if (s.totalMisalignedSonata !== totalMisalignedSonata) {
    throw new Error(`Audit failed: summary totalMisalignedSonata mismatch.`);
  }

  // Audit metrics verification
  const a = result.audit;
  if (a.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(`Audit failed: audit patchVersion mismatch.`);
  }
  if (a.ruleVersion !== CHARACTER_BUILD_EVALUATION_RULE_VERSION) {
    throw new Error(`Audit failed: audit ruleVersion mismatch.`);
  }
  if (a.totalEvaluations !== evals.length) {
    throw new Error(`Audit failed: audit totalEvaluations mismatch.`);
  }
  if (a.uniqueCharacterIds !== evals.length) {
    throw new Error(`Audit failed: audit uniqueCharacterIds mismatch.`);
  }
  if (a.verifiedAt !== OFFLINE_DETERMINISTIC_AUDIT_STAMP) {
    throw new Error(`Audit failed: audit verifiedAt must be '${OFFLINE_DETERMINISTIC_AUDIT_STAMP}'.`);
  }

  // Tree-wide prohibited key assertion
  assertNoProhibitedBuildEvaluationKeys(result, 'result');
}

/**
 * Runs a complete production audit on default canonical Patch 3.7 build evaluations.
 */
export function runProductionCharacterBuildEvaluationAudit(): CharacterBuildEvaluationResult {
  const result = getCharacterBuildEvaluationResult();
  auditCharacterBuildEvaluations(result);
  return result;
}
