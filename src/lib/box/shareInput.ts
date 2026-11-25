export const SHORT_CODE_MARKER = /(?:^|[^A-Za-z0-9_-])WB/;

/** S1 和带赛季头的码共用 WB / #b= 入口，赛季标识在 Base64URL 包内。损坏码也交给导入提示。 */
export function isBoxShareInput(input: string): boolean {
  return input.includes('#b=') || SHORT_CODE_MARKER.test(input);
}
