import test from 'node:test';
import assert from 'node:assert/strict';

import { adaptInventoryToEngine } from '../lib/engine/adapters/inventory-adapter.ts';
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

test('Inventory Adapter - Canonical ID Preservation and Build Mapping', () => {
  const userRoster: OwnedRoster = {
    userId: 'user-alpha-001',
    resonatorIds: ['res-jinhsi', 'res-verina'],
    resonators: [
      {
        id: 'user-res-001',
        userId: 'user-alpha-001',
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
        id: 'user-res-002',
        userId: 'user-alpha-001',
        resonatorId: 'res-verina',
        level: 80,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 8,
        forteCircuitLevel: 8,
        resonanceLiberationLevel: 8,
        introSkillLevel: 6,
      },
    ],
    weapons: [
      {
        id: 'user-wep-001',
        userId: 'user-alpha-001',
        weaponId: 'weapon-age-of-harvest', // Broadblade
        level: 90,
        refinement: 1,
      },
    ],
    loadouts: [
      {
        id: 'user-loadout-001',
        userId: 'user-alpha-001',
        userResonatorId: 'user-res-001', // Jinhsi
        weaponInstanceId: 'user-wep-001',
      },
    ],
  };

  const adapted = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    availableWeapons: [ageOfHarvestWeapon, swordEmeraldGenesis],
  });

  // Verify canonical resonator IDs preserved
  assert.deepEqual(adapted.validResonatorIds, ['res-jinhsi', 'res-verina']);
  assert.equal(adapted.excludedResonatorIds.length, 0);

  // Verify builds mapped
  assert.equal(adapted.builds.size, 2);

  const jinhsiBuild = adapted.builds.get('res-jinhsi');
  assert.ok(jinhsiBuild);
  assert.equal(jinhsiBuild.resonator.id, 'res-jinhsi');
  assert.equal(jinhsiBuild.level, 90);
  assert.equal(jinhsiBuild.waveband, 2);
  assert.ok(jinhsiBuild.weapon);
  assert.equal(jinhsiBuild.weapon?.id, 'weapon-age-of-harvest');

  const verinaBuild = adapted.builds.get('res-verina');
  assert.ok(verinaBuild);
  assert.equal(verinaBuild.resonator.id, 'res-verina');
  assert.equal(verinaBuild.level, 80);
  assert.equal(verinaBuild.weapon, null); // No weapon equipped in loadout
});

test('Inventory Adapter - Weapon Type Mismatch Excluded', () => {
  const userRoster: OwnedRoster = {
    userId: 'user-mismatch',
    resonatorIds: ['res-verina'], // Verina is Rectifier
    resonators: [
      {
        id: 'user-res-verina',
        userId: 'user-mismatch',
        resonatorId: 'res-verina',
        level: 70,
        waveband: 0,
        normalAttackLevel: 1,
        resonanceSkillLevel: 1,
        forteCircuitLevel: 1,
        resonanceLiberationLevel: 1,
        introSkillLevel: 1,
      },
    ],
    weapons: [
      {
        id: 'user-wep-broadblade',
        userId: 'user-mismatch',
        weaponId: 'weapon-age-of-harvest', // Broadblade (incompatible with Rectifier!)
        level: 90,
        refinement: 1,
      },
    ],
    loadouts: [
      {
        id: 'user-loadout-invalid',
        userId: 'user-mismatch',
        userResonatorId: 'user-res-verina',
        weaponInstanceId: 'user-wep-broadblade',
      },
    ],
  };

  const adapted = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    availableWeapons: [ageOfHarvestWeapon],
  });

  const verinaBuild = adapted.builds.get('res-verina');
  assert.ok(verinaBuild);
  // Incompatible weapon must NOT be attached
  assert.equal(verinaBuild.weapon, null);
});

test('Inventory Adapter - Future Release Characters Preserved in Roster', () => {
  // User owns futureResonator (released in 2026-11-01)
  const userRoster: OwnedRoster = {
    userId: 'user-future',
    resonatorIds: ['res-jinhsi', futureResonator.id],
    resonators: [
      {
        id: 'ur-1',
        userId: 'user-future',
        resonatorId: 'res-jinhsi',
        level: 90,
        waveband: 0,
        normalAttackLevel: 1,
        resonanceSkillLevel: 1,
        forteCircuitLevel: 1,
        resonanceLiberationLevel: 1,
        introSkillLevel: 1,
      },
      {
        id: 'ur-2',
        userId: 'user-future',
        resonatorId: futureResonator.id,
        level: 90,
        waveband: 0,
        normalAttackLevel: 1,
        resonanceSkillLevel: 1,
        forteCircuitLevel: 1,
        resonanceLiberationLevel: 1,
        introSkillLevel: 1,
      },
    ],
  };

  // Under Patch 3.6 context, futureResonator is not released yet
  const adapted = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext36,
    availableResonators: availableResonatorsList,
  });

  // Adapter preserves both owned resonators; does not delete future characters
  assert.deepEqual(adapted.validResonatorIds, [futureResonator.id, 'res-jinhsi']);
  assert.ok(adapted.builds.has(futureResonator.id));
  assert.ok(adapted.builds.has('res-jinhsi'));
});

test('Inventory Adapter - Deterministic Byte-for-Byte Output', () => {
  const userRoster: OwnedRoster = {
    userId: 'user-det',
    resonatorIds: ['res-verina', 'res-jinhsi', 'res-jianxin'],
    resonators: [
      {
        id: 'ur-v',
        userId: 'user-det',
        resonatorId: 'res-verina',
        level: 80,
        waveband: 1,
        normalAttackLevel: 8,
        resonanceSkillLevel: 8,
        forteCircuitLevel: 8,
        resonanceLiberationLevel: 8,
        introSkillLevel: 8,
      },
      {
        id: 'ur-j',
        userId: 'user-det',
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
        id: 'ur-jx',
        userId: 'user-det',
        resonatorId: 'res-jianxin',
        level: 80,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
    ],
  };

  const adapted1 = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  });
  const adapted2 = adaptInventoryToEngine(userRoster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  });

  assert.equal(
    JSON.stringify(adapted1.roster),
    JSON.stringify(adapted2.roster),
    'Adapted roster must be byte-for-byte identical'
  );
  assert.deepEqual(adapted1.validResonatorIds, adapted2.validResonatorIds);
});
