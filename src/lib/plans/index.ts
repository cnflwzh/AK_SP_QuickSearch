/** 兼容既有方案API；显式保留原出口，内部校验与评分细节不自动变成公开API。 */
export * from './core.ts';
export {
  CODE_PREFIX,
  encodePlan,
  decodePlan,
  shareUrl,
  formatPlanShareText,
} from './sharing.ts';
export type {Shared, Decoded} from './sharing.ts';
