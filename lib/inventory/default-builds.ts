/**
 * Default Builds & Asset Resolution Utility for Wuthering Waves
 *
 * Implements deterministic canonical weapon matching, optimal Sonata set resolution,
 * and official character avatar asset resolution with graceful fallbacks.
 *
 * Rules:
 * - Weapon and Sonata choices derived strictly from Patch 3.7 canonical dataset.
 * - Explicit fallback indicators if signature weapon is not individually cataloged.
 * - Max levels: Character Lv. 90, Weapon Lv. 90, Refinement 1 (5 for 4-star).
 */

import type { CanonicalWeaponItem, CanonicalSonataItem } from '@/app/inventory/types';

/**
 * Normalizes resonator names to Prydwen CDN slugs for verified avatar icons.
 */
const RESONATOR_SLUG_OVERRIDES: Record<string, string> = {
  'The Shorekeeper': 'the-shorekeeper',
  'Shorekeeper': 'the-shorekeeper',
  'Xiangli Yao': 'xiangli-yao',
  'Rover: Spectro': 'rover-spectro',
  'Rover: Havoc': 'rover-havoc',
  'Rover: Aero': 'rover-aero',
  'Rover: Electro': 'rover-electro',
  'Yangyang: Xuanling': 'yangyang-xuanling',
  'Luuk Herssen': 'luuk-herssen',
};

export function getResonatorAvatarUrl(name: string): string {
  const slug =
    RESONATOR_SLUG_OVERRIDES[name] ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  return `https://cdn.prydwen.gg/images/wuthering-waves/characters/${slug}_icon.webp`;
}

/**
 * Canonical signature 5-star weapons for specific resonators from Patch 3.7 dataset.
 */
export const CANONICAL_SIGNATURE_WEAPONS: Record<string, string> = {
  Jiyan: 'Verdant Summit',
  Jinhsi: 'Ages of Harvest',
  Changli: 'Blazing Brilliance',
  Camellya: 'Red Spring',
  Carlotta: 'Somnoire Anchor',
  Yinlin: 'Stringmaster',
  Zhezhi: 'Rime-Draped Sprouts',
  Shorekeeper: 'Stellar Symphony',
  'The Shorekeeper': 'Stellar Symphony',
  'Xiangli Yao': 'Veritys Handle',
  Cantarella: 'Whispers of the Deep',
  Phrolova: 'Blooming Jadehaven',
  Cartethyia: 'Unspoken Rue',
  Augusta: 'The Mountains Roar',
  Zani: 'Iron Grip of Justice',
  Galbrena: 'The Reckoning',
  Rebecca: 'Abyssal Decrescendo',
  Calcharo: 'Lustrous Razor',
  Verina: 'Cosmic Ripples',
  Encore: 'Cosmic Ripples',
  Jianxin: 'Abyss Surges',
  Lingyang: 'Abyss Surges',
  Lupa: 'The Mountains Roar',
  Chisa: 'The Mountains Roar',
  Ciaccona: 'The Reckoning',
  Lucy: 'Abyssal Decrescendo',
  Lynae: 'The Reckoning',
  'Luuk Herssen': 'Iron Grip of Justice',
  Iuno: 'Iron Grip of Justice',
  Sigrika: 'Iron Grip of Justice',
  Mornye: 'The Mountains Roar',
  Aemeath: 'Blazing Brilliance',
  Denia: 'Blooming Jadehaven',
  Lucilla: 'Rime-Draped Sprouts',
  Hiyuki: 'Somnoire Anchor',
  Suisui: 'Rime-Draped Sprouts',
  Qingxiao: 'Unspoken Rue',
  Hsin: 'Blooming Jadehaven',
  Jingran: 'The Mountains Roar',
  Suoming: 'Unspoken Rue',
  Phoebe: 'Cosmic Ripples',
  Brant: 'Blazing Brilliance',
  Qiuyuan: 'Unspoken Rue',
};

/**
 * Universal 5-star fallback weapons by weapon type from dataset.
 */
export const FALLBACK_5STAR_WEAPONS: Record<string, string> = {
  Broadblade: 'Lustrous Razor',
  Sword: 'Emerald of Genesis',
  Rectifier: 'Cosmic Ripples',
  Pistols: 'Static Mist',
  Gauntlets: 'Abyss Surges',
};

/**
 * Universal 4-star fallback weapons by weapon type from dataset.
 */
export const FALLBACK_4STAR_WEAPONS: Record<string, string> = {
  Broadblade: 'Discord',
  Sword: 'Commando of Conviction',
  Rectifier: 'Variation',
  Pistols: 'Novaburst',
  Gauntlets: 'Marcato',
};

/**
 * Resonators with primary Healer / Sustainer roles targeting Rejuvenating Glow.
 */
export const HEALER_RESONATORS = new Set([
  'Verina',
  'Baizhi',
  'Youhu',
  'Shorekeeper',
  'The Shorekeeper',
  'Buling',
]);

/**
 * Resonators with primary Sub-DPS / Buffing roles targeting Moonlit Clouds.
 */
export const BUFFER_RESONATORS = new Set([
  'Sanhua',
  'Mortefi',
  'Yangyang',
  'Zhezhi',
  'Ciaccona',
  'Taoqi',
  'Yuanwu',
]);

/**
 * Elemental matching sonata codes from Patch 3.7 dataset.
 */
export const ELEMENTAL_SONATA_CODES: Record<string, string> = {
  Glacio: 'FREEZING_FROST',
  Fusion: 'MOLTEN_RIFT',
  Electro: 'VOID_THUNDER',
  Aero: 'SIERRA_GALE',
  Spectro: 'CELESTIAL_LIGHT',
  Havoc: 'SUN_SINKING_ECLIPSE',
};

export interface ResolvedDefaultBuild {
  weapon: CanonicalWeaponItem | null;
  sonata: CanonicalSonataItem | null;
  isSignatureWeapon: boolean;
  isFallbackWeapon: boolean;
  weaponLabel: string;
  sonataLabel: string;
}

/**
 * Resolves the intelligent default build for any resonator from available canonical items.
 */
export function resolveResonatorDefaultBuild(
  resonator: { name: string; element: string; weaponType: string; rarity: number },
  availableWeapons: CanonicalWeaponItem[],
  availableSonatas: CanonicalSonataItem[]
): ResolvedDefaultBuild {
  // 1. Resolve Weapon
  const sigName = CANONICAL_SIGNATURE_WEAPONS[resonator.name];
  let matchedWeapon: CanonicalWeaponItem | null = null;
  let isSig = false;
  let isFallback = false;

  if (sigName) {
    matchedWeapon = availableWeapons.find((w) => w.name === sigName) || null;
    if (matchedWeapon) isSig = true;
  }

  // Fallback 1: 5-star weapon of matching type
  if (!matchedWeapon) {
    const fallback5Name = FALLBACK_5STAR_WEAPONS[resonator.weaponType];
    if (fallback5Name) {
      matchedWeapon = availableWeapons.find((w) => w.name === fallback5Name) || null;
      if (matchedWeapon) isFallback = true;
    }
  }

  // Fallback 2: Any 5-star or 4-star weapon of matching type
  if (!matchedWeapon) {
    matchedWeapon =
      availableWeapons
        .filter((w) => w.weaponType === resonator.weaponType)
        .sort((a, b) => b.rarity - a.rarity)[0] || null;
    if (matchedWeapon) isFallback = true;
  }

  // 2. Resolve Sonata
  let targetSonataCode: string;
  let sonataLabel = 'Elemental Set';

  if (HEALER_RESONATORS.has(resonator.name)) {
    targetSonataCode = 'REJUVENATING_GLOW';
    sonataLabel = 'Rejuvenating Glow (Healer)';
  } else if (BUFFER_RESONATORS.has(resonator.name)) {
    targetSonataCode = 'MOONLIT_CLOUDS';
    sonataLabel = 'Moonlit Clouds (Buffer)';
  } else {
    targetSonataCode = ELEMENTAL_SONATA_CODES[resonator.element] || 'LINGERING_TUNES';
    sonataLabel = `${resonator.element} Elemental Set`;
  }

  let matchedSonata = availableSonatas.find((s) => s.code === targetSonataCode) || null;
  if (!matchedSonata) {
    // Ultimate fallback
    matchedSonata = availableSonatas.find((s) => s.code === 'LINGERING_TUNES') || availableSonatas[0] || null;
  }

  return {
    weapon: matchedWeapon,
    sonata: matchedSonata,
    isSignatureWeapon: isSig,
    isFallbackWeapon: isFallback,
    weaponLabel: isSig
      ? 'Signature (Trấn)'
      : isFallback
      ? 'Recommended 5★ (Fallback)'
      : 'Default Weapon',
    sonataLabel,
  };
}
