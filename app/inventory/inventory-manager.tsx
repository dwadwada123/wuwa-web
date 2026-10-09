'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toggleResonatorOwnership } from './actions';
import { ResonatorEditDrawer } from './components/resonator-edit-drawer';
import type {
  CanonicalResonatorItem,
  CanonicalWeaponItem,
  CanonicalSonataItem,
  ResonatorInvestmentState,
} from './types';

// Backward compatible export alias
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

const ELEMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Glacio: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  Fusion: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  Electro: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  Aero: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  Spectro: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Havoc: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
};

export function InventoryManager({
  resonators,
  initialOwnedIds,
  canonicalWeapons = [],
  canonicalSonatas = [],
  initialInvestments = {},
}: InventoryManagerProps) {
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set(initialOwnedIds));
  const [investments, setInvestments] = useState<Record<string, ResonatorInvestmentState>>(
    initialInvestments
  );
  const [editingResonator, setEditingResonator] = useState<CanonicalResonatorItem | null>(null);

  const [search, setSearch] = useState('');
  const [elementFilter, setElementFilter] = useState<string>('ALL');
  const [weaponFilter, setWeaponFilter] = useState<string>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'OWNED' | 'UNOWNED'>('ALL');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (resonatorId: string) => {
    const isCurrentlyOwned = ownedIds.has(resonatorId);

    // Optimistic state update
    setOwnedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyOwned) {
        next.delete(resonatorId);
      } else {
        next.add(resonatorId);
      }
      return next;
    });

    setPendingIds((prev) => new Set(prev).add(resonatorId));
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await toggleResonatorOwnership(resonatorId, isCurrentlyOwned);
        if (!res.success) {
          // Rollback on failure
          setOwnedIds((prev) => {
            const next = new Set(prev);
            if (isCurrentlyOwned) {
              next.add(resonatorId);
            } else {
              next.delete(resonatorId);
            }
            return next;
          });
          setErrorMessage(res.error || 'Failed to update resonator ownership.');
        } else if (!isCurrentlyOwned && !investments[resonatorId]) {
          // Initialize baseline investment state for newly owned character without defaulting to 90
          setInvestments((prev) => ({
            ...prev,
            [resonatorId]: {
              userResonatorId: '',
              resonatorId,
              level: 1,
              waveband: 0,
              weapon: null,
              sonata: null,
            },
          }));
        }
      } catch (err: any) {
        // Rollback on network/runtime error
        setOwnedIds((prev) => {
          const next = new Set(prev);
          if (isCurrentlyOwned) {
            next.add(resonatorId);
          } else {
            next.delete(resonatorId);
          }
          return next;
        });
        setErrorMessage(err.message || 'Network error occurred.');
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(resonatorId);
          return next;
        });
      }
    });
  };

  const filteredResonators = resonators.filter((r) => {
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

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Resonator Roster
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {ownedIds.size} / {resonators.length} Owned
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your owned characters, equipment, and investment levels to power deterministic ToA optimization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline font-mono">
            Patch 3.7 Canonical Roster
          </span>
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs underline hover:text-destructive/80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
        {/* Top row: Search and Ownership toggle tabs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="inventory-search" className="sr-only">
              Search resonators by name
            </label>
            <input
              id="inventory-search"
              type="text"
              placeholder="Search resonator by name..."
              aria-label="Search resonators by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search input"
                className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                Clear
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Filter by ownership"
            className="inline-flex rounded-lg border border-border bg-secondary/30 p-1"
          >
            {(['ALL', 'OWNED', 'UNOWNED'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setOwnershipFilter(tab)}
                aria-pressed={ownershipFilter === tab}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  ownershipFilter === tab
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'ALL' ? 'All' : tab === 'OWNED' ? 'Owned' : 'Unowned'}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Pills: Elements */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1" role="group" aria-label="Filter by element">
          <span className="text-xs font-medium text-muted-foreground mr-1">Element:</span>
          {ELEMENTS.map((el) => {
            const isSelected = elementFilter === el;
            return (
              <button
                key={el}
                type="button"
                onClick={() => setElementFilter(el)}
                aria-pressed={isSelected}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground'
                }`}
              >
                {el}
              </button>
            );
          })}
        </div>

        {/* Filter Pills: Weapon Types */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by weapon type">
          <span className="text-xs font-medium text-muted-foreground mr-1">Weapon:</span>
          {WEAPON_TYPES.map((wep) => {
            const isSelected = weaponFilter === wep;
            return (
              <button
                key={wep}
                type="button"
                onClick={() => setWeaponFilter(wep)}
                aria-pressed={isSelected}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground'
                }`}
              >
                {wep}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Resonators */}
      {filteredResonators.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <p className="text-base font-medium text-foreground">No resonators match your criteria</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search query, element filters, or ownership tab.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setElementFilter('ALL');
              setWeaponFilter('ALL');
              setOwnershipFilter('ALL');
            }}
            className="mt-4 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredResonators.map((r) => {
            const isOwned = ownedIds.has(r.id);
            const isUpdating = pendingIds.has(r.id);
            const inv = investments[r.id];

            const elStyle = ELEMENT_COLORS[r.element] || {
              bg: 'bg-secondary/40',
              text: 'text-foreground',
              border: 'border-border',
            };

            return (
              <div
                key={r.id}
                className={`relative rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                  isOwned
                    ? 'border-primary/50 bg-card shadow-md shadow-primary/5'
                    : 'border-border/60 bg-card/60 opacity-80 hover:opacity-100'
                }`}
              >
                <div>
                  {/* Top line: Element badge & Rarity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${elStyle.bg} ${elStyle.text} ${elStyle.border}`}
                      >
                        {r.element}
                      </span>
                      {isOwned && (
                        <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          In Roster
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-amber-400 tracking-wider">
                      {'★'.repeat(r.rarity)}
                    </span>
                  </div>

                  {/* Character Name & Weapon Type */}
                  <div className="mt-3">
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      {r.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.weaponType}</p>
                  </div>

                  {/* Investment & Equipment Summary for Owned Characters */}
                  {isOwned && (
                    <div className="mt-3 rounded-lg border border-border/60 bg-secondary/20 p-2.5 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-sans">Investment:</span>
                        <span className="font-bold text-foreground">
                          Lv.{inv?.level ?? 1} • S{inv?.waveband ?? 0}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-1">
                        <span className="text-muted-foreground font-sans shrink-0">Weapon:</span>
                        <span className="text-right text-foreground truncate max-w-[150px]" title={inv?.weapon ? `${inv.weapon.name} (Lv.${inv.weapon.level}, R${inv.weapon.refinement})` : 'Unequipped'}>
                          {inv?.weapon ? (
                            <span>
                              {inv.weapon.name}{' '}
                              <span className="text-[10px] text-muted-foreground">
                                (Lv.{inv.weapon.level}, R{inv.weapon.refinement})
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic font-sans text-[11px]">
                              Unequipped
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-1">
                        <span className="text-muted-foreground font-sans shrink-0">Sonata:</span>
                        <span className="text-right text-foreground truncate max-w-[150px]" title={inv?.sonata?.name ?? 'Unset'}>
                          {inv?.sonata ? (
                            <span>{inv.sonata.name}</span>
                          ) : (
                            <span className="text-muted-foreground/60 italic font-sans text-[11px]">
                              Unset
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom line: Action Buttons */}
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                  {isOwned ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggle(r.id)}
                        disabled={isUpdating}
                        aria-label={`Remove ${r.name} from owned roster`}
                        className="inline-flex items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 px-2.5 py-1.5 text-xs font-medium text-destructive transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50"
                      >
                        {isUpdating ? '...' : 'Remove'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingResonator(r)}
                        disabled={isUpdating}
                        aria-label={`Edit build for ${r.name}`}
                        className="inline-flex items-center justify-center rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      >
                        Edit Build
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(r.id)}
                      disabled={isUpdating}
                      aria-label={`Mark ${r.name} as owned`}
                      className="w-full inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    >
                      {isUpdating ? 'Saving...' : 'Mark Owned'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reusable Resonator Build Editor Drawer */}
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
