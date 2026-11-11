/** DOM 与 HTML 字符串工具，两个页面共用 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 转义后可安全放进 HTML 文本或属性 */
export const esc = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const stringify = value => {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(stringify).join('');
  return String(value);
};

/**
 * 拼接 HTML 的模板标签（不做转义，需要时自行调用 esc）。
 *   - 插值为数组时直接拼接，省去 .join('')
 *   - null / undefined / false 输出为空字符串，可写 ${cond && html`…`}
 *     （数字 0 会原样输出 "0"，条件是数量时请写成 list.length > 0 && …）
 *   - 模板里 "换行 + 缩进" 会被删掉，长模板可以分行书写而不产生多余空白
 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((part, i) => {
    out += part.replace(/\n\s*/g, '');
    if (i < values.length) out += stringify(values[i]);
  });
  return out;
}

/** [start, start+1, …]，共 n 个 */
export const range = (n, start = 0) => Array.from({ length: n }, (_, i) => start + i);

/** 大数字缩写为 "万" */
export const wan = v => v >= 10000 ? (v / 10000).toFixed(v >= 1e6 ? 0 : 1) + '万' : v;

/** 保留一位小数 */
export const round1 = v => Math.round(v * 10) / 10;
