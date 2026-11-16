import type {SeasonDefinition} from '../../types.ts';
import {S1_CORE_BUILDS, S1_MIXED_BUILDS} from './builds.ts';
import {S1_COVENANTS} from './covenants.ts';
import {S1_CREDITS} from './credits.ts';
import {S1_EQUIPMENT, S1_EQUIPMENT_COMBOS} from './equipment.ts';
import {
  S1_LEADER_BATTLEFIELDS,
  S1_LEADER_MOVEMENTS,
} from './leader-movement.ts';
import {S1_LEADERS, S1_LEADER_MAP} from './leaders.ts';
import {S1_META} from './meta.ts';
import {S1_OPERATORS} from './operators.ts';
import {S1_RULES} from './rules.ts';
import {S1_STRATEGIES, S1_STRATEGY_CATEGORIES} from './strategies.ts';

export const S1_SEASON: SeasonDefinition = {
  meta: S1_META,
  covenants: S1_COVENANTS,
  operators: S1_OPERATORS,
  equipment: S1_EQUIPMENT,
  equipmentCombos: S1_EQUIPMENT_COMBOS,
  strategies: S1_STRATEGIES,
  strategyCategories: S1_STRATEGY_CATEGORIES,
  coreBuilds: S1_CORE_BUILDS,
  mixedBuilds: S1_MIXED_BUILDS,
  leaders: S1_LEADERS,
  leaderBattlefields: S1_LEADER_BATTLEFIELDS,
  leaderMovements: S1_LEADER_MOVEMENTS,
  leaderMap: S1_LEADER_MAP,
  rules: S1_RULES,
  credits: S1_CREDITS,
};
