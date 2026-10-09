/**
 * Wuthering Waves Deterministic Recommendation Orchestration Predicates & Validation
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Implements cycle-safe deep cloning/freezing, input snapshot validation,
 * prohibited key detection, and deterministic ID derivation.
 */

import crypto from 'node:crypto';
import {
  RECOMMENDATION_ORCHESTRATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  REQUIRED_STEP13_RULE_VERSION,
  MIN_PORTFOLIO_TARGET_K,
  MAX_PORTFOLIO_TARGET_K,
  PROHIBITED_RECOMMENDATION_ORCHESTRATION_KEYS
} from './rules.ts';
import { isCanonicalResonatorId, isValidCharacterLevel } from '../investment/predicates.ts';
import type {
  RecommendationOrchestrationInput,
  RecommendationOrchestrationStatus,
  ValidatedInputSnapshotSummary,
  SnapshotFingerprintInput,
  OwnedRosterSnapshot,
  ResonatorInvestmentSnapshot
} from './types.ts';

/**
 * Cycle-safe recursive deep cloning utility.
 * Strictly supports plain objects, arrays, primitives, and null.
 * Rejects unsupported object instances (Map, Set, Date, class instances, typed arrays, etc.) by throwing TypeError.
 */
export function deepClone<T>(val: T, seen: WeakMap<object, unknown> = new WeakMap()): T {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (seen.has(val as object)) {
    return seen.get(val as object) as T;
  }

  if (Array.isArray(val)) {
    const copyArr: unknown[] = [];
    seen.set(val, copyArr);
    for (let i = 0; i < val.length; i++) {
      copyArr[i] = deepClone(val[i], seen);
    }
    return copyArr as unknown as T;
  }

  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(
      `deepClone: Unsupported non-plain object instance of type '${(val as any).constructor?.name ?? typeof val}'. Only plain objects, arrays, and primitives are supported.`
    );
  }

  const copyObj: Record<string, unknown> = {};
  seen.set(val as object, copyObj);
  for (const key of Object.keys(val)) {
    copyObj[key] = deepClone((val as Record<string, unknown>)[key], seen);
  }
  return copyObj as T;
}

/**
 * Cycle-safe recursive deep freeze utility.
 * Strictly supports plain objects, arrays, primitives, and null.
 * Rejects unsupported object instances by throwing TypeError.
 */
export function deepFreeze<T>(val: T, seen: WeakSet<object> = new WeakSet()): Readonly<T> {
  if (val === null || typeof val !== 'object' || Object.isFrozen(val)) {
    return val as Readonly<T>;
  }
  if (seen.has(val as object)) {
    return val as Readonly<T>;
  }
  seen.add(val as object);

  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      const item = val[i];
      if (item !== null && typeof item === 'object') {
        deepFreeze(item, seen);
      }
    }
    return Object.freeze(val) as Readonly<T>;
  }

  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(
      `deepFreeze: Unsupported non-plain object instance of type '${(val as any).constructor?.name ?? typeof val}'. Only plain objects, arrays, and primitives are supported.`
    );
  }

  for (const key of Object.keys(val)) {
    const prop = (val as Record<string, unknown>)[key];
    if (prop !== null && typeof prop === 'object') {
      deepFreeze(prop, seen);
    }
  }

  return Object.freeze(val) as Readonly<T>;
}

/**
 * Canonicalizes a single Resonator investment snapshot into an unambiguous deterministic representation.
 * Includes all decision-relevant fields: characterLevel, sequenceLevel, weapon details, echo details.
 */
function canonicalizeInvestmentSnapshot(inv: unknown): string {
  if (!inv || typeof inv !== 'object') return '';
  const obj = inv as Record<string, unknown>;

  const resonatorId = typeof obj.resonatorId === 'string' ? obj.resonatorId : '';

  let characterLevel: number | null = null;
  if (obj.characterLevel !== undefined && obj.characterLevel !== null) {
    if (typeof obj.characterLevel === 'object' && 'value' in (obj.characterLevel as object)) {
      characterLevel = (obj.characterLevel as { value: number | null }).value;
    } else if (typeof obj.characterLevel === 'number') {
      characterLevel = obj.characterLevel;
    }
  } else if (typeof obj.level === 'number') {
    characterLevel = obj.level;
  }

  let sequenceLevel: number | null = null;
  if (obj.sequenceLevel !== undefined && obj.sequenceLevel !== null) {
    if (typeof obj.sequenceLevel === 'object' && 'value' in (obj.sequenceLevel as object)) {
      sequenceLevel = (obj.sequenceLevel as { value: number | null }).value;
    } else if (typeof obj.sequenceLevel === 'number') {
      sequenceLevel = obj.sequenceLevel;
    }
  } else if (typeof obj.chain === 'number') {
    sequenceLevel = obj.chain;
  }

  let weaponId: string | null = null;
  let weaponLevel: number | null = null;
  let refinementRank: number | null = null;
  const weapon = (obj.weapon ?? obj.equippedWeapon) as Record<string, unknown> | undefined;
  if (weapon && typeof weapon === 'object') {
    weaponId = typeof weapon.weaponId === 'string' ? weapon.weaponId : null;
    if (weapon.weaponLevel !== undefined && weapon.weaponLevel !== null) {
      weaponLevel = typeof weapon.weaponLevel === 'object' && 'value' in (weapon.weaponLevel as object)
        ? (weapon.weaponLevel as { value: number | null }).value
        : (weapon.weaponLevel as number);
    } else if (typeof weapon.level === 'number') {
      weaponLevel = weapon.level;
    }
    if (weapon.refinementRank !== undefined && weapon.refinementRank !== null) {
      refinementRank = typeof weapon.refinementRank === 'object' && 'value' in (weapon.refinementRank as object)
        ? (weapon.refinementRank as { value: number | null }).value
        : (weapon.refinementRank as number);
    } else if (typeof weapon.refinementTier === 'number') {
      refinementRank = weapon.refinementTier;
    }
  }

  let echoEquippedCount: number | null = null;
  let echoTunedCount: number | null = null;
  let echoMaxLevelCount: number | null = null;
  let sonataSetId: string | null = null;
  const echo = (obj.echoInvestment ?? obj.echoLoadout) as Record<string, unknown> | undefined;
  if (echo && typeof echo === 'object') {
    if (echo.equippedCount !== undefined && echo.equippedCount !== null) {
      echoEquippedCount = typeof echo.equippedCount === 'object' && 'value' in (echo.equippedCount as object)
        ? ((echo.equippedCount as unknown as { value: number | null }).value)
        : (echo.equippedCount as number);
    }
    if (echo.tunedCount !== undefined && echo.tunedCount !== null) {
      echoTunedCount = typeof echo.tunedCount === 'object' && 'value' in (echo.tunedCount as object)
        ? ((echo.tunedCount as unknown as { value: number | null }).value)
        : (echo.tunedCount as number);
    }
    if (echo.maxLevelEchoCount !== undefined && echo.maxLevelEchoCount !== null) {
      echoMaxLevelCount = typeof echo.maxLevelEchoCount === 'object' && 'value' in (echo.maxLevelEchoCount as object)
        ? ((echo.maxLevelEchoCount as unknown as { value: number | null }).value)
        : (echo.maxLevelEchoCount as number);
    } else if (echo.maxLevelCount !== undefined && echo.maxLevelCount !== null) {
      echoMaxLevelCount = typeof echo.maxLevelCount === 'object' && 'value' in (echo.maxLevelCount as object)
        ? ((echo.maxLevelCount as unknown as { value: number | null }).value)
        : (echo.maxLevelCount as number);
    }
    if (typeof echo.sonataSetId === 'string') {
      sonataSetId = echo.sonataSetId;
    } else if (Array.isArray(echo.sonataSets) && echo.sonataSets[0] && typeof echo.sonataSets[0].sonataSetId === 'string') {
      sonataSetId = echo.sonataSets[0].sonataSetId;
    }
  }

  return JSON.stringify({
    characterLevel,
    echoEquippedCount,
    echoMaxLevelCount,
    echoTunedCount,
    refinementRank,
    resonatorId,
    sequenceLevel,
    sonataSetId,
    weaponId,
    weaponLevel
  });
}

/**
 * Derives a deterministic SHA-256 fingerprint for validated input constraints.
 * Canonicalizes patch version, season ID, sorted owned roster, target K, sorted stages, allowPartial,
 * and all decision-relevant investment state fields.
 */
export function deriveSnapshotFingerprint(
  summary: SnapshotFingerprintInput | Omit<ValidatedInputSnapshotSummary, 'snapshotFingerprint'>
): string {
  const patchVersion = (summary.patchVersion ?? CANONICAL_PATCH_VERSION).trim();
  const seasonId = (summary.seasonId ?? CANONICAL_SEASON_ID).trim();
  const ownedResonatorIds = [...summary.ownedResonatorIds].sort((a, b) => a.localeCompare(b));
  const targetK = summary.targetK;
  const targetStageIds = [...summary.targetStageIds].sort((a, b) => a.localeCompare(b));
  const allowPartial = summary.allowPartial ? true : false;

  let investmentPayload: string;
  if (summary.investmentSnapshots && summary.investmentSnapshots.length > 0) {
    const sortedSnapshots = [...summary.investmentSnapshots].sort((a, b) =>
      a.resonatorId.localeCompare(b.resonatorId)
    );
    investmentPayload = `[${sortedSnapshots.map((inv) => canonicalizeInvestmentSnapshot(inv)).join(',')}]`;
  } else {
    investmentPayload = `count:${summary.investmentSnapshotCount ?? 0}`;
  }

  const payload = JSON.stringify({
    allowPartial,
    investment: investmentPayload,
    ownedResonatorIds,
    patchVersion,
    seasonId,
    targetK,
    targetStageIds
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Derives the authoritative deterministic ID for an EndToEndRecommendation record.
 * Format: rec-orch:<patchVersion>:<seasonId>:<status>:<fingerprintHash>:<ruleVersion>
 */
export function deriveRecommendationOrchestrationId(
  status: RecommendationOrchestrationStatus,
  fingerprint: string,
  seasonId: string = CANONICAL_SEASON_ID,
  patchVersion: string = CANONICAL_PATCH_VERSION,
  ruleVersion: string = RECOMMENDATION_ORCHESTRATION_RULE_VERSION
): string {
  const shortHash = fingerprint.slice(0, 16);
  return `rec-orch:${patchVersion.trim()}:${seasonId.trim()}:${status}:${shortHash}:${ruleVersion.trim()}`;
}

/**
 * Validates RecommendationOrchestrationInput against strict contract boundaries.
 * Throws descriptive Error on invalid or contradictory input.
 */
export function validateRecommendationOrchestrationInput(
  input?: RecommendationOrchestrationInput
): void {
  if (!input) return;

  // Patch validation
  if (input.patchId !== undefined) {
    if (typeof input.patchId !== 'string' || input.patchId.trim() !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `validateRecommendationOrchestrationInput: Invalid patchId '${input.patchId}'. Strictly '${CANONICAL_PATCH_VERSION}' is supported.`
      );
    }
  }

  // Rule version validation
  if (input.ruleVersion !== undefined) {
    if (
      typeof input.ruleVersion !== 'string' ||
      input.ruleVersion.trim() !== RECOMMENDATION_ORCHESTRATION_RULE_VERSION
    ) {
      throw new Error(
        `validateRecommendationOrchestrationInput: Invalid ruleVersion '${input.ruleVersion}'. Strictly '${RECOMMENDATION_ORCHESTRATION_RULE_VERSION}' is supported.`
      );
    }
  }

  // Season ID validation
  if (input.seasonId !== undefined) {
    if (typeof input.seasonId !== 'string' || input.seasonId.trim() !== CANONICAL_SEASON_ID) {
      throw new Error(
        `validateRecommendationOrchestrationInput: Invalid seasonId '${input.seasonId}'. Strictly '${CANONICAL_SEASON_ID}' is supported.`
      );
    }
  }

  // Target K validation
  if (input.targetK !== undefined) {
    if (
      typeof input.targetK !== 'number' ||
      !Number.isInteger(input.targetK) ||
      input.targetK < MIN_PORTFOLIO_TARGET_K ||
      input.targetK > MAX_PORTFOLIO_TARGET_K
    ) {
      throw new Error(
        `validateRecommendationOrchestrationInput: Invalid targetK '${input.targetK}'. Must be integer between ${MIN_PORTFOLIO_TARGET_K} and ${MAX_PORTFOLIO_TARGET_K}.`
      );
    }
  }

  // Owned roster validation
  if (input.ownedRoster !== undefined) {
    let ids: readonly string[] = [];
    if (Array.isArray(input.ownedRoster)) {
      ids = input.ownedRoster;
    } else if (
      input.ownedRoster &&
      typeof input.ownedRoster === 'object' &&
      'ownedResonatorIds' in input.ownedRoster
    ) {
      const snap = input.ownedRoster as OwnedRosterSnapshot;
      if (snap.patchVersion && snap.patchVersion !== CANONICAL_PATCH_VERSION) {
        throw new Error(
          `validateRecommendationOrchestrationInput: OwnedRosterSnapshot has mismatched patchVersion '${snap.patchVersion}'.`
        );
      }
      ids = snap.ownedResonatorIds;
    } else {
      throw new Error(
        'validateRecommendationOrchestrationInput: ownedRoster must be an array of Resonator IDs or an OwnedRosterSnapshot.'
      );
    }

    const seenRosterIds = new Set<string>();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (typeof id !== 'string' || id.trim() === '') {
        throw new Error(
          `validateRecommendationOrchestrationInput: Owned roster contains invalid or empty Resonator ID at index ${i}.`
        );
      }
      if (!isCanonicalResonatorId(id)) {
        throw new Error(
          `validateRecommendationOrchestrationInput: Non-canonical Resonator ID '${id}' in owned roster snapshot.`
        );
      }
      if (seenRosterIds.has(id)) {
        throw new Error(
          `validateRecommendationOrchestrationInput: Duplicate Resonator ID '${id}' in owned roster snapshot.`
        );
      }
      seenRosterIds.add(id);
    }
  }

  // Investment snapshots validation
  if (input.investmentSnapshots !== undefined) {
    if (!Array.isArray(input.investmentSnapshots)) {
      throw new Error(
        'validateRecommendationOrchestrationInput: investmentSnapshots must be an array.'
      );
    }
    const seenInvestmentIds = new Set<string>();
    for (let i = 0; i < input.investmentSnapshots.length; i++) {
      const inv = input.investmentSnapshots[i];
      if (!inv || typeof inv !== 'object') {
        throw new Error(
          `validateRecommendationOrchestrationInput: Malformed investment snapshot record at index ${i}.`
        );
      }
      if (!inv.resonatorId || !isCanonicalResonatorId(inv.resonatorId)) {
        throw new Error(
          `validateRecommendationOrchestrationInput: Non-canonical Resonator ID '${inv?.resonatorId}' in investment snapshot at index ${i}.`
        );
      }
      if (inv.patchVersion !== CANONICAL_PATCH_VERSION) {
        throw new Error(
          `validateRecommendationOrchestrationInput: Investment snapshot for '${inv.resonatorId}' has invalid patchVersion '${inv.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
        );
      }
      if (inv.ruleVersion !== REQUIRED_STEP13_RULE_VERSION) {
        throw new Error(
          `validateRecommendationOrchestrationInput: Investment snapshot for '${inv.resonatorId}' has invalid ruleVersion '${inv.ruleVersion}'. Expected '${REQUIRED_STEP13_RULE_VERSION}'.`
        );
      }
      if (inv.characterLevel !== undefined && inv.characterLevel !== null) {
        const lvl = typeof inv.characterLevel === 'object' && 'value' in inv.characterLevel ? (inv.characterLevel as any).value : inv.characterLevel;
        if (lvl !== null && !isValidCharacterLevel(lvl)) {
          throw new Error(
            `validateRecommendationOrchestrationInput: Investment snapshot for '${inv.resonatorId}' has invalid characterLevel '${lvl}'.`
          );
        }
      }
      if ((inv as any).level !== undefined) {
        const lvl = (inv as any).level;
        if (!isValidCharacterLevel(lvl)) {
          throw new Error(
            `validateRecommendationOrchestrationInput: Investment snapshot for '${inv.resonatorId}' has invalid level '${lvl}'.`
          );
        }
      }
      if (seenInvestmentIds.has(inv.resonatorId)) {
        throw new Error(
          `validateRecommendationOrchestrationInput: Duplicate investment snapshot record for character '${inv.resonatorId}'.`
        );
      }
      seenInvestmentIds.add(inv.resonatorId);
    }

    if (input.ownedRoster !== undefined) {
      let ownedIds: readonly string[];
      if (Array.isArray(input.ownedRoster)) {
        ownedIds = input.ownedRoster;
      } else if (
        input.ownedRoster &&
        typeof input.ownedRoster === 'object' &&
        'ownedResonatorIds' in input.ownedRoster
      ) {
        ownedIds = (input.ownedRoster as OwnedRosterSnapshot).ownedResonatorIds;
      } else {
        ownedIds = [];
      }
      const ownedSet = new Set(ownedIds);
      for (const inv of input.investmentSnapshots) {
        if (!ownedSet.has(inv.resonatorId)) {
          throw new Error(
            `validateRecommendationOrchestrationInput: Investment snapshot for unowned Resonator '${inv.resonatorId}'. All investment snapshots must belong to owned roster.`
          );
        }
      }
    }
  }

  // Target stage IDs validation
  if (input.targetStageIds !== undefined) {
    if (!Array.isArray(input.targetStageIds)) {
      throw new Error(
        'validateRecommendationOrchestrationInput: targetStageIds must be an array of string identifiers.'
      );
    }
    const seenStageIds = new Set<string>();
    for (let i = 0; i < input.targetStageIds.length; i++) {
      const id = input.targetStageIds[i];
      if (typeof id !== 'string' || id.trim() === '') {
        throw new Error(
          `validateRecommendationOrchestrationInput: targetStageIds contains empty identifier at index ${i}.`
        );
      }
      if (seenStageIds.has(id)) {
        throw new Error(
          `validateRecommendationOrchestrationInput: Duplicate target stage ID '${id}' in targetStageIds.`
        );
      }
      seenStageIds.add(id);
    }
  }
}

/**
 * Recursively asserts that no prohibited keys appear anywhere in an object.
 */
export function assertNoProhibitedRecommendationKeys(
  target: unknown,
  path: string = 'root'
): void {
  if (!target || typeof target !== 'object') {
    return;
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      assertNoProhibitedRecommendationKeys(target[i], `${path}[${i}]`);
    }
    return;
  }

  const obj = target as Record<string, unknown>;
  const prohibitedNormalized = new Set(
    PROHIBITED_RECOMMENDATION_ORCHESTRATION_KEYS.map((k) => k.toLowerCase().replace(/[-_]/g, ''))
  );

  for (const key of Object.keys(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (prohibitedNormalized.has(normalizedKey)) {
      throw new Error(
        `assertNoProhibitedRecommendationKeys: Prohibited key '${key}' detected at '${path}.${key}'. End-to-end recommendation strictly forbids scoring, power, and combat performance metrics.`
      );
    }
    assertNoProhibitedRecommendationKeys(obj[key], `${path}.${key}`);
  }
}
