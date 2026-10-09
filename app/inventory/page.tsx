import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InventoryManager } from './inventory-manager';
import type {
  CanonicalResonatorItem,
  CanonicalWeaponItem,
  CanonicalSonataItem,
  ResonatorInvestmentState,
  EquippedWeaponInfo,
  EquippedSonataInfo,
} from './types';

export const dynamic = 'force-dynamic';

// Module-level in-memory cache for static canonical reference data
interface CanonicalReferenceData {
  resonators: CanonicalResonatorItem[];
  weapons: CanonicalWeaponItem[];
  sonatas: CanonicalSonataItem[];
  cachedAt: number;
}

let canonicalCache: CanonicalReferenceData | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export default async function InventoryPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    redirect('/auth/login?redirect=/inventory');
  }

  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();

  if (authError || !claimsData?.claims?.sub) {
    redirect('/auth/login?redirect=/inventory');
  }

  const userId = claimsData.claims.sub as string;

  // Check if canonical reference data is cached
  const isCacheValid = canonicalCache && Date.now() - canonicalCache.cachedAt < CACHE_TTL_MS;

  const userPromises = Promise.all([
    supabase.from('user_resonators').select('*').eq('user_id', userId),
    supabase.from('user_weapons').select('*').eq('user_id', userId),
    supabase.from('user_resonator_loadouts').select('*').eq('user_id', userId),
  ]);

  let canonicalResonators: CanonicalResonatorItem[];
  let canonicalWeapons: CanonicalWeaponItem[];
  let canonicalSonatas: CanonicalSonataItem[];

  if (isCacheValid && canonicalCache) {
    canonicalResonators = canonicalCache.resonators;
    canonicalWeapons = canonicalCache.weapons;
    canonicalSonatas = canonicalCache.sonatas;
  } else {
    // Fetch canonical reference facts in parallel with sorting by release_date desc (newest first)
    const [resonatorsRes, weaponsRes, sonatasRes] = await Promise.all([
      supabase
        .from('resonators')
        .select('id, name, element, weapon_type, rarity, release_date')
        .order('release_date', { ascending: false })
        .order('rarity', { ascending: false })
        .order('name', { ascending: true }),
      supabase
        .from('weapons')
        .select('id, name, weapon_type, rarity')
        .order('rarity', { ascending: false })
        .order('name', { ascending: true }),
      supabase
        .from('sonatas')
        .select('id, name, code')
        .order('name', { ascending: true }),
    ]);

    if (resonatorsRes.error) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 max-w-md">
            <h2 className="text-lg font-bold text-destructive">Failed to Load Resonators</h2>
            <p className="mt-2 text-sm text-muted-foreground">{resonatorsRes.error.message}</p>
          </div>
        </main>
      );
    }

    canonicalResonators = (resonatorsRes.data || []).map((r) => ({
      id: r.id,
      name: r.name,
      element: r.element,
      weaponType: r.weapon_type,
      rarity: r.rarity,
      releaseDate: r.release_date,
    }));

    canonicalWeapons = (weaponsRes.data || []).map((w) => ({
      id: w.id,
      name: w.name,
      weaponType: w.weapon_type,
      rarity: w.rarity,
    }));

    canonicalSonatas = (sonatasRes.data || []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
    }));

    canonicalCache = {
      resonators: canonicalResonators,
      weapons: canonicalWeapons,
      sonatas: canonicalSonatas,
      cachedAt: Date.now(),
    };
  }

  const [userResonatorsRes, userWeaponsRes, userLoadoutsRes] = await userPromises;

  // Build mapping tables for efficient lookups
  const weaponDefMap = new Map(canonicalWeapons.map((w) => [w.id, w]));
  const sonataDefMap = new Map(canonicalSonatas.map((s) => [s.id, s]));
  const userWeaponMap = new Map((userWeaponsRes.data || []).map((uw) => [uw.id, uw]));
  const userLoadoutMap = new Map((userLoadoutsRes.data || []).map((ul) => [ul.user_resonator_id, ul]));

  const initialOwnedIds: string[] = (userResonatorsRes.data || []).map((ur) => ur.resonator_id);
  const initialInvestments: Record<string, ResonatorInvestmentState> = {};

  for (const ur of userResonatorsRes.data || []) {
    const loadout = userLoadoutMap.get(ur.id);
    let weaponInfo: EquippedWeaponInfo | null = null;

    if (loadout?.weapon_instance_id) {
      const userWep = userWeaponMap.get(loadout.weapon_instance_id);
      if (userWep) {
        const wepDef = weaponDefMap.get(userWep.weapon_id);
        weaponInfo = {
          weaponInstanceId: userWep.id,
          weaponId: userWep.weapon_id,
          name: wepDef?.name ?? 'Unknown Weapon',
          weaponType: wepDef?.weaponType ?? '',
          rarity: wepDef?.rarity ?? 4,
          level: userWep.level,
          refinement: userWep.refinement,
        };
      }
    }

    let sonataInfo: EquippedSonataInfo | null = null;
    if (loadout?.sonata_id) {
      const sonDef = sonataDefMap.get(loadout.sonata_id);
      if (sonDef) {
        sonataInfo = {
          sonataId: sonDef.id,
          name: sonDef.name,
          code: sonDef.code,
        };
      }
    }

    initialInvestments[ur.resonator_id] = {
      userResonatorId: ur.id,
      resonatorId: ur.resonator_id,
      level: ur.level,
      waveband: ur.waveband,
      weapon: weaponInfo,
      sonata: sonataInfo,
    };
  }

  return (
    <main className="min-h-screen bg-background">
      <InventoryManager
        resonators={canonicalResonators}
        initialOwnedIds={initialOwnedIds}
        canonicalWeapons={canonicalWeapons}
        canonicalSonatas={canonicalSonatas}
        initialInvestments={initialInvestments}
      />
    </main>
  );
}
