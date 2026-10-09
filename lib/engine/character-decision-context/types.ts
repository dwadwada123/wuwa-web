/**
 * Wuthering Waves Character Decision Context Types
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Defines contracts for unifying Step 16 investment-aware character evaluations
 * and Step 18 directional character interaction profiles into a patch-bound
 * character decision context.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FUSION/CONTEXT ONLY, ZERO SCORING:
 *    Combines approved deterministic evidence. Does NOT create a combined score,
 *    priority score, overall score, character power, synergy score, or DPS metric.
 * 2. NO TEAM DECISION:
 *    Does NOT generate teams, rank teams, or recommend teammates.
 * 3. NO ROLE INFERENCE:
 *    Does NOT infer mainDPS, subDPS, support, buffer, or hypercarry.
 * 4. STRICT PATCH ISOLATION:
 *    Strictly bound to Patch 3.7. Rejects cross-patch inputs.
 * 5. DETERMINISTIC & PURE:
 *    Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 6. EPISTEMIC FIDELITY & IMMUTABILITY:
 *    Preserves Step 16 and Step 18 data without re-computation or semantic distortion.
 */

import type {
  CharacterEvaluation,
  CharacterEvaluationStatus,
  CharacterEvaluationSummary
} from '../character-evaluation/types.ts';
import type {
  CharacterInteractionProfile,
  CharacterInteractionProfileSummary
} from '../character-interaction-profiles/types.ts';
import type { ResonatorInvestmentSnapshot } from '../investment/types.ts';

export type {
  CharacterEvaluation,
  CharacterEvaluationStatus,
  CharacterEvaluationSummary,
  CharacterInteractionProfile,
  CharacterInteractionProfileSummary,
  ResonatorInvestmentSnapshot
};

/**
 * Factual summary of a character's decision context.
 * Strictly quantitative counts and upstream statuses; NEVER weights or scores.
 */
export interface CharacterDecisionContextSummary {
  /** True if Step 16 evaluation is attached */
  readonly hasEvaluation: boolean;
  /** Epistemic evaluation status from Step 16 */
  readonly evaluationStatus: CharacterEvaluationStatus;
  /** Evaluation score preserved from Step 16 (or null) */
  readonly evaluationScore: number | null;

  /** Total outgoing interaction records from Step 18 */
  readonly outgoingInteractionCount: number;
  /** Total incoming interaction records from Step 18 */
  readonly incomingInteractionCount: number;

  /** Authoritative outgoing interaction count */
  readonly authoritativeOutgoingCount: number;
  /** Authoritative incoming interaction count */
  readonly authoritativeIncomingCount: number;

  /** Unknown outgoing interaction count */
  readonly unknownOutgoingCount: number;
  /** Unknown incoming interaction count */
  readonly unknownIncomingCount: number;

  /** Unmodeled outgoing interaction count */
  readonly unmodeledOutgoingCount: number;
  /** Unmodeled incoming interaction count */
  readonly unmodeledIncomingCount: number;

  /** Conflicted outgoing interaction count */
  readonly conflictedOutgoingCount: number;
  /** Conflicted incoming interaction count */
  readonly conflictedIncomingCount: number;

  /** Number of distinct outgoing interaction target characters */
  readonly distinctOutgoingTargets: number;
  /** Number of distinct incoming interaction source characters */
  readonly distinctIncomingSources: number;
}

/**
 * Provenance reference for a derived CharacterDecisionContext.
 */
export interface CharacterDecisionContextProvenance {
  readonly source: 'DERIVED_DECISION_CONTEXT';
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.19.1';
  readonly evaluationId: string;
  readonly profileId: string;
  readonly upstreamEvaluationRuleVersion: '7.16.1';
  readonly upstreamProfileRuleVersion: '7.18.1';
}

/**
 * Authoritative CharacterDecisionContext contract.
 * Represents the unified evidence context for a single canonical Resonator.
 */
export interface CharacterDecisionContext {
  /** Deterministic identifier: char-context:3.7:<characterId>:7.19.1 */
  readonly id: string;

  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';

  /** Rule version: strictly '7.19.1' */
  readonly ruleVersion: '7.19.1';

  /** Canonical Resonator entity ID */
  readonly characterId: string;

  /** Authoritative Step 16 evaluation */
  readonly evaluation: CharacterEvaluation;

  /** Authoritative Step 18 interaction profile */
  readonly interactionProfile: CharacterInteractionProfile;

  /** Deterministic factual summary */
  readonly contextSummary: CharacterDecisionContextSummary;

  /** Alias to contextSummary */
  readonly summary: CharacterDecisionContextSummary;

  /** Derived provenance metadata */
  readonly provenance: CharacterDecisionContextProvenance;
}

/**
 * Input contract for constructing character decision contexts.
 */
export interface CharacterDecisionContextInput {
  /** Target patch version: strictly '3.7' */
  readonly patchId?: string;

  /** Optional evaluation catalog (defaults to Step 16 default evaluations) */
  readonly evaluations?: readonly CharacterEvaluation[];

  /** Optional interaction profile catalog (defaults to Step 18 default profiles) */
  readonly interactionProfiles?: readonly CharacterInteractionProfile[];

  /** Optional list of character IDs to include (defaults to all known canonical Resonators) */
  readonly characterIds?: readonly string[];
}

/**
 * Multi-dimensional filter criteria for querying character decision contexts.
 */
export interface CharacterDecisionContextFilter {
  readonly patchVersion?: '3.7';
  readonly characterId?: string;
  readonly hasEvaluation?: boolean;
  readonly evaluationStatus?: CharacterEvaluationStatus;
  readonly hasOutgoing?: boolean;
  readonly hasIncoming?: boolean;
  readonly minOutgoing?: number;
  readonly minIncoming?: number;
  readonly hasAuthoritativeOutgoing?: boolean;
  readonly hasAuthoritativeIncoming?: boolean;
}

/**
 * Quantitative summary of a CharacterDecisionContextResult collection.
 */
export interface CharacterDecisionContextResultSummary {
  readonly totalContexts: number;
  readonly totalEvaluated: number;
  readonly totalPartiallyEvaluated: number;
  readonly totalInvestmentUnknown: number;
  readonly totalWithOutgoingInteractions: number;
  readonly totalWithIncomingInteractions: number;
  readonly totalUnderlyingInteractions: number;
}

/**
 * Audit metrics for verifying decision context integrity.
 */
export interface CharacterDecisionContextAuditMetrics {
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.19.1';
  readonly totalContexts: number;
  readonly uniqueCharacterIds: number;
  readonly canonicalResonatorCoverage: number;
  readonly evaluationsMatched: number;
  readonly profilesMatched: number;
  readonly verifiedAt: string;
}

/**
 * Aggregated result container for a complete decision context collection.
 */
export interface CharacterDecisionContextResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.19.1';
  readonly contexts: readonly CharacterDecisionContext[];
  readonly summary: CharacterDecisionContextResultSummary;
  readonly audit: CharacterDecisionContextAuditMetrics;
}
