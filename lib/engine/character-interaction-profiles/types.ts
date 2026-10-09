/**
 * Wuthering Waves Character Interaction Aggregation & Evidence Profile Types
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 *
 * Defines contracts for aggregating and indexing normalized Step 17 interaction evidence
 * into queryable character interaction profiles under strict Patch 3.7 isolation.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. AGGREGATION & INDEXING ONLY, ZERO SCORING:
 *    The profile is an aggregation/index of directional mechanical facts.
 *    ZERO synergy score, ZERO character power, ZERO team score, ZERO DPS, ZERO tiering.
 * 2. DIRECTIONAL INTEGRITY:
 *    outgoing[A] (A -> B) is distinct from incoming[B] (A -> B).
 *    B.incoming containing A -> B does NOT imply B -> A in B.outgoing.
 * 3. NO RE-COMPOSITION OR TRANSITIVE INFERENCE:
 *    A -> B and B -> C NEVER implies A -> C.
 * 4. PURE & DETERMINISTIC:
 *    Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 5. EPISTEMIC FIDELITY:
 *    Preserves AUTHORITATIVE, UNKNOWN, UNMODELED, NOT_APPLICABLE, and CONFLICTED states intact.
 */

import type {
  CharacterInteractionEvidence,
  CharacterInteractionType,
  CharacterInteractionCategory,
  CharacterInteractionStatus,
  CharacterInteractionCondition,
  SourceReference
} from '../character-interactions/types.ts';

export type {
  CharacterInteractionEvidence,
  CharacterInteractionType,
  CharacterInteractionCategory,
  CharacterInteractionStatus,
  CharacterInteractionCondition,
  SourceReference
};

/**
 * Deterministic quantitative statistical accounting of a single character's interaction profile.
 * Strictly counts; NEVER weights or scores.
 */
export interface CharacterInteractionProfileSummary {
  readonly outgoingTotal: number;
  readonly incomingTotal: number;
  readonly outgoingAuthoritative: number;
  readonly incomingAuthoritative: number;
  readonly outgoingUnknown: number;
  readonly incomingUnknown: number;
  readonly outgoingUnmodeled: number;
  readonly incomingUnmodeled: number;
  readonly outgoingNotApplicable: number;
  readonly incomingNotApplicable: number;
  readonly outgoingConflicted: number;
  readonly incomingConflicted: number;
  readonly distinctOutgoingTargets: number;
  readonly distinctIncomingSources: number;
}

/**
 * Authoritative normalized character interaction evidence profile.
 * Aggregates directional interactions originating from or targeting a canonical Resonator.
 */
export interface CharacterInteractionProfile {
  /** Deterministic canonical ID: char-profile:3.7:<characterId>:7.18.1 */
  readonly id: string;

  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';

  /** Rule version: strictly '7.18.1' */
  readonly ruleVersion: '7.18.1';

  /** Canonical Resonator ID */
  readonly characterId: string;

  /** All valid Step 17 records where sourceCharacterId === characterId */
  readonly outgoing: readonly CharacterInteractionEvidence[];

  /** All valid Step 17 records where targetCharacterId === characterId */
  readonly incoming: readonly CharacterInteractionEvidence[];

  /** Deterministic summary counts for this character */
  readonly summary: CharacterInteractionProfileSummary;
}

/**
 * Input contract for the Step 18 aggregation engine.
 */
export interface CharacterInteractionProfileAggregationInput {
  /** Patch context: strictly '3.7' */
  readonly patchId: string;

  /** Optional custom interaction evidence records (defaults to Step 17 canonical evidence) */
  readonly interactionEvidence?: readonly CharacterInteractionEvidence[];

  /** Optional list of character IDs to build profiles for (defaults to all known Resonators) */
  readonly characterIds?: readonly string[];

  /** Rule version: strictly '7.18.1' */
  readonly ruleVersion: '7.18.1';
}

/**
 * High-level accounting summary across all aggregated character profiles in the patch.
 */
export interface CharacterInteractionAggregationSummary {
  readonly totalProfiles: number;
  readonly totalUnderlyingInteractions: number;
  readonly totalOutgoingIndexed: number;
  readonly totalIncomingIndexed: number;
  readonly authoritativeTotal: number;
  readonly unknownTotal: number;
  readonly unmodeledTotal: number;
  readonly notApplicableTotal: number;
  readonly conflictedTotal: number;
  readonly charactersWithOutgoing: number;
  readonly charactersWithIncoming: number;
}

/**
 * Deterministic audit report for character interaction aggregation.
 */
export interface CharacterInteractionAggregationAudit {
  readonly deterministic: true;
  readonly patchIsolated: true;
  readonly lineagePreserved: true;
  readonly invariantsVerified: true;
}

/**
 * Output contract of the Step 18 aggregation engine.
 */
export interface CharacterInteractionProfileAggregationResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.18.1';
  readonly profiles: readonly CharacterInteractionProfile[];
  readonly summary: CharacterInteractionAggregationSummary;
  readonly audit: CharacterInteractionAggregationAudit;
}

/**
 * Query filter for character interaction profiles.
 */
export interface CharacterInteractionProfileFilter {
  readonly patchVersion?: '3.7';
  readonly characterId?: string;
  readonly hasOutgoing?: boolean;
  readonly hasIncoming?: boolean;
  readonly hasAuthoritativeOutgoing?: boolean;
  readonly hasAuthoritativeIncoming?: boolean;
  readonly minOutgoing?: number;
  readonly minIncoming?: number;
}
