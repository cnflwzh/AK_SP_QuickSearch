import { reactive } from 'vue';
import { COMMON_LAYER_COVENANTS, type SHOP_MODE_IDS } from '../../../data/numberTools.ts';

export type LayerSection = 'threshold' | 'cycle' | 'headcount';
export type ShopMode = typeof SHOP_MODE_IDS[number];

/** 数值工具的临时输入。空预算表示尚未填写；空预留覆盖值表示使用目标干员基础价。 */
interface NumberToolsState {
  layers: {
    covenant: string;
    section: LayerSection;
    count: number;
  };
  recruit: {
    targetName: string;
    search: string;
    level: number;
    shopMode: ShopMode;
    onlyAvailable: boolean;
    showAllResults: boolean;
    budget: {
      funds: number | null;
      upgrade: number | null;
      reserveOverride: number | null;
    };
  };
  bounty: {
    search: string;
    payout: '' | 'single' | 'multi';
    sort: '' | 'reward';
  };
  roundDifficulty: number;
}

// 模块级状态在离开数值页后仍保留，方便查完其他页面继续计算；刷新页面后恢复默认值。
const state = reactive<NumberToolsState>({
  layers: { covenant: COMMON_LAYER_COVENANTS[0], section: 'threshold', count: 60 },
  recruit: {
    targetName: '', search: '', level: 4, shopMode: 'advanced',
    onlyAvailable: false, showAllResults: false,
    budget: { funds: null, upgrade: null, reserveOverride: null },
  },
  bounty: { search: '', payout: '', sort: '' },
  roundDifficulty: 1,
});

/** 返回当前页面会话共用的响应式输入；修改只更新界面，不写入 URL、历史记录或本地存储。 */
export function useNumberToolsState(): NumberToolsState {
  return state;
}
