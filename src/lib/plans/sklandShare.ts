import {applyDelta, createDelta, getDeltaTargetSize} from 'fossil-delta';
import {readBackupPlans} from './backup.ts';
import type {Plan} from './model.ts';
import {
  MAX_EXTENDED_PAYLOAD,
  packSharePayload,
  unpackSharePayload,
} from './shareCodec.ts';
import {canShareViaQr, encodePlan, shareUrl, type Shared} from './sharing.ts';
import {
  guidePlanFields,
  sklandUrl,
  type SklandGuide,
} from './skland.ts';

export {readGuideReference, type GuideReference} from './guideReference.ts';

/** v1 基准只含可编辑字段。固定排列和空值约定使本地存档、Vue 代理和新拉取的原文生成相同字节。 */
function shareFields(plan: Shared): Shared {
  function lineup(section: Pick<Shared, 'ops' | 'note' | 'layers'>) {
    return {
      ops: section.ops.map(({name, elite, core, eq, alt}) => ({
        name,
        elite,
        core,
        eq,
        alt,
      })),
      note: section.note,
      layers: Object.fromEntries(
        Object.keys(section.layers)
          .sort()
          .map((k) => [k, section.layers[k]]),
      ),
    };
  }
  return {
    name: plan.name,
    ...(plan.icon && {icon: {kind: plan.icon.kind, name: plan.icon.name}}),
    strategy: plan.strategy,
    strategyAlternates: plan.strategyAlternates ?? [],
    ...lineup(plan),
    stages: (plan.stages ?? []).map((s) => ({
      from: s.from,
      to: s.to,
      ...lineup(s),
    })),
  };
}

const encoder = new TextEncoder();
const toBytes = (plan: Shared) =>
  encoder.encode(JSON.stringify(shareFields(plan)));

// 同时核对原文映射和差异载荷，避免原文更新或复制截断后误导入。
function fingerprint(id: string, base: Uint8Array, delta: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const bytes of [encoder.encode(id), base, delta])
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
  return hash >>> 0;
}

function encodeGuidePatch(
  id: string,
  original: string,
  edited: string,
): string {
  const base = encoder.encode(original);
  const delta = createDelta(base, encoder.encode(edited));
  const payload = new Uint8Array(4 + delta.length);
  new DataView(payload.buffer).setUint32(0, fingerprint(id, base, delta));
  payload.set(delta, 4);
  return packSharePayload(payload, 0, false, true);
}

/** 从新读取的同一篇攻略还原修改。版本不匹配、损坏或结果超限时抛错，调用方不能退回原文冒充分享结果。 */
export function applyGuidePatch(guide: SklandGuide, patch: string): Shared {
  try {
    const {payload, mode, extended, hasCore, hasIcon} =
      unpackSharePayload(patch);
    if (!extended || mode !== 0 || hasCore || hasIcon || payload.length <= 4)
      throw new Error('Invalid guide patch');
    const base = toBytes(guidePlanFields(guide));
    const delta = payload.subarray(4);
    if (
      new DataView(payload.buffer, payload.byteOffset).getUint32(0) !==
      fingerprint(guide.id, base, delta)
    )
      throw new Error('Guide checksum mismatch');
    if (getDeltaTargetSize(delta) > MAX_EXTENDED_PAYLOAD)
      throw new Error('Plan too large');
    const restored = new TextDecoder('utf-8', {fatal: true}).decode(
      applyDelta(base, delta),
    );
    // 按备份导入同样的领域约束校验，再筛出可编辑字段。本地 ID 和来源由接收方赋值。
    const [plan] = readBackupPlans([
      {
        ...JSON.parse(restored),
        id: 'share',
        updated: 0,
        skland: undefined,
        base: undefined,
      },
    ]);
    const fields = shareFields(plan);
    if (JSON.stringify(fields) !== restored)
      throw new Error('Invalid guide fields');
    return fields;
  } catch (cause) {
    throw new Error(
      '森空岛原文已变化或分享链接不完整，无法还原修改。请向分享者索取完整分享码或 JSON 文件。',
      {cause},
    );
  }
}

/** 主链接用于复制和攻略文案，二维码使用可直接导入的本站入口；完整分享码始终可独立还原。 */
export function planShareLinks(plan: Plan, origin: string) {
  let code = '';
  try {
    code = encodePlan(plan);
  } catch {
    /* 过大的完整方案仍可尝试用森空岛来源分享。 */
  }
  const full = code ? shareUrl(code, origin) : '';
  const guide = plan.skland;
  if (guide) {
    const compact = origin + '/#g=' + guide.id;
    const original = JSON.stringify(shareFields(guidePlanFields(guide)));
    const edited = JSON.stringify(shareFields(plan));
    if (original === edited)
      return {
        kind: 'original',
        link: sklandUrl(guide.id),
        qrLink: compact,
        code,
      } as const;
    try {
      const link = compact + '.' + encodeGuidePatch(guide.id, original, edited);
      // 二维码装得下时优先保留来源，接收方仍能查看原文、拉取更新和继续增量转发。
      if (canShareViaQr(link) || !full || link.length <= full.length)
        return {kind: 'delta', link, qrLink: link, code} as const;
    } catch {
      /* 差异编码超限时，沿用完整分享。 */
    }
  }
  return {kind: 'full', link: full, qrLink: full, code} as const;
}
