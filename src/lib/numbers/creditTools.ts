import {
  CREDIT,
  LEADER_CREDIT_BONUS,
  QUICK_CREDIT_MODE,
} from '../../../data/index.ts';

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/**
 * 按通过回合数和认证效率百分比计算单局收益。击败当前模式的最终领袖时加入奖励后取整。
 * 返回总收益、回合收益以及其中的领袖奖励，供图解教程分别展示。
 */
export function roundCredit(
  roundsCleared: number,
  efficiency: number,
  defeatedLeader = false,
  mode: 'joint' | 'solo' | 'quick' = 'joint',
): {perRun: number; roundPart: number; leaderBonus: number} {
  const finalRound = mode === 'quick' ? QUICK_CREDIT_MODE.rounds : CREDIT.length;
  const rounds = Math.min(finalRound, whole(roundsCleared));
  const base = CREDIT[rounds - 1] ?? 0;
  const bonus =
    defeatedLeader && rounds === finalRound ? LEADER_CREDIT_BONUS : 0;
  const percent = whole(efficiency);
  const roundPart = Math.round((base * percent) / 100);
  const perRun = Math.round(((base + bonus) * percent) / 100);
  return {perRun, roundPart, leaderBonus: perRun - roundPart};
}
