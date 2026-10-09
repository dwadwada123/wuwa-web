import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RecommendationApplicationService,
  type RecommendationViewModel,
  type RecommendationServiceRequest,
} from '../lib/services/recommendation/index.ts';
import {
  UserInventoryAdapter,
  type GameEntityResolver,
} from '../lib/services/recommendation/adapter.ts';
import { getCanonicalSeason40Stages } from '../lib/engine/toa-allocation/repository.ts';

class MockEntityResolver implements GameEntityResolver {
  private resonators = new Map<string, string>();
  private weapons = new Map<string, string>();
  private sonatas = new Map<string, string>();

  registerResonator(uuid: string, name: string) {
    this.resonators.set(uuid, name);
  }
  registerWeapon(uuid: string, name: string) {
    this.weapons.set(uuid, name);
  }
  registerSonata(uuid: string, name: string) {
    this.sonatas.set(uuid, name);
  }

  resolveResonatorName(id: string) {
    return this.resonators.get(id) ?? null;
  }
  resolveWeaponName(id: string) {
    return this.weapons.get(id) ?? null;
  }
  resolveSonataName(id: string) {
    return this.sonatas.get(id) ?? null;
  }
}

function createMockSupabase(params: {
  userId: string | null;
  resonators?: any[];
  weapons?: any[];
  loadouts?: any[];
  authError?: Error | null;
}) {
  const { userId, resonators = [], weapons = [], loadouts = [], authError = null } = params;

  const client: any = {
    auth: {
      getUser: async () => {
        if (authError) return { data: { user: null }, error: authError };
        if (!userId) return { data: { user: null }, error: null };
        return { data: { user: { id: userId, email: `${userId}@example.com` } }, error: null };
      },
    },
    from: (table: string) => {
      let currentData: any[] = [];
      if (table === 'user_resonators') currentData = resonators;
      if (table === 'user_weapons') currentData = weapons;
      if (table === 'user_resonator_loadouts') currentData = loadouts;

      const chain: any = {
        select: (_cols?: string) => chain,
        eq: (col: string, val: any) => {
          if (col === 'user_id') {
            currentData = currentData.filter((r) => r.user_id === val);
          }
          return chain;
        },
        then: (resolve: any) => {
          resolve({ data: currentData, error: null });
        },
      };
      return chain;
    },
  };

  return { client };
}

function setupCanonicalRoster(resolver: MockEntityResolver, userId: string) {
  const characterNames = [
    'Jinhsi',
    'Changli',
    'Shorekeeper',
    'Xiangli Yao',
    'Yinlin',
    'Verina',
    'Jiyan',
    'Mortefi',
    'Baizhi',
    'Chixia',
    'Sanhua',
    'Yangyang',
  ];

  const resonators: any[] = [];
  const weapons: any[] = [];
  const loadouts: any[] = [];

  resolver.registerWeapon('w-broadblade', 'Ages of Harvest');
  resolver.registerWeapon('w-sword', 'Emerald of Genesis');
  resolver.registerWeapon('w-rectifier', 'Cosmic Ripples');
  resolver.registerWeapon('w-gauntlets', 'Abyss Surges');
  resolver.registerWeapon('w-pistols', 'Static Mist');
  resolver.registerSonata('son-celestial', 'Celestial Light');

  const characterWeapons: Record<string, string> = {
    Jinhsi: 'w-broadblade',
    Changli: 'w-sword',
    Shorekeeper: 'w-rectifier',
    'Xiangli Yao': 'w-gauntlets',
    Yinlin: 'w-rectifier',
    Verina: 'w-rectifier',
    Jiyan: 'w-broadblade',
    Mortefi: 'w-pistols',
    Baizhi: 'w-rectifier',
    Chixia: 'w-pistols',
    Sanhua: 'w-sword',
    Yangyang: 'w-sword',
  };

  for (let i = 0; i < characterNames.length; i++) {
    const name = characterNames[i];
    const resUuid = `res-uuid-${i}`;
    const wepUuid = `wep-inst-${i}`;
    const loadoutUuid = `loadout-uuid-${i}`;

    resolver.registerResonator(resUuid, name);

    resonators.push({
      id: `ur-${i}`,
      user_id: userId,
      resonator_id: resUuid,
      level: 90,
      waveband: 0,
    });

    weapons.push({
      id: wepUuid,
      user_id: userId,
      weapon_id: characterWeapons[name],
      level: 90,
      refinement: 1,
    });

    loadouts.push({
      id: loadoutUuid,
      user_id: userId,
      user_resonator_id: `ur-${i}`,
      weapon_instance_id: wepUuid,
      active_echo_id: null,
      sonata_id: 'son-celestial',
    });
  }

  return { resonators, weapons, loadouts };
}

test('Tower UI Integration - RecommendationViewModel End-to-End Verification (Step 26)', async (t) => {
  const resolver = new MockEntityResolver();
  const userId = 'tower-ui-user';
  const { resonators, weapons, loadouts } = setupCanonicalRoster(resolver, userId);
  const { client } = createMockSupabase({ userId, resonators, weapons, loadouts });

  const adapter = new UserInventoryAdapter({ supabase: client, entityResolver: resolver });
  const service = new RecommendationApplicationService({ supabase: client, inventoryAdapter: adapter });

  await t.test('Full Cycle produces valid RecommendationViewModel conforming to Contract 7.25.1', async () => {
    const res = await service.executeRecommendation({ scope: 'FULL_CYCLE', targetK: 4 });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    const vm = res.data;

    // 1. Contract metadata
    assert.strictEqual(vm.serviceRuleVersion, '7.25.1');
    assert.strictEqual(vm.engineRuleVersion, '7.24.1');
    assert.strictEqual(vm.patchId, '3.7');
    assert.strictEqual(vm.seasonId, 'season:40');
    assert.strictEqual(vm.scope, 'FULL_CYCLE');

    // 2. Towers structure
    assert.strictEqual(vm.towers.length, 3);
    const towerNames = vm.towers.map((t) => t.towerName);
    assert.deepStrictEqual(towerNames, ['Resonant Tower', 'Hazard Tower', 'Echoing Tower']);

    // 3. Stages count and distribution
    assert.strictEqual(vm.stages.length, 12);
    const totalTowerStages = vm.towers.reduce((acc, t) => acc + t.stages.length, 0);
    assert.strictEqual(totalTowerStages, 12);

    for (const tower of vm.towers) {
      assert.strictEqual(tower.stages.length, 4, `Tower ${tower.towerName} must have exactly 4 stages`);
      for (const stage of tower.stages) {
        assert.ok(stage.stageId.length > 0);
        assert.ok(stage.floor >= 1 && stage.floor <= 4);
        assert.ok(stage.vigorCost > 0);
        assert.strictEqual(typeof stage.isAssigned, 'boolean');

        if (stage.isAssigned && stage.team) {
          assert.strictEqual(stage.team.members.length, 3);
          assert.strictEqual(stage.team.memberResonatorIds.length, 3);
          for (const m of stage.team.members) {
            assert.ok(m.resonatorId.length > 0);
            assert.ok(m.buildStatus.length > 0);
            assert.strictEqual(m.characterLevel, 90);
            assert.strictEqual(m.sequenceLevel, 0);
            assert.ok(m.equippedWeaponId !== null);
            assert.strictEqual(m.weaponLevel, 90);
            assert.strictEqual(m.weaponRefinement, 1);
            assert.strictEqual(m.activeSonataCode, 'Celestial Light');
          }
        }
      }
    }

    // 4. Metrics & Vigor Ledger
    assert.ok(vm.metrics.totalVigorConsumed > 0);
    assert.strictEqual(vm.vigorLedger.length, 12);
    const totalLedgerVigor = vm.vigorLedger.reduce((sum, v) => sum + v.vigorConsumed, 0);
    assert.strictEqual(vm.metrics.totalVigorConsumed, totalLedgerVigor);

    for (const v of vm.vigorLedger) {
      assert.strictEqual(v.startingVigor, 10);
      assert.strictEqual(v.startingVigor - v.vigorConsumed, v.vigorRemaining);
      assert.strictEqual(v.assignedStageIds.length, v.assignedStageCount);
    }

    // 5. Zero Prohibited Scoring Terms
    const stringified = JSON.stringify(vm);
    const prohibitedTerms = [
      'combatPower',
      'characterPower',
      'teamPower',
      'portfolioPower',
      'recommendationScore',
      'stageScore',
      'teamScore',
      'viabilityScore',
    ];

    for (const term of prohibitedTerms) {
      const regex = new RegExp(`"${term}"`, 'i');
      assert.strictEqual(
        regex.test(stringified),
        false,
        `Prohibited scoring term '${term}' must not exist in RecommendationViewModel`
      );
    }
  });

  await t.test('Infeasible / Small Roster produces factual ViewModel without error', async () => {
    const smallResolver = new MockEntityResolver();
    smallResolver.registerResonator('r-jin', 'Jinhsi');
    const { client: smallClient } = createMockSupabase({
      userId: 'small-user',
      resonators: [{ id: 'ur-1', user_id: 'small-user', resonator_id: 'r-jin', level: 90, waveband: 0 }],
      weapons: [],
      loadouts: [],
    });
    const smallService = new RecommendationApplicationService({
      supabase: smallClient,
      inventoryAdapter: new UserInventoryAdapter({ supabase: smallClient, entityResolver: smallResolver }),
    });

    const res = await smallService.executeRecommendation({ scope: 'FULL_CYCLE' });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.recommendationStatus, 'INSUFFICIENT_ROSTER');
    assert.strictEqual(res.data.metrics.assignedStageCount, 0);
    assert.strictEqual(res.data.metrics.selectedTeamCount, 0);
    assert.strictEqual(res.data.unallocatedStageIds.length, 12);
    assert.ok(res.data.formattedExplanation.includes('INSUFFICIENT_ROSTER'));
  });
});
