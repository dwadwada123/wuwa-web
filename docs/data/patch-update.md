# Wuthering Waves Patch Update & Ingestion Pipeline Guide

This guide establishes the production procedure for researching, validating, ingesting, and auditing Wuthering Waves game patches into the deterministic database and optimization engine.

---

## 1. Source Hierarchy & Provenance Policy

Every patch fact ingested must be attributed to an explicitly classified source. Never label community datamines or leaks as official published data.

### Hierarchy Classes

| Class | Identifier | Permitted Facts | Trusted Repositories / Sources |
|---|---|---|---|
| **Official Published** | `OFFICIAL_PUBLISHED` | Patch version, release dates, banner announcements, official character reveals, official ToA schedule | Kuro Games Official News, Official Patch Notes, Official Social Announcements |
| **Community Datamine** | `COMMUNITY_DATAMINE` | Exact level 90 base stats, skill multipliers, concerto values, cooldowns, enemy resistance ratios, ToA floor enemy waves and vigor costs | `api-v2.encore.moe`, `Arikatsu/WutheringWaves_Data` (GitHub), Client binary dumps |
| **Community Verified** | `COMMUNITY_VERIFIED` | Cross-checks, build corroboration, theorycrafting validation, rotation timings | Prydwen Institute, verified gameplay video captures, community TC sheets |

> [!WARNING]
> Rumors, unverified leaks, and artificial model fabrications are strictly forbidden. Unverifiable data must be omitted with explicit documentation in dataset notes.

---

## 2. Patch Research Audit Workflow

Before constructing a dataset file, execute a structured patch audit:

1. **Patch Identity**: Confirm official version string (`X.Y`) and release date (`YYYY-MM-DD`).
2. **New Resonators & Weapons**:
   - Element, weapon type, rarity, level 90 base HP/ATK/DEF.
   - All 8 ability categories: `NormalAttack`, `ResonanceSkill`, `ForteCircuit`, `ResonanceLiberation`, `IntroSkill`, `OutroSkill`, `InherentSkill`, `CombatPassive`.
   - Cooldowns, energy costs, and concerto generation values.
   - Gameplay effect taxonomy tagging (`STAT_BUFF`, `DMG_AMPLIFY`, `COORDINATED_ATTACK`, etc.).
3. **New Echoes & Sonatas**:
   - Echo class (`Common`, `Elite`, `Overlord`, `Calamity`), cost (1, 3, 4), and active skill effect.
   - Sonata 2-piece and 5-piece set bonus gameplay effects.
4. **Enemy Catalog & Resistances**:
   - Enemy code, enemy class, base elemental resistances (7 elements: Glacio, Fusion, Electro, Aero, Spectro, Havoc, Physical).
   - Enemy modifiers (`SHIELD_BAR`, `DAMAGE_IMMUNITY`, `STAT_SCALING`).
5. **Tower of Adversity (ToA) Rotation Audit**:
   - Logical season identity (e.g. `Season 41`).
   - Start and end timestamps with timezone offset.
   - Tower taxonomy: Resonant Tower, Hazard Tower, Echoing Tower.
   - Stage count, floor indices, and Vigor costs per floor.
   - Area effects (buffs/debuffs) and target conditions.
   - Enemy waves, spawn orders, levels, and challenge point goals (3-star, 2-star, 1-star target times).

---

## 3. Dataset Contract & File Structure

All patch datasets are strictly append-only and reside in:

```text
data/
  patches/
    3.7/
      patch_3_7_dataset.json
    3.8/
      patch_3_8_dataset.json
```

- **Never overwrite or mutate prior patch datasets.**
- Historical datasets (e.g., `3.7`) must remain permanently reproducible and queryable.
- The dataset file must adhere to `PatchDataset` type definitions (`lib/ingestion/types.ts`).

---

## 4. Deterministic Identity Policy

All database primary keys and entity relations are generated deterministically using RFC 4122 v4 UUIDs derived from canonical natural keys hashed via SHA-256 (`deterministicUuid`):

* Resonators: `resonator:<CanonicalName>`
* Weapons: `weapon:<CanonicalName>`
* Echoes: `echo:<CanonicalName>`
* Enemies: `enemy:<EnemyCode>`
* ToA Logical Cycles: `toa_cycles:season_<N>`
* ToA Patch Snapshots: `toa_snapshots:<cycle_id>::<patch_version>`

This guarantees:
1. Re-running ingestion is 100% idempotent.
2. Cross-patch snapshots share the same logical cycle identity while preserving patch-isolated stage configurations.

---

## 5. Pre-Ingestion Validation Workflow

Always validate the dataset in read-only mode prior to database execution:

```bash
npm run validate:patch -- 3.8
```

The validator verifies:
* JSON syntax and complete required fields.
* Foreign-key-like provenance references (`provenance_source_name`).
* Entity uniqueness (zero duplicate Resonators, Weapons, or Enemy codes).
* Strict enum constraints (Elements, WeaponTypes, Rarities, Echo costs, Effect categories).
* ISO 8601 date formats (`YYYY-MM-DD`).
* ToA integrity: non-negative target time thresholds, valid vigor costs, valid tower hierarchies.

> [!NOTE]
> The validation command is strictly read-only and initiates zero network or database connections.

---

## 6. Local Ingestion & Idempotency Testing

1. Ensure the local Supabase instance is running:
   ```bash
   npx supabase status
   ```
2. Ingest into the local database:
   ```bash
   npm run ingest -- --patch 3.8 --target local
   ```
3. Verify idempotency by running the ingestion a second time immediately:
   ```bash
   npm run ingest -- --patch 3.8 --target local
   ```
   Both runs must succeed cleanly with identical processed record counts and zero conflicts.
4. Run the automated test suite against the local database:
   ```bash
   npm test
   npx supabase test db
   npm run build
   ```

---

## 7. Remote Production Ingestion Guard

Writing to the remote production Supabase instance requires explicit authorization and two mandatory flags:

```bash
npm run ingest -- --patch 3.8 --target remote --confirm-remote
```

### Safety Rules:
* If `--confirm-remote` is omitted, the process **immediately aborts** with code 1.
* Remote writes require `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. Public `anon` keys are strictly prohibited from writing to canonical game-fact tables.
* Production writes must only occur after the local dry run and automated regressions pass 100%.

---

## 8. Post-Ingestion Regression & Verification

Following ingestion:
1. Run Playwright E2E smoke tests:
   ```bash
   npx playwright test
   ```
2. Verify dynamic version resolution on `/tower`:
   - Active patch and cycle automatically resolve from the database without requiring UI code modifications.
3. Verify cache invalidation:
   - Changes in patch context or cycle context produce new cache fingerprints in `OptimizationCache`.
