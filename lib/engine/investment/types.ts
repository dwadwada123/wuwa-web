/**
 * Wuthering Waves Deterministic Resonator Investment Snapshot & Capability Types
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Defines contracts representing the user's objective, patch-bound Resonator investment state.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. INVESTMENT IS AN INPUT CONSTRAINT/STATE, NOT A SCORE.
 *    Step 13 answers ONLY: "What investment state is known for each owned Resonator,
 *    and which investment dimensions are known, unknown, or unavailable?"
 * 2. NO SCORING / NO POWER: Zero character scores, zero weapon scores, zero build scores, zero DPS.
 * 3. NO RECOMMENDATIONS / NO SELECTION: Step 13 does not decide which character/team to build.
 * 4. STRICT PATCH ISOLATION: Bound strictly to Patch 3.7.
 * 5. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 6. UNKNOWN ≠ 0: Unknown values are never coerced to 0, minimum investment, or default builds.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type { OwnedRosterSnapshot } from '../roster/types.ts';

export type { SourceReference, OwnedRosterSnapshot };

/**
 * Value-state status for an investment dimension.
 */
export type InvestmentValueStatus =
  | 'KNOWN'          // Explicitly known objective value
  | 'UNKNOWN'        // Dimension is unprovided or unmodeled
  | 'NOT_APPLICABLE'  // Dimension is not applicable in this context
  | 'INVALID';       // Value failed canonical validation

/**
 * State-aware generic investment value wrapper.
 * Strictly separates known values from unknown values without numeric defaulting.
 */
export type InvestmentValue<T> =
  | {
      readonly status: 'KNOWN';
      readonly value: T;
    }
  | {
      readonly status: 'UNKNOWN' | 'NOT_APPLICABLE' | 'INVALID';
      readonly value: null;
    };

/**
 * Authoritative compatibility status of an equipped weapon.
 */
export type WeaponCompatibilityStatus =
  | 'KNOWN_COMPATIBLE' // Explicitly established in canonical structured data
  | 'UNKNOWN'          // Canonical structured compatibility relationship is unavailable
  | 'INCOMPATIBLE';     // Authoritative canonical conflict detected

/**
 * Structured snapshot of weapon investment.
 */
export interface WeaponInvestmentSnapshot {
  /** Canonical weapon entity ID (matches Patch 3.7 canonical weapons catalog) */
  readonly weaponId: string;
  /** Weapon level in [1, 90] or UNKNOWN */
  readonly weaponLevel: InvestmentValue<number>;
  /** Weapon refinement rank in [1, 5] or UNKNOWN */
  readonly refinementRank: InvestmentValue<number>;
  /** Authoritative weapon compatibility state */
  readonly compatibilityStatus: WeaponCompatibilityStatus;
  /** Provenance reference */
  readonly provenance: SourceReference;
}

/**
 * Structured snapshot of Echo investment facts.
 */
export interface EchoInvestmentSnapshot {
  /** Equipped echo count in [0, 5] or UNKNOWN */
  readonly equippedCount: InvestmentValue<number>;
  /** Tuned echo count in [0, 5] or UNKNOWN */
  readonly tunedCount: InvestmentValue<number>;
  /** Max level (+25) echo count in [0, 5] or UNKNOWN */
  readonly maxLevelEchoCount: InvestmentValue<number>;
  /** Active primary Sonata set code/ID or null */
  readonly sonataSetId: string | null;
  /** Provenance reference */
  readonly provenance: SourceReference;
}

/**
 * Canonical investment dimension identifiers tracked by Step 13.
 */
export type InvestmentDimensionKey =
  | 'CHARACTER_LEVEL'
  | 'WEAPON_IDENTITY'
  | 'WEAPON_LEVEL'
  | 'WEAPON_REFINEMENT'
  | 'SEQUENCE_LEVEL'
  | 'ECHO_EQUIPPED_COUNT'
  | 'ECHO_TUNED_COUNT'
  | 'ECHO_MAX_LEVEL_COUNT'
  | 'ECHO_SONATA_SET';

/**
 * Authoritative deterministic snapshot of a Resonator's investment state.
 */
export interface ResonatorInvestmentSnapshot {
  /** Deterministic identifier: resonator-investment:3.7:<resonatorId>:7.13.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: 7.13.1 */
  readonly ruleVersion: '7.13.1';
  /** Canonical Resonator entity ID */
  readonly resonatorId: string;

  /** Character level in [1, 90] or UNKNOWN */
  readonly characterLevel: InvestmentValue<number>;

  /** Equipped weapon investment snapshot or null */
  readonly weapon: WeaponInvestmentSnapshot | null;

  /** Resonance Chain / Sequence level in [0, 6] or UNKNOWN */
  readonly sequenceLevel: InvestmentValue<number>;

  /** Echo investment snapshot or null */
  readonly echoInvestment: EchoInvestmentSnapshot | null;

  /** Provenance reference */
  readonly provenance: SourceReference;
}

/**
 * Factual data completeness metric describing known vs unknown dimensions.
 * MUST NOT be treated as a gameplay score, power score, or build quality metric!
 */
export interface InvestmentCompletenessSummary {
  /** Total tracked investment dimensions (always 9) */
  readonly totalDimensions: number;
  /** Number of dimensions with status === 'KNOWN' */
  readonly knownDimensions: number;
  /** Number of dimensions with status !== 'KNOWN' */
  readonly unknownDimensions: number;
  /** Completeness ratio in [0.0000, 1.0000] or null if zero dimensions */
  readonly completenessRatio: number | null;
  /** Detailed breakdown per dimension */
  readonly dimensionDetails: Readonly<Record<InvestmentDimensionKey, InvestmentValueStatus>>;
}

/**
 * Input contract for user-provided Resonator investment data prior to normalization.
 */
export interface ResonatorInvestmentInput {
  readonly patchVersion: '3.7';
  readonly resonatorId: string;
  readonly characterLevel?: number | null | InvestmentValue<number>;
  readonly weapon?: {
    readonly weaponId: string;
    readonly weaponLevel?: number | null | InvestmentValue<number>;
    readonly refinementRank?: number | null | InvestmentValue<number>;
    readonly compatibilityStatus?: WeaponCompatibilityStatus;
    readonly provenance?: SourceReference;
  } | null;
  readonly sequenceLevel?: number | null | InvestmentValue<number>;
  readonly echoInvestment?: {
    readonly equippedCount?: number | null | InvestmentValue<number>;
    readonly tunedCount?: number | null | InvestmentValue<number>;
    readonly maxLevelEchoCount?: number | null | InvestmentValue<number>;
    readonly sonataSetId?: string | null;
    readonly provenance?: SourceReference;
  } | null;
  readonly provenance?: SourceReference;
}

/**
 * Output of validating and normalizing a Resonator investment input.
 */
export interface NormalizedResonatorInvestment {
  /** The normalized immutable snapshot */
  readonly snapshot: ResonatorInvestmentSnapshot;
  /** Whether the input passed strict canonical validation */
  readonly isValid: boolean;
  /** Specific validation error messages if any */
  readonly validationErrors: readonly string[];
  /** Objective data completeness summary */
  readonly completeness: InvestmentCompletenessSummary;
}

/**
 * Account-level investment summary across an owned roster.
 */
export interface RosterInvestmentSummary {
  readonly totalOwnedResonators: number;
  readonly totalInvestmentSnapshots: number;
  readonly totalTrackedDimensions: number;
  readonly totalKnownDimensions: number;
  readonly totalUnknownDimensions: number;
  readonly averageCompletenessRatio: number | null;
}

/**
 * Adapted collection of investment snapshots filtered against an OwnedRosterSnapshot.
 */
export interface OwnedRosterInvestmentCatalog {
  readonly rosterPatchVersion: '3.7';
  readonly ownedResonatorCount: number;
  readonly snapshots: readonly ResonatorInvestmentSnapshot[];
  readonly notOwnedResonatorIds: readonly string[];
  readonly summary: RosterInvestmentSummary;
}

/**
 * Structured presentation explanation for a Resonator investment snapshot.
 */
export interface ResonatorInvestmentExplanation {
  readonly investmentId: string;
  readonly resonatorId: string;
  readonly isCharacterLevelKnown: boolean;
  readonly characterLevel: number | null;
  readonly isWeaponKnown: boolean;
  readonly weaponId: string | null;
  readonly weaponLevel: number | null;
  readonly refinementRank: number | null;
  readonly isSequenceKnown: boolean;
  readonly sequenceLevel: number | null;
  readonly isEchoKnown: boolean;
  readonly equippedEchoCount: number | null;
  readonly sonataSetId: string | null;
  readonly completenessRatio: number | null;
  readonly summary: string;
}

/**
 * Production audit and reconciliation metrics for Step 13.
 */
export interface ProductionInvestmentAuditMetrics {
  readonly totalSnapshotsAudited: number;
  readonly validSnapshotsCount: number;
  readonly invalidSnapshotsCount: number;
  readonly totalDimensionsAudited: number;
  readonly totalKnownDimensions: number;
  readonly totalUnknownDimensions: number;
  readonly uniqueSnapshotIds: number;
  readonly duplicateSnapshotIds: number;
  readonly snapshots: readonly ResonatorInvestmentSnapshot[];
}
