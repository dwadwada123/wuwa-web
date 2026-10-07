# Wuthering Waves Patch Update & Ingestion Operations Guide

This guide establishes the production procedure for researching, verifying, validating, ingesting, and auditing Wuthering Waves game patches into the deterministic database and optimization engine.

---

## 1. Complete Patch Update Workflow

Every patch update must execute following this exact 11-step sequence. Each step has an explicitly defined operational scope:

| Step | Phase Name | Operational Scope | Description & Gate Criteria |
|---|---|---|---|
| **1** | **Research** | `read-only` | Investigate upcoming patch patchnotes, announcements, datamines, and community theorycrafting sheets. Gather raw numbers and mechanics. |
| **2** | **Source Verification** | `read-only` | Verify every collected datum against at least two independent sources when possible. Classify into provenance tiers and eliminate leaks or rumors. |
| **3** | **Dataset Preparation** | `local-only` | Construct new patch dataset JSON file under `data/patches/<version>/patch_<version_snake>_dataset.json`. Golden datasets (e.g. 3.7) remain immutable. |
| **4** | **Patch Validation** | `read-only`, `local-only` | Run `npm run validate:patch -- <version>`. Executes zero database operations. Fails on any schema error, missing provenance, or invalid reference. |
| **5** | **Local Ingestion** | `local-only` | Ingest into local disposable Supabase instance (`npm run ingest -- --patch <version> --target local`). Verifies all foreign keys and tables. |
| **6** | **Local Idempotency** | `local-only` | Execute identical ingestion command again immediately. Verifies zero duplicate records created and identical row counts processed. |
| **7** | **Regression Tests** | `local-only` | Run full test suite: `npm test`, `npx supabase test db`, and `npm run build`. Ensure existing algorithms and golden datasets pass 100%. |
| **8** | **Production Review** | `read-only` | Human inspection of local ingestion diff, deterministic IDs, ToA snapshot mappings, and provenance audit reports before any production action. |
| **9** | **Remote Ingestion** | `production-writing` | Ingest into production Supabase using `--target remote --confirm-remote`. Protected by double confirmation guard; fails if flag is missing. |
| **10** | **Production Deployment** | `deployment-related` | Trigger production build and deployment to Vercel via CLI or git promotion after verifying clean working tree. |
| **11** | **Production Smoke Test** | `read-only` | Verify production deployment: check `/inventory`, `/tower`, active patch/cycle resolution, and verify deterministic solver execution. |

---

## 2. Source Policy & Provenance Hierarchy

Every fact ingested into the dataset must cite an explicitly registered provenance source in `provenance_sources`. The system enforces a strict 5-tier taxonomy:

### 1. `OFFICIAL_PUBLISHED`
- **Permitted Facts**:
  - Patch version identity and official release date.
  - Official maintenance announcements and patch notes.
  - Officially published Resonator identities, weapon identities, and core system mechanics.
  - Official Tower of Adversity schedule and cycle calendar.
- **Trusted Repositories**: Kuro Games Official Website, In-Game Official Notices, Kuro Official Social Channels.

### 2. `OFFICIAL_DATAMINE`
- **Permitted Facts**:
  - Official client localization strings, internal resource IDs, and verified official client metadata extracted directly from distributed client packages.
- **Trusted Repositories**: Client asset package dumps matching official binary hash signatures.

### 3. `COMMUNITY_DATAMINE`
- **Permitted Facts**:
  - Structured numeric game data not publicly exposed in official marketing material.
  - Exact level 90 base HP, ATK, DEF values.
  - Skill damage multipliers, energy costs, cooldowns, and concerto values.
  - Raw enemy stats, enemy classes, and elemental resistance ratios.
  - Tower of Adversity stage enemy waves, enemy levels, and vigor costs.
- **Trusted Repositories**: `api-v2.encore.moe`, `Arikatsu/WutheringWaves_Data` (GitHub), verified client binary dumps.

### 4. `COMMUNITY_VERIFIED`
- **Permitted Facts**:
  - Corroboration of mechanics, theorycrafting damage calculations, rotation timings, synergy verifications, and cross-source consistency checks.
- **Trusted Repositories**: Prydwen Institute, verified community theorycrafting repositories, cross-validated community spreadsheets.

### 5. `LIVE_OBSERVATION`
- **Permitted Facts**:
  - Direct in-game frame-by-frame measurement of unexposed mechanics (e.g. hitstun duration, exact animation lock timings, buff renewal behavior).
  - Must include timestamped observation notes.
- **Trusted Repositories**: High-framerate lossless in-game screen recordings.

> [!CAUTION]
> Leaks, unverified social media rumors, and speculative calculations are strictly prohibited. If a value cannot be confirmed with high confidence, it must be omitted and documented in the dataset omissions list.

---

## 3. Dataset Contract

All patch dataset JSON files reside strictly at:
```text
data/patches/<version>/patch_<version_snake>_dataset.json
```
(e.g., `data/patches/3.7/patch_3_7_dataset.json`).

The dataset contract models the following 27 entity domains:

1. **Patch Metadata (`patch`)**:
   - `version` (string, e.g. `'3.7'`), `release_date` (ISO date `YYYY-MM-DD`), `notes` (string), `provenance_source_name` (foreign reference to `provenance_sources`).
2. **Provenance Sources (`provenance_sources`)**:
   - `source_name` (unique natural key), `url` (optional), `source_type` (5-tier enum), `verification_date` (ISO date), `confidence` (`HIGH` / `MEDIUM` / `LOW`), `classification` (`CORE_MECHANIC`, `DAMAGE_FORMULA`, `TOA_STAGE_DATA`, `SUBSTAT_CURVE`), `status` (`ACTIVE` / `SUPERSEDED` / `DISPUTED`).
3. **Taxonomies**:
   - **Functional Roles (`functional_roles`)**: `code` (e.g. `MAIN_DPS`, `SUB_DPS`, `SUPPORT`, `HEALER`), `label`, `description`.
   - **Combat Tags (`combat_tags`)**: `code` (e.g. `BASIC_ATK_AMP`, `COORDINATED_ATK`, `HEAL`), `label`, `description`.
4. **Resonators (`resonators`)**:
   - Invariant identity: `name` (unique natural key), `element` (6 elements: `Glacio`, `Fusion`, `Electro`, `Aero`, `Spectro`, `Havoc`), `weapon_type` (5 types: `Broadblade`, `Sword`, `Pistols`, `Gauntlets`, `Rectifier`), `rarity` (4 or 5), `release_date`.
5. **Resonator Patch Data (`resonators[].patch_data`)**:
   - Patch-scoped: `base_hp_lvl90`, `base_atk_lvl90`, `base_def_lvl90`, `provenance_source_name`.
6. **Roles (`resonators[].patch_data.roles`)**:
   - Array of `{ code, is_primary }` referencing functional roles taxonomy.
7. **Combat Tags (`resonators[].patch_data.combat_tags`)**:
   - Array of tag codes referencing combat tags taxonomy.
8. **Abilities (`resonators[].abilities`)**:
   - `ability_code` (unique per resonator, e.g. `A1_NORMAL`), `ability_category` (8 categories: `NormalAttack`, `ResonanceSkill`, `ForteCircuit`, `ResonanceLiberation`, `IntroSkill`, `OutroSkill`, `InherentSkill`, `CombatPassive`), `name`, `description`, `cooldown_seconds`, `energy_cost`, `concertos_generated`, `status`, `provenance_source_name`.
9. **Gameplay Effects (`resonators[].abilities[].effects`, weapons, echoes, sonatas, area effects)**:
   - `category` (10 categories: `STAT_BUFF`, `DMG_AMPLIFY`, `COORDINATED_ATTACK`, `DEF_SHRED`, `RES_SHRED`, `HEALING`, `SHIELD`, `SPECIAL_MECHANIC`, `RESOURCE_GRANT`, `STATE_CHANGE`).
   - `target` (5 targets: `SELF`, `ACTIVE_CHARACTER`, `NEXT_RESONATOR`, `TEAM`, `ENEMY`).
   - `condition_expression` (structured JSON criteria), `detail_expression` (structured modifier payload), `provenance_source_name`.
10. **Ability Effects (`resonators[].abilities[].effects`)**:
    - Ordered effect linking: `effect_order` (unique positive integer per ability), mapped to generated gameplay effect.
11. **Weapons (`weapons`)**:
    - Invariant identity: `name` (unique natural key), `weapon_type` (5 types), `rarity` (3, 4, 5).
12. **Weapon Patch Data (`weapons[].patch_data`)**:
    - Patch-scoped: `base_atk_lvl90`, `sub_stat_type`, `sub_stat_value_lvl90`, `provenance_source_name`, optional `passive_effect` (gameplay effect).
13. **Echoes (`echoes`)**:
    - Invariant identity: `name` (unique natural key), `class_type` (`Calamity`, `Overlord`, `Elite`, `Common`), `cost` (1, 3, 4).
14. **Echo Patch Data (`echoes[].patch_data`)**:
    - Patch-scoped: `cost`, `cd_seconds`, `concertos_generated`, `provenance_source_name`, optional `skill_effect` (gameplay effect).
15. **Sonatas (`sonatas`)**:
    - Invariant identity: `name` (unique natural key), `code` (e.g. `FREEZING_FROST`), `description`.
16. **Sonata Patch Data (`sonatas[].patch_data`)**:
    - Patch-scoped: `two_piece_effect` (gameplay effect), `five_piece_effect` (gameplay effect), `provenance_source_name`.
17. **Enemies (`enemies`)**:
    - Invariant identity: `name`, `code` (unique natural key, e.g. `THUNDERING_MEACOIS`), `enemy_class` (`Common`, `Elite`, `Overlord`, `Calamity`), `provenance_source_name`.
18. **Enemy Resistances (`enemies[].resistances`)**:
    - Array of `{ element, resistance_ratio, provenance_source_name }` across 7 resistance elements (`Glacio`, `Fusion`, `Electro`, `Aero`, `Spectro`, `Havoc`, `Physical`), ratio bounded within `[-1.0, 2.0]`.
19. **Enemy Modifiers (`enemies[].modifiers`)**:
    - Array of `{ modifier_type, parameters, provenance_source_name, is_active }` across 4 types (`SHIELD_BAR`, `ENRAGE_RESISTANCE`, `DAMAGE_IMMUNITY`, `STAT_SCALING`).
20. **ToA Cycles (`toa_cycles`)**:
    - Logical cycle identity: `cycle_code` (e.g. `SEASON_40`), `cycle_name`, ISO `start_time`, ISO `end_time`, `provenance_source_name`.
21. **ToA Zones (`toa_cycles[].zones`)**:
    - `zone_type` (`StableZone`, `ExperimentalZone`, `HazardZone`).
22. **ToA Towers (`toa_cycles[].zones[].towers`)**:
    - `tower_name` (e.g. `Resonant Tower`), `tower_order` (positive integer).
23. **ToA Stages (`toa_cycles[].zones[].towers[].stages`)**:
    - `stage_index` (positive integer, e.g. 1 to 4), `vigor_cost` (positive integer, e.g. 1 to 4), `area_effect_source_ids` (references to `area_effects`).
24. **Stage Area Effects (`stage_area_effects` mapped from `area_effects`)**:
    - `source_id` (unique natural key), `name`, `description`, `gameplay_effect`.
25. **Challenge Goals (`toa_cycles[].zones[].towers[].stages[].challenge_goals`)**:
    - `goal_order` (1, 2, 3), `target_time_seconds` (non-negative integer), `points` (integer, default 1).
26. **ToA Waves (`toa_cycles[].zones[].towers[].stages[].waves`)**:
    - `wave_index` (positive integer, e.g. 1, 2).
27. **ToA Enemy Instances (`toa_cycles[].zones[].towers[].stages[].waves[].enemy_instances`)**:
    - `enemy_code` (references known enemy in dataset), `level` (1 to 120), `spawn_order` (positive integer).

---

## 4. Deterministic Identity Audit

All database UUID primary keys are generated deterministically using SHA-256 hashed natural keys formatted as RFC 4122 v4 UUIDs:

```text
natural key  ──(SHA-256)──>  deterministic UUID
```

### Natural Key Mapping Table

| Entity | Natural Key Pattern | Example Natural Key | Example Deterministic UUID |
|---|---|---|---|
| **Provenance Source** | `provenance:<source_name>` | `provenance:Kuro Games Official 3.7 Release Announcement` | `c3b3fa69-42b7-4a6c-9403-12563f458ff6` |
| **Patch (3.7 Golden)** | Fixed UUID | `patch:3.7` | `11111111-1111-1111-1111-111111111111` |
| **Patch (Future)** | `patch:<version>` | `patch:3.8` | Generated deterministically from string |
| **Enemy** | `enemy:<enemy_code>` | `enemy:THUNDERING_MEACOIS` | Generated deterministically from code |
| **Enemy Resistance** | `enemy_resistance:<patch>:<enemy_code>:<element>` | `enemy_resistance:3.7:THUNDERING_MEACOIS:Electro` | Generated deterministically |
| **Enemy Modifier** | `enemy_modifier:<patch>:<enemy_code>:<modifier_type>` | `enemy_modifier:3.7:THUNDERING_MEACOIS:ENRAGE_RESISTANCE` | Generated deterministically |
| **Gameplay Effect (Resonator)** | `gameplay_effect:<patch>:<name>:<ability_code>:<order>` | `gameplay_effect:3.7:Jinhsi:A2_SKILL:1` | Generated deterministically |
| **Gameplay Effect (Weapon)** | `gameplay_effect:weapon:<patch>:<weapon_name>` | `gameplay_effect:weapon:3.7:Ages of Harvest` | Generated deterministically |
| **Gameplay Effect (Echo)** | `gameplay_effect:echo:<patch>:<echo_name>` | `gameplay_effect:echo:3.7:Jue` | Generated deterministically |
| **Gameplay Effect (Sonata 2pc)** | `gameplay_effect:sonata:<patch>:<sonata_code>:2pc` | `gameplay_effect:sonata:3.7:CELESTIAL_LIGHT:2pc` | Generated deterministically |
| **Gameplay Effect (Sonata 5pc)** | `gameplay_effect:sonata:<patch>:<sonata_code>:5pc` | `gameplay_effect:sonata:3.7:CELESTIAL_LIGHT:5pc` | Generated deterministically |
| **Area Effect** | `area_effect:<source_id>` | `area_effect:ae_s40_hazard_4` | Generated deterministically |
| **ToA Logical Cycle** | `toa-cycle:<cycle_code>` | `toa-cycle:SEASON_40` | Generated deterministically |
| **ToA Zone** | `toa-zone:<cycle_code>:<zone_type>` | `toa-zone:SEASON_40:HazardZone` | Generated deterministically |
| **ToA Tower** | `toa-tower:<cycle_code>:<zone_type>:<tower_order>` | `toa-tower:SEASON_40:HazardZone:1` | Generated deterministically |
| **ToA Stage** | `toa-stage:<cycle_code>:<tower_order>:<stage_index>` | `toa-stage:SEASON_40:1:4` | Generated deterministically |
| **Stage Area Effect** | `stage_area_effect:<stage_id>:<area_effect_id>` | Deterministic composite hash | Generated deterministically |
| **Challenge Goal** | `challenge_goal:<stage_id>:<goal_order>` | Deterministic composite hash | Generated deterministically |
| **ToA Wave** | `toa-wave:<stage_id>:<wave_index>` | Deterministic composite hash | Generated deterministically |
| **ToA Enemy Instance** | `toa_enemy_instance:<wave_id>:<spawn_order>` | Deterministic composite hash | Generated deterministically |

### Stability & Audit Verification
1. **Repeatability**: Repeated generation from the identical natural key always produces the exact same UUID byte for byte.
2. **Key Sensitivity**: Changing any single character in the natural key produces a completely different UUID.
3. **Immutability**: IDs are never updated or renamed once committed to production.

---

## 5. Tower of Adversity Research Checklist

Every new Tower of Adversity cycle rotation requires verifying all 13 structural facts before building the dataset:

- [ ] **Cycle Identity**: Official rotation title (e.g. `Season 41`) and internal identifier.
- [ ] **Start Time**: Official start timestamp with ISO 8601 offset (e.g. `2026-10-15T04:00:00+08:00`).
- [ ] **End Time**: Official end timestamp with ISO 8601 offset (must be strictly after start time).
- [ ] **Execution Patch Snapshot**: Associated game patch version (e.g. `3.8`).
- [ ] **Tower Structure**: Participating towers (e.g., Stable Zone Tower 1, Experimental Zone Tower 1, Hazard Zone Towers 1 & 2).
- [ ] **Stage Count**: Total count of active stages across all towers (e.g., 12 stages in Hazard Zone).
- [ ] **Stage Indexes**: Explicit positive 1-based stage indices per tower (e.g., Stages 1, 2, 3, 4).
- [ ] **Vigor Costs**: Vigor deduction per stage floor (e.g., 1 Vigor for floor 1, 2 for floor 2, 3 for floor 3, 4 for floor 4).
- [ ] **Challenge Goals**: 3-star, 2-star, and 1-star clear time criteria in remaining seconds (e.g., >= 180s for 3 stars).
- [ ] **Area Effects**: Floor-wide buffs/debuffs (e.g. Spectro DMG +30%, Resonance Liberation DMG +50%), tagged with exact mechanics.
- [ ] **Waves**: Number of enemy waves per stage (e.g., Wave 1, Wave 2).
- [ ] **Enemies**: Enemy codes for each enemy spawned in each wave.
- [ ] **Enemy Resistances**: Exact elemental resistance ratios for each enemy type in the rotation.

### Multi-Source Corroboration Requirement
- Current active ToA facts must be cross-verified against at least **two independent sources** whenever practical (e.g. Datamine dump + In-game capture observation).
- The dataset must explicitly cite which source is primary for each floor and effect.

---

## 6. Pre-Ingestion Validation Workflow

Before touching the database, run the read-only validator:

```bash
npm run validate:patch -- <version>
```

Expected output:
```text
=== WUTHERING WAVES PATCH DATASET VALIDATOR ===
Target Dataset: .../data/patches/3.7/patch_3_7_dataset.json
[Validation] Running strict read-only schema, provenance, and domain consistency checks...
✅ VALIDATION PASSED CLEANLY (Zero Schema / Consistency Violations)
```

The validator performs 100% read-only in-memory inspection and initiates zero database writes or network calls. It catches:
* Invalid references (missing provenance source names, unknown enemy codes in stage waves, unknown area effect source IDs).
* Duplicate natural keys (duplicate resonator names, weapon names, enemy codes, ability codes, goal orders).
* Missing provenance across all entity definitions.
* Invalid patch IDs or malformed version patterns.
* Invalid enums (elements, weapon types, rarities, source types, effect categories, effect targets).
* Malformed dates (non-ISO 8601 strings or inverted start/end times).
* Invalid ToA references and hierarchies.
* Invalid challenge goals (negative target times).

---

## 7. Local Ingestion & Idempotency Testing

1. Verify local Supabase status:
   ```bash
   npx supabase status
   ```
2. Run local ingestion:
   ```bash
   npm run ingest -- --patch <version> --target local
   ```
3. Run local ingestion a second time immediately to verify 100% idempotency:
   ```bash
   npm run ingest -- --patch <version> --target local
   ```
   *Expected outcome*: Identical row counts processed, zero duplicate rows inserted, and zero unique constraint conflicts.
4. Execute regression tests:
   ```bash
   npm test
   npx supabase test db
   npm run build
   ```

---

## 8. Remote Production Guard & Deployment

Writing to remote production is guarded against accidental execution:

```bash
npm run ingest -- --patch <version> --target remote --confirm-remote
```

- Omitting `--confirm-remote` immediately aborts with exit code 1.
- Production writes must only be executed after all local tests, database tests, and builds pass.
- After remote ingestion, trigger Vercel deployment and run production smoke tests.
