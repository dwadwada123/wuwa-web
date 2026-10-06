/**
 * User Inventory Repository
 *
 * Provides tenant-isolated persistence for user-owned Resonators, weapon instances,
 * and equipment loadouts. Translates database rows into clean domain models.
 * RLS enforces final authorization; repository guarantees tenant isolation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OwnedRoster,
  OwnedResonator,
  OwnedWeapon,
  OwnedResonatorLoadout,
} from '../../domain/types/index.ts';

export interface IUserInventoryRepository {
  getOwnedRoster(userId: string): Promise<OwnedRoster>;
  addOwnedResonator(
    userId: string,
    resonatorId: string,
    options?: Partial<Omit<OwnedResonator, 'id' | 'userId' | 'resonatorId'>>
  ): Promise<OwnedResonator>;
  removeOwnedResonator(userId: string, resonatorId: string): Promise<void>;
  addOwnedWeapon(
    userId: string,
    weaponId: string,
    options?: Partial<Omit<OwnedWeapon, 'id' | 'userId' | 'weaponId'>>
  ): Promise<OwnedWeapon>;
  removeOwnedWeapon(userId: string, weaponInstanceId: string): Promise<void>;
  saveResonatorLoadout(
    userId: string,
    loadout: {
      userResonatorId: string;
      weaponInstanceId?: string | null;
      activeEchoId?: string | null;
      sonataId?: string | null;
    }
  ): Promise<OwnedResonatorLoadout>;
  deleteResonatorLoadout(userId: string, userResonatorId: string): Promise<void>;
}

function mapResonatorRow(row: any): OwnedResonator {
  return {
    id: row.id,
    userId: row.user_id,
    resonatorId: row.resonator_id,
    level: row.level,
    waveband: row.waveband,
    normalAttackLevel: row.normal_attack_level,
    resonanceSkillLevel: row.resonance_skill_level,
    forteCircuitLevel: row.forte_circuit_level,
    resonanceLiberationLevel: row.resonance_liberation_level,
    introSkillLevel: row.intro_skill_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeaponRow(row: any): OwnedWeapon {
  return {
    id: row.id,
    userId: row.user_id,
    weaponId: row.weapon_id,
    level: row.level,
    refinement: row.refinement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLoadoutRow(row: any): OwnedResonatorLoadout {
  return {
    id: row.id,
    userId: row.user_id,
    userResonatorId: row.user_resonator_id,
    weaponInstanceId: row.weapon_instance_id ?? null,
    activeEchoId: row.active_echo_id ?? null,
    sonataId: row.sonata_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseUserInventoryRepository implements IUserInventoryRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Retrieves the full tenant-isolated roster for a user.
   */
  async getOwnedRoster(userId: string): Promise<OwnedRoster> {
    const [resResult, wepResult, loadResult] = await Promise.all([
      this.client
        .from('user_resonators')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      this.client
        .from('user_weapons')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      this.client
        .from('user_resonator_loadouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ]);

    if (resResult.error) {
      throw new Error(`Failed to load user resonators: ${resResult.error.message}`);
    }
    if (wepResult.error) {
      throw new Error(`Failed to load user weapons: ${wepResult.error.message}`);
    }
    if (loadResult.error) {
      throw new Error(`Failed to load user loadouts: ${loadResult.error.message}`);
    }

    const resonators = (resResult.data || []).map(mapResonatorRow);
    const weapons = (wepResult.data || []).map(mapWeaponRow);
    const loadouts = (loadResult.data || []).map(mapLoadoutRow);

    const resonatorIds = Array.from(new Set(resonators.map((r) => r.resonatorId))).sort();
    const weaponIds = Array.from(new Set(weapons.map((w) => w.weaponId))).sort();
    const echoIds = Array.from(
      new Set(
        loadouts
          .map((l) => l.activeEchoId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    ).sort();

    return {
      userId,
      resonatorIds,
      weaponIds,
      echoIds,
      resonators,
      weapons,
      loadouts,
    };
  }

  /**
   * Adds or updates a user-owned Resonator reference.
   */
  async addOwnedResonator(
    userId: string,
    resonatorId: string,
    options?: Partial<Omit<OwnedResonator, 'id' | 'userId' | 'resonatorId'>>
  ): Promise<OwnedResonator> {
    const payload = {
      user_id: userId,
      resonator_id: resonatorId,
      level: options?.level ?? 1,
      waveband: options?.waveband ?? 0,
      normal_attack_level: options?.normalAttackLevel ?? 1,
      resonance_skill_level: options?.resonanceSkillLevel ?? 1,
      forte_circuit_level: options?.forteCircuitLevel ?? 1,
      resonance_liberation_level: options?.resonanceLiberationLevel ?? 1,
      intro_skill_level: options?.introSkillLevel ?? 1,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('user_resonators')
      .upsert(payload, { onConflict: 'user_id,resonator_id' })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to add owned resonator: ${error?.message || 'Unknown error'}`);
    }

    return mapResonatorRow(data);
  }

  /**
   * Removes ownership of a Resonator. Cascades loadout deletion via database constraints.
   */
  async removeOwnedResonator(userId: string, resonatorId: string): Promise<void> {
    const { error } = await this.client
      .from('user_resonators')
      .delete()
      .eq('user_id', userId)
      .eq('resonator_id', resonatorId);

    if (error) {
      throw new Error(`Failed to remove owned resonator: ${error.message}`);
    }
  }

  /**
   * Adds a new weapon instance for the user. Supports duplicate copies.
   */
  async addOwnedWeapon(
    userId: string,
    weaponId: string,
    options?: Partial<Omit<OwnedWeapon, 'id' | 'userId' | 'weaponId'>>
  ): Promise<OwnedWeapon> {
    const payload = {
      user_id: userId,
      weapon_id: weaponId,
      level: options?.level ?? 1,
      refinement: options?.refinement ?? 1,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('user_weapons')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to add owned weapon: ${error?.message || 'Unknown error'}`);
    }

    return mapWeaponRow(data);
  }

  /**
   * Removes a weapon instance owned by the user.
   */
  async removeOwnedWeapon(userId: string, weaponInstanceId: string): Promise<void> {
    const { error } = await this.client
      .from('user_weapons')
      .delete()
      .eq('user_id', userId)
      .eq('id', weaponInstanceId);

    if (error) {
      throw new Error(`Failed to remove owned weapon: ${error.message}`);
    }
  }

  /**
   * Saves or updates a Resonator loadout (weapon instance, active echo, sonata).
   */
  async saveResonatorLoadout(
    userId: string,
    loadout: {
      userResonatorId: string;
      weaponInstanceId?: string | null;
      activeEchoId?: string | null;
      sonataId?: string | null;
    }
  ): Promise<OwnedResonatorLoadout> {
    const payload = {
      user_id: userId,
      user_resonator_id: loadout.userResonatorId,
      weapon_instance_id: loadout.weaponInstanceId ?? null,
      active_echo_id: loadout.activeEchoId ?? null,
      sonata_id: loadout.sonataId ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('user_resonator_loadouts')
      .upsert(payload, { onConflict: 'user_id,user_resonator_id' })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to save resonator loadout: ${error?.message || 'Unknown error'}`);
    }

    return mapLoadoutRow(data);
  }

  /**
   * Deletes a Resonator loadout.
   */
  async deleteResonatorLoadout(userId: string, userResonatorId: string): Promise<void> {
    const { error } = await this.client
      .from('user_resonator_loadouts')
      .delete()
      .eq('user_id', userId)
      .eq('user_resonator_id', userResonatorId);

    if (error) {
      throw new Error(`Failed to delete resonator loadout: ${error.message}`);
    }
  }
}
