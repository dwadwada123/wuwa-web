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
  GameplayEffectTarget
} from './types';

export const VALID_ELEMENTS = new Set<Element>([
  'Glacio',
  'Fusion',
  'Electro',
  'Aero',
  'Spectro',
  'Havoc'
]);

export const VALID_WEAPON_TYPES = new Set<WeaponType>([
  'Broadblade',
  'Sword',
  'Pistols',
  'Gauntlets',
  'Rectifier'
]);

export const VALID_RARITIES = new Set<Rarity>([4, 5]);

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
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
