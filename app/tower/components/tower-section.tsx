'use client';

import type { RecommendationTowerGroupViewModel } from '@/lib/services/recommendation/types';
import { StageCard } from './stage-card';

interface TowerSectionProps {
  tower: RecommendationTowerGroupViewModel;
}

export function TowerSection({ tower }: TowerSectionProps) {
  return (
    <section className="space-y-4">
      {/* Tower Group Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 rounded-full bg-primary" />
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            {tower.towerName}
          </h3>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
            {tower.stages.length} {tower.stages.length === 1 ? 'Floor' : 'Floors'}
          </span>
        </div>
      </div>

      {/* Stage Cards List */}
      <div className="grid grid-cols-1 gap-4">
        {tower.stages.map((stage) => (
          <StageCard key={stage.stageId} stage={stage} />
        ))}
      </div>
    </section>
  );
}
