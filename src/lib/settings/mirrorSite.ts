import {
  isNewOrigin,
  migrationEnabled,
  migrationPeer,
  mirrorPeer as pairedMirror,
  type SitePeer,
} from './domainMigration.ts';

export type MirrorDirection = 'send' | 'fetch';
export type MirrorPeer = SitePeer;
interface MirrorEntry {
  token: string;
  direction: MirrorDirection | null;
  peer: MirrorPeer;
}

const tokenPattern =
  /^#mirror-backup=([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/;

/** 返回本站同代的主站或镜像；预览站沿用同端口回环地址。 */
export function mirrorPeer(
  origin: string,
  enabled = migrationEnabled,
): MirrorPeer | null {
  return !enabled && isNewOrigin(origin) ? null : pairedMirror(origin);
}

/** 生成固定对站的交接地址。非法来源、目标或会话令牌均不能发起交接。 */
export function mirrorTransferUrl(
  origin: string,
  target: string,
  direction: MirrorDirection,
  token: string,
  enabled = migrationEnabled,
): string | null {
  const sameGeneration = mirrorPeer(origin, enabled)?.origin === target;
  if (!sameGeneration && (!enabled || migrationPeer(origin)?.origin !== target))
    return null;
  const hash = '#mirror-backup=' + token;
  if (!tokenPattern.test(hash)) return null;
  const url = new URL('/settings', target);
  url.searchParams.set('mirror-action', direction);
  // 旧主镜像与回环预览沿用先前版本的 URL。新域和退役页都需要显式来源。
  if (!sameGeneration || isNewOrigin(origin))
    url.searchParams.set('mirror-from', origin);
  url.hash = hash;
  return url.href;
}

/**
 * 从首次进入设置页的 URL 确定唯一的对站和动作。来源参数只能选择本地区迁移对站或
 * 同代镜像；只有旧版交接可省略来源和方向。Referrer、窗口名称均不参与判断。
 */
export function parseMirrorEntry(
  location: Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>,
  enabled = migrationEnabled,
): MirrorEntry | null {
  if (!/^\/settings\/?$/.test(location.pathname)) return null;
  const token = tokenPattern.exec(location.hash)?.[1];
  if (!token) return null;
  const query = new URLSearchParams(location.search);
  const sources = query.getAll('mirror-from');
  const actions = query.getAll('mirror-action');
  if (sources.length > 1 || actions.length > 1) return null;
  const direction = actions[0] ?? null;
  if (direction !== null && direction !== 'send' && direction !== 'fetch')
    return null;
  const mirror = mirrorPeer(location.origin, enabled);
  if (!sources.length) {
    if (isNewOrigin(location.origin) || !mirror) return null;
    return {token, direction, peer: mirror};
  }
  if (!direction) return null;
  const migration = enabled ? migrationPeer(location.origin) : null;
  const peer = [mirror, migration].find((item) => item?.origin === sources[0]);
  return peer ? {token, direction, peer} : null;
}

// 路由规范化会先清除 query；独立 PWA 也可能没有 opener，须在此保留原始来源。
export const mirrorEntry =
  typeof window !== 'undefined' && window.top === window
    ? parseMirrorEntry(location)
    : null;
export const mirrorEntryToken = mirrorEntry?.token;

const reloadNoticeKey = 'wsq.migration-reload-notice';

/** 工具页需要重读自己的状态。把本次成功结果留给刷新后的设置页，消费一次即移除。 */
export function saveMirrorReloadNotice(note: string): void {
  try {
    sessionStorage.setItem(reloadNoticeKey, note);
  } catch {
    // 存档已写入，浏览器禁用会话存储时仅省略刷新后的提示。
  }
}

export const mirrorReloadNotice = (() => {
  if (
    typeof window === 'undefined' ||
    window.top !== window ||
    !/^\/settings\/?$/.test(location.pathname)
  )
    return '';
  try {
    const note = sessionStorage.getItem(reloadNoticeKey);
    sessionStorage.removeItem(reloadNoticeKey);
    return note ?? '';
  } catch {
    return '';
  }
})();
