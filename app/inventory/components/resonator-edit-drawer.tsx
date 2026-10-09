'use client';

import { useState, useEffect, useTransition } from 'react';
import type {
  CanonicalResonatorItem,
  CanonicalWeaponItem,
  CanonicalSonataItem,
  ResonatorInvestmentState,
} from '../types';
import { updateResonatorInvestmentAction } from '../actions';

interface ResonatorEditDrawerProps {
  resonator: CanonicalResonatorItem;
  availableWeapons: CanonicalWeaponItem[];
  availableSonatas: CanonicalSonataItem[];
  currentInvestment?: ResonatorInvestmentState;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: ResonatorInvestmentState) => void;
}

const ELEMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Glacio: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  Fusion: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  Electro: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  Aero: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  Spectro: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Havoc: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
};

export function ResonatorEditDrawer({
  resonator,
  availableWeapons,
  availableSonatas,
  currentInvestment,
  isOpen,
  onClose,
  onSaved,
}: ResonatorEditDrawerProps) {
  // Form states initialized strictly from saved investment without assuming level 90
  const [characterLevel, setCharacterLevel] = useState<number>(
    currentInvestment?.level ?? 1
  );
  const [sequenceLevel, setSequenceLevel] = useState<number>(
    currentInvestment?.waveband ?? 0
  );
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(
    currentInvestment?.weapon?.weaponId ?? ''
  );
  const [weaponLevel, setWeaponLevel] = useState<number>(
    currentInvestment?.weapon?.level ?? 1
  );
  const [weaponRefinement, setWeaponRefinement] = useState<number>(
    currentInvestment?.weapon?.refinement ?? 1
  );
  const [selectedSonataId, setSelectedSonataId] = useState<string>(
    currentInvestment?.sonata?.sonataId ?? ''
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-sync form state whenever the target resonator or currentInvestment changes
  useEffect(() => {
    if (isOpen) {
      setCharacterLevel(currentInvestment?.level ?? 1);
      setSequenceLevel(currentInvestment?.waveband ?? 0);
      setSelectedWeaponId(currentInvestment?.weapon?.weaponId ?? '');
      setWeaponLevel(currentInvestment?.weapon?.level ?? 1);
      setWeaponRefinement(currentInvestment?.weapon?.refinement ?? 1);
      setSelectedSonataId(currentInvestment?.sonata?.sonataId ?? '');
      setErrorMessage(null);
    }
  }, [isOpen, currentInvestment]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter weapons compatible with resonator's weapon type
  const compatibleWeapons = availableWeapons.filter(
    (w) => w.weaponType === resonator.weaponType
  );

  // Client-side validations
  const isCharLevelValid =
    Number.isInteger(characterLevel) && characterLevel >= 1 && characterLevel <= 90;
  const isSeqLevelValid =
    Number.isInteger(sequenceLevel) && sequenceLevel >= 0 && sequenceLevel <= 6;
  const isWeaponSelected = Boolean(selectedWeaponId);
  const isWepLevelValid =
    !isWeaponSelected ||
    (Number.isInteger(weaponLevel) && weaponLevel >= 1 && weaponLevel <= 90);
  const isWepRefinementValid =
    !isWeaponSelected ||
    (Number.isInteger(weaponRefinement) && weaponRefinement >= 1 && weaponRefinement <= 5);

  const canSubmit =
    isCharLevelValid &&
    isSeqLevelValid &&
    isWepLevelValid &&
    isWepRefinementValid &&
    !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const payload = {
          resonatorId: resonator.id,
          characterLevel,
          sequenceLevel,
          weapon: isWeaponSelected
            ? {
                weaponId: selectedWeaponId,
                level: weaponLevel,
                refinement: weaponRefinement,
              }
            : null,
          sonataId: selectedSonataId || null,
        };

        const res = await updateResonatorInvestmentAction(payload);

        if (!res.success) {
          setErrorMessage(res.error || 'Failed to update character build.');
          return;
        }

        // Resolve display details for the local state update
        const chosenWeapon = compatibleWeapons.find((w) => w.id === selectedWeaponId);
        const chosenSonata = availableSonatas.find((s) => s.id === selectedSonataId);

        const updatedState: ResonatorInvestmentState = {
          userResonatorId: res.data?.userResonatorId || currentInvestment?.userResonatorId || '',
          resonatorId: resonator.id,
          level: characterLevel,
          waveband: sequenceLevel,
          weapon: chosenWeapon
            ? {
                weaponInstanceId: res.data?.weaponInstanceId || undefined,
                weaponId: chosenWeapon.id,
                name: chosenWeapon.name,
                weaponType: chosenWeapon.weaponType,
                rarity: chosenWeapon.rarity,
                level: weaponLevel,
                refinement: weaponRefinement,
              }
            : null,
          sonata: chosenSonata
            ? {
                sonataId: chosenSonata.id,
                name: chosenSonata.name,
                code: chosenSonata.code,
              }
            : null,
        };

        onSaved(updatedState);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'An unexpected network error occurred.');
      }
    });
  };

  const elStyle = ELEMENT_COLORS[resonator.element] || {
    bg: 'bg-secondary/40',
    text: 'text-foreground',
    border: 'border-border',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm transition-opacity"
      aria-modal="true"
      role="dialog"
      aria-labelledby="drawer-title"
    >
      {/* Click backdrop to dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Slide-over panel */}
      <div className="relative z-10 w-full max-w-lg bg-card border-l border-border h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${elStyle.bg} ${elStyle.text} ${elStyle.border}`}
              >
                {resonator.element}
              </span>
              <span className="text-xs font-bold text-amber-400">
                {'★'.repeat(resonator.rarity)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({resonator.weaponType})
              </span>
            </div>
            <h2 id="drawer-title" className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {resonator.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure investment, weapon, and equipment for deterministic ToA optimization.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close build editor"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive flex items-start justify-between gap-2">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="font-bold underline hover:text-destructive/80 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-6 flex-1 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Section 1: Character Investment */}
            <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Character Investment
              </h3>

              {/* Character Level */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="char-level" className="text-xs font-semibold text-foreground">
                    Character Level (1–90)
                  </label>
                  <span className="text-xs font-mono text-muted-foreground">
                    Lv. {characterLevel}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="char-level"
                    type="number"
                    min="1"
                    max="90"
                    value={characterLevel}
                    onChange={(e) => setCharacterLevel(parseInt(e.target.value, 10) || 1)}
                    className="w-24 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex items-center gap-1">
                    {[70, 80, 90].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCharacterLevel(preset)}
                        className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors border ${
                          characterLevel === preset
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground'
                        }`}
                      >
                        Lv.{preset}
                      </button>
                    ))}
                  </div>
                </div>
                {!isCharLevelValid && (
                  <p className="mt-1 text-xs text-destructive">
                    Level must be an integer between 1 and 90.
                  </p>
                )}
              </div>

              {/* Sequence / Waveband */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Resonance Sequence (S0–S6)
                </label>
                <div className="grid grid-cols-7 gap-1" role="group" aria-label="Sequence waveband">
                  {[0, 1, 2, 3, 4, 5, 6].map((seq) => (
                    <button
                      key={seq}
                      type="button"
                      onClick={() => setSequenceLevel(seq)}
                      aria-pressed={sequenceLevel === seq}
                      className={`rounded-lg py-1.5 text-xs font-mono font-bold transition-all border ${
                        sequenceLevel === seq
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      S{seq}
                    </button>
                  ))}
                </div>
                {!isSeqLevelValid && (
                  <p className="mt-1 text-xs text-destructive">
                    Waveband must be an integer between 0 and 6.
                  </p>
                )}
              </div>
            </div>

            {/* Section 2: Equipped Weapon */}
            <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Equipped Weapon ({resonator.weaponType})
              </h3>

              {/* Weapon Picker */}
              <div>
                <label htmlFor="weapon-select" className="text-xs font-semibold text-foreground block mb-1.5">
                  Select Compatible Weapon
                </label>
                <select
                  id="weapon-select"
                  value={selectedWeaponId}
                  onChange={(e) => setSelectedWeaponId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">None (Unequipped)</option>
                  {compatibleWeapons.map((w) => (
                    <option key={w.id} value={w.id}>
                      {'★'.repeat(w.rarity)} {w.name} ({w.weaponType})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Showing {compatibleWeapons.length} canonical {resonator.weaponType} weapons.
                </p>
              </div>

              {/* Weapon Level & Refinement (Visible only when weapon selected) */}
              {isWeaponSelected && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  {/* Weapon Level */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="weapon-level" className="text-xs font-semibold text-foreground">
                        Weapon Level (1–90)
                      </label>
                      <span className="text-xs font-mono text-muted-foreground">
                        Lv. {weaponLevel}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        id="weapon-level"
                        type="number"
                        min="1"
                        max="90"
                        value={weaponLevel}
                        onChange={(e) => setWeaponLevel(parseInt(e.target.value, 10) || 1)}
                        className="w-24 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex items-center gap-1">
                        {[70, 80, 90].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setWeaponLevel(preset)}
                            className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors border ${
                              weaponLevel === preset
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground'
                            }`}
                          >
                            Lv.{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    {!isWepLevelValid && (
                      <p className="mt-1 text-xs text-destructive">
                        Weapon level must be an integer between 1 and 90.
                      </p>
                    )}
                  </div>

                  {/* Weapon Refinement */}
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Weapon Refinement Rank (R1–R5)
                    </label>
                    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Weapon refinement rank">
                      {[1, 2, 3, 4, 5].map((ref) => (
                        <button
                          key={ref}
                          type="button"
                          onClick={() => setWeaponRefinement(ref)}
                          aria-pressed={weaponRefinement === ref}
                          className={`rounded-lg py-1.5 text-xs font-mono font-bold transition-all border ${
                            weaponRefinement === ref
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-card text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          R{ref}
                        </button>
                      ))}
                    </div>
                    {!isWepRefinementValid && (
                      <p className="mt-1 text-xs text-destructive">
                        Refinement must be an integer between 1 and 5.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Sonata Set */}
            <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                3. Sonata Set
              </h3>

              <div>
                <label htmlFor="sonata-select" className="text-xs font-semibold text-foreground block mb-1.5">
                  Select Active Sonata Effect
                </label>
                <select
                  id="sonata-select"
                  value={selectedSonataId}
                  onChange={(e) => setSelectedSonataId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">None (Unset)</option>
                  {availableSonatas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Select from {availableSonatas.length} canonical Patch 3.7 Sonata sets.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-6 border-t border-border flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Saving Build…
                </span>
              ) : (
                'Save Build'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
