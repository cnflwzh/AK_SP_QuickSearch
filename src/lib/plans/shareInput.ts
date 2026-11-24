/** 首页和流派页共用片段判断，避免首次访问时提前加载分享编解码器。 */
export const isPlanShareHash = (hash: string): boolean =>
  hash.startsWith('#p=') || hash.startsWith('#g=');

/** 生成的攻略文案以分享目标结尾；备注里引用的其他攻略不参与本次导入。 */
export function planShareSource(input: string): string {
  const text = input.trimEnd();
  const tail = text.slice(text.lastIndexOf('\n') + 1);
  return /^(导入链接|分享码)：/.test(tail) ? tail : text;
}
