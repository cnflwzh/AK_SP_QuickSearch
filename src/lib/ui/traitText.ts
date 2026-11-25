/** 特质原文拆成可独立排版的文字、触发时机、盟约和数值，标签内容不包含定界符。 */
export interface TraitSegment {
  readonly text: string;
  readonly kind: 'text' | 'trigger' | 'covenant' | 'num';
}

/** 拆分游戏文案，不缩写原句。单独出现的比较符、换行和普通标点保留在文字片段里。 */
export function tokenizeTrait(text: string): TraitSegment[] {
  const parts: TraitSegment[] = [];
  let offset = 0;
  for (const match of text.matchAll(/<([\p{L}][^<>\r\n]*)>|【([^【】\r\n]+)】|(\d+(?:\.\d+)?%?)/gu)) {
    if (match.index > offset) parts.push({kind: 'text', text: text.slice(offset, match.index)});
    if (match[1] !== undefined) parts.push({kind: 'trigger', text: match[1]});
    else if (match[2] !== undefined) parts.push({kind: 'covenant', text: match[2]});
    else parts.push({kind: 'num', text: match[0]});
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({kind: 'text', text: text.slice(offset)});
  return parts;
}

/** 教程会单独排版时机，但保留游戏原文中盟约名称两侧的方头括号。 */
export const traitLabel = (part: TraitSegment): string =>
  part.kind === 'covenant' ? '【' + part.text + '】' : part.text;
