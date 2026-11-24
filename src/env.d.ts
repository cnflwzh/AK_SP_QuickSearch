/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 Measurement ID；由各部署平台在构建时分别配置，留空关闭统计。 */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}
