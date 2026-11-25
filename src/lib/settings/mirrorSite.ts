/** 只与固定的另一站交换存档。本机预览在同一端口的两个回环地址之间联调。 */
export function mirrorPeer(
  origin: string,
): {origin: string; name: string} | null {
  if (origin === 'https://sp.enjoyacg.com')
    return {origin: 'https://ak.cnflwzh.top', name: '大陆镜像'};
  if (origin === 'https://ak.cnflwzh.top')
    return {origin: 'https://sp.enjoyacg.com', name: '主站'};
  const local = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/.exec(origin);
  if (!local) return null;
  const host = local[2] === 'localhost' ? '127.0.0.1' : 'localhost';
  return {origin: local[1] + host + (local[3] || ''), name: '另一预览站点'};
}

/** 仅在本次从交接链接打开的设置页暂缓首访弹窗，刷新普通设置页恢复原行为。 */
export const mirrorEntryToken =
  typeof window !== 'undefined' &&
  window.top === window &&
  /^\/settings\/?$/.test(location.pathname) &&
  mirrorPeer(location.origin)
    ? /^#mirror-backup=([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/.exec(
        location.hash,
      )?.[1]
    : undefined;

// 路由会清理设置页的查询参数。提前保留发起方向，仅用于断开连接后的引导。
export const mirrorEntryDirection = mirrorEntryToken
  ? new URLSearchParams(location.search).get('mirror-action')
  : null;
