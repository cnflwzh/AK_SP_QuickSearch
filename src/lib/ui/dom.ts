/** DOM 与 HTML 字符串工具，两个页面共用 */

/** Read the current OS preference or user reduced-motion setting at use time. */
export const prefersReducedMotion = (): boolean =>
  document.documentElement.dataset.motion === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 转义后可安全放进 HTML 文本或属性 */
export const esc = (value: unknown): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stringify = (value: unknown): string => {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(stringify).join('');
  return String(value);
};

/**
 * 拼接 HTML 的模板标签（不做转义，需要时自行调用 esc）。
 *   - 插值为数组时直接拼接，省去 .join('')
 *   - null / undefined / false 输出为空字符串，可写 ${cond && html`…`}
 *     （数字 0 会原样输出 "0"，条件是数量时请写成 list.length > 0 && …）
 *   - 模板换行会折叠为标记间的空白或属性间的分隔，插值保留原文
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  const vals = values.map(stringify);
  let out = '';
  strings.forEach((part, i) => {
    const prevIsTagEnd = i === 0 || out.endsWith('>');
    let nextChar = '<';
    for (let j = i; j < vals.length; j++) {
      if (vals[j].length > 0) {
        nextChar = vals[j][0];
        break;
      }
      const nextPart = strings[j + 1];
      if (nextPart.length > 0) {
        nextChar = nextPart[0];
        break;
      }
    }
    let clean = part;
    if (prevIsTagEnd) clean = clean.replace(/^\n\s*/, '');
    if (nextChar === '<') clean = clean.replace(/\n\s*$/, '');
    clean = clean
      .replace(/>\n\s*</g, '><')
      .replace(/>\n\s*/g, '>')
      .replace(/\n\s*</g, '<')
      .replace(/\n\s*/g, ' ');
    out += clean;
    if (i < vals.length) out += vals[i];
  });
  return out;
}

/** [start, start+1, …]，共 n 个 */
export const range = (n: number, start = 0) =>
  Array.from({length: n}, (_, i) => start + i);

/** 大数字缩写为 "万" */
export const wan = (v: number): string | number =>
  v >= 10000 ? (v / 10000).toFixed(v >= 1e6 ? 0 : 1) + '万' : v;

/** 保留一位小数 */
export const round1 = (v: number): number => Math.round(v * 10) / 10;
