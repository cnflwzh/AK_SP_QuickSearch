// 这次域名迁移发生在序列Ⅰ结束时。旧域最后写入的流派、错题本及最近查看永久属于该赛季。
const legacyDomainSeason = 's1';

/** 检查真实参与读档的赛季 ID。若发布物属于其他赛季，抛错并在读取旧站存档前停止。 */
export function requireLegacyDomainSeason(season: string): void {
  if (season !== legacyDomainSeason)
    throw new Error(
      `旧域名保留的是 ${legacyDomainSeason} 存档，当前版本为 ${season}。请保留浏览器中的旧站数据，使用旧站最后的 ${legacyDomainSeason} 迁移版本取回。`,
    );
}
