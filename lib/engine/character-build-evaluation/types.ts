/**
 * Wuthering Waves Deterministic Character Build Evaluation Types
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Defines contracts representing the objective, deterministic evaluation of a
 * character's build (equipped weapon, weapon stats/passive applicability, Echo loadout,
 * Sonata set alignment, and build completeness) under their approved decision context.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FACTUAL BUILD EVALUATION ONLY, NEVER CHARACTER POWER:
 *    The evaluation measures strictly the compatibility, completeness, and factual
 *    configuration of the character's equipment.
 *    ZERO character power, ZERO DPS, ZERO damage, ZERO combat strength, ZERO tier, ZERO meta.
 * 2. NO RECOMMENDATIONS / NO SELECTION:
 *    Does NOT recommend weapons, does NOT suggest build optimizations, does NOT rank builds.
 * 3. NO TEAM DECISION:
 *    Does NOT generate teams, rank teams, or assign characters to teams/towers.
 * 4. STRICT PATCH ISOLATION:
 *    Bound strictly to Patch 3.7. Rejects cross-patch inputs.
 * 5. DETERMINISTIC & PURE:
 *    Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 6. UNKNOWN ≠ ZERO:
 *    Missing or unmodeled build dimensions are strictly preserved as null or UNKNOWN;
 *    never coerced to 0, minimum investment, or default builds.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type {
  ResonatorInvestmentSnapshot,
  WeaponCompatibilityStatus
} from '../investment/types.ts';
import type {
  CharacterDecisionContext,
  CharacterDecisionContextSummary
} from '../character-decision-context/types.ts';

export type {
  SourceReference,
  ResonatorInvestmentSnapshot,
  WeaponCompatibilityStatus,
  CharacterDecisionContext,
  CharacterDecisionContextSummary
};

/**
 * Closed status taxonomy for Character Build Evaluation.
 * Reflects the epistemic and factual configuration of the character's build.
 */
export type CharacterBuildEvaluationStatus =
  | 'FULLY_EQUIPPED'       // Both weapon and Echo configuration are fully equipped and compatible
  | 'PARTIALLY_EQUIPPED'   // Either weapon or Echo configuration is equipped/known, but build is incomplete
  | 'UNEQUIPPED'           // Neither weapon nor Echo loadout is equipped
  | 'INCOMPATIBLE_WEAPON'  // Equipped weapon weapon_type does not match Resonator weapon_type
  | 'BUILD_UNKNOWN'        // Investment snapshot is absent or all tracked build dimensions are UNKNOWN
  | 'INVALID'              // Malformed record, non-canonical character or weapon entity
  | 'PATCH_MISMATCH';      // Cross-patch input rejected

/**
 * Authoritative compatibility status of an equipped weapon with a Resonator.
 */
export type BuildWeaponCompatibilityStatus =
  | 'COMPATIBLE'     // Equipped weapon weapon_type matches Resonator weapon_type
  | 'INCOMPATIBLE'   // Equipped weapon weapon_type !== Resonator weapon_type
  | 'NOT_EQUIPPED'   // Weapon snapshot is null
  | 'UNKNOWN';       // Weapon is non-canonical or weapon type is unmodeled

/**
 * Authoritative alignment status of an active Sonata set with a Resonator.
 */
export type BuildSonataAlignmentStatus =
  | 'ELEMENT_ALIGNED' // Active Sonata set matches Resonator element
  | 'UNIVERSAL'       // Active Sonata set is universal / element-agnostic
  | 'MISALIGNED'      // Active Sonata set is elemental but does not match Resonator element
  | 'NOT_EQUIPPED'    // No active Sonata set or no Echoes equipped
  | 'UNKNOWN';        // Sonata set is unmodeled or unrecognized

/**
 * Tracked factual build aspect dimensions.
 */
export type BuildAspectKey =
  | 'WEAPON_EQUIPPED'
  | 'WEAPON_LEVEL_KNOWN'
  | 'WEAPON_REFINEMENT_KNOWN'
  | 'ECHO_EQUIPPED_KNOWN'
  | 'ECHO_TUNING_KNOWN'
  | 'SONATA_SET_KNOWN';

/**
 * Structured factual evaluation of equipped weapon.
 */
export interface WeaponBuildEvaluation {
  /** Whether a weapon is equipped */
  readonly isEquipped: boolean;
  /** Canonical weapon entity ID or null */
  readonly weaponId: string | null;
  /** Canonical weapon display name or null */
  readonly weaponName: string | null;
  /** Weapon type: 'Sword' | 'Pistols' | 'Rectifier' | 'Broadblade' | 'Gauntlets' | null */
  readonly weaponType: string | null;
  /** Resonator weapon type requirement */
  readonly resonatorWeaponType: string;
  /** Authoritative compatibility state */
  readonly compatibility: BuildWeaponCompatibilityStatus;
  /** Weapon level in [1, 90] or null */
  readonly weaponLevel: number | null;
  /** Whether weapon level is maxed at 90 */
  readonly isLevelMaxed: boolean | null;
  /** Weapon refinement rank in [1, 5] or null */
  readonly refinementRank: number | null;
  /** Whether weapon refinement is maxed at R5 */
  readonly isRefinementMaxed: boolean | null;
  /** Base ATK at Lv90 from canonical Patch 3.7 data or null */
  readonly baseAtkLvl90: number | null;
  /** Sub-stat type from canonical Patch 3.7 data or null */
  readonly subStatType: string | null;
  /** Sub-stat value at Lv90 from canonical Patch 3.7 data or null */
  readonly subStatValueLvl90: number | null;
  /** Passive effect functional category or null */
  readonly passiveEffectCategory: string | null;
  /** Whether weapon passive has refinement scaling */
  readonly hasPassiveRefinementScaling: boolean;
  /** Provenance reference */
  readonly provenance: SourceReference;
}

/**
 * Structured factual evaluation of Echo loadout.
 */
export interface EchoLoadoutBuildEvaluation {
  /** Whether any Echo is equipped */
  readonly hasLoadout: boolean;
  /** Equipped echo count in [0, 5] or null */
  readonly equippedCount: number | null;
  /** Whether all 5 echo slots are equipped */
  readonly isEquippedCountMaxed: boolean | null;
  /** Tuned echo count in [0, 5] or null */
  readonly tunedCount: number | null;
  /** Whether all 5 echoes are tuned */
  readonly isTunedCountMaxed: boolean | null;
  /** Max-level (+25) echo count in [0, 5] or null */
  readonly maxLevelCount: number | null;
  /** Whether all 5 echoes are max level */
  readonly isMaxLevelCountMaxed: boolean | null;
  /** Active primary Sonata set code or null */
  readonly activeSonataSetCode: string | null;
  /** Active primary Sonata set display name or null */
  readonly activeSonataSetName: string | null;
  /** Alignment of Sonata set with Resonator element */
  readonly sonataAlignment: BuildSonataAlignmentStatus;
  /** Description of 2-piece Sonata effect or null */
  readonly twoPieceEffectDescription: string | null;
  /** Description of 5-piece Sonata effect or null */
  readonly fivePieceEffectDescription: string | null;
  /** Provenance reference */
  readonly provenance: SourceReference;
}

/**
 * Objective metrics describing completeness of known build dimensions.
 * MUST NOT be treated as a gameplay score, power score, or build quality metric!
 */
export interface BuildCompletenessMetrics {
  /** Total tracked build aspects (always 6) */
  readonly totalAspects: number;
  /** Number of aspects known */
  readonly knownAspects: number;
  /** Number of aspects unknown */
  readonly unknownAspects: number;
  /** Completeness ratio in [0.0000, 1.0000] or null if uninvested */
  readonly completenessRatio: number | null;
  /** Detailed breakdown per aspect */
  readonly aspectDetails: Readonly<Record<BuildAspectKey, 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE'>>;
}

/**
 * Provenance lineage for a derived CharacterBuildEvaluation record.
 */
export interface CharacterBuildEvaluationProvenance {
  readonly source: 'DERIVED_BUILD_EVALUATION';
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.20.1';
  readonly decisionContextId: string;
  readonly investmentSnapshotId: string | null;
  readonly upstreamDecisionContextRuleVersion: '7.19.1';
  readonly upstreamInvestmentRuleVersion: '7.13.1';
}

/**
 * Authoritative CharacterBuildEvaluation contract.
 * Represents the objective build evaluation for a single canonical Resonator.
 */
export interface CharacterBuildEvaluation {
  /** Deterministic identifier: char-build:3.7:<resonatorId>:7.20.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: strictly '7.20.1' */
  readonly ruleVersion: '7.20.1';
  /** Canonical Resonator entity ID */
  readonly resonatorId: string;
  /** Resonator element (Aero, Electro, Fusion, Glacio, Havoc, Spectro) */
  readonly element: string;
  /** Resonator weapon type requirement (Sword, Pistols, Rectifier, Broadblade, Gauntlets) */
  readonly weaponType: string;
  /** Resonator rarity (4 or 5) */
  readonly rarity: number;
  /** Overall build evaluation status */
  readonly status: CharacterBuildEvaluationStatus;
  /** Detailed weapon evaluation */
  readonly weaponEvaluation: WeaponBuildEvaluation;
  /** Detailed echo loadout evaluation */
  readonly echoEvaluation: EchoLoadoutBuildEvaluation;
  /** Objective build completeness metrics */
  readonly completeness: BuildCompletenessMetrics;
  /** Upstream Step 19 decision context summary preserved verbatim */
  readonly decisionContextSummary: CharacterDecisionContextSummary;
  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Provenance lineage */
  readonly provenance: CharacterBuildEvaluationProvenance;
}

/**
 * Input contract for constructing character build evaluations.
 */
export interface CharacterBuildEvaluationInput {
  /** Target patch version: strictly '3.7' */
  readonly patchId?: string;
  /** Optional decision contexts catalog (defaults to Step 19 default contexts) */
  readonly decisionContexts?: readonly CharacterDecisionContext[];
  /** Optional investment snapshots catalog */
  readonly investmentSnapshots?: readonly ResonatorInvestmentSnapshot[];
  /** Optional list of character IDs to evaluate (defaults to all canonical Resonators) */
  readonly characterIds?: readonly string[];
}

/**
 * Multi-dimensional filter criteria for querying character build evaluations.
 */
export interface CharacterBuildEvaluationFilter {
  readonly patchVersion?: '3.7';
  readonly characterId?: string;
  readonly status?: CharacterBuildEvaluationStatus;
  readonly weaponCompatibility?: BuildWeaponCompatibilityStatus;
  readonly sonataAlignment?: BuildSonataAlignmentStatus;
  readonly isFullyEquipped?: boolean;
  readonly minCompletenessRatio?: number;
  readonly element?: string;
  readonly weaponType?: string;
}

/**
 * Quantitative summary of a CharacterBuildEvaluationResult collection.
 */
export interface CharacterBuildEvaluationResultSummary {
  readonly totalEvaluations: number;
  readonly totalFullyEquipped: number;
  readonly totalPartiallyEquipped: number;
  readonly totalUnequipped: number;
  readonly totalIncompatibleWeapon: number;
  readonly totalBuildUnknown: number;
  readonly totalElementAligned: number;
  readonly totalUniversalSonata: number;
  readonly totalMisalignedSonata: number;
  readonly averageCompletenessRatio: number | null;
}

/**
 * Audit metrics for verifying build evaluation integrity.
 */
export interface CharacterBuildEvaluationAuditMetrics {
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.20.1';
  readonly totalEvaluations: number;
  readonly uniqueCharacterIds: number;
  readonly canonicalResonatorCoverage: number;
  readonly decisionContextsMatched: number;
  readonly investmentSnapshotsMatched: number;
  readonly verifiedAt: string;
}

/**
 * Aggregated result container for a complete character build evaluation collection.
 */
export interface CharacterBuildEvaluationResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.20.1';
  readonly evaluations: readonly CharacterBuildEvaluation[];
  readonly summary: CharacterBuildEvaluationResultSummary;
  readonly audit: CharacterBuildEvaluationAuditMetrics;
}
