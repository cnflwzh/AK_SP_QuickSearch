/// <reference types="vite/client" />
declare const __BUILD_COMMIT__: string;

interface ImportMetaEnv {
  /** GA4 Measurement ID；由各部署平台在构建时分别配置，留空关闭统计。 */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}
