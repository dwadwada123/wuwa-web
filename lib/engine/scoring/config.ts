/**
 * Central Scoring Configuration & Weight Allocation
 *
 * Immutable, transparent weighting model for stage-relative team scoring.
 * Weights sum to exactly 1000, establishing a normalized integer scale [0..1000].
 */

export const TEAM_SCORING_CONFIG = {
  maxRawScore: 100,
  maxTotalScore: 1000,
  weights: {
    // 1. Stage Buff Compatibility (18%): ToA stages are defined by their unique area effects
    stageBuffCompatibility: 180,

    // 2. Elemental Matchup (16%): Resistance & affinity dictates core damage throughput
    elementalMatchup: 160,

    // 3. Offensive Synergy (14%): Multipliers, damage amplification, and buff chains
    offensiveSynergy: 140,

    // 4. Role Coverage (12%): Balanced team archetype (Main DPS, Sub DPS, Support)
    roleCoverage: 120,

    // 5. Enemy Matchup (10%): Threat profile alignment (Single boss, elite, mob wave, shield bars)
    enemyMatchup: 100,

    // 6. Resistance Utility (10%): Defense shred and resistance reduction mechanics
    resistanceUtility: 100,

    // 7. Sustain (8%): Stage-relative survivability (crucial for bosses, lower for early floors)
    sustain: 80,

    // 8. Coordinated Attack Synergy (6%): Off-field attacks & multi-hit frequency
    coordinatedAttackSynergy: 60,

    // 9. Resource Synergy (6%): Concerto generation and Energy regeneration efficiency
    resourceSynergy: 60,
  },
} as const;

export type ScoringDimensionKey = keyof typeof TEAM_SCORING_CONFIG.weights;
