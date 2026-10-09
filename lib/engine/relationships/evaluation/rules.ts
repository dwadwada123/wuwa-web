/**
 * Wuthering Waves Compatibility Candidate Evaluation Rules & Constants
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Central repository for all evaluation rule versions, numerical constants,
 * component ceilings, and deterministic scoring weights.
 *
 * ZERO MAGIC NUMBERS: Every numerical constant in the evaluation engine is declared,
 * typed, versioned, and documented here.
 */

/**
 * Authoritative evaluation rule version.
 * Increment this version whenever evaluation scoring formulas, dimensions, or weights change.
 */
export const COMPATIBILITY_EVALUATION_RULE_VERSION = '7.6.1' as const;

/**
 * Bounded numerical score range.
 * Evaluation scores strictly reside within [0, 100].
 */
export const EVALUATION_SCALE_MIN = 0;
export const EVALUATION_SCALE_MAX = 100;

// ============================================================================
// COMPONENT SCORE CEILINGS (Sum: 25 + 35 + 15 + 15 + 10 = 100)
// ============================================================================

/** Maximum points awarded for evidence directness (explicit vs dimensional) */
export const MAX_SCORE_DIRECTNESS = 25;

/** Maximum points awarded for mechanical dimension specificity */
export const MAX_SCORE_SPECIFICITY = 35;

/** Maximum points awarded for multi-dimensional evidence coverage */
export const MAX_SCORE_COVERAGE = 15;

/** Maximum points awarded for runtime context certainty / static applicability */
export const MAX_SCORE_CERTAINTY = 15;

/** Maximum points awarded for safe known gameplay effect magnitude */
export const MAX_SCORE_MAGNITUDE = 10;

// ============================================================================
// 1. EVIDENCE DIRECTNESS RULES
// ============================================================================

/**
 * Full directness points for explicit pairwise target linkage proven by Step 4 InteractionEvidence.
 * Rule: DIRECT_EXPLICIT_LINK
 */
export const DIRECT_EXPLICIT_LINK_SCORE = 25;

/**
 * Directness points for dimensional candidates with targeted scope (NEXT_RESONATOR or ACTIVE_CHARACTER).
 * Rule: DIMENSIONAL_DIRECT_LINK
 */
export const DIMENSIONAL_DIRECT_LINK_SCORE = 15;

/**
 * Directness points for dimensional candidates with broad mechanical scope (TEAM).
 * Rule: DIMENSIONAL_BROAD_LINK
 */
export const DIMENSIONAL_BROAD_LINK_SCORE = 10;

// ============================================================================
// 2. MECHANICAL SPECIFICITY RULES
// ============================================================================

/** Exact action match (e.g. source amplifies Liberation, target executes Liberation) */
export const SPECIFICITY_ACTION_EXACT_SCORE = 25;

/** Exact concrete element match (e.g. Electro amplification to Electro damage) */
export const SPECIFICITY_ELEMENT_EXACT_SCORE = 25;

/** All-element match to canonical concrete element (e.g. All-Attribute to Havoc) */
export const SPECIFICITY_ELEMENT_ALL_SCORE = 20;

/** Outro-to-Intro transition dimension match */
export const SPECIFICITY_TRANSITION_SCORE = 25;

/** Resource support match (Energy regen / cooldown reduction to Liberation / resource) */
export const SPECIFICITY_RESOURCE_SCORE = 20;

/** Coordinated attack mechanical synchronization match */
export const SPECIFICITY_MECHANICAL_SCORE = 25;

/** Offensive stat / shred amplification match */
export const SPECIFICITY_OFFENSIVE_SCORE = 20;

/** Defensive healing / shielding survivability match */
export const SPECIFICITY_DEFENSIVE_SCORE = 20;

/** Broad target scope mechanical qualification match */
export const SPECIFICITY_TARGET_SCOPE_SCORE = 10;

// ============================================================================
// 3. MULTI-DIMENSIONAL EVIDENCE COVERAGE RULES
// ============================================================================

/** Supporting evidence covers 1 distinct mechanical dimension */
export const COVERAGE_ONE_DIMENSION_SCORE = 5;

/** Supporting evidence covers 2 distinct orthogonal mechanical dimensions */
export const COVERAGE_TWO_DIMENSIONS_SCORE = 10;

/** Supporting evidence covers 3 or more distinct orthogonal mechanical dimensions */
export const COVERAGE_THREE_PLUS_DIMENSIONS_SCORE = 15;

// ============================================================================
// 4. CONTEXT CERTAINTY & APPLICABILITY RULES
// ============================================================================

/** Both capabilities are context-free / static with 100% unconditional readiness */
export const CERTAINTY_STATIC_CONTEXT_FREE_SCORE = 15;

/** Contextual capabilities whose required runtime context is fully satisfied */
export const CERTAINTY_CONTEXT_SATISFIED_SCORE = 10;

// ============================================================================
// 5. EFFECT MAGNITUDE SCALING RULES
// ============================================================================

/** Baseline maximum percentage buff (100%) that scales to full magnitude points (10.0) */
export const MAGNITUDE_SCALE_MAX_BUFF_PERCENT = 100;
