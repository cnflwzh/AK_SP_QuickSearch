/**
 * 返回干员名称对应的 PRTS 页面地址。
 * @param name 数据中的干员名称，包括异格或专属干员的完整名称。
 * @returns 编码后的 PRTS 干员页面 URL。
 */
export function operatorWikiUrl(name: string): string {
  return `https://prts.wiki/w/${encodeURIComponent(name)}`;
}
