/**
 * Resonator Vigor Accounting & Constraint Validation
 *
 * Tracks cumulative vigor expenditure per character across assigned stages.
 * Guaranteed deterministic vigor checks without magic constants.
 */

import type { TeamCandidate, ToAStage } from '../../domain/types/index.ts';
import type { ResonatorVigorUsage, ToAOptimizationContext } from './types.ts';

export const DEFAULT_VIGOR_CAPACITY = 10;

export class VigorTracker {
  private capacities: Map<string, number> = new Map();
  private used: Map<string, number> = new Map();

  constructor(context: ToAOptimizationContext) {
    const defaultCap = context.defaultVigorCapacity ?? DEFAULT_VIGOR_CAPACITY;

    // Register all roster resonators
    for (const id of context.roster.resonatorIds) {
      this.capacities.set(id, defaultCap);
      this.used.set(id, 0);
    }

    // Apply explicit capacity overrides if provided
    if (context.vigorCapacities) {
      if (context.vigorCapacities instanceof Map) {
        for (const [id, cap] of context.vigorCapacities.entries()) {
          this.capacities.set(id, cap);
        }
      } else {
        for (const [id, cap] of Object.entries(context.vigorCapacities)) {
          this.capacities.set(id, cap);
        }
      }
    }
  }

  getCapacity(resonatorId: string): number {
    return this.capacities.get(resonatorId) ?? DEFAULT_VIGOR_CAPACITY;
  }

  getUsed(resonatorId: string): number {
    return this.used.get(resonatorId) ?? 0;
  }

  getRemaining(resonatorId: string): number {
    return this.getCapacity(resonatorId) - this.getUsed(resonatorId);
  }

  canAfford(team: TeamCandidate, stage: ToAStage): boolean {
    const cost = stage.vigorCost;
    for (const member of team.members) {
      const resId = member.resonator.id;
      const remaining = this.getRemaining(resId);
      if (remaining < cost) {
        return false;
      }
    }
    return true;
  }

  apply(team: TeamCandidate, stage: ToAStage): void {
    const cost = stage.vigorCost;
    for (const member of team.members) {
      const resId = member.resonator.id;
      this.used.set(resId, this.getUsed(resId) + cost);
    }
  }

  rollback(team: TeamCandidate, stage: ToAStage): void {
    const cost = stage.vigorCost;
    for (const member of team.members) {
      const resId = member.resonator.id;
      this.used.set(resId, Math.max(0, this.getUsed(resId) - cost));
    }
  }

  getTotalVigorConsumed(): number {
    let total = 0;
    for (const cost of this.used.values()) {
      total += cost;
    }
    return total;
  }

  getVigorUsageSummary(): ResonatorVigorUsage[] {
    const summary: ResonatorVigorUsage[] = [];
    const sortedIds = Array.from(this.capacities.keys()).sort();

    for (const id of sortedIds) {
      const capacity = this.getCapacity(id);
      const used = this.getUsed(id);
      summary.push({
        resonatorId: id,
        used,
        capacity,
        remaining: capacity - used,
      });
    }

    return summary;
  }
}
