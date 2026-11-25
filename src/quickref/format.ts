import { covenantColor } from '../../data/index.ts';
import { esc } from '../lib/ui/dom.ts';
import { glossaryHtml } from '../lib/ui/glossaryText.ts';

export const color = (name: string): string => covenantColor(name, 'var(--teal)');
const boldNumbers = (escaped: string): string =>
  escaped.replace(/\d+(?:\.\d+)?%?/g, '<b>$&</b>');

/** 先按原始数据区分时机和盟约，再渲染数字与词条，避免把 HTML 属性误作正文。 */
function effectHtml(
  text: string,
  focusable: boolean,
  mode: 'effect' | 'peek' | 'roster',
  current = '',
  formatEscaped = boldNumbers,
): string {
  return text.split(/(<[^<>]+>|【[^】]+】)/g).map((part, i) => {
    if (i % 2 === 0) return glossaryHtml(part, focusable, formatEscaped);
    const label = part.slice(1, -1);
    if (part.startsWith('<')) {
      return `<em class="${mode === 'peek' ? 'pk-k' : 'k'}">${glossaryHtml(label, focusable, formatEscaped)}</em>`;
    }
    // 【盟约名】已有完整的盟约速览，无须在它里面再放一个词典入口。
    const cls = mode === 'peek' ? 'pk-c'
      : mode === 'roster' && current === label ? 'c on' : 'c';
    const style = mode === 'effect' ? '' : ` style="--c:${esc(color(label))}"`;
    return `<em class="${cls}"${style}>${formatEscaped(esc(label))}</em>`;
  }).join('');
}

const focusableEffects = new Map<string, string>();
const staticEffects = new Map<string, string>();

/** 将效果原文排成安全的 HTML。列表链接内传 false，Tab 仍只停在原来的链接上。 */
export function fx(text: string, focusable = true): string {
  const cache = focusable ? focusableEffects : staticEffects;
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  const html = effectHtml(text, focusable, 'effect');
  if (text.length <= 512) {
    if (cache.size >= 512) cache.delete(cache.keys().next().value!);
    cache.set(text, html);
  }
  return html;
}
/** 将效果原文排成盟约侧栏、局内抓取详情使用的 HTML。 */
export const peekFx = (text: string): string => effectHtml(text, true, 'peek');
export const hpWidth = (hp: number): number => (hp - 15) / 25 * 100;
export const bonusHeadcount = (bonus?: string): number => +(bonus?.match(/^(\d+)名/)?.[1] ?? 0);
export const bonusText = (bonus?: string): string => (bonus || '').replace(/^\d+名(不同【[^】]+】)?[：:]?/, '');
const shorten = (text: string): string => text.replace(/使已激活的|已激活的/g, '')
  .replace(/（此干员在整备区也生效）/, '（整备区生效）')
  .replace(/每回合至多叠加/g, '每回合至多').replace(/每场战斗至多叠加/g, '每场至多');
/** 将当前盟约的初始 / 精锐特质排成抓牌行。两段去掉数值后文字完全相同时才合并数字。 */
export function stackText(trait: string, elite: string, current: string): string {
  const base = shorten(trait), advanced = shorten(elite);
  const a = base.split(/(\d+(?:\.\d+)?)/), b = advanced.split(/(\d+(?:\.\d+)?)/);
  if (a.length === b.length && a.every((part, i) => i % 2 || part === b[i])) {
    let nextNumber = 1;
    return effectHtml(base, false, 'roster', current, (escaped) =>
      escaped.replace(/\d+(?:\.\d+)?/g, (value) => {
        const eliteValue = b[nextNumber];
        nextNumber += 2;
        return eliteValue === value ? `<b>${value}</b>` : `<b>${value}<s>/</s><u>${eliteValue}</u></b>`;
      }),
    );
  }
  const formatRow = (text: string) => effectHtml(text, false, 'roster', current,
    (escaped) => escaped.replace(/\d+(?:\.\d+)?/g, '<b>$&</b>'));
  return formatRow(base) +
    `<span class="el"><u>${glossaryHtml('精锐', false)}</u> ${formatRow(advanced)}</span>`;
}
