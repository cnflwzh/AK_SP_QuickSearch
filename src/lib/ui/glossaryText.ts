import {splitGlossaryText} from '../glossary.ts';
import {esc} from './dom.ts';

/**
 * 为纯文本加上词典标注。链接或按钮内传 false，让父控件保留键盘焦点与点击行为。
 * 可选排版回调收到的是已转义文本，例如可将数字加粗；不要传入现成 HTML。
 */
export function glossaryHtml(
  plainText: string,
  focusable = true,
  formatEscaped?: (escapedText: string) => string,
): string {
  return splitGlossaryText(plainText)
    .map(({text, term}) => {
      const escaped = esc(text);
      const content = formatEscaped ? formatEscaped(escaped) : escaped;
      if (!term) return content;
      const trigger = focusable ? ' tabindex="0" role="button"' : '';
      return `<span class="glossary-term" data-glossary-term="${esc(term)}"${trigger}>${content}</span>`;
    })
    .join('');
}
