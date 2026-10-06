/**
 * Deterministic User Inventory to Engine Adapter
 *
 * Bridges persisted user inventory (OwnedRoster, user weapons, loadouts)
 * with the pure domain engine (ResonatorBuilds, canonical entities, PatchContext).
 *
 * Invariants:
 * - Preserves canonical entity IDs
 * - Excludes invalid user-owned references (e.g. nonexistent weapons or echoes)
 * - Enforces weapon-type compatibility between resonator and equipped weapon instance
 * - Never modifies database state
 * - Preserves future-release characters in roster (availability evaluated by engine via PatchContext)
 * - 100% deterministic output
 */

import type {
  OwnedRoster,
  PatchContext,
  Resonator,
  Weapon,
  Echo,
  Sonata,
  ResonatorBuild,
} from '../../domain/types/index.ts';

export interface InventoryAdapterOptions {
  patchContext: PatchContext;
  availableResonators: Resonator[] | Map<string, Resonator>;
  availableWeapons?: Weapon[] | Map<string, Weapon>;
  availableEchoes?: Echo[] | Map<string, Echo>;
  availableSonatas?: Sonata[] | Map<string, Sonata>;
}

export interface AdaptedEngineInventory {
  roster: OwnedRoster;
  builds: Map<string, ResonatorBuild>;
  validResonatorIds: string[];
  excludedResonatorIds: string[];
}

function toMap<T extends { id: string }>(items?: T[] | Map<string, T>): Map<string, T> {
  if (!items) return new Map();
  if (items instanceof Map) return items;
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
}

/**
 * Deterministically adapts user inventory into engine-ready builds and OwnedRoster.
 */
export function adaptInventoryToEngine(
  roster: OwnedRoster,
  options: InventoryAdapterOptions
): AdaptedEngineInventory {
  const resonatorMap = toMap(options.availableResonators);
  const weaponMap = toMap(options.availableWeapons);
  const echoMap = toMap(options.availableEchoes);
  const sonataMap = toMap(options.availableSonatas);

  // Index user weapon instances by user_weapons.id
  const userWeaponInstances = new Map<string, { weaponId: string; level: number; refinement: number }>();
  if (roster.weapons) {
    for (const w of roster.weapons) {
      userWeaponInstances.set(w.id, {
        weaponId: w.weaponId,
        level: w.level,
        refinement: w.refinement,
      });
    }
  }

  // Index user loadouts by user_resonator_id
  const userLoadouts = new Map<
    string,
    { weaponInstanceId?: string | null; activeEchoId?: string | null; sonataId?: string | null }
  >();
  if (roster.loadouts) {
    for (const l of roster.loadouts) {
      userLoadouts.set(l.userResonatorId, {
        weaponInstanceId: l.weaponInstanceId,
        activeEchoId: l.activeEchoId,
        sonataId: l.sonataId,
      });
    }
  }

  const builds = new Map<string, ResonatorBuild>();
  const validResonatorIds: string[] = [];
  const excludedResonatorIds: string[] = [];

  // Sort owned resonators deterministically by canonical resonatorId
  const ownedList = roster.resonators ? [...roster.resonators] : [];
  ownedList.sort((a, b) => a.resonatorId.localeCompare(b.resonatorId));

  for (const owned of ownedList) {
    const canonicalResonator = resonatorMap.get(owned.resonatorId);

    // If canonical resonator does not exist in game facts, exclude from valid engine set
    if (!canonicalResonator) {
      excludedResonatorIds.push(owned.resonatorId);
      continue;
    }

    const loadout = userLoadouts.get(owned.id);
    let equippedWeapon: Weapon | null = null;
    let equippedEcho: Echo | null = null;
    let equippedSonata: Sonata | null = null;

    if (loadout) {
      // 1. Resolve equipped weapon instance
      if (loadout.weaponInstanceId) {
        const weaponInst = userWeaponInstances.get(loadout.weaponInstanceId);
        if (weaponInst) {
          const canonicalWeapon = weaponMap.get(weaponInst.weaponId);
          // Check weapon type compatibility
          if (canonicalWeapon && canonicalWeapon.weaponType === canonicalResonator.weaponType) {
            equippedWeapon = canonicalWeapon;
          }
        }
      }

      // 2. Resolve active echo
      if (loadout.activeEchoId) {
        equippedEcho = echoMap.get(loadout.activeEchoId) ?? null;
      }

      // 3. Resolve sonata
      if (loadout.sonataId) {
        equippedSonata = sonataMap.get(loadout.sonataId) ?? null;
      }
    }

    const build: ResonatorBuild = {
      resonator: canonicalResonator,
      weapon: equippedWeapon,
      echo: equippedEcho,
      sonatas: equippedSonata ? [equippedSonata] : [],
      level: owned.level,
      waveband: owned.waveband,
    };

    builds.set(canonicalResonator.id, build);
    validResonatorIds.push(canonicalResonator.id);
  }

  // Ensure deterministic sorting of resonator IDs
  validResonatorIds.sort();
  excludedResonatorIds.sort();

  const adaptedRoster: OwnedRoster = {
    userId: roster.userId,
    resonatorIds: validResonatorIds,
    weaponIds: roster.weaponIds ? [...roster.weaponIds].sort() : [],
    echoIds: roster.echoIds ? [...roster.echoIds].sort() : [],
    resonators: roster.resonators ? [...roster.resonators] : [],
    weapons: roster.weapons ? [...roster.weapons] : [],
    loadouts: roster.loadouts ? [...roster.loadouts] : [],
  };

  return {
    roster: adaptedRoster,
    builds,
    validResonatorIds,
    excludedResonatorIds,
  };
}
