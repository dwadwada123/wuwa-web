/**
 * Read-Only Game Data Access Repository
 *
 * Thin data access layer between Supabase and the Domain Model.
 * Translates raw database rows into rich domain objects.
 * Core Rules Engine NEVER calls this directly; domain models are passed into pure engine functions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PatchContext,
  Resonator,
  FunctionalRole,
  CombatTag,
  ResonatorAbility,
  Weapon,
  Echo,
  Sonata,
  Enemy,
  EnemyResistance,
  EnemyModifier,
  ToACycle,
  ToATower,
  ToAStage,
  ToAWave,
  EnemyInstance,
  AreaEffect,
  ChallengeGoal,
  GameplayEffect,
  GameplayEffectCategory,
  GameplayEffectTarget,
  ResonanceSequence,
  SequenceOrder,
} from '../../domain/types/index.ts';
import type { Database } from '../../db/database.types.ts';

export interface AvailableCycleSummary {
  id: string;
  patchId: string;
  patchVersion: string;
  cycleName: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface IGameDataRepository {
  getPatchContext(version: string, cycleId?: string): Promise<PatchContext | null>;
  getResonators(patchId: string): Promise<Resonator[]>;
  getResonatorById(resonatorId: string, patchId: string): Promise<Resonator | null>;
  getResonanceSequences(resonatorId: string, patchId: string): Promise<ResonanceSequence[]>;
  getWeapons(patchId: string): Promise<Weapon[]>;
  getEchoes(patchId: string): Promise<Echo[]>;
  getSonatas(patchId: string): Promise<Sonata[]>;
  getEnemies(patchId: string): Promise<Enemy[]>;
  getToACycle(cycleId: string, patchId: string): Promise<ToACycle | null>;
  getToAStage(stageId: string, patchId: string): Promise<ToAStage | null>;
  getAvailableCycles(): Promise<AvailableCycleSummary[]>;
  getActiveOrLatestCycle(cycleId?: string): Promise<{ cycle: ToACycle; patch: PatchContext } | null>;
}

const GLOBAL_GAME_DATA_CACHE = {
  patchContext: new Map<string, PatchContext>(),
  resonators: new Map<string, Resonator[]>(),
  sequences: new Map<string, ResonanceSequence[]>(),
  weapons: new Map<string, Weapon[]>(),
  echoes: new Map<string, Echo[]>(),
  sonatas: new Map<string, Sonata[]>(),
  cycles: new Map<string, ToACycle>(),
  stages: new Map<string, ToAStage>(),
};

export function clearGameDataCache(): void {
  GLOBAL_GAME_DATA_CACHE.patchContext.clear();
  GLOBAL_GAME_DATA_CACHE.resonators.clear();
  GLOBAL_GAME_DATA_CACHE.sequences.clear();
  GLOBAL_GAME_DATA_CACHE.weapons.clear();
  GLOBAL_GAME_DATA_CACHE.echoes.clear();
  GLOBAL_GAME_DATA_CACHE.sonatas.clear();
  GLOBAL_GAME_DATA_CACHE.cycles.clear();
  GLOBAL_GAME_DATA_CACHE.stages.clear();
}

type GameplayEffectRow = Database['public']['Tables']['gameplay_effects']['Row'];
type SequenceEffectRow = Database['public']['Tables']['resonator_sequence_effects']['Row'];
type SequencePatchDataRow = Database['public']['Tables']['resonator_sequence_patch_data']['Row'];
type SequenceRow = Database['public']['Tables']['resonator_sequences']['Row'];

interface ResonanceSequenceQueryEffect {
  effect_order: SequenceEffectRow['effect_order'];
  gameplay_effects: Pick<
    GameplayEffectRow,
    | 'id'
    | 'patch_id'
    | 'category'
    | 'target'
    | 'condition_expression'
    | 'detail_expression'
  > | null;
}

interface ResonanceSequenceQueryPatchData {
  id: SequencePatchDataRow['id'];
  patch_id: SequencePatchDataRow['patch_id'];
  name: SequencePatchDataRow['name'];
  description: SequencePatchDataRow['description'];
  provenance_id: SequencePatchDataRow['provenance_id'];
  resonator_sequence_effects?: ResonanceSequenceQueryEffect[] | null;
}

interface ResonanceSequenceQueryResultRow {
  id: SequenceRow['id'];
  resonator_id: SequenceRow['resonator_id'];
  node_order: SequenceRow['node_order'];
  node_code: SequenceRow['node_code'];
  resonator_sequence_patch_data:
    | ResonanceSequenceQueryPatchData
    | ResonanceSequenceQueryPatchData[];
}

function isGameplayEffectCategory(val: string): val is GameplayEffectCategory {
  return (
    val === 'STAT_BUFF' ||
    val === 'DMG_AMPLIFY' ||
    val === 'COORDINATED_ATTACK' ||
    val === 'DEF_SHRED' ||
    val === 'RES_SHRED' ||
    val === 'HEALING' ||
    val === 'SHIELD' ||
    val === 'SPECIAL_MECHANIC' ||
    val === 'RESOURCE_GRANT' ||
    val === 'STATE_CHANGE'
  );
}

function isGameplayEffectTarget(val: string): val is GameplayEffectTarget {
  return (
    val === 'SELF' ||
    val === 'ACTIVE_CHARACTER' ||
    val === 'NEXT_RESONATOR' ||
    val === 'TEAM' ||
    val === 'ENEMY'
  );
}

function isSequenceOrder(val: number): val is SequenceOrder {
  return Number.isInteger(val) && val >= 1 && val <= 6;
}

function isJsonObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export class SupabaseGameDataRepository implements IGameDataRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getPatchContext(version: string, cycleId?: string): Promise<PatchContext | null> {
    const cacheKey = `${version}::${cycleId || ''}`;
    const cached = GLOBAL_GAME_DATA_CACHE.patchContext.get(cacheKey);
    if (cached) return cached;

    const { data: patch, error } = await this.client
      .from('patches')
      .select('id, version, release_date')
      .eq('version', version)
      .single();

    if (error || !patch) return null;

    const result: PatchContext = {
      patchId: patch.id,
      version: patch.version,
      cycleId,
      snapshotDate: patch.release_date,
    };
    GLOBAL_GAME_DATA_CACHE.patchContext.set(cacheKey, result);
    return result;
  }

  async getResonators(patchId: string): Promise<Resonator[]> {
    const cached = GLOBAL_GAME_DATA_CACHE.resonators.get(patchId);
    if (cached) return cached;

    // 1. Fetch base resonators and patch data
    const { data: resonatorsData, error } = await this.client
      .from('resonators')
      .select(`
        id,
        name,
        element,
        weapon_type,
        rarity,
        release_date,
        resonator_patch_data!inner (
          id,
          base_hp_lvl90,
          base_atk_lvl90,
          base_def_lvl90,
          resonator_roles (
            is_primary,
            functional_roles (
              code,
              label
            )
          ),
          resonator_combat_tags (
            combat_tags (
              code,
              label
            )
          )
        ),
        abilities (
          id,
          ability_code,
          ability_category,
          ability_patch_data!inner (
            name,
            cooldown_seconds,
            energy_cost,
            concertos_generated,
            ability_effects (
              gameplay_effects (
                id,
                patch_id,
                category,
                target,
                condition_expression,
                detail_expression
              )
            )
          )
        )
      `)
      .eq('resonator_patch_data.patch_id', patchId)
      .eq('abilities.ability_patch_data.patch_id', patchId);

    if (error || !resonatorsData) {
      throw new Error(`Failed to load resonators for patch ${patchId}: ${error?.message}`);
    }

    const result = resonatorsData.map((row: any) => {
      const patchData = Array.isArray(row.resonator_patch_data)
        ? row.resonator_patch_data[0]
        : row.resonator_patch_data;

      const roles: FunctionalRole[] = (patchData?.resonator_roles || []).map((rr: any) => ({
        code: rr.functional_roles?.code || '',
        label: rr.functional_roles?.label || '',
        isPrimary: rr.is_primary,
      }));

      const combatTags: CombatTag[] = (patchData?.resonator_combat_tags || []).map((rc: any) => ({
        code: rc.combat_tags?.code || '',
        label: rc.combat_tags?.label || '',
      }));

      const abilities: ResonatorAbility[] = (row.abilities || []).map((ab: any) => {
        const apd = Array.isArray(ab.ability_patch_data)
          ? ab.ability_patch_data[0]
          : ab.ability_patch_data;

        const effects: GameplayEffect[] = (apd?.ability_effects || [])
          .map((ae: any) => ae.gameplay_effects)
          .filter(Boolean)
          .map((ge: any) => ({
            id: ge.id,
            patchId: ge.patch_id,
            category: ge.category,
            target: ge.target,
            conditionExpression: ge.condition_expression,
            detailExpression: ge.detail_expression,
          }));

        return {
          code: ab.ability_code,
          category: ab.ability_category,
          name: apd?.name || ab.ability_code,
          cooldownSeconds: apd?.cooldown_seconds ?? null,
          energyCost: apd?.energy_cost ?? null,
          concertosGenerated: apd?.concertos_generated ?? 0,
          effects,
        };
      });

      return {
        id: row.id,
        name: row.name,
        element: row.element,
        weaponType: row.weapon_type,
        rarity: row.rarity,
        releaseDate: row.release_date,
        baseHpLvl90: patchData?.base_hp_lvl90 ?? 0,
        baseAtkLvl90: patchData?.base_atk_lvl90 ?? 0,
        baseDefLvl90: patchData?.base_def_lvl90 ?? 0,
        roles,
        combatTags,
        abilities,
      };
    });
    GLOBAL_GAME_DATA_CACHE.resonators.set(patchId, result);
    return result;
  }

  async getResonatorById(resonatorId: string, patchId: string): Promise<Resonator | null> {
    const list = await this.getResonators(patchId);
    return list.find((r) => r.id === resonatorId) || null;
  }

  async getResonanceSequences(resonatorId: string, patchId: string): Promise<ResonanceSequence[]> {
    const cacheKey = `${patchId}::${resonatorId}`;
    const cached = GLOBAL_GAME_DATA_CACHE.sequences.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('resonator_sequences')
      .select(`
        id,
        resonator_id,
        node_order,
        node_code,
        resonator_sequence_patch_data!inner (
          id,
          patch_id,
          name,
          description,
          provenance_id,
          resonator_sequence_effects (
            effect_order,
            gameplay_effects (
              id,
              patch_id,
              category,
              target,
              condition_expression,
              detail_expression
            )
          )
        )
      `)
      .eq('resonator_id', resonatorId)
      .eq('resonator_sequence_patch_data.patch_id', patchId)
      .returns<ResonanceSequenceQueryResultRow[]>();

    if (error) {
      throw new Error(`Failed to load resonance sequences for resonator ${resonatorId} in patch ${patchId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      GLOBAL_GAME_DATA_CACHE.sequences.set(cacheKey, []);
      return [];
    }

    const result: ResonanceSequence[] = [];

    for (const row of data) {
      const patchData = Array.isArray(row.resonator_sequence_patch_data)
        ? row.resonator_sequence_patch_data[0]
        : row.resonator_sequence_patch_data;

      if (!patchData) continue;

      const rawEffects: ResonanceSequenceQueryEffect[] = Array.isArray(patchData.resonator_sequence_effects)
        ? patchData.resonator_sequence_effects
        : [];

      // Deterministic sorting of effects by effect_order ascending
      const sortedRawEffects = [...rawEffects].sort(
        (a: ResonanceSequenceQueryEffect, b: ResonanceSequenceQueryEffect) => a.effect_order - b.effect_order
      );

      // Map and enforce strict patch isolation for gameplay_effects
      const effects: GameplayEffect[] = [];
      for (const rse of sortedRawEffects) {
        const ge = rse.gameplay_effects;
        if (!ge) continue;

        // Defensive patch isolation check (in addition to DB composite FK)
        if (ge.patch_id !== patchId) continue;

        if (!isGameplayEffectCategory(ge.category) || !isGameplayEffectTarget(ge.target)) {
          continue;
        }

        effects.push({
          id: ge.id,
          patchId: ge.patch_id,
          category: ge.category,
          target: ge.target,
          conditionExpression: isJsonObject(ge.condition_expression) ? ge.condition_expression : undefined,
          detailExpression: isJsonObject(ge.detail_expression) ? ge.detail_expression : undefined,
        });
      }

      if (!isSequenceOrder(row.node_order)) {
        continue;
      }

      result.push({
        id: row.id,
        resonatorId: row.resonator_id,
        nodeOrder: row.node_order,
        nodeCode: row.node_code,
        name: patchData.name,
        description: patchData.description,
        provenanceId: patchData.provenance_id ?? null,
        effects,
      });
    }

    // Deterministic sorting of sequence nodes by nodeOrder (1 to 6)
    result.sort((a: ResonanceSequence, b: ResonanceSequence) => a.nodeOrder - b.nodeOrder);

    GLOBAL_GAME_DATA_CACHE.sequences.set(cacheKey, result);
    return result;
  }

  async getWeapons(patchId: string): Promise<Weapon[]> {
    const cached = GLOBAL_GAME_DATA_CACHE.weapons.get(patchId);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('weapons')
      .select(`
        id,
        name,
        weapon_type,
        rarity,
        weapon_patch_data!inner (
          base_atk_lvl90,
          sub_stat_type,
          sub_stat_value_lvl90,
          gameplay_effects (
            id,
            patch_id,
            category,
            target,
            condition_expression,
            detail_expression
          )
        )
      `)
      .eq('weapon_patch_data.patch_id', patchId);

    if (error || !data) {
      throw new Error(`Failed to load weapons for patch ${patchId}: ${error?.message}`);
    }

    const result = data.map((row: any) => {
      const pd = Array.isArray(row.weapon_patch_data)
        ? row.weapon_patch_data[0]
        : row.weapon_patch_data;
      const ge = pd?.gameplay_effects;

      const passiveEffect: GameplayEffect | null = ge
        ? {
            id: ge.id,
            patchId: ge.patch_id,
            category: ge.category,
            target: ge.target,
            conditionExpression: ge.condition_expression,
            detailExpression: ge.detail_expression,
          }
        : null;

      return {
        id: row.id,
        name: row.name,
        weaponType: row.weapon_type,
        rarity: row.rarity,
        baseAtkLvl90: pd?.base_atk_lvl90 ?? 0,
        subStatType: pd?.sub_stat_type ?? '',
        subStatValueLvl90: pd?.sub_stat_value_lvl90 ?? 0,
        passiveEffect,
      };
    });
    GLOBAL_GAME_DATA_CACHE.weapons.set(patchId, result);
    return result;
  }

  async getEchoes(patchId: string): Promise<Echo[]> {
    const cached = GLOBAL_GAME_DATA_CACHE.echoes.get(patchId);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('echoes')
      .select(`
        id,
        name,
        class_type,
        cost,
        echo_patch_data!inner (
          cd_seconds,
          concertos_generated,
          gameplay_effects (
            id,
            patch_id,
            category,
            target,
            condition_expression,
            detail_expression
          )
        )
      `)
      .eq('echo_patch_data.patch_id', patchId);

    if (error || !data) {
      throw new Error(`Failed to load echoes for patch ${patchId}: ${error?.message}`);
    }

    const result = data.map((row: any) => {
      const pd = Array.isArray(row.echo_patch_data)
        ? row.echo_patch_data[0]
        : row.echo_patch_data;
      const ge = pd?.gameplay_effects;

      const skillEffect: GameplayEffect | null = ge
        ? {
            id: ge.id,
            patchId: ge.patch_id,
            category: ge.category,
            target: ge.target,
            conditionExpression: ge.condition_expression,
            detailExpression: ge.detail_expression,
          }
        : null;

      return {
        id: row.id,
        name: row.name,
        classType: row.class_type,
        cost: row.cost,
        cdSeconds: pd?.cd_seconds,
        concertosGenerated: pd?.concertos_generated,
        skillEffect,
      };
    });
    GLOBAL_GAME_DATA_CACHE.echoes.set(patchId, result);
    return result;
  }

  async getSonatas(patchId: string): Promise<Sonata[]> {
    const cached = GLOBAL_GAME_DATA_CACHE.sonatas.get(patchId);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('sonatas')
      .select(`
        id,
        name,
        code,
        description,
        sonata_patch_data!inner (
          two_piece:gameplay_effects!sonata_patch_two_piece_fkey (
            id, patch_id, category, target, condition_expression, detail_expression
          ),
          five_piece:gameplay_effects!sonata_patch_five_piece_fkey (
            id, patch_id, category, target, condition_expression, detail_expression
          )
        )
      `)
      .eq('sonata_patch_data.patch_id', patchId);

    if (error || !data) {
      throw new Error(`Failed to load sonatas for patch ${patchId}: ${error?.message}`);
    }

    const result = data.map((row: any) => {
      const pd = Array.isArray(row.sonata_patch_data)
        ? row.sonata_patch_data[0]
        : row.sonata_patch_data;

      const mapGe = (ge: any): GameplayEffect | null =>
        ge
          ? {
              id: ge.id,
              patchId: ge.patch_id,
              category: ge.category,
              target: ge.target,
              conditionExpression: ge.condition_expression,
              detailExpression: ge.detail_expression,
            }
          : null;

      return {
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description,
        twoPieceEffect: mapGe(pd?.two_piece),
        fivePieceEffect: mapGe(pd?.five_piece),
      };
    });
    GLOBAL_GAME_DATA_CACHE.sonatas.set(patchId, result);
    return result;
  }

  async getEnemies(patchId: string): Promise<Enemy[]> {
    const { data, error } = await this.client
      .from('enemies')
      .select(`
        id,
        name,
        code,
        enemy_class,
        enemy_resistances!inner (
          element,
          resistance_ratio
        ),
        enemy_modifiers (
          modifier_type,
          parameters,
          is_active
        )
      `)
      .eq('enemy_resistances.patch_id', patchId);

    if (error || !data) {
      throw new Error(`Failed to load enemies for patch ${patchId}: ${error?.message}`);
    }

    return data.map((row: any) => {
      const resistances: EnemyResistance[] = (row.enemy_resistances || []).map((r: any) => ({
        element: r.element,
        resistanceRatio: Number(r.resistance_ratio),
      }));

      const modifiers: EnemyModifier[] = (row.enemy_modifiers || []).map((m: any) => ({
        modifierType: m.modifier_type,
        parameters: m.parameters || {},
        isActive: m.is_active,
      }));

      return {
        id: row.id,
        name: row.name,
        code: row.code,
        enemyClass: row.enemy_class,
        resistances,
        modifiers,
      };
    });
  }

  async getToACycle(cycleId: string, patchId: string): Promise<ToACycle | null> {
    const cacheKey = `${cycleId}::${patchId}`;
    const cached = GLOBAL_GAME_DATA_CACHE.cycles.get(cacheKey);
    if (cached) return cached;

    const { data: cycle, error } = await this.client
      .from('toa_cycles')
      .select(`
        id,
        patch_id,
        cycle_name,
        start_time,
        end_time,
        toa_zones (
          id,
          zone_type,
          toa_towers (
            id,
            tower_order,
            tower_name,
            toa_stages (
              id,
              stage_index,
              vigor_cost
            )
          )
        )
      `)
      .eq('id', cycleId)
      .eq('patch_id', patchId)
      .single();

    if (error || !cycle) return null;

    const towerPromises: Promise<ToATower>[] = [];
    for (const zone of (cycle as any).toa_zones || []) {
      for (const t of zone.toa_towers || []) {
        towerPromises.push(
          (async () => {
            const stagePromises = (t.toa_stages || []).map((s: any) => this.getToAStage(s.id, patchId));
            const loadedStages = (await Promise.all(stagePromises)).filter(
              (s): s is ToAStage => s !== null
            );
            return {
              id: t.id,
              towerOrder: t.tower_order,
              towerName: t.tower_name,
              stages: loadedStages.sort((a, b) => a.stageIndex - b.stageIndex),
            };
          })()
        );
      }
    }

    const towers = await Promise.all(towerPromises);

    const result: ToACycle = {
      id: cycle.id,
      patchId: cycle.patch_id,
      cycleName: cycle.cycle_name,
      startTime: cycle.start_time,
      endTime: cycle.end_time,
      towers: towers.sort((a, b) => a.towerOrder - b.towerOrder),
    };
    GLOBAL_GAME_DATA_CACHE.cycles.set(cacheKey, result);
    return result;
  }

  async getToAStage(stageId: string, patchId: string): Promise<ToAStage | null> {
    const cacheKey = `${stageId}::${patchId}`;
    const cached = GLOBAL_GAME_DATA_CACHE.stages.get(cacheKey);
    if (cached) return cached;

    const { data: stage, error } = await this.client
      .from('toa_stages')
      .select(`
        id,
        stage_index,
        vigor_cost,
        toa_towers!inner (
          toa_zones!inner (
            patch_id
          )
        ),
        stage_area_effects (
          area_effects (
            id,
            name,
            description,
            gameplay_effects (
              id,
              patch_id,
              category,
              target,
              condition_expression,
              detail_expression
            )
          )
        ),
        challenge_goals (
          id,
          goal_order,
          target_time_seconds,
          points
        ),
        toa_waves (
          id,
          wave_index,
          toa_enemy_instances (
            id,
            level,
            spawn_order,
            enemies (
              id,
              name,
              code,
              enemy_class,
              enemy_resistances (
                element,
                resistance_ratio
              ),
              enemy_modifiers (
                modifier_type,
                parameters,
                is_active
              )
            )
          )
        )
      `)
      .eq('id', stageId)
      .eq('toa_towers.toa_zones.patch_id', patchId)
      .single();

    if (error || !stage) return null;

    const areaEffects: AreaEffect[] = (stage as any).stage_area_effects
      .map((sae: any) => sae.area_effects)
      .filter(Boolean)
      .map((ae: any) => ({
        id: ae.id,
        sourceId: ae.id,
        name: ae.name,
        description: ae.description,
        gameplayEffect: {
          id: ae.gameplay_effects?.id || '',
          patchId: ae.gameplay_effects?.patch_id || patchId,
          category: ae.gameplay_effects?.category || 'STAT_BUFF',
          target: ae.gameplay_effects?.target || 'TEAM',
          conditionExpression: ae.gameplay_effects?.condition_expression,
          detailExpression: ae.gameplay_effects?.detail_expression,
        },
      }));

    const challengeGoals: ChallengeGoal[] = ((stage as any).challenge_goals || []).map((cg: any) => ({
      id: cg.id,
      goalOrder: cg.goal_order,
      targetTimeSeconds: cg.target_time_seconds,
      points: cg.points,
    }));

    const waves: ToAWave[] = ((stage as any).toa_waves || []).map((w: any) => {
      const enemyInstances: EnemyInstance[] = (w.toa_enemy_instances || []).map((tei: any) => {
        const en = tei.enemies;
        const resistances: EnemyResistance[] = (en?.enemy_resistances || []).map((r: any) => ({
          element: r.element,
          resistanceRatio: Number(r.resistance_ratio),
        }));
        const modifiers: EnemyModifier[] = (en?.enemy_modifiers || []).map((m: any) => ({
          modifierType: m.modifier_type,
          parameters: m.parameters || {},
          isActive: m.is_active,
        }));

        return {
          id: tei.id,
          level: tei.level,
          spawnOrder: tei.spawn_order,
          enemy: {
            id: en?.id || '',
            name: en?.name || '',
            code: en?.code || '',
            enemyClass: en?.enemy_class || 'Common',
            resistances,
            modifiers,
          },
        };
      });

      return {
        id: w.id,
        waveIndex: w.wave_index,
        enemyInstances: enemyInstances.sort((a, b) => a.spawnOrder - b.spawnOrder),
      };
    });

    const result: ToAStage = {
      id: stage.id,
      patchId,
      stageIndex: stage.stage_index,
      vigorCost: stage.vigor_cost,
      areaEffects,
      challengeGoals: challengeGoals.sort((a, b) => a.goalOrder - b.goalOrder),
      waves: waves.sort((a, b) => a.waveIndex - b.waveIndex),
    };
    GLOBAL_GAME_DATA_CACHE.stages.set(cacheKey, result);
    return result;
  }

  async getAvailableCycles(): Promise<AvailableCycleSummary[]> {
    const { data: cycles, error } = await this.client
      .from('toa_cycles')
      .select('id, patch_id, cycle_name, start_time, end_time, patches(version)')
      .order('end_time', { ascending: false });

    if (error || !cycles) return [];

    const now = new Date();
    return cycles.map((c: any) => {
      const start = new Date(c.start_time);
      const end = new Date(c.end_time);
      const isActive = now >= start && now <= end;
      return {
        id: c.id,
        patchId: c.patch_id,
        patchVersion: c.patches?.version || 'Unknown',
        cycleName: c.cycle_name,
        startTime: c.start_time,
        endTime: c.end_time,
        isActive,
      };
    });
  }

  async getActiveOrLatestCycle(cycleId?: string): Promise<{ cycle: ToACycle; patch: PatchContext } | null> {
    let targetCycleId = cycleId;
    let patchId: string | null = null;
    let patchVersion = '';

    if (targetCycleId) {
      const { data, error } = await this.client
        .from('toa_cycles')
        .select('id, patch_id, patches(version)')
        .eq('id', targetCycleId)
        .single();
      if (!error && data) {
        patchId = data.patch_id;
        patchVersion = (data as any).patches?.version || '';
      }
    } else {
      const { data: cycles, error } = await this.client
        .from('toa_cycles')
        .select('id, patch_id, start_time, end_time, patches(version)')
        .order('end_time', { ascending: false });

      if (!error && cycles && cycles.length > 0) {
        const now = new Date();
        const active = cycles.find((c: any) => {
          const s = new Date(c.start_time);
          const e = new Date(c.end_time);
          return now >= s && now <= e;
        });
        const chosen = active || cycles[0];
        targetCycleId = chosen.id;
        patchId = chosen.patch_id;
        patchVersion = (chosen as any).patches?.version || '';
      }
    }

    if (!targetCycleId || !patchId) return null;

    const cycle = await this.getToACycle(targetCycleId, patchId);
    if (!cycle) return null;

    const patch = await this.getPatchContext(patchVersion, targetCycleId);
    if (!patch) return null;

    return { cycle, patch };
  }
}
