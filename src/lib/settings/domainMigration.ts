/** 只有四站具备接收存档的条件后，才给这一轮线上构建启用迁移。 */
export const migrationEnabled =
  import.meta.env?.VITE_DOMAIN_MIGRATION === 'parallel';

const globalSite = {
  name: '主站',
  old: 'https://sp.enjoyacg.com',
  current: 'https://global.arksp.top',
};
const mainlandSite = {
  name: '大陆镜像',
  old: 'https://ak.cnflwzh.top',
  current: 'https://arksp.top',
};
const sites = [globalSite, mainlandSite];

/** 传入浏览器的完整 origin，精确判断它是不是需要退役的旧站。 */
export const isLegacyOrigin = (origin: string) =>
  sites.some((site) => site.old === origin);

/** 判断传入的完整 origin 是否属于本次迁移的两个新域名。 */
export const isNewOrigin = (origin: string) =>
  sites.some((site) => site.current === origin);

export interface SitePeer {
  /** 唯一允许接收这一轮交接消息的完整源。 */
  origin: string;
  /** 设置页及交接提示中展示的站点名称。 */
  name: string;
}

/** 同地区的新旧站互为迁移目标；预览站与未知来源没有迁移权限。 */
export function migrationPeer(origin: string): SitePeer | null {
  for (const site of sites) {
    if (origin === site.old)
      return {origin: site.current, name: '新' + site.name};
    if (origin === site.current)
      return {origin: site.old, name: '旧' + site.name};
  }
  return null;
}

/** 同代主站与大陆镜像互通。本机预览只与同端口的另一个回环地址互通。 */
export function mirrorPeer(origin: string): SitePeer | null {
  for (const generation of ['old', 'current'] as const) {
    if (origin === globalSite[generation])
      return {origin: mainlandSite[generation], name: mainlandSite.name};
    if (origin === mainlandSite[generation])
      return {origin: globalSite[generation], name: globalSite.name};
  }
  const local = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/.exec(origin);
  if (!local) return null;
  const host = local[2] === 'localhost' ? '127.0.0.1' : 'localhost';
  return {origin: local[1] + host + (local[3] || ''), name: '另一预览站点'};
}
