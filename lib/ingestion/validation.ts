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

  return {
    isValid: errors.length === 0,
    errors
  };
}
