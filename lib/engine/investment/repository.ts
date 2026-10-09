/**
 * Wuthering Waves Deterministic Resonator Investment Repository
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Provides query, lookup, completeness inspection, and roster adaptation operations
 * over ResonatorInvestmentSnapshot models.
 */

import { getKnownResonatorIds } from '../team-composition/repository.ts';
import { normalizeOwnedRoster } from '../roster/predicates.ts';
import {
  RESONATOR_INVESTMENT_RULE_VERSION,
  EMPTY_INVESTMENT_PROVENANCE,
  ALL_INVESTMENT_DIMENSIONS
} from './rules.ts';
import {
  deriveResonatorInvestmentId,
  unknownValue,
  isCanonicalResonatorId,
  compareResonatorInvestmentSnapshots
} from './predicates.ts';
import { computeInvestmentCompleteness } from './normalization.ts';
import type {
  OwnedRosterSnapshot,
  InvestmentDimensionKey,
  InvestmentCompletenessSummary,
  ResonatorInvestmentSnapshot,
  RosterInvestmentSummary,
  OwnedRosterInvestmentCatalog
} from './types.ts';

/**
 * Creates an empty/uninvested snapshot for a canonical Resonator where all dimensions are UNKNOWN.
 * Strictly guarantees ZERO numeric defaulting (does not infer S0, R1, or Level 1).
 */
export function createUninvestedSnapshot(
  resonatorId: string,
  options?: { ruleVersion?: '7.13.1' }
): ResonatorInvestmentSnapshot {
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? RESONATOR_INVESTMENT_RULE_VERSION;
  const id = deriveResonatorInvestmentId(patchVersion, resonatorId, ruleVersion);

  return Object.freeze({
    id,
    patchVersion,
    ruleVersion,
    resonatorId,
    characterLevel: unknownValue<number>('UNKNOWN'),
    weapon: null,
    sequenceLevel: unknownValue<number>('UNKNOWN'),
    echoInvestment: null,
    provenance: EMPTY_INVESTMENT_PROVENANCE
  });
}

/**
 * Retrieves the investment snapshot for a single Resonator.
 * If custom snapshots are supplied and contain a record, returns that record.
 * Otherwise, if the resonator is canonical, returns an uninvested snapshot (all UNKNOWN).
 * If the resonator is non-canonical, returns undefined.
 */
export function getInvestmentSnapshot(
  resonatorId: string,
  customSnapshots?: readonly ResonatorInvestmentSnapshot[]
): ResonatorInvestmentSnapshot | undefined {
  if (!isCanonicalResonatorId(resonatorId)) {
    return undefined;
  }

  if (customSnapshots) {
    const found = customSnapshots.find((s) => s.resonatorId === resonatorId);
    if (found) return found;
  }

  return createUninvestedSnapshot(resonatorId);
}

/**
 * Retrieves investment snapshots for all Resonators owned in a roster.
 * Preserves canonical Resonator ordering and excludes non-owned characters.
 */
export function getOwnedInvestmentSnapshots(
  roster: OwnedRosterSnapshot,
  customSnapshots?: readonly ResonatorInvestmentSnapshot[]
): readonly ResonatorInvestmentSnapshot[] {
  const normalizedRoster = normalizeOwnedRoster(roster);
  if (!normalizedRoster.isValid) {
    return Object.freeze([]);
  }

  const customMap = new Map<string, ResonatorInvestmentSnapshot>();
  if (customSnapshots) {
    for (const snap of customSnapshots) {
      customMap.set(snap.resonatorId, snap);
    }
  }

  const results: ResonatorInvestmentSnapshot[] = [];
  for (const resId of normalizedRoster.canonicalOwnedIds) {
    const snap = customMap.get(resId) ?? createUninvestedSnapshot(resId);
    results.push(snap);
  }

  return Object.freeze(results.sort(compareResonatorInvestmentSnapshots));
}

/**
 * Inspects data completeness for a specific Resonator.
 */
export function getInvestmentCompleteness(
  resonatorId: string,
  customSnapshots?: readonly ResonatorInvestmentSnapshot[]
): InvestmentCompletenessSummary | undefined {
  const snapshot = getInvestmentSnapshot(resonatorId, customSnapshots);
  if (!snapshot) return undefined;
  return computeInvestmentCompleteness(snapshot);
}

/**
 * Returns the list of investment dimensions whose value is explicitly KNOWN.
 */
export function getKnownInvestmentDimensions(
  resonatorId: string,
  customSnapshots?: readonly ResonatorInvestmentSnapshot[]
): readonly InvestmentDimensionKey[] {
  const completeness = getInvestmentCompleteness(resonatorId, customSnapshots);
  if (!completeness) return Object.freeze([]);

  const known: InvestmentDimensionKey[] = [];
  for (const dim of ALL_INVESTMENT_DIMENSIONS) {
    if (completeness.dimensionDetails[dim] === 'KNOWN') {
      known.push(dim);
    }
  }
  return Object.freeze(known);
}

/**
 * Returns the list of investment dimensions whose value is UNKNOWN / unprovided.
 */
export function getUnknownInvestmentDimensions(
  resonatorId: string,
  customSnapshots?: readonly ResonatorInvestmentSnapshot[]
): readonly InvestmentDimensionKey[] {
  const completeness = getInvestmentCompleteness(resonatorId, customSnapshots);
  if (!completeness) return Object.freeze([]);

  const unknownDims: InvestmentDimensionKey[] = [];
  for (const dim of ALL_INVESTMENT_DIMENSIONS) {
    if (completeness.dimensionDetails[dim] !== 'KNOWN') {
      unknownDims.push(dim);
    }
  }
  return Object.freeze(unknownDims);
}

/**
 * Computes an objective aggregate investment summary across an owned roster.
 */
export function getRosterInvestmentSummary(
  roster: OwnedRosterSnapshot,
  customSnapshots?: readonly ResonatorInvestmentSnapshot[]
): RosterInvestmentSummary {
  const ownedSnapshots = getOwnedInvestmentSnapshots(roster, customSnapshots);
  const totalOwnedResonators = ownedSnapshots.length;

  let totalTrackedDimensions = 0;
  let totalKnownDimensions = 0;
  let sumRatios = 0;

  for (const snap of ownedSnapshots) {
    const comp = computeInvestmentCompleteness(snap);
    totalTrackedDimensions += comp.totalDimensions;
    totalKnownDimensions += comp.knownDimensions;
    if (comp.completenessRatio !== null) {
      sumRatios += comp.completenessRatio;
    }
  }

  const totalUnknownDimensions = totalTrackedDimensions - totalKnownDimensions;
  const avgRatio =
    totalOwnedResonators > 0
      ? Math.round((sumRatios / totalOwnedResonators) * 10000) / 10000
      : null;

  return Object.freeze({
    totalOwnedResonators,
    totalInvestmentSnapshots: ownedSnapshots.length,
    totalTrackedDimensions,
    totalKnownDimensions,
    totalUnknownDimensions,
    averageCompletenessRatio: avgRatio
  });
}

/**
 * Adapts an OwnedRosterSnapshot and an optional collection of investment snapshots
 * into an authoritative, filtered OwnedRosterInvestmentCatalog.
 */
export function adaptOwnedRosterInvestment(
  roster: OwnedRosterSnapshot,
  customSnapshots?: readonly ResonatorInvestmentSnapshot[]
): OwnedRosterInvestmentCatalog {
  const normalizedRoster = normalizeOwnedRoster(roster);
  const snapshots = getOwnedInvestmentSnapshots(roster, customSnapshots);

  const notOwned: string[] = [];
  if (customSnapshots) {
    for (const snap of customSnapshots) {
      if (!normalizedRoster.ownedIdSet.has(snap.resonatorId)) {
        notOwned.push(snap.resonatorId);
      }
    }
  }

  const summary = getRosterInvestmentSummary(roster, customSnapshots);

  return Object.freeze({
    rosterPatchVersion: '3.7',
    ownedResonatorCount: normalizedRoster.canonicalOwnedIds.length,
    snapshots,
    notOwnedResonatorIds: Object.freeze(notOwned.sort((a, b) => a.localeCompare(b))),
    summary
  });
}
