/** 图片资源路径。名称查不到时返回空字符串，调用方据此省略 <img> */
import { OPERATOR, EQUIP, STRATEGY, LEADER } from '../../data/index.ts';

const IMG = '/assets/img';

export const avatarSrc = (name: string): string => OPERATOR[name] ? `${IMG}/avatars/${OPERATOR[name].avatar}.webp` : '';
export const equipIconSrc = (name: string): string => EQUIP[name] ? `${IMG}/equipment/${EQUIP[name].icon}.webp` : '';
export const portraitSrc = (name: string): string => STRATEGY[name] ? `${IMG}/strategies/${STRATEGY[name].portrait}.webp` : '';
export const leaderSrc = (name: string): string => LEADER[name] ? `${IMG}/leaders/${LEADER[name].id}.webp` : '';

/** 将游戏敌人 ID 转为本地悬赏头像路径；空 ID 返回空字符串。 */
export const enemyIconSrc = (enemyId: string): string => enemyId ? `${IMG}/enemies/${enemyId}.webp` : '';

/** 懒加载 <img>；src 为空时输出空字符串 */
export const img = (src: string, className = '', size = 80) => src
  ? `<img class="${className}" src="${src}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`
  : '';
