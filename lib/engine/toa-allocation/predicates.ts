/**
 * Wuthering Waves Deterministic Tower of Adversity Allocation Predicates & Utilities
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Implements deterministic identifier derivation, feasibility predicates,
 * Vigor expenditure checks, element matching, and objective tuple comparison.
 */

import crypto from 'node:crypto';
import {
  TOA_ALLOCATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  REQUIRED_STEP22_RULE_VERSION,
  REQUIRED_STEP21_RULE_VERSION,
  RESONATOR_STARTING_VIGOR,
  MAX_RESONATOR_VIGOR,
  MIN_STAGE_VIGOR_COST,
  MAX_STAGE_VIGOR_COST,
  CANONICAL_ELEMENTS,
  PROHIBITED_TOA_ALLOCATION_KEYS,
  TEAM_MEMBER_COUNT,
  type CanonicalElement
} from './rules.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import type {
  ToAAllocationInput,
  ToAStageDefinition,
  ToAStageAssignment,
  ToAAllocationObjectiveTuple,
  TeamBuildEvaluation
} from './types.ts';

/**
 * Recursively deep-clones a plain object or array, ensuring caller-owned
 * objects are never mutated or frozen in place.
 */
export function deepClone<T>(val: T, seen = new WeakMap<object, unknown>()): T {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (seen.has(val)) {
    return seen.get(val) as T;
  }

  if (Array.isArray(val)) {
    const copy: unknown[] = [];
    seen.set(val, copy);
    for (let i = 0; i < val.length; i++) {
      copy.push(deepClone(val[i], seen));
    }
    return copy as T;
  }

  const copy: Record<string, unknown> = {};
  seen.set(val, copy);
  for (const key of Object.keys(val)) {
    copy[key] = deepClone((val as Record<string, unknown>)[key], seen);
  }
  return copy as T;
}

/**
 * Recursively deep-freezes an object or array in place.
 * Protects against cyclic references using a WeakSet.
 */
export function deepFreeze<T>(val: T, seen = new WeakSet<object>()): Readonly<T> {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (seen.has(val)) {
    return val as Readonly<T>;
  }
  seen.add(val);

  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      deepFreeze(val[i], seen);
    }
  } else {
    for (const key of Object.keys(val)) {
      const prop = (val as Record<string, unknown>)[key];
      if (prop !== null && typeof prop === 'object') {
        deepFreeze(prop, seen);
      }
    }
  }

  return Object.freeze(val) as Readonly<T>;
}

/**
 * Derives the authoritative deterministic ID for a ToAAllocation record.
 * Format: toa-alloc:<patchVersion>:<seasonId>:<assignedCount>of<targetCount>:<assignmentHash>:<ruleVersion>
 */
export function deriveToAAllocationId(
  assignments: readonly ToAStageAssignment[],
  targetStageCount: number,
  seasonId: string = CANONICAL_SEASON_ID,
  patchVersion: string = CANONICAL_PATCH_VERSION,
  ruleVersion: string = TOA_ALLOCATION_RULE_VERSION
): string {
  const assigned = assignments.filter((a) => a.isAssigned);
  const keyParts: string[] = [];

  // Sort assignments canonically by stageId
  const sorted = [...assignments].sort((a, b) => a.stage.stageId.localeCompare(b.stage.stageId));
  for (const a of sorted) {
    const teamId = a.team ? a.team.id : 'UNASSIGNED';
    keyParts.push(`${a.stage.stageId}:${teamId}`);
  }

  const hash = crypto
    .createHash('sha256')
    .update(keyParts.join('|'))
    .digest('hex')
    .slice(0, 16);

  return `toa-alloc:${patchVersion.trim()}:${seasonId.trim()}:${assigned.length}of${targetStageCount}:${hash}:${ruleVersion.trim()}`;
}

/**
 * Evaluates whether every member of a team has sufficient remaining Vigor
 * to be assigned to a stage.
 */
export function canTeamAffordStage(
  team: TeamBuildEvaluation,
  stage: ToAStageDefinition,
  usedVigorMap: ReadonlyMap<string, number>
): boolean {
  const cost = stage.vigorCost;
  for (const memberId of team.memberResonatorIds) {
    const used = usedVigorMap.get(memberId) ?? 0;
    if (used + cost > MAX_RESONATOR_VIGOR) {
      return false;
    }
  }
  return true;
}

/**
 * Calculates factual element matches between an evaluated team and a stage's beneficial elements.
 * Returns the count of matching members and the list of matching elements.
 */
export function calculateBuffMatches(
  team: TeamBuildEvaluation,
  stage: ToAStageDefinition
): { count: number; matchedElements: string[] } {
  if (!stage.beneficialElements || stage.beneficialElements.length === 0) {
    return { count: 0, matchedElements: [] };
  }

  const beneficialSet = new Set(stage.beneficialElements.map((e) => e.toLowerCase()));
  const matchedElements: string[] = [];
  let count = 0;

  for (const member of team.memberBuildEvaluations) {
    const element = member.element;
    if (element && beneficialSet.has(element.toLowerCase())) {
      count++;
      matchedElements.push(element);
    }
  }

  return {
    count,
    matchedElements: Object.freeze(matchedElements) as string[]
  };
}

/**
 * Builds the canonical assignment key string for deterministic tie-breaking.
 * Format: "stageId:teamId|stageId:teamId|..." sorted by stageId.
 */
export function buildCanonicalAssignmentKey(
  assignments: readonly { stageId: string; teamId: string | null }[]
): string {
  const sorted = [...assignments].sort((a, b) => a.stageId.localeCompare(b.stageId));
  return sorted.map((a) => `${a.stageId}:${a.teamId ?? 'UNASSIGNED'}`).join('|');
}

/**
 * Strictly compares two evaluated multi-dimensional objective tuples under lexicographic order.
 * Returns:
 *   < 0 if A is strictly better than B
 *   > 0 if B is strictly better than A
 *   0 if identical across all criteria
 */
export function compareObjectiveTuples(
  a: ToAAllocationObjectiveTuple,
  b: ToAAllocationObjectiveTuple
): number {
  // 1. Maximize stages completed
  if (b.stagesCompleted !== a.stagesCompleted) {
    return b.stagesCompleted - a.stagesCompleted;
  }

  // 2. Maximize beneficial buff element matches
  if (b.beneficialBuffMatches !== a.beneficialBuffMatches) {
    return b.beneficialBuffMatches - a.beneficialBuffMatches;
  }

  // 3. Minimize incompatible weapon assignments (lower is better)
  if (a.incompatibleWeaponAssignments !== b.incompatibleWeaponAssignments) {
    return a.incompatibleWeaponAssignments - b.incompatibleWeaponAssignments;
  }

  // 4. Maximize fully equipped team assignments
  if (b.fullyEquippedAssignments !== a.fullyEquippedAssignments) {
    return b.fullyEquippedAssignments - a.fullyEquippedAssignments;
  }

  // 5. Maximize total known build aspects across assigned teams
  if (b.totalKnownAspects !== a.totalKnownAspects) {
    return b.totalKnownAspects - a.totalKnownAspects;
  }

  // 6. Maximize total upstream synergy pairs
  if (b.totalSynergyPairs !== a.totalSynergyPairs) {
    return b.totalSynergyPairs - a.totalSynergyPairs;
  }

  // 7. Maximize total upstream directional synergy edges
  if (b.totalDirectionalEdges !== a.totalDirectionalEdges) {
    return b.totalDirectionalEdges - a.totalDirectionalEdges;
  }

  // 8. Deterministic tie-break: lexicographically smaller canonical assignment key
  return a.canonicalAssignmentKey.localeCompare(b.canonicalAssignmentKey);
}

/**
 * Validates ToAAllocationInput against fail-closed contract rules.
 * Throws descriptive Error on invalid input.
 */
export function validateToAAllocationInput(input?: ToAAllocationInput): void {
  if (!input) return;

  // Patch ID validation
  if (input.patchId !== undefined) {
    if (typeof input.patchId !== 'string' || input.patchId.trim() !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `validateToAAllocationInput: Invalid patchId '${input.patchId}'. Strictly '${CANONICAL_PATCH_VERSION}' is supported.`
      );
    }
  }

  // Rule version validation
  if (input.ruleVersion !== undefined) {
    if (
      typeof input.ruleVersion !== 'string' ||
      input.ruleVersion.trim() !== TOA_ALLOCATION_RULE_VERSION
    ) {
      throw new Error(
        `validateToAAllocationInput: Invalid ruleVersion '${input.ruleVersion}'. Strictly '${TOA_ALLOCATION_RULE_VERSION}' is supported.`
      );
    }
  }

  // Season ID validation
  if (input.seasonId !== undefined) {
    if (typeof input.seasonId !== 'string' || input.seasonId.trim() !== CANONICAL_SEASON_ID) {
      throw new Error(
        `validateToAAllocationInput: Invalid seasonId '${input.seasonId}'. Strictly '${CANONICAL_SEASON_ID}' is supported in Patch 3.7.`
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
      'ownedResonators' in input.ownedRoster
    ) {
      const snap = input.ownedRoster as any;
      if (snap.patchVersion && snap.patchVersion !== CANONICAL_PATCH_VERSION) {
        throw new Error(
          `validateToAAllocationInput: OwnedRosterSnapshot has mismatched patchVersion '${snap.patchVersion}'.`
        );
      }
      ids = (snap.ownedResonators || []).map((r: any) => r.resonatorId);
    }

    const seenRosterIds = new Set<string>();
    for (const id of ids) {
      if (typeof id !== 'string' || id.trim() === '') {
        throw new Error('validateToAAllocationInput: Owned roster contains invalid or empty Resonator ID.');
      }
      if (!isCanonicalResonatorId(id)) {
        throw new Error(
          `validateToAAllocationInput: Non-canonical Resonator ID '${id}' in owned roster snapshot.`
        );
      }
      if (seenRosterIds.has(id)) {
        throw new Error(
          `validateToAAllocationInput: Duplicate Resonator ID '${id}' in owned roster snapshot.`
        );
      }
      seenRosterIds.add(id);
    }
  }

  // Target stage IDs validation
  if (input.targetStageIds !== undefined) {
    if (!Array.isArray(input.targetStageIds)) {
      throw new Error('validateToAAllocationInput: targetStageIds must be an array of string identifiers.');
    }
    const seenTargetIds = new Set<string>();
    for (const id of input.targetStageIds) {
      if (typeof id !== 'string' || id.trim() === '') {
        throw new Error('validateToAAllocationInput: targetStageIds contains invalid or empty stage ID.');
      }
      if (seenTargetIds.has(id)) {
        throw new Error(`validateToAAllocationInput: Duplicate target stage ID '${id}' in targetStageIds.`);
      }
      seenTargetIds.add(id);
    }
  }

  // Stage catalog validation
  if (input.stageCatalog !== undefined) {
    if (!Array.isArray(input.stageCatalog)) {
      throw new Error('validateToAAllocationInput: stageCatalog must be an array of ToAStageDefinitions.');
    }
    const seenStageIds = new Set<string>();
    const canonicalElementSet = new Set(CANONICAL_ELEMENTS.map((e) => e.toLowerCase()));

    for (const stage of input.stageCatalog) {
      if (!stage || typeof stage !== 'object') {
        throw new Error('validateToAAllocationInput: Malformed stage definition in stageCatalog.');
      }
      if (!stage.stageId || typeof stage.stageId !== 'string' || stage.stageId.trim() === '') {
        throw new Error('validateToAAllocationInput: Stage definition missing valid stageId.');
      }
      if (seenStageIds.has(stage.stageId)) {
        throw new Error(
          `validateToAAllocationInput: Duplicate stage identifier '${stage.stageId}' in stageCatalog.`
        );
      }
      seenStageIds.add(stage.stageId);

      // Validate patch association
      if (stage.patchVersion !== CANONICAL_PATCH_VERSION) {
        throw new Error(
          `validateToAAllocationInput: Stage '${stage.stageId}' has invalid patchVersion '${stage.patchVersion}'. Strictly '${CANONICAL_PATCH_VERSION}' is supported.`
        );
      }

      // Validate season association
      if (stage.seasonId !== CANONICAL_SEASON_ID) {
        throw new Error(
          `validateToAAllocationInput: Stage '${stage.stageId}' has invalid seasonId '${stage.seasonId}'. Strictly '${CANONICAL_SEASON_ID}' is supported.`
        );
      }

      // Validate tower metadata
      if (!stage.towerId || typeof stage.towerId !== 'string' || stage.towerId.trim() === '') {
        throw new Error(`validateToAAllocationInput: Stage '${stage.stageId}' missing valid towerId.`);
      }
      if (!stage.towerName || typeof stage.towerName !== 'string' || stage.towerName.trim() === '') {
        throw new Error(`validateToAAllocationInput: Stage '${stage.stageId}' missing valid towerName.`);
      }
      if (
        typeof stage.towerOrder !== 'number' ||
        !Number.isInteger(stage.towerOrder) ||
        stage.towerOrder < 1
      ) {
        throw new Error(`validateToAAllocationInput: Stage '${stage.stageId}' has invalid towerOrder.`);
      }
      if (
        typeof stage.stageIndex !== 'number' ||
        !Number.isInteger(stage.stageIndex) ||
        stage.stageIndex < 1
      ) {
        throw new Error(`validateToAAllocationInput: Stage '${stage.stageId}' has invalid stageIndex.`);
      }
      if (
        typeof stage.globalStageOrder !== 'number' ||
        !Number.isInteger(stage.globalStageOrder) ||
        stage.globalStageOrder < 1
      ) {
        throw new Error(`validateToAAllocationInput: Stage '${stage.stageId}' has invalid globalStageOrder.`);
      }

      // Validate Vigor cost
      if (
        typeof stage.vigorCost !== 'number' ||
        !Number.isInteger(stage.vigorCost) ||
        stage.vigorCost < MIN_STAGE_VIGOR_COST ||
        stage.vigorCost > MAX_STAGE_VIGOR_COST
      ) {
        throw new Error(
          `validateToAAllocationInput: Stage '${stage.stageId}' has invalid vigorCost ${stage.vigorCost}. Must be integer between ${MIN_STAGE_VIGOR_COST} and ${MAX_STAGE_VIGOR_COST}.`
        );
      }

      // Validate beneficial elements
      if (stage.beneficialElements !== undefined) {
        if (!Array.isArray(stage.beneficialElements)) {
          throw new Error(`validateToAAllocationInput: Stage '${stage.stageId}' beneficialElements must be an array.`);
        }
        for (const elem of stage.beneficialElements) {
          if (typeof elem !== 'string' || !canonicalElementSet.has(elem.toLowerCase())) {
            throw new Error(
              `validateToAAllocationInput: Stage '${stage.stageId}' contains non-canonical beneficial element '${elem}'.`
            );
          }
        }
      }
    }
  }

  // Candidate teams validation
  if (input.candidateTeams !== undefined) {
    if (!Array.isArray(input.candidateTeams)) {
      throw new Error('validateToAAllocationInput: candidateTeams must be an array of TeamBuildEvaluations.');
    }
    const seenTeamIds = new Set<string>();
    for (const team of input.candidateTeams) {
      if (!team || typeof team !== 'object' || !team.id) {
        throw new Error('validateToAAllocationInput: Malformed candidate team in candidateTeams.');
      }
      if (team.patchVersion !== CANONICAL_PATCH_VERSION) {
        throw new Error(
          `validateToAAllocationInput: Candidate team '${team.id}' has invalid patchVersion '${team.patchVersion}'.`
        );
      }
      if (team.ruleVersion !== REQUIRED_STEP21_RULE_VERSION) {
        throw new Error(
          `validateToAAllocationInput: Candidate team '${team.id}' has invalid ruleVersion '${team.ruleVersion}'. Expected '${REQUIRED_STEP21_RULE_VERSION}'.`
        );
      }
      if (seenTeamIds.has(team.id)) {
        throw new Error(`validateToAAllocationInput: Duplicate TeamBuildEvaluation ID '${team.id}'.`);
      }
      seenTeamIds.add(team.id);

      // Validate exact three-member cardinality
      if (!Array.isArray(team.memberResonatorIds) || team.memberResonatorIds.length !== TEAM_MEMBER_COUNT) {
        throw new Error(
          `validateToAAllocationInput: Candidate team '${team.id}' has ${team.memberResonatorIds?.length} members, expected exactly ${TEAM_MEMBER_COUNT}.`
        );
      }

      // Validate member uniqueness within team
      const memberSet = new Set<string>();
      for (const memberId of team.memberResonatorIds) {
        if (typeof memberId !== 'string' || memberId.trim() === '') {
          throw new Error(`validateToAAllocationInput: Candidate team '${team.id}' contains invalid member ID.`);
        }
        if (!isCanonicalResonatorId(memberId)) {
          throw new Error(
            `validateToAAllocationInput: Candidate team '${team.id}' contains non-canonical member '${memberId}'.`
          );
        }
        if (memberSet.has(memberId)) {
          throw new Error(
            `validateToAAllocationInput: Candidate team '${team.id}' contains duplicate member Resonator '${memberId}'.`
          );
        }
        memberSet.add(memberId);
      }
    }
  }

  // Portfolio validation
  if (input.portfolio !== undefined) {
    if (!input.portfolio || typeof input.portfolio !== 'object') {
      throw new Error('validateToAAllocationInput: portfolio must be a valid object.');
    }
    const port = input.portfolio as any;
    if (port.patchVersion !== undefined && port.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `validateToAAllocationInput: Portfolio has invalid patchVersion '${port.patchVersion}'. Strictly '${CANONICAL_PATCH_VERSION}' is supported.`
      );
    }
    if (port.ruleVersion !== undefined && port.ruleVersion !== REQUIRED_STEP22_RULE_VERSION) {
      throw new Error(
        `validateToAAllocationInput: Portfolio has invalid ruleVersion '${port.ruleVersion}'. Expected '${REQUIRED_STEP22_RULE_VERSION}'.`
      );
    }

    const portfolioTeams = port.teams ?? port.portfolio?.teams;
    if (portfolioTeams !== undefined) {
      if (!Array.isArray(portfolioTeams)) {
        throw new Error('validateToAAllocationInput: Portfolio teams must be an array.');
      }
      for (const pt of portfolioTeams) {
        if (!pt || typeof pt !== 'object' || !pt.id) {
          throw new Error('validateToAAllocationInput: Malformed team in portfolio.');
        }
        if (pt.patchVersion !== CANONICAL_PATCH_VERSION) {
          throw new Error(
            `validateToAAllocationInput: Portfolio team '${pt.id}' has invalid patchVersion '${pt.patchVersion}'.`
          );
        }
        if (pt.ruleVersion !== REQUIRED_STEP21_RULE_VERSION) {
          throw new Error(
            `validateToAAllocationInput: Portfolio team '${pt.id}' has invalid ruleVersion '${pt.ruleVersion}'. Expected '${REQUIRED_STEP21_RULE_VERSION}'.`
          );
        }
        if (!Array.isArray(pt.memberResonatorIds) || pt.memberResonatorIds.length !== TEAM_MEMBER_COUNT) {
          throw new Error(
            `validateToAAllocationInput: Portfolio team '${pt.id}' has ${pt.memberResonatorIds?.length} members, expected exactly ${TEAM_MEMBER_COUNT}.`
          );
        }
        if (new Set(pt.memberResonatorIds).size !== TEAM_MEMBER_COUNT) {
          throw new Error(
            `validateToAAllocationInput: Portfolio team '${pt.id}' contains duplicate member Resonators.`
          );
        }
      }
    }
  }
}

/**
 * Recursively verifies that no prohibited key appears anywhere in an object.
 * Throws an Error if a prohibited key is detected.
 */
export function assertNoProhibitedToAAllocationKeys(
  target: unknown,
  path: string = 'root'
): void {
  if (!target || typeof target !== 'object') {
    return;
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      assertNoProhibitedToAAllocationKeys(target[i], `${path}[${i}]`);
    }
    return;
  }

  const obj = target as Record<string, unknown>;
  const prohibitedNormalized = new Set(
    PROHIBITED_TOA_ALLOCATION_KEYS.map((k) => k.toLowerCase().replace(/[-_]/g, ''))
  );

  for (const key of Object.keys(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (prohibitedNormalized.has(normalizedKey)) {
      throw new Error(
        `assertNoProhibitedToAAllocationKeys: Prohibited key '${key}' detected at '${path}.${key}'. ToA Stage Allocation strictly forbids scoring, power, and combat performance metrics.`
      );
    }
    assertNoProhibitedToAAllocationKeys(obj[key], `${path}.${key}`);
  }
}
