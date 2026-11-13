/** 页面内的临时选中对象；不进入本局存档，也不改变路由。 */
export type AdvisorSelection = { kind: 'operator'; id: string } | { kind: 'equipment'; id: string };
