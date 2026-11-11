import { covenantColor } from '../../data/index.ts';
import { esc } from '../lib/dom.ts';

export const color = (name: string): string => covenantColor(name, 'var(--teal)');
/** Escapes dataset text before adding the existing inline effect formatting. */
export const fx = (text: string): string => esc(text)
  .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
  .replace(/&lt;([^&]+?)&gt;/g, '<em class="k">$1</em>')
  .replace(/【([^】]+)】/g, '<em class="c">$1</em>');
export const peekFx = (text: string): string => esc(text)
  .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
  .replace(/&lt;([^&]+?)&gt;/g, '<em class="pk-k">$1</em>')
  .replace(/【([^】]+)】/g, (_, name: string) => `<em class="pk-c" style="--c:${color(name)}">${name}</em>`);
export const hpWidth = (hp: number): number => (hp - 15) / 25 * 100;
export const bonusHeadcount = (bonus?: string): number => +(bonus?.match(/^(\d+)名/)?.[1] ?? 0);
export const bonusText = (bonus?: string): string => (bonus || '').replace(/^\d+名(不同【[^】]+】)?[：:]?/, '');
const shorten = (text: string): string => text.replace(/使已激活的|已激活的/g, '')
  .replace(/（此干员在整备区也生效）/, '（整备区生效）')
  .replace(/每回合至多叠加/g, '每回合至多').replace(/每场战斗至多叠加/g, '每场至多');
const formatTags = (text: string, current: string): string => esc(text)
  .replace(/&lt;([^&]+?)&gt;/g, '<em class="k">$1</em>')
  .replace(/【([^】]+)】/g, (_, name: string) => `<em class="c${name === current ? ' on' : ''}" style="--c:${color(name)}">${name}</em>`);
const formatNumbers = (text: string, current: string): string => formatTags(text, current)
  .replace(/(\d+(?:\.\d+)?)(?![^<]*>)/g, '<b>$1</b>');
/** Combines base/elite values only when their text skeleton is identical. */
export function stackText(trait: string, elite: string, current: string): string {
  const base = shorten(trait), advanced = shorten(elite);
  const a = base.split(/(\d+(?:\.\d+)?)/), b = advanced.split(/(\d+(?:\.\d+)?)/);
  if (a.length === b.length && a.every((part, i) => i % 2 || part === b[i])) {
    return a.map((part, i) => i % 2 === 0 ? formatTags(part, current)
      : part === b[i] ? `<b>${part}</b>` : `<b>${part}<s>/</s><u>${b[i]}</u></b>`).join('');
  }
  return formatNumbers(base, current) + `<span class="el"><u>精锐</u> ${formatNumbers(advanced, current)}</span>`;
}
