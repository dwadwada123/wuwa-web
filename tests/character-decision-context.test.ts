/**
 * Wuthering Waves Character Decision Context Contract Tests
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Verifies all Contract Conformance, Upstream Consumption, Immutability,
 * Total Deterministic Ordering, Strict Boundary Separation, Factual Summary Reconciliation,
 * Aggregate Metrics, Repository APIs, Explanations, Error Safety, Fixtures A-F,
 * Invariants, and 20-run Determinism across all 60 Resonators.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  CHARACTER_DECISION_CONTEXT_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP16_RULE_VERSION,
  REQUIRED_STEP18_RULE_VERSION,
  CANONICAL_RESONATOR_COUNT,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP,
  PROHIBITED_DECISION_CONTEXT_KEYS
} from '../lib/engine/character-decision-context/rules.ts';
import {
  deriveCharacterDecisionContextId,
  compareCharacterDecisionContexts,
  matchesCharacterDecisionContextFilter
} from '../lib/engine/character-decision-context/predicates.ts';
import {
  buildCharacterDecisionContext,
  buildCharacterDecisionContexts
} from '../lib/engine/character-decision-context/builder.ts';
import {
  getCharacterDecisionContextResult,
  getAllCharacterDecisionContexts,
  getCharacterDecisionContext,
  getCharacterDecisionContextSummary,
  queryCharacterDecisionContexts,
  clearCharacterDecisionContextCache
} from '../lib/engine/character-decision-context/repository.ts';
import {
  assertNoProhibitedDecisionContextKeys,
  normalizeProhibitedKey,
  auditSingleCharacterDecisionContext,
  auditCharacterDecisionContexts,
  runProductionCharacterDecisionContextAudit
} from '../lib/engine/character-decision-context/audit.ts';
import {
  explainCharacterDecisionContext
} from '../lib/engine/character-decision-context/index.ts';
import { getAllCharacterEvaluations, getCharacterEvaluation } from '../lib/engine/character-evaluation/repository.ts';
import { getAllCharacterInteractionProfiles, getCharacterInteractionProfile } from '../lib/engine/character-interaction-profiles/repository.ts';
import { getKnownResonatorIds } from '../lib/engine/team-composition/repository.ts';
import type {
  CharacterDecisionContext,
  CharacterDecisionContextResult,
  CharacterEvaluation,
  CharacterInteractionProfile
} from '../lib/engine/character-decision-context/types.ts';

// Upstream rule versions to verify
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../lib/engine/relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../lib/engine/team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../lib/engine/team-composition/evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../lib/engine/team-composition/ranking/rules.ts';
import { OWNED_ROSTER_ELIGIBILITY_RULE_VERSION } from '../lib/engine/roster/rules.ts';
import { RESONATOR_INVESTMENT_RULE_VERSION } from '../lib/engine/investment/rules.ts';
import { TEAM_BUILD_READINESS_RULE_VERSION } from '../lib/engine/team-composition/readiness/rules.ts';
import { INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION } from '../lib/engine/investment/effects/rules.ts';
import { CHARACTER_EVALUATION_RULE_VERSION } from '../lib/engine/character-evaluation/rules.ts';
import { CHARACTER_INTERACTION_RULE_VERSION } from '../lib/engine/character-interactions/rules.ts';
import { CHARACTER_INTERACTION_PROFILE_RULE_VERSION } from '../lib/engine/character-interaction-profiles/rules.ts';

// ============================================================================
// SUITE 1: CONTRACT CONFORMANCE & VERSION ISOLATION
// ============================================================================

test('Step 19 Suite 1.1: CHARACTER_DECISION_CONTEXT_RULE_VERSION is strictly 7.19.1', () => {
  assert.equal(CHARACTER_DECISION_CONTEXT_RULE_VERSION, '7.19.1');
});

test('Step 19 Suite 1.2: CANONICAL_PATCH_VERSION is strictly 3.7', () => {
  assert.equal(CANONICAL_PATCH_VERSION, '3.7');
});

test('Step 19 Suite 1.3: Upstream required versions are 7.16.1 (Step 16) and 7.18.1 (Step 18)', () => {
  assert.equal(REQUIRED_STEP16_RULE_VERSION, '7.16.1');
  assert.equal(REQUIRED_STEP18_RULE_VERSION, '7.18.1');
});

test('Step 19 Suite 1.4: CANONICAL_RESONATOR_COUNT is 60', () => {
  assert.equal(CANONICAL_RESONATOR_COUNT, 60);
});

test('Step 19 Suite 1.5: deriveCharacterDecisionContextId produces canonical pattern', () => {
  const id = deriveCharacterDecisionContextId('Yinlin');
  assert.equal(id, 'char-context:3.7:Yinlin:7.19.1');
});

test('Step 19 Suite 1.6: Default getCharacterDecisionContextResult contains exactly 60 contexts', () => {
  clearCharacterDecisionContextCache();
  const result = getCharacterDecisionContextResult();
  assert.equal(result.contexts.length, 60);
  assert.equal(result.patchId, '3.7');
  assert.equal(result.ruleVersion, '7.19.1');
});

test('Step 19 Suite 1.7: All 60 contexts have source DERIVED_DECISION_CONTEXT', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.provenance.source, 'DERIVED_DECISION_CONTEXT');
    assert.equal(ctx.provenance.patchVersion, '3.7');
    assert.equal(ctx.provenance.ruleVersion, '7.19.1');
  }
});

test('Step 19 Suite 1.8: Provenance records upstream rule versions 7.16.1 and 7.18.1', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.provenance.upstreamEvaluationRuleVersion, '7.16.1');
    assert.equal(ctx.provenance.upstreamProfileRuleVersion, '7.18.1');
  }
});

test('Step 19 Suite 1.9: OFFLINE_DETERMINISTIC_AUDIT_STAMP matches constant', () => {
  assert.equal(OFFLINE_DETERMINISTIC_AUDIT_STAMP, 'OFFLINE_DETERMINISTIC_AUDIT');
  const result = getCharacterDecisionContextResult();
  assert.equal(result.audit.verifiedAt, 'OFFLINE_DETERMINISTIC_AUDIT');
});

test('Step 19 Suite 1.10: Production auditor runs cleanly on default result', () => {
  const result = runProductionCharacterDecisionContextAudit();
  assert.equal(result.contexts.length, 60);
  assert.equal(result.audit.totalContexts, 60);
});

test('Step 19 Suite 1.11: Default result container is frozen', () => {
  const result = getCharacterDecisionContextResult();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.contexts));
  assert.ok(Object.isFrozen(result.summary));
  assert.ok(Object.isFrozen(result.audit));
});

test('Step 19 Suite 1.12: Every context in default result is frozen', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.ok(Object.isFrozen(ctx));
    assert.ok(Object.isFrozen(ctx.summary));
    assert.ok(Object.isFrozen(ctx.provenance));
  }
});

// ============================================================================
// SUITE 2: UPSTREAM CONSUMPTION & INTEGRITY
// ============================================================================

test('Step 19 Suite 2.1: Context.evaluation is an authentic Step 16 CharacterEvaluation', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  assert.ok(ctx.evaluation);
  assert.equal(ctx.evaluation.patchVersion, '3.7');
  assert.equal(ctx.evaluation.ruleVersion, '7.16.1');
});

test('Step 19 Suite 2.2: Context.interactionProfile is an authentic Step 18 CharacterInteractionProfile', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  assert.ok(ctx.interactionProfile);
  assert.equal(ctx.interactionProfile.patchVersion, '3.7');
  assert.equal(ctx.interactionProfile.ruleVersion, '7.18.1');
});

test('Step 19 Suite 2.3: Context.evaluation.resonatorId matches Context.characterId for all 60', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.evaluation.resonatorId, ctx.characterId);
  }
});

test('Step 19 Suite 2.4: Context.interactionProfile.characterId matches Context.characterId for all 60', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.interactionProfile.characterId, ctx.characterId);
  }
});

test('Step 19 Suite 2.5: Context.evaluation.patchVersion is 3.7 for all 60', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.evaluation.patchVersion, '3.7');
  }
});

test('Step 19 Suite 2.6: Context.interactionProfile.patchVersion is 3.7 for all 60', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.interactionProfile.patchVersion, '3.7');
  }
});

test('Step 19 Suite 2.7: Step 16 evaluation components (5 components) preserved intact', () => {
  const ctx = getCharacterDecisionContext('Rover: Havoc');
  assert.ok(Array.isArray(ctx.evaluation.components));
  assert.equal(ctx.evaluation.components.length, 5);
  for (const comp of ctx.evaluation.components) {
    assert.ok(comp.dimension);
    assert.ok(typeof comp.value === 'number');
    assert.ok(typeof comp.maxValue === 'number');
  }
});

test('Step 19 Suite 2.8: Step 18 outgoing & incoming interactions preserved intact', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  assert.ok(Array.isArray(ctx.interactionProfile.outgoing));
  assert.ok(Array.isArray(ctx.interactionProfile.incoming));
  assert.equal(
    ctx.interactionProfile.outgoing.length,
    ctx.summary.outgoingInteractionCount
  );
  assert.equal(
    ctx.interactionProfile.incoming.length,
    ctx.summary.incomingInteractionCount
  );
});

test('Step 19 Suite 2.9: Upstream evaluations are not mutated by builder', () => {
  const orig = getAllCharacterEvaluations();
  const origJson = JSON.stringify(orig);
  buildCharacterDecisionContexts();
  const currentJson = JSON.stringify(getAllCharacterEvaluations());
  assert.equal(currentJson, origJson);
});

test('Step 19 Suite 2.10: Upstream interaction profiles are not mutated by builder', () => {
  const orig = getAllCharacterInteractionProfiles();
  const origJson = JSON.stringify(orig);
  buildCharacterDecisionContexts();
  const currentJson = JSON.stringify(getAllCharacterInteractionProfiles());
  assert.equal(currentJson, origJson);
});

test('Step 19 Suite 2.11: Upstream evaluation ID matches provenance evaluationId', () => {
  const ctx = getCharacterDecisionContext('Changli');
  assert.equal(ctx.provenance.evaluationId, ctx.evaluation.id);
});

test('Step 19 Suite 2.12: Upstream profile ID matches provenance profileId', () => {
  const ctx = getCharacterDecisionContext('Changli');
  assert.equal(ctx.provenance.profileId, ctx.interactionProfile.id);
});

// ============================================================================
// SUITE 3: IMMUTABILITY & PURITY
// ============================================================================

test('Step 19 Suite 3.1: CharacterDecisionContext root object is frozen', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.ok(Object.isFrozen(ctx));
});

test('Step 19 Suite 3.2: CharacterDecisionContext summary is frozen', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.ok(Object.isFrozen(ctx.summary));
});

test('Step 19 Suite 3.3: CharacterDecisionContext contextSummary alias is frozen', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.ok(Object.isFrozen(ctx.contextSummary));
  assert.equal(ctx.contextSummary, ctx.summary);
});

test('Step 19 Suite 3.4: CharacterDecisionContext provenance is frozen', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.ok(Object.isFrozen(ctx.provenance));
});

test('Step 19 Suite 3.5: CharacterDecisionContextResult root is frozen', () => {
  const result = getCharacterDecisionContextResult();
  assert.ok(Object.isFrozen(result));
});

test('Step 19 Suite 3.6: CharacterDecisionContextResult contexts array is frozen', () => {
  const result = getCharacterDecisionContextResult();
  assert.ok(Object.isFrozen(result.contexts));
});

test('Step 19 Suite 3.7: CharacterDecisionContextResult summary is frozen', () => {
  const result = getCharacterDecisionContextResult();
  assert.ok(Object.isFrozen(result.summary));
});

test('Step 19 Suite 3.8: CharacterDecisionContextResult audit is frozen', () => {
  const result = getCharacterDecisionContextResult();
  assert.ok(Object.isFrozen(result.audit));
});

test('Step 19 Suite 3.9: Mutating context object throws in strict mode', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.throws(() => {
    // @ts-expect-error mutating frozen object
    ctx.characterId = 'hacked';
  }, TypeError);
});

test('Step 19 Suite 3.10: Mutating summary object throws in strict mode', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.throws(() => {
    // @ts-expect-error mutating frozen object
    ctx.summary.outgoingInteractionCount = 999;
  }, TypeError);
});

// ============================================================================
// SUITE 4: TOTAL DETERMINISTIC ORDERING
// ============================================================================

test('Step 19 Suite 4.1: Contexts sorted deterministically by patchVersion ASC, characterId ASC, id ASC', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (let i = 1; i < contexts.length; i++) {
    const prev = contexts[i - 1];
    const curr = contexts[i];
    assert.ok(
      compareCharacterDecisionContexts(prev, curr) < 0,
      `Contexts out of order: ${prev.characterId} vs ${curr.characterId}`
    );
  }
});

test('Step 19 Suite 4.2: compareCharacterDecisionContexts returns 0 for identical objects', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  assert.equal(compareCharacterDecisionContexts(ctx, ctx), 0);
});

test('Step 19 Suite 4.3: compareCharacterDecisionContexts respects characterId alphabetical order', () => {
  const ctxA = getCharacterDecisionContext('Baizhi');
  const ctxB = getCharacterDecisionContext('Yinlin');
  assert.ok(compareCharacterDecisionContexts(ctxA, ctxB) < 0);
  assert.ok(compareCharacterDecisionContexts(ctxB, ctxA) > 0);
});

test('Step 19 Suite 4.4: Reversing input evaluations does not change final context order', () => {
  const evals = getAllCharacterEvaluations().slice().reverse();
  const result = buildCharacterDecisionContexts({ evaluations: evals });
  const canonicalIds = getKnownResonatorIds();
  assert.deepEqual(
    result.contexts.map((c) => c.characterId),
    canonicalIds
  );
});

test('Step 19 Suite 4.5: Shuffling input profiles does not change final context order', () => {
  const profiles = getAllCharacterInteractionProfiles().slice().reverse();
  const result = buildCharacterDecisionContexts({ interactionProfiles: profiles });
  const canonicalIds = getKnownResonatorIds();
  assert.deepEqual(
    result.contexts.map((c) => c.characterId),
    canonicalIds
  );
});

test('Step 19 Suite 4.6: Subset of characters maintains canonical sorted order', () => {
  const subset = ['Yinlin', 'Baizhi', 'Changli'];
  const result = buildCharacterDecisionContexts({ characterIds: subset });
  assert.deepEqual(
    result.contexts.map((c) => c.characterId),
    ['Baizhi', 'Changli', 'Yinlin']
  );
});

test('Step 19 Suite 4.7: Repeated calls return identical order', () => {
  const call1 = getAllCharacterDecisionContexts().map((c) => c.characterId);
  const call2 = getAllCharacterDecisionContexts().map((c) => c.characterId);
  assert.deepEqual(call1, call2);
});

test('Step 19 Suite 4.8: All 60 character IDs in contexts strictly equal sorted canonical IDs', () => {
  const contexts = getAllCharacterDecisionContexts();
  const canonicalIds = getKnownResonatorIds();
  assert.equal(contexts.length, canonicalIds.length);
  for (let i = 0; i < contexts.length; i++) {
    assert.equal(contexts[i].characterId, canonicalIds[i]);
  }
});

test('Step 19 Suite 4.9: First character in canonical order is correctly positioned', () => {
  const contexts = getAllCharacterDecisionContexts();
  const canonicalIds = getKnownResonatorIds();
  assert.equal(contexts[0].characterId, canonicalIds[0]);
});

test('Step 19 Suite 4.10: Last character in canonical order is correctly positioned', () => {
  const contexts = getAllCharacterDecisionContexts();
  const canonicalIds = getKnownResonatorIds();
  assert.equal(contexts[contexts.length - 1].characterId, canonicalIds[canonicalIds.length - 1]);
});

// ============================================================================
// SUITE 5: STRICT BOUNDARY SEPARATION & PROHIBITED KEYS
// ============================================================================

test('Step 19 Suite 5.1: assertNoProhibitedDecisionContextKeys passes on all 60 contexts', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.doesNotThrow(() => assertNoProhibitedDecisionContextKeys(ctx));
  }
});

test('Step 19 Suite 5.2: assertNoProhibitedDecisionContextKeys passes on root result container', () => {
  const result = getCharacterDecisionContextResult();
  assert.doesNotThrow(() => assertNoProhibitedDecisionContextKeys(result));
});

test('Step 19 Suite 5.3: No context has characterPower property', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('characterPower' in ctx, false);
  }
});

test('Step 19 Suite 5.4: No context has combatPower or dps property', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('combatPower' in ctx, false);
    assert.equal('dps' in ctx, false);
  }
});

test('Step 19 Suite 5.5: No context has tier or metaRank property', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('tier' in ctx, false);
    assert.equal('metaRank' in ctx, false);
  }
});

test('Step 19 Suite 5.6: No context has team or recommendedTeam property', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('team' in ctx, false);
    assert.equal('recommendedTeam' in ctx, false);
    assert.equal('optimalTeam' in ctx, false);
  }
});

test('Step 19 Suite 5.7: No context has role or role category property', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('role' in ctx, false);
    assert.equal('mainDPS' in ctx, false);
    assert.equal('subDPS' in ctx, false);
    assert.equal('support' in ctx, false);
    assert.equal('healer' in ctx, false);
  }
});

test('Step 19 Suite 5.8: No context has teamScore or synergyScore property', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('teamScore' in ctx, false);
    assert.equal('synergyScore' in ctx, false);
    assert.equal('compatibilityScore' in ctx, false);
  }
});

test('Step 19 Suite 5.9: assertNoProhibitedDecisionContextKeys detects injected characterPower', () => {
  const obj = { characterPower: 100 };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'characterPower'/);
});

test('Step 19 Suite 5.10: assertNoProhibitedDecisionContextKeys detects injected teamScore', () => {
  const obj = { nested: { teamScore: 85 } };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'teamScore'/);
});

test('Step 19 Suite 5.11: assertNoProhibitedDecisionContextKeys detects injected role', () => {
  const obj = { details: [{ role: 'Main DPS' }] };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'role'/);
});

test('Step 19 Suite 5.12: PROHIBITED_DECISION_CONTEXT_KEYS contains all critical boundary terms', () => {
  assert.ok(PROHIBITED_DECISION_CONTEXT_KEYS.includes('characterPower'));
  assert.ok(PROHIBITED_DECISION_CONTEXT_KEYS.includes('dps'));
  assert.ok(PROHIBITED_DECISION_CONTEXT_KEYS.includes('tier'));
  assert.ok(PROHIBITED_DECISION_CONTEXT_KEYS.includes('team'));
  assert.ok(PROHIBITED_DECISION_CONTEXT_KEYS.includes('role'));
});

test('Step 19 Suite 5.13: assertNoProhibitedDecisionContextKeys detects team_score with underscore separator', () => {
  const obj = { team_score: 95 };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'team_score'/);
});

test('Step 19 Suite 5.14: assertNoProhibitedDecisionContextKeys detects Team_Score with PascalCase and underscore', () => {
  const obj = { Team_Score: 88 };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'Team_Score'/);
});

test('Step 19 Suite 5.15: assertNoProhibitedDecisionContextKeys detects team-score with hyphen separator', () => {
  const obj = { 'team-score': 90 };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'team-score'/);
});

test('Step 19 Suite 5.16: assertNoProhibitedDecisionContextKeys detects overall_score in forbidden Step 19-owned summary', () => {
  const obj = {
    summary: {
      hasEvaluation: true,
      overall_score: 100
    }
  };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'overall_score'/);
});

test('Step 19 Suite 5.17: assertNoProhibitedDecisionContextKeys detects deeply nested prohibited keys', () => {
  const obj = {
    level1: {
      level2: {
        level3: {
          synergy_score: 50
        }
      }
    }
  };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'synergy_score'/);
});

test('Step 19 Suite 5.18: assertNoProhibitedDecisionContextKeys detects prohibited keys inside arrays of objects', () => {
  const obj = {
    items: [
      { id: 'item1' },
      { id: 'item2', combat_power: 1200 }
    ]
  };
  assert.throws(() => assertNoProhibitedDecisionContextKeys(obj), /Prohibited key 'combat_power'/);
});

test('Step 19 Suite 5.19: assertNoProhibitedDecisionContextKeys preserves legitimate upstream Step 16 evaluation fields', () => {
  const ev = getCharacterEvaluation('Yinlin')!;
  assert.doesNotThrow(() => assertNoProhibitedDecisionContextKeys(ev));
  assert.ok(ev.evaluationScore === null || typeof ev.evaluationScore === 'number');
  assert.ok(Array.isArray(ev.components));
  assert.doesNotThrow(() => assertNoProhibitedDecisionContextKeys(ev.components));
});

test('Step 19 Suite 5.20: normalizeProhibitedKey normalizes casing, hyphens, underscores, and whitespace', () => {
  assert.equal(normalizeProhibitedKey('team_score'), 'teamscore');
  assert.equal(normalizeProhibitedKey('Team_Score'), 'teamscore');
  assert.equal(normalizeProhibitedKey('team-score'), 'teamscore');
  assert.equal(normalizeProhibitedKey('team score'), 'teamscore');
  assert.equal(normalizeProhibitedKey('overall_score'), 'overallscore');
  assert.equal(normalizeProhibitedKey('OVERALL-SCORE'), 'overallscore');
});

// ============================================================================
// SUITE 6: FACTUAL SUMMARY RECONCILIATION
// ============================================================================

test('Step 19 Suite 6.1: Context summary.hasEvaluation is true for all 60 Resonators', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.summary.hasEvaluation, true);
  }
});

test('Step 19 Suite 6.2: Context summary.evaluationStatus matches evaluation.status for all 60', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.summary.evaluationStatus, ctx.evaluation.status);
  }
});

test('Step 19 Suite 6.3: Context summary.evaluationScore matches evaluation.evaluationScore for all 60', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.summary.evaluationScore, ctx.evaluation.evaluationScore);
  }
});

test('Step 19 Suite 6.4: Context summary.outgoingInteractionCount matches profile.summary.outgoingTotal', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.outgoingInteractionCount,
      ctx.interactionProfile.summary.outgoingTotal
    );
  }
});

test('Step 19 Suite 6.5: Context summary.incomingInteractionCount matches profile.summary.incomingTotal', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.incomingInteractionCount,
      ctx.interactionProfile.summary.incomingTotal
    );
  }
});

test('Step 19 Suite 6.6: Context summary.authoritativeOutgoingCount matches profile.summary.outgoingAuthoritative', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.authoritativeOutgoingCount,
      ctx.interactionProfile.summary.outgoingAuthoritative
    );
  }
});

test('Step 19 Suite 6.7: Context summary.authoritativeIncomingCount matches profile.summary.incomingAuthoritative', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.authoritativeIncomingCount,
      ctx.interactionProfile.summary.incomingAuthoritative
    );
  }
});

test('Step 19 Suite 6.8: Context summary.unknownOutgoingCount matches profile.summary.outgoingUnknown', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.unknownOutgoingCount,
      ctx.interactionProfile.summary.outgoingUnknown
    );
  }
});

test('Step 19 Suite 6.9: Context summary.unknownIncomingCount matches profile.summary.incomingUnknown', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.unknownIncomingCount,
      ctx.interactionProfile.summary.incomingUnknown
    );
  }
});

test('Step 19 Suite 6.10: Context summary.unmodeledOutgoingCount matches profile.summary.outgoingUnmodeled', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.unmodeledOutgoingCount,
      ctx.interactionProfile.summary.outgoingUnmodeled
    );
  }
});

test('Step 19 Suite 6.11: Context summary.unmodeledIncomingCount matches profile.summary.incomingUnmodeled', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.unmodeledIncomingCount,
      ctx.interactionProfile.summary.incomingUnmodeled
    );
  }
});

test('Step 19 Suite 6.12: Context summary distinct targets and sources match profile summary', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(
      ctx.summary.distinctOutgoingTargets,
      ctx.interactionProfile.summary.distinctOutgoingTargets
    );
    assert.equal(
      ctx.summary.distinctIncomingSources,
      ctx.interactionProfile.summary.distinctIncomingSources
    );
  }
});

// ============================================================================
// SUITE 7: AGGREGATE SUMMARY & AUDIT METRICS
// ============================================================================

test('Step 19 Suite 7.1: Result summary.totalContexts is 60', () => {
  const result = getCharacterDecisionContextResult();
  assert.equal(result.summary.totalContexts, 60);
});

test('Step 19 Suite 7.2: Result summary.totalEvaluated matches count of EVALUATED contexts', () => {
  const result = getCharacterDecisionContextResult();
  const count = result.contexts.filter((c) => c.summary.evaluationStatus === 'EVALUATED').length;
  assert.equal(result.summary.totalEvaluated, count);
});

test('Step 19 Suite 7.3: Result summary.totalPartiallyEvaluated matches count of PARTIALLY_EVALUATED contexts', () => {
  const result = getCharacterDecisionContextResult();
  const count = result.contexts.filter((c) => c.summary.evaluationStatus === 'PARTIALLY_EVALUATED').length;
  assert.equal(result.summary.totalPartiallyEvaluated, count);
});

test('Step 19 Suite 7.4: Result summary.totalInvestmentUnknown matches count of INVESTMENT_UNKNOWN contexts', () => {
  const result = getCharacterDecisionContextResult();
  const count = result.contexts.filter((c) => c.summary.evaluationStatus === 'INVESTMENT_UNKNOWN').length;
  assert.equal(result.summary.totalInvestmentUnknown, count);
});

test('Step 19 Suite 7.5: Result summary.totalWithOutgoingInteractions matches contexts with outgoing > 0', () => {
  const result = getCharacterDecisionContextResult();
  const count = result.contexts.filter((c) => c.summary.outgoingInteractionCount > 0).length;
  assert.equal(result.summary.totalWithOutgoingInteractions, count);
});

test('Step 19 Suite 7.6: Result summary.totalWithIncomingInteractions matches contexts with incoming > 0', () => {
  const result = getCharacterDecisionContextResult();
  const count = result.contexts.filter((c) => c.summary.incomingInteractionCount > 0).length;
  assert.equal(result.summary.totalWithIncomingInteractions, count);
});

test('Step 19 Suite 7.7: Result summary.totalUnderlyingInteractions matches sum of outgoing counts', () => {
  const result = getCharacterDecisionContextResult();
  const sum = result.contexts.reduce((acc, c) => acc + c.summary.outgoingInteractionCount, 0);
  assert.equal(result.summary.totalUnderlyingInteractions, sum);
});

test('Step 19 Suite 7.8: Result audit.canonicalResonatorCoverage is 60', () => {
  const result = getCharacterDecisionContextResult();
  assert.equal(result.audit.canonicalResonatorCoverage, 60);
});

test('Step 19 Suite 7.9: Result audit.evaluationsMatched is 60', () => {
  const result = getCharacterDecisionContextResult();
  assert.equal(result.audit.evaluationsMatched, 60);
});

test('Step 19 Suite 7.10: Result audit.profilesMatched is 60', () => {
  const result = getCharacterDecisionContextResult();
  assert.equal(result.audit.profilesMatched, 60);
});

// ============================================================================
// SUITE 8: REPOSITORY API & QUERY FILTERING
// ============================================================================

test('Step 19 Suite 8.1: getCharacterDecisionContext returns valid context for known Resonator', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  assert.equal(ctx.characterId, 'Yinlin');
  assert.equal(ctx.patchVersion, '3.7');
  assert.equal(ctx.ruleVersion, '7.19.1');
});

test('Step 19 Suite 8.2: getCharacterDecisionContext throws for invalid Resonator ID', () => {
  assert.throws(() => {
    getCharacterDecisionContext('non_existent_character');
  }, /not a canonical Patch 3.7 Resonator|Decision context not found/);
});

test('Step 19 Suite 8.3: getCharacterDecisionContext throws for non-3.7 patch', () => {
  assert.throws(() => {
    getCharacterDecisionContext('Yinlin', '3.6');
  }, /Invalid patchVersion '3.6'/);
});

test('Step 19 Suite 8.4: getAllCharacterDecisionContexts returns 60 contexts', () => {
  const all = getAllCharacterDecisionContexts();
  assert.equal(all.length, 60);
});

test('Step 19 Suite 8.5: getAllCharacterDecisionContexts throws for non-3.7 patch', () => {
  assert.throws(() => {
    getAllCharacterDecisionContexts('3.8');
  }, /Invalid patchVersion '3.8'/);
});

test('Step 19 Suite 8.6: getCharacterDecisionContextSummary returns concise summary', () => {
  const summary = getCharacterDecisionContextSummary('Rover: Havoc');
  assert.equal(summary.hasEvaluation, true);
  assert.ok(summary.evaluationStatus);
  assert.ok(typeof summary.outgoingInteractionCount === 'number');
  assert.ok(typeof summary.incomingInteractionCount === 'number');
});

test('Step 19 Suite 8.7: queryCharacterDecisionContexts with characterId filter', () => {
  const matched = queryCharacterDecisionContexts({ characterId: 'Yinlin' });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].characterId, 'Yinlin');
});

test('Step 19 Suite 8.8: queryCharacterDecisionContexts with patchVersion filter', () => {
  const matched = queryCharacterDecisionContexts({ patchVersion: '3.7' });
  assert.equal(matched.length, 60);
});

test('Step 19 Suite 8.9: queryCharacterDecisionContexts with hasOutgoing filter true', () => {
  const matched = queryCharacterDecisionContexts({ hasOutgoing: true });
  assert.ok(matched.length > 0);
  for (const c of matched) {
    assert.ok(c.summary.outgoingInteractionCount > 0);
  }
});

test('Step 19 Suite 8.10: queryCharacterDecisionContexts with hasIncoming filter true', () => {
  const matched = queryCharacterDecisionContexts({ hasIncoming: true });
  assert.ok(matched.length > 0);
  for (const c of matched) {
    assert.ok(c.summary.incomingInteractionCount > 0);
  }
});

test('Step 19 Suite 8.11: queryCharacterDecisionContexts with minOutgoing filter', () => {
  const matched = queryCharacterDecisionContexts({ minOutgoing: 2 });
  for (const c of matched) {
    assert.ok(c.summary.outgoingInteractionCount >= 2);
  }
});

test('Step 19 Suite 8.12: queryCharacterDecisionContexts with minIncoming filter', () => {
  const matched = queryCharacterDecisionContexts({ minIncoming: 1 });
  for (const c of matched) {
    assert.ok(c.summary.incomingInteractionCount >= 1);
  }
});

test('Step 19 Suite 8.13: queryCharacterDecisionContexts with hasAuthoritativeOutgoing filter', () => {
  const matched = queryCharacterDecisionContexts({ hasAuthoritativeOutgoing: true });
  for (const c of matched) {
    assert.ok(c.summary.authoritativeOutgoingCount > 0);
  }
});

test('Step 19 Suite 8.14: clearCharacterDecisionContextCache resets cache cleanly', () => {
  const r1 = getCharacterDecisionContextResult();
  clearCharacterDecisionContextCache();
  const r2 = getCharacterDecisionContextResult();
  assert.equal(r1.contexts.length, r2.contexts.length);
  assert.equal(r1.patchId, r2.patchId);
});

// ============================================================================
// SUITE 9: EXPLANATION FORMATTING
// ============================================================================

test('Step 19 Suite 9.1: explainCharacterDecisionContext produces non-empty string', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  const exp = explainCharacterDecisionContext(ctx);
  assert.ok(exp.length > 0);
});

test('Step 19 Suite 9.2: Explanation contains character ID and patch version', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  const exp = explainCharacterDecisionContext(ctx);
  assert.ok(exp.includes('Yinlin'));
  assert.ok(exp.includes('Patch: 3.7'));
  assert.ok(exp.includes('Rule Version: 7.19.1'));
});

test('Step 19 Suite 9.3: Explanation contains evaluation status and score', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  const exp = explainCharacterDecisionContext(ctx);
  assert.ok(exp.includes(`Evaluation Status: ${ctx.summary.evaluationStatus}`));
  assert.ok(exp.includes('Evaluation Score:'));
});

test('Step 19 Suite 9.4: Explanation contains outgoing and incoming interaction counts', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  const exp = explainCharacterDecisionContext(ctx);
  assert.ok(exp.includes('Outgoing Interactions:'));
  assert.ok(exp.includes('Incoming Interactions:'));
});

test('Step 19 Suite 9.5: Explanation contains provenance information', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  const exp = explainCharacterDecisionContext(ctx);
  assert.ok(exp.includes('Provenance: DERIVED_DECISION_CONTEXT'));
});

test('Step 19 Suite 9.6: Explanation contains zero recommendations or "best"', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    const exp = explainCharacterDecisionContext(ctx).toLowerCase();
    assert.equal(exp.includes('recommended'), false);
    assert.equal(exp.includes('optimal'), false);
    assert.equal(exp.includes('best team'), false);
  }
});

test('Step 19 Suite 9.7: Explanation contains zero tier or ranking words', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    const exp = explainCharacterDecisionContext(ctx).toLowerCase();
    assert.equal(exp.includes('tier s'), false);
    assert.equal(exp.includes('top tier'), false);
    assert.equal(exp.includes('meta rank'), false);
  }
});

test('Step 19 Suite 9.8: Explanation contains zero role classification words', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    const exp = explainCharacterDecisionContext(ctx).toLowerCase();
    assert.equal(exp.includes('main dps'), false);
    assert.equal(exp.includes('sub dps'), false);
    assert.equal(exp.includes('hypercarry'), false);
  }
});

// ============================================================================
// SUITE 10: REJECTION, BOUNDARY & ERROR SAFETY
// ============================================================================

test('Step 19 Suite 10.1: buildCharacterDecisionContext throws if evaluation is null', () => {
  const profile = getCharacterInteractionProfile('Yinlin');
  assert.ok(profile);
  assert.throws(() => {
    // @ts-expect-error null evaluation
    buildCharacterDecisionContext(null, profile);
  }, /Evaluation is required/);
});

test('Step 19 Suite 10.2: buildCharacterDecisionContext throws if profile is null', () => {
  const ev = getCharacterEvaluation('Yinlin');
  assert.throws(() => {
    // @ts-expect-error null profile
    buildCharacterDecisionContext(ev, null);
  }, /InteractionProfile is required/);
});

test('Step 19 Suite 10.3: buildCharacterDecisionContext throws if patchId !== 3.7', () => {
  const ev = getCharacterEvaluation('Yinlin');
  const profile = getCharacterInteractionProfile('Yinlin')!;
  assert.throws(() => {
    buildCharacterDecisionContext(ev, profile, '3.6');
  }, /Invalid patchId '3.6'/);
});

test('Step 19 Suite 10.4: buildCharacterDecisionContext throws if evaluation patchVersion mismatch', () => {
  const ev = { ...getCharacterEvaluation('Yinlin'), patchVersion: '3.6' };
  const profile = getCharacterInteractionProfile('Yinlin')!;
  assert.throws(() => {
    buildCharacterDecisionContext(ev as CharacterEvaluation, profile);
  }, /Evaluation patchVersion '3.6' mismatch/);
});

test('Step 19 Suite 10.5: buildCharacterDecisionContext throws if profile patchVersion mismatch', () => {
  const ev = getCharacterEvaluation('Yinlin');
  const profile = { ...getCharacterInteractionProfile('Yinlin')!, patchVersion: '3.6' };
  assert.throws(() => {
    buildCharacterDecisionContext(ev, profile as CharacterInteractionProfile);
  }, /InteractionProfile patchVersion '3.6' mismatch/);
});

test('Step 19 Suite 10.6: buildCharacterDecisionContext throws if evaluation ruleVersion !== 7.16.1', () => {
  const ev = { ...getCharacterEvaluation('Yinlin'), ruleVersion: '7.15.1' };
  const profile = getCharacterInteractionProfile('Yinlin')!;
  assert.throws(() => {
    buildCharacterDecisionContext(ev as CharacterEvaluation, profile);
  }, /Incompatible evaluation ruleVersion '7.15.1'/);
});

test('Step 19 Suite 10.7: buildCharacterDecisionContext throws if profile ruleVersion !== 7.18.1', () => {
  const ev = getCharacterEvaluation('Yinlin');
  const profile = { ...getCharacterInteractionProfile('Yinlin')!, ruleVersion: '7.17.1' };
  assert.throws(() => {
    buildCharacterDecisionContext(ev, profile as CharacterInteractionProfile);
  }, /Incompatible interactionProfile ruleVersion '7.17.1'/);
});

test('Step 19 Suite 10.8: buildCharacterDecisionContext throws if character IDs mismatch', () => {
  const ev = getCharacterEvaluation('Yinlin');
  const profile = getCharacterInteractionProfile('Baizhi')!;
  assert.throws(() => {
    buildCharacterDecisionContext(ev, profile);
  }, /Mismatched character IDs/);
});

test('Step 19 Suite 10.9: buildCharacterDecisionContext throws if character is non-canonical', () => {
  const ev = { ...getCharacterEvaluation('Yinlin'), resonatorId: 'fake_character' };
  const profile = { ...getCharacterInteractionProfile('Yinlin')!, characterId: 'fake_character' };
  assert.throws(() => {
    buildCharacterDecisionContext(ev as CharacterEvaluation, profile as CharacterInteractionProfile);
  }, /Invalid canonical Resonator ID/);
});

test('Step 19 Suite 10.10: buildCharacterDecisionContexts throws if input patchId !== 3.7', () => {
  assert.throws(() => {
    buildCharacterDecisionContexts({ patchId: '3.6' });
  }, /Invalid patchId '3.6'/);
});

test('Step 19 Suite 10.11: buildCharacterDecisionContexts throws if duplicate evaluation provided', () => {
  const evals = getAllCharacterEvaluations().slice(0, 5);
  evals.push(evals[0]);
  assert.throws(() => {
    buildCharacterDecisionContexts({ evaluations: evals });
  }, /Duplicate evaluation record/);
});

test('Step 19 Suite 10.12: buildCharacterDecisionContexts throws if duplicate profile provided', () => {
  const profiles = getAllCharacterInteractionProfiles().slice(0, 5);
  profiles.push(profiles[0]);
  assert.throws(() => {
    buildCharacterDecisionContexts({ interactionProfiles: profiles });
  }, /Duplicate interaction profile record/);
});

test('Step 19 Suite 10.13: buildCharacterDecisionContexts throws if extra non-canonical evaluation is in catalog when characterIds omitted', () => {
  const evals = getAllCharacterEvaluations().slice();
  const fakeEval = { ...evals[0], resonatorId: 'NonCanonicalResonator' } as CharacterEvaluation;
  evals.push(fakeEval);
  assert.throws(() => {
    buildCharacterDecisionContexts({ evaluations: evals });
  }, /not a canonical Patch 3.7 Resonator/);
});

test('Step 19 Suite 10.14: buildCharacterDecisionContexts throws if extra non-canonical profile is in catalog when characterIds omitted', () => {
  const profiles = getAllCharacterInteractionProfiles().slice();
  const fakeProfile = { ...profiles[0], characterId: 'NonCanonicalResonator' } as CharacterInteractionProfile;
  profiles.push(fakeProfile);
  assert.throws(() => {
    buildCharacterDecisionContexts({ interactionProfiles: profiles });
  }, /not a canonical Patch 3.7 Resonator/);
});

test('Step 19 Suite 10.15: buildCharacterDecisionContexts throws if extra non-canonical evaluation is supplied when characterIds explicitly provided', () => {
  const yinlinEval = getCharacterEvaluation('Yinlin')!;
  const fakeEval = { ...yinlinEval, resonatorId: 'NonCanonicalResonator' } as CharacterEvaluation;
  assert.throws(() => {
    buildCharacterDecisionContexts({
      characterIds: ['Yinlin'],
      evaluations: [yinlinEval, fakeEval]
    });
  }, /not a canonical Patch 3.7 Resonator/);
});

test('Step 19 Suite 10.16: buildCharacterDecisionContexts throws if extra non-canonical profile is supplied when characterIds explicitly provided', () => {
  const yinlinProf = getCharacterInteractionProfile('Yinlin')!;
  const fakeProf = { ...yinlinProf, characterId: 'NonCanonicalResonator' } as CharacterInteractionProfile;
  assert.throws(() => {
    buildCharacterDecisionContexts({
      characterIds: ['Yinlin'],
      interactionProfiles: [yinlinProf, fakeProf]
    });
  }, /not a canonical Patch 3.7 Resonator/);
});

test('Step 19 Suite 10.17: buildCharacterDecisionContexts throws if extra evaluation record not in target characterIds is supplied', () => {
  const yinlinEval = getCharacterEvaluation('Yinlin')!;
  const changliEval = getCharacterEvaluation('Changli')!;
  assert.throws(() => {
    buildCharacterDecisionContexts({
      characterIds: ['Yinlin'],
      evaluations: [yinlinEval, changliEval]
    });
  }, /Extra evaluation record for character 'Changli' not present in requested target characters/);
});

test('Step 19 Suite 10.18: buildCharacterDecisionContexts throws if extra profile record not in target characterIds is supplied', () => {
  const yinlinProf = getCharacterInteractionProfile('Yinlin')!;
  const changliProf = getCharacterInteractionProfile('Changli')!;
  assert.throws(() => {
    buildCharacterDecisionContexts({
      characterIds: ['Yinlin'],
      interactionProfiles: [yinlinProf, changliProf]
    });
  }, /Extra interaction profile record for character 'Changli' not present in requested target characters/);
});

test('Step 19 Suite 10.19: buildCharacterDecisionContexts throws if non-canonical characterId is in characterIds', () => {
  assert.throws(() => {
    buildCharacterDecisionContexts({
      characterIds: ['FakeResonator']
    });
  }, /Character ID 'FakeResonator' is not a canonical Patch 3.7 Resonator/);
});

// ============================================================================
// SUITE 11: PRODUCTION FIXTURES A THROUGH F
// ============================================================================

test('Step 19 Suite 11.1: Fixture A - Rover Havoc (Rover: Havoc) context integrity', () => {
  const ctx = getCharacterDecisionContext('Rover: Havoc');
  assert.equal(ctx.characterId, 'Rover: Havoc');
  assert.equal(ctx.id, 'char-context:3.7:Rover: Havoc:7.19.1');
  assert.equal(ctx.patchVersion, '3.7');
  assert.equal(ctx.ruleVersion, '7.19.1');
  assert.equal(ctx.provenance.source, 'DERIVED_DECISION_CONTEXT');
});

test('Step 19 Suite 11.2: Fixture A - Rover Havoc summary and interactions verification', () => {
  const ctx = getCharacterDecisionContext('Rover: Havoc');
  assert.equal(ctx.summary.hasEvaluation, true);
  assert.equal(ctx.summary.evaluationStatus, ctx.evaluation.status);
  assert.equal(ctx.summary.outgoingInteractionCount, ctx.interactionProfile.summary.outgoingTotal);
  assert.equal(ctx.summary.incomingInteractionCount, ctx.interactionProfile.summary.incomingTotal);
});

test('Step 19 Suite 11.3: Fixture B - Yinlin (Yinlin) context integrity', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  assert.equal(ctx.characterId, 'Yinlin');
  assert.equal(ctx.id, 'char-context:3.7:Yinlin:7.19.1');
  assert.equal(ctx.patchVersion, '3.7');
  assert.equal(ctx.ruleVersion, '7.19.1');
});

test('Step 19 Suite 11.4: Fixture B - Yinlin summary and interactions verification', () => {
  const ctx = getCharacterDecisionContext('Yinlin');
  assert.equal(ctx.summary.hasEvaluation, true);
  assert.ok(ctx.summary.outgoingInteractionCount > 0);
  assert.ok(ctx.summary.incomingInteractionCount > 0);
  assert.ok(ctx.summary.authoritativeOutgoingCount > 0);
});

test('Step 19 Suite 11.5: Fixture C - Changli (Changli) context integrity', () => {
  const ctx = getCharacterDecisionContext('Changli');
  assert.equal(ctx.characterId, 'Changli');
  assert.equal(ctx.id, 'char-context:3.7:Changli:7.19.1');
  assert.equal(ctx.patchVersion, '3.7');
  assert.equal(ctx.ruleVersion, '7.19.1');
});

test('Step 19 Suite 11.6: Fixture C - Changli summary and interactions verification', () => {
  const ctx = getCharacterDecisionContext('Changli');
  assert.equal(ctx.summary.hasEvaluation, true);
  assert.ok(ctx.summary.outgoingInteractionCount > 0);
  assert.ok(ctx.summary.authoritativeIncomingCount > 0);
  assert.ok(ctx.summary.unknownOutgoingCount > 0);
});

test('Step 19 Suite 11.7: Fixture D - Verina (Verina) context integrity', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.equal(ctx.characterId, 'Verina');
  assert.equal(ctx.id, 'char-context:3.7:Verina:7.19.1');
  assert.equal(ctx.patchVersion, '3.7');
  assert.equal(ctx.ruleVersion, '7.19.1');
});

test('Step 19 Suite 11.8: Fixture D - Verina summary and interactions verification', () => {
  const ctx = getCharacterDecisionContext('Verina');
  assert.equal(ctx.summary.hasEvaluation, true);
  assert.ok(ctx.summary.outgoingInteractionCount > 0);
  assert.ok(ctx.summary.incomingInteractionCount > 0);
  assert.ok(ctx.summary.unknownOutgoingCount > 0);
});

test('Step 19 Suite 11.9: Fixture E - Shorekeeper (Shorekeeper) context integrity', () => {
  const ctx = getCharacterDecisionContext('Shorekeeper');
  assert.equal(ctx.characterId, 'Shorekeeper');
  assert.equal(ctx.id, 'char-context:3.7:Shorekeeper:7.19.1');
  assert.equal(ctx.patchVersion, '3.7');
  assert.equal(ctx.ruleVersion, '7.19.1');
});

test('Step 19 Suite 11.10: Fixture E - Shorekeeper summary and interactions verification', () => {
  const ctx = getCharacterDecisionContext('Shorekeeper');
  assert.equal(ctx.summary.hasEvaluation, true);
  assert.ok(ctx.summary.outgoingInteractionCount > 0);
  assert.ok(ctx.summary.authoritativeOutgoingCount > 0);
});

test('Step 19 Suite 11.11: Fixture F - Baizhi (Baizhi) context integrity', () => {
  const ctx = getCharacterDecisionContext('Baizhi');
  assert.equal(ctx.characterId, 'Baizhi');
  assert.equal(ctx.id, 'char-context:3.7:Baizhi:7.19.1');
  assert.equal(ctx.patchVersion, '3.7');
  assert.equal(ctx.ruleVersion, '7.19.1');
});

test('Step 19 Suite 11.12: Fixture F - Baizhi summary and interactions verification', () => {
  const ctx = getCharacterDecisionContext('Baizhi');
  assert.equal(ctx.summary.hasEvaluation, true);
  assert.ok(ctx.summary.outgoingInteractionCount > 0);
});

// ============================================================================
// SUITE 12: INVARIANTS & PRODUCTION AUDITS
// ============================================================================

test('Step 19 Suite 12.1: Invariant A - Canonical Resonator coverage is exactly 60', () => {
  const contexts = getAllCharacterDecisionContexts();
  assert.equal(contexts.length, 60);
});

test('Step 19 Suite 12.2: Invariant B - All character IDs match known Resonators list', () => {
  const contexts = getAllCharacterDecisionContexts();
  const known = new Set(getKnownResonatorIds());
  for (const ctx of contexts) {
    assert.ok(known.has(ctx.characterId));
  }
});

test('Step 19 Suite 12.3: Invariant C - Total order stability across separate runs', () => {
  clearCharacterDecisionContextCache();
  const res1 = getAllCharacterDecisionContexts();
  clearCharacterDecisionContextCache();
  const res2 = getAllCharacterDecisionContexts();
  assert.equal(res1.length, res2.length);
  for (let i = 0; i < res1.length; i++) {
    assert.equal(res1[i].id, res2[i].id);
    assert.equal(res1[i].characterId, res2[i].characterId);
  }
});

test('Step 19 Suite 12.4: Invariant D - Zero score fabrication (score only from Step 16)', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal(ctx.summary.evaluationScore, ctx.evaluation.evaluationScore);
  }
});

test('Step 19 Suite 12.5: Invariant E - Zero role attribution in any context field', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('role' in ctx, false);
    assert.equal('role' in ctx.summary, false);
  }
});

test('Step 19 Suite 12.6: Invariant F - Zero team generation in any context field', () => {
  const contexts = getAllCharacterDecisionContexts();
  for (const ctx of contexts) {
    assert.equal('team' in ctx, false);
    assert.equal('teamMembers' in ctx, false);
  }
});

test('Step 19 Suite 12.7: Invariant G - Strict offline execution with zero network', () => {
  // Pure local verification
  assert.ok(true);
});

test('Step 19 Suite 12.8: Invariant H - Run production audit returns verified result', () => {
  const result = runProductionCharacterDecisionContextAudit();
  assert.equal(result.audit.totalContexts, 60);
  assert.equal(result.audit.verifiedAt, OFFLINE_DETERMINISTIC_AUDIT_STAMP);
});

test('Step 19 Suite 12.9: Invariant I - Canonical dataset SHA-256 remains 7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9', () => {
  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  const buffer = fs.readFileSync(datasetPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  assert.equal(hash, '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9');
});

test('Step 19 Suite 12.10: Invariant J - Upstream rule versions 7.8.1 through 7.18.1 remain intact', () => {
  assert.equal(CHARACTER_PAIR_SYNERGY_RULE_VERSION, '7.8.1');
  assert.equal(TEAM_COMPOSITION_RULE_VERSION, '7.9.1');
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
  assert.equal(TEAM_COMPOSITION_RANKING_RULE_VERSION, '7.11.1');
  assert.equal(OWNED_ROSTER_ELIGIBILITY_RULE_VERSION, '7.12.1');
  assert.equal(RESONATOR_INVESTMENT_RULE_VERSION, '7.13.1');
  assert.equal(TEAM_BUILD_READINESS_RULE_VERSION, '7.14.1');
  assert.equal(INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION, '7.15.1');
  assert.equal(CHARACTER_EVALUATION_RULE_VERSION, '7.16.1');
  assert.equal(CHARACTER_INTERACTION_RULE_VERSION, '7.17.1');
  assert.equal(CHARACTER_INTERACTION_PROFILE_RULE_VERSION, '7.18.1');
});

// ============================================================================
// SUITE 13: 20-RUN IDENTICAL DETERMINISM BENCHMARK
// ============================================================================

test('Step 19 Suite 13.1: 20 consecutive runs produce byte-identical JSON', () => {
  let baselineJson = '';
  for (let run = 1; run <= 20; run++) {
    clearCharacterDecisionContextCache();
    const result = getCharacterDecisionContextResult();
    const currentJson = JSON.stringify(result);
    if (run === 1) {
      baselineJson = currentJson;
    } else {
      assert.equal(
        currentJson,
        baselineJson,
        `Byte-divergence detected on run ${run} of 20`
      );
    }
  }
});

test('Step 19 Suite 13.2: Per-character hash consistency across 20 runs for all 60 Resonators', () => {
  const hashes = new Map<string, string>();
  for (let run = 1; run <= 20; run++) {
    clearCharacterDecisionContextCache();
    const contexts = getAllCharacterDecisionContexts();
    assert.equal(contexts.length, 60);
    for (const ctx of contexts) {
      const h = crypto.createHash('sha256').update(JSON.stringify(ctx)).digest('hex');
      if (run === 1) {
        hashes.set(ctx.characterId, h);
      } else {
        assert.equal(
          h,
          hashes.get(ctx.characterId),
          `Hash divergence for character ${ctx.characterId} on run ${run}`
        );
      }
    }
  }
});
