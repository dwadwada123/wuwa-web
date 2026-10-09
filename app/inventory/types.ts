/**
 * Character Investment & Equipment Management Types
 * Phase 7 Work Package 1
 */

export interface CanonicalResonatorItem {
  id: string; // UUID from resonators.id
  name: string;
  element: string;
  weaponType: string;
  rarity: number;
  releaseDate: string;
}

export interface CanonicalWeaponItem {
  id: string; // UUID from weapons.id
  name: string;
  weaponType: string;
  rarity: number;
}

export interface CanonicalSonataItem {
  id: string; // UUID from sonatas.id
  name: string;
  code: string;
}

export interface EquippedWeaponInfo {
  weaponInstanceId?: string; // UUID from user_weapons.id
  weaponId: string; // UUID from weapons.id
  name: string;
  weaponType: string;
  rarity: number;
  level: number;
  refinement: number;
}

export interface EquippedSonataInfo {
  sonataId: string; // UUID from sonatas.id
  name: string;
  code: string;
}

export interface ResonatorInvestmentState {
  userResonatorId: string; // UUID from user_resonators.id
  resonatorId: string; // UUID from resonators.id
  level: number;
  waveband: number;
  weapon?: EquippedWeaponInfo | null;
  sonata?: EquippedSonataInfo | null;
}

export interface UpdateResonatorInvestmentInput {
  resonatorId: string; // Canonical resonators.id UUID
  characterLevel: number; // 1 to 90
  sequenceLevel: number; // 0 to 6
  weapon?: {
    weaponId: string; // Canonical weapons.id UUID
    level: number; // 1 to 90
    refinement: number; // 1 to 5
  } | null;
  sonataId?: string | null; // Canonical sonatas.id UUID or null
}

export interface UpdateResonatorInvestmentResponse {
  success: boolean;
  error?: string;
  data?: {
    userResonatorId: string;
    level: number;
    waveband: number;
    weaponInstanceId?: string | null;
    weaponId?: string | null;
    weaponLevel?: number | null;
    weaponRefinement?: number | null;
    sonataId?: string | null;
  };
}
