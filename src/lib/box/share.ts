/**
 * Box 跨端离线同步编解码（短码 WB... 与链接 #b=...）：
 * - 按稳定槽位表对本季可持有干员的 6 种状态进行 3-bit 位流打包；
 * - 自动在「稀疏列表 / 稠密位图」与「原始 / raw DEFLATE」间选最短结果；
 * - 附带 8-bit 校验字节，损坏或截断的短码直接返回 null。
 */
import {deflateSync, inflateSync} from 'fflate';
import {SEASON_META} from '../../../data/index.ts';
import {BitReader, BitWriter} from '../shareBits.ts';
import {
  BOX_RANK_BORROWED,
  OWNABLE_OPERATORS,
  boxRankOf,
  isBorrowableAvatar,
  type OperatorBox,
  type StoredBoxRank,
} from './model.ts';

export const BOX_CODE_PREFIX = 'WB';
const {version: FORMAT_VERSION, operatorIds: BOX_SLOT_IDS} =
  SEASON_META.boxShare;
const MAX_DECODED_BYTES = 512;
const COMPRESSION = {level: 9, mem: 4} as const;

const charIdOf = (avatar: string): number =>
  Number(avatar.match(/^char_(\d+)_/)?.[1] ?? 0);

// 保留已退出干员的空槽，不让旧短码的后续记录错位。
const OWNABLE_BY_ID = new Map(
  OWNABLE_OPERATORS.map((op) => [charIdOf(op.avatar), op.avatar] as const),
);
const BOX_SLOT_AVATARS = BOX_SLOT_IDS.map((id) => OWNABLE_BY_ID.get(id));
const SHORT_CODE_MARKER = /(?:^|[^A-Za-z0-9_-])WB/;

/** 识别跨端同步标记，损坏的链接或短码也需要给出对应的导入错误。 */
export function isBoxShareInput(input: string): boolean {
  return input.includes('#b=') || SHORT_CODE_MARKER.test(input);
}

function rankToCode(rank: StoredBoxRank | -1): number {
  switch (rank) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    case BOX_RANK_BORROWED:
      return 5;
    default:
      return 0;
  }
}

function codeToRank(code: number): StoredBoxRank | -1 | null {
  switch (code) {
    case 0:
      return -1;
    case 1:
      return 0;
    case 2:
      return 1;
    case 3:
      return 2;
    case 4:
      return 3;
    case 5:
      return BOX_RANK_BORROWED;
    default:
      return null;
  }
}

function checksum8(bytes: Uint8Array): number {
  let h = 0x5a;
  for (const byte of bytes) {
    h = ((h ^ byte) * 33) & 0xff;
  }
  return h;
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

function fromBase64Url(token: string): Uint8Array | null {
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const padded =
    token.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (token.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return toBase64Url(bytes) === token ? bytes : null;
  } catch {
    return null;
  }
}

function buildDensePayload(codes: readonly number[]): Uint8Array {
  const writer = new BitWriter();
  writer.write(codes.length, 9);
  for (const code of codes) writer.write(code, 3);
  return writer.finish();
}

function buildSparsePayload(codes: readonly number[]): Uint8Array {
  const nonZero: {index: number; code: number}[] = [];
  for (let i = 0; i < codes.length; i++) {
    if (codes[i] !== 0) nonZero.push({index: i, code: codes[i]});
  }
  const writer = new BitWriter();
  writer.write(nonZero.length, 9);
  for (const item of nonZero) {
    writer.write(item.index, 9);
    writer.write(item.code, 3);
  }
  return writer.finish();
}

/** 将当前赛季 Box 编码为紧凑短码（前缀 WB）。 */
export function encodeBox(box: Readonly<OperatorBox>): string {
  const codes = BOX_SLOT_AVATARS.map((avatar) =>
    avatar ? rankToCode(boxRankOf(box, avatar)) : 0,
  );
  const candidates: {mode: 0 | 1; raw: Uint8Array}[] = [
    {mode: 0, raw: buildDensePayload(codes)},
    {mode: 1, raw: buildSparsePayload(codes)},
  ];

  let best: Uint8Array | null = null;
  for (const {mode, raw} of candidates) {
    const compressed = deflateSync(raw, COMPRESSION);
    const variants: {deflated: boolean; body: Uint8Array}[] = [
      {deflated: false, body: raw},
      {deflated: true, body: compressed},
    ];
    for (const {deflated, body} of variants) {
      const header = (FORMAT_VERSION << 4) | (mode << 1) | (deflated ? 1 : 0);
      const packet = new Uint8Array(body.length + 2);
      packet[0] = header;
      packet.set(body, 1);
      packet[packet.length - 1] = checksum8(
        packet.subarray(0, packet.length - 1),
      );
      if (!best || packet.length < best.length) best = packet;
    }
  }
  return BOX_CODE_PREFIX + toBase64Url(best!);
}

/** 提取并解码 WB 短码或 #b= 链接；无效、篡改或截断返回 null。 */
export function decodeBox(input: string): OperatorBox | null {
  if (!input || input.length > 4096) return null;
  const marker = input.includes('#b=') ? /#b=/ : SHORT_CODE_MARKER;
  const match = marker.exec(input);
  if (!match) return null;
  const token = input
    .slice(match.index + match[0].length)
    .match(/^([A-Za-z0-9_-]+)(?=$|[\s，。；！？）】])/u)?.[1];
  if (!token) return null;

  const packet = fromBase64Url(token);
  if (!packet || packet.length < 3) return null;
  const expectedChecksum = packet[packet.length - 1];
  if (checksum8(packet.subarray(0, packet.length - 1)) !== expectedChecksum) {
    return null;
  }

  const header = packet[0];
  const version = header >> 4;
  if (version !== FORMAT_VERSION || (header & 0x0c) !== 0) return null;
  const mode = (header >> 1) & 1;
  const deflated = (header & 1) === 1;
  const body = packet.subarray(1, packet.length - 1);

  let payload: Uint8Array;
  try {
    // 多留一字节检测溢出，即使短码损坏也不会按输入请求分配任意大小的缓冲区。
    payload = deflated
      ? inflateSync(body, {out: new Uint8Array(MAX_DECODED_BYTES + 1)})
      : body;
  } catch {
    return null;
  }
  if (payload.length > MAX_DECODED_BYTES) return null;

  try {
    const reader = new BitReader(payload);
    const result: OperatorBox = {};
    const count = reader.read(9);
    if (count > BOX_SLOT_AVATARS.length) return null;
    let previousIndex = -1;
    for (let i = 0; i < count; i++) {
      const index = mode === 0 ? i : reader.read(9);
      const rank = codeToRank(reader.read(3));
      if (
        index >= BOX_SLOT_AVATARS.length ||
        index <= previousIndex ||
        rank === null
      )
        return null;
      previousIndex = index;
      if (rank === -1) {
        if (mode === 1) return null;
        continue;
      }
      const avatar = BOX_SLOT_AVATARS[index];
      if (
        !avatar ||
        (rank === BOX_RANK_BORROWED && !isBorrowableAvatar(avatar))
      )
        return null;
      result[avatar] = rank;
    }
    reader.finish();
    return result;
  } catch {
    return null;
  }
}

/** 构造可供手机扫码直接打开导入的离线同步链接（/#b=<payload>）。 */
export function boxShareUrl(code: string): string {
  const payload = code.startsWith(BOX_CODE_PREFIX)
    ? code.slice(BOX_CODE_PREFIX.length)
    : code;
  const origin =
    typeof location !== 'undefined' &&
    location.origin &&
    location.origin !== 'null'
      ? location.origin
      : '';
  return `${origin}/#b=${payload}`;
}

/** 按需生成同步链接的矢量二维码 SVG，不拖慢首屏加载。 */
export async function renderBoxQrSvg(url: string): Promise<string> {
  const {default: qrcode} = await import('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const size = count + quiet * 2;
  const cells: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        cells.push(`M${c + quiet},${r + quiet}h1v1h-1z`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Box 跨端同步二维码"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${cells.join('')}" fill="#122220"/></svg>`;
}

/** 将同步链接转为可直接放进 <img> 的 SVG Data URL，高清无锯齿。 */
export async function renderBoxQrDataUrl(url: string): Promise<string> {
  const svg = await renderBoxQrSvg(url);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
