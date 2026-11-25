/** Stable public paths shared by Vue Router, static hosts and offline navigation. */
export const PAGE_PATHS = {
  fx: '/overview',
  bd: '/builds',
  cv: '/covenants',
  op: '/operators',
  eq: '/equipment',
  st: '/strategies',
  ld: '/enemies',
  nu: '/tools',
  se: '/settings',
} as const;
export const BOX_PATH = '/box';
export const BUILD_DETAIL_PATH = `${PAGE_PATHS.bd}/:id`;
export const BUILD_EDIT_PATH = `${BUILD_DETAIL_PATH}/edit`;
export const COVENANT_DETAIL_PATH = `${PAGE_PATHS.cv}/:id`;
export const ENEMY_DETAIL_PATH = `${PAGE_PATHS.ld}/:id`;
export const APP_PATHS = [
  '/index',
  ...Object.values(PAGE_PATHS),
  BOX_PATH,
  BUILD_DETAIL_PATH,
  BUILD_EDIT_PATH,
  COVENANT_DETAIL_PATH,
  ENEMY_DETAIL_PATH,
];
