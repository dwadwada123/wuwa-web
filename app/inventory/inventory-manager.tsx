'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  toggleResonatorOwnership,
  batchRemoveResonatorsAction,
  batchAddResonatorsAction,
} from './actions';
import { ResonatorEditDrawer } from './components/resonator-edit-drawer';
import { ElementIcon, ELEMENT_PALETTES } from '@/components/element-icon';
import {
  getResonatorAvatarUrl,
  resolveResonatorDefaultBuild,
} from '@/lib/inventory/default-builds';
import { RosterTeamRecommendations } from './components/roster-team-recommendations';
import type {
  CanonicalResonatorItem,
  CanonicalWeaponItem,
  CanonicalSonataItem,
  ResonatorInvestmentState,
  EquippedWeaponInfo,
  EquippedSonataInfo,
} from './types';

export type ResonatorListItem = CanonicalResonatorItem;

interface InventoryManagerProps {
  resonators: CanonicalResonatorItem[];
  initialOwnedIds: string[];
  canonicalWeapons?: CanonicalWeaponItem[];
  canonicalSonatas?: CanonicalSonataItem[];
  initialInvestments?: Record<string, ResonatorInvestmentState>;
}

const ELEMENTS = ['ALL', 'Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc'] as const;
const WEAPON_TYPES = ['ALL', 'Broadblade', 'Sword', 'Pistols', 'Gauntlets', 'Rectifier'] as const;

type SortOption = 'NEWEST' | 'RARITY' | 'NAME' | 'LEVEL';

export function InventoryManager({
  resonators,
  initialOwnedIds,
  canonicalWeapons = [],
  canonicalSonatas = [],
  initialInvestments = {},
}: InventoryManagerProps) {
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set(initialOwnedIds));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [investments, setInvestments] = useState<Record<string, ResonatorInvestmentState>>(
    initialInvestments
  );
  const [editingResonator, setEditingResonator] = useState<CanonicalResonatorItem | null>(null);

  // Filters & sorting states
  const [search, setSearch] = useState('');
  const [elementFilter, setElementFilter] = useState<string>('ALL');
  const [weaponFilter, setWeaponFilter] = useState<string>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'OWNED' | 'UNOWNED'>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('NEWEST');

  // Confirmation modal state for batch delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Loading & error states
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [batchActionPending, setBatchActionPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Avatar error fallback tracking
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

  // Filter & sort resonators
  const filteredResonators = useMemo(() => {
    const list = resonators.filter((r) => {
      // Search match
      if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      // Element match
      if (elementFilter !== 'ALL' && r.element !== elementFilter) {
        return false;
      }
      // Weapon match
      if (weaponFilter !== 'ALL' && r.weaponType !== weaponFilter) {
        return false;
      }
      // Ownership match
      const isOwned = ownedIds.has(r.id);
      if (ownershipFilter === 'OWNED' && !isOwned) return false;
      if (ownershipFilter === 'UNOWNED' && isOwned) return false;

      return true;
    });

    // Sort order
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'NEWEST': {
          const dateComp = (b.releaseDate || '').localeCompare(a.releaseDate || '');
          if (dateComp !== 0) return dateComp;
          return b.rarity - a.rarity || a.name.localeCompare(b.name);
        }
        case 'RARITY': {
          const rarityComp = b.rarity - a.rarity;
          if (rarityComp !== 0) return rarityComp;
          return (b.releaseDate || '').localeCompare(a.releaseDate || '');
        }
        case 'NAME':
          return a.name.localeCompare(b.name);
        case 'LEVEL': {
          const levelA = investments[a.id]?.level ?? (ownedIds.has(a.id) ? 90 : 0);
          const levelB = investments[b.id]?.level ?? (ownedIds.has(b.id) ? 90 : 0);
          return levelB - levelA || b.rarity - a.rarity;
        }
        default:
          return 0;
      }
    });
  }, [resonators, search, elementFilter, weaponFilter, ownershipFilter, sortBy, ownedIds, investments]);

  // Characters selected that are currently visible
  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    for (const r of filteredResonators) {
      if (selectedIds.has(r.id)) count++;
    }
    return count;
  }, [filteredResonators, selectedIds]);

  // Visible resonators that are owned
  const visibleOwnedResonators = useMemo(() => {
    return filteredResonators.filter((r) => ownedIds.has(r.id));
  }, [filteredResonators, ownedIds]);

  // Visible resonators that are unowned
  const visibleUnownedResonators = useMemo(() => {
    return filteredResonators.filter((r) => !ownedIds.has(r.id));
  }, [filteredResonators, ownedIds]);

  // Batch Selection Handlers
  const handleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of filteredResonators) {
        next.add(r.id);
      }
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSelectCard = (resonatorId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(resonatorId)) {
        next.delete(resonatorId);
      } else {
        next.add(resonatorId);
      }
      return next;
    });
  };

  // Toggle single resonator ownership (with smart default build if adding)
  const handleToggleOwnership = (r: CanonicalResonatorItem) => {
    const isCurrentlyOwned = ownedIds.has(r.id);
    const defaultBuild = resolveResonatorDefaultBuild(r, canonicalWeapons, canonicalSonatas);

    // Optimistic ownership state
    setOwnedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyOwned) {
        next.delete(r.id);
      } else {
        next.add(r.id);
      }
      return next;
    });

    setPendingIds((prev) => new Set(prev).add(r.id));
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const res = await toggleResonatorOwnership(
          r.id,
          isCurrentlyOwned,
          isCurrentlyOwned
            ? undefined
            : {
                level: 90,
                waveband: 0,
                weaponId: defaultBuild.weapon?.id,
                weaponLevel: 90,
                weaponRefinement: defaultBuild.weapon?.rarity === 5 ? 1 : 5,
                sonataId: defaultBuild.sonata?.id,
              }
        );

        if (!res.success) {
          // Rollback
          setOwnedIds((prev) => {
            const next = new Set(prev);
            if (isCurrentlyOwned) {
              next.add(r.id);
            } else {
              next.delete(r.id);
            }
            return next;
          });
          setErrorMessage(res.error || 'Cập nhật thất bại.');
        } else if (!isCurrentlyOwned) {
          // Populate default build investment state in client
          const weaponInfo: EquippedWeaponInfo | null = defaultBuild.weapon
            ? {
                weaponInstanceId: '',
                weaponId: defaultBuild.weapon.id,
                name: defaultBuild.weapon.name,
                weaponType: defaultBuild.weapon.weaponType,
                rarity: defaultBuild.weapon.rarity,
                level: 90,
                refinement: defaultBuild.weapon.rarity === 5 ? 1 : 5,
              }
            : null;

          const sonataInfo: EquippedSonataInfo | null = defaultBuild.sonata
            ? {
                sonataId: defaultBuild.sonata.id,
                name: defaultBuild.sonata.name,
                code: defaultBuild.sonata.code,
              }
            : null;

          setInvestments((prev) => ({
            ...prev,
            [r.id]: {
              userResonatorId: res.userResonatorId || '',
              resonatorId: r.id,
              level: 90,
              waveband: 0,
              weapon: weaponInfo,
              sonata: sonataInfo,
            },
          }));
        }
      } catch (err: any) {
        setOwnedIds((prev) => {
          const next = new Set(prev);
          if (isCurrentlyOwned) {
            next.add(r.id);
          } else {
            next.delete(r.id);
          }
          return next;
        });
        setErrorMessage(err.message || 'Lỗi mạng khi cập nhật.');
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(r.id);
          return next;
        });
      }
    });
  };

  // Batch delete selected resonators
  const handleConfirmBatchDelete = () => {
    // Only delete resonators that are currently owned and selected
    const targetIdsToDelete = Array.from(selectedIds).filter((id) => ownedIds.has(id));

    if (targetIdsToDelete.length === 0) {
      setIsDeleteModalOpen(false);
      return;
    }

    setBatchActionPending(true);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await batchRemoveResonatorsAction(targetIdsToDelete);
        if (!res.success) {
          setErrorMessage(res.error || 'Xóa hàng loạt thất bại.');
        } else {
          // Update client state
          setOwnedIds((prev) => {
            const next = new Set(prev);
            for (const id of targetIdsToDelete) {
              next.delete(id);
            }
            return next;
          });

          // Remove investments
          setInvestments((prev) => {
            const next = { ...prev };
            for (const id of targetIdsToDelete) {
              delete next[id];
            }
            return next;
          });

          // Clear selected IDs
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of targetIdsToDelete) {
              next.delete(id);
            }
            return next;
          });

          setSuccessMessage(`Đã xóa thành công ${targetIdsToDelete.length} nhân vật khỏi Roster.`);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi kết nối khi xóa hàng loạt.');
      } finally {
        setBatchActionPending(false);
        setIsDeleteModalOpen(false);
      }
    });
  };

  // Quick Add all visible unowned resonators
  const handleBatchAddVisible = () => {
    if (visibleUnownedResonators.length === 0) return;

    setBatchActionPending(true);
    setErrorMessage(null);

    const items = visibleUnownedResonators.map((r) => {
      const def = resolveResonatorDefaultBuild(r, canonicalWeapons, canonicalSonatas);
      return {
        resonatorId: r.id,
        level: 90,
        waveband: 0,
        weaponId: def.weapon?.id,
        weaponLevel: 90,
        weaponRefinement: def.weapon?.rarity === 5 ? 1 : 5,
        sonataId: def.sonata?.id,
      };
    });

    startTransition(async () => {
      try {
        const res = await batchAddResonatorsAction(items);
        if (!res.success) {
          setErrorMessage(res.error || 'Thêm hàng loạt thất bại.');
        } else {
          // Update client state
          setOwnedIds((prev) => {
            const next = new Set(prev);
            for (const item of items) {
              next.add(item.resonatorId);
            }
            return next;
          });

          // Populate default investments
          setInvestments((prev) => {
            const next = { ...prev };
            for (const r of visibleUnownedResonators) {
              const def = resolveResonatorDefaultBuild(r, canonicalWeapons, canonicalSonatas);
              next[r.id] = {
                userResonatorId: '',
                resonatorId: r.id,
                level: 90,
                waveband: 0,
                weapon: def.weapon
                  ? {
                      weaponInstanceId: '',
                      weaponId: def.weapon.id,
                      name: def.weapon.name,
                      weaponType: def.weapon.weaponType,
                      rarity: def.weapon.rarity,
                      level: 90,
                      refinement: def.weapon.rarity === 5 ? 1 : 5,
                    }
                  : null,
                sonata: def.sonata
                  ? {
                      sonataId: def.sonata.id,
                      name: def.sonata.name,
                      code: def.sonata.code,
                    }
                  : null,
              };
            }
            return next;
          });

          setSuccessMessage(`Đã thêm thành công ${items.length} nhân vật vào Roster với Build Lv.90 mặc định.`);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi khi thêm hàng loạt.');
      } finally {
        setBatchActionPending(false);
      }
    });
  };

  // Get selected characters that are owned for modal summary
  const selectedOwnedResonators = useMemo(() => {
    return resonators.filter((r) => selectedIds.has(r.id) && ownedIds.has(r.id));
  }, [resonators, selectedIds, ownedIds]);

  // All owned characters for reactive 3-character team recommendations
  const ownedResonatorsList = useMemo(() => {
    return resonators.filter((r) => ownedIds.has(r.id));
  }, [resonators, ownedIds]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <span>Kho Nhân Vật</span>
              <span className="text-primary font-mono text-xl sm:text-2xl">• Roster</span>
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-semibold text-primary">
              Patch 3.7
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Quản lý đội hình, vũ khí trấn, sonata và cấp độ đầu tư nhân vật cho Tower of Adversity.
          </p>
        </div>

        {/* Stats & Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center rounded-lg border border-border/70 bg-card/80 px-3.5 py-1.5 shadow-xs">
            <span className="text-xs text-muted-foreground mr-1.5">Đã sở hữu:</span>
            <span className="font-bold text-sm text-primary font-mono">
              {ownedIds.size}/{resonators.length}
            </span>
          </div>

          <Link
            href="/tower"
            prefetch={true}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Tới Tower Optimizer →
          </Link>
        </div>
      </div>

      {/* Notification Banners */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Lỗi:</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs underline hover:text-destructive/80 ml-4 rounded"
          >
            Đóng
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs underline hover:text-emerald-200 ml-4 rounded"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 3-Character Roster Team Recommendations Section (Requirement) */}
      <RosterTeamRecommendations ownedResonators={ownedResonatorsList} />

      {/* Control Toolbar: Search, Filters, Sorting, Batch Actions */}
      <div className="space-y-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs p-4 sm:p-5 shadow-xs">
        {/* Search Input & Sort Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo tên nhân vật (vd: Jiyan, Changli, Shorekeeper...)"
              aria-label="Tìm kiếm nhân vật"
              className="w-full rounded-lg border border-border bg-background/80 px-3.5 py-2 pl-9 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <svg
              className="absolute left-3 top-2.5 sm:top-3 h-4 w-4 text-muted-foreground/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Sắp xếp:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sắp xếp danh sách nhân vật"
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="NEWEST">Mới nhất (Ngày ra mắt)</option>
              <option value="RARITY">Độ hiếm (5★ → 4★)</option>
              <option value="NAME">Tên nhân vật (A → Z)</option>
              <option value="LEVEL">Cấp độ (Level 90 → 1)</option>
            </select>
          </div>
        </div>

        {/* Ownership Status Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border/40 pb-3" role="tablist">
          <span className="text-xs font-medium text-muted-foreground mr-1.5">Trạng thái:</span>
          {(['ALL', 'OWNED', 'UNOWNED'] as const).map((tab) => {
            const isSelected = ownershipFilter === tab;
            const labels = { ALL: 'Tất cả', OWNED: 'Đã sở hữu', UNOWNED: 'Chưa sở hữu' };
            const count =
              tab === 'ALL'
                ? resonators.length
                : tab === 'OWNED'
                ? ownedIds.size
                : resonators.length - ownedIds.size;

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setOwnershipFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {labels[tab]} ({count})
              </button>
            );
          })}
        </div>

        {/* Filter Pills: Elements & Weapon Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Elements */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Thuộc tính (Element):</span>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo hệ">
              {ELEMENTS.map((el) => {
                const isSelected = elementFilter === el;
                return (
                  <button
                    key={el}
                    type="button"
                    onClick={() => setElementFilter(el)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/20 text-foreground font-bold shadow-xs'
                        : 'border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {el !== 'ALL' && <ElementIcon element={el} size={12} />}
                    <span>{el === 'ALL' ? 'Tất cả hệ' : el}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weapon Types */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Loại vũ khí (Weapon Type):</span>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo loại vũ khí">
              {WEAPON_TYPES.map((wtype) => {
                const isSelected = weaponFilter === wtype;
                return (
                  <button
                    key={wtype}
                    type="button"
                    onClick={() => setWeaponFilter(wtype)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/20 text-foreground font-bold shadow-xs'
                        : 'border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {wtype === 'ALL' ? 'Tất cả vũ khí' : wtype}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Batch Actions Toolbar (Requirement 1) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              Thao tác nhanh:
            </span>

            <button
              type="button"
              id="btn-select-all-visible"
              onClick={handleSelectAllVisible}
              className="rounded-lg border border-border/80 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              Chọn tất cả đang hiển thị ({filteredResonators.length})
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                id="btn-deselect-all"
                onClick={handleDeselectAll}
                className="rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Bỏ chọn ({selectedIds.size})
              </button>
            )}

            {visibleUnownedResonators.length > 0 && (
              <button
                type="button"
                id="btn-add-all-visible"
                onClick={handleBatchAddVisible}
                disabled={batchActionPending}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {batchActionPending ? 'Đang thêm...' : `+ Thêm tất cả vào Roster (${visibleUnownedResonators.length})`}
              </button>
            )}
          </div>

          {/* Delete action button (Only enabled when selected characters are owned) */}
          {selectedOwnedResonators.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-destructive">
                Đã chọn {selectedOwnedResonators.length} nhân vật sở hữu
              </span>
              <button
                type="button"
                id="btn-batch-delete-trigger"
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={batchActionPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Xóa {selectedOwnedResonators.length} nhân vật đã chọn
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resonators Grid / Empty State */}
      {filteredResonators.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-3 bg-card/40">
          <p className="text-base font-bold text-foreground">Không tìm thấy nhân vật nào phù hợp</p>
          <p className="text-xs text-muted-foreground">
            Hãy thử thay đổi từ khóa tìm kiếm, bộ lọc thuộc tính hoặc chuyển tab sở hữu.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setElementFilter('ALL');
              setWeaponFilter('ALL');
              setOwnershipFilter('ALL');
            }}
            className="rounded-lg bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredResonators.map((r) => {
            const isOwned = ownedIds.has(r.id);
            const isSelected = selectedIds.has(r.id);
            const isUpdating = pendingIds.has(r.id);
            const inv = investments[r.id];
            const defaultBuild = resolveResonatorDefaultBuild(r, canonicalWeapons, canonicalSonatas);

            const is5Star = r.rarity === 5;
            const avatarUrl = getResonatorAvatarUrl(r.name);
            const hasAvatarError = avatarErrors.has(r.id);

            const palette = ELEMENT_PALETTES[r.element] || {
              color: '#94a3b8',
              bg: 'bg-secondary/40',
              border: 'border-border',
              text: 'text-foreground',
              glow: '',
            };

            return (
              <div
                key={r.id}
                className={`group relative rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'ring-2 ring-primary border-primary bg-card/95 shadow-md shadow-primary/10'
                    : isOwned
                    ? 'border-border/80 bg-card hover:border-primary/50 shadow-sm'
                    : 'border-border/40 bg-card/40 opacity-80 hover:opacity-100 hover:border-border'
                }`}
              >
                {/* Accent top gradient bar based on rarity & element */}
                <div
                  className={`h-1 w-full ${
                    is5Star
                      ? 'bg-gradient-to-r from-amber-500 via-amber-300 to-yellow-500'
                      : 'bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-600'
                  }`}
                />

                <div className="p-4 space-y-3">
                  {/* Card Header: Checkbox + Element Badge + Rarity Stars */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Checkbox for quick batch selection */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectCard(r.id)}
                        aria-label={`Chọn ${r.name}`}
                        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                      />

                      {/* Element Badge with Icon */}
                      <ElementIcon
                        element={r.element}
                        size={12}
                        badgeMode={true}
                        showLabel={true}
                        className="text-[11px] font-bold py-0.5"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isOwned && (
                        <span className="inline-flex items-center rounded-md bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[10px] font-bold text-primary font-mono">
                          ROSTER
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold tracking-wider ${
                          is5Star ? 'text-amber-400' : 'text-purple-400'
                        }`}
                      >
                        {'★'.repeat(r.rarity)}
                      </span>
                    </div>
                  </div>

                  {/* Character Avatar & Identity */}
                  <div className="flex items-center gap-3 pt-1">
                    {/* Avatar Container with Fallback */}
                    <div
                      className={`relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border-2 shadow-inner bg-secondary/80 flex items-center justify-center ${
                        is5Star ? 'border-amber-500/60' : 'border-purple-500/50'
                      }`}
                    >
                      {!hasAvatarError ? (
                        <Image
                          src={avatarUrl}
                          alt={r.name}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={() => {
                            setAvatarErrors((prev) => new Set(prev).add(r.id));
                          }}
                          unoptimized
                        />
                      ) : (
                        // Fallback avatar UI: Elegant monogram with element styling
                        <div
                          className={`flex h-full w-full items-center justify-center font-extrabold text-sm ${palette.bg} ${palette.text}`}
                        >
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Name, Weapon Type & Release Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-extrabold text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                        {r.name}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>{r.weaponType}</span>
                        {r.releaseDate && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-muted-foreground/80">
                              {r.releaseDate}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Build & Equipment Status (Requirement 2 & 3) */}
                  {isOwned ? (
                    <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5 space-y-1.5 text-xs font-mono">
                      {/* Level & Waveband */}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-sans text-[11px]">Cấp độ:</span>
                        <span className="font-bold text-foreground">
                          Lv.{inv?.level ?? 90} • S{inv?.waveband ?? 0}
                        </span>
                      </div>

                      {/* Equipped Weapon */}
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-muted-foreground font-sans text-[11px] shrink-0">Vũ khí:</span>
                        <div className="text-right truncate max-w-[170px]">
                          {inv?.weapon ? (
                            <span className="text-foreground font-medium" title={`${inv.weapon.name} (Lv.${inv.weapon.level}, R${inv.weapon.refinement})`}>
                              {inv.weapon.name}{' '}
                              <span className="text-[10px] text-primary">
                                (R{inv.weapon.refinement})
                              </span>
                            </span>
                          ) : defaultBuild.weapon ? (
                            <span className="text-emerald-400 font-medium" title={`Mặc định: ${defaultBuild.weapon.name}`}>
                              {defaultBuild.weapon.name}{' '}
                              <span className="text-[10px] text-muted-foreground">({defaultBuild.weaponLabel})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic font-sans text-[11px]">Chưa trang bị</span>
                          )}
                        </div>
                      </div>

                      {/* Equipped Sonata */}
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-muted-foreground font-sans text-[11px] shrink-0">Sonata:</span>
                        <div className="text-right truncate max-w-[170px]">
                          {inv?.sonata ? (
                            <span className="text-foreground font-medium">{inv.sonata.name}</span>
                          ) : defaultBuild.sonata ? (
                            <span className="text-emerald-400 font-medium" title={`Mặc định: ${defaultBuild.sonata.name}`}>
                              {defaultBuild.sonata.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic font-sans text-[11px]">Chưa chọn</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Unowned Preview Build Hint */
                    <div className="rounded-lg border border-dashed border-border/60 bg-secondary/15 p-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Build đề xuất:</span>
                        <span className="text-primary font-bold">Lv. 90 Mặc định</span>
                      </div>
                      <div className="text-[11px] text-foreground truncate font-mono">
                        <span className="text-muted-foreground font-sans">Trấn:</span> {defaultBuild.weapon?.name || 'Vũ khí 5★'}
                      </div>
                      <div className="text-[11px] text-foreground truncate font-mono">
                        <span className="text-muted-foreground font-sans">Set:</span> {defaultBuild.sonata?.name || 'Sonata Hệ'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="p-4 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  {isOwned ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleOwnership(r)}
                        disabled={isUpdating}
                        aria-label={`Xóa ${r.name} khỏi roster`}
                        className="inline-flex items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 px-2.5 py-1.5 text-xs font-medium text-destructive transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50"
                      >
                        {isUpdating ? '...' : 'Xóa Roster'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingResonator(r)}
                        disabled={isUpdating}
                        aria-label={`Tùy chỉnh build cho ${r.name}`}
                        className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      >
                        Chỉnh sửa Build
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleOwnership(r)}
                      disabled={isUpdating}
                      aria-label={`Thêm ${r.name} vào roster với build mặc định`}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    >
                      {isUpdating ? (
                        'Đang lưu...'
                      ) : (
                        <>
                          <span>+ Thêm vào Roster</span>
                          <span className="text-[10px] font-normal opacity-80">(Lv.90)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Batch Delete (Requirement 1) */}
      {isDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-destructive/50 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center gap-3 border-b border-border/80 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-lg font-extrabold text-foreground">
                  Xác nhận xóa {selectedOwnedResonators.length} nhân vật khỏi Roster?
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Thao tác này sẽ xóa các nhân vật đã chọn và dữ liệu trang bị liên quan.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Các nhân vật sau sẽ bị xóa khỏi Roster và Tower of Adversity:
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-secondary/30 p-2.5 flex flex-wrap gap-2">
                {selectedOwnedResonators.map((r) => (
                  <div
                    key={r.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
                  >
                    <ElementIcon element={r.element} size={10} />
                    <span>{r.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-amber-400/90 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              ⚠️ <strong>Lưu ý:</strong> Sau khi xóa, danh sách nhân vật và kết quả tính toán đề xuất trong Tower of Adversity sẽ được cập nhật ngay lập tức.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-delete"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={batchActionPending}
                className="rounded-lg border border-border bg-secondary/60 px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                id="btn-confirm-batch-delete"
                onClick={handleConfirmBatchDelete}
                disabled={batchActionPending}
                className="inline-flex items-center justify-center rounded-lg bg-destructive px-5 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50"
              >
                {batchActionPending ? 'Đang xóa...' : `Xác nhận xóa (${selectedOwnedResonators.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resonator Build Editor Drawer */}
      {editingResonator && (
        <ResonatorEditDrawer
          resonator={editingResonator}
          availableWeapons={canonicalWeapons}
          availableSonatas={canonicalSonatas}
          currentInvestment={investments[editingResonator.id]}
          isOpen={Boolean(editingResonator)}
          onClose={() => setEditingResonator(null)}
          onSaved={(updated) => {
            setInvestments((prev) => ({
              ...prev,
              [updated.resonatorId]: updated,
            }));
          }}
        />
      )}
    </div>
  );
}
