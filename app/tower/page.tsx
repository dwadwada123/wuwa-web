import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SupabaseGameDataRepository } from '@/lib/data-access';
import { TowerOptimizerClient } from './tower-optimizer-client';
import type { ScopeTowerInfo } from './components/scope-selector';
import type { AvailableCycleMeta } from './types';

export const dynamic = 'force-dynamic';

export default async function TowerPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    redirect('/auth/login?redirect=/tower');
  }

  // 1. Authenticate user from session claims
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();

  if (authError || !claimsData?.claims?.sub) {
    redirect('/auth/login?redirect=/tower');
  }

  const userId = claimsData.claims.sub as string;

  // 2. Fetch owned resonators count and game data repository
  const gameDataRepo = new SupabaseGameDataRepository(supabase);

  const [userResonatorsRes, availableCyclesRaw, activeCycleData] = await Promise.all([
    supabase
      .from('user_resonators')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    gameDataRepo.getAvailableCycles(),
    gameDataRepo.getActiveOrLatestCycle(),
  ]);

  const ownedResonatorsCount = userResonatorsRes.count ?? 0;

  // Handle missing cycle data gracefully
  if (!activeCycleData || availableCyclesRaw.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-8 max-w-lg space-y-3">
          <h2 className="text-xl font-bold text-destructive">
            Missing Tower of Adversity Cycle Data
          </h2>
          <p className="text-sm text-muted-foreground">
            No active or published Tower of Adversity rotation snapshot could be resolved
            from the game data layer. Please ensure patch game facts have been ingested.
          </p>
        </div>
      </main>
    );
  }

  const { cycle } = activeCycleData;

  const availableCycles: AvailableCycleMeta[] = availableCyclesRaw.map((c) => ({
    id: c.id,
    patchId: c.patchId,
    patchVersion: c.patchVersion,
    cycleName: c.cycleName,
    startTime: c.startTime,
    endTime: c.endTime,
    isActive: c.isActive,
  }));

  const scopeTowers: ScopeTowerInfo[] = cycle.towers.map((t) => ({
    id: t.id,
    name: t.towerName,
    stages: t.stages.map((s) => ({
      id: s.id,
      stageIndex: s.stageIndex,
      vigorCost: s.vigorCost,
      towerId: t.id,
      towerName: t.towerName,
    })),
  }));

  return (
    <main className="min-h-screen bg-background">
      <TowerOptimizerClient
        availableCycles={availableCycles}
        initialCycleId={cycle.id}
        scopeTowers={scopeTowers}
        ownedResonatorsCount={ownedResonatorsCount}
      />
    </main>
  );
}
