'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ElementIcon, ELEMENT_PALETTES } from '@/components/element-icon';
import { getResonatorAvatarUrl } from '@/lib/inventory/default-builds';
import {
  generateRecommendedTeamsFromRoster,
  generateDisjointTeamPortfolioFromRoster,
  type RecommendedTeam,
} from '@/lib/team-builder/roster-recommender';
import type { CanonicalResonatorItem } from '@/app/inventory/types';

interface RosterTeamRecommendationsProps {
  ownedResonators: CanonicalResonatorItem[];
}

export function RosterTeamRecommendations({ ownedResonators }: RosterTeamRecommendationsProps) {
  const [viewMode, setViewMode] = useState<'ALL_TOP' | 'DISJOINT_PORTFOLIO'>('ALL_TOP');
  const [selectedElementFilter, setSelectedElementFilter] = useState<string>('ALL');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

  const ownedNames = useMemo(
    () => ownedResonators.map((r) => r.name),
    [ownedResonators]
  );

  const allTopTeams = useMemo(
    () => generateRecommendedTeamsFromRoster(ownedNames, 12),
    [ownedNames]
  );

  const disjointPortfolioTeams = useMemo(
    () => generateDisjointTeamPortfolioFromRoster(ownedNames, 3),
    [ownedNames]
  );

  const displayedTeams = useMemo(() => {
    const source = viewMode === 'DISJOINT_PORTFOLIO' ? disjointPortfolioTeams : allTopTeams;
    if (selectedElementFilter === 'ALL') {
      return source;
    }
    return source.filter((team) => team.elementalSummary.includes(selectedElementFilter));
  }, [viewMode, disjointPortfolioTeams, allTopTeams, selectedElementFilter]);

  if (ownedResonators.length < 3) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 p-6 sm:p-8 text-center space-y-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-xl">
          👥
        </div>
        <h3 className="text-base sm:text-lg font-bold text-foreground">
          Cần Thêm Nhân Vật Để Tạo Đội Hình Tham Khảo
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Bạn hiện có <strong>{ownedResonators.length}</strong> nhân vật trong Roster. Vui lòng thêm ít nhất{' '}
          <strong>{3 - ownedResonators.length} nhân vật</strong> nữa vào kho đồ để hệ thống tự động phân tích và tạo đội hình 3 người tối ưu.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-card via-card/95 to-secondary/20 p-5 sm:p-7 shadow-xl space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/30 px-3 py-0.5 text-xs font-bold text-primary">
            <span>✨ TÍNH NĂNG MỚI</span>
            <span>•</span>
            <span>{ownedResonators.length} Nhân vật sở hữu</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <span>Đội Hình Đề Xuất Từ Roster</span>
            <span className="text-xs font-semibold text-muted-foreground font-sans">
              ({displayedTeams.length} đội khả dụng)
            </span>
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Tự động tổng hợp các tổ hợp 3 nhân vật chuẩn meta từ Roster bạn đang có, phân chia chuẩn vai trò (Main DPS, Sub-DPS, Healer) kèm Outro buff và thứ tự ra chiêu (rotation).
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-secondary/50 p-1 shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={() => setViewMode('ALL_TOP')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              viewMode === 'ALL_TOP'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🌟 Tất Cả Đội Hình Top Meta
          </button>
          <button
            type="button"
            onClick={() => setViewMode('DISJOINT_PORTFOLIO')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              viewMode === 'DISJOINT_PORTFOLIO'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🛡️ 3 Đội Tháp Độc Lập (ToA)
          </button>
        </div>
      </div>

      {/* Element Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-muted-foreground font-semibold shrink-0 mr-1">Lọc theo hệ:</span>
        <button
          type="button"
          onClick={() => setSelectedElementFilter('ALL')}
          className={`rounded-lg px-3 py-1 font-semibold transition-all shrink-0 ${
            selectedElementFilter === 'ALL'
              ? 'bg-foreground text-background font-bold shadow-xs'
              : 'border border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          Tất cả ({viewMode === 'DISJOINT_PORTFOLIO' ? disjointPortfolioTeams.length : allTopTeams.length})
        </button>
        {['Spectro', 'Havoc', 'Fusion', 'Electro', 'Aero', 'Glacio'].map((elem) => (
          <button
            key={elem}
            type="button"
            onClick={() => setSelectedElementFilter(elem)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all shrink-0 ${
              selectedElementFilter === elem
                ? 'bg-primary/20 border border-primary text-primary font-bold shadow-xs'
                : 'border border-border/70 bg-secondary/30 text-muted-foreground hover:text-foreground'
            }`}
          >
            <ElementIcon element={elem} size={12} />
            <span>{elem}</span>
          </button>
        ))}
      </div>

      {/* Teams Grid */}
      {displayedTeams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Không có đội hình nào phù hợp với bộ lọc hệ đã chọn.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {displayedTeams.map((team, idx) => {
            const isExpanded = expandedTeamId === team.id;

            return (
              <div
                key={team.id}
                className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Team Card Header */}
                <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-secondary text-[11px] font-black text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">
                      {team.name}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        team.tier === 'S_TIER'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                      }`}
                    >
                      {team.tierLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 border border-border px-2 py-1 text-[11px] font-bold text-foreground font-mono">
                      <span>Hiệp đồng:</span>
                      <span className="text-primary">{team.synergyScore}/100</span>
                    </span>
                  </div>
                </div>

                {/* 3 Members Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {team.members.map((member) => {
                    const palette = ELEMENT_PALETTES[member.element] || {
                      color: '#94a3b8',
                      bg: 'bg-secondary/40',
                      border: 'border-border',
                      text: 'text-foreground',
                      glow: '',
                    };
                    const avatarUrl = getResonatorAvatarUrl(member.name);
                    const hasAvatarErr = avatarErrors.has(member.name);

                    return (
                      <div
                        key={member.resonatorId}
                        className="rounded-xl border border-border/70 bg-secondary/20 p-3 flex flex-col justify-between space-y-2.5"
                      >
                        {/* Member Role Badge */}
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold truncate max-w-[120px] ${member.roleColor}`}
                            title={member.roleLabel}
                          >
                            {member.role === 'MAIN_DPS' ? '👑 Main DPS' : member.role === 'SUB_DPS' ? '⚡ Sub-DPS' : '💚 Healer'}
                          </span>
                          <ElementIcon element={member.element} size={11} />
                        </div>

                        {/* Character Info (Avatar + Name) */}
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden border border-border bg-secondary flex items-center justify-center">
                            {!hasAvatarErr ? (
                              <Image
                                src={avatarUrl}
                                alt={member.name}
                                width={44}
                                height={44}
                                className="h-full w-full object-cover"
                                onError={() => setAvatarErrors((prev) => new Set(prev).add(member.name))}
                                unoptimized
                              />
                            ) : (
                              <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${palette.bg} ${palette.text}`}>
                                {member.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold text-foreground truncate">
                              {member.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {member.element} • {member.rarity}★
                            </div>
                          </div>
                        </div>

                        {/* Recommended Equipment */}
                        <div className="border-t border-border/40 pt-2 text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Vũ khí:</span>
                            <span className="font-semibold text-foreground truncate max-w-[100px]" title={member.recommendedWeaponName}>
                              {member.recommendedWeaponName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Sonata:</span>
                            <span className="font-semibold text-foreground truncate max-w-[100px]" title={member.recommendedSonataName}>
                              {member.recommendedSonataName}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tactical Rationale Box */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span>💡 Chiến Thuật & Hiệp Đồng Outro:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      {isExpanded ? 'Thu gọn rotation ▲' : 'Xem rotation ▼'}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {team.rationale}
                  </p>

                  {isExpanded && (
                    <div className="pt-2 border-t border-primary/20 text-[11px] text-foreground font-mono bg-card/60 rounded-lg p-2.5 mt-2 animate-in fade-in-50">
                      <div className="text-primary font-bold font-sans mb-1">
                        🔄 Hướng Dẫn Vận Hành Rotation:
                      </div>
                      <div className="text-muted-foreground font-sans leading-relaxed">
                        {team.rotationGuide}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
