/**
 * 阵容分享图：干员头像、装备、策略、盟约进度和分享链接二维码画到一张 PNG 上。
 * 图片都在同源 assets/ 下，canvas 不会被污染，可以直接导出。
 */
import {
  OPERATOR,
  STRATEGY,
  TIER_LABELS,
  covenantColor,
} from '../../../data/index.ts';
import {
  avatarSrc,
  covenantIconSrc,
  equipIconSrc,
  planIconSrc,
  portraitSrc,
} from '../ui/assets.ts';
import {covenantStats} from './covenants.ts';
import {planCost} from './costs.ts';
import {effectivePlanIcon, type Plan} from './model.ts';
import {canShareViaQr, stageRoundLabel} from './sharing.ts';

const BASE_WIDTH = 720,
  PAD = 24,
  CELL = 84,
  NOTE_LINE = 20,
  META_LINE = 17,
  ALT = 20;
/** 二维码每个模块至少 2 像素（导出时 ×2 = 4 物理像素），码长时整体放大 */
const QR_MIN = 168,
  QR_MODULE = 2;
const TIER = [
  '#7a8b88',
  '#434343',
  '#626654',
  '#445760',
  '#615B74',
  '#6C5E41',
  '#5d341e',
];
const FONT = '"Noto Sans SC","Microsoft YaHei",sans-serif';
const INK = '#122220',
  INK2 = '#445754',
  INK3 = '#7a8b88',
  LINE = '#cdd8d6',
  ACCENT = '#b46a07',
  TEAL = '#0f766c';

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    const finish = (value: HTMLImageElement | null): void => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 8000);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}
function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
/** 先分段再按宽度逐字折行，保留每行打法要点 */
function wrapParagraphs(
  ctx: CanvasRenderingContext2D,
  paragraphs: readonly string[],
  max: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    let line = '';
    for (const ch of trimmed) {
      if (ctx.measureText(line + ch).width > max && line) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
/** 完整显示干员名字：超宽时优先缩字号，仅极端长名再省略号截断 */
function drawSlotName(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  y: number,
  maxWidth: number,
): void {
  ctx.font = `12px ${FONT}`;
  if (ctx.measureText(name).width <= maxWidth) {
    ctx.fillText(name, cx, y);
    return;
  }
  ctx.font = `10.5px ${FONT}`;
  if (ctx.measureText(name).width <= maxWidth) {
    ctx.fillText(name, cx, y);
    return;
  }
  let text = name;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  ctx.fillText(`${text}…`, cx, y);
}

/** 绘制终盘和分段概览。可容纳的链接嵌入二维码，超长链接使用配套文件提示。 */
export async function planImage(
  plan: Plan,
  link: string,
): Promise<Blob | null> {
  const stats = covenantStats(plan.ops, plan.layers);
  const cost = planCost(plan.ops);
  const rows = Math.max(1, stats.length);
  const qr = canShareViaQr(link)
    ? (await import('qrcode-generator')).default(0, 'M')
    : null;
  if (qr) {
    qr.addData(link, 'Byte');
    qr.make();
  }
  const QR = qr ? Math.max(QR_MIN, (qr.getModuleCount() + 8) * QR_MODULE) : 0;
  const fullText = qr ? '扫码查看完整方案' : '完整方案见配套分享码或 JSON 文件';
  const st = STRATEGY[plan.strategy];
  const cache = new Map<string, Promise<HTMLImageElement | null>>();
  const asset = (src: string): Promise<HTMLImageElement | null> => {
    if (!cache.has(src)) cache.set(src, load(src));
    return cache.get(src)!;
  };
  // 所有导出素材同时加载，同一个头像只请求一次。
  const icon = effectivePlanIcon(plan);
  const [images, eqImages, altImages, covImages, strategyImage, emblem] =
    await Promise.all([
      Promise.all(plan.ops.map((o) => asset(avatarSrc(o.name)))),
      Promise.all(
        plan.ops.map((o) =>
          Promise.all(o.eq.map((e) => asset(equipIconSrc(e)))),
        ),
      ),
      Promise.all(
        plan.ops.map((o) => Promise.all(o.alt.map((a) => asset(avatarSrc(a))))),
      ),
      Promise.all(stats.map((s) => asset(covenantIconSrc(s.name)))),
      st ? asset(portraitSrc(st.name)) : Promise.resolve(null),
      icon ? asset(planIconSrc(icon)) : Promise.resolve(null),
    ]);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cellsOf = (s: (typeof stats)[number]): number =>
    Math.max(s.count, s.bonusNeed && !s.bonusElite ? s.bonusNeed : 0, s.need);
  const tagOf = (s: (typeof stats)[number]): string =>
    (s.broken
      ? '失效'
      : s.bonusActive
        ? '强化'
        : s.active
          ? '激活'
          : `差 ${s.next}`) +
    (plan.layers[s.name] ? ` · ${plan.layers[s.name]} 层` : '');
  ctx.font = `12px ${FONT}`;
  const statWidth = Math.max(
    0,
    ...stats.map(
      (s) => 96 + cellsOf(s) * 26 + 8 + ctx.measureText(tagOf(s)).width,
    ),
  );
  // 长二维码和九格盟约进度同时出现时，为文字保留独立宽度。
  const W = Math.max(
    BASE_WIDTH,
    Math.ceil(PAD * 2 + statWidth + (qr ? 20 + QR : 0)),
  );
  const textWidth = W - PAD * 2 - 8;

  const altEntries = plan.ops.flatMap((slot) =>
    slot.alt.map((a) => {
      const tier = OPERATOR[a]?.tier ?? 0;
      return `${a}(${TIER_LABELS[tier] ?? tier})→${slot.name}`;
    }),
  );
  ctx.font = `12px ${FONT}`;
  const altLines = altEntries.length
    ? wrapParagraphs(ctx, [`过渡/备选：${altEntries.join(' · ')}`], textWidth)
    : [];

  const eqEntries = plan.ops
    .filter((slot) => slot.eq.length > 0)
    .map((slot) => `${slot.name} → ${slot.eq.join('、')}`);
  const eqLines = eqEntries.length
    ? wrapParagraphs(ctx, [`配装：${eqEntries.join('  |  ')}`], textWidth)
    : [];

  const rawNoteLines = plan.note
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const numberedNotes =
    rawNoteLines.length > 1
      ? rawNoteLines.map((l, idx) => `${idx + 1}. ${l}`)
      : rawNoteLines;
  ctx.font = `13px ${FONT}`;
  let noteLines = numberedNotes.length
    ? wrapParagraphs(ctx, numberedNotes, W - PAD * 2 - 14)
    : [];

  if (noteLines.length > 6)
    noteLines = [...noteLines.slice(0, 5), `说明节选 · ${fullText}`];

  ctx.font = `12px ${FONT}`;
  const stages = plan.stages ?? [];
  const stageLines: string[] = [];
  if (stages.length) {
    stageLines.push(`阶段概览 · ${fullText}`);
    for (const stage of stages.slice(0, 5)) {
      const label = stageRoundLabel(stage.from, stage.to);
      const members = stage.ops
        .map((op) => (op.core ? '★' : '') + op.name)
        .join('、');
      stageLines.push(
        ...wrapParagraphs(
          ctx,
          [`${label}　${members || '未选干员'}`],
          textWidth,
        ),
      );
      if (stage.note.trim()) {
        const preview = wrapParagraphs(
          ctx,
          stage.note.split('\n'),
          textWidth - 42,
        );
        stageLines.push(`打法：${preview[0]}${preview.length > 1 ? '…' : ''}`);
      }
    }
    if (stages.length > 5) stageLines.push(`另有 ${stages.length - 5} 个阶段`);
  }
  const strategyLines = plan.strategyAlternates?.length
    ? wrapParagraphs(
        ctx,
        [`备选策略：${plan.strategyAlternates.join('、')}`],
        textWidth,
      )
    : [];

  const hasAlt = plan.ops.some((o) => o.alt.length);
  const columns = Math.floor((W - PAD * 2) / CELL);
  const rowHeight = CELL + 18 + (hasAlt ? ALT + 14 : 0);
  const rosterHeight = Math.ceil(plan.ops.length / columns) * rowHeight;
  const SECTION =
    PAD +
    26 +
    18 +
    rosterHeight +
    (stageLines.length ? stageLines.length * META_LINE + 10 : 0) +
    strategyLines.length * META_LINE +
    (altLines.length ? altLines.length * META_LINE + 8 : 0) +
    34 +
    (eqLines.length ? eqLines.length * META_LINE + 10 : 0) +
    (noteLines.length ? noteLines.length * NOTE_LINE + 16 : 0) +
    8;
  const H =
    SECTION + Math.max(rows * 26, qr ? QR + 44 : 0) + (qr ? 8 : 28) + PAD;
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#edf1f0';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  round(ctx, 10, 10, W - 20, H - 20, 12);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.fillRect(10, 10, W - 20, 5);

  // 标题
  let y = PAD + 26;
  if (emblem) {
    ctx.save();
    round(ctx, PAD, y - 23, 28, 28, 5);
    ctx.clip();
    ctx.fillStyle = '#243238';
    ctx.fill();
    const size = icon?.kind === 'covenant' ? 22 : 28;
    const scale = Math.min(
      size / emblem.naturalWidth,
      size / emblem.naturalHeight,
    );
    const w = emblem.naturalWidth * scale,
      h = emblem.naturalHeight * scale;
    ctx.drawImage(emblem, PAD + (28 - w) / 2, y - 23 + (28 - h) / 2, w, h);
    ctx.restore();
  }
  ctx.fillStyle = INK;
  ctx.font = `700 24px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(plan.name || '阵容', PAD + (emblem ? 35 : 0), y);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = INK3;
  ctx.textAlign = 'right';
  ctx.fillText(
    `终盘 ${plan.ops.length} 人 · 招募 ${cost.recruit} · 装备 ${cost.equipment}`,
    W - PAD,
    y,
  );
  ctx.textAlign = 'left';
  y += 18;

  // 干员
  const rosterY = y;
  plan.ops.forEach((slot, i) => {
    const y = rosterY + Math.floor(i / columns) * rowHeight;
    const x = PAD + (i % columns) * CELL,
      tier = OPERATOR[slot.name]?.tier ?? 0;
    ctx.fillStyle = TIER[tier];
    round(ctx, x, y, 72, 72, 6);
    ctx.fill();
    const img = images[i];
    if (img) {
      ctx.save();
      round(ctx, x, y, 72, 72, 6);
      ctx.clip();
      ctx.drawImage(img, x, y, 72, 72);
      ctx.restore();
    }
    if (slot.core) {
      ctx.save();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      round(ctx, x, y, 72, 72, 6);
      ctx.stroke();
      ctx.fillStyle = ACCENT;
      round(ctx, x + 52, y + 52, 18, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('★', x + 61, y + 66);
      ctx.restore();
    }
    // 等阶：左上角罗马数字（右上角是精锐，左下角是装备）
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    round(ctx, x + 2, y + 2, 20, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(TIER_LABELS[tier] ?? '', x + 12, y + 14);
    ctx.textAlign = 'left';
    if (slot.elite) {
      ctx.fillStyle = ACCENT;
      round(ctx, x + 44, y + 2, 26, 15, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `700 10px ${FONT}`;
      ctx.fillText('精锐', x + 47, y + 13);
    }
    eqImages[i].forEach((e, k) => {
      if (!e) return;
      ctx.fillStyle = '#fff';
      round(ctx, x + 2 + k * 22, y + 50, 20, 20, 4);
      ctx.fill();
      ctx.drawImage(e, x + 3 + k * 22, y + 51, 18, 18);
    });
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    drawSlotName(ctx, slot.name, x + 36, y + 88, CELL - 6);
    ctx.textAlign = 'left';
    // 备选：名字下方一排小头像
    const ax = x + 36 - (slot.alt.length * (ALT + 2) - 2) / 2;
    slot.alt.forEach((a, k) => {
      const px = ax + k * (ALT + 2),
        py = y + CELL + 12;
      ctx.fillStyle = TIER[OPERATOR[a]?.tier ?? 0];
      round(ctx, px, py, ALT, ALT, 4);
      ctx.fill();
      const im = altImages[i][k];
      if (im) {
        ctx.save();
        round(ctx, px, py, ALT, ALT, 4);
        ctx.clip();
        ctx.drawImage(im, px, py, ALT, ALT);
        ctx.restore();
      }
    });
  });
  y += rosterHeight;

  // 过渡/备选说明行
  if (altLines.length) {
    ctx.fillStyle = INK2;
    ctx.font = `12px ${FONT}`;
    altLines.forEach((line, k) =>
      ctx.fillText(line, PAD, y + 12 + k * META_LINE),
    );
    y += altLines.length * META_LINE + 8;
  }

  // 策略
  ctx.font = `13px ${FONT}`;
  if (st) {
    const p = strategyImage;
    if (p) {
      ctx.save();
      round(ctx, PAD, y, 26, 26, 13);
      ctx.clip();
      ctx.drawImage(p, PAD, y, 26, 26);
      ctx.restore();
    }
    ctx.fillStyle = INK;
    ctx.fillText(`策略 · ${st.name}「${st.skill}」`, PAD + 34, y + 18);
  } else {
    ctx.fillStyle = INK3;
    ctx.fillText('策略 · 未选', PAD, y + 18);
  }
  y += 34;
  ctx.fillStyle = INK2;
  ctx.font = `12px ${FONT}`;
  for (const line of strategyLines) {
    ctx.fillText(line, PAD, y + 12);
    y += META_LINE;
  }

  // 配装说明行
  if (eqLines.length) {
    ctx.fillStyle = INK2;
    ctx.font = `12px ${FONT}`;
    eqLines.forEach((line, k) =>
      ctx.fillText(line, PAD, y + 12 + k * META_LINE),
    );
    y += eqLines.length * META_LINE + 10;
  }

  // 流派说明：策略/配装下方
  if (noteLines.length) {
    ctx.fillStyle = ACCENT;
    ctx.fillRect(PAD, y, 3, noteLines.length * NOTE_LINE + 2);
    ctx.fillStyle = INK;
    ctx.font = `13px ${FONT}`;
    noteLines.forEach((line, k) =>
      ctx.fillText(line, PAD + 10, y + 14 + k * NOTE_LINE),
    );
    y += noteLines.length * NOTE_LINE + 16;
  }
  if (stageLines.length) {
    ctx.fillStyle = INK2;
    ctx.font = `12px ${FONT}`;
    for (const line of stageLines) {
      ctx.fillText(line, PAD, y + 12);
      y += META_LINE;
    }
    y += 10;
  }
  y += 8;

  // 盟约
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(PAD, y - 12);
  ctx.lineTo(W - PAD, y - 12);
  ctx.stroke();
  stats.forEach((s, i) => {
    const c = covenantColor(s.name, TEAL);
    const covIcon = covImages[i];
    ctx.globalAlpha = s.active ? 1 : 0.45;
    if (covIcon) {
      ctx.fillStyle = c;
      round(ctx, PAD, y - 2, 18, 18, 4);
      ctx.fill();
      ctx.drawImage(covIcon, PAD + 2, y, 14, 14);
    }
    ctx.fillStyle = c;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(s.name, covIcon ? PAD + 23 : PAD, y + 12);
    const cells = cellsOf(s);
    for (let k = 0; k < cells; k++) {
      const x = PAD + 96 + k * 26;
      ctx.fillStyle = k < s.count ? c : '#e3e9e8';
      round(ctx, x, y + 1, 22, 14, 3);
      ctx.fill();
      if (k + 1 === s.need || (s.bonusNeed && k + 1 === s.bonusNeed)) {
        ctx.fillStyle = INK;
        ctx.fillRect(x + 23, y - 2, 2, 20);
      }
    }
    ctx.fillStyle = INK3;
    ctx.font = `12px ${FONT}`;
    const tag = tagOf(s);
    ctx.fillText(tag, PAD + 96 + cells * 26 + 8, y + 12);
    ctx.globalAlpha = 1;
    y += 26;
  });
  if (!stats.length) {
    ctx.fillStyle = INK3;
    ctx.fillText('—', PAD, y + 12);
  }

  // 二维码：盟约右侧，扫码即打开分享链接
  if (qr) {
    const qx = W - PAD - QR,
      qy = SECTION;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = LINE;
    round(ctx, qx, qy, QR, QR, 8);
    ctx.fill();
    ctx.stroke();
    const n = qr.getModuleCount(),
      cell = Math.floor((QR * scale) / (n + 8)) / scale,
      off = (QR - cell * n) / 2;
    ctx.fillStyle = INK;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.isDark(r, c))
          ctx.fillRect(qx + off + c * cell, qy + off + r * cell, cell, cell);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('扫码导入阵容', qx + QR / 2, qy + QR + 20);
    ctx.fillStyle = ACCENT;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText('卫戍速查 · 阵容规划', qx + QR / 2, qy + QR + 37);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = INK2;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(fullText, PAD, H - PAD);
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
