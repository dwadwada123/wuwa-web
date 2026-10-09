/**
 * Phase 6C Step 1: Semantic Extraction Golden Fixtures
 *
 * Real Wuthering Waves Patch 3.7 cases exercising deterministic extraction.
 * Each fixture records:
 * - name
 * - inputRawText
 * - context
 * - expectedStatus
 * - expectedEffectCount
 * - expectedParameters
 * - expectedTargets
 * - expectedDurations
 * - expectedRemoveOnSwap
 * - whyCorrect
 */

import type {
  ExtractionContext,
  ExtractionStatus,
  SemanticParameter,
  SemanticTarget
} from '../../lib/domain/types/semantics.ts';

export interface SemanticExtractionGoldenFixture {
  name: string;
  inputRawText: string;
  context: ExtractionContext;
  expectedStatus: ExtractionStatus;
  expectedEffectCount: number;
  expectedParameters: SemanticParameter[];
  expectedTargets: SemanticTarget[];
  expectedDurations?: Array<number | undefined>;
  expectedRemoveOnSwap?: boolean[];
  whyCorrect: string;
}

export const EXTRACTION_GOLDEN_FIXTURES: Record<string, SemanticExtractionGoldenFixture> = {
  // 1. Direct Self ATK Buff
  DIRECT_SELF_ATK_BUFF: {
    name: 'Direct Self ATK Buff (Emerald of Genesis)',
    inputRawText:
      'Increases Energy Regen by 12.8%. When Resonance Skill hits, increases ATK by 12% for 10s.',
    context: {
      entityId: 'emerald_of_genesis',
      entityName: 'Emerald of Genesis',
      sourceType: 'WEAPON_PASSIVE',
      sourceCode: 'Passive',
      sourceProvenance: 'Kuro Games Official 3.7 Release Announcement',
      patchVersion: '3.7',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 2,
    expectedParameters: ['ENERGY_REGEN_PERCENT', 'ATK_PERCENT'],
    expectedTargets: ['SELF', 'SELF'],
    expectedDurations: [undefined, 10],
    expectedRemoveOnSwap: [false, false],
    whyCorrect:
      'Extracts both Energy Regen and ATK percentage with 10s duration on the skill proc. Target is strictly SELF.'
  },

  // 2. Team-Wide Attribute Damage Buff
  TEAM_WIDE_ATTRIBUTE_DAMAGE_BUFF: {
    name: 'Team-Wide Attribute Damage Buff (Verina Outro)',
    inputRawText:
      'Grants 15% All-Attribute DMG Amplification to all team members for 30s.',
    context: {
      entityId: 'verina',
      entityName: 'Verina',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OutroSkill',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      patchVersion: '3.7',
      defaultTarget: 'TEAM'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ALL_ATTRIBUTE_DAMAGE_PERCENT'],
    expectedTargets: ['TEAM'],
    expectedDurations: [30],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Target is TEAM because the text explicitly specifies all team members. Duration is 30s and does not expire on swap.'
  },

  // 3. Element-Specific Resistance Shred
  ELEMENT_SPECIFIC_RES_SHRED: {
    name: 'Element-Specific Resistance Shred (Blooming Jadehaven)',
    inputRawText:
      'Reduces target enemy Electro Resistance by 10% to 24%.',
    context: {
      entityId: 'blooming_jadehaven',
      entityName: 'Blooming Jadehaven',
      sourceType: 'WEAPON_PASSIVE',
      sourceCode: 'Passive',
      sourceProvenance: 'Kuro Games Official 3.7 Release Announcement',
      patchVersion: '3.7',
      defaultTarget: 'ENEMY'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ELECTRO_RES_SHRED_PERCENT'],
    expectedTargets: ['ENEMY'],
    expectedDurations: [undefined],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Preserves the Electro-specific shred as a numeric range [10, 24] without generic flattening or midpoint loss.'
  },

  // 4. Next-Resonator Damage Buff
  NEXT_RESONATOR_DAMAGE_BUFF: {
    name: 'Next-Resonator Damage Buff (Sanhua Outro)',
    inputRawText:
      'The incoming Resonator gains 38% Basic Attack DMG Amplification for 14s or until switched out.',
    context: {
      entityId: 'sanhua',
      entityName: 'Sanhua',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OutroSkill',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      patchVersion: '3.7',
      defaultTarget: 'NEXT_RESONATOR'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['BASIC_ATTACK_DAMAGE_PERCENT'],
    expectedTargets: ['NEXT_RESONATOR'],
    expectedDurations: [14],
    expectedRemoveOnSwap: [true],
    whyCorrect:
      'Correctly targets NEXT_RESONATOR and flags removeOnSwap: true to avoid invalid team-wide permanence.'
  },

  // 5. Outro-Triggered Buff
  OUTRO_TRIGGERED_BUFF: {
    name: 'Outro-Triggered Buff (Taoqi Outro)',
    inputRawText:
      'After using Outro Skill, the next switched-in character gains 38% Resonance Skill DMG Amplification for 14s.',
    context: {
      entityId: 'taoqi',
      entityName: 'Taoqi',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OutroSkill',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      patchVersion: '3.7',
      defaultTarget: 'NEXT_RESONATOR'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['SKILL_DAMAGE_PERCENT'],
    expectedTargets: ['NEXT_RESONATOR'],
    expectedDurations: [14],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Trigger is explicitly ON_OUTRO_SKILL and parameter is scoped to Resonance Skill DMG.'
  },

  // 6. Swap-Removal Buff
  SWAP_REMOVAL_BUFF: {
    name: 'Swap-Removal Buff (Mortefi Outro)',
    inputRawText:
      'Next character receives 38% Heavy Attack DMG Amplification for 14s until the character leaves the field.',
    context: {
      entityId: 'mortefi',
      entityName: 'Mortefi',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OutroSkill',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      patchVersion: '3.7',
      defaultTarget: 'NEXT_RESONATOR'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['HEAVY_ATTACK_DAMAGE_PERCENT'],
    expectedTargets: ['NEXT_RESONATOR'],
    expectedDurations: [14],
    expectedRemoveOnSwap: [true],
    whyCorrect:
      'Explicitly captures removeOnSwap: true from "until the character leaves the field".'
  },

  // 7. Explicit Duration
  EXPLICIT_DURATION: {
    name: 'Explicit Duration (Red Spring Passive)',
    inputRawText:
      'Increases ATK by 24% for 10s upon Basic Attack hit.',
    context: {
      entityId: 'red_spring',
      entityName: 'Red Spring',
      sourceType: 'WEAPON_PASSIVE',
      sourceCode: 'Passive',
      sourceProvenance: 'Kuro Games Official 3.7 Release Announcement',
      patchVersion: '3.7',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ATK_PERCENT'],
    expectedTargets: ['SELF'],
    expectedDurations: [10],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Captures numeric duration 10 seconds without guesswork.'
  },

  // 8. Numeric Range
  NUMERIC_RANGE: {
    name: 'Numeric Range (Stat Scaling Range)',
    inputRawText:
      'ATK increases by 12% to 24% based on refinement rank.',
    context: {
      entityId: 'test_weapon',
      entityName: 'Test Weapon',
      sourceType: 'WEAPON_PASSIVE',
      sourceCode: 'Passive',
      sourceProvenance: 'Test Provenance',
      patchVersion: '3.7',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ATK_PERCENT'],
    expectedTargets: ['SELF'],
    expectedDurations: [undefined],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Range representation retains min 12 and max 24 as exact bounds.'
  },

  // 9. Weapon R1–R5 Multi-Rank Scaling
  WEAPON_MULTI_RANK: {
    name: 'Weapon Multi-Rank Scaling (Blazing Brilliance)',
    inputRawText:
      'Increases ATK by 12% to 24% across refinement ranks.',
    context: {
      entityId: 'blazing_brilliance',
      entityName: 'Blazing Brilliance',
      sourceType: 'WEAPON_PASSIVE',
      sourceCode: 'Passive',
      sourceProvenance: 'Kuro Games Official 3.7 Release Announcement',
      patchVersion: '3.7',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ATK_PERCENT'],
    expectedTargets: ['SELF'],
    expectedDurations: [undefined],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Captures ATK range scaling from 12% to 24%.'
  },

  // 10. Unsupported Prose
  UNSUPPORTED_PROSE: {
    name: 'Unsupported Prose (Vague Qualitative Statement)',
    inputRawText:
      'Power increases significantly during combat.',
    context: {
      entityId: 'unknown_mechanic',
      entityName: 'Unknown Mechanic',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S1',
      sourceProvenance: 'Datamine',
      patchVersion: '3.7',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'UNRESOLVED',
    expectedEffectCount: 0,
    expectedParameters: [],
    expectedTargets: [],
    whyCorrect:
      'Conservative parser marks text as UNRESOLVED rather than inventing numbers or assuming 0.'
  },

  // 11. Ambiguous Prose
  AMBIGUOUS_PROSE: {
    name: 'Ambiguous Prose (Unquantified Modifier)',
    inputRawText:
      'Greatly increases Heavy Attack DMG.',
    context: {
      entityId: 'ambiguous_seq',
      entityName: 'Ambiguous Sequence',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S2',
      sourceProvenance: 'Datamine',
      patchVersion: '3.7',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'UNRESOLVED',
    expectedEffectCount: 0,
    expectedParameters: [],
    expectedTargets: [],
    whyCorrect:
      'Does not invent an arbitrary 30% for the qualitative adjective "greatly".'
  },

  // 12. Multiple Numeric Values in One Description
  MULTI_NUMERIC_VALUES: {
    name: 'Multiple Numeric Values (Combined Buff)',
    inputRawText:
      '+15% ATK and +10% Energy Regen for 10s.',
    context: {
      entityId: 'multi_buff',
      entityName: 'Multi Buff Node',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S3',
      sourceProvenance: 'Datamine',
      patchVersion: '3.7',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 2,
    expectedParameters: ['ATK_PERCENT', 'ENERGY_REGEN_PERCENT'],
    expectedTargets: ['SELF', 'SELF'],
    expectedDurations: [10, 10],
    expectedRemoveOnSwap: [false, false],
    whyCorrect:
      'Both distinct numeric stats are extracted independently with shared duration.'
  }
};
