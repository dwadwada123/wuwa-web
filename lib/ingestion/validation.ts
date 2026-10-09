import type {
  PatchDataset,
  Element,
  WeaponType,
  Rarity,
  SourceType,
  Confidence,
  Classification,
  ProvenanceStatus,
  AbilityCategory,
  GameplayEffectCategory,
  GameplayEffectTarget,
  EnemyClass,
  ResistanceElement,
  ModifierType,
  SequenceOrder,
  SequenceNodeCode,
  SequenceNodeInput,
  RefinementRank,
  RefinementScaling
} from './types';

export const VALID_ELEMENTS = new Set<Element>([
  'Glacio',
  'Fusion',
  'Electro',
  'Aero',
  'Spectro',
  'Havoc'
]);

export const VALID_ENEMY_CLASSES = new Set<EnemyClass>([
  'Common',
  'Elite',
  'Overlord',
  'Calamity'
]);

export const VALID_RESISTANCE_ELEMENTS = new Set<ResistanceElement>([
  'Glacio',
  'Fusion',
  'Electro',
  'Aero',
  'Spectro',
  'Havoc',
  'Physical'
]);

export const VALID_MODIFIER_TYPES = new Set<ModifierType>([
  'SHIELD_BAR',
  'ENRAGE_RESISTANCE',
  'DAMAGE_IMMUNITY',
  'STAT_SCALING'
]);

export const VALID_WEAPON_TYPES = new Set<WeaponType>([
  'Broadblade',
  'Sword',
  'Pistols',
  'Gauntlets',
  'Rectifier'
]);

export const VALID_RARITIES = new Set<Rarity>([4, 5]);

export const VALID_WEAPON_RARITIES = new Set<number>([3, 4, 5]);

export const VALID_ECHO_CLASSES = new Set<string>(['Calamity', 'Overlord', 'Elite', 'Common']);

export const VALID_ECHO_COSTS = new Set<number>([1, 3, 4]);

export const VALID_SOURCE_TYPES = new Set<SourceType>([
  'OFFICIAL_PUBLISHED',
  'OFFICIAL_DATAMINE',
  'COMMUNITY_DATAMINE',
  'LIVE_OBSERVATION',
  'COMMUNITY_VERIFIED'
]);

export const VALID_CONFIDENCES = new Set<Confidence>(['HIGH', 'MEDIUM', 'LOW']);

export const VALID_CLASSIFICATIONS = new Set<Classification>([
  'CORE_MECHANIC',
  'DAMAGE_FORMULA',
  'TOA_STAGE_DATA',
  'SUBSTAT_CURVE'
]);

export const VALID_ZONE_TYPES = new Set<string>([
  'StableZone',
  'ExperimentalZone',
  'HazardZone'
]);

export const VALID_PROVENANCE_STATUSES = new Set<ProvenanceStatus>([
  'ACTIVE',
  'SUPERSEDED',
  'DISPUTED'
]);

export const VALID_ABILITY_CATEGORIES = new Set<AbilityCategory>([
  'NormalAttack',
  'ResonanceSkill',
  'ForteCircuit',
  'ResonanceLiberation',
  'IntroSkill',
  'OutroSkill',
  'InherentSkill',
  'CombatPassive'
]);

export const VALID_EFFECT_CATEGORIES = new Set<GameplayEffectCategory>([
  'STAT_BUFF',
  'DMG_AMPLIFY',
  'COORDINATED_ATTACK',
  'DEF_SHRED',
  'RES_SHRED',
  'HEALING',
  'SHIELD',
  'SPECIAL_MECHANIC',
  'RESOURCE_GRANT',
  'STATE_CHANGE'
]);

export const VALID_EFFECT_TARGETS = new Set<GameplayEffectTarget>([
  'SELF',
  'ACTIVE_CHARACTER',
  'NEXT_RESONATOR',
  'TEAM',
  'ENEMY'
]);

export const VALID_SEQUENCE_ORDERS = new Set<SequenceOrder>([1, 2, 3, 4, 5, 6]);

export const VALID_SEQUENCE_CODES = new Map<SequenceOrder, SequenceNodeCode>([
  [1, 'S1'],
  [2, 'S2'],
  [3, 'S3'],
  [4, 'S4'],
  [5, 'S5'],
  [6, 'S6']
]);

export const VALID_REFINEMENT_RANKS = new Set<RefinementRank>(['R1', 'R2', 'R3', 'R4', 'R5']);

export const FORBIDDEN_PROVENANCE_NAMES = new Set<string>([
  'unknown',
  'n/a',
  'na',
  'generated',
  'system',
  'placeholder',
  'none',
  'null',
  'undefined'
]);

export function validateSequenceNode(
  node: unknown,
  context?: {
    patchVersion?: string;
    provenanceNames?: Set<string>;
    resonatorName?: string;
    pathPrefix?: string;
  }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = context?.pathPrefix ?? 'sequence_node';

  if (!node || typeof node !== 'object') {
    errors.push({ path: prefix, message: 'Sequence node must be an object' });
    return errors;
  }

  const n = node as Record<string, unknown>;
  const rawOrder = n.node_order ?? n.nodeOrder;
  const rawCode = n.node_code ?? n.nodeCode;
  const rawName = n.name;
  const rawDesc = n.description;
  const rawProv = n.provenance_source_name ?? n.provenanceSourceName ?? n.provenanceId ?? n.provenance_id;
  const rawPatch = n.patch_version ?? n.patch_id ?? n.patchId;

  // 1. node_order
  if (
    rawOrder === undefined ||
    rawOrder === null ||
    typeof rawOrder !== 'number' ||
    !Number.isInteger(rawOrder) ||
    !VALID_SEQUENCE_ORDERS.has(rawOrder as SequenceOrder)
  ) {
    errors.push({
      path: `${prefix}.node_order`,
      message: `Invalid node_order: ${rawOrder}. Must be an integer between 1 and 6.`
    });
  }

  // 2. node_code & consistency
  const expectedCode =
    typeof rawOrder === 'number' && Number.isInteger(rawOrder)
      ? VALID_SEQUENCE_CODES.get(rawOrder as SequenceOrder)
      : undefined;

  if (typeof rawCode !== 'string' || !['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].includes(rawCode)) {
    errors.push({
      path: `${prefix}.node_code`,
      message: `Invalid node_code: ${rawCode}. Must be one of S1, S2, S3, S4, S5, S6.`
    });
  } else if (expectedCode && rawCode !== expectedCode) {
    errors.push({
      path: `${prefix}.node_code`,
      message: `Mismatched node_order ${rawOrder} and node_code '${rawCode}'. Expected '${expectedCode}'.`
    });
  }

  // 3. Name
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    errors.push({ path: `${prefix}.name`, message: 'Sequence node name is required and cannot be empty' });
  }

  // 4. Description
  if (typeof rawDesc !== 'string' || rawDesc.trim().length === 0) {
    errors.push({ path: `${prefix}.description`, message: 'Sequence node description is required and cannot be empty' });
  }

  // 5. Provenance
  if (!rawProv || typeof rawProv !== 'string' || (rawProv as string).trim().length === 0) {
    errors.push({
      path: `${prefix}.provenance_source_name`,
      message: `Missing provenance source for sequence node ${rawCode ?? rawOrder ?? ''}`
    });
  } else {
    const provTrimmed = (rawProv as string).trim();
    if (FORBIDDEN_PROVENANCE_NAMES.has(provTrimmed.toLowerCase())) {
      errors.push({
        path: `${prefix}.provenance_source_name`,
        message: `Forbidden fake/placeholder provenance source: '${provTrimmed}'`
      });
    } else if (context?.provenanceNames && !context.provenanceNames.has(provTrimmed)) {
      errors.push({
        path: `${prefix}.provenance_source_name`,
        message: `Missing or unregistered provenance source for sequence node: ${provTrimmed}`
      });
    }
  }

  // 6. Patch Isolation
  if (context?.patchVersion && rawPatch && typeof rawPatch === 'string') {
    if (rawPatch !== context.patchVersion) {
      errors.push({
        path: `${prefix}.patch_version`,
        message: `Cross-patch reference rejected: sequence node belongs to patch '${rawPatch}' but current dataset is '${context.patchVersion}'`
      });
    }
  }

  // 7. Effects
  if (n.effects !== undefined && n.effects !== null) {
    if (!Array.isArray(n.effects)) {
      errors.push({ path: `${prefix}.effects`, message: 'effects must be an array' });
    } else {
      const effectOrders = new Set<number>();
      n.effects.forEach((eff: unknown, effIdx: number) => {
        const effPath = `${prefix}.effects[${effIdx}]`;
        if (!eff || typeof eff !== 'object') {
          errors.push({ path: effPath, message: 'GameplayEffect must be an object' });
          return;
        }

        const e = eff as Record<string, unknown>;
        if (!VALID_EFFECT_CATEGORIES.has(e.category as GameplayEffectCategory)) {
          errors.push({ path: `${effPath}.category`, message: `Invalid gameplay effect category: ${e.category}` });
        }
        if (!VALID_EFFECT_TARGETS.has(e.target as GameplayEffectTarget)) {
          errors.push({ path: `${effPath}.target`, message: `Invalid gameplay effect target: ${e.target}` });
        }

        const effProv = e.provenance_source_name ?? e.provenanceSourceName ?? rawProv;
        if (!effProv || typeof effProv !== 'string' || (effProv as string).trim().length === 0) {
          errors.push({ path: `${effPath}.provenance_source_name`, message: 'Gameplay effect provenance is required' });
        } else {
          const effProvTrimmed = (effProv as string).trim();
          if (FORBIDDEN_PROVENANCE_NAMES.has(effProvTrimmed.toLowerCase())) {
            errors.push({
              path: `${effPath}.provenance_source_name`,
              message: `Forbidden fake/placeholder provenance source: '${effProvTrimmed}'`
            });
          } else if (context?.provenanceNames && !context.provenanceNames.has(effProvTrimmed)) {
            errors.push({
              path: `${effPath}.provenance_source_name`,
              message: `Missing or unregistered provenance source for gameplay effect: ${effProvTrimmed}`
            });
          }
        }

        const order = typeof e.effect_order === 'number' ? e.effect_order : effIdx + 1;
        if (order <= 0 || !Number.isInteger(order)) {
          errors.push({ path: `${effPath}.effect_order`, message: 'effect_order must be an integer > 0' });
        } else {
          if (effectOrders.has(order)) {
            errors.push({ path: `${effPath}.effect_order`, message: `Duplicate effect_order ${order} in sequence node` });
          }
          effectOrders.add(order);
        }

        const effPatch = e.patch_version ?? e.patch_id ?? e.patchId;
        if (context?.patchVersion && effPatch && typeof effPatch === 'string') {
          if (effPatch !== context.patchVersion) {
            errors.push({
              path: `${effPath}.patch_version`,
              message: `Cross-patch effect reference rejected: effect belongs to patch '${effPatch}' but sequence node belongs to patch '${context.patchVersion}'`
            });
          }
        }
      });
    }
  }

  return errors;
}

export function validateSequenceNodes(
  nodes: unknown,
  context?: {
    patchVersion?: string;
    provenanceNames?: Set<string>;
    resonatorName?: string;
    pathPrefix?: string;
  }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = context?.pathPrefix ?? 'sequence_nodes';
  const resName = context?.resonatorName ?? 'resonator';

  if (nodes === undefined || nodes === null) {
    return errors;
  }

  if (!Array.isArray(nodes)) {
    errors.push({ path: prefix, message: 'sequence_nodes must be an array' });
    return errors;
  }

  const seenOrders = new Set<number>();
  const seenCodes = new Set<string>();

  nodes.forEach((node, idx) => {
    const nodePrefix = `${prefix}[${idx}]`;
    const nodeErrors = validateSequenceNode(node, {
      ...context,
      pathPrefix: nodePrefix,
    });
    errors.push(...nodeErrors);

    if (node && typeof node === 'object') {
      const n = node as Record<string, unknown>;
      const order = n.node_order ?? n.nodeOrder;
      const code = n.node_code ?? n.nodeCode;

      if (typeof order === 'number' && Number.isInteger(order)) {
        if (seenOrders.has(order)) {
          errors.push({
            path: `${nodePrefix}.node_order`,
            message: `Duplicate node_order ${order} for resonator ${resName}`
          });
        }
        seenOrders.add(order);
      }

      if (typeof code === 'string') {
        if (seenCodes.has(code)) {
          errors.push({
            path: `${nodePrefix}.node_code`,
            message: `Duplicate node_code '${code}' for resonator ${resName}`
          });
        }
        seenCodes.add(code);
      }
    }
  });

  return errors;
}

export function validateRefinementScaling(
  scaling: unknown,
  context?: {
    weaponName?: string;
    pathPrefix?: string;
  }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = context?.pathPrefix ?? 'refinement_scaling';
  const wName = context?.weaponName ?? 'weapon';

  if (scaling === undefined || scaling === null) {
    return errors;
  }

  if (typeof scaling !== 'object' || Array.isArray(scaling)) {
    errors.push({ path: prefix, message: `refinement_scaling for ${wName} must be an object` });
    return errors;
  }

  const ranks = Object.keys(scaling);
  if (ranks.length === 0) {
    errors.push({
      path: prefix,
      message: `refinement_scaling for ${wName} claims numerical scaling but contains no rank definitions`
    });
    return errors;
  }

  const FORBIDDEN_FLAGS = ['inferred', 'derived', 'synthetic', 'interpolated', 'extrapolated', 'estimated'];
  const FORBIDDEN_PARAM_KEYS = ['multiplier', 'scale_factor', 'power_multiplier', 'power_mult'];

  for (const rankKey of ranks) {
    const rankPath = `${prefix}.${rankKey}`;

    if (!VALID_REFINEMENT_RANKS.has(rankKey as RefinementRank)) {
      errors.push({
        path: rankPath,
        message: `Invalid refinement rank '${rankKey}'. Valid ranks are R1, R2, R3, R4, R5.`
      });
      continue;
    }

    const rankValue = (scaling as Record<string, unknown>)[rankKey];
    if (!rankValue || typeof rankValue !== 'object' || Array.isArray(rankValue)) {
      errors.push({
        path: rankPath,
        message: `Refinement rank ${rankKey} for ${wName} must be a non-null object of verified parameters`
      });
      continue;
    }

    const rankObj = rankValue as Record<string, unknown>;
    const paramEntries = Object.entries(rankObj);

    if (paramEntries.length === 0) {
      errors.push({
        path: rankPath,
        message: `Refinement rank ${rankKey} for ${wName} cannot be empty`
      });
      continue;
    }

    // Check for derived / inferred flags
    for (const flag of FORBIDDEN_FLAGS) {
      if (flag in rankObj && Boolean(rankObj[flag])) {
        errors.push({
          path: `${rankPath}.${flag}`,
          message: `Refinement rank ${rankKey} for ${wName} contains forbidden '${flag}' flag. Only explicit verified source values are allowed.`
        });
      }
    }

    // Check for synthetic multiplier keys or formulas
    for (const [paramKey, paramVal] of paramEntries) {
      const lowerKey = paramKey.toLowerCase();
      if (FORBIDDEN_PARAM_KEYS.includes(lowerKey)) {
        errors.push({
          path: `${rankPath}.${paramKey}`,
          message: `Refinement rank ${rankKey} for ${wName} contains forbidden synthetic multiplier '${paramKey}'`
        });
      }

      if (typeof paramVal === 'string') {
        if (paramVal.includes('${') || paramVal.includes('*') || paramVal.includes('+')) {
          errors.push({
            path: `${rankPath}.${paramKey}`,
            message: `Refinement rank ${rankKey} for ${wName} contains unverified formula expression '${paramVal}'. Concrete numerical values required.`
          });
        }
      }
    }
  }

  return errors;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

function isValidIsoDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Validates incoming PatchDataset against strict database constraints and domain rules.
 */
export function validatePatchDataset(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [{ path: 'root', message: 'Dataset must be an object' }]
    };
  }

  const dataset = data as Partial<PatchDataset>;

  // 1. Provenance Sources
  const provenanceNames = new Set<string>();
  if (!dataset.provenance_sources || !Array.isArray(dataset.provenance_sources)) {
    errors.push({ path: 'provenance_sources', message: 'provenance_sources must be an array' });
  } else {
    dataset.provenance_sources.forEach((ps, idx) => {
      const pPath = `provenance_sources[${idx}]`;
      if (!ps.source_name || typeof ps.source_name !== 'string') {
        errors.push({ path: `${pPath}.source_name`, message: 'source_name is required' });
      } else {
        if (provenanceNames.has(ps.source_name)) {
          errors.push({ path: `${pPath}.source_name`, message: `Duplicate provenance source: ${ps.source_name}` });
        }
        provenanceNames.add(ps.source_name);
      }

      if (!VALID_SOURCE_TYPES.has(ps.source_type as SourceType)) {
        errors.push({ path: `${pPath}.source_type`, message: `Invalid source_type: ${ps.source_type}` });
      }

      if (!VALID_CONFIDENCES.has(ps.confidence as Confidence)) {
        errors.push({ path: `${pPath}.confidence`, message: `Invalid confidence: ${ps.confidence}` });
      }

      if (!VALID_CLASSIFICATIONS.has(ps.classification as Classification)) {
        errors.push({ path: `${pPath}.classification`, message: `Invalid classification: ${ps.classification}` });
      }

      if (ps.status && !VALID_PROVENANCE_STATUSES.has(ps.status as ProvenanceStatus)) {
        errors.push({ path: `${pPath}.status`, message: `Invalid provenance status: ${ps.status}` });
      }

      if (!isValidIsoDate(ps.verification_date)) {
        errors.push({ path: `${pPath}.verification_date`, message: `Invalid verification_date: ${ps.verification_date}` });
      }
    });
  }

  // 2. Patch Registry
  if (!dataset.patch || typeof dataset.patch !== 'object') {
    errors.push({ path: 'patch', message: 'patch object is required' });
  } else {
    const p = dataset.patch;
    if (!p.version || typeof p.version !== 'string' || !/^\d+\.\d+(\.\d+)?$/.test(p.version)) {
      errors.push({ path: 'patch.version', message: `Invalid patch version: ${p.version}` });
    }
    if (!isValidIsoDate(p.release_date)) {
      errors.push({ path: 'patch.release_date', message: `Invalid patch release_date: ${p.release_date}` });
    }
    if (!p.provenance_source_name || !provenanceNames.has(p.provenance_source_name)) {
      errors.push({
        path: 'patch.provenance_source_name',
        message: `Missing or unregistered provenance source for patch: ${p.provenance_source_name}`
      });
    }
  }

  // 3. Taxonomies (Roles & Tags)
  const roleCodes = new Set<string>();
  if (dataset.functional_roles && Array.isArray(dataset.functional_roles)) {
    dataset.functional_roles.forEach((r, idx) => {
      if (!r.code) errors.push({ path: `functional_roles[${idx}].code`, message: 'Role code is required' });
      else roleCodes.add(r.code);
    });
  }

  const tagCodes = new Set<string>();
  if (dataset.combat_tags && Array.isArray(dataset.combat_tags)) {
    dataset.combat_tags.forEach((t, idx) => {
      if (!t.code) errors.push({ path: `combat_tags[${idx}].code`, message: 'Combat tag code is required' });
      else tagCodes.add(t.code);
    });
  }

  // 4. Resonators & Abilities
  const resonatorNames = new Set<string>();

  if (!dataset.resonators || !Array.isArray(dataset.resonators) || dataset.resonators.length === 0) {
    errors.push({ path: 'resonators', message: 'resonators must be a non-empty array' });
  } else {
    dataset.resonators.forEach((res, rIdx) => {
      const resPath = `resonators[${rIdx}]`;

      // Name & Unique Resonator Identity
      if (!res.name || typeof res.name !== 'string') {
        errors.push({ path: `${resPath}.name`, message: 'Resonator name is required' });
      } else {
        if (resonatorNames.has(res.name)) {
          errors.push({ path: `${resPath}.name`, message: `Duplicate Resonator identity: ${res.name}` });
        }
        resonatorNames.add(res.name);
      }

      // Element
      if (!VALID_ELEMENTS.has(res.element as Element)) {
        errors.push({ path: `${resPath}.element`, message: `Unknown elemental value: ${res.element}` });
      }

      // Weapon Type
      if (!VALID_WEAPON_TYPES.has(res.weapon_type as WeaponType)) {
        errors.push({ path: `${resPath}.weapon_type`, message: `Unknown weapon type: ${res.weapon_type}` });
      }

      // Rarity
      if (!VALID_RARITIES.has(res.rarity as Rarity)) {
        errors.push({ path: `${resPath}.rarity`, message: `Invalid rarity: ${res.rarity}` });
      }

      // Release Date
      if (!isValidIsoDate(res.release_date)) {
        errors.push({ path: `${resPath}.release_date`, message: `Invalid release_date: ${res.release_date}` });
      }

      // Patch-specific stats
      if (!res.patch_data || typeof res.patch_data !== 'object') {
        errors.push({ path: `${resPath}.patch_data`, message: 'patch_data is required' });
      } else {
        const pd = res.patch_data;
        if (typeof pd.base_hp_lvl90 !== 'number' || pd.base_hp_lvl90 <= 0) {
          errors.push({ path: `${resPath}.patch_data.base_hp_lvl90`, message: `base_hp_lvl90 must be > 0, got ${pd.base_hp_lvl90}` });
        }
        if (typeof pd.base_atk_lvl90 !== 'number' || pd.base_atk_lvl90 <= 0) {
          errors.push({ path: `${resPath}.patch_data.base_atk_lvl90`, message: `base_atk_lvl90 must be > 0, got ${pd.base_atk_lvl90}` });
        }
        if (typeof pd.base_def_lvl90 !== 'number' || pd.base_def_lvl90 <= 0) {
          errors.push({ path: `${resPath}.patch_data.base_def_lvl90`, message: `base_def_lvl90 must be > 0, got ${pd.base_def_lvl90}` });
        }

        // Provenance check
        if (!pd.provenance_source_name || !provenanceNames.has(pd.provenance_source_name)) {
          errors.push({
            path: `${resPath}.patch_data.provenance_source_name`,
            message: `Missing or unregistered provenance source for resonator patch data: ${pd.provenance_source_name}`
          });
        }

        // Role assignments check
        if (pd.roles && Array.isArray(pd.roles)) {
          pd.roles.forEach((r, roleIdx) => {
            if (roleCodes.size > 0 && !roleCodes.has(r.code)) {
              errors.push({ path: `${resPath}.patch_data.roles[${roleIdx}].code`, message: `Unknown role code: ${r.code}` });
            }
          });
        }

        // Combat tags check
        if (pd.combat_tags && Array.isArray(pd.combat_tags)) {
          pd.combat_tags.forEach((tCode, tagIdx) => {
            if (tagCodes.size > 0 && !tagCodes.has(tCode)) {
              errors.push({ path: `${resPath}.patch_data.combat_tags[${tagIdx}]`, message: `Unknown combat tag code: ${tCode}` });
            }
          });
        }
      }

      // Abilities
      const abilityCodes = new Set<string>();
      if (!res.abilities || !Array.isArray(res.abilities)) {
        errors.push({ path: `${resPath}.abilities`, message: 'abilities must be an array' });
      } else {
        res.abilities.forEach((ab, abIdx) => {
          const abPath = `${resPath}.abilities[${abIdx}]`;

          // Unique ability code per resonator
          if (!ab.ability_code || typeof ab.ability_code !== 'string') {
            errors.push({ path: `${abPath}.ability_code`, message: 'ability_code is required' });
          } else {
            if (abilityCodes.has(ab.ability_code)) {
              errors.push({ path: `${abPath}.ability_code`, message: `Duplicate ability code for ${res.name}: ${ab.ability_code}` });
            }
            abilityCodes.add(ab.ability_code);
          }

          // Ability Category
          if (!VALID_ABILITY_CATEGORIES.has(ab.ability_category as AbilityCategory)) {
            errors.push({ path: `${abPath}.ability_category`, message: `Invalid ability category: ${ab.ability_category}` });
          }

          // Name
          if (!ab.name || typeof ab.name !== 'string') {
            errors.push({ path: `${abPath}.name`, message: 'Ability name is required' });
          }

          // Provenance
          if (!ab.provenance_source_name || !provenanceNames.has(ab.provenance_source_name)) {
            errors.push({
              path: `${abPath}.provenance_source_name`,
              message: `Missing or unregistered provenance source for ability: ${ab.provenance_source_name}`
            });
          }

          // Cooldown and Energy
          if (ab.cooldown_seconds !== undefined && ab.cooldown_seconds !== null && ab.cooldown_seconds < 0) {
            errors.push({ path: `${abPath}.cooldown_seconds`, message: 'cooldown_seconds cannot be negative' });
          }
          if (ab.energy_cost !== undefined && ab.energy_cost !== null && ab.energy_cost < 0) {
            errors.push({ path: `${abPath}.energy_cost`, message: 'energy_cost cannot be negative' });
          }
          if (typeof ab.concertos_generated === 'number' && ab.concertos_generated < 0) {
            errors.push({ path: `${abPath}.concertos_generated`, message: 'concertos_generated cannot be negative' });
          }

          // Gameplay effects
          if (ab.effects && Array.isArray(ab.effects)) {
            const effectOrders = new Set<number>();
            ab.effects.forEach((eff, effIdx) => {
              const effPath = `${abPath}.effects[${effIdx}]`;

              if (!VALID_EFFECT_CATEGORIES.has(eff.category as GameplayEffectCategory)) {
                errors.push({ path: `${effPath}.category`, message: `Invalid gameplay effect category: ${eff.category}` });
              }

              if (!VALID_EFFECT_TARGETS.has(eff.target as GameplayEffectTarget)) {
                errors.push({ path: `${effPath}.target`, message: `Invalid gameplay effect target: ${eff.target}` });
              }

              if (!eff.provenance_source_name || !provenanceNames.has(eff.provenance_source_name)) {
                errors.push({
                  path: `${effPath}.provenance_source_name`,
                  message: `Missing or unregistered provenance source for gameplay effect: ${eff.provenance_source_name}`
                });
              }

              const order = eff.effect_order ?? effIdx + 1;
              if (order <= 0) {
                errors.push({ path: `${effPath}.effect_order`, message: 'effect_order must be > 0' });
              } else {
                if (effectOrders.has(order)) {
                  errors.push({ path: `${effPath}.effect_order`, message: `Duplicate effect_order ${order} in ability` });
                }
                effectOrders.add(order);
              }
            });
          }
        });
      }

      // Sequence Nodes Validation (Optional: undefined supported, validated if present)
      const seqNodes = res.sequence_nodes ?? res.sequences;
      if (seqNodes !== undefined && seqNodes !== null) {
        const seqErrors = validateSequenceNodes(seqNodes, {
          patchVersion: dataset.patch?.version,
          provenanceNames,
          resonatorName: res.name,
          pathPrefix: `${resPath}.sequence_nodes`
        });
        errors.push(...seqErrors);
      }
    });
  }

  // 5. Weapons Validation
  if (dataset.weapons) {
    if (!Array.isArray(dataset.weapons)) {
      errors.push({ path: 'weapons', message: 'weapons must be an array' });
    } else {
      const weaponNames = new Set<string>();
      dataset.weapons.forEach((w, wIdx) => {
        const wPath = `weapons[${wIdx}]`;

        if (!w.name || typeof w.name !== 'string') {
          errors.push({ path: `${wPath}.name`, message: 'Weapon name is required' });
        } else {
          if (weaponNames.has(w.name)) {
            errors.push({ path: `${wPath}.name`, message: `Duplicate weapon identity: ${w.name}` });
          }
          weaponNames.add(w.name);
        }

        if (!VALID_WEAPON_TYPES.has(w.weapon_type)) {
          errors.push({ path: `${wPath}.weapon_type`, message: `Invalid weapon type: ${w.weapon_type}` });
        }

        if (!VALID_WEAPON_RARITIES.has(w.rarity)) {
          errors.push({ path: `${wPath}.rarity`, message: `Invalid weapon rarity: ${w.rarity}` });
        }

        if (!w.patch_data || typeof w.patch_data !== 'object') {
          errors.push({ path: `${wPath}.patch_data`, message: 'patch_data is required for weapon' });
        } else {
          const pd = w.patch_data;
          if (typeof pd.base_atk_lvl90 !== 'number' || pd.base_atk_lvl90 <= 0) {
            errors.push({ path: `${wPath}.patch_data.base_atk_lvl90`, message: `base_atk_lvl90 must be > 0, got ${pd.base_atk_lvl90}` });
          }

          if (!pd.sub_stat_type || typeof pd.sub_stat_type !== 'string') {
            errors.push({ path: `${wPath}.patch_data.sub_stat_type`, message: 'sub_stat_type is required' });
          }

          if (typeof pd.sub_stat_value_lvl90 !== 'number' || pd.sub_stat_value_lvl90 <= 0) {
            errors.push({ path: `${wPath}.patch_data.sub_stat_value_lvl90`, message: `sub_stat_value_lvl90 must be > 0, got ${pd.sub_stat_value_lvl90}` });
          }

          if (!pd.provenance_source_name || !provenanceNames.has(pd.provenance_source_name)) {
            errors.push({
              path: `${wPath}.patch_data.provenance_source_name`,
              message: `Missing or unregistered provenance source for weapon: ${pd.provenance_source_name}`
            });
          }

          // Refinement Scaling Validation on patch_data
          if (pd.refinement_scaling) {
            const refErrors = validateRefinementScaling(pd.refinement_scaling, {
              weaponName: w.name,
              pathPrefix: `${wPath}.patch_data.refinement_scaling`
            });
            errors.push(...refErrors);
            if (!pd.passive_effect) {
              errors.push({
                path: `${wPath}.patch_data.refinement_scaling`,
                message: `Weapon ${w.name} specifies refinement_scaling but has no passive_effect to scale`
              });
            }
          }

          if (pd.passive_effect) {
            const eff = pd.passive_effect;
            if (!VALID_EFFECT_CATEGORIES.has(eff.category)) {
              errors.push({ path: `${wPath}.patch_data.passive_effect.category`, message: `Invalid gameplay effect category: ${eff.category}` });
            }
            if (!VALID_EFFECT_TARGETS.has(eff.target)) {
              errors.push({ path: `${wPath}.patch_data.passive_effect.target`, message: `Invalid gameplay effect target: ${eff.target}` });
            }
            if (!eff.provenance_source_name || !provenanceNames.has(eff.provenance_source_name)) {
              errors.push({
                path: `${wPath}.patch_data.passive_effect.provenance_source_name`,
                message: `Missing or unregistered provenance source for weapon passive effect: ${eff.provenance_source_name}`
              });
            }

            // Refinement Scaling in detail_expression
            if (eff.detail_expression && eff.detail_expression.refinement_scaling) {
              const refErrors = validateRefinementScaling(eff.detail_expression.refinement_scaling, {
                weaponName: w.name,
                pathPrefix: `${wPath}.patch_data.passive_effect.detail_expression.refinement_scaling`
              });
              errors.push(...refErrors);

              if (pd.refinement_scaling) {
                if (JSON.stringify(pd.refinement_scaling) !== JSON.stringify(eff.detail_expression.refinement_scaling)) {
                  errors.push({
                    path: `${wPath}.patch_data.refinement_scaling`,
                    message: `Conflicting refinement_scaling definitions between weapon patch_data and passive_effect detail_expression for ${w.name}`
                  });
                }
              }
            }
          }
        }
      });
    }
  }

  // 6. Echoes Validation
  if (dataset.echoes) {
    if (!Array.isArray(dataset.echoes)) {
      errors.push({ path: 'echoes', message: 'echoes must be an array' });
    } else {
      const echoNames = new Set<string>();
      dataset.echoes.forEach((e, eIdx) => {
        const ePath = `echoes[${eIdx}]`;

        if (!e.name || typeof e.name !== 'string') {
          errors.push({ path: `${ePath}.name`, message: 'Echo name is required' });
        } else {
          if (echoNames.has(e.name)) {
            errors.push({ path: `${ePath}.name`, message: `Duplicate echo identity: ${e.name}` });
          }
          echoNames.add(e.name);
        }

        if (!VALID_ECHO_CLASSES.has(e.class_type)) {
          errors.push({ path: `${ePath}.class_type`, message: `Invalid echo class_type: ${e.class_type}` });
        }

        if (!VALID_ECHO_COSTS.has(e.cost)) {
          errors.push({ path: `${ePath}.cost`, message: `Invalid echo cost: ${e.cost}` });
        }

        if (!e.patch_data || typeof e.patch_data !== 'object') {
          errors.push({ path: `${ePath}.patch_data`, message: 'patch_data is required for echo' });
        } else {
          const pd = e.patch_data;
          if (!VALID_ECHO_COSTS.has(pd.cost)) {
            errors.push({ path: `${ePath}.patch_data.cost`, message: `Invalid echo patch_data cost: ${pd.cost}` });
          }
          if (pd.cost !== e.cost) {
            errors.push({ path: `${ePath}.patch_data.cost`, message: `Echo cost mismatch between invariant (${e.cost}) and patch (${pd.cost})` });
          }
          if (pd.cd_seconds !== undefined && pd.cd_seconds !== null && pd.cd_seconds < 0) {
            errors.push({ path: `${ePath}.patch_data.cd_seconds`, message: 'cd_seconds cannot be negative' });
          }
          if (pd.concertos_generated !== undefined && pd.concertos_generated !== null && pd.concertos_generated < 0) {
            errors.push({ path: `${ePath}.patch_data.concertos_generated`, message: 'concertos_generated cannot be negative' });
          }
          if (!pd.provenance_source_name || !provenanceNames.has(pd.provenance_source_name)) {
            errors.push({
              path: `${ePath}.patch_data.provenance_source_name`,
              message: `Missing or unregistered provenance source for echo: ${pd.provenance_source_name}`
            });
          }

          if (pd.skill_effect) {
            const eff = pd.skill_effect;
            if (!VALID_EFFECT_CATEGORIES.has(eff.category)) {
              errors.push({ path: `${ePath}.patch_data.skill_effect.category`, message: `Invalid gameplay effect category: ${eff.category}` });
            }
            if (!VALID_EFFECT_TARGETS.has(eff.target)) {
              errors.push({ path: `${ePath}.patch_data.skill_effect.target`, message: `Invalid gameplay effect target: ${eff.target}` });
            }
            if (!eff.provenance_source_name || !provenanceNames.has(eff.provenance_source_name)) {
              errors.push({
                path: `${ePath}.patch_data.skill_effect.provenance_source_name`,
                message: `Missing or unregistered provenance source for echo skill effect: ${eff.provenance_source_name}`
              });
            }
          }
        }
      });
    }
  }

  // 7. Sonatas Validation
  if (dataset.sonatas) {
    if (!Array.isArray(dataset.sonatas)) {
      errors.push({ path: 'sonatas', message: 'sonatas must be an array' });
    } else {
      const sonataNames = new Set<string>();
      const sonataCodes = new Set<string>();
      dataset.sonatas.forEach((s, sIdx) => {
        const sPath = `sonatas[${sIdx}]`;

        if (!s.name || typeof s.name !== 'string') {
          errors.push({ path: `${sPath}.name`, message: 'Sonata name is required' });
        } else {
          if (sonataNames.has(s.name)) {
            errors.push({ path: `${sPath}.name`, message: `Duplicate sonata identity: ${s.name}` });
          }
          sonataNames.add(s.name);
        }

        if (!s.code || typeof s.code !== 'string') {
          errors.push({ path: `${sPath}.code`, message: 'Sonata code is required' });
        } else {
          if (sonataCodes.has(s.code)) {
            errors.push({ path: `${sPath}.code`, message: `Duplicate sonata code: ${s.code}` });
          }
          sonataCodes.add(s.code);
        }

        if (!s.patch_data || typeof s.patch_data !== 'object') {
          errors.push({ path: `${sPath}.patch_data`, message: 'patch_data is required for sonata' });
        } else {
          const pd = s.patch_data;
          if (!pd.two_piece_effect || typeof pd.two_piece_effect !== 'object') {
            errors.push({ path: `${sPath}.patch_data.two_piece_effect`, message: 'two_piece_effect is required for sonata' });
          } else {
            const eff2 = pd.two_piece_effect;
            if (!VALID_EFFECT_CATEGORIES.has(eff2.category)) {
              errors.push({ path: `${sPath}.patch_data.two_piece_effect.category`, message: `Invalid gameplay effect category: ${eff2.category}` });
            }
            if (!VALID_EFFECT_TARGETS.has(eff2.target)) {
              errors.push({ path: `${sPath}.patch_data.two_piece_effect.target`, message: `Invalid gameplay effect target: ${eff2.target}` });
            }
            if (!eff2.provenance_source_name || !provenanceNames.has(eff2.provenance_source_name)) {
              errors.push({
                path: `${sPath}.patch_data.two_piece_effect.provenance_source_name`,
                message: `Missing or unregistered provenance source for 2-piece effect: ${eff2.provenance_source_name}`
              });
            }
          }

          if (!pd.five_piece_effect || typeof pd.five_piece_effect !== 'object') {
            errors.push({ path: `${sPath}.patch_data.five_piece_effect`, message: 'five_piece_effect is required for sonata' });
          } else {
            const eff5 = pd.five_piece_effect;
            if (!VALID_EFFECT_CATEGORIES.has(eff5.category)) {
              errors.push({ path: `${sPath}.patch_data.five_piece_effect.category`, message: `Invalid gameplay effect category: ${eff5.category}` });
            }
            if (!VALID_EFFECT_TARGETS.has(eff5.target)) {
              errors.push({ path: `${sPath}.patch_data.five_piece_effect.target`, message: `Invalid gameplay effect target: ${eff5.target}` });
            }
            if (!eff5.provenance_source_name || !provenanceNames.has(eff5.provenance_source_name)) {
              errors.push({
                path: `${sPath}.patch_data.five_piece_effect.provenance_source_name`,
                message: `Missing or unregistered provenance source for 5-piece effect: ${eff5.provenance_source_name}`
              });
            }
          }

          if (!pd.provenance_source_name || !provenanceNames.has(pd.provenance_source_name)) {
            errors.push({
              path: `${sPath}.patch_data.provenance_source_name`,
              message: `Missing or unregistered provenance source for sonata: ${pd.provenance_source_name}`
            });
          }
        }
      });
    }
  }

  // 8. Enemies, Resistances & Modifiers Validation
  if (dataset.enemies) {
    if (!Array.isArray(dataset.enemies)) {
      errors.push({ path: 'enemies', message: 'enemies must be an array' });
    } else {
      const enemyNames = new Set<string>();
      const enemyCodes = new Set<string>();

      dataset.enemies.forEach((enemy, eIdx) => {
        const ePath = `enemies[${eIdx}]`;

        if (!enemy.name || typeof enemy.name !== 'string' || enemy.name.trim() === '') {
          errors.push({ path: `${ePath}.name`, message: 'Enemy name is required' });
        } else {
          if (enemyNames.has(enemy.name)) {
            errors.push({ path: `${ePath}.name`, message: `Duplicate enemy identity: ${enemy.name}` });
          }
          enemyNames.add(enemy.name);
        }

        if (!enemy.code || typeof enemy.code !== 'string' || enemy.code.trim() === '') {
          errors.push({ path: `${ePath}.code`, message: 'Enemy code is required' });
        } else {
          if (enemyCodes.has(enemy.code)) {
            errors.push({ path: `${ePath}.code`, message: `Duplicate enemy code: ${enemy.code}` });
          }
          enemyCodes.add(enemy.code);
        }

        if (!VALID_ENEMY_CLASSES.has(enemy.enemy_class)) {
          errors.push({
            path: `${ePath}.enemy_class`,
            message: `Invalid enemy class: ${enemy.enemy_class}`
          });
        }

        if (enemy.provenance_source_name && !provenanceNames.has(enemy.provenance_source_name)) {
          errors.push({
            path: `${ePath}.provenance_source_name`,
            message: `Missing or unregistered provenance source for enemy: ${enemy.provenance_source_name}`
          });
        }

        // Resistances
        if (enemy.resistances) {
          if (!Array.isArray(enemy.resistances)) {
            errors.push({ path: `${ePath}.resistances`, message: 'resistances must be an array' });
          } else {
            const elementsSeen = new Set<string>();
            enemy.resistances.forEach((res, rIdx) => {
              const rPath = `${ePath}.resistances[${rIdx}]`;

              if (!VALID_RESISTANCE_ELEMENTS.has(res.element)) {
                errors.push({
                  path: `${rPath}.element`,
                  message: `Invalid resistance element: ${res.element}`
                });
              } else {
                if (elementsSeen.has(res.element)) {
                  errors.push({
                    path: `${rPath}.element`,
                    message: `Duplicate resistance element for enemy: ${res.element}`
                  });
                }
                elementsSeen.add(res.element);
              }

              if (
                typeof res.resistance_ratio !== 'number' ||
                Number.isNaN(res.resistance_ratio) ||
                res.resistance_ratio < -1.0 ||
                res.resistance_ratio > 2.0
              ) {
                errors.push({
                  path: `${rPath}.resistance_ratio`,
                  message: `Resistance ratio must be a number between -1.0000 and 2.0000, got: ${res.resistance_ratio}`
                });
              }

              if (!res.provenance_source_name || !provenanceNames.has(res.provenance_source_name)) {
                errors.push({
                  path: `${rPath}.provenance_source_name`,
                  message: `Missing or unregistered provenance source for resistance: ${res.provenance_source_name}`
                });
              }
            });
          }
        }

        // Modifiers
        if (enemy.modifiers) {
          if (!Array.isArray(enemy.modifiers)) {
            errors.push({ path: `${ePath}.modifiers`, message: 'modifiers must be an array' });
          } else {
            const modifierTypesSeen = new Set<string>();
            enemy.modifiers.forEach((mod, mIdx) => {
              const mPath = `${ePath}.modifiers[${mIdx}]`;

              if (!VALID_MODIFIER_TYPES.has(mod.modifier_type)) {
                errors.push({
                  path: `${mPath}.modifier_type`,
                  message: `Invalid modifier type: ${mod.modifier_type}`
                });
              } else {
                if (modifierTypesSeen.has(mod.modifier_type)) {
                  errors.push({
                    path: `${mPath}.modifier_type`,
                    message: `Duplicate modifier type for enemy: ${mod.modifier_type}`
                  });
                }
                modifierTypesSeen.add(mod.modifier_type);
              }

              if (mod.parameters !== undefined && (typeof mod.parameters !== 'object' || mod.parameters === null || Array.isArray(mod.parameters))) {
                errors.push({
                  path: `${mPath}.parameters`,
                  message: 'Modifier parameters must be a valid object'
                });
              }

              if (!mod.provenance_source_name || !provenanceNames.has(mod.provenance_source_name)) {
                errors.push({
                  path: `${mPath}.provenance_source_name`,
                  message: `Missing or unregistered provenance source for modifier: ${mod.provenance_source_name}`
                });
              }
            });
          }
        }
      });
    }
  }

  // 9. Area Effects Validation
  const areaEffectSourceIds = new Set<string>();
  if (dataset.area_effects) {
    if (!Array.isArray(dataset.area_effects)) {
      errors.push({ path: 'area_effects', message: 'area_effects must be an array' });
    } else {
      dataset.area_effects.forEach((ae, idx) => {
        const aePath = `area_effects[${idx}]`;
        if (!ae.source_id || typeof ae.source_id !== 'string') {
          errors.push({ path: `${aePath}.source_id`, message: 'Area effect source_id is required' });
        } else {
          if (areaEffectSourceIds.has(ae.source_id)) {
            errors.push({ path: `${aePath}.source_id`, message: `Duplicate area effect source_id: ${ae.source_id}` });
          }
          areaEffectSourceIds.add(ae.source_id);
        }

        if (!ae.name || typeof ae.name !== 'string') {
          errors.push({ path: `${aePath}.name`, message: 'Area effect name is required' });
        }

        if (!ae.description || typeof ae.description !== 'string') {
          errors.push({ path: `${aePath}.description`, message: 'Area effect description is required' });
        }

        if (!ae.gameplay_effect) {
          errors.push({ path: `${aePath}.gameplay_effect`, message: 'Area effect gameplay_effect is required' });
        } else {
          if (!VALID_EFFECT_CATEGORIES.has(ae.gameplay_effect.category)) {
            errors.push({ path: `${aePath}.gameplay_effect.category`, message: `Invalid category: ${ae.gameplay_effect.category}` });
          }
          if (!VALID_EFFECT_TARGETS.has(ae.gameplay_effect.target)) {
            errors.push({ path: `${aePath}.gameplay_effect.target`, message: `Invalid target: ${ae.gameplay_effect.target}` });
          }
          if (!ae.gameplay_effect.provenance_source_name || !provenanceNames.has(ae.gameplay_effect.provenance_source_name)) {
            errors.push({ path: `${aePath}.gameplay_effect.provenance_source_name`, message: `Unregistered provenance source: ${ae.gameplay_effect.provenance_source_name}` });
          }
        }
      });
    }
  }

  // 10. Tower of Adversity Cycles Validation
  if (dataset.toa_cycles) {
    if (!Array.isArray(dataset.toa_cycles)) {
      errors.push({ path: 'toa_cycles', message: 'toa_cycles must be an array' });
    } else {
      const cycleCodes = new Set<string>();
      dataset.toa_cycles.forEach((cycle, cIdx) => {
        const cPath = `toa_cycles[${cIdx}]`;

        if (!cycle.cycle_code) {
          errors.push({ path: `${cPath}.cycle_code`, message: 'cycle_code is required' });
        } else {
          if (cycleCodes.has(cycle.cycle_code)) {
            errors.push({ path: `${cPath}.cycle_code`, message: `Duplicate cycle_code: ${cycle.cycle_code}` });
          }
          cycleCodes.add(cycle.cycle_code);
        }

        if (!cycle.cycle_name) {
          errors.push({ path: `${cPath}.cycle_name`, message: 'cycle_name is required' });
        }

        if (!cycle.start_time || isNaN(Date.parse(cycle.start_time))) {
          errors.push({ path: `${cPath}.start_time`, message: 'Valid ISO start_time is required' });
        }
        if (!cycle.end_time || isNaN(Date.parse(cycle.end_time))) {
          errors.push({ path: `${cPath}.end_time`, message: 'Valid ISO end_time is required' });
        }
        if (cycle.start_time && cycle.end_time && Date.parse(cycle.start_time) >= Date.parse(cycle.end_time)) {
          errors.push({ path: `${cPath}.end_time`, message: 'end_time must be after start_time' });
        }

        if (!cycle.provenance_source_name || !provenanceNames.has(cycle.provenance_source_name)) {
          errors.push({ path: `${cPath}.provenance_source_name`, message: `Unregistered provenance source: ${cycle.provenance_source_name}` });
        }

        if (!Array.isArray(cycle.zones) || cycle.zones.length === 0) {
          errors.push({ path: `${cPath}.zones`, message: 'Cycle must contain at least one zone' });
        } else {
          const zoneTypesSeen = new Set<string>();
          cycle.zones.forEach((zone, zIdx) => {
            const zPath = `${cPath}.zones[${zIdx}]`;
            if (!VALID_ZONE_TYPES.has(zone.zone_type)) {
              errors.push({ path: `${zPath}.zone_type`, message: `Invalid zone_type: ${zone.zone_type}` });
            } else {
              if (zoneTypesSeen.has(zone.zone_type)) {
                errors.push({ path: `${zPath}.zone_type`, message: `Duplicate zone_type in cycle: ${zone.zone_type}` });
              }
              zoneTypesSeen.add(zone.zone_type);
            }

            if (!Array.isArray(zone.towers) || zone.towers.length === 0) {
              errors.push({ path: `${zPath}.towers`, message: 'Zone must contain at least one tower' });
            } else {
              const towerOrdersSeen = new Set<number>();
              zone.towers.forEach((tower, tIdx) => {
                const tPath = `${zPath}.towers[${tIdx}]`;
                if (!Number.isInteger(tower.tower_order) || tower.tower_order <= 0) {
                  errors.push({ path: `${tPath}.tower_order`, message: 'tower_order must be a positive integer' });
                } else {
                  if (towerOrdersSeen.has(tower.tower_order)) {
                    errors.push({ path: `${tPath}.tower_order`, message: `Duplicate tower_order in zone: ${tower.tower_order}` });
                  }
                  towerOrdersSeen.add(tower.tower_order);
                }

                if (!tower.tower_name) {
                  errors.push({ path: `${tPath}.tower_name`, message: 'tower_name is required' });
                }

                if (!Array.isArray(tower.stages) || tower.stages.length === 0) {
                  errors.push({ path: `${tPath}.stages`, message: 'Tower must contain at least one stage' });
                } else {
                  const stageIndicesSeen = new Set<number>();
                  tower.stages.forEach((stage, sIdx) => {
                    const sPath = `${tPath}.stages[${sIdx}]`;
                    if (!Number.isInteger(stage.stage_index) || stage.stage_index <= 0) {
                      errors.push({ path: `${sPath}.stage_index`, message: 'stage_index must be a positive integer' });
                    } else {
                      if (stageIndicesSeen.has(stage.stage_index)) {
                        errors.push({ path: `${sPath}.stage_index`, message: `Duplicate stage_index in tower: ${stage.stage_index}` });
                      }
                      stageIndicesSeen.add(stage.stage_index);
                    }

                    if (!Number.isInteger(stage.vigor_cost) || stage.vigor_cost <= 0) {
                      errors.push({ path: `${sPath}.vigor_cost`, message: 'vigor_cost must be a positive integer' });
                    }

                    if (stage.area_effect_source_ids) {
                      if (!Array.isArray(stage.area_effect_source_ids)) {
                        errors.push({ path: `${sPath}.area_effect_source_ids`, message: 'area_effect_source_ids must be an array' });
                      } else {
                        stage.area_effect_source_ids.forEach((affId, aIdx) => {
                          if (!areaEffectSourceIds.has(affId)) {
                            errors.push({ path: `${sPath}.area_effect_source_ids[${aIdx}]`, message: `Unknown area_effect source_id: ${affId}` });
                          }
                        });
                      }
                    }

                    if (!Array.isArray(stage.challenge_goals) || stage.challenge_goals.length === 0) {
                      errors.push({ path: `${sPath}.challenge_goals`, message: 'Stage must contain challenge_goals' });
                    } else {
                      const goalOrdersSeen = new Set<number>();
                      stage.challenge_goals.forEach((goal, gIdx) => {
                        const gPath = `${sPath}.challenge_goals[${gIdx}]`;
                        if (!Number.isInteger(goal.goal_order) || goal.goal_order <= 0) {
                          errors.push({ path: `${gPath}.goal_order`, message: 'goal_order must be a positive integer' });
                        } else {
                          if (goalOrdersSeen.has(goal.goal_order)) {
                            errors.push({ path: `${gPath}.goal_order`, message: `Duplicate goal_order in stage: ${goal.goal_order}` });
                          }
                          goalOrdersSeen.add(goal.goal_order);
                        }

                        if (!Number.isInteger(goal.target_time_seconds) || goal.target_time_seconds < 0) {
                          errors.push({ path: `${gPath}.target_time_seconds`, message: 'target_time_seconds must be a non-negative integer (>= 0)' });
                        }
                      });
                    }

                    if (!Array.isArray(stage.waves) || stage.waves.length === 0) {
                      errors.push({ path: `${sPath}.waves`, message: 'Stage must contain at least one wave' });
                    } else {
                      const waveIndicesSeen = new Set<number>();
                      stage.waves.forEach((wave, wIdx) => {
                        const wPath = `${sPath}.waves[${wIdx}]`;
                        if (!Number.isInteger(wave.wave_index) || wave.wave_index <= 0) {
                          errors.push({ path: `${wPath}.wave_index`, message: 'wave_index must be a positive integer' });
                        } else {
                          if (waveIndicesSeen.has(wave.wave_index)) {
                            errors.push({ path: `${wPath}.wave_index`, message: `Duplicate wave_index in stage: ${wave.wave_index}` });
                          }
                          waveIndicesSeen.add(wave.wave_index);
                        }

                        if (!Array.isArray(wave.enemy_instances) || wave.enemy_instances.length === 0) {
                          errors.push({ path: `${wPath}.enemy_instances`, message: 'Wave must contain at least one enemy instance' });
                        } else {
                          const spawnOrdersSeen = new Set<number>();
                          wave.enemy_instances.forEach((inst, iIdx) => {
                            const iPath = `${wPath}.enemy_instances[${iIdx}]`;
                            const enemyKnown = dataset.enemies?.some(e => e.code === inst.enemy_code);
                            if (!enemyKnown) {
                              errors.push({ path: `${iPath}.enemy_code`, message: `Unknown enemy_code: ${inst.enemy_code}` });
                            }

                            if (!Number.isInteger(inst.level) || inst.level < 1 || inst.level > 120) {
                              errors.push({ path: `${iPath}.level`, message: 'Enemy instance level must be between 1 and 120' });
                            }

                            if (!Number.isInteger(inst.spawn_order) || inst.spawn_order <= 0) {
                              errors.push({ path: `${iPath}.spawn_order`, message: 'spawn_order must be a positive integer' });
                            } else {
                              if (spawnOrdersSeen.has(inst.spawn_order)) {
                                errors.push({ path: `${iPath}.spawn_order`, message: `Duplicate spawn_order in wave: ${inst.spawn_order}` });
                              }
                              spawnOrdersSeen.add(inst.spawn_order);
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
