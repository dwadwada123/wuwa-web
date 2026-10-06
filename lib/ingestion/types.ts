/**
 * Wuthering Waves Patch-Aware Deterministic Ingestion Engine
 * Domain Types & Schemas
 */

export type Element = 'Glacio' | 'Fusion' | 'Electro' | 'Aero' | 'Spectro' | 'Havoc';

export type WeaponType = 'Broadblade' | 'Sword' | 'Pistols' | 'Gauntlets' | 'Rectifier';

export type Rarity = 4 | 5;

export type SourceType =
  | 'OFFICIAL_PUBLISHED'
  | 'OFFICIAL_DATAMINE'
  | 'COMMUNITY_DATAMINE'
  | 'LIVE_OBSERVATION'
  | 'COMMUNITY_VERIFIED';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type Classification = 'CORE_MECHANIC' | 'DAMAGE_FORMULA' | 'TOA_STAGE_DATA' | 'SUBSTAT_CURVE';

export type ProvenanceStatus = 'ACTIVE' | 'SUPERSEDED' | 'DISPUTED';

export type AbilityCategory =
  | 'NormalAttack'
  | 'ResonanceSkill'
  | 'ForteCircuit'
  | 'ResonanceLiberation'
  | 'IntroSkill'
  | 'OutroSkill'
  | 'InherentSkill'
  | 'CombatPassive';

export type AbilityStatus = 'ACTIVE' | 'REWORKED' | 'DEPRECATED';

export type GameplayEffectCategory =
  | 'STAT_BUFF'
  | 'DMG_AMPLIFY'
  | 'COORDINATED_ATTACK'
  | 'DEF_SHRED'
  | 'RES_SHRED'
  | 'HEALING'
  | 'SHIELD'
  | 'SPECIAL_MECHANIC'
  | 'RESOURCE_GRANT'
  | 'STATE_CHANGE';

export type GameplayEffectTarget =
  | 'SELF'
  | 'ACTIVE_CHARACTER'
  | 'NEXT_RESONATOR'
  | 'TEAM'
  | 'ENEMY';

export interface PatchInput {
  version: string;
  release_date: string; // ISO date 'YYYY-MM-DD'
  notes?: string | null;
  provenance_source_name: string;
}

export interface ProvenanceSourceInput {
  source_name: string;
  url?: string | null;
  source_type: SourceType;
  verification_date: string; // ISO date 'YYYY-MM-DD'
  confidence: Confidence;
  classification: Classification;
  status: ProvenanceStatus;
}

export interface FunctionalRoleInput {
  code: string;
  label: string;
  description?: string | null;
}

export interface CombatTagInput {
  code: string;
  label: string;
  description?: string | null;
}

export interface GameplayEffectInput {
  category: GameplayEffectCategory;
  target: GameplayEffectTarget;
  condition_expression?: Record<string, unknown>;
  detail_expression?: Record<string, unknown>;
  provenance_source_name: string;
  effect_order?: number;
}

export interface AbilityInput {
  ability_code: string;
  ability_category: AbilityCategory;
  name: string;
  description?: string | null;
  cooldown_seconds?: number | null;
  energy_cost?: number | null;
  concertos_generated: number;
  status?: AbilityStatus;
  provenance_source_name: string;
  effects?: GameplayEffectInput[];
}

export interface ResonatorRoleAssignment {
  code: string;
  is_primary: boolean;
}

export interface ResonatorPatchDataInput {
  base_hp_lvl90: number;
  base_atk_lvl90: number;
  base_def_lvl90: number;
  provenance_source_name: string;
  roles: ResonatorRoleAssignment[];
  combat_tags: string[]; // array of combat_tags codes
}

export interface ResonatorInput {
  name: string;
  element: Element;
  weapon_type: WeaponType;
  rarity: Rarity;
  release_date: string; // ISO date 'YYYY-MM-DD'
  patch_data: ResonatorPatchDataInput;
  abilities: AbilityInput[];
}

export interface WeaponPatchDataInput {
  base_atk_lvl90: number;
  sub_stat_type: string;
  sub_stat_value_lvl90: number;
  passive_effect?: GameplayEffectInput | null;
  provenance_source_name: string;
}

export interface WeaponInput {
  name: string;
  weapon_type: WeaponType;
  rarity: 3 | 4 | 5;
  patch_data: WeaponPatchDataInput;
}

export type EchoClassType = 'Calamity' | 'Overlord' | 'Elite' | 'Common';
export type EchoCost = 1 | 3 | 4;

export interface EchoPatchDataInput {
  cost: EchoCost;
  cd_seconds?: number;
  concertos_generated?: number;
  skill_effect?: GameplayEffectInput | null;
  provenance_source_name: string;
}

export interface EchoInput {
  name: string;
  class_type: EchoClassType;
  cost: EchoCost;
  patch_data: EchoPatchDataInput;
}

export interface SonataPatchDataInput {
  two_piece_effect: GameplayEffectInput;
  five_piece_effect: GameplayEffectInput;
  provenance_source_name: string;
}

export interface SonataInput {
  name: string;
  code: string;
  description?: string | null;
  patch_data: SonataPatchDataInput;
}

export interface PatchDataset {
  patch: PatchInput;
  provenance_sources: ProvenanceSourceInput[];
  functional_roles: FunctionalRoleInput[];
  combat_tags: CombatTagInput[];
  resonators: ResonatorInput[];
  weapons?: WeaponInput[];
  echoes?: EchoInput[];
  sonatas?: SonataInput[];
}

export interface IngestionCounts {
  patches: number;
  provenanceSources: number;
  functionalRoles: number;
  combatTags: number;
  resonators: number;
  resonatorPatchData: number;
  resonatorRoles: number;
  resonatorCombatTags: number;
  abilities: number;
  abilityPatchData: number;
  gameplayEffects: number;
  abilityEffects: number;
  weapons: number;
  weaponPatchData: number;
  echoes: number;
  echoPatchData: number;
  sonatas: number;
  sonataPatchData: number;
}

export interface IngestionReport {
  success: boolean;
  counts: IngestionCounts;
  patchVersion: string;
  provenanceSourcesUsed: string[];
  externalSources: string[];
  omissions: string[];
  durationMs: number;
}
