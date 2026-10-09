/**
 * Wuthering Waves Deterministic Team Composition Candidate Contract Types
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Defines contracts for representing an order-independent set of three distinct
 * owned-agnostic Resonators forming a structurally qualified composition candidate
 * based strictly on approved Step 8 pairwise synergy evidence.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. COMPOSITION CANDIDATE != TEAM SCORE != TEAM POWER != TOA FITNESS.
 *    A candidate result means: "This triple {A,B,C} is a structurally qualified composition
 *    candidate because approved pairwise synergy evidence exists among some or all of its members."
 *    It does NOT mean best team, strongest team, meta team, or high DPS.
 * 2. EXACT CARDINALITY: Team size = exactly 3 distinct Resonators.
 * 3. ORDER INDEPENDENCE: {A,B,C} === {B,A,C} === {C,B,A}. Canonical member IDs: [min, mid, max].
 * 4. DIRECTIONAL EDGES PRESERVED: Step 8 pair profiles (A -> B vs B -> A) are preserved as distinct
 *    directional edges within directionalPairEdges. Never collapse or auto-create reverse edges.
 * 5. NO TRANSITIVE SYNERGY: A -> B and B -> C does NOT imply A -> C.
 * 6. NO ROLE INFERENCE: Zero DPS, Sub-DPS, Support, Healer, Buffer roles.
 * 7. NO TEAM SCORING: Zero numeric scores. Structural counts (matchedPairCount, directionalEdgeCount,
 *    independentEvidenceLineageCount) are diagnostics, NOT scores.
 * 8. NO TOA OR VIGOR: Zero Tower of Adversity, stage, or Vigor logic.
 * 9. NO ANTI-SYNERGY: Absence of evidence is strictly NO_PAIRWISE_EVIDENCE, never anti-synergy or penalty.
 * 10. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type {
  CharacterPairSynergyStatus,
  CharacterPairSynergyCategory,
  CharacterPairSynergyProfile
} from '../relationships/character-pairs/synergy/types.ts';

export type {
  SourceReference,
  CharacterPairSynergyStatus,
  CharacterPairSynergyCategory,
  CharacterPairSynergyProfile
};

/**
 * Closed qualification status taxonomy for team composition candidates.
 * Strictly reflects epistemic certainty of modeled pairwise synergy evidence for the triple.
 */
export type TeamCompositionQualificationStatus =
  | 'QUALIFIED'            // Sufficient evaluated pairwise synergy evidence (>=2 pairs) without unresolved evidence
  | 'PARTIALLY_QUALIFIED'  // >=2 connected pairs with at least one evaluated relationship while others are partial/contextual/unmodeled
  | 'CONTEXT_DEPENDENT'    // >=2 connected pairs where all available positive evidence requires runtime context
  | 'UNMODELED'            // Supporting pairwise evidence is explicitly UNMODELED
  | 'UNKNOWN'              // Upstream evidence is UNKNOWN; fail-closed
  | 'NOT_APPLICABLE'       // Upstream applicability explicitly establishes NOT_APPLICABLE
  | 'NO_PAIRWISE_EVIDENCE'; // No approved positive pairwise synergy established (< 2 connected pairs; strictly NOT anti-synergy)

/**
 * Closed, objective qualification types for structurally qualified team candidates.
 * Strictly descriptive qualification reasons; ZERO subjective or meta labels.
 */
export type TeamCompositionQualificationType =
  | 'TWO_PAIR_SYNERGY_EDGES'       // Exactly 2 distinct unordered pairs have qualifying synergy
  | 'THREE_PAIR_SYNERGY_EDGES'     // All 3 distinct unordered pairs have qualifying synergy
  | 'DIRECTIONAL_SYNERGY_CHAIN'    // A directional sequence exists (e.g. A -> B and B -> C)
  | 'MULTI_CATEGORY_PAIR_SUPPORT'  // Supporting synergy edges span multiple distinct synergy categories
  | 'CONTEXTUAL_PAIR_SUPPORT'      // Candidate contains contextual pairwise synergy edges
  | 'UNMODELED_PAIR_SUPPORT';      // Candidate contains unmodeled pairwise synergy edges

/**
 * Directional pairwise evidence edge connecting two distinct team members.
 * Preserves Step 8 directional profiles (sourceResonatorId -> targetResonatorId)
 * while the parent team candidate identity remains unordered.
 */
export interface TeamDirectionalPairEdge {
  /** Originating source Resonator */
  readonly sourceResonatorId: string;
  /** Beneficiary target Resonator */
  readonly targetResonatorId: string;
  /** Canonical Step 8 CharacterPairSynergyProfile ID */
  readonly synergyProfileId: string;
  /** Authoritative Step 8 synergy status */
  readonly synergyStatus: CharacterPairSynergyStatus;
  /** Distinct positive synergy categories established for this directional edge */
  readonly synergyCategories: readonly CharacterPairSynergyCategory[];
  /** Underlying Step 4 InteractionEvidence IDs */
  readonly evidenceIds: readonly string[];
  /** Underlying Step 3 GameplayRelationship IDs */
  readonly relationshipIds: readonly string[];
}

/**
 * Runtime applicability accounting across the 3 unordered pairs connecting the team.
 */
export interface TeamApplicabilitySummary {
  /** Count of unordered pairs with fully evaluated synergy */
  readonly evaluatedPairCount: number;
  /** Count of unordered pairs with partially evaluated synergy */
  readonly partiallyEvaluatedPairCount: number;
  /** Count of unordered pairs with context-dependent synergy */
  readonly contextDependentPairCount: number;
  /** Count of unordered pairs with unmodeled synergy */
  readonly unmodeledPairCount: number;
  /** Count of unordered pairs with unknown upstream status */
  readonly unknownPairCount: number;
  /** Count of unordered pairs with not-applicable status */
  readonly notApplicablePairCount: number;
  /** Count of unordered pairs with no modeled evidence */
  readonly noEvidencePairCount: number;
  /** Canonical sorted list of missing runtime context dimensions */
  readonly missingContextDimensions: readonly string[];
}

/**
 * Authoritative TeamCompositionCandidate contract.
 * Represents an order-independent set of exactly 3 distinct Resonators
 * with structured pairwise synergy evidence.
 */
export interface TeamCompositionCandidate {
  /** Deterministic identifier: team-composition:3.7:<A>:<B>:<C>:7.9.1 with canonical sorted IDs */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Generator rule version: 7.9.1 */
  readonly ruleVersion: '7.9.1';

  /** Canonical sorted tuple of exactly 3 distinct Resonator IDs: [minId, midId, maxId] */
  readonly memberResonatorIds: readonly [string, string, string];

  /** Canonical list of supporting Step 8 CharacterPairSynergyProfile IDs */
  readonly pairSynergyProfileIds: readonly string[];

  /** Canonical list of supporting Step 7 CharacterPairEvidenceProfile IDs */
  readonly pairEvidenceProfileIds: readonly string[];

  /** Canonical list of underlying source fact IDs */
  readonly supportingSourceFactIds: readonly string[];

  /** Canonical list of underlying Step 4 InteractionEvidence IDs */
  readonly supportingEvidenceIds: readonly string[];

  /** Canonical list of underlying Step 3 GameplayRelationship IDs */
  readonly supportingRelationshipIds: readonly string[];

  /** Directional pairwise edges connecting members of this candidate */
  readonly directionalPairEdges: readonly TeamDirectionalPairEdge[];

  /** Authoritative structural qualification status */
  readonly qualificationStatus: TeamCompositionQualificationStatus;

  /** Objective structural qualification types */
  readonly qualificationTypes: readonly TeamCompositionQualificationType[];

  /** Distinct mechanical synergy categories established across supporting edges */
  readonly supportingSynergyCategories: readonly CharacterPairSynergyCategory[];

  /**
   * Number of distinct unordered pairs having qualifying synergy (0, 1, 2, or 3).
   * Structural diagnostic only; NOT a score.
   */
  readonly matchedPairCount: number;

  /**
   * Total number of directional edges in directionalPairEdges (0 to 6).
   * Structural diagnostic only; NOT a score.
   */
  readonly directionalEdgeCount: number;

  /**
   * Count of distinct independent evidence records after lineage deduplication.
   * Structural diagnostic only; NOT a score.
   */
  readonly independentEvidenceLineageCount: number;

  /** Missing runtime context requirements if evidence is contextual */
  readonly contextRequirements: readonly string[];

  /** Pairwise applicability summary across the 3 member pairs */
  readonly applicabilitySummary: TeamApplicabilitySummary;

  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];

  /** Source provenance preserved from underlying lineage */
  readonly provenance: SourceReference;
}

/**
 * Query filter for team composition candidates.
 */
export interface TeamCompositionCandidateFilter {
  readonly patchVersion?: '3.7';
  readonly resonatorId?: string; // matches any of the 3 members
  readonly memberResonatorIds?: readonly string[]; // matches subset of members
  readonly qualificationStatus?: TeamCompositionQualificationStatus;
  readonly qualificationType?: TeamCompositionQualificationType;
  readonly synergyCategory?: CharacterPairSynergyCategory;
  readonly minMatchedPairs?: number;
  readonly minDirectionalEdges?: number;
}

/**
 * Options for team composition candidate generation.
 */
export interface TeamCompositionOptions {
  /** Explicit rule version override. Default: '7.9.1'. */
  readonly ruleVersion?: '7.9.1';
  /** Whether to include NO_PAIRWISE_EVIDENCE candidates for all theoretical triples. */
  readonly includeEmptyTriples?: boolean;
}

/**
 * Human-readable presentation explanation for a TeamCompositionCandidate.
 */
export interface TeamCompositionExplanation {
  readonly candidateId: string;
  readonly members: readonly [string, string, string];
  readonly qualificationStatus: TeamCompositionQualificationStatus;
  readonly summary: string;
  readonly matchedPairCount: number;
  readonly directionalEdgeCount: number;
  readonly supportingCategories: readonly CharacterPairSynergyCategory[];
  readonly explanationCodes: readonly string[];
}

/**
 * Production audit and reconciliation metrics for Step 9.
 */
export interface ProductionTeamAuditMetrics {
  readonly totalResonators: number;
  readonly theoreticalTriples: number;
  readonly triplesWithEvidence: number;
  readonly noEvidenceTriples: number;

  readonly totalModeledCandidates: number;
  readonly totalMaterializedCandidates: number;
  readonly uniqueCandidateIds: number;
  readonly duplicateCandidateIds: number;

  readonly qualifiedCount: number;
  readonly partiallyQualifiedCount: number;
  readonly contextDependentCount: number;
  readonly unmodeledCount: number;
  readonly unknownCount: number;
  readonly notApplicableCount: number;
  readonly noPairwiseEvidenceCount: number;

  readonly totalConnectedPairOccurrences: number;
  readonly totalDirectionalEdges: number;

  readonly matchedPairCountDistribution: Readonly<Record<number, number>>;
  readonly directionalEdgeCountDistribution: Readonly<Record<number, number>>;
  readonly independentEvidenceLineageCountDistribution: Readonly<Record<number, number>>;
  readonly synergyCategoryDistribution: Readonly<Record<CharacterPairSynergyCategory, number>>;
  readonly qualificationTypeDistribution: Readonly<Record<TeamCompositionQualificationType, number>>;

  readonly directionalityStats: {
    readonly unidirectionalOnlyPairs: number;
    readonly bidirectionalPairs: number;
  };

  readonly candidates: readonly TeamCompositionCandidate[];
}
