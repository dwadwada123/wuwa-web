-- ============================================================================
-- WUTHERING WAVES 3.7 TOA OPTIMIZER — DATABASE DDL BLUEPRINT
-- Postgres 15+ / Supabase Schema (33 Tables Finalized)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Phase 1: Security Setup & Default Privilege Lockdown
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Revoke all implicit public grants on future objects created by postgres
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC;

-- ----------------------------------------------------------------------------
-- Phase 2: Core Patches & Provenance Sources
-- ----------------------------------------------------------------------------
-- Table 1: patches
CREATE TABLE IF NOT EXISTS public.patches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  release_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table 2: provenance_sources
CREATE TABLE IF NOT EXISTS public.provenance_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  url text,
  source_type text NOT NULL CHECK (source_type IN ('OFFICIAL_DATAMINE', 'LIVE_OBSERVATION', 'COMMUNITY_VERIFIED')),
  verification_date date NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  classification text NOT NULL CHECK (classification IN ('CORE_MECHANIC', 'DAMAGE_FORMULA', 'TOA_STAGE_DATA', 'SUBSTAT_CURVE')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'DISPUTED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Phase 3: Taxonomies, Resonators & Roles (Historical Immutability)
-- ----------------------------------------------------------------------------
-- Table 3: functional_roles
CREATE TABLE IF NOT EXISTS public.functional_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  description text
);

-- Table 4: combat_tags
CREATE TABLE IF NOT EXISTS public.combat_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  description text
);

-- Table 5: resonators
CREATE TABLE IF NOT EXISTS public.resonators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  element text NOT NULL CHECK (element IN ('Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc')),
  weapon_type text NOT NULL CHECK (weapon_type IN ('Broadblade', 'Sword', 'Pistols', 'Gauntlets', 'Rectifier')),
  rarity int NOT NULL CHECK (rarity IN (4, 5)),
  release_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table 6: resonator_patch_data
CREATE TABLE IF NOT EXISTS public.resonator_patch_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resonator_id uuid NOT NULL REFERENCES public.resonators(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  base_hp_lvl90 numeric(8,2) NOT NULL CHECK (base_hp_lvl90 > 0),
  base_atk_lvl90 numeric(8,2) NOT NULL CHECK (base_atk_lvl90 > 0),
  base_def_lvl90 numeric(8,2) NOT NULL CHECK (base_def_lvl90 > 0),
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resonator_patch_data_unique UNIQUE (resonator_id, patch_id),
  CONSTRAINT resonator_patch_data_patch_key UNIQUE (id, patch_id)
);

-- Table 7: resonator_roles
CREATE TABLE IF NOT EXISTS public.resonator_roles (
  resonator_patch_id uuid NOT NULL REFERENCES public.resonator_patch_data(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES public.functional_roles(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (resonator_patch_id, role_id)
);

-- Table 8: resonator_combat_tags
CREATE TABLE IF NOT EXISTS public.resonator_combat_tags (
  resonator_patch_id uuid NOT NULL REFERENCES public.resonator_patch_data(id) ON DELETE RESTRICT,
  tag_id uuid NOT NULL REFERENCES public.combat_tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (resonator_patch_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- Phase 4: Patch-Aware Abilities & Gameplay Effects
-- ----------------------------------------------------------------------------
-- Table 9: abilities
CREATE TABLE IF NOT EXISTS public.abilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resonator_id uuid NOT NULL REFERENCES public.resonators(id) ON DELETE RESTRICT,
  ability_code text NOT NULL,
  ability_category text NOT NULL CHECK (ability_category IN (
    'NormalAttack', 'ResonanceSkill', 'ForteCircuit', 'ResonanceLiberation',
    'IntroSkill', 'OutroSkill', 'InherentSkill', 'CombatPassive'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT abilities_resonator_code_unique UNIQUE (resonator_id, ability_code)
);

-- Table 10: ability_patch_data
CREATE TABLE IF NOT EXISTS public.ability_patch_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ability_id uuid NOT NULL REFERENCES public.abilities(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  cooldown_seconds numeric(5,2) CHECK (cooldown_seconds >= 0),
  energy_cost numeric(6,2) CHECK (energy_cost >= 0),
  concertos_generated numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (concertos_generated >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REWORKED', 'DEPRECATED')),
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ability_patch_data_unique UNIQUE (ability_id, patch_id),
  CONSTRAINT ability_patch_data_patch_key UNIQUE (id, patch_id)
);

-- Table 11: gameplay_effects
CREATE TABLE IF NOT EXISTS public.gameplay_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN (
    'STAT_BUFF', 'DMG_AMPLIFY', 'COORDINATED_ATTACK', 'DEF_SHRED',
    'RES_SHRED', 'HEALING', 'SHIELD', 'SPECIAL_MECHANIC',
    'RESOURCE_GRANT', 'STATE_CHANGE'
  )),
  target text NOT NULL CHECK (target IN (
    'SELF', 'ACTIVE_CHARACTER', 'NEXT_RESONATOR', 'TEAM', 'ENEMY'
  )),
  condition_expression jsonb NOT NULL DEFAULT '{}'::jsonb,
  detail_expression jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gameplay_effects_patch_key UNIQUE (id, patch_id)
);

-- Table 12: ability_effects
CREATE TABLE IF NOT EXISTS public.ability_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ability_patch_id uuid NOT NULL,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  effect_id uuid NOT NULL,
  effect_order int NOT NULL DEFAULT 1 CHECK (effect_order > 0),
  CONSTRAINT ability_effects_order_unique UNIQUE (ability_patch_id, effect_order),
  CONSTRAINT ability_effects_ability_patch_fkey FOREIGN KEY (ability_patch_id, patch_id)
    REFERENCES public.ability_patch_data(id, patch_id) ON DELETE RESTRICT,
  CONSTRAINT ability_effects_gameplay_effect_fkey FOREIGN KEY (effect_id, patch_id)
    REFERENCES public.gameplay_effects(id, patch_id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- Phase 5: Weapons, Echoes & Sonatas (Patch-Versioned)
-- ----------------------------------------------------------------------------
-- Table 13: weapons
CREATE TABLE IF NOT EXISTS public.weapons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  weapon_type text NOT NULL CHECK (weapon_type IN ('Broadblade', 'Sword', 'Pistols', 'Gauntlets', 'Rectifier')),
  rarity int NOT NULL CHECK (rarity IN (3, 4, 5)),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table 14: weapon_patch_data
CREATE TABLE IF NOT EXISTS public.weapon_patch_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weapon_id uuid NOT NULL REFERENCES public.weapons(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  base_atk_lvl90 numeric(8,2) NOT NULL CHECK (base_atk_lvl90 > 0),
  sub_stat_type text NOT NULL,
  sub_stat_value_lvl90 numeric(8,4) NOT NULL CHECK (sub_stat_value_lvl90 > 0),
  passive_effect_id uuid,
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weapon_patch_data_unique UNIQUE (weapon_id, patch_id),
  CONSTRAINT weapon_patch_effect_fkey FOREIGN KEY (passive_effect_id, patch_id)
    REFERENCES public.gameplay_effects(id, patch_id) ON DELETE RESTRICT
);

-- Table 15: echoes
CREATE TABLE IF NOT EXISTS public.echoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  class_type text NOT NULL CHECK (class_type IN ('Calamity', 'Overlord', 'Elite', 'Common')),
  cost int NOT NULL CHECK (cost IN (1, 3, 4)),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table 16: echo_patch_data
CREATE TABLE IF NOT EXISTS public.echo_patch_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id uuid NOT NULL REFERENCES public.echoes(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  cost int NOT NULL CHECK (cost IN (1, 3, 4)),
  skill_effect_id uuid,
  cd_seconds numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (cd_seconds >= 0),
  concertos_generated numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (concertos_generated >= 0),
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT echo_patch_data_unique UNIQUE (echo_id, patch_id),
  CONSTRAINT echo_patch_effect_fkey FOREIGN KEY (skill_effect_id, patch_id)
    REFERENCES public.gameplay_effects(id, patch_id) ON DELETE RESTRICT
);

-- Table 17: sonatas
CREATE TABLE IF NOT EXISTS public.sonatas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table 18: sonata_patch_data
CREATE TABLE IF NOT EXISTS public.sonata_patch_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sonata_id uuid NOT NULL REFERENCES public.sonatas(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  two_piece_effect_id uuid NOT NULL,
  five_piece_effect_id uuid NOT NULL,
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sonata_patch_data_unique UNIQUE (sonata_id, patch_id),
  CONSTRAINT sonata_patch_two_piece_fkey FOREIGN KEY (two_piece_effect_id, patch_id)
    REFERENCES public.gameplay_effects(id, patch_id) ON DELETE RESTRICT,
  CONSTRAINT sonata_patch_five_piece_fkey FOREIGN KEY (five_piece_effect_id, patch_id)
    REFERENCES public.gameplay_effects(id, patch_id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- Phase 6: Enemies, Resistances & Modifiers
-- ----------------------------------------------------------------------------
-- Table 19: enemies
CREATE TABLE IF NOT EXISTS public.enemies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enemy_class text NOT NULL CHECK (enemy_class IN ('Common', 'Elite', 'Overlord', 'Calamity')),
  code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table 20: enemy_resistances
CREATE TABLE IF NOT EXISTS public.enemy_resistances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enemy_id uuid NOT NULL REFERENCES public.enemies(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  element text NOT NULL CHECK (element IN ('Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'Physical')),
  resistance_ratio numeric(5,4) NOT NULL CHECK (resistance_ratio BETWEEN -1.0000 AND 2.0000),
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enemy_resistances_unique UNIQUE (enemy_id, patch_id, element)
);

-- Table 21: enemy_modifiers
CREATE TABLE IF NOT EXISTS public.enemy_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enemy_id uuid NOT NULL REFERENCES public.enemies(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  modifier_type text NOT NULL CHECK (modifier_type IN ('SHIELD_BAR', 'ENRAGE_RESISTANCE', 'DAMAGE_IMMUNITY', 'STAT_SCALING')),
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enemy_modifiers_unique UNIQUE (enemy_id, patch_id, modifier_type)
);

-- ----------------------------------------------------------------------------
-- Phase 7: Tower of Adversity Hierarchy & Stages
-- ----------------------------------------------------------------------------
-- Table 22: area_effects
CREATE TABLE IF NOT EXISTS public.area_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  effect_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT area_effects_patch_key UNIQUE (id, patch_id),
  CONSTRAINT area_effects_gameplay_effect_fkey FOREIGN KEY (effect_id, patch_id)
    REFERENCES public.gameplay_effects(id, patch_id) ON DELETE RESTRICT
);

-- Table 23: toa_cycles
CREATE TABLE IF NOT EXISTS public.toa_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  cycle_name text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toa_cycles_patch_key UNIQUE (id, patch_id)
);

-- Table 24: toa_zones (StableZone, ExperimentalZone, HazardZone)
CREATE TABLE IF NOT EXISTS public.toa_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  patch_id uuid NOT NULL,
  zone_type text NOT NULL CHECK (zone_type IN ('StableZone', 'ExperimentalZone', 'HazardZone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toa_zones_patch_key UNIQUE (id, patch_id),
  CONSTRAINT toa_zones_cycle_fkey FOREIGN KEY (cycle_id, patch_id)
    REFERENCES public.toa_cycles(id, patch_id) ON DELETE RESTRICT
);

-- Table 25: toa_towers
CREATE TABLE IF NOT EXISTS public.toa_towers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL,
  patch_id uuid NOT NULL,
  tower_name text NOT NULL,
  tower_order int NOT NULL CHECK (tower_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toa_towers_patch_key UNIQUE (id, patch_id),
  CONSTRAINT toa_towers_order_unique UNIQUE (zone_id, tower_order),
  CONSTRAINT toa_towers_zone_fkey FOREIGN KEY (zone_id, patch_id)
    REFERENCES public.toa_zones(id, patch_id) ON DELETE RESTRICT
);

-- Table 26: toa_stages (generic positive stage_index and vigor_cost)
CREATE TABLE IF NOT EXISTS public.toa_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id uuid NOT NULL,
  patch_id uuid NOT NULL,
  stage_index int NOT NULL CHECK (stage_index > 0),
  vigor_cost int NOT NULL CHECK (vigor_cost > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toa_stages_patch_key UNIQUE (id, patch_id),
  CONSTRAINT toa_stages_tower_index_unique UNIQUE (tower_id, stage_index),
  CONSTRAINT toa_stages_tower_fkey FOREIGN KEY (tower_id, patch_id)
    REFERENCES public.toa_towers(id, patch_id) ON DELETE RESTRICT
);

-- Table 27: stage_area_effects
CREATE TABLE IF NOT EXISTS public.stage_area_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  area_effect_id uuid NOT NULL,
  patch_id uuid NOT NULL,
  effect_order int NOT NULL DEFAULT 1 CHECK (effect_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stage_area_effects_order_unique UNIQUE (stage_id, effect_order),
  CONSTRAINT stage_area_effects_membership_unique UNIQUE (stage_id, area_effect_id),
  CONSTRAINT stage_area_effects_stage_fkey FOREIGN KEY (stage_id, patch_id)
    REFERENCES public.toa_stages(id, patch_id) ON DELETE RESTRICT,
  CONSTRAINT stage_area_effects_effect_fkey FOREIGN KEY (area_effect_id, patch_id)
    REFERENCES public.area_effects(id, patch_id) ON DELETE RESTRICT
);

-- Table 28: challenge_goals
CREATE TABLE IF NOT EXISTS public.challenge_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  patch_id uuid NOT NULL,
  goal_order int NOT NULL DEFAULT 1 CHECK (goal_order > 0),
  target_time_seconds int NOT NULL CHECK (target_time_seconds > 0),
  points int NOT NULL DEFAULT 1 CHECK (points > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_goals_stage_order_unique UNIQUE (stage_id, goal_order),
  CONSTRAINT challenge_goals_stage_fkey FOREIGN KEY (stage_id, patch_id)
    REFERENCES public.toa_stages(id, patch_id) ON DELETE RESTRICT
);

-- Table 29: toa_waves
CREATE TABLE IF NOT EXISTS public.toa_waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  patch_id uuid NOT NULL,
  wave_index int NOT NULL CHECK (wave_index > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toa_waves_patch_key UNIQUE (id, patch_id),
  CONSTRAINT toa_waves_stage_index_unique UNIQUE (stage_id, wave_index),
  CONSTRAINT toa_waves_stage_fkey FOREIGN KEY (stage_id, patch_id)
    REFERENCES public.toa_stages(id, patch_id) ON DELETE RESTRICT
);

-- Table 30: toa_enemy_instances
CREATE TABLE IF NOT EXISTS public.toa_enemy_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL,
  enemy_id uuid NOT NULL REFERENCES public.enemies(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 120),
  spawn_order int NOT NULL DEFAULT 1 CHECK (spawn_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toa_enemy_instances_spawn_unique UNIQUE (wave_id, spawn_order),
  CONSTRAINT toa_enemy_instances_wave_fkey FOREIGN KEY (wave_id, patch_id)
    REFERENCES public.toa_waves(id, patch_id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- Phase 8: User Inventory & Tenant-Isolated Loadouts
-- ----------------------------------------------------------------------------
-- Table 31: user_weapons (Supports duplicate copies; conservative baseline defaults)
CREATE TABLE IF NOT EXISTS public.user_weapons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weapon_id uuid NOT NULL REFERENCES public.weapons(id) ON DELETE RESTRICT,
  level int NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 90),
  refinement int NOT NULL DEFAULT 1 CHECK (refinement BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_weapons_tenant_key UNIQUE (id, user_id)
);

-- Table 32: user_resonators (Unlocked roster investment; conservative baseline defaults)
CREATE TABLE IF NOT EXISTS public.user_resonators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resonator_id uuid NOT NULL REFERENCES public.resonators(id) ON DELETE RESTRICT,
  level int NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 90),
  waveband int NOT NULL DEFAULT 0 CHECK (waveband BETWEEN 0 AND 6),
  normal_attack_level int NOT NULL DEFAULT 1 CHECK (normal_attack_level BETWEEN 1 AND 10),
  resonance_skill_level int NOT NULL DEFAULT 1 CHECK (resonance_skill_level BETWEEN 1 AND 10),
  forte_circuit_level int NOT NULL DEFAULT 1 CHECK (forte_circuit_level BETWEEN 1 AND 10),
  resonance_liberation_level int NOT NULL DEFAULT 1 CHECK (resonance_liberation_level BETWEEN 1 AND 10),
  intro_skill_level int NOT NULL DEFAULT 1 CHECK (intro_skill_level BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_resonators_user_unique UNIQUE (user_id, resonator_id),
  CONSTRAINT user_resonators_tenant_key UNIQUE (id, user_id)
);

-- Table 33: user_resonator_loadouts (Recorded equipment per Resonator)
CREATE TABLE IF NOT EXISTS public.user_resonator_loadouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_resonator_id uuid NOT NULL,
  weapon_instance_id uuid,
  active_echo_id uuid REFERENCES public.echoes(id) ON DELETE SET NULL,
  sonata_id uuid REFERENCES public.sonatas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_resonator_loadouts_user_resonator_unique UNIQUE (user_id, user_resonator_id),
  CONSTRAINT user_resonator_loadouts_user_resonator_fkey FOREIGN KEY (user_resonator_id, user_id)
    REFERENCES public.user_resonators(id, user_id) ON DELETE CASCADE,
  CONSTRAINT user_resonator_loadouts_weapon_fkey FOREIGN KEY (weapon_instance_id, user_id)
    REFERENCES public.user_weapons(id, user_id) ON DELETE SET NULL
);

-- Invariant: One weapon instance cannot be equipped on two resonators at the same time
CREATE UNIQUE INDEX IF NOT EXISTS user_resonator_loadouts_single_weapon_idx
  ON public.user_resonator_loadouts (user_id, weapon_instance_id)
  WHERE weapon_instance_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Phase 9: Indexes
-- ----------------------------------------------------------------------------
-- Non-leading foreign key lookups
CREATE INDEX IF NOT EXISTS idx_resonator_patch_data_patch_id ON public.resonator_patch_data (patch_id);
CREATE INDEX IF NOT EXISTS idx_resonator_roles_role_id ON public.resonator_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_resonator_combat_tags_tag_id ON public.resonator_combat_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_abilities_resonator_id ON public.abilities (resonator_id);
CREATE INDEX IF NOT EXISTS idx_ability_patch_data_patch_id ON public.ability_patch_data (patch_id);
CREATE INDEX IF NOT EXISTS idx_gameplay_effects_patch_id ON public.gameplay_effects (patch_id);
CREATE INDEX IF NOT EXISTS idx_ability_effects_effect_id ON public.ability_effects (effect_id);
CREATE INDEX IF NOT EXISTS idx_weapon_patch_data_patch_id ON public.weapon_patch_data (patch_id);
CREATE INDEX IF NOT EXISTS idx_echo_patch_data_patch_id ON public.echo_patch_data (patch_id);
CREATE INDEX IF NOT EXISTS idx_sonata_patch_data_patch_id ON public.sonata_patch_data (patch_id);
CREATE INDEX IF NOT EXISTS idx_enemy_resistances_patch_id ON public.enemy_resistances (patch_id);
CREATE INDEX IF NOT EXISTS idx_enemy_modifiers_patch_id ON public.enemy_modifiers (patch_id);
CREATE INDEX IF NOT EXISTS idx_area_effects_patch_id ON public.area_effects (patch_id);
CREATE INDEX IF NOT EXISTS idx_stage_area_effects_area_effect_id ON public.stage_area_effects (area_effect_id);
CREATE INDEX IF NOT EXISTS idx_toa_enemy_instances_enemy_id ON public.toa_enemy_instances (enemy_id);

-- User RLS ownership columns
CREATE INDEX IF NOT EXISTS idx_user_weapons_user_id ON public.user_weapons (user_id);
CREATE INDEX IF NOT EXISTS idx_user_resonators_user_id ON public.user_resonators (user_id);
CREATE INDEX IF NOT EXISTS idx_user_resonator_loadouts_user_id ON public.user_resonator_loadouts (user_id);

-- Mechanical query filters
CREATE INDEX IF NOT EXISTS idx_gameplay_effects_category ON public.gameplay_effects (category);
CREATE INDEX IF NOT EXISTS idx_enemy_modifiers_type ON public.enemy_modifiers (modifier_type);

-- ----------------------------------------------------------------------------
-- Phase 10: Grants & Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- 1. Canonical Game Facts: Read-Only for anon & authenticated
GRANT SELECT ON TABLE
  public.patches,
  public.provenance_sources,
  public.functional_roles,
  public.combat_tags,
  public.resonators,
  public.resonator_patch_data,
  public.resonator_roles,
  public.resonator_combat_tags,
  public.abilities,
  public.ability_patch_data,
  public.gameplay_effects,
  public.ability_effects,
  public.weapons,
  public.weapon_patch_data,
  public.echoes,
  public.echo_patch_data,
  public.sonatas,
  public.sonata_patch_data,
  public.enemies,
  public.enemy_resistances,
  public.enemy_modifiers,
  public.area_effects,
  public.toa_cycles,
  public.toa_zones,
  public.toa_towers,
  public.toa_stages,
  public.stage_area_effects,
  public.challenge_goals,
  public.toa_waves,
  public.toa_enemy_instances
TO anon, authenticated;

-- Revoke write privileges on game facts from client roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE
  public.patches,
  public.provenance_sources,
  public.functional_roles,
  public.combat_tags,
  public.resonators,
  public.resonator_patch_data,
  public.resonator_roles,
  public.resonator_combat_tags,
  public.abilities,
  public.ability_patch_data,
  public.gameplay_effects,
  public.ability_effects,
  public.weapons,
  public.weapon_patch_data,
  public.echoes,
  public.echo_patch_data,
  public.sonatas,
  public.sonata_patch_data,
  public.enemies,
  public.enemy_resistances,
  public.enemy_modifiers,
  public.area_effects,
  public.toa_cycles,
  public.toa_zones,
  public.toa_towers,
  public.toa_stages,
  public.stage_area_effects,
  public.challenge_goals,
  public.toa_waves,
  public.toa_enemy_instances
FROM anon, authenticated, PUBLIC;

-- 2. User Operational Tables: CRUD for authenticated, zero for anon
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.user_weapons,
  public.user_resonators,
  public.user_resonator_loadouts
TO authenticated;

REVOKE ALL ON TABLE
  public.user_weapons,
  public.user_resonators,
  public.user_resonator_loadouts
FROM anon, PUBLIC;

-- 3. Server Ingestion: service_role retains full administrative access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Enable RLS across all 33 public tables
ALTER TABLE public.patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provenance_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.functional_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resonators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resonator_patch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resonator_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resonator_combat_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ability_patch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gameplay_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ability_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_patch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echo_patch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sonatas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sonata_patch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enemies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enemy_resistances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enemy_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toa_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toa_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toa_towers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toa_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_area_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toa_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toa_enemy_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_weapons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_resonators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_resonator_loadouts ENABLE ROW LEVEL SECURITY;

-- 5. Canonical Game Facts: Read-Only Public Access
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'patches', 'provenance_sources', 'functional_roles', 'combat_tags',
    'resonators', 'resonator_patch_data', 'resonator_roles', 'resonator_combat_tags',
    'abilities', 'ability_patch_data', 'gameplay_effects', 'ability_effects',
    'weapons', 'weapon_patch_data', 'echoes', 'echo_patch_data', 'sonatas',
    'sonata_patch_data', 'enemies', 'enemy_resistances', 'enemy_modifiers',
    'area_effects', 'toa_cycles', 'toa_zones', 'toa_towers', 'toa_stages',
    'stage_area_effects', 'challenge_goals', 'toa_waves', 'toa_enemy_instances'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('
      CREATE POLICY "Allow public read on %I"
      ON public.%I
      FOR SELECT
      TO anon, authenticated
      USING (true);
    ', tbl, tbl);
  END LOOP;
END $$;

-- 6. User Weapons Policies
CREATE POLICY "user_weapons_select" ON public.user_weapons
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_weapons_insert" ON public.user_weapons
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_weapons_update" ON public.user_weapons
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_weapons_delete" ON public.user_weapons
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 7. User Resonators Policies
CREATE POLICY "user_resonators_select" ON public.user_resonators
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_resonators_insert" ON public.user_resonators
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_resonators_update" ON public.user_resonators
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_resonators_delete" ON public.user_resonators
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 8. User Resonator Loadouts Policies
CREATE POLICY "user_resonator_loadouts_select" ON public.user_resonator_loadouts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_resonator_loadouts_insert" ON public.user_resonator_loadouts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_resonator_loadouts_update" ON public.user_resonator_loadouts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_resonator_loadouts_delete" ON public.user_resonator_loadouts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
