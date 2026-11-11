/** 分享码的位流、文字编码和有界压缩；仅由按需加载的规划器引用。 */
import { deflateSync, inflateSync } from 'fflate';
import { TEXT_CODE_GROUPS, TEXT_ESCAPE_BITS } from './shareTextCodebook.ts';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const MAX_PAYLOAD = 768;
const ESCAPE = 65536;
const COMPRESSION = { level: 9, mem: 4 } as const;
export type TextMode = 0 | 1 | 2;

/** 以高位优先写入非负整数，最后不足一字节的位补零。 */
export class BitWriter {
  private bytes: number[] = [];
  private position = 0;
  write(value: number, width: number): void {
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) throw new Error('Share value out of range');
    for (let bit = width - 1; bit >= 0; bit--, this.position++) {
      const index = this.position >> 3;
      this.bytes[index] = (this.bytes[index] ?? 0) | ((value >> bit & 1) << (7 - (this.position & 7)));
    }
  }
  finish(): Uint8Array { return Uint8Array.from(this.bytes); }
}

/** 读取位流；字段截断、额外字节或非零填充均抛出异常，由导入入口统一处理。 */
export class BitReader {
  private data: Uint8Array;
  private position = 0;
  constructor(data: Uint8Array) { this.data = data; }
  get remaining(): number { return this.data.length * 8 - this.position; }
  read(width: number): number {
    if (width > this.remaining) throw new Error('Incomplete share data');
    let value = 0;
    for (let bit = 0; bit < width; bit++, this.position++) value = value * 2 + (this.data[this.position >> 3] >> (7 - (this.position & 7)) & 1);
    return value;
  }
  finish(): void {
    if (this.remaining > 7 || this.read(this.remaining)) throw new Error('Unexpected share data');
  }
}

interface TextCode { value: number; width: number }
interface TextNode { zero?: TextNode; one?: TextNode; symbol?: number }
const codes = new Map<number, TextCode>();
const root: TextNode = {};
let nextCode = 0, previousWidth = 0;
for (const [width, chars] of TEXT_CODE_GROUPS) {
  nextCode <<= width - previousWidth;
  previousWidth = width;
  const symbols = Array.from(chars, char => char.charCodeAt(0));
  if (width === TEXT_ESCAPE_BITS) symbols.push(ESCAPE);
  for (const symbol of symbols) {
    const value = nextCode++;
    codes.set(symbol, { value, width });
    let node = root;
    for (let bit = width - 1; bit >= 0; bit--) node = value >> bit & 1 ? (node.one ??= {}) : (node.zero ??= {});
    node.symbol = symbol;
  }
}

/**
 * 将文字按 UTF-8、UTF-16 或固定字表写入位流，不去除空白。
 * UTF-8 无法原样表示孤立代理码元时返回 false，让调用方选择另两种无损格式。
 */
export function writeShareText(writer: BitWriter, text: string, mode: TextMode): boolean {
  if (mode === 0) {
    const bytes = new TextEncoder().encode(text);
    if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) !== text) return false;
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
export function readShareText(reader: BitReader, length: number, mode: TextMode): string {
  let text = '';
  if (mode === 0) {
    const bytes = Uint8Array.from({ length: Math.floor(reader.remaining / 8) }, () => reader.read(8));
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      if (mode === 1) text += String.fromCharCode(reader.read(16));
      else {
        let node: TextNode | undefined = root;
        while (node && node.symbol === undefined) node = reader.read(1) ? node.one : node.zero;
        if (!node) throw new Error('Invalid text code');
        text += String.fromCharCode(node.symbol === ESCAPE ? reader.read(16) : node.symbol!);
      }
    }
  }
  if (text.length !== length) throw new Error('Invalid text length');
  reader.finish();
  return text;
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 返回自带文字模式的 URL 安全载荷；压缩后确实更短时才使用 raw DEFLATE。 */
export function packSharePayload(payload: Uint8Array, mode: TextMode): string {
  if (payload.length > MAX_PAYLOAD) throw new Error('Share data too large');
  const compressed = deflateSync(payload, COMPRESSION);
  return compressed.length < payload.length
    ? BASE64[mode | 4] + toBase64(compressed)
    : BASE64[mode] + toBase64(payload);
}

/** 解码不超过 768 字节的载荷；多留一字节检测解压溢出，禁止压缩流扩大内存分配。 */
export function unpackSharePayload(token: string): { reader: BitReader; mode: TextMode } {
  if (token.length < 2 || token.length > 1025 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid share token');
  const flags = BASE64.indexOf(token[0]);
  if (flags > 6 || (flags & 3) === 3) throw new Error('Unknown share format');
  const body = token.slice(1);
  const bytes = Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - body.length % 4) % 4)), char => char.charCodeAt(0));
  if (toBase64(bytes) !== body) throw new Error('Invalid base64 padding');
  const payload = flags & 4 ? inflateSync(bytes, { out: new Uint8Array(MAX_PAYLOAD + 1) }) : bytes;
  if (payload.length > MAX_PAYLOAD) throw new Error('Share data too large');
  // fflate 允许终止块后的字节；限定为本编码器的规范输出，拒绝夹带或截断的压缩流。
  if ((flags & 4) && toBase64(deflateSync(payload, COMPRESSION)) !== body) throw new Error('Noncanonical compressed data');
  return { reader: new BitReader(payload), mode: (flags & 3) as TextMode };
}
