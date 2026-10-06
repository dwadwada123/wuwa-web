/**
 * User Inventory Domain Models
 *
 * Represents user-owned Resonators, weapon instances, and configured loadouts.
 * Decoupled from Supabase database rows.
 */

export interface OwnedResonator {
  id: string; // user_resonators record UUID
  userId: string;
  resonatorId: string; // canonical resonators.id UUID or code
  level: number;
  waveband: number;
  normalAttackLevel: number;
  resonanceSkillLevel: number;
  forteCircuitLevel: number;
  resonanceLiberationLevel: number;
  introSkillLevel: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OwnedWeapon {
  id: string; // user_weapons instance UUID
  userId: string;
  weaponId: string; // canonical weapons.id UUID
  level: number;
  refinement: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OwnedResonatorLoadout {
  id: string; // user_resonator_loadouts record UUID
  userId: string;
  userResonatorId: string; // user_resonators.id
  weaponInstanceId?: string | null; // user_weapons.id
  activeEchoId?: string | null;
  sonataId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
