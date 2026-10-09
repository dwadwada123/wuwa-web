/**
 * Phase 6C Step 2: Production Semantic Extraction Golden Fixtures
 *
 * Real production Patch 3.7 examples verifying production extraction behavior.
 */

import type {
  ExtractionContext,
  ExtractionStatus,
  SemanticParameter,
  SemanticTarget
} from '../../lib/domain/types/semantics.ts';

export interface ProductionSemanticFixture {
  name: string;
  sourceEntity: string;
  sourceType: string;
  sourceCode: string;
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

export const PRODUCTION_SEMANTIC_FIXTURES: Record<string, ProductionSemanticFixture> = {
  // 1. Sanhua Outro (Exact production text)
  SANHUA_OUTRO_CANONICAL: {
    name: 'Sanhua Canonical Outro Skill',
    sourceEntity: 'Sanhua',
    sourceType: 'RESONATOR_ABILITY',
    sourceCode: 'OUTRO_SKILL',
    inputRawText:
      'The incoming Resonator has their Basic Attack DMG Amplified by 38% for 14s or until they are switched out.',
    context: {
      entityId: 'Sanhua',
      entityName: 'Sanhua',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OUTRO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      defaultTarget: 'NEXT_RESONATOR'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['BASIC_ATTACK_DAMAGE_PERCENT'],
    expectedTargets: ['NEXT_RESONATOR'],
    expectedDurations: [14],
    expectedRemoveOnSwap: [true],
    whyCorrect:
      'Extracts 38% Basic Attack DMG amplification for NEXT_RESONATOR with 14s duration and swap expiration.'
  },

  // 2. Mornye Outro (Team-wide All DMG)
  MORNYE_OUTRO_CANONICAL: {
    name: 'Mornye Canonical Outro Skill',
    sourceEntity: 'Mornye',
    sourceType: 'RESONATOR_ABILITY',
    sourceCode: 'OUTRO_SKILL',
    inputRawText:
      'Resonators in the team gain 25% All DMG Amplification for 30s.',
    context: {
      entityId: 'Mornye',
      entityName: 'Mornye',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OUTRO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      defaultTarget: 'TEAM'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ALL_ATTRIBUTE_DAMAGE_PERCENT'],
    expectedTargets: ['TEAM'],
    expectedDurations: [30],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Extracts universal team buff of 25% All DMG Amplification with 30s persistent duration.'
  },

  // 3. Yangyang S6 (Team ATK Buff from Sequence)
  YANGYANG_S6_CANONICAL: {
    name: 'Yangyang Canonical Sequence 6',
    sourceEntity: 'Yangyang',
    sourceType: 'RESONATOR_SEQUENCE',
    sourceCode: 'S6',
    inputRawText:
      'After casting Mid-air Attack Feather Release, the ATK of all team members is increased by 20% for 20s.',
    context: {
      entityId: 'Yangyang',
      entityName: 'Yangyang',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S6',
      patchVersion: '3.7',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ATK_PERCENT'],
    expectedTargets: ['TEAM'],
    expectedDurations: [20],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Sequence node explicitly targets TEAM ("all team members") with 20% ATK buff for 20s.'
  },

  // 4. Suoming Outro (Element-specific switch-in buff)
  SUOMING_OUTRO_CANONICAL: {
    name: 'Suoming Canonical Outro Skill',
    sourceEntity: 'Suoming',
    sourceType: 'RESONATOR_ABILITY',
    sourceCode: 'OUTRO_SKILL',
    inputRawText:
      'The incoming Resonator gains 20% Electro DMG Amplification for 8s or until the Resonator is switched out.',
    context: {
      entityId: 'Suoming',
      entityName: 'Suoming',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OUTRO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      defaultTarget: 'NEXT_RESONATOR'
    },
    expectedStatus: 'COMPLETE',
    expectedEffectCount: 1,
    expectedParameters: ['ELECTRO_DAMAGE_PERCENT'],
    expectedTargets: ['NEXT_RESONATOR'],
    expectedDurations: [8],
    expectedRemoveOnSwap: [true],
    whyCorrect:
      'Captures element-specific Electro DMG amplification for NEXT_RESONATOR with swap expiration.'
  },

  // 5. Luuk Herssen Formula Guard (False-Positive Prevention)
  LUUK_HERSSEN_FORMULA_GUARD: {
    name: 'Luuk Herssen Damage Formula Ratio Guard',
    sourceEntity: 'Luuk Herssen',
    sourceType: 'RESONATOR_ABILITY',
    sourceCode: 'OUTRO_SKILL',
    inputRawText:
      'Deal Spectro DMG equal to 500% of Luuk Herssen\'s ATK.',
    context: {
      entityId: 'Luuk Herssen',
      entityName: 'Luuk Herssen',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OUTRO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      defaultTarget: 'ENEMY'
    },
    expectedStatus: 'UNRESOLVED',
    expectedEffectCount: 0,
    expectedParameters: [],
    expectedTargets: [],
    whyCorrect:
      'Formula scaling ratio ("equal to 500% of ATK") must NOT be parsed as an ATK% stat buff.'
  },

  // 6. Yangyang S3 Partial Extraction
  YANGYANG_S3_PARTIAL: {
    name: 'Yangyang Canonical Sequence 3 Partial Extraction',
    sourceEntity: 'Yangyang',
    sourceType: 'RESONATOR_SEQUENCE',
    sourceCode: 'S3',
    inputRawText:
      'Resonance Skill DMG Bonus is increased by 40%. The Wind Field\'s pulling effect on surrounding targets is enhanced, and the pulling range is expanded by 33%.',
    context: {
      entityId: 'Yangyang',
      entityName: 'Yangyang',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S3',
      patchVersion: '3.7',
      sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
      defaultTarget: 'SELF'
    },
    expectedStatus: 'PARTIAL',
    expectedEffectCount: 1,
    expectedParameters: ['SKILL_DAMAGE_PERCENT'],
    expectedTargets: ['SELF'],
    expectedDurations: [undefined],
    expectedRemoveOnSwap: [false],
    whyCorrect:
      'Parses the 40% Skill DMG Bonus but marks node as PARTIAL because pulling range expansion (33%) remains an unmodeled fragment.'
  }
};
