-- ============================================================================
-- pgTAP Test Suite 1: Table Structure & Patch-Version Integrity
-- File: supabase/tests/database/01_tables_and_patch_integrity.test.sql
-- Run:  supabase test db
-- ============================================================================

BEGIN;
SELECT plan(36);

-- ----------------------------------------------------------------------------
-- Part 1: Verify all 33 Tables Exist
-- ----------------------------------------------------------------------------
SELECT has_table('public', 'patches', 'Table patches exists');
SELECT has_table('public', 'provenance_sources', 'Table provenance_sources exists');
SELECT has_table('public', 'functional_roles', 'Table functional_roles exists');
SELECT has_table('public', 'combat_tags', 'Table combat_tags exists');
SELECT has_table('public', 'resonators', 'Table resonators exists');
SELECT has_table('public', 'resonator_patch_data', 'Table resonator_patch_data exists');
SELECT has_table('public', 'resonator_roles', 'Table resonator_roles exists');
SELECT has_table('public', 'resonator_combat_tags', 'Table resonator_combat_tags exists');
SELECT has_table('public', 'abilities', 'Table abilities exists');
SELECT has_table('public', 'ability_patch_data', 'Table ability_patch_data exists');
SELECT has_table('public', 'gameplay_effects', 'Table gameplay_effects exists');
SELECT has_table('public', 'ability_effects', 'Table ability_effects exists');
SELECT has_table('public', 'weapons', 'Table weapons exists');
SELECT has_table('public', 'weapon_patch_data', 'Table weapon_patch_data exists');
SELECT has_table('public', 'echoes', 'Table echoes exists');
SELECT has_table('public', 'echo_patch_data', 'Table echo_patch_data exists');
SELECT has_table('public', 'sonatas', 'Table sonatas exists');
SELECT has_table('public', 'sonata_patch_data', 'Table sonata_patch_data exists');
SELECT has_table('public', 'enemies', 'Table enemies exists');
SELECT has_table('public', 'enemy_resistances', 'Table enemy_resistances exists');
SELECT has_table('public', 'enemy_modifiers', 'Table enemy_modifiers exists');
SELECT has_table('public', 'area_effects', 'Table area_effects exists');
SELECT has_table('public', 'toa_cycles', 'Table toa_cycles exists');
SELECT has_table('public', 'toa_zones', 'Table toa_zones exists');
SELECT has_table('public', 'toa_towers', 'Table toa_towers exists');
SELECT has_table('public', 'toa_stages', 'Table toa_stages exists');
SELECT has_table('public', 'stage_area_effects', 'Table stage_area_effects exists');
SELECT has_table('public', 'challenge_goals', 'Table challenge_goals exists');
SELECT has_table('public', 'toa_waves', 'Table toa_waves exists');
SELECT has_table('public', 'toa_enemy_instances', 'Table toa_enemy_instances exists');
SELECT has_table('public', 'user_weapons', 'Table user_weapons exists');
SELECT has_table('public', 'user_resonators', 'Table user_resonators exists');
SELECT has_table('public', 'user_resonator_loadouts', 'Table user_resonator_loadouts exists');

-- ----------------------------------------------------------------------------
-- Part 2: Seed Patch Test Fixtures (as service_role / postgres)
-- All UUID literals use valid hexadecimal digits [0-9a-f]
-- ----------------------------------------------------------------------------
INSERT INTO public.patches (id, version, release_date) VALUES
  ('11111111-1111-1111-1111-111111111111', '3.7', '2026-09-30'),
  ('22222222-2222-2222-2222-222222222222', '3.8', '2026-11-15')
ON CONFLICT (id) DO NOTHING;

-- Gameplay effect in patch 3.7
INSERT INTO public.gameplay_effects (id, patch_id, category, target, condition_expression, detail_expression)
VALUES (
  'eeeeeeee-3737-3737-3737-373737373737',
  '11111111-1111-1111-1111-111111111111',
  'STAT_BUFF',
  'SELF',
  '{}'::jsonb,
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Weapon invariant
INSERT INTO public.weapons (id, name, weapon_type, rarity)
VALUES ('00000001-0000-0000-0000-000000000001', 'Test Sword Integrity', 'Sword', 5)
ON CONFLICT (id) DO NOTHING;

-- Resonator & Ability invariant
INSERT INTO public.resonators (id, name, element, weapon_type, rarity, release_date)
VALUES ('00000002-0000-0000-0000-000000000001', 'Test Hero Integrity', 'Electro', 'Sword', 5, '2026-09-30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.abilities (id, resonator_id, ability_code, ability_category)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 'test_skill', 'ResonanceSkill')
ON CONFLICT (id) DO NOTHING;

-- Ability patch data in patch 3.8
INSERT INTO public.ability_patch_data (id, ability_id, patch_id, name)
VALUES (
  'bbbbbbbb-3838-3838-3838-383838383838',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'Test Skill 3.8'
) ON CONFLICT (id) DO NOTHING;

-- ToA 3.7 Stage hierarchy fixtures
INSERT INTO public.toa_cycles (id, patch_id, cycle_name, start_time, end_time)
VALUES ('cccccccc-3737-3737-3737-373737373737', '11111111-1111-1111-1111-111111111111', 'Cycle 3.7', now(), now() + interval '14 days')
ON CONFLICT (id, patch_id) DO NOTHING;

INSERT INTO public.toa_zones (id, cycle_id, patch_id, zone_type)
VALUES ('00000003-3737-3737-3737-000000000001', 'cccccccc-3737-3737-3737-373737373737', '11111111-1111-1111-1111-111111111111', 'HazardZone')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.toa_towers (id, zone_id, patch_id, tower_name, tower_order)
VALUES ('00000004-3737-3737-3737-000000000001', '00000003-3737-3737-3737-000000000001', '11111111-1111-1111-1111-111111111111', 'Central Tower', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.toa_stages (id, tower_id, patch_id, stage_index, vigor_cost)
VALUES ('00000005-3737-3737-3737-000000000001', '00000004-3737-3737-3737-000000000001', '11111111-1111-1111-1111-111111111111', 1, 1)
ON CONFLICT (id) DO NOTHING;

-- Area effect in patch 3.8
INSERT INTO public.gameplay_effects (id, patch_id, category, target, condition_expression, detail_expression)
VALUES ('eeeeeeee-3838-3838-3838-383838383838', '22222222-2222-2222-2222-222222222222', 'DMG_AMPLIFY', 'TEAM', '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.area_effects (id, patch_id, effect_id, name, description)
VALUES ('ffffffff-3838-3838-3838-383838383838', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-3838-3838-3838-383838383838', 'Floor 3.8 Buff', 'Desc')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Part 3: Test Patch-Version Composite Foreign Key Enforcements
-- ----------------------------------------------------------------------------
-- Test 34: 3.8 weapon cannot reference 3.7 gameplay effect
SELECT throws_ok(
  $$INSERT INTO public.weapon_patch_data (weapon_id, patch_id, base_atk_lvl90, sub_stat_type, sub_stat_value_lvl90, passive_effect_id)
    VALUES (
      '00000001-0000-0000-0000-000000000001',
      '22222222-2222-2222-2222-222222222222', -- patch 3.8
      587.00,
      'CritRate',
      0.2430,
      'eeeeeeee-3737-3737-3737-373737373737'  -- patch 3.7 effect!
    )$$,
  '23503',
  NULL,
  'Patch mismatch between weapon_patch_data and gameplay_effects is rejected by composite foreign key'
);

-- Test 35: 3.8 ability cannot reference 3.7 gameplay effect
SELECT throws_ok(
  $$INSERT INTO public.ability_effects (ability_patch_id, patch_id, effect_id, effect_order)
    VALUES (
      'bbbbbbbb-3838-3838-3838-383838383838', -- patch 3.8
      '22222222-2222-2222-2222-222222222222', -- patch 3.8
      'eeeeeeee-3737-3737-3737-373737373737', -- patch 3.7 effect!
      1
    )$$,
  '23503',
  NULL,
  'Patch mismatch between ability_patch_data and gameplay_effects is rejected by composite foreign key'
);

-- Test 36: 3.7 ToA stage cannot reference 3.8 area effect
SELECT throws_ok(
  $$INSERT INTO public.stage_area_effects (stage_id, area_effect_id, patch_id, effect_order)
    VALUES (
      '00000005-3737-3737-3737-000000000001', -- patch 3.7
      'ffffffff-3838-3838-3838-383838383838', -- patch 3.8 area effect!
      '11111111-1111-1111-1111-111111111111', -- patch 3.7
      1
    )$$,
  '23503',
  NULL,
  'Patch mismatch between toa_stages and area_effects is rejected by composite foreign key'
);

SELECT * FROM finish();
ROLLBACK;
