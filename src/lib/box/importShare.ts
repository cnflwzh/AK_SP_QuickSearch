import {decodeBox} from './share.ts';
import {summarizeEntries, type BoxImportResult} from './importText.ts';

/** 解码同步短码，损坏或没有本季记录时返回可显示给用户的错误。 */
export function parseBoxShare(input: string): BoxImportResult {
  const synced = decodeBox(input);
  if (!synced) {
    throw new Error('同步码不完整、已损坏或与当前赛季及版本不匹配，请在对应赛季重新扫码或粘贴完整短码。');
  }
  const result = summarizeEntries(synced, 0, '跨端同步码');
  if (!result.matchedCount) {
    throw new Error('这个同步码里还没有已标记的本赛季干员。');
  }
  return result;
}
