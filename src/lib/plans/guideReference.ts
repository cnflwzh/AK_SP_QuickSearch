import {MAX_EXTENDED_PAYLOAD} from './shareLimits.ts';
import {planShareSource} from './shareInput.ts';
import {sklandIdFromText} from './skland.ts';

/** id 始终是原样的十进制字符串；patch 仅在分享者修改过原文时提供。 */
export interface GuideReference {
  id: string;
  patch?: string;
}

/** 只在本站短链接中解析差异；官方链接和单独粘贴的十进制攻略编号读取当前原文。 */
export function readGuideReference(input: string): GuideReference | null {
  if (input.length > MAX_EXTENDED_PAYLOAD * 4) return null;
  const source = planShareSource(input);
  const compact = /#g=([^\s<>"'，。；、）】)\]]*)/.exec(source);
  if (compact) {
    const match = /^(\d{1,24})(?:\.([QU][A-Za-z0-9_-]+))?$/.exec(compact[1]);
    return match ? {id: match[1], patch: match[2]} : null;
  }
  const id = /^\d{1,24}$/.test(source.trim())
    ? source.trim()
    : sklandIdFromText(source);
  return id ? {id} : null;
}
