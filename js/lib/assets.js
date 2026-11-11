/** 图片资源路径。名称查不到时返回空字符串，调用方据此省略 <img> */
import { OPERATOR, EQUIP, STRATEGY } from '../../data/index.js';

const IMG = 'assets/img';

export const avatarSrc = name => OPERATOR[name] ? `${IMG}/avatars/${OPERATOR[name].avatar}.webp` : '';
export const equipIconSrc = name => EQUIP[name] ? `${IMG}/equipment/${EQUIP[name].icon}.webp` : '';
export const portraitSrc = name => STRATEGY[name] ? `${IMG}/strategies/${STRATEGY[name].portrait}.webp` : '';

/** 懒加载 <img>；src 为空时输出空字符串 */
export const img = (src, className = '', size = 80) => src
  ? `<img class="${className}" src="${src}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`
  : '';
