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
} from '../../domain/types/index.ts';

export interface IGameDataRepository {
  getPatchContext(version: string, cycleId?: string): Promise<PatchContext | null>;
  getResonators(patchId: string): Promise<Resonator[]>;
  getResonatorById(resonatorId: string, patchId: string): Promise<Resonator | null>;
  getWeapons(patchId: string): Promise<Weapon[]>;
  getEchoes(patchId: string): Promise<Echo[]>;
  getSonatas(patchId: string): Promise<Sonata[]>;
  getEnemies(patchId: string): Promise<Enemy[]>;
  getToACycle(cycleId: string, patchId: string): Promise<ToACycle | null>;
  getToAStage(stageId: string, patchId: string): Promise<ToAStage | null>;
}

export class SupabaseGameDataRepository implements IGameDataRepository {
  constructor(private client: SupabaseClient) {}

  async getPatchContext(version: string, cycleId?: string): Promise<PatchContext | null> {
    const { data: patch, error } = await this.client
      .from('patches')
      .select('id, version, release_date')
      .eq('version', version)
      .single();

    if (error || !patch) return null;

    return {
      patchId: patch.id,
      version: patch.version,
      cycleId,
      snapshotDate: patch.release_date,
    };
  }

  async getResonators(patchId: string): Promise<Resonator[]> {
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
          base_hp_lvl90,
          base_atk_lvl90,
          base_def_lvl90
        ),
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
        ),
        abilities (
          id,
          ability_code,
          ability_category,
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
      `)
      .eq('resonator_patch_data.patch_id', patchId);

    if (error || !resonatorsData) {
      throw new Error(`Failed to load resonators for patch ${patchId}: ${error?.message}`);
    }

    return resonatorsData.map((row: any) => {
      const patchData = Array.isArray(row.resonator_patch_data)
        ? row.resonator_patch_data[0]
        : row.resonator_patch_data;

      const roles: FunctionalRole[] = (row.resonator_roles || []).map((rr: any) => ({
        code: rr.functional_roles?.code || '',
        label: rr.functional_roles?.label || '',
        isPrimary: rr.is_primary,
      }));

      const combatTags: CombatTag[] = (row.resonator_combat_tags || []).map((rc: any) => ({
        code: rc.combat_tags?.code || '',
        label: rc.combat_tags?.label || '',
      }));

      const abilities: ResonatorAbility[] = (row.abilities || []).map((ab: any) => {
        const effects: GameplayEffect[] = (ab.ability_effects || [])
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
          name: ab.name,
          cooldownSeconds: ab.cooldown_seconds,
          energyCost: ab.energy_cost,
          concertosGenerated: ab.concertos_generated,
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
  }

  async getResonatorById(resonatorId: string, patchId: string): Promise<Resonator | null> {
    const list = await this.getResonators(patchId);
    return list.find((r) => r.id === resonatorId) || null;
  }

  async getWeapons(patchId: string): Promise<Weapon[]> {
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

    return data.map((row: any) => {
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
  }

  async getEchoes(patchId: string): Promise<Echo[]> {
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

    return data.map((row: any) => {
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
  }

  async getSonatas(patchId: string): Promise<Sonata[]> {
    const { data, error } = await this.client
      .from('sonatas')
      .select(`
        id,
        name,
        code,
        description,
        sonata_patch_data!inner (
          two_piece:gameplay_effects!sonata_patch_data_two_piece_effect_id_fkey (
            id, patch_id, category, target, condition_expression, detail_expression
          ),
          five_piece:gameplay_effects!sonata_patch_data_five_piece_effect_id_fkey (
            id, patch_id, category, target, condition_expression, detail_expression
          )
        )
      `)
      .eq('sonata_patch_data.patch_id', patchId);

    if (error || !data) {
      throw new Error(`Failed to load sonatas for patch ${patchId}: ${error?.message}`);
    }

    return data.map((row: any) => {
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

    const towers: ToATower[] = [];
    for (const zone of (cycle as any).toa_zones || []) {
      for (const t of zone.toa_towers || []) {
        const stages: ToAStage[] = [];
        for (const s of t.toa_stages || []) {
          const loadedStage = await this.getToAStage(s.id, patchId);
          if (loadedStage) stages.push(loadedStage);
        }
        towers.push({
          id: t.id,
          towerOrder: t.tower_order,
          towerName: t.tower_name,
          stages: stages.sort((a, b) => a.stageIndex - b.stageIndex),
        });
      }
    }

    return {
      id: cycle.id,
      patchId: cycle.patch_id,
      cycleName: cycle.cycle_name,
      startTime: cycle.start_time,
      endTime: cycle.end_time,
      towers: towers.sort((a, b) => a.towerOrder - b.towerOrder),
    };
  }

  async getToAStage(stageId: string, patchId: string): Promise<ToAStage | null> {
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
            source_id,
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
        sourceId: ae.source_id,
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

    return {
      id: stage.id,
      patchId,
      stageIndex: stage.stage_index,
      vigorCost: stage.vigor_cost,
      areaEffects,
      challengeGoals: challengeGoals.sort((a, b) => a.goalOrder - b.goalOrder),
      waves: waves.sort((a, b) => a.waveIndex - b.waveIndex),
    };
  }
}
