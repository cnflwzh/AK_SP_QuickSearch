import {MAX_EXTENDED_PAYLOAD} from './shareLimits.ts';
/** 分享码的位流、文字编码和有界压缩；仅由按需加载的规划器引用。 */
import {deflateSync, inflateSync} from 'fflate';
import {BitReader, BitWriter, fromBase64Url, toBase64Url} from '../shareBits.ts';
import {TEXT_CODE_GROUPS, TEXT_ESCAPE_BITS} from './shareTextCodebook.ts';

export {BitReader, BitWriter} from '../shareBits.ts';

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const MAX_PAYLOAD = 768;
export {MAX_EXTENDED_PAYLOAD} from './shareLimits.ts';
const ESCAPE = 65536;
const COMPRESSION = {level: 9, mem: 4} as const;
export type TextMode = 0 | 1 | 2;

interface TextCode {
  value: number;
  width: number;
}
interface TextNode {
  zero?: TextNode;
  one?: TextNode;
  symbol?: number;
}
const codes = new Map<number, TextCode>();
const root: TextNode = {};
let nextCode = 0,
  previousWidth = 0;
for (const [width, chars] of TEXT_CODE_GROUPS) {
  nextCode <<= width - previousWidth;
  previousWidth = width;
  const symbols = Array.from(chars, (char) => char.charCodeAt(0));
  if (width === TEXT_ESCAPE_BITS) symbols.push(ESCAPE);
  for (const symbol of symbols) {
    const value = nextCode++;
    codes.set(symbol, {value, width});
    let node = root;
    for (let bit = width - 1; bit >= 0; bit--)
      node = (value >> bit) & 1 ? (node.one ??= {}) : (node.zero ??= {});
    node.symbol = symbol;
  }
}

/**
 * 将文字按 UTF-8、UTF-16 或固定字表写入位流，不去除空白。
 * UTF-8 无法原样表示孤立代理码元时返回 false，让调用方选择另两种无损格式。
 */
export function writeShareText(
  writer: BitWriter,
  text: string,
  mode: TextMode,
): boolean {
  if (mode === 0) {
    const bytes = new TextEncoder().encode(text);
    if (new TextDecoder('utf-8', {ignoreBOM: true}).decode(bytes) !== text)
      return false;
    for (const byte of bytes) writer.write(byte, 8);
  } else {
    for (let i = 0; i < text.length; i++) {
      const symbol = text.charCodeAt(i);
      if (mode === 1) writer.write(symbol, 16);
      else {
        const code = codes.get(symbol) ?? codes.get(ESCAPE)!;
        writer.write(code.value, code.width);
        if (!codes.has(symbol)) writer.write(symbol, 16);
      }
    }
  }
  return true;
}

/** 读取明确数量的 UTF-16 码元；字表逃逸允许生僻字和 emoji，不改变原文。 */
export function readShareText(
  reader: BitReader,
  length: number,
  mode: TextMode,
): string {
  let text = '';
  if (mode === 0) {
    const bytes = Uint8Array.from(
      {length: Math.floor(reader.remaining / 8)},
      () => reader.read(8),
    );
    text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(
      bytes,
    );
  } else {
    for (let i = 0; i < length; i++) {
      if (mode === 1) text += String.fromCharCode(reader.read(16));
      else {
        let node: TextNode | undefined = root;
        while (node && node.symbol === undefined)
          node = reader.read(1) ? node.one : node.zero;
        if (!node) throw new Error('Invalid text code');
        text += String.fromCharCode(
          node.symbol === ESCAPE ? reader.read(16) : node.symbol!,
        );
      }
    }
  }
  if (text.length !== length) throw new Error('Invalid text length');
  reader.finish();
  return text;
}

/** 返回 URL 安全载荷；hasCore 标记位流含核心字段，压缩更短时使用 raw DEFLATE；超限抛出异常。 */
export function packSharePayload(
  payload: Uint8Array,
  mode: TextMode,
  hasCore = false,
  extended = false,
  hasIcon = false,
): string {
  if (payload.length > (extended ? MAX_EXTENDED_PAYLOAD : MAX_PAYLOAD))
    throw new Error('Share data too large');
  const compressed = deflateSync(payload, COMPRESSION);
  const flags =
    mode | (hasCore ? 8 : 0) | (extended ? 16 : 0) | (hasIcon ? 32 : 0);
  return compressed.length < payload.length
    ? BASE64[flags | 4] + toBase64Url(compressed)
    : BASE64[flags] + toBase64Url(payload);
}

/** 按版本限制载荷；多留一字节识别被输出缓冲区截断的解压结果。 */
export function unpackSharePayload(token: string): {
  reader: BitReader;
  payload: Uint8Array;
  mode: TextMode;
  hasCore: boolean;
  extended: boolean;
  hasIcon: boolean;
} {
  const flags = BASE64.indexOf(token[0]);
  if (flags < 0 || (flags & 3) === 3 || (flags & 32 && !(flags & 16)))
    throw new Error('Unknown share format');
  const extended = !!(flags & 16);
  const limit = extended ? MAX_EXTENDED_PAYLOAD : MAX_PAYLOAD;
  if (
    token.length < 2 ||
    token.length > 1 + Math.ceil((limit * 4) / 3) ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  )
    throw new Error('Invalid share token');
  const body = token.slice(1);
  const bytes = fromBase64Url(body);
  if (!bytes) throw new Error('Invalid base64 padding');
  const payload =
    flags & 4 ? inflateSync(bytes, {out: new Uint8Array(limit + 1)}) : bytes;
  if (payload.length > limit) throw new Error('Share data too large');
  // fflate 允许终止块后的字节；限定为本编码器的规范输出，拒绝夹带或截断的压缩流。
  if (flags & 4 && toBase64Url(deflateSync(payload, COMPRESSION)) !== body)
    throw new Error('Noncanonical compressed data');
  return {
    payload,
    reader: new BitReader(payload),
    mode: (flags & 3) as TextMode,
    hasCore: !!(flags & 8),
    extended,
    hasIcon: !!(flags & 32),
  };
}
