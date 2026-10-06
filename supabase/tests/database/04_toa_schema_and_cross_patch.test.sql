-- ============================================================================
-- pgTAP Test Suite 4: ToA Composite PK & Cross-Patch Coexistence
-- File: supabase/tests/database/04_toa_schema_and_cross_patch.test.sql
-- Run:  supabase test db
-- ============================================================================

BEGIN;
SELECT plan(6);

-- ----------------------------------------------------------------------------
-- 1. Schema Constraints
-- ----------------------------------------------------------------------------
-- Test 1: Verify toa_cycles has composite primary key (id, patch_id)
SELECT col_is_pk(
  'public',
  'toa_cycles',
  ARRAY['id', 'patch_id'],
  'toa_cycles primary key is composite (id, patch_id)'
);

-- Test 2: Verify challenge_goals allows target_time_seconds = 0 (completion goal)
-- Prepare fixtures
INSERT INTO public.patches (id, version, release_date)
VALUES 
  ('11111111-3737-3737-3737-111111111111', '3.7-test', '2026-09-30'),
  ('11111111-3636-3636-3636-111111111111', '3.6-test', '2026-08-20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.toa_cycles (id, patch_id, cycle_name, start_time, end_time)
VALUES 
  ('40404040-4040-4040-4040-404040404040', '11111111-3737-3737-3737-111111111111', 'Season 40 (3.7)', '2026-09-14 04:00:00+08', '2026-10-12 03:59:59+08')
ON CONFLICT (id, patch_id) DO NOTHING;

INSERT INTO public.toa_zones (id, cycle_id, patch_id, zone_type)
VALUES ('00000003-4040-4040-4040-000000000001', '40404040-4040-4040-4040-404040404040', '11111111-3737-3737-3737-111111111111', 'HazardZone')
ON CONFLICT (id, patch_id) DO NOTHING;

INSERT INTO public.toa_towers (id, zone_id, patch_id, tower_name, tower_order)
VALUES ('00000004-4040-4040-4040-000000000001', '00000003-4040-4040-4040-000000000001', '11111111-3737-3737-3737-111111111111', 'Resonant Tower', 1)
ON CONFLICT (id, patch_id) DO NOTHING;

INSERT INTO public.toa_stages (id, tower_id, patch_id, stage_index, vigor_cost)
VALUES ('00000005-4040-4040-4040-000000000001', '00000004-4040-4040-4040-000000000001', '11111111-3737-3737-3737-111111111111', 1, 1)
ON CONFLICT (id, patch_id) DO NOTHING;

SELECT lives_ok(
  $$INSERT INTO public.challenge_goals (stage_id, patch_id, goal_order, target_time_seconds, points)
    VALUES ('00000005-4040-4040-4040-000000000001', '11111111-3737-3737-3737-111111111111', 1, 0, 1)$$,
  'challenge_goals permits target_time_seconds = 0 for completion-only goals'
);

-- Test 3: Verify challenge_goals still rejects negative values
SELECT throws_ok(
  $$INSERT INTO public.challenge_goals (stage_id, patch_id, goal_order, target_time_seconds, points)
    VALUES ('00000005-4040-4040-4040-000000000001', '11111111-3737-3737-3737-111111111111', 2, -10, 1)$$,
  '23514',
  NULL,
  'challenge_goals rejects negative target_time_seconds'
);

-- ----------------------------------------------------------------------------
-- 2. Logical Rotation Coexistence Across Patches
-- ----------------------------------------------------------------------------
-- Test 4: Same logical cycle ID can coexist in Patch 3.6 snapshot
SELECT lives_ok(
  $$INSERT INTO public.toa_cycles (id, patch_id, cycle_name, start_time, end_time)
    VALUES ('40404040-4040-4040-4040-404040404040', '11111111-3636-3636-3636-111111111111', 'Season 40 (3.6)', '2026-09-14 04:00:00+08', '2026-10-12 03:59:59+08')$$,
  'Same logical cycle ID can exist simultaneously under Patch 3.6 without collision'
);

-- Test 5: Verify exact row count of 2 snapshots for this logical cycle ID
SELECT results_eq(
  $$SELECT count(*)::integer FROM public.toa_cycles WHERE id = '40404040-4040-4040-4040-404040404040'$$,
  $$VALUES (2)$$,
  'Exactly 2 snapshots exist for the single logical cycle ID'
);

-- Test 6: Verify duplicate (id, patch_id) is rejected by composite PK
SELECT throws_ok(
  $$INSERT INTO public.toa_cycles (id, patch_id, cycle_name, start_time, end_time)
    VALUES ('40404040-4040-4040-4040-404040404040', '11111111-3737-3737-3737-111111111111', 'Season 40 Dup', '2026-09-14 04:00:00+08', '2026-10-12 03:59:59+08')$$,
  '23505',
  NULL,
  'Duplicate (id, patch_id) is rejected by composite primary key'
);

SELECT * FROM finish();
ROLLBACK;
