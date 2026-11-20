import {reactive} from 'vue';
import type {CreditTargetKind} from '../../../data/types.ts';
import {
  COMMON_LAYER_COVENANTS,
  CREDIT,
  type SHOP_MODE_IDS,
} from '../../../data/index.ts';
import {
  defaultCreditTarget,
  type CreditMode,
} from '../../lib/numbers/numberTools.ts';

export type LayerSection = 'threshold' | 'cycle' | 'headcount';
export type MatchOverviewSection = 'all' | 'layers' | 'dispatch';
export type ShopMode = (typeof SHOP_MODE_IDS)[number];

/** 数值工具的临时输入。 */
interface NumberToolsState {
  layers: {
    viewSection: MatchOverviewSection;
    covenant: string;
    section: LayerSection;
    count: number;
    /** 已经从哪个本局方案带入过层数，离开小工具后保留玩家的手动选择。 */
    lastAutoRunKey: string;
  };
  economy: {
    level: number;
    shopMode: ShopMode;
  };
  credit: {
    mode: CreditMode;
    jointDifficulty: number;
    soloLevel: number;
    roundsCleared: number;
    defeatedLeader: boolean;
    battleEarned: number;
    objectiveEarned: number;
    limitedSpend: number;
    balance: number;
    targetKind: CreditTargetKind;
    targetCredit: number;
  };
  roundDifficulty: number;
}

// 模块级状态在离开数值页后仍保留，方便查完其他页面继续计算；刷新页面后恢复默认值。
const state = reactive<NumberToolsState>({
  layers: {
    viewSection: 'all',
    covenant: COMMON_LAYER_COVENANTS[0],
    section: 'threshold',
    count: 60,
    lastAutoRunKey: '',
  },
  economy: {
    level: 4,
    shopMode: 'advanced',
  },
  credit: {
    mode: 'joint',
    jointDifficulty: 1,
    soloLevel: 15,
    roundsCleared: CREDIT.length,
    defeatedLeader: true,
    battleEarned: 0,
    objectiveEarned: 0,
    limitedSpend: 0,
    balance: 0,
    targetKind: 'battle',
    targetCredit: defaultCreditTarget(),
  },
  roundDifficulty: 1,
});

/** 返回当前页面会话共用的响应式输入；修改只更新界面，不写入 URL、历史记录或本地存储。 */
export function useNumberToolsState(): NumberToolsState {
  return state;
}
