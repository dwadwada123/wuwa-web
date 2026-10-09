/**
 * Wuthering Waves Deterministic User Inventory Adapter
 * Phase 7 Step 25: Application Service & Inventory Adapter
 *
 * Adapts Supabase database records (user_resonators, user_weapons, user_resonator_loadouts)
 * into canonical, validated Step 13 ResonatorInvestmentSnapshot records and owned roster lists.
 *
 * Invariants:
 * 1. Strict Tenant Isolation: Every query scoped to verified authenticated userId.
 * 2. Fail Closed: Non-canonical entity IDs and invalid numerical values are never clamped or coerced.
 * 3. No Silent Stripping: If a user equips an invalid weapon, it is passed to Step 13 normalizer,
 *    failing validation and safely omitting the Resonator with an explicit diagnostic error.
 * 4. Genuinely Missing Values: Handled strictly according to Step 13 (UNKNOWN != 0).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResonatorInvestmentInput, ResonatorInvestmentSnapshot } from '../../engine/investment/types.ts';
import { normalizeResonatorInvestment } from '../../engine/investment/normalization.ts';
import { compareResonatorInvestmentSnapshots } from '../../engine/investment/predicates.ts';
import type { AdaptedInventoryResult, AdapterDiagnostic } from './types.ts';

export interface GameEntityResolver {
  resolveResonatorName(id: string): Promise<string | null> | string | null;
  resolveWeaponName(id: string): Promise<string | null> | string | null;
  resolveSonataName(id: string): Promise<string | null> | string | null;
}

export interface UserInventoryAdapterOptions {
  supabase: SupabaseClient;
  entityResolver?: GameEntityResolver;
}

/**
 * Default entity resolver querying the static reference tables via Supabase.
 */
export class SupabaseGameEntityResolver implements GameEntityResolver {
  private client: SupabaseClient;
  private resonatorCache = new Map<string, string>();
  private weaponCache = new Map<string, string>();
  private sonataCache = new Map<string, string>();
  private initialized = false;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const [resResult, wepResult, sonResult] = await Promise.all([
      this.client.from('resonators').select('id, name'),
      this.client.from('weapons').select('id, name'),
      this.client.from('sonatas').select('id, name'),
    ]);

    if (resResult.data) {
      for (const r of resResult.data) {
        this.resonatorCache.set(r.id, r.name);
      }
    }
    if (wepResult.data) {
      for (const w of wepResult.data) {
        this.weaponCache.set(w.id, w.name);
      }
    }
    if (sonResult.data) {
      for (const s of sonResult.data) {
        this.sonataCache.set(s.id, s.name);
      }
    }

    this.initialized = true;
  }

  async resolveResonatorName(id: string): Promise<string | null> {
    if (!this.initialized) await this.init();
    return this.resonatorCache.get(id) ?? null;
  }

  async resolveWeaponName(id: string): Promise<string | null> {
    if (!this.initialized) await this.init();
    return this.weaponCache.get(id) ?? null;
  }

  async resolveSonataName(id: string): Promise<string | null> {
    if (!this.initialized) await this.init();
    return this.sonataCache.get(id) ?? null;
  }
}

/**
 * Adapts persisted user inventory into engine-ready canonical investment snapshots.
 */
export class UserInventoryAdapter {
  private supabase: SupabaseClient;
  private entityResolver: GameEntityResolver;

  constructor(options: UserInventoryAdapterOptions) {
    this.supabase = options.supabase;
    this.entityResolver =
      options.entityResolver ?? new SupabaseGameEntityResolver(options.supabase);
  }

  /**
   * Loads and normalizes a user's inventory for personal recommendation execution.
   */
  async adaptUserInventory(userId: string): Promise<AdaptedInventoryResult> {
    const diagnostics: AdapterDiagnostic[] = [];

    // 1. Fetch user inventory with strict tenant isolation
    const [resResult, wepResult, loadResult] = await Promise.all([
      this.supabase
        .from('user_resonators')
        .select('*')
        .eq('user_id', userId),
      this.supabase
        .from('user_weapons')
        .select('*')
        .eq('user_id', userId),
      this.supabase
        .from('user_resonator_loadouts')
        .select('*')
        .eq('user_id', userId),
    ]);

    if (resResult.error) {
      throw new Error(`Failed to load user resonators: ${resResult.error.message}`);
    }
    if (wepResult.error) {
      throw new Error(`Failed to load user weapons: ${wepResult.error.message}`);
    }
    if (loadResult.error) {
      throw new Error(`Failed to load user resonator loadouts: ${loadResult.error.message}`);
    }

    const userResonators = resResult.data ?? [];
    const userWeapons = wepResult.data ?? [];
    const userLoadouts = loadResult.data ?? [];

    // Index weapons deterministically (tie-break duplicate weapon rows by updated_at DESC, created_at DESC, id ASC)
    const sortedWeapons = [...userWeapons].sort((a, b) => {
      const aUp = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUp = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (bUp !== aUp) return bUp - aUp;
      const aCr = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCr = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bCr !== aCr) return bCr - aCr;
      return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });
    const userWeaponMap = new Map<string, any>();
    for (const w of sortedWeapons) {
      if (!userWeaponMap.has(w.id)) {
        userWeaponMap.set(w.id, w);
      }
    }

    // Index loadouts deterministically (tie-break duplicate loadouts per resonator by updated_at DESC, created_at DESC, id ASC)
    const sortedLoadouts = [...userLoadouts].sort((a, b) => {
      const aUp = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUp = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (bUp !== aUp) return bUp - aUp;
      const aCr = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCr = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bCr !== aCr) return bCr - aCr;
      return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });
    const userLoadoutMap = new Map<string, any>();
    for (const l of sortedLoadouts) {
      if (!userLoadoutMap.has(l.user_resonator_id)) {
        userLoadoutMap.set(l.user_resonator_id, l);
      }
    }

    const ownedResonatorIds: string[] = [];
    const investmentSnapshots: ResonatorInvestmentSnapshot[] = [];
    const seenCanonicalResonators = new Set<string>();

    // Sort resonators deterministically (updated_at DESC, created_at DESC, id ASC)
    const sortedResonators = [...userResonators].sort((a, b) => {
      const aUp = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUp = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (bUp !== aUp) return bUp - aUp;
      const aCr = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCr = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bCr !== aCr) return bCr - aCr;
      return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });

    // 2. Iterate through owned resonators and adapt each record
    for (const row of sortedResonators) {
      // Resolve Resonator UUID to canonical name
      const canonicalName = await this.entityResolver.resolveResonatorName(row.resonator_id);
      if (!canonicalName) {
        diagnostics.push({
          level: 'ERROR',
          message: `User resonator record '${row.id}' references unresolvable resonator UUID '${row.resonator_id}'. Omitted from candidate pool.`,
        });
        continue;
      }

      // Guard against duplicate records for the same canonical resonator
      if (seenCanonicalResonators.has(canonicalName)) {
        diagnostics.push({
          resonatorId: canonicalName,
          level: 'WARN',
          message: `Duplicate user inventory record for resonator '${canonicalName}'. Deterministically keeping the most recent record.`,
        });
        continue;
      }
      seenCanonicalResonators.add(canonicalName);

      // Check for associated loadout
      const loadout = userLoadoutMap.get(row.id);
      let weaponInput: ResonatorInvestmentInput['weapon'] = null;
      let echoInput: ResonatorInvestmentInput['echoInvestment'] = null;

      if (loadout) {
        // Resolve Weapon
        if (loadout.weapon_instance_id !== null && loadout.weapon_instance_id !== undefined) {
          const weaponInst = userWeaponMap.get(loadout.weapon_instance_id);
          if (!weaponInst) {
            // Weapon instance reference points to non-existent user_weapons row
            weaponInput = {
              weaponId: 'UNKNOWN_WEAPON_INSTANCE',
              weaponLevel: null,
              refinementRank: null,
            };
          } else {
            const canonicalWeaponName = await this.entityResolver.resolveWeaponName(
              weaponInst.weapon_id
            );
            weaponInput = {
              weaponId: canonicalWeaponName ?? 'UNKNOWN_WEAPON',
              weaponLevel: weaponInst.level ?? null,
              refinementRank: weaponInst.refinement ?? null,
            };
          }
        }

        // Resolve Sonata
        if (loadout.sonata_id !== null && loadout.sonata_id !== undefined) {
          const canonicalSonataName = await this.entityResolver.resolveSonataName(
            loadout.sonata_id
          );
          echoInput = {
            sonataSetId: canonicalSonataName ?? 'UNKNOWN_SONATA',
          };
        }
      }

      // Construct Step 13 input
      const rawInput: ResonatorInvestmentInput = {
        patchVersion: '3.7',
        resonatorId: canonicalName,
        characterLevel: row.level ?? null,
        sequenceLevel: row.waveband ?? null,
        weapon: weaponInput,
        echoInvestment: echoInput,
      };

      // Run authoritative Step 13 normalizer
      const norm = normalizeResonatorInvestment(rawInput);

      if (!norm.isValid) {
        diagnostics.push({
          resonatorId: canonicalName,
          level: 'ERROR',
          message: `Resonator '${canonicalName}' failed Step 13 validation: ${norm.validationErrors.join('; ')}. Omitted from candidate pool.`,
        });
        continue;
      }

      ownedResonatorIds.push(canonicalName);
      investmentSnapshots.push(norm.snapshot);
    }

    // Deterministic sorting
    ownedResonatorIds.sort((a, b) => a.localeCompare(b));
    investmentSnapshots.sort(compareResonatorInvestmentSnapshots);

    return {
      ownedResonatorIds: Object.freeze(ownedResonatorIds),
      investmentSnapshots: Object.freeze(investmentSnapshots),
      diagnostics: Object.freeze(diagnostics),
    };
  }
}
