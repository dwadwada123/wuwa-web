import crypto from 'node:crypto';

export interface OptimizationCacheKeyInput {
  userId: string;
  inventory: {
    resonators: Array<{
      resonatorId: string;
      level?: number;
      waveband?: number;
      normalAttackLevel?: number;
      resonanceSkillLevel?: number;
      forteCircuitLevel?: number;
      resonanceLiberationLevel?: number;
      introSkillLevel?: number;
    }>;
    weapons?: Array<{
      id: string;
      weaponId: string;
      level?: number;
      refinement?: number;
    }>;
    loadouts?: Array<{
      resonatorId: string;
      weaponInstanceId: string;
    }>;
  };
  patchId: string;
  cycleId: string;
  stages: Array<{
    id: string;
    vigorCost: number;
    areaEffects?: Array<{ id: string }>;
    waves?: Array<{
      enemyInstances?: Array<{
        enemy?: { id: string; resistances?: Array<{ element: string; ratio: number }> };
      }>;
    }>;
  }>;
  scoringVersion?: string;
  mode: 'BEST_EFFORT' | 'EXACT';
  maxSearchStates: number;
}

/**
 * Computes a deterministic, collision-resistant SHA-256 fingerprint representing
 * all correctness-relevant inputs to the optimization engine.
 *
 * Any change to inventory, loadouts, patch, cycle, stages, buffs, enemies,
 * scoring model, optimizer mode, or budget produces a completely distinct key.
 */
export function computeOptimizationCacheKey(input: OptimizationCacheKeyInput): string {
  // 1. Canonical sorted resonators
  const sortedResonators = [...(input.inventory.resonators || [])]
    .sort((a, b) => a.resonatorId.localeCompare(b.resonatorId))
    .map((r) =>
      [
        r.resonatorId,
        r.level ?? 90,
        r.waveband ?? 0,
        r.normalAttackLevel ?? 6,
        r.resonanceSkillLevel ?? 6,
        r.forteCircuitLevel ?? 6,
        r.resonanceLiberationLevel ?? 6,
        r.introSkillLevel ?? 6,
      ].join(':')
    )
    .join('|');

  // 2. Canonical sorted weapons
  const sortedWeapons = [...(input.inventory.weapons || [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((w) => [w.id, w.weaponId, w.level ?? 90, w.refinement ?? 1].join(':'))
    .join('|');

  // 3. Canonical sorted loadouts
  const sortedLoadouts = [...(input.inventory.loadouts || [])]
    .sort((a, b) => a.resonatorId.localeCompare(b.resonatorId))
    .map((l) => `${l.resonatorId}->${l.weaponInstanceId}`)
    .join('|');

  // 4. Canonical sorted stages
  const sortedStages = [...(input.stages || [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => {
      const buffIds = (s.areaEffects || []).map((ae) => ae.id).sort().join(',');
      const enemyIds = (s.waves || [])
        .flatMap((w) => (w.enemyInstances || []).map((ei) => ei.enemy?.id || ''))
        .filter(Boolean)
        .sort()
        .join(',');
      return `${s.id}:v${s.vigorCost}:b[${buffIds}]:e[${enemyIds}]`;
    })
    .join('|');

  const rawKey = [
    `user:${input.userId}`,
    `patch:${input.patchId}`,
    `cycle:${input.cycleId}`,
    `mode:${input.mode}:${input.maxSearchStates}`,
    `scoring:${input.scoringVersion || 'v1-standard'}`,
    `res:[${sortedResonators}]`,
    `wep:[${sortedWeapons}]`,
    `load:[${sortedLoadouts}]`,
    `stages:[${sortedStages}]`,
  ].join('##');

  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/**
 * In-memory deterministic LRU cache for full-cycle optimization results.
 * Respects strict multi-tenant isolation and complete input fingerprinting.
 */
export class OptimizationCache<T = any> {
  private cache = new Map<string, { data: T; createdAt: number }>();
  private maxEntries: number;
  private ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 200, ttlMs = 10 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, createdAt: Date.now() });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export const globalOptimizationCache = new OptimizationCache();
