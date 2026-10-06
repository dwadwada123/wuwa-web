-- ============================================================================
-- pgTAP Test Suite 3: User Inventory, Tenant Isolation & Loadout Invariants
-- File: supabase/tests/database/03_user_data_and_loadouts_rls.test.sql
-- Run:  supabase test db
-- ============================================================================

BEGIN;
SELECT plan(20);

-- ----------------------------------------------------------------------------
-- Part 1: Verify RLS is enabled on all 3 user operational tables
-- ----------------------------------------------------------------------------
SELECT tests.rls_enabled('public', 'user_weapons');
SELECT tests.rls_enabled('public', 'user_resonators');
SELECT tests.rls_enabled('public', 'user_resonator_loadouts');

-- ----------------------------------------------------------------------------
-- Part 2: Setup Test Users & Canonical Fixtures
-- ----------------------------------------------------------------------------
SELECT tests.create_supabase_user('user_alpha', 'alpha@example.com');
SELECT tests.create_supabase_user('user_beta', 'beta@example.com');

-- Seed canonical items as service_role (bypassing RLS)
SELECT tests.authenticate_as_service_role();

INSERT INTO public.weapons (id, name, weapon_type, rarity)
VALUES ('11111111-aaaa-bbbb-cccc-000000000001', 'Emerald of Genesis Test', 'Sword', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.resonators (id, name, element, weapon_type, rarity, release_date)
VALUES
  ('22222222-aaaa-bbbb-cccc-000000000001', 'Suoming Test A', 'Electro', 'Sword', 5, '2026-09-30'),
  ('22222222-aaaa-bbbb-cccc-000000000002', 'Hsin Test B', 'Electro', 'Rectifier', 5, '2026-09-30')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Part 3: User Alpha Operations & Self-Ownership
-- ----------------------------------------------------------------------------
SELECT tests.authenticate_as('user_alpha');

-- Assertion 4: User Alpha can insert own weapon
SELECT lives_ok(
  $$INSERT INTO public.user_weapons (id, user_id, weapon_id, level, refinement)
    VALUES (
      '33333333-aaaa-1111-1111-000000000001',
      tests.get_supabase_uid('user_alpha'),
      '11111111-aaaa-bbbb-cccc-000000000001',
      1,
      1
    )$$,
  'User Alpha can insert own weapon instance'
);

-- Assertion 5: User Alpha cannot insert weapon for User Beta
SELECT throws_ok(
  $$INSERT INTO public.user_weapons (id, user_id, weapon_id, level, refinement)
    VALUES (
      '33333333-aaaa-2222-2222-000000000002',
      tests.get_supabase_uid('user_beta'),
      '11111111-aaaa-bbbb-cccc-000000000001',
      1,
      1
    )$$,
  '42501',
  NULL,
  'User Alpha cannot insert weapon on behalf of User Beta'
);

-- Assertion 6: User Alpha can insert own resonator
SELECT lives_ok(
  $$INSERT INTO public.user_resonators (id, user_id, resonator_id)
    VALUES (
      '44444444-aaaa-1111-1111-000000000001',
      tests.get_supabase_uid('user_alpha'),
      '22222222-aaaa-bbbb-cccc-000000000001'
    )$$,
  'User Alpha can register owned resonator'
);

-- Assertion 7: User Alpha can create loadout equipping own weapon
SELECT lives_ok(
  $$INSERT INTO public.user_resonator_loadouts (user_id, user_resonator_id, weapon_instance_id)
    VALUES (
      tests.get_supabase_uid('user_alpha'),
      '44444444-aaaa-1111-1111-000000000001',
      '33333333-aaaa-1111-1111-000000000001'
    )$$,
  'User Alpha can equip own weapon instance in loadout'
);

-- ----------------------------------------------------------------------------
-- Part 4: Cross-Tenant Isolation (User Beta vs User Alpha)
-- ----------------------------------------------------------------------------
SELECT tests.authenticate_as('user_beta');

-- Assertion 8: User Beta cannot read User Alpha weapons
SELECT is(
  (SELECT count(*)::int FROM public.user_weapons WHERE user_id = tests.get_supabase_uid('user_alpha')),
  0,
  'User Beta selects 0 rows of User Alpha weapons'
);

-- Assertion 9: User Beta attempted UPDATE on User Alpha loadout affects zero rows
SELECT is_empty(
  $$UPDATE public.user_resonator_loadouts
    SET weapon_instance_id = NULL
    WHERE user_id = tests.get_supabase_uid('user_alpha')
    RETURNING 1$$,
  'User Beta attempted update affects zero rows of User Alpha loadout'
);

-- Switch to User Alpha to verify loadout remained intact
SELECT tests.authenticate_as('user_alpha');

-- Assertion 10: Denied update left User Alpha loadout intact
SELECT results_eq(
  $$SELECT weapon_instance_id FROM public.user_resonator_loadouts
    WHERE user_resonator_id = '44444444-aaaa-1111-1111-000000000001'$$,
  ARRAY['33333333-aaaa-1111-1111-000000000001'::uuid],
  'Denied update left User Alpha loadout intact'
);

-- Switch back to User Beta
SELECT tests.authenticate_as('user_beta');

-- Assertion 11: User Beta attempted DELETE on User Alpha resonator affects zero rows
SELECT is_empty(
  $$DELETE FROM public.user_resonators
    WHERE user_id = tests.get_supabase_uid('user_alpha')
    RETURNING 1$$,
  'User Beta attempted delete affects zero rows of User Alpha resonators'
);

-- Switch to User Alpha to verify resonator remained intact
SELECT tests.authenticate_as('user_alpha');

-- Assertion 12: Denied delete left User Alpha resonator intact
SELECT is(
  (SELECT count(*)::int FROM public.user_resonators WHERE id = '44444444-aaaa-1111-1111-000000000001'),
  1,
  'Denied delete left User Alpha resonator intact'
);

-- ----------------------------------------------------------------------------
-- Part 5: Cross-Tenant Foreign Key & Loadout Invariants
-- ----------------------------------------------------------------------------
-- Seed a weapon and a resonator for User Beta as service_role
SELECT tests.authenticate_as_service_role();

INSERT INTO public.user_weapons (id, user_id, weapon_id, level, refinement)
VALUES (
  '33333333-bbbb-2222-2222-000000000002',
  tests.get_supabase_uid('user_beta'),
  '11111111-aaaa-bbbb-cccc-000000000001',
  1,
  1
);

INSERT INTO public.user_resonators (id, user_id, resonator_id)
VALUES (
  '44444444-bbbb-2222-2222-000000000002',
  tests.get_supabase_uid('user_beta'),
  '22222222-aaaa-bbbb-cccc-000000000002'
);

-- Switch to User Alpha
SELECT tests.authenticate_as('user_alpha');

-- Assertion 13: User Alpha cannot equip User Beta weapon instance (composite FK check)
SELECT throws_ok(
  $$UPDATE public.user_resonator_loadouts
    SET weapon_instance_id = '33333333-bbbb-2222-2222-000000000002'
    WHERE user_resonator_id = '44444444-aaaa-1111-1111-000000000001'$$,
  '23503',
  NULL,
  'User Alpha cannot equip User Beta weapon instance in loadout'
);

-- Assertion 14: User Alpha cannot create loadout for User Beta resonator (composite FK check)
SELECT throws_ok(
  $$INSERT INTO public.user_resonator_loadouts (user_id, user_resonator_id, weapon_instance_id)
    VALUES (
      tests.get_supabase_uid('user_alpha'),
      '44444444-bbbb-2222-2222-000000000002', -- User Beta resonator!
      NULL
    )$$,
  '23503',
  NULL,
  'User Alpha cannot create loadout referencing User Beta resonator'
);

-- Seed a second resonator for User Alpha as service_role
SELECT tests.authenticate_as_service_role();
INSERT INTO public.resonators (id, name, element, weapon_type, rarity, release_date)
VALUES ('22222222-aaaa-bbbb-cccc-000000000003', 'Second Hero Alpha', 'Glacio', 'Sword', 4, '2026-09-30')
ON CONFLICT (id) DO NOTHING;

SELECT tests.authenticate_as('user_alpha');
INSERT INTO public.user_resonators (id, user_id, resonator_id)
VALUES (
  '44444444-aaaa-3333-3333-000000000003',
  tests.get_supabase_uid('user_alpha'),
  '22222222-aaaa-bbbb-cccc-000000000003'
);

-- Assertion 15: Same weapon instance cannot be equipped in two loadouts simultaneously (partial unique index)
SELECT throws_ok(
  $$INSERT INTO public.user_resonator_loadouts (user_id, user_resonator_id, weapon_instance_id)
    VALUES (
      tests.get_supabase_uid('user_alpha'),
      '44444444-aaaa-3333-3333-000000000003',
      '33333333-aaaa-1111-1111-000000000001' -- already equipped on resonator 1!
    )$$,
  '23505',
  NULL,
  'Same weapon instance cannot be equipped across two user resonators simultaneously'
);

-- Assertion 16: User Alpha can delete own loadout
SELECT lives_ok(
  $$DELETE FROM public.user_resonator_loadouts
    WHERE user_resonator_id = '44444444-aaaa-1111-1111-000000000001'$$,
  'User Alpha can delete own loadout'
);

-- Assertion 17: User Alpha can delete own resonator
SELECT lives_ok(
  $$DELETE FROM public.user_resonators
    WHERE id = '44444444-aaaa-1111-1111-000000000001'$$,
  'User Alpha can delete own resonator'
);

-- ----------------------------------------------------------------------------
-- Part 6: Unauthenticated Protection (anon role is completely denied)
-- ----------------------------------------------------------------------------
SELECT tests.clear_authentication();

-- Assertion 18: anon cannot select from user_weapons
SELECT throws_ok(
  $$SELECT count(*) FROM public.user_weapons$$,
  '42501',
  NULL,
  'anon role cannot select from user_weapons'
);

-- Assertion 19: anon cannot select from user_resonators
SELECT throws_ok(
  $$SELECT count(*) FROM public.user_resonators$$,
  '42501',
  NULL,
  'anon role cannot select from user_resonators'
);

-- Assertion 20: anon cannot select from user_resonator_loadouts
SELECT throws_ok(
  $$SELECT count(*) FROM public.user_resonator_loadouts$$,
  '42501',
  NULL,
  'anon role cannot select from user_resonator_loadouts'
);

SELECT * FROM finish();
ROLLBACK;

-- ----------------------------------------------------------------------------
-- Test Harness Cleanup: Remove basejump-supabase_test_helpers after all tests
-- execute so Supabase CLI can cleanly disable pgTAP without dependency errors
-- ----------------------------------------------------------------------------
DROP EXTENSION IF EXISTS "basejump-supabase_test_helpers" CASCADE;
