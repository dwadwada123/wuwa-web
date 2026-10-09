/**
 * Wuthering Waves Deterministic Semantics Extraction Parser
 * Phase 6C Step 1: Semantic Representation Foundation
 *
 * PURE FUNCTION, ZERO NETWORK, ZERO LLM, LOCALLY DETERMINISTIC.
 * Conservative and fail-safe: Ambiguous qualitative phrases produce UNRESOLVED,
 * never fabricated numeric multipliers or false zeros.
 */

import type {
  SemanticEffect,
  ExtractionResult,
  ExtractionContext,
  ExtractionStatus,
  SemanticTarget,
  SemanticTrigger,
  SemanticParameter,
  SemanticUnit,
  SemanticValue,
  SingleSemanticValue,
  RangeSemanticValue,
  SourceReference,
  ExtractionProvenance
} from '../domain/types/semantics.ts';
import type { GameplayEffectCategory } from '../domain/types/gameplay-effects.ts';
import type { Element } from '../domain/types/common.ts';
import {
  getElementDamageParameter,
  getElementResShredParameter
} from './taxonomy.ts';

export const PARSER_VERSION = '1.1.0';

/**
 * Sanitizes an identifier segment for deterministic ID construction.
 */
function sanitizeSegment(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Generates a stable, reproducible deterministic semantic effect ID.
 * Strictly free of timestamps, random numbers, or environment-dependent values.
 */
export function generateSemanticEffectId(
  entityId: string,
  sourceCode: string,
  parameter: string,
  index: number,
  patchVersion = '3.7'
): string {
  const p = sanitizeSegment(patchVersion);
  const ent = sanitizeSegment(entityId);
  const src = sanitizeSegment(sourceCode || 'root');
  const param = sanitizeSegment(parameter);
  return `sem_p${p}_${ent}_${src}_${param}_${index}`;
}

/**
 * Classifies target entity based on explicit keywords in prose.
 */
export function classifyTarget(text: string, defaultTarget: SemanticTarget = 'SELF'): SemanticTarget {
  const lower = text.toLowerCase();

  // Enemy debuffs / shreds
  if (
    lower.includes('target enemy') ||
    lower.includes('enemies hit') ||
    lower.includes('reduces enemy') ||
    lower.includes('enemy electro res') ||
    lower.includes('enemy res') ||
    lower.includes('reduces target')
  ) {
    return 'ENEMY';
  }

  // Active on-field character
  if (
    lower.includes('active character') ||
    lower.includes('character currently on the field') ||
    lower.includes('current character on the field') ||
    lower.includes('active resonator') ||
    lower.includes('wielder is on the field')
  ) {
    return 'ACTIVE_CHARACTER';
  }

  // Next resonator / switch-in buffs
  if (
    lower.includes('next resonator') ||
    lower.includes('incoming resonator') ||
    lower.includes('the next character') ||
    lower.includes('switched-in character') ||
    lower.includes('next switched-in')
  ) {
    return 'NEXT_RESONATOR';
  }

  // Universal team buffs
  if (
    lower.includes('all team members') ||
    lower.includes('all nearby party members') ||
    lower.includes('all party members') ||
    lower.includes('entire team') ||
    lower.includes('nearby teams') ||
    lower.includes('resonators in the team') ||
    lower.includes('resonators on the team') ||
    lower.includes('all resonators')
  ) {
    return 'TEAM';
  }

  return defaultTarget;
}

/**
 * Extracts explicit duration in seconds.
 */
export function extractDurationSeconds(text: string): number | undefined {
  // Matches "for 30s", "lasting 14s", "lasts 10s", "for 14 seconds", "lasting 10 seconds"
  const match = text.match(/(?:for|lasting|lasts|duration of)\s+(\d+(?:\.\d+)?)\s*(?:s\b|seconds\b)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return undefined;
}

/**
 * Extracts remove_on_swap flag.
 */
export function extractRemoveOnSwap(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('switched out') ||
    lower.includes('swapped out') ||
    lower.includes('leaves the field') ||
    lower.includes('switched off the field') ||
    lower.includes('expires when switched') ||
    lower.includes('ends when the character is swapped out')
  );
}

/**
 * Classifies trigger condition.
 */
export function classifyTrigger(text: string): SemanticTrigger | undefined {
  const lower = text.toLowerCase();

  if (lower.includes('outro skill') || lower.includes('casting outro')) {
    return 'ON_OUTRO_SKILL';
  }
  if (
    lower.includes('resonance skill') ||
    lower.includes('casting resonance skill') ||
    lower.includes('resonance skill hits')
  ) {
    return 'ON_RESONANCE_SKILL';
  }
  if (
    lower.includes('resonance liberation') ||
    lower.includes('casting resonance liberation') ||
    lower.includes('releasing resonance liberation')
  ) {
    return 'ON_RESONANCE_LIBERATION';
  }
  if (lower.includes('basic attack hit') || lower.includes('basic attack hits') || lower.includes('when basic attack')) {
    return 'ON_BASIC_ATTACK';
  }
  if (lower.includes('heavy attack hit') || lower.includes('heavy attack hits') || lower.includes('when heavy attack')) {
    return 'ON_HEAVY_ATTACK';
  }
  if (lower.includes('intro skill') || lower.includes('intro skill hits')) {
    return 'ON_INTRO_SKILL';
  }

  return undefined;
}

/**
 * Maps parameter to approved high-level GameplayEffectCategory.
 */
function deriveGameplayEffectCategory(
  param: SemanticParameter,
  target: SemanticTarget
): GameplayEffectCategory {
  if (target === 'ENEMY') {
    if (param.includes('RES_SHRED')) return 'RES_SHRED';
    if (param.includes('DEF_SHRED')) return 'DEF_SHRED';
  }
  if (param.includes('DAMAGE') || param.includes('AMPLIFY')) {
    return 'DMG_AMPLIFY';
  }
  if (param === 'HEALING_BONUS_PERCENT') {
    return 'HEALING';
  }
  if (
    param === 'RESONANCE_ENERGY' ||
    param === 'CONCERTO_ENERGY' ||
    param === 'FORTE_RESOURCE' ||
    param === 'SKILL_CHARGES'
  ) {
    return 'RESOURCE_GRANT';
  }
  return 'STAT_BUFF';
}

/**
 * Checks if text contains qualitative, unquantified claims without numbers.
 */
export function containsAmbiguousQualitativeClaim(text: string): boolean {
  const lower = text.toLowerCase();
  const ambiguousPatterns = [
    /\bgreatly\s+increases?\b/,
    /\bsignificantly\s+increases?\b/,
    /\bmassively\s+increases?\b/,
    /\bslightly\s+increases?\b/,
    /\bpower\s+increases?\s+significantly\b/,
    /\benhances?\s+attacks?\b/,
    /\bincreases?\s+power\b/,
    /\bvastly\s+improves?\b/
  ];

  return ambiguousPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Pure deterministic semantics extractor.
 * Converts natural language description + context into structured SemanticEffect records.
 */
export function extractSemantics(
  text: string,
  context?: ExtractionContext
): ExtractionResult {
  const cleaned = text.trim();
  const originalText = cleaned;
  const patchVersion = context?.patchVersion ?? '3.7';
  const entityId = context?.entityId ?? 'unknown_entity';
  const entityName = context?.entityName ?? 'Unknown Entity';
  const sourceType = context?.sourceType ?? 'RESONATOR_SEQUENCE';
  const sourceCode = context?.sourceCode ?? 'S0';
  const sourceProvenance = context?.sourceProvenance ?? 'Unspecified Provenance';

  const sourceRef: SourceReference = {
    entityId,
    entityName,
    sourceType,
    sourceCode,
    patchVersion,
    sourceProvenance,
    originalDescription: originalText
  };

  const extractionProv: ExtractionProvenance = {
    parserVersion: PARSER_VERSION,
    method: 'DETERMINISTIC_RULE_PARSER',
    extractionDate: '2026-10-08'
  };

  // 1. Guard against empty text
  if (!cleaned) {
    return {
      status: 'UNRESOLVED',
      effects: [],
      unresolvedFragments: ['Empty description'],
      originalText,
      parserVersion: PARSER_VERSION,
      sourceReference: sourceRef
    };
  }

  // 2. Ambiguity check: If text claims qualitative bonuses without numbers
  const hasAmbiguity = containsAmbiguousQualitativeClaim(cleaned);

  // 3. Extract common duration, removal condition, and target
  const durationSeconds = extractDurationSeconds(cleaned);
  const removeOnSwap = extractRemoveOnSwap(cleaned);
  const target = classifyTarget(cleaned, context?.defaultTarget ?? 'SELF');
  const trigger = classifyTrigger(cleaned);

  const durationObj =
    durationSeconds !== undefined || removeOnSwap
      ? {
          durationSeconds: durationSeconds ?? 0,
          removeOnSwap: removeOnSwap ? true : undefined
        }
      : undefined;

  const conditionObj = trigger ? { trigger } : undefined;

  const effects: SemanticEffect[] = [];
  const unresolvedFragments: string[] = [];

  // 4. Pattern: Numeric Ranges with elements
  // Form A: "10% to 24% Electro RES Shred"
  // Form B: "Reduces target enemy Electro Resistance by 10% to 24%"
  const rangeShredMatchA = cleaned.match(
    /(\d+(?:\.\d+)?)\s*%\s*(?:to|~|-)\s*(\d+(?:\.\d+)?)\s*%\s*(Glacio|Fusion|Electro|Aero|Spectro|Havoc|All-Element)\s*(?:RES\s*Shred|Resistance(?:\s*reduction)?)/i
  );
  const rangeShredMatchB = cleaned.match(
    /(?:reduces?\s+)?(?:target\s+enemy\s+)?(Glacio|Fusion|Electro|Aero|Spectro|Havoc|All-Element)\s*(?:Resistance|RES\s*Shred)\s*(?:is\s*reduced\s*)?by\s*(\d+(?:\.\d+)?)\s*%\s*(?:to|~|-)\s*(\d+(?:\.\d+)?)\s*%/i
  );

  if (rangeShredMatchA || rangeShredMatchB) {
    const minVal = parseFloat(rangeShredMatchA ? rangeShredMatchA[1] : rangeShredMatchB![2]);
    const maxVal = parseFloat(rangeShredMatchA ? rangeShredMatchA[2] : rangeShredMatchB![3]);
    const elementStr = rangeShredMatchA ? rangeShredMatchA[3] : rangeShredMatchB![1];
    const parameter = getElementResShredParameter(elementStr);

    const effectId = generateSemanticEffectId(entityId, sourceCode, parameter, effects.length, patchVersion);
    const value: RangeSemanticValue = {
      type: 'RANGE',
      min: minVal,
      max: maxVal,
      unit: 'PERCENT'
    };

    const elemStr = (rangeShredMatchA ? rangeShredMatchA[3] : rangeShredMatchB![1]).toLowerCase();
    let shredElem: Element | 'All' = 'All';
    if (elemStr.includes('glacio')) shredElem = 'Glacio';
    else if (elemStr.includes('fusion')) shredElem = 'Fusion';
    else if (elemStr.includes('electro')) shredElem = 'Electro';
    else if (elemStr.includes('aero')) shredElem = 'Aero';
    else if (elemStr.includes('spectro')) shredElem = 'Spectro';
    else if (elemStr.includes('havoc')) shredElem = 'Havoc';

    const effRecord: SemanticEffect & { _matchIndex?: number } = {
      id: effectId,
      source: sourceRef,
      category: 'RES_SHRED',
      target: 'ENEMY',
      parameter,
      element: shredElem,
      value,
      valueState: 'PARSED',
      condition: conditionObj,
      duration: durationObj,
      extraction: extractionProv,
      _matchIndex: (rangeShredMatchA || rangeShredMatchB)?.index ?? 0
    };

    effects.push(effRecord);
  }

  // 5. Pattern: Numeric Range for general stats
  // Form A: "12% to 24% ATK"
  // Form B: "ATK increases by 12% to 24%" or "Increases ATK by 12% to 24%"
  const rangeStatMatchA = cleaned.match(
    /(\d+(?:\.\d+)?)\s*%\s*(?:to|~|-)\s*(\d+(?:\.\d+)?)\s*%\s*(ATK|HP|DEF)\b/i
  );
  const rangeStatMatchB = cleaned.match(
    /(?:increases?\s+)?(ATK|HP|DEF)(?:\s+(?:is\s+)?increases?(?:\s+by)?|\s+by)\s*(\d+(?:\.\d+)?)\s*%\s*(?:to|~|-)\s*(\d+(?:\.\d+)?)\s*%/i
  );

  if (!rangeShredMatchA && !rangeShredMatchB && (rangeStatMatchA || rangeStatMatchB)) {
    const statName = (rangeStatMatchA ? rangeStatMatchA[3] : rangeStatMatchB![1]).toUpperCase();
    const minVal = parseFloat(rangeStatMatchA ? rangeStatMatchA[1] : rangeStatMatchB![2]);
    const maxVal = parseFloat(rangeStatMatchA ? rangeStatMatchA[2] : rangeStatMatchB![3]);
    const parameter: SemanticParameter = `${statName}_PERCENT` as SemanticParameter;

    const effectId = generateSemanticEffectId(entityId, sourceCode, parameter, effects.length, patchVersion);
    const value: RangeSemanticValue = {
      type: 'RANGE',
      min: minVal,
      max: maxVal,
      unit: 'PERCENT'
    };

    const effRecord: SemanticEffect & { _matchIndex?: number } = {
      id: effectId,
      source: sourceRef,
      category: 'STAT_BUFF',
      target,
      parameter,
      value,
      valueState: 'PARSED',
      condition: conditionObj,
      duration: durationObj,
      extraction: extractionProv,
      _matchIndex: (rangeStatMatchA || rangeStatMatchB)?.index ?? 0
    };

    effects.push(effRecord);
  }

  // 6. Pattern: Single damage bonuses / amplifications
  const damageTypeSpecs: Array<{
    name: string;
    param: SemanticParameter;
    cat: GameplayEffectCategory;
    element?: Element | 'All';
  }> = [
    { name: 'Basic\\s*Attack', param: 'BASIC_ATTACK_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY' },
    { name: 'Heavy\\s*Attack', param: 'HEAVY_ATTACK_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY' },
    { name: 'Resonance\\s*Skill', param: 'SKILL_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY' },
    { name: 'Resonance\\s*Liberation', param: 'LIBERATION_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY' },
    { name: 'Coordinated\\s*Attack', param: 'COORDINATED_ATTACK_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY' },
    { name: '(?:All-?Attribute|All)', param: 'ALL_ATTRIBUTE_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY', element: 'All' },
    { name: 'Glacio', param: 'GLACIO_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY', element: 'Glacio' },
    { name: 'Fusion', param: 'FUSION_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY', element: 'Fusion' },
    { name: 'Electro', param: 'ELECTRO_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY', element: 'Electro' },
    { name: 'Aero', param: 'AERO_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY', element: 'Aero' },
    { name: 'Spectro', param: 'SPECTRO_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY', element: 'Spectro' },
    { name: 'Havoc', param: 'HAVOC_DAMAGE_PERCENT', cat: 'DMG_AMPLIFY', element: 'Havoc' }
  ];

  for (const spec of damageTypeSpecs) {
    // Check multiple phrasings:
    // 1: "+38% Basic Attack DMG" or "38% Basic Attack DMG Amplification" or "gains 20% Electro DMG Amplification"
    // 2: "Basic Attack DMG is increased by 38%" or "Basic Attack DMG Amplified by 38%"
    // 3: "Increases Basic Attack DMG by 38%"
    const regex = new RegExp(
      `(?:(?:(?:[+]|by\\s+|gains?\\s+)?(\\d+(?:\\.\\d+)?)\\s*%\\s*${spec.name}\\s*DMG(?:\\s*Amplification|\\s*Bonus)?)|(?:${spec.name}\\s*DMG(?:\\s*Bonus)?\\s*(?:(?:is|are)?\\s*)?(?:increased|amplified)\\s*by\\s*(\\d+(?:\\.\\d+)?)\\s*%)|(?:increases?\\s+${spec.name}\\s*DMG\\s*by\\s*(\\d+(?:\\.\\d+)?)\\s*%))`,
      'i'
    );
    const m = cleaned.match(regex);
    if (m) {
      const valStr = m.slice(1).find((g) => g !== undefined);
      if (valStr) {
        const val = parseFloat(valStr);
        const effectId = generateSemanticEffectId(entityId, sourceCode, spec.param, effects.length, patchVersion);
        const value: SingleSemanticValue = {
          type: 'EXACT',
          value: val,
          unit: 'PERCENT'
        };

        const effRecord: SemanticEffect & { _matchIndex?: number } = {
          id: effectId,
          source: sourceRef,
          category: spec.cat,
          target,
          parameter: spec.param,
          element: spec.element,
          value,
          valueState: 'PARSED',
          condition: conditionObj,
          duration: durationObj,
          extraction: extractionProv,
          _matchIndex: m.index ?? 0
        };

        effects.push(effRecord);
        break;
      }
    }
  }

  // 7. Generic damage if no specific damage type matched
  // e.g. "30% damage for 10s", "increases damage by 30%", "damage is increased by 30%", "DMG Amplified by 15%"
  if (!effects.some((e) => e.parameter.includes('DAMAGE'))) {
    const genericDamageRegex =
      /(?:(?:increases?\s+(?:all\s+)?damage\s+by\s+(\d+(?:\.\d+)?)\s*%)|(?:damage\s*(?:is\s*)?increased\s*by\s*(\d+(?:\.\d+)?)\s*%)|(?:(?:[+]|by\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:damage|dmg)\b)|(?:DMG\s*(?:is\s*)?Amplified\s*by\s*(\d+(?:\.\d+)?)\s*%))/i;
    const genMatch = cleaned.match(genericDamageRegex);
    if (genMatch) {
      const valStr = genMatch.slice(1).find((g) => g !== undefined);
      if (valStr) {
        const val = parseFloat(valStr);
        const param: SemanticParameter = 'GENERIC_DAMAGE_PERCENT';
        const effectId = generateSemanticEffectId(entityId, sourceCode, param, effects.length, patchVersion);
        const value: SingleSemanticValue = {
          type: 'EXACT',
          value: val,
          unit: 'PERCENT'
        };

        const effRecord: SemanticEffect & { _matchIndex?: number } = {
          id: effectId,
          source: sourceRef,
          category: 'DMG_AMPLIFY',
          target,
          parameter: param,
          value,
          valueState: 'PARSED',
          condition: conditionObj,
          duration: durationObj,
          extraction: extractionProv,
          _matchIndex: genMatch.index ?? 0
        };

        effects.push(effRecord);
      }
    }
  }

  // 8. Stat percentages: ATK, DEF, HP, CRIT RATE, CRIT DMG, ENERGY REGEN, HEALING BONUS
  const statSpecs: Array<{
    name: string;
    param: SemanticParameter;
    cat: GameplayEffectCategory;
  }> = [
    { name: 'Energy\\s*Regen', param: 'ENERGY_REGEN_PERCENT', cat: 'STAT_BUFF' },
    { name: 'Crit\\.?\\s*Rate', param: 'CRIT_RATE_PERCENT', cat: 'STAT_BUFF' },
    { name: 'Crit\\.?\\s*DMG', param: 'CRIT_DAMAGE_PERCENT', cat: 'STAT_BUFF' },
    { name: 'ATK', param: 'ATK_PERCENT', cat: 'STAT_BUFF' },
    { name: 'DEF', param: 'DEF_PERCENT', cat: 'STAT_BUFF' },
    { name: 'HP', param: 'HP_PERCENT', cat: 'STAT_BUFF' },
    { name: 'Healing\\s*Bonus', param: 'HEALING_BONUS_PERCENT', cat: 'HEALING' }
  ];

  for (const st of statSpecs) {
    if (effects.some((e) => e.parameter === st.param)) continue;

    // Phrasings:
    // 1: "Increases ATK by 20%" or "increases Energy Regen by 12.8%"
    // 2: "ATK is increased by 20%"
    // 3: "+20% ATK" or "gains 20% ATK" or "20% ATK"
    // 4: "by 20% ATK"
    // 5: "and Crit. Rate by 12.5%" (secondary clause)
    const targetQualifier =
      '(?:\\s+of\\s+(?:all\\s+team\\s+members|all\\s+nearby\\s+party\\s+members|nearby\\s+party\\s+members|all\\s+Resonators\\s+in\\s+the\\s+team|Resonators\\s+in\\s+the\\s+team|Resonators\\s+on\\s+the\\s+team|the\\s+character|the\\s+target))?';
    const regex = new RegExp(
      `(?:(?:increases?\\s+(?:the\\s+)?${st.name}${targetQualifier}\\s+by\\s*(\\d+(?:\\.\\d+)?)\\s*%)|(?:(?:the\\s+)?${st.name}${targetQualifier}\\s*(?:is\\s*)?increased\\s*by\\s*(\\d+(?:\\.\\d+)?)\\s*%)|(?:(?:[+]|gains?\\s+|by\\s+)?(\\d+(?:\\.\\d+)?)\\s*%\\s*${st.name}\\b)|(?:(?:and\\s+)?${st.name}\\s*by\\s*(\\d+(?:\\.\\d+)?)\\s*%))`,
      'i'
    );
    const m = cleaned.match(regex);
    if (m) {
      // Guard against formula ratios like "by 19% of Verina's ATK" or "equal to 500% of Luuk Herssen's ATK"
      const matchIndex = m.index ?? 0;
      const snippetAround = cleaned.slice(Math.max(0, matchIndex - 15), matchIndex + m[0].length + 20);
      if (/\b(?:equal\s+to|by)\s+\d+(?:\.\d+)?%\s+of\s+/i.test(snippetAround)) {
        continue;
      }
      const valStr = m.slice(1).find((g) => g !== undefined);
      if (valStr) {
        const val = parseFloat(valStr);
        const effectId = generateSemanticEffectId(entityId, sourceCode, st.param, effects.length, patchVersion);
        const value: SingleSemanticValue = {
          type: 'EXACT',
          value: val,
          unit: 'PERCENT'
        };

        const effRecord: SemanticEffect & { _matchIndex?: number } = {
          id: effectId,
          source: sourceRef,
          category: st.cat,
          target,
          parameter: st.param,
          value,
          valueState: 'PARSED',
          condition: conditionObj,
          duration: durationObj,
          extraction: extractionProv,
          _matchIndex: m.index ?? 0
        };

        effects.push(effRecord);
      }
    }
  }

  // 9. Extra Charges & Resource Discounts (e.g. Jiyan S1)
  // "gains 1 additional charge"
  const chargeMatch = cleaned.match(/gains?\s+(\d+)\s+additional\s+charge/i);
  if (chargeMatch) {
    const val = parseInt(chargeMatch[1], 10);
    const param: SemanticParameter = 'SKILL_CHARGES';
    const effectId = generateSemanticEffectId(entityId, sourceCode, param, effects.length, patchVersion);
    const value: SingleSemanticValue = {
      type: 'EXACT',
      value: val,
      unit: 'CHARGES'
    };

    const effRecord: SemanticEffect & { _matchIndex?: number } = {
      id: effectId,
      source: sourceRef,
      category: 'RESOURCE_GRANT',
      target: 'SELF',
      parameter: param,
      value,
      valueState: 'PARSED',
      condition: conditionObj,
      extraction: extractionProv,
      _matchIndex: chargeMatch.index ?? 0
    };

    effects.push(effRecord);
  }

  // "Resolve cost is decreased by 15"
  const resolveMatch = cleaned.match(/Resolve\s+cost\s+is\s+decreased\s+by\s+(\d+)/i);
  if (resolveMatch) {
    const val = parseInt(resolveMatch[1], 10);
    const param: SemanticParameter = 'FORTE_RESOURCE';
    const effectId = generateSemanticEffectId(entityId, sourceCode, param, effects.length, patchVersion);
    const value: SingleSemanticValue = {
      type: 'EXACT',
      value: -val,
      unit: 'FLAT'
    };

    const effRecord: SemanticEffect & { _matchIndex?: number } = {
      id: effectId,
      source: sourceRef,
      category: 'RESOURCE_GRANT',
      target: 'SELF',
      parameter: param,
      value,
      valueState: 'PARSED',
      condition: conditionObj,
      extraction: extractionProv,
      _matchIndex: resolveMatch.index ?? 0
    };

    effects.push(effRecord);
  }

  // Sort effects deterministically by text position where available
  effects.sort((a, b) => {
    const idxA = (a as any)._matchIndex ?? 0;
    const idxB = (b as any)._matchIndex ?? 0;
    return idxA - idxB;
  });

  // 10. Multi-sentence / unconsumed mechanics detection
  const sentences = cleaned
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Count percentage tokens
  const totalPctsInText = (cleaned.match(/\d+(?:\.\d+)?%/g) || []).length;
  const consumedPcts = effects.reduce((sum, e) => {
    if (e.value.type === 'RANGE') return sum + 2;
    if ((e.value as any).unit === 'PERCENT') return sum + 1;
    return sum;
  }, 0);

  if (hasAmbiguity) {
    unresolvedFragments.push(cleaned);
  } else if (totalPctsInText > consumedPcts) {
    // There are explicit percentages in the text that were not parsed
    for (const sent of sentences) {
      const sentPcts = (sent.match(/\d+(?:\.\d+)?%/g) || []).length;
      if (sentPcts > 0) {
        // Check if this sentence was not fully consumed
        const sentEffects = effects.filter((eff) => {
          const matchIdx = (eff as any)._matchIndex;
          if (matchIdx === undefined) return false;
          const sentIdx = cleaned.indexOf(sent);
          return sentIdx <= matchIdx && matchIdx <= sentIdx + sent.length;
        });
        const sentConsumed = sentEffects.reduce((s, e) => (e.value.type === 'RANGE' ? s + 2 : 1), 0);
        if (sentPcts > sentConsumed && !unresolvedFragments.includes(sent)) {
          unresolvedFragments.push(sent);
        }
      }
    }
    if (unresolvedFragments.length === 0) {
      unresolvedFragments.push(`Unconsumed numeric parameters in: "${cleaned}"`);
    }
  }

  // Detect unparsed mechanical sentences in multi-sentence text
  if (sentences.length > 1 && effects.length > 0) {
    for (const sent of sentences) {
      const hasEffectInSent = effects.some((eff) => {
        const matchIdx = (eff as any)._matchIndex;
        if (matchIdx === undefined) return false;
        const sentIdx = cleaned.indexOf(sent);
        return sentIdx <= matchIdx && matchIdx <= sentIdx + sent.length;
      });
      if (!hasEffectInSent) {
        const hasMechanics =
          /\b(?:pull|knock|stack|melody|melodies|shield|heal|recover|cooldown|range|damage|dmg|charges?)\b/i.test(
            sent
          );
        if (hasMechanics && !unresolvedFragments.includes(sent)) {
          unresolvedFragments.push(sent);
        }
      }
    }
  }

  // Clean internal tracking property
  for (const eff of effects) {
    delete (eff as any)._matchIndex;
  }

  let status: ExtractionStatus;
  if (effects.length > 0 && unresolvedFragments.length === 0) {
    status = 'COMPLETE';
  } else if (effects.length > 0 && unresolvedFragments.length > 0) {
    status = 'PARTIAL';
  } else if (hasAmbiguity || totalPctsInText > 0) {
    status = 'UNRESOLVED';
    if (unresolvedFragments.length === 0) {
      unresolvedFragments.push(cleaned);
    }
  } else {
    status = 'UNSUPPORTED';
    if (unresolvedFragments.length === 0) {
      unresolvedFragments.push(cleaned);
    }
  }

  return {
    status,
    effects,
    unresolvedFragments,
    originalText,
    parserVersion: PARSER_VERSION,
    sourceReference: sourceRef
  };
}
