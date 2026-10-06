-- Migration: 20261006193000_toa_composite_pk_and_completion_goals.sql
-- Description:
-- 1. Change toa_cycles PRIMARY KEY from (id) to composite (id, patch_id) to support cross-patch logical rotation snapshots.
-- 2. Allow target_time_seconds = 0 in challenge_goals for completion-only goals.

-- 1. toa_cycles primary key adjustment
ALTER TABLE public.toa_cycles
  DROP CONSTRAINT IF EXISTS toa_cycles_pkey;

-- If toa_zones_cycle_fkey depends on toa_cycles_patch_key, handle dependency cleanly
ALTER TABLE public.toa_zones
  DROP CONSTRAINT IF EXISTS toa_zones_cycle_fkey;

ALTER TABLE public.toa_cycles
  DROP CONSTRAINT IF EXISTS toa_cycles_patch_key;

ALTER TABLE public.toa_cycles
  ADD CONSTRAINT toa_cycles_pkey
  PRIMARY KEY (id, patch_id);

ALTER TABLE public.toa_zones
  ADD CONSTRAINT toa_zones_cycle_fkey
  FOREIGN KEY (cycle_id, patch_id)
  REFERENCES public.toa_cycles(id, patch_id)
  ON DELETE RESTRICT;

-- 2. challenge_goals target_time_seconds check constraint adjustment
ALTER TABLE public.challenge_goals
  DROP CONSTRAINT IF EXISTS challenge_goals_target_time_seconds_check;

ALTER TABLE public.challenge_goals
  ADD CONSTRAINT challenge_goals_target_time_seconds_check
  CHECK (target_time_seconds >= 0);
