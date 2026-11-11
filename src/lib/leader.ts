/** 领袖卡片的共用格式：能力文本上色、伤害类型配色、简称。速查页领袖标签与速览卡片共用。 */
import type { CounterTag, Leader, LeaderDamage } from '../../data/index.ts';
import { esc } from './dom.ts';

const DAMAGE_CLASS: Readonly<Record<LeaderDamage, string>> = {
  物理: 'phy', 法术: 'arts', 真实: 'true', 侵蚀: 'ero', 凋亡: 'apo', 神经: 'neu',
};
export const damageClass = (damage: LeaderDamage): string => DAMAGE_CLASS[damage];

/** 能力文本：数字加粗，【技能】 <单位> {状态} 分别上色（写法见 data/leaders.ts） */
export const leaderFx = (text: string): string => esc(text)
  .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
  .replace(/【([^】]+)】/g, '<em class="lk">$1</em>')
  .replace(/&lt;([^&]+?)&gt;/g, '<em class="lu">$1</em>')
  .replace(/\{([^}]+)\}/g, '<em class="ls">$1</em>');

/** 无名能力的标签：基础形态为「特性」，隐秘核心为「强化」 */
export const abilityLabel = (skill: string | undefined, hidden = false): string => skill || (hidden ? '强化' : '特性');

/** 头像旁的短名：胄、昆图斯、阿利斯泰尔、萨米的意志…… */
export const shortName = (leader: Pick<Leader, 'name'>): string => leader.name
  .replace(/^假想敌：/, '').replace(/^盐风主教/, '').replace(/，.*$/, '').replace(/[“”]/g, '');

/** 领袖回合会巡逻进玩家半场（铳、鳍、矩兽） */
export const patrols = (leader: Pick<Leader, 'stage'>): boolean => leader.stage.marks.some(m => m.kind === 'boss' && m.loop);

const COUNTER_CLASS: Readonly<Record<CounterTag, string>> = {
  分散: 'sp', 阻挡: 'bl', 集火: 'fo', 法抗: 'ar', 对空: 'air', 限时: 'tm', 避让: 'av', 续航: 'su', 控制: 'cc',
};
export const counterClass = (tag: CounterTag): string => COUNTER_CLASS[tag];
