import type {OwnedBoxRank} from './model.ts';
import {parseBoxInput, type BoxImportResult} from './importText.ts';
import {parseBoxShare} from './importShare.ts';

export {readYituliuWorkbook, type BoxImportResult} from './importText.ts';

/** 同步兼容入口，供同时需要文本和短码的调用者使用。 */
export function parseExternalBox(
  input: string,
  fallbackRank: OwnedBoxRank = 3,
): BoxImportResult {
  return parseBoxInput(input, fallbackRank, parseBoxShare);
}
