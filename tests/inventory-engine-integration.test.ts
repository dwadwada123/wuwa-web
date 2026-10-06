import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  generateTeamCandidates,
  adaptInventoryToEngine,
  getCandidateKey,
} from '../lib/engine/index.ts';

import type { OwnedRoster } from '../lib/domain/types/index.ts';

import {
  patchContext37,
  patchContext36,
  jinhsi,
  verina,
  jianxin,
  yangyang,
  futureResonator,
  availableResonatorsList,
  ageOfHarvestWeapon,
  swordEmeraldGenesis,
} from './fixtures/domain-fixtures.ts';

test('Engine Integration - Owned Resonators Appear, Unowned Resonators Excluded', () => {
  // User owns Jinhsi, Verina, and Yangyang. Jianxin is NOT owned.
  const userRoster: OwnedRoster = {
    userId: 'user-001',
    resonatorIds: ['res-jinhsi', 'res-verina', 'res-yangyang'],
    resonators: [
      {
        id: 'ur-jinhsi',
        userId: 'user-001',
        resonatorId: 'res-jinhsi',
        level: 90,
        waveband: 0,
        normalAttackLevel: 10,
        resonanceSkillLevel: 10,
        forteCircuitLevel: 10,
        resonanceLiberationLevel: 10,
        introSkillLevel: 10,
      },
      {
        id: 'ur-verina',
        userId: 'user-001',
        resonatorId: 'res-verina',
        level: 80,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
      {
        id: 'ur-yangyang',
        userId: 'user-001',
        resonatorId: 'res-yangyang',
        level: 70,
        waveband: 6,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
    ],
  };

  const adapted = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  });

  const candidates = generateTeamCandidates(adapted.roster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    builds: adapted.builds,
  });

  // Exactly 1 team candidate can be formed from 3 owned resonators
  assert.equal(candidates.length, 1);

  const teamMembers = candidates[0].members.map((m) => m.resonator.id);
  assert.ok(teamMembers.includes('res-jinhsi'));
  assert.ok(teamMembers.includes('res-verina'));
  assert.ok(teamMembers.includes('res-yangyang'));
  assert.ok(!teamMembers.includes('res-jianxin'), 'Unowned resonator Jianxin must NOT appear');
});

test('Engine Integration - Future Release Characters Remain Patch-Aware', () => {
  // User owns Jinhsi, Verina, Yangyang, AND futureResonator (released 2026-11-01)
  const userRoster: OwnedRoster = {
    userId: 'user-future-patch',
    resonatorIds: ['res-jinhsi', 'res-verina', 'res-yangyang', futureResonator.id],
    resonators: [
      {
        id: 'ur-1',
        userId: 'user-future-patch',
        resonatorId: 'res-jinhsi',
        level: 90,
        waveband: 0,
        normalAttackLevel: 10,
        resonanceSkillLevel: 10,
        forteCircuitLevel: 10,
        resonanceLiberationLevel: 10,
        introSkillLevel: 10,
      },
      {
        id: 'ur-2',
        userId: 'user-future-patch',
        resonatorId: 'res-verina',
        level: 80,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
      {
        id: 'ur-3',
        userId: 'user-future-patch',
        resonatorId: 'res-yangyang',
        level: 70,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
      {
        id: 'ur-4',
        userId: 'user-future-patch',
        resonatorId: futureResonator.id,
        level: 90,
        waveband: 0,
        normalAttackLevel: 10,
        resonanceSkillLevel: 10,
        forteCircuitLevel: 10,
        resonanceLiberationLevel: 10,
        introSkillLevel: 10,
      },
    ],
  };

  // 1. Under Patch 3.6 context (snapshot date: 2026-08-01, futureResonator released 2026-11-01)
  const adapted36 = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext36,
    availableResonators: availableResonatorsList,
  });

  const candidates36 = generateTeamCandidates(adapted36.roster, {
    patchContext: patchContext36,
    availableResonators: availableResonatorsList,
    builds: adapted36.builds,
  });

  // Exactly 1 team candidate because futureResonator is rejected by availability rule
  assert.equal(candidates36.length, 1);
  for (const c of candidates36) {
    const memberIds = c.members.map((m) => m.resonator.id);
    assert.ok(
      !memberIds.includes(futureResonator.id),
      'Future resonator must be excluded under Patch 3.6 context'
    );
  }

  // 2. Under a future snapshot date (e.g. 2026-12-01)
  const futurePatchContext = {
    patchId: 'patch-3-8-uuid',
    version: '3.8',
    snapshotDate: '2026-12-01',
  };

  const adaptedFuture = adaptInventoryToEngine(userRoster, {
    patchContext: futurePatchContext,
    availableResonators: availableResonatorsList,
  });

  const candidatesFuture = generateTeamCandidates(adaptedFuture.roster, {
    patchContext: futurePatchContext,
    availableResonators: availableResonatorsList,
    builds: adaptedFuture.builds,
  });

  // 4 resonators -> C(4, 3) = 4 team candidates!
  assert.equal(candidatesFuture.length, 4);
  const futureIncluded = candidatesFuture.some((c) =>
    c.members.map((m) => m.resonator.id).includes(futureResonator.id)
  );
  assert.ok(futureIncluded, 'Future resonator must be included under future patch context');
});

test('Engine Integration - Weapon Loadout Validity Propagates to Candidates', () => {
  const userRoster: OwnedRoster = {
    userId: 'user-wep-loadout',
    resonatorIds: ['res-jinhsi', 'res-verina', 'res-yangyang'],
    resonators: [
      {
        id: 'ur-jinhsi',
        userId: 'user-wep-loadout',
        resonatorId: 'res-jinhsi',
        level: 90,
        waveband: 2,
        normalAttackLevel: 10,
        resonanceSkillLevel: 10,
        forteCircuitLevel: 10,
        resonanceLiberationLevel: 10,
        introSkillLevel: 10,
      },
      {
        id: 'ur-verina',
        userId: 'user-wep-loadout',
        resonatorId: 'res-verina',
        level: 80,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
      {
        id: 'ur-yangyang',
        userId: 'user-wep-loadout',
        resonatorId: 'res-yangyang',
        level: 70,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
    ],
    weapons: [
      {
        id: 'user-wep-instance-1',
        userId: 'user-wep-loadout',
        weaponId: 'weapon-age-of-harvest',
        level: 90,
        refinement: 2,
      },
    ],
    loadouts: [
      {
        id: 'loadout-1',
        userId: 'user-wep-loadout',
        userResonatorId: 'ur-jinhsi',
        weaponInstanceId: 'user-wep-instance-1',
      },
    ],
  };

  const adapted = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    availableWeapons: [ageOfHarvestWeapon],
  });

  const candidates = generateTeamCandidates(adapted.roster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    builds: adapted.builds,
  });

  assert.equal(candidates.length, 1);
  const team = candidates[0];
  const jinhsiMember = team.members.find((m) => m.resonator.id === 'res-jinhsi');
  assert.ok(jinhsiMember);
  assert.equal(jinhsiMember.weapon?.id, 'weapon-age-of-harvest');
  assert.equal(jinhsiMember.level, 90);
  assert.equal(jinhsiMember.waveband, 2);
});

test('Security - Server Secret Keys Never Exposed in Client Bundles', () => {
  // Read client-side files
  const clientFiles = [
    path.resolve('app/inventory/inventory-manager.tsx'),
    path.resolve('lib/supabase/client.ts'),
  ];

  for (const filePath of clientFiles) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(
        !content.includes('SUPABASE_SECRET_KEY'),
        `Client file ${filePath} must not reference SUPABASE_SECRET_KEY`
      );
      assert.ok(
        !content.includes('SUPABASE_SERVICE_ROLE_KEY'),
        `Client file ${filePath} must not reference SUPABASE_SERVICE_ROLE_KEY`
      );
      assert.ok(
        !content.includes('service_role'),
        `Client file ${filePath} must not reference service_role`
      );
    }
  }
});
