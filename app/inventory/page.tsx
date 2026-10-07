import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InventoryManager, type ResonatorListItem } from './inventory-manager';

export const dynamic = 'force-dynamic';

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

  // Fetch canonical resonators and user's owned resonator references in parallel
  const [resonatorsRes, userResonatorsRes] = await Promise.all([
    supabase
      .from('resonators')
      .select('id, name, element, weapon_type, rarity, release_date')
      .order('rarity', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('user_resonators')
      .select('resonator_id')
      .eq('user_id', userId),
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

  const canonicalResonators: ResonatorListItem[] = (resonatorsRes.data || []).map((r) => ({
    id: r.id,
    name: r.name,
    element: r.element,
    weaponType: r.weapon_type,
    rarity: r.rarity,
    releaseDate: r.release_date,
  }));

  const initialOwnedIds: string[] = (userResonatorsRes.data || []).map((ur) => ur.resonator_id);

  return (
    <main className="min-h-screen bg-background">
      <InventoryManager
        resonators={canonicalResonators}
        initialOwnedIds={initialOwnedIds}
      />
    </main>
  );
}
