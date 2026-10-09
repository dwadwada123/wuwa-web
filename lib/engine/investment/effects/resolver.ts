/**
 * Wuthering Waves Deterministic Investment Effect Resolver
 * Phase 7 Step 15: Deterministic Investment Effect Resolution & Combat Contribution Contract
 *
 * Implements deterministic resolution of investment-dependent gameplay facts against
 * authoritative Patch 3.7 structured data.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FACT RESOLUTION ONLY: Determines objective facts/values, NEVER gameplay scores.
 * 2. ZERO SCORING: No power scores, character scores, team scores, or DPS calculations.
 * 3. STRICT DATA AVAILABILITY: Only STRUCTURED_AND_RESOLVABLE yields numeric values.
 * 4. UNKNOWN ≠ ZERO: Unknown user inputs strictly return resolvedValue: null.
 * 5. UNMODELED ≠ ZERO: Missing formulas/curves strictly return resolvedValue: null.
 * 6. FAIL CLOSED: Invalid inputs or cross-patch data fail closed.
 */

import type {
  InvestmentEffectResolution,
  InvestmentEffectResolutionStatus,
  InvestmentEffectCategory,
  InvestmentDimensionKey,
  ResonatorInvestmentSnapshot
} from './types.ts';
import {
  INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION,
  STANDARD_INVESTMENT_EFFECT_IDS,
  CANONICAL_RESONATOR_BASE_STATS_LVL90,
  CANONICAL_WEAPON_BASE_STATS_LVL90,
  CANONICAL_WEAPON_REFINEMENT_SCALING,
  CANONICAL_SONATA_EFFECT_VALUES,
  EFFECT_RESOLUTION_REASON_CODES,
  FORMULA_CHAR_BASE_HP_LVL90,
  FORMULA_CHAR_BASE_ATK_LVL90,
  FORMULA_CHAR_BASE_DEF_LVL90,
  FORMULA_WEAPON_BASE_ATK_LVL90,
  FORMULA_WEAPON_SUB_STAT_LVL90,
  FORMULA_WEAPON_REFINEMENT,
  FORMULA_SONATA_2PC,
  FORMULA_SONATA_5PC,
  createDefaultStep15Provenance
} from './rules.ts';
import {
  deriveInvestmentEffectId,
  compareInvestmentEffectResolution
} from './predicates.ts';
import {
  isCanonicalResonatorId,
  isCanonicalWeaponId
} from '../predicates.ts';
import { INVESTMENT_LIMITS } from '../rules.ts';

const DIMS_CHARACTER_LEVEL: readonly InvestmentDimensionKey[] = Object.freeze(['CHARACTER_LEVEL']);
const DIMS_WEAPON_LEVEL: readonly InvestmentDimensionKey[] = Object.freeze(['WEAPON_IDENTITY', 'WEAPON_LEVEL']);
const DIMS_WEAPON_REFINEMENT: readonly InvestmentDimensionKey[] = Object.freeze(['WEAPON_IDENTITY', 'WEAPON_REFINEMENT']);
const DIMS_SEQUENCE_LEVEL: readonly InvestmentDimensionKey[] = Object.freeze(['SEQUENCE_LEVEL']);
const DIMS_SONATA_SET: readonly InvestmentDimensionKey[] = Object.freeze(['ECHO_SONATA_SET', 'ECHO_EQUIPPED_COUNT']);
const DIMS_ECHO_COUNTS: readonly InvestmentDimensionKey[] = Object.freeze(['ECHO_EQUIPPED_COUNT', 'ECHO_TUNED_COUNT', 'ECHO_MAX_LEVEL_COUNT']);

/**
 * Resolves a single investment-dependent effect for a Resonator.
 * Pure and deterministic.
 */
export function resolveInvestmentEffect(
  resonatorId: string,
  effectId: string,
  investment: ResonatorInvestmentSnapshot
): InvestmentEffectResolution {
  const id = deriveInvestmentEffectId(resonatorId, effectId);
  const provenance = createDefaultStep15Provenance(resonatorId, effectId);

  // 1. Strict Patch Isolation: Reject cross-patch data
  if (investment.patchVersion !== '3.7') {
    return Object.freeze({
      id,
      patchVersion: '3.7',
      ruleVersion: INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION,
      resonatorId,
      investmentDimension: 'CHARACTER_LEVEL',
      investmentDimensions: DIMS_CHARACTER_LEVEL,
      effectId,
      category: 'CHARACTER_LEVEL_EFFECT',
      status: 'PATCH_MISMATCH',
      inputValue: null,
      resolvedValue: null,
      unit: null,
      formulaId: null,
      dependencyFactIds: Object.freeze([]),
      sourceFactIds: Object.freeze([]),
      relationshipIds: Object.freeze([]),
      requiredContext: Object.freeze([]),
      reasonCodes: Object.freeze([EFFECT_RESOLUTION_REASON_CODES.PATCH_MISMATCH]),
      provenance
    });
  }

  // 2. Canonical Resonator Identity Check
  if (!isCanonicalResonatorId(resonatorId) || investment.resonatorId !== resonatorId) {
    return Object.freeze({
      id,
      patchVersion: '3.7',
      ruleVersion: INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION,
      resonatorId,
      investmentDimension: 'CHARACTER_LEVEL',
      investmentDimensions: DIMS_CHARACTER_LEVEL,
      effectId,
      category: 'CHARACTER_LEVEL_EFFECT',
      status: 'INVALID',
      inputValue: null,
      resolvedValue: null,
      unit: null,
      formulaId: null,
      dependencyFactIds: Object.freeze([]),
      sourceFactIds: Object.freeze([]),
      relationshipIds: Object.freeze([]),
      requiredContext: Object.freeze([]),
      reasonCodes: Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_RESONATOR]),
      provenance
    });
  }

  // 3. Category & Dimension Determination
  let category: InvestmentEffectCategory = 'CHARACTER_LEVEL_EFFECT';
  let primaryDim: InvestmentDimensionKey = 'CHARACTER_LEVEL';
  let dims: readonly InvestmentDimensionKey[] = DIMS_CHARACTER_LEVEL;
  let status: InvestmentEffectResolutionStatus = 'UNMODELED';
  let inputValue: number | null = null;
  let resolvedValue: number | null = null;
  let unit: string | null = null;
  let formulaId: string | null = null;
  let sourceFactIds: readonly string[] = Object.freeze([]);
  let reasonCodes: readonly string[] = Object.freeze([]);

  // ==========================================
  // A. CHARACTER BASE STATS & LEVEL SCALING
  // ==========================================
  if (effectId === 'char-base-hp') {
    category = 'CHARACTER_LEVEL_EFFECT';
    primaryDim = 'CHARACTER_LEVEL';
    dims = DIMS_CHARACTER_LEVEL;

    if (investment.characterLevel.status === 'KNOWN') {
      const lvl = investment.characterLevel.value;
      if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < INVESTMENT_LIMITS.MIN_CHARACTER_LEVEL || lvl > INVESTMENT_LIMITS.MAX_CHARACTER_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (lvl === 90) {
        status = 'RESOLVED';
        inputValue = 90;
        resolvedValue = CANONICAL_RESONATOR_BASE_STATS_LVL90[resonatorId].hp;
        unit = 'FLAT_HP';
        formulaId = FORMULA_CHAR_BASE_HP_LVL90.formulaId;
        sourceFactIds = FORMULA_CHAR_BASE_HP_LVL90.sourceFactIds;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
      } else {
        status = 'UNMODELED';
        inputValue = lvl;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_SCALING_UNMODELED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_UNKNOWN]);
    }
  } else if (effectId === 'char-base-atk') {
    category = 'CHARACTER_LEVEL_EFFECT';
    primaryDim = 'CHARACTER_LEVEL';
    dims = Object.freeze(['CHARACTER_LEVEL']);

    if (investment.characterLevel.status === 'KNOWN') {
      const lvl = investment.characterLevel.value;
      if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < INVESTMENT_LIMITS.MIN_CHARACTER_LEVEL || lvl > INVESTMENT_LIMITS.MAX_CHARACTER_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (lvl === 90) {
        status = 'RESOLVED';
        inputValue = 90;
        resolvedValue = CANONICAL_RESONATOR_BASE_STATS_LVL90[resonatorId].atk;
        unit = 'FLAT_ATK';
        formulaId = FORMULA_CHAR_BASE_ATK_LVL90.formulaId;
        sourceFactIds = FORMULA_CHAR_BASE_ATK_LVL90.sourceFactIds;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
      } else {
        status = 'UNMODELED';
        inputValue = lvl;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_SCALING_UNMODELED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_UNKNOWN]);
    }
  } else if (effectId === 'char-base-def') {
    category = 'CHARACTER_LEVEL_EFFECT';
    primaryDim = 'CHARACTER_LEVEL';
    dims = Object.freeze(['CHARACTER_LEVEL']);

    if (investment.characterLevel.status === 'KNOWN') {
      const lvl = investment.characterLevel.value;
      if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < INVESTMENT_LIMITS.MIN_CHARACTER_LEVEL || lvl > INVESTMENT_LIMITS.MAX_CHARACTER_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (lvl === 90) {
        status = 'RESOLVED';
        inputValue = 90;
        resolvedValue = CANONICAL_RESONATOR_BASE_STATS_LVL90[resonatorId].def;
        unit = 'FLAT_DEF';
        formulaId = FORMULA_CHAR_BASE_DEF_LVL90.formulaId;
        sourceFactIds = FORMULA_CHAR_BASE_DEF_LVL90.sourceFactIds;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
      } else {
        status = 'UNMODELED';
        inputValue = lvl;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_SCALING_UNMODELED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_UNKNOWN]);
    }
  } else if (effectId === 'char-level-scaling') {
    category = 'CHARACTER_LEVEL_EFFECT';
    primaryDim = 'CHARACTER_LEVEL';
    dims = Object.freeze(['CHARACTER_LEVEL']);

    if (investment.characterLevel.status === 'KNOWN') {
      const lvl = investment.characterLevel.value;
      if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < INVESTMENT_LIMITS.MIN_CHARACTER_LEVEL || lvl > INVESTMENT_LIMITS.MAX_CHARACTER_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else {
        status = 'UNMODELED';
        inputValue = lvl;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_SCALING_UNMODELED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.CHARACTER_LEVEL_UNKNOWN]);
    }
  }

  // ==========================================
  // B. WEAPON BASE STATS & SCALING
  // ==========================================
  else if (effectId === 'weapon-base-atk') {
    category = 'WEAPON_LEVEL_EFFECT';
    primaryDim = 'WEAPON_LEVEL';
    dims = Object.freeze(['WEAPON_IDENTITY', 'WEAPON_LEVEL']);

    if (!investment.weapon) {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_SNAPSHOT_UNKNOWN]);
    } else if (!isCanonicalWeaponId(investment.weapon.weaponId)) {
      status = 'INVALID';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
    } else if (investment.weapon.weaponLevel.status === 'KNOWN') {
      const lvl = investment.weapon.weaponLevel.value;
      if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < INVESTMENT_LIMITS.MIN_WEAPON_LEVEL || lvl > INVESTMENT_LIMITS.MAX_WEAPON_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (lvl === 90) {
        status = 'RESOLVED';
        inputValue = 90;
        resolvedValue = CANONICAL_WEAPON_BASE_STATS_LVL90[investment.weapon.weaponId].baseAtk;
        unit = 'FLAT_ATK';
        formulaId = FORMULA_WEAPON_BASE_ATK_LVL90.formulaId;
        sourceFactIds = FORMULA_WEAPON_BASE_ATK_LVL90.sourceFactIds;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
      } else {
        status = 'UNMODELED';
        inputValue = lvl;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_LEVEL_SCALING_UNMODELED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_LEVEL_UNKNOWN]);
    }
  } else if (effectId === 'weapon-sub-stat') {
    category = 'WEAPON_LEVEL_EFFECT';
    primaryDim = 'WEAPON_LEVEL';
    dims = Object.freeze(['WEAPON_IDENTITY', 'WEAPON_LEVEL']);

    if (!investment.weapon) {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_SNAPSHOT_UNKNOWN]);
    } else if (!isCanonicalWeaponId(investment.weapon.weaponId)) {
      status = 'INVALID';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
    } else if (investment.weapon.weaponLevel.status === 'KNOWN') {
      const lvl = investment.weapon.weaponLevel.value;
      if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < INVESTMENT_LIMITS.MIN_WEAPON_LEVEL || lvl > INVESTMENT_LIMITS.MAX_WEAPON_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (lvl === 90) {
        status = 'RESOLVED';
        inputValue = 90;
        resolvedValue = CANONICAL_WEAPON_BASE_STATS_LVL90[investment.weapon.weaponId].subStatValue;
        unit = 'PERCENT';
        formulaId = FORMULA_WEAPON_SUB_STAT_LVL90.formulaId;
        sourceFactIds = FORMULA_WEAPON_SUB_STAT_LVL90.sourceFactIds;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
      } else {
        status = 'UNMODELED';
        inputValue = lvl;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_LEVEL_SCALING_UNMODELED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_LEVEL_UNKNOWN]);
    }
  } else if (effectId === 'weapon-level-scaling') {
    category = 'WEAPON_LEVEL_EFFECT';
    primaryDim = 'WEAPON_LEVEL';
    dims = Object.freeze(['WEAPON_IDENTITY', 'WEAPON_LEVEL']);

    if (!investment.weapon) {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_SNAPSHOT_UNKNOWN]);
    } else if (!isCanonicalWeaponId(investment.weapon.weaponId)) {
      status = 'INVALID';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
    } else if (investment.weapon.weaponLevel.status === 'KNOWN') {
      const lvl = investment.weapon.weaponLevel.value;
      if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < INVESTMENT_LIMITS.MIN_WEAPON_LEVEL || lvl > INVESTMENT_LIMITS.MAX_WEAPON_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else {
        status = 'UNMODELED';
        inputValue = lvl;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_LEVEL_SCALING_UNMODELED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_LEVEL_UNKNOWN]);
    }
  }

  // ==========================================
  // C. WEAPON REFINEMENT
  // ==========================================
  else if (effectId === 'weapon-refinement' || effectId.startsWith('weapon-refinement:')) {
    category = 'WEAPON_REFINEMENT_EFFECT';
    primaryDim = 'WEAPON_REFINEMENT';
    dims = Object.freeze(['WEAPON_IDENTITY', 'WEAPON_REFINEMENT']);

    if (!investment.weapon) {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_SNAPSHOT_UNKNOWN]);
    } else if (!isCanonicalWeaponId(investment.weapon.weaponId)) {
      status = 'INVALID';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
    } else {
      const wId = investment.weapon.weaponId;
      const scalingTable = CANONICAL_WEAPON_REFINEMENT_SCALING[wId];

      if (!scalingTable) {
        // Weapon has prose-only refinement
        if (investment.weapon.refinementRank.status === 'KNOWN') {
          const rank = investment.weapon.refinementRank.value;
          if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < INVESTMENT_LIMITS.MIN_REFINEMENT_RANK || rank > INVESTMENT_LIMITS.MAX_REFINEMENT_RANK) {
            status = 'INVALID';
            reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
          } else {
            status = 'UNMODELED';
            inputValue = rank;
            reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_REFINEMENT_PROSE_ONLY]);
          }
        } else {
          status = 'UNKNOWN';
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_REFINEMENT_UNKNOWN]);
        }
      } else {
        // Weapon has structured refinement scaling (1 of the 16 structured weapons)
        if (investment.weapon.refinementRank.status === 'KNOWN') {
          const rank = investment.weapon.refinementRank.value;
          if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < INVESTMENT_LIMITS.MIN_REFINEMENT_RANK || rank > INVESTMENT_LIMITS.MAX_REFINEMENT_RANK) {
            status = 'INVALID';
            reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
          } else {
            const rankKey = `R${rank}`;
            const rankObj = scalingTable[rankKey];
            if (rankObj) {
              const keys = Object.keys(rankObj);
              let targetKey = keys[0];
              if (effectId.includes(':')) {
                const subKey = effectId.split(':')[1];
                if (subKey && subKey in rankObj) {
                  targetKey = subKey;
                }
              }
              status = 'RESOLVED';
              inputValue = rank;
              resolvedValue = rankObj[targetKey];
              unit = 'PERCENT';
              formulaId = FORMULA_WEAPON_REFINEMENT.formulaId;
              sourceFactIds = FORMULA_WEAPON_REFINEMENT.sourceFactIds;
              reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
            } else {
              status = 'INVALID';
              reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
            }
          }
        } else {
          status = 'UNKNOWN';
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.WEAPON_REFINEMENT_UNKNOWN]);
        }
      }
    }
  }

  // ==========================================
  // D. RESONANCE SEQUENCE NODES (S1..S6)
  // ==========================================
  else if (effectId.startsWith('sequence-node:')) {
    category = 'SEQUENCE_EFFECT';
    primaryDim = 'SEQUENCE_LEVEL';
    dims = Object.freeze(['SEQUENCE_LEVEL']);

    const nodeStr = effectId.split(':')[1] || '';
    const nodeOrder = Number(nodeStr.replace(/^S/i, ''));

    if (isNaN(nodeOrder) || nodeOrder < 1 || nodeOrder > 6) {
      status = 'INVALID';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
    } else if (investment.sequenceLevel.status === 'KNOWN') {
      const seq = investment.sequenceLevel.value;
      if (typeof seq !== 'number' || !Number.isFinite(seq) || seq < INVESTMENT_LIMITS.MIN_SEQUENCE_LEVEL || seq > INVESTMENT_LIMITS.MAX_SEQUENCE_LEVEL) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (seq >= nodeOrder) {
        // The node is unlocked by user's sequence level, but all 360 sequence nodes in 3.7 dataset are prose-only
        status = 'UNMODELED';
        inputValue = seq;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.SEQUENCE_NODE_PROSE_ONLY]);
      } else {
        // Node is locked
        status = 'NOT_APPLICABLE';
        inputValue = seq;
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.SEQUENCE_NODE_LOCKED]);
      }
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.SEQUENCE_LEVEL_UNKNOWN]);
    }
  }

  // ==========================================
  // E. SONATA SET EFFECTS (2-pc and 5-pc)
  // ==========================================
  else if (effectId === 'sonata-2pc') {
    category = 'SONATA_EFFECT';
    primaryDim = 'ECHO_SONATA_SET';
    dims = Object.freeze(['ECHO_SONATA_SET', 'ECHO_EQUIPPED_COUNT']);

    if (!investment.echoInvestment || !investment.echoInvestment.sonataSetId) {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.SONATA_SET_UNKNOWN]);
    } else {
      const setKey = investment.echoInvestment.sonataSetId;
      const sonataEntry = CANONICAL_SONATA_EFFECT_VALUES[setKey] ||
        Object.values(CANONICAL_SONATA_EFFECT_VALUES).find(
          s => s.name.toLowerCase() === setKey.toLowerCase()
        );

      if (!sonataEntry) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (investment.echoInvestment.equippedCount.status === 'KNOWN') {
        const count = investment.echoInvestment.equippedCount.value;
        if (typeof count !== 'number' || !Number.isFinite(count) || count < INVESTMENT_LIMITS.MIN_ECHO_COUNT || count > INVESTMENT_LIMITS.MAX_ECHO_COUNT) {
          status = 'INVALID';
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
        } else if (count >= 2) {
          status = 'RESOLVED';
          inputValue = count;
          resolvedValue = sonataEntry.twoPieceValue;
          unit = sonataEntry.twoPieceUnit;
          formulaId = FORMULA_SONATA_2PC.formulaId;
          sourceFactIds = FORMULA_SONATA_2PC.sourceFactIds;
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
        } else {
          status = 'NOT_APPLICABLE';
          inputValue = count;
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.SONATA_SET_PIECES_THRESHOLD_NOT_MET]);
        }
      } else {
        status = 'UNKNOWN';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ECHO_EQUIPPED_COUNT_UNKNOWN]);
      }
    }
  } else if (effectId === 'sonata-5pc') {
    category = 'SONATA_EFFECT';
    primaryDim = 'ECHO_SONATA_SET';
    dims = Object.freeze(['ECHO_SONATA_SET', 'ECHO_EQUIPPED_COUNT']);

    if (!investment.echoInvestment || !investment.echoInvestment.sonataSetId) {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.SONATA_SET_UNKNOWN]);
    } else {
      const setKey = investment.echoInvestment.sonataSetId;
      const sonataEntry = CANONICAL_SONATA_EFFECT_VALUES[setKey] ||
        Object.values(CANONICAL_SONATA_EFFECT_VALUES).find(
          s => s.name.toLowerCase() === setKey.toLowerCase()
        );

      if (!sonataEntry) {
        status = 'INVALID';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
      } else if (investment.echoInvestment.equippedCount.status === 'KNOWN') {
        const count = investment.echoInvestment.equippedCount.value;
        if (typeof count !== 'number' || !Number.isFinite(count) || count < INVESTMENT_LIMITS.MIN_ECHO_COUNT || count > INVESTMENT_LIMITS.MAX_ECHO_COUNT) {
          status = 'INVALID';
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
        } else if (count >= 5) {
          status = 'RESOLVED';
          inputValue = count;
          resolvedValue = sonataEntry.fivePieceValue;
          unit = sonataEntry.fivePieceUnit;
          formulaId = FORMULA_SONATA_5PC.formulaId;
          sourceFactIds = FORMULA_SONATA_5PC.sourceFactIds;
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ALL_INPUTS_AND_FORMULA_RESOLVED]);
        } else {
          status = 'NOT_APPLICABLE';
          inputValue = count;
          reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.SONATA_SET_PIECES_THRESHOLD_NOT_MET]);
        }
      } else {
        status = 'UNKNOWN';
        reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ECHO_EQUIPPED_COUNT_UNKNOWN]);
      }
    }
  }

  // ==========================================
  // F. ECHO STAT SCALING
  // ==========================================
  else if (effectId === 'echo-stat-scaling') {
    category = 'ECHO_COUNT_EFFECT';
    primaryDim = 'ECHO_EQUIPPED_COUNT';
    dims = Object.freeze(['ECHO_EQUIPPED_COUNT', 'ECHO_TUNED_COUNT', 'ECHO_MAX_LEVEL_COUNT']);

    if (investment.echoInvestment) {
      status = 'UNMODELED';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ECHO_STAT_SCALING_UNMODELED]);
    } else {
      status = 'UNKNOWN';
      reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.ECHO_INVESTMENT_UNKNOWN]);
    }
  } else {
    // Unrecognized effectId
    status = 'INVALID';
    reasonCodes = Object.freeze([EFFECT_RESOLUTION_REASON_CODES.INVALID_INVESTMENT_VALUE]);
  }

  return Object.freeze({
    id,
    patchVersion: '3.7',
    ruleVersion: INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION,
    resonatorId,
    investmentDimension: primaryDim,
    investmentDimensions: dims,
    effectId,
    category,
    status,
    inputValue,
    resolvedValue,
    unit,
    formulaId,
    dependencyFactIds: Object.freeze([]),
    sourceFactIds,
    relationshipIds: Object.freeze([]),
    requiredContext: dims,
    reasonCodes,
    provenance
  });
}

/**
 * Resolves all standard investment-dependent gameplay effects for a Resonator
 * given their investment snapshot.
 * Output is deterministically ordered by canonical effect hierarchy.
 */
export function resolveAllInvestmentEffects(
  resonatorId: string,
  investment: ResonatorInvestmentSnapshot
): readonly InvestmentEffectResolution[] {
  const results: InvestmentEffectResolution[] = [];

  for (const effectId of STANDARD_INVESTMENT_EFFECT_IDS) {
    results.push(resolveInvestmentEffect(resonatorId, effectId, investment));
  }

  // Canonical deterministic sort
  results.sort(compareInvestmentEffectResolution);

  return Object.freeze(results);
}
