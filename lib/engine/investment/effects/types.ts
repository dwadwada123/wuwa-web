/**
 * Wuthering Waves Deterministic Investment Effect Resolution & Combat Contribution Types
 * Phase 7 Step 15: Deterministic Investment Effect Resolution & Combat Contribution Contract
 *
 * Defines contracts representing objectively resolvable investment-dependent gameplay effects
 * derived strictly from Patch 3.7 canonical structured data and explicit user investment snapshots.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FACT RESOLUTION ONLY, NEVER SCORING:
 *    Step 15 answers ONLY: "Given an explicitly known investment state, which investment-dependent
 *    gameplay facts can be deterministically resolved from authoritative Patch 3.7 structured data?"
 * 2. NO SCORING / NO POWER: Zero character scores, zero weapon scores, zero build scores,
 *    zero character power, zero team power, zero DPS, zero rotation damage.
 * 3. NO RECOMMENDATIONS / NO SELECTION: Step 15 does not rank characters or teams.
 * 4. STRICT CONSUMPTION OF STEPS 13 & 14: Consumes ResonatorInvestmentSnapshot without reinterpretation.
 * 5. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 6. UNKNOWN ≠ ZERO: Unknown values are never coerced to 0, minimum investment, or default builds.
 * 7. UNMODELED ≠ ZERO: Unmodeled mechanics or missing formulas are never approximated or guessed.
 */

import type { SourceReference } from '../../capabilities/types.ts';
import type {
  InvestmentDimensionKey,
  ResonatorInvestmentSnapshot,
  WeaponInvestmentSnapshot,
  EchoInvestmentSnapshot,
  InvestmentValue
} from '../types.ts';

export type {
  SourceReference,
  InvestmentDimensionKey,
  ResonatorInvestmentSnapshot,
  WeaponInvestmentSnapshot,
  EchoInvestmentSnapshot,
  InvestmentValue
};

/**
 * Deterministic resolution status for an investment-dependent effect.
 */
export type InvestmentEffectResolutionStatus =
  | 'RESOLVED'        // All required authoritative inputs and formulas are available and satisfied
  | 'UNKNOWN'         // The required user investment input is legitimately unknown / unprovided
  | 'UNMODELED'       // The mechanic is recognized conceptually, but canonical structured formula is absent
  | 'NOT_APPLICABLE'   // The effect condition is not met (e.g. sequence node locked, set piece count below threshold)
  | 'INVALID'         // Input data violated canonical validation / constraints
  | 'PATCH_MISMATCH'; // Input data or patch version is not strictly '3.7'

/**
 * Closed taxonomy of investment effect categories.
 * Strictly objective functional categorization; NEVER subjective (no HIGH_VALUE/LOW_VALUE).
 */
export type InvestmentEffectCategory =
  | 'CHARACTER_LEVEL_EFFECT'
  | 'WEAPON_LEVEL_EFFECT'
  | 'WEAPON_REFINEMENT_EFFECT'
  | 'SEQUENCE_EFFECT'
  | 'ECHO_COUNT_EFFECT'
  | 'SONATA_EFFECT'
  | 'MULTI_DIMENSION_EFFECT';

/**
 * Authoritative Step 15 InvestmentEffectResolution contract.
 * Represents a single objectively resolved investment-dependent gameplay effect.
 */
export interface InvestmentEffectResolution {
  /** Deterministic identifier: investment-effect:3.7:<resonatorId>:<effectId>:7.15.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: strictly '7.15.1' */
  readonly ruleVersion: '7.15.1';

  /** Canonical Resonator entity ID */
  readonly resonatorId: string;

  /** Primary investment dimension required by this effect */
  readonly investmentDimension: InvestmentDimensionKey;
  /** All investment dimensions required by this effect */
  readonly investmentDimensions: readonly InvestmentDimensionKey[];

  /** Canonical effect identifier (e.g., 'char-base-hp', 'weapon-refinement', 'sonata-2pc') */
  readonly effectId: string;
  /** Closed functional category */
  readonly category: InvestmentEffectCategory;

  /** Objective resolution status */
  readonly status: InvestmentEffectResolutionStatus;

  /** Objective numerical input value if known and applicable; null otherwise */
  readonly inputValue: number | null;

  /** Authoritative resolved numeric value; strictly null if status !== 'RESOLVED' (never 0) */
  readonly resolvedValue: number | null;

  /** Explicit measurement unit (e.g., 'FLAT_HP', 'FLAT_ATK', 'FLAT_DEF', 'PERCENT'); null if unresolved */
  readonly unit: string | null;

  /** Canonical identifier of the formula used for resolution; null if unresolved */
  readonly formulaId: string | null;

  /** Canonical dependency fact IDs required to resolve this effect */
  readonly dependencyFactIds: readonly string[];

  /** Canonical source fact IDs providing authoritative evidence for this effect */
  readonly sourceFactIds: readonly string[];

  /** Canonical relationship IDs referenced by this effect */
  readonly relationshipIds: readonly string[];

  /** Runtime evaluation context dimensions required by this effect (e.g. 'CHARACTER_LEVEL') */
  readonly requiredContext: readonly string[];

  /** Machine-readable reason codes explaining the resolution outcome */
  readonly reasonCodes: readonly string[];

  /** Complete provenance lineage */
  readonly provenance: SourceReference;
}

/**
 * Authoritative formula descriptor governing numeric resolution.
 */
export interface InvestmentResolutionFormula {
  readonly formulaId: string;
  readonly formulaVersion: string;
  readonly inputDimensions: readonly InvestmentDimensionKey[];
  readonly sourceFactIds: readonly string[];
  readonly provenance: SourceReference;
}

/**
 * Factual resolution summary across all investment effects for a Resonator.
 * Pure accounting summary; NEVER a gameplay score or quality ranking.
 */
export interface InvestmentEffectResolutionSummary {
  readonly resonatorId: string;
  readonly totalEffects: number;
  readonly resolvedCount: number;
  readonly unknownCount: number;
  readonly unmodeledCount: number;
  readonly notApplicableCount: number;
  readonly invalidCount: number;
  readonly resolvedEffectIds: readonly string[];
  readonly unknownEffectIds: readonly string[];
  readonly unmodeledEffectIds: readonly string[];
  readonly provenance: SourceReference;
}

/**
 * Filter predicate options for querying investment effects.
 */
export interface InvestmentEffectFilter {
  readonly category?: InvestmentEffectCategory;
  readonly status?: InvestmentEffectResolutionStatus;
  readonly investmentDimension?: InvestmentDimensionKey;
  readonly effectId?: string;
}

/**
 * Production audit and reconciliation metrics for Step 15.
 */
export interface ProductionEffectResolutionAuditMetrics {
  readonly totalEffectsAudited: number;
  readonly resolvedCount: number;
  readonly unknownCount: number;
  readonly unmodeledCount: number;
  readonly notApplicableCount: number;
  readonly invalidCount: number;
  readonly patchMismatchCount: number;
  readonly uniqueEffectIds: number;
  readonly duplicateEffectIds: number;
  readonly allInvariantsPassed: boolean;
}
