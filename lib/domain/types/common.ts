/**
 * Core Domain Types & Patch Execution Context
 */

export type Element = 'Glacio' | 'Fusion' | 'Electro' | 'Aero' | 'Spectro' | 'Havoc';

export type WeaponType = 'Broadblade' | 'Sword' | 'Pistols' | 'Gauntlets' | 'Rectifier';

export type Rarity = 3 | 4 | 5;

export type FunctionalRoleCode = 'MAIN_DPS' | 'SUB_DPS' | 'SUPPORT' | 'HEALER' | 'SHIELDER';

export interface PatchContext {
  patchId: string;
  version: string;
  cycleId?: string;
  snapshotDate?: string; // ISO date 'YYYY-MM-DD'
}
