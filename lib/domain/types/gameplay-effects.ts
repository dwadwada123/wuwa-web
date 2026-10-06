/**
 * Domain Gameplay Effects Taxonomy & Model
 */

export type GameplayEffectCategory =
  | 'STAT_BUFF'
  | 'DMG_AMPLIFY'
  | 'COORDINATED_ATTACK'
  | 'DEF_SHRED'
  | 'RES_SHRED'
  | 'HEALING'
  | 'SHIELD'
  | 'SPECIAL_MECHANIC'
  | 'RESOURCE_GRANT'
  | 'STATE_CHANGE';

export type GameplayEffectTarget =
  | 'SELF'
  | 'ACTIVE_CHARACTER'
  | 'NEXT_RESONATOR'
  | 'TEAM'
  | 'ENEMY';

export interface GameplayEffect {
  id: string;
  patchId: string;
  category: GameplayEffectCategory;
  target: GameplayEffectTarget;
  conditionExpression?: Record<string, unknown>;
  detailExpression?: Record<string, unknown>;
}
