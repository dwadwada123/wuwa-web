/**
 * Wuthering Waves Deterministic Team Build Evaluation Types
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Defines contracts representing the objective, deterministic evaluation of a
 * 3-Resonator team candidate's build (member build qualifications, weapon compatibility
 * aggregation, Echo loadout aggregation, Sonata set interactions, and team build completeness)
 * under their approved Step 20 CharacterBuildEvaluation records.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FACTUAL BUILD QUALIFICATION ONLY, NEVER COMBAT POWER:
 *    The evaluation measures strictly the equipment compatibility, Sonata set presence,
 *    and data completeness across the 3 team members.
 *    ZERO team power, ZERO character power, ZERO DPS, ZERO damage, ZERO combat strength,
 *    ZERO tier, ZERO meta rankings.
 * 2. NO RECOMMENDATIONS / NO SELECTION:
 *    Does NOT recommend weapons/echoes, does NOT suggest build optimizations,
 *    does NOT rank teams or select the "best" team.
 * 3. NO TEAM GENERATION:
 *    Evaluates strictly a supplied 3-Resonator candidate.
 * 4. STRICT CARDINALITY:
 *    Exactly three distinct canonical Resonators per candidate triple.
 * 5. STRICT PATCH ISOLATION:
 *    Bound strictly to Patch 3.7. Rejects cross-patch inputs.
 * 6. DETERMINISTIC & PURE:
 *    Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 7. UNKNOWN ≠ ZERO:
 *    Missing or unmodeled build dimensions are strictly preserved as null or UNKNOWN;
 *    never coerced to 0, minimum investment, or default builds.
 * 8. UNMODELED MECHANICS REMAIN UNMODELED:
 *    Cross-character Sonata set stacking/overlap mechanics are strictly 'UNMODELED'.
 *    Never invent ungrounded game mechanics or conflict penalties.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type {
  CharacterBuildEvaluation,
  CharacterBuildEvaluationStatus,
  BuildWeaponCompatibilityStatus,
  BuildSonataAlignmentStatus,
  WeaponBuildEvaluation,
  EchoLoadoutBuildEvaluation,
  BuildCompletenessMetrics
} from '../character-build-evaluation/types.ts';

export type {
  SourceReference,
  CharacterBuildEvaluation,
  CharacterBuildEvaluationStatus,
  BuildWeaponCompatibilityStatus,
  BuildSonataAlignmentStatus,
  WeaponBuildEvaluation,
  EchoLoadoutBuildEvaluation,
  BuildCompletenessMetrics
};

/**
 * Closed status taxonomy for Team Build Evaluation.
 * Reflects the factual and epistemic configuration of the 3-Resonator team build.
 */
export type TeamBuildEvaluationStatus =
  | 'FULLY_EQUIPPED'       // All 3 members have FULLY_EQUIPPED builds (compatible weapons, complete Echo configurations)
  | 'PARTIALLY_EQUIPPED'   // At least one member has an equipped loadout, but team is not fully equipped (and zero incompatible weapons)
  | 'UNEQUIPPED'           // All 3 members are confirmed UNEQUIPPED
  | 'INCOMPATIBLE_WEAPON'  // At least one member has an INCOMPATIBLE weapon
  | 'BUILD_UNKNOWN'        // All 3 members have BUILD_UNKNOWN status (no investment data provided)
  | 'PARTIALLY_UNKNOWN'    // Mixed: some members known/equipped while others are BUILD_UNKNOWN
  | 'INVALID'              // Malformed team candidate, duplicate or non-canonical members
  | 'PATCH_MISMATCH';      // Cross-patch input rejected

/**
 * Team-level aggregation of weapon compatibility facts across the 3 members.
 */
export interface TeamWeaponBuildAggregation {
  /** Count of members with COMPATIBLE weapon (0 to 3) */
  readonly compatibleCount: number;
  /** Count of members with INCOMPATIBLE weapon (0 to 3) */
  readonly incompatibleCount: number;
  /** Count of members with NOT_EQUIPPED weapon (0 to 3) */
  readonly unequippedCount: number;
  /** Count of members with UNKNOWN weapon compatibility (0 to 3) */
  readonly unknownCount: number;
  /** Whether all 3 members have compatible weapons */
  readonly allCompatible: boolean;
  /** Whether any member has an incompatible weapon */
  readonly hasIncompatibleWeapon: boolean;
}

/**
 * Team-level aggregation of Echo and Sonata facts across the 3 members.
 */
export interface TeamEchoLoadoutAggregation {
  /** Count of members with an equipped Echo loadout (0 to 3) */
  readonly equippedCount: number;
  /** Count of members with ELEMENT_ALIGNED active Sonata (0 to 3) */
  readonly elementAlignedSonataCount: number;
  /** Count of members with UNIVERSAL active Sonata (0 to 3) */
  readonly universalSonataCount: number;
  /** Count of members with MISALIGNED active Sonata (0 to 3) */
  readonly misalignedSonataCount: number;
  /** Count of members with NOT_EQUIPPED Sonata (0 to 3) */
  readonly unequippedSonataCount: number;
  /** Count of members with UNKNOWN Sonata alignment (0 to 3) */
  readonly unknownSonataCount: number;
}

/**
 * Objective evaluation of active Sonata sets across the 3 team members.
 */
export interface TeamSonataInteractionEvaluation {
  /** Active primary Sonata set codes for members [memberA, memberB, memberC] (null if none) */
  readonly memberSonataCodes: readonly [string | null, string | null, string | null];
  /** Deduplicated list of active Sonata set codes present on the team */
  readonly distinctActiveSonataCodes: readonly string[];
  /** Whether any two or more members equip the same Sonata set code */
  readonly hasDuplicateSonataSets: boolean;
  /** Sonata set codes equipped by multiple team members */
  readonly duplicateSonataCodes: readonly string[];
  /**
   * Cross-character team-level buff stacking status.
   * Strictly 'UNMODELED' because cross-character buff stacking/override
   * mechanics are unmodeled in the canonical patch rules.
   */
  readonly stackingStatus: 'UNMODELED';
  /** Factual interaction status across the team */
  readonly interactionStatus: 'EVALUATED' | 'UNKNOWN' | 'NOT_EQUIPPED';
}

/**
 * Objective metrics describing data completeness of tracked build dimensions across the team.
 * 18 total aspects (6 aspects * 3 members).
 * NEVER a gameplay power score!
 */
export interface TeamBuildCompletenessMetrics {
  /** Total tracked build aspects across 3 members (always 18) */
  readonly totalTeamAspects: number;
  /** Total aspects known across all 3 members (0 to 18) */
  readonly knownTeamAspects: number;
  /** Total aspects unknown across all 3 members (0 to 18) */
  readonly unknownTeamAspects: number;
  /** Per-member completeness ratios [memberA, memberB, memberC] */
  readonly memberCompletenessRatios: readonly [number | null, number | null, number | null];
  /**
   * Overall team completeness ratio in [0.0000, 1.0000] or null.
   * Null iff all 3 members have null completenessRatio.
   */
  readonly teamCompletenessRatio: number | null;
}

/**
 * Provenance lineage for a derived TeamBuildEvaluation record.
 */
export interface TeamBuildEvaluationProvenance {
  readonly source: 'DERIVED_TEAM_BUILD_EVALUATION';
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.21.1';
  readonly teamCandidateId: string;
  readonly memberBuildEvaluationIds: readonly [string, string, string];
  readonly upstreamBuildEvaluationRuleVersion: '7.20.1';
  readonly upstreamTeamCandidateRuleVersion: '7.9.1';
}

/**
 * Authoritative TeamBuildEvaluation contract.
 * Represents the objective build evaluation for a single 3-Resonator team candidate.
 */
export interface TeamBuildEvaluation {
  /** Deterministic identifier: team-build:3.7:<A>:<B>:<C>:7.21.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: strictly '7.21.1' */
  readonly ruleVersion: '7.21.1';
  /** ID of the evaluated Step 9 TeamCompositionCandidate or derived candidate ID */
  readonly teamCandidateId: string;
  /** Canonical sorted tuple of exactly 3 distinct Resonator IDs */
  readonly memberResonatorIds: readonly [string, string, string];
  /** Overall team build evaluation status */
  readonly status: TeamBuildEvaluationStatus;
  /** Preserved member build evaluations in canonical member order */
  readonly memberBuildEvaluations: readonly [
    CharacterBuildEvaluation,
    CharacterBuildEvaluation,
    CharacterBuildEvaluation
  ];
  /** Team-level weapon compatibility aggregation */
  readonly weaponAggregation: TeamWeaponBuildAggregation;
  /** Team-level Echo loadout aggregation */
  readonly echoAggregation: TeamEchoLoadoutAggregation;
  /** Sonata set interaction & duplicate analysis */
  readonly sonataInteraction: TeamSonataInteractionEvaluation;
  /** Objective team build completeness metrics */
  readonly completeness: TeamBuildCompletenessMetrics;
  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Provenance lineage */
  readonly provenance: TeamBuildEvaluationProvenance;
}

/**
 * Input contract for constructing team build evaluations.
 */
export interface TeamBuildEvaluationInput {
  /** Target patch version: strictly '3.7' */
  readonly patchId?: string;
  /** Optional character build evaluations catalog */
  readonly characterBuildEvaluations?: readonly CharacterBuildEvaluation[];
  /** Optional team member triples to evaluate (defaults to production candidate triples) */
  readonly teamCandidates?: readonly (readonly [string, string, string])[];
}

/**
 * Multi-dimensional filter criteria for querying team build evaluations.
 */
export interface TeamBuildEvaluationFilter {
  readonly patchVersion?: '3.7';
  readonly status?: TeamBuildEvaluationStatus;
  readonly allCompatibleWeapons?: boolean;
  readonly hasIncompatibleWeapon?: boolean;
  readonly hasDuplicateSonataSets?: boolean;
  readonly minTeamCompletenessRatio?: number;
  readonly containsResonatorId?: string;
}

/**
 * Quantitative summary of a TeamBuildEvaluationResult collection.
 */
export interface TeamBuildEvaluationResultSummary {
  readonly totalEvaluations: number;
  readonly totalFullyEquipped: number;
  readonly totalPartiallyEquipped: number;
  readonly totalUnequipped: number;
  readonly totalIncompatibleWeapon: number;
  readonly totalBuildUnknown: number;
  readonly totalPartiallyUnknown: number;
  readonly totalAllWeaponsCompatible: number;
  readonly totalWithDuplicateSonataSets: number;
  readonly averageTeamCompletenessRatio: number | null;
}

/**
 * Audit metrics for verifying team build evaluation integrity.
 */
export interface TeamBuildEvaluationAuditMetrics {
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.21.1';
  readonly totalEvaluations: number;
  readonly uniqueTeamCandidateIds: number;
  readonly characterBuildEvaluationsMatched: number;
  readonly verifiedAt: string;
}

/**
 * Aggregated result container for a complete team build evaluation collection.
 */
export interface TeamBuildEvaluationResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.21.1';
  readonly evaluations: readonly TeamBuildEvaluation[];
  readonly summary: TeamBuildEvaluationResultSummary;
  readonly audit: TeamBuildEvaluationAuditMetrics;
}
