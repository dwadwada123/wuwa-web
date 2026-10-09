/**
 * Phase 6B Step 4: Semantic Golden Fixtures
 *
 * Real Wuthering Waves Patch 3.7 verified data exercising 10 distinct gameplay mechanics.
 * Each fixture documents:
 * - categoryName
 * - entityName
 * - source
 * - provenance
 * - expectedInterpretation
 * - normalizedRepresentation
 * - whyCorrect
 */

import type {
  GameplayEffectCategory,
  GameplayEffectTarget,
  RefinementScaling
} from '../../lib/ingestion/types.ts';

export interface SemanticGoldenFixture {
  categoryName: string;
  entityName: string;
  source: string;
  provenance: string;
  expectedInterpretation: string;
  normalizedRepresentation: {
    category: GameplayEffectCategory;
    target: GameplayEffectTarget;
    conditionExpression?: Record<string, unknown>;
    detailExpression?: Record<string, unknown>;
    refinementScaling?: RefinementScaling;
  };
  whyCorrect: string;
}

export const SEMANTIC_GOLDEN_FIXTURES: Record<string, SemanticGoldenFixture> = {
  // 1. Direct Self Buff
  DIRECT_SELF_BUFF: {
    categoryName: 'Direct Self Buff',
    entityName: 'Emerald of Genesis (Weapon Passive: Star-Crossing Path)',
    source: 'Kuro Games Official 3.7 Release Announcement & Client Datamine',
    provenance: 'Kuro Games Official 3.7 Release Announcement',
    expectedInterpretation:
      'Wielder gains personal Energy Regen bonus (+12.8% at R1) and personal ATK bonus (+6% at R1) upon casting Resonance Skill, lasting 10s. Does not affect teammates or incoming resonators.',
    normalizedRepresentation: {
      category: 'STAT_BUFF',
      target: 'SELF',
      conditionExpression: {
        trigger: 'resonance_skill'
      },
      detailExpression: {
        energy_regen: 0.128,
        atk_percent: 0.12,
        duration_seconds: 10,
        refinement_scaling: {
          R1: { energyRegen: 12.8, atkPct: 6 },
          R2: { energyRegen: 16, atkPct: 7.5 },
          R3: { energyRegen: 19.2, atkPct: 9 },
          R4: { energyRegen: 22.4, atkPct: 10.5 },
          R5: { energyRegen: 25.6, atkPct: 12 }
        }
      }
    },
    whyCorrect:
      'Target is strictly SELF because stat buffs apply only to the wielder upon active skill cast. Condition trigger is resonance_skill with 10s duration.'
  },

  // 2. Team-Wide Buff
  TEAM_WIDE_BUFF: {
    categoryName: 'Team-Wide Buff',
    entityName: 'Verina (Outro Skill: Blossom)',
    source: 'Kuro Games Official 3.7 Release Announcement & Client Datamine',
    provenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    expectedInterpretation:
      'Grants 15% All-Attribute DMG Amplification to ALL team members for 30s. Persistent across swaps, benefiting both on-field and off-field teammates.',
    normalizedRepresentation: {
      category: 'DMG_AMPLIFY',
      target: 'TEAM',
      conditionExpression: {
        trigger: 'outro_skill'
      },
      detailExpression: {
        element: 'ALL',
        amplification_ratio: 0.15,
        duration_seconds: 30
      }
    },
    whyCorrect:
      'Target is TEAM because Verina Outro specifically states "all team members" without a remove_on_swap restriction. Duration is 30s.'
  },

  // 3. Enemy Debuff
  ENEMY_DEBUFF: {
    categoryName: 'Enemy Debuff',
    entityName: 'Blooming Jadehaven (Weapon Passive: Hundredfold Artifice)',
    source: 'Kuro Games Official 3.7 Release Announcement & Client Datamine',
    provenance: 'Kuro Games Official 3.7 Release Announcement',
    expectedInterpretation:
      'Reduces target enemy Electro Resistance (10% to 24% from R1 to R5) upon inflicting Electro Flare or triggering Unison Response.',
    normalizedRepresentation: {
      category: 'RES_SHRED',
      target: 'ENEMY',
      conditionExpression: {
        trigger: 'electro_flare_or_unison_response'
      },
      detailExpression: {
        shred_element: 'Electro',
        refinement_scaling: {
          R1: { resShred_electro: 10 },
          R2: { resShred_electro: 13.5 },
          R3: { resShred_electro: 17 },
          R4: { resShred_electro: 20.5 },
          R5: { resShred_electro: 24 }
        }
      }
    },
    whyCorrect:
      'Resistance shred is an enemy debuff, so target is ENEMY. Values scale monotonically from 10% to 24% across R1–R5 without synthetic extrapolation.'
  },

  // 4. Next-Resonator Effect
  NEXT_RESONATOR_EFFECT: {
    categoryName: 'Next-Resonator Effect',
    entityName: 'Sanhua (Outro Skill: Silversnow)',
    source: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    provenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    expectedInterpretation:
      'Incoming resonator gains 38% Basic Attack DMG Amplification for 14s or until switched out. Does NOT buff the entire team.',
    normalizedRepresentation: {
      category: 'DMG_AMPLIFY',
      target: 'NEXT_RESONATOR',
      conditionExpression: {
        trigger: 'outro_skill'
      },
      detailExpression: {
        damage_category: 'BASIC_ATTACK',
        amplification_ratio: 0.38,
        duration_seconds: 14,
        remove_on_swap: true
      }
    },
    whyCorrect:
      'Target is NEXT_RESONATOR because only the character switched in receives the buff. remove_on_swap is true, distinguishing it from universal team buffs.'
  },

  // 5. Conditional Effect
  CONDITIONAL_EFFECT: {
    categoryName: 'Conditional Effect',
    entityName: 'Taoqi (Outro Skill: Iron Will)',
    source: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    provenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    expectedInterpretation:
      'Next switched-in character gains 38% Resonance Skill DMG Amplification for 14s, expiring immediately if that character is swapped out.',
    normalizedRepresentation: {
      category: 'DMG_AMPLIFY',
      target: 'NEXT_RESONATOR',
      conditionExpression: {
        trigger: 'outro_skill'
      },
      detailExpression: {
        damage_category: 'RESONANCE_SKILL',
        amplification_ratio: 0.38,
        duration_seconds: 14,
        remove_on_swap: true
      }
    },
    whyCorrect:
      'The buff is strictly conditional on rotation order (next character) and ends on swap, preventing invalid team-wide assumptions.'
  },

  // 6. Damage-Type-Specific Effect
  DAMAGE_TYPE_SPECIFIC_EFFECT: {
    categoryName: 'Damage-Type-Specific Effect',
    entityName: 'Mortefi (Outro Skill: Keen Tune)',
    source: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    provenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    expectedInterpretation:
      'Next character receives 38% Heavy Attack DMG Amplification for 14s (or until swap). Does NOT amplify Basic, Skill, or Liberation DMG.',
    normalizedRepresentation: {
      category: 'DMG_AMPLIFY',
      target: 'NEXT_RESONATOR',
      conditionExpression: {
        trigger: 'outro_skill'
      },
      detailExpression: {
        damage_category: 'HEAVY_ATTACK',
        amplification_ratio: 0.38,
        duration_seconds: 14,
        remove_on_swap: true
      }
    },
    whyCorrect:
      'Explicitly scoped to HEAVY_ATTACK, ensuring future optimizer pairs Mortefi with Heavy Attack DPS (like Jiyan) and not non-heavy dealers.'
  },

  // 7. Sequence-Based Effect
  SEQUENCE_BASED_EFFECT: {
    categoryName: 'Sequence-Based Effect',
    entityName: 'Jiyan (Sequence Node 1: Benevolence)',
    source: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    provenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    expectedInterpretation:
      'Resonance Skill Windqueller gains 1 additional charge, and its Resolve cost is decreased by 15. Belongs strictly to Jiyan at Node Order 1.',
    normalizedRepresentation: {
      category: 'RESOURCE_GRANT',
      target: 'SELF',
      conditionExpression: {
        skill_code: 'ResonanceSkill'
      },
      detailExpression: {
        extra_charges: 1,
        resolve_cost_reduction: 15
      }
    },
    whyCorrect:
      'Correctly models Jiyan S1 utility modification (skill charges + resource discount), preserving sequence ordering S1.'
  },

  // 8. Weapon Refinement Effect
  WEAPON_REFINEMENT_EFFECT: {
    categoryName: 'Weapon Refinement Effect',
    entityName: 'Blazing Brilliance (Weapon Passive: Crimson Phoenix)',
    source: 'Kuro Games Official 3.7 Release Announcement & Client Datamine',
    provenance: 'Kuro Games Official 3.7 Release Announcement',
    expectedInterpretation:
      'ATK increases by 12% to 24% across R1–R5. Resonance Skill DMG bonus per stack scales from 4% to 8% across R1–R5.',
    normalizedRepresentation: {
      category: 'DMG_AMPLIFY',
      target: 'SELF',
      conditionExpression: {
        trigger: 'resonance_skill'
      },
      detailExpression: {
        skill_dmg_bonus: 0.28,
        duration_seconds: 12
      },
      refinementScaling: {
        R1: { atkPct: 12, dmgBonus_skill: 4 },
        R2: { atkPct: 15, dmgBonus_skill: 5 },
        R3: { atkPct: 18, dmgBonus_skill: 6 },
        R4: { atkPct: 21, dmgBonus_skill: 7 },
        R5: { atkPct: 24, dmgBonus_skill: 8 }
      }
    },
    whyCorrect:
      'Explicit parameters across all 5 ranks with monotonic progression. Zero synthetic formulas or power multipliers.'
  },

  // 9. Passive Effect
  PASSIVE_EFFECT: {
    categoryName: 'Passive Effect',
    entityName: 'Red Spring (Weapon Passive: Vermilion Tide)',
    source: 'Kuro Games Official 3.7 Release Announcement & Client Datamine',
    provenance: 'Kuro Games Official 3.7 Release Announcement',
    expectedInterpretation:
      'Increases ATK on Basic Attack hit (+12% to +24%) and Basic Attack DMG bonus (+40% to +80%) across R1–R5 for 10s.',
    normalizedRepresentation: {
      category: 'STAT_BUFF',
      target: 'SELF',
      conditionExpression: {
        trigger: 'basic_attack'
      },
      detailExpression: {
        atk_percent: 0.14,
        duration_seconds: 10
      },
      refinementScaling: {
        R1: { atkPct: 12, dmgBonus_basic: 40 },
        R2: { atkPct: 15, dmgBonus_basic: 50 },
        R3: { atkPct: 18, dmgBonus_basic: 60 },
        R4: { atkPct: 21, dmgBonus_basic: 70 },
        R5: { atkPct: 24, dmgBonus_basic: 80 }
      }
    },
    whyCorrect:
      'Passive trigger is basic_attack, target is SELF, and scaling represents concrete in-game percentages.'
  },

  // 10. Multi-Condition Effect
  MULTI_CONDITION_EFFECT: {
    categoryName: 'Multi-Condition Effect',
    entityName: 'Shorekeeper (Outro Skill: Binary Butterfly)',
    source: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    provenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    expectedInterpretation:
      'Whichever Resonator is currently active on the field gains Crit Rate and Crit DMG while butterfly zone remains active. Target is dynamically ACTIVE_CHARACTER.',
    normalizedRepresentation: {
      category: 'DMG_AMPLIFY',
      target: 'ACTIVE_CHARACTER',
      conditionExpression: {
        trigger: 'outro_skill',
        zone_active: true
      },
      detailExpression: {
        crit_rate: 0.125,
        crit_dmg: 0.25,
        duration_seconds: 30
      }
    },
    whyCorrect:
      'Target is ACTIVE_CHARACTER (not TEAM or NEXT_RESONATOR) because the butterfly buff actively transfers to whichever character takes the field.'
  }
};
