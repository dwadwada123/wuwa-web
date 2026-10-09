'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { RecommendationTeamMemberViewModel } from '@/lib/services/recommendation/types';
import { ElementIcon, ELEMENT_PALETTES } from '@/components/element-icon';
import {
  getResonatorAvatarUrl,
  HEALER_RESONATORS,
  BUFFER_RESONATORS,
} from '@/lib/inventory/default-builds';
import { CANONICAL_RESONATOR_METADATA } from '@/lib/engine/character-build-evaluation/rules';

interface TeamDisplayProps {
  members: readonly RecommendationTeamMemberViewModel[];
}

function getBuildStatusBadge(status: string) {
  switch (status) {
    case 'READY':
      return {
        className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        label: 'Build Ready',
      };
    case 'ACCEPTABLE':
      return {
        className: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
        label: 'Acceptable',
      };
    case 'NOT_READY':
      return {
        className: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        label: 'Not Ready',
      };
    case 'UNINVESTED':
    default:
      return {
        className: 'bg-secondary/80 border-border text-muted-foreground',
        label: status,
      };
  }
}

function getCharacterRole(name: string, memberIdx: number): { role: string; roleColor: string } {
  if (HEALER_RESONATORS.has(name)) {
    return { role: 'Hồi phục (Sustainer)', roleColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  }
  if (BUFFER_RESONATORS.has(name)) {
    return { role: 'Hỗ trợ (Sub-DPS / Buffer)', roleColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
  }
  if (memberIdx === 0) {
    return { role: 'Sát thương chính (Main DPS)', roleColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
  }
  return { role: 'Sát thương phụ (Sub-DPS)', roleColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
}

export function TeamDisplay({ members }: TeamDisplayProps) {
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

  if (!members || members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 p-5 text-center text-xs text-muted-foreground bg-secondary/10">
        Chưa có đội hình được phân bổ cho tầng này
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {members.map((m, idx) => {
        const buildBadge = getBuildStatusBadge(m.buildStatus);
        const meta = CANONICAL_RESONATOR_METADATA[m.resonatorId];
        const element = meta?.element || 'Glacio';
        const is5Star = meta?.rarity === 5;
        const roleInfo = getCharacterRole(m.resonatorId, idx);
        const avatarUrl = getResonatorAvatarUrl(m.resonatorId);
        const hasError = avatarErrors.has(m.resonatorId);

        const palette = ELEMENT_PALETTES[element] || {
          color: '#94a3b8',
          bg: 'bg-secondary/40',
          border: 'border-border',
          text: 'text-foreground',
          glow: '',
        };

        return (
          <div
            key={`${m.resonatorId}-${idx}`}
            className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/90 p-3.5 shadow-sm hover:border-primary/40 transition-all overflow-hidden"
          >
            <div>
              {/* Header: Element badge + Build status badge */}
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <ElementIcon
                  element={element}
                  size={12}
                  badgeMode={true}
                  showLabel={true}
                  className="text-[10px] py-0.5"
                />

                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${buildBadge.className}`}
                >
                  {buildBadge.label}
                </span>
              </div>

              {/* Character Avatar + Name + Role */}
              <div className="flex items-center gap-2.5 mt-2.5">
                <div
                  className={`relative h-11 w-11 shrink-0 rounded-lg overflow-hidden border-2 bg-secondary/80 flex items-center justify-center ${
                    is5Star ? 'border-amber-500/50' : 'border-purple-500/50'
                  }`}
                >
                  {!hasError ? (
                    <Image
                      src={avatarUrl}
                      alt={m.resonatorId}
                      width={44}
                      height={44}
                      className="h-full w-full object-cover"
                      onError={() => {
                        setAvatarErrors((prev) => new Set(prev).add(m.resonatorId));
                      }}
                      unoptimized
                    />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${palette.bg} ${palette.text}`}>
                      {m.resonatorId.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-foreground tracking-tight truncate">
                      {m.resonatorId}
                    </span>
                    <span className={`text-[10px] font-bold ${is5Star ? 'text-amber-400' : 'text-purple-400'}`}>
                      {'★'.repeat(meta?.rarity ?? 5)}
                    </span>
                  </div>

                  {/* Character Role in Team */}
                  <div className="mt-0.5">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[9px] font-bold ${roleInfo.roleColor}`}>
                      {roleInfo.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Sonata Set */}
              {m.activeSonataCode && (
                <div className="mt-2.5">
                  <span className="rounded bg-secondary/80 px-2 py-0.5 text-[10px] text-foreground border border-border/50 font-mono flex items-center gap-1 truncate">
                    <span className="text-muted-foreground font-sans">Set:</span>
                    <span className="truncate">{m.activeSonataCode}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Bottom: Investment & Weapon */}
            <div className="mt-3 pt-2.5 border-t border-border/40 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-muted-foreground font-mono">
                <span className="font-sans text-[10px]">Cấp độ:</span>
                <span className="text-foreground font-bold">
                  Lv. {m.characterLevel ?? 90} • S{m.sequenceLevel ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground truncate font-mono">
                <span className="font-sans text-[10px] shrink-0 mr-1">Vũ khí:</span>
                {m.equippedWeaponId ? (
                  <span
                    className="font-medium text-foreground truncate max-w-[150px]"
                    title={m.equippedWeaponId}
                  >
                    {m.equippedWeaponId} (Lv.{m.weaponLevel ?? 90}, R{m.weaponRefinement ?? 1})
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/60">Chưa trang bị</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
