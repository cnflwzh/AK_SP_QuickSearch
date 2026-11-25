import type {Covenant} from '../../data/index.ts';
import {atLayers} from '../lib/plans/covenants.ts';
import {bonusHeadcount, bonusText, fx} from './format.ts';

/** 为带独立强化标签的效果卡生成文案。零层保留原文，避免遮掉玩家尚未填写的层数。 */
export function covenantEffectCard(covenant: Covenant, layers: number) {
  const render = (text: string) => fx(layers ? atLayers(text, layers) : text);
  const head = bonusHeadcount(covenant.bonus);
  return {
    effect: render(covenant.effect),
    bonus: covenant.bonus ? render(bonusText(covenant.bonus)) : '',
    bonusLabel: head ? `${head} 名` : '强化',
  };
}
