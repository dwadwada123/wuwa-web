'use client';

import type { StageResonatorViewModel } from '../types';

interface TeamDisplayProps {
  members: StageResonatorViewModel[];
}

const ELEMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Glacio: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  Fusion: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  Electro: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  Aero: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  Spectro: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Havoc: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
};

export function TeamDisplay({ members }: TeamDisplayProps) {
  if (!members || members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
        No team assigned to this stage
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {members.map((m, idx) => {
        const elStyle = ELEMENT_COLORS[m.element] || {
          bg: 'bg-secondary/40',
          text: 'text-foreground',
          border: 'border-border',
        };

        return (
          <div
            key={`${m.id}-${idx}`}
            className="flex flex-col justify-between rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm hover:border-border transition-colors"
          >
            <div>
              {/* Header: Element badge + Rarity */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold border ${elStyle.bg} ${elStyle.text} ${elStyle.border}`}
                >
                  {m.element}
                </span>
                <span className="text-[11px] font-bold text-amber-400 tracking-wider">
                  {'★'.repeat(m.rarity)}
                </span>
              </div>

              {/* Character Name & Role */}
              <div className="mt-2">
                <h4 className="text-sm font-bold text-foreground tracking-tight">
                  {m.name}
                </h4>
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {m.role}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.weaponType}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom: Investment & Weapon */}
            <div className="mt-3 pt-2 border-t border-border/40 text-[11px] space-y-0.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Investment</span>
                <span className="font-mono text-foreground font-medium">
                  {m.level ? `Lv. ${m.level}` : 'Lv. 90'}
                  {m.waveband !== undefined ? ` • S${m.waveband}` : ''}
                </span>
              </div>

              {m.equippedWeapon ? (
                <div className="flex items-center justify-between text-muted-foreground truncate">
                  <span className="shrink-0 mr-1">Weapon</span>
                  <span
                    className="font-medium text-foreground truncate"
                    title={m.equippedWeapon.name}
                  >
                    {m.equippedWeapon.name}
                    {m.equippedWeapon.level ? ` (${m.equippedWeapon.level})` : ''}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
