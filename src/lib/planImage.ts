/**
 * 阵容分享图：干员头像、装备、策略、盟约进度和分享链接二维码画到一张 PNG 上。
 * 图片都在同源 assets/ 下，canvas 不会被污染，可以直接导出。
 */
import { OPERATOR, STRATEGY, TIER_LABELS, covenantColor } from '../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from './assets.ts';
import { covenantStats, planCost, type Plan } from './planner.ts';

const BASE_WIDTH = 720, PAD = 24, CELL = 84, NOTE_LINE = 20, ALT = 20;
/** 二维码每个模块至少 2 像素（导出时 ×2 = 4 物理像素），码长时整体放大 */
const QR_MIN = 168, QR_MODULE = 2;
const TIER = ['#7a8b88', '#434343', '#626654', '#445760', '#615B74', '#6C5E41', '#5d341e'];
const FONT = '"Noto Sans SC","Microsoft YaHei",sans-serif';
const INK = '#122220', INK3 = '#7a8b88', LINE = '#cdd8d6', ACCENT = '#b46a07', TEAL = '#0f766c';

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    const finish = (value: HTMLImageElement | null): void => {
      clearTimeout(timer); img.onload = null; img.onerror = null; resolve(value);
    };
    const timer = setTimeout(() => finish(null), 8000);
    img.onload = () => finish(img); img.onerror = () => finish(null);
    img.src = src;
  });
}
function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
/** 按宽度逐字折行（中文没有空格可断） */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > max && line) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

/** link：分享链接（#p=分享码），画成二维码 */
export async function planImage(plan: Plan, link: string): Promise<Blob | null> {
  const stats = covenantStats(plan.ops, plan.layers);
  const cost = planCost(plan.ops);
  const rows = Math.max(1, stats.length);
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
  const QR = Math.max(QR_MIN, qr.getModuleCount() * QR_MODULE + 16);
  const st = STRATEGY[plan.strategy];
  const cache = new Map<string, Promise<HTMLImageElement | null>>();
  const asset = (src: string): Promise<HTMLImageElement | null> => {
    if (!cache.has(src)) cache.set(src, load(src));
    return cache.get(src)!;
  };
  // 所有导出素材同时加载，同一个头像只请求一次。
  const [images, eqImages, altImages, strategyImage] = await Promise.all([
    Promise.all(plan.ops.map(o => asset(avatarSrc(o.name)))),
    Promise.all(plan.ops.map(o => Promise.all(o.eq.map(e => asset(equipIconSrc(e)))))),
    Promise.all(plan.ops.map(o => Promise.all(o.alt.map(a => asset(avatarSrc(a)))))),
    st ? asset(portraitSrc(st.name)) : Promise.resolve(null),
  ]);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cellsOf = (s: typeof stats[number]): number => Math.max(s.count, s.bonusNeed && !s.bonusElite ? s.bonusNeed : 0, s.need);
  const tagOf = (s: typeof stats[number]): string => (s.broken ? '失效' : s.bonusActive ? '强化' : s.active ? '激活' : `差 ${s.next}`)
    + (plan.layers[s.name] ? ` · ${plan.layers[s.name]} 层` : '');
  ctx.font = `12px ${FONT}`;
  const statWidth = Math.max(0, ...stats.map(s => 96 + cellsOf(s) * 26 + 8 + ctx.measureText(tagOf(s)).width));
  // 长二维码和九格盟约进度同时出现时，为文字保留独立宽度。
  const W = Math.max(BASE_WIDTH, Math.ceil(PAD * 2 + statWidth + 20 + QR));
  ctx.font = `13px ${FONT}`;
  const noteLines = plan.note.trim() ? wrap(ctx, plan.note.trim(), W - PAD * 2 - 10) : [];
  const hasAlt = plan.ops.some(o => o.alt.length);
  /** 盟约区（和二维码）的起点：标题 44 + 干员 102（+ 备选 26）+ 策略 40 + 说明 */
  const SECTION = PAD + 26 + 18 + CELL + 18 + (hasAlt ? ALT + 6 : 0) + 40 + (noteLines.length ? noteLines.length * NOTE_LINE + 14 : 0);
  const H = SECTION + Math.max(rows * 26, QR + 44) + 6 + PAD;
  const scale = 2;
  canvas.width = W * scale; canvas.height = H * scale;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#edf1f0'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; round(ctx, 10, 10, W - 20, H - 20, 12); ctx.fill();
  ctx.fillStyle = ACCENT; ctx.fillRect(10, 10, W - 20, 5);

  // 标题
  let y = PAD + 26;
  ctx.fillStyle = INK; ctx.font = `700 24px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(plan.name || '阵容', PAD, y);
  ctx.font = `13px ${FONT}`; ctx.fillStyle = INK3; ctx.textAlign = 'right';
  ctx.fillText(`招募 ${cost.recruit} · 装备 ${cost.equipment} · 调度中心 Lv${cost.maxTier || '—'}`, W - PAD, y);
  ctx.textAlign = 'left';
  y += 18;

  // 干员
  plan.ops.forEach((slot, i) => {
    const x = PAD + i * CELL, tier = OPERATOR[slot.name]?.tier ?? 0;
    ctx.fillStyle = TIER[tier]; round(ctx, x, y, 72, 72, 6); ctx.fill();
    const img = images[i];
    if (img) { ctx.save(); round(ctx, x, y, 72, 72, 6); ctx.clip(); ctx.drawImage(img, x, y, 72, 72); ctx.restore(); }
    if (slot.core) {
      ctx.save();
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; round(ctx, x, y, 72, 72, 6); ctx.stroke();
      ctx.fillStyle = ACCENT; round(ctx, x + 52, y + 52, 18, 18, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('★', x + 61, y + 66); ctx.restore();
    }
    // 等阶：左上角罗马数字（右上角是精锐，左下角是装备）
    ctx.fillStyle = 'rgba(0,0,0,.62)'; round(ctx, x + 2, y + 2, 20, 16, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(TIER_LABELS[tier] ?? '', x + 12, y + 14); ctx.textAlign = 'left';
    if (slot.elite) {
      ctx.fillStyle = ACCENT; round(ctx, x + 44, y + 2, 26, 15, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 10px ${FONT}`; ctx.fillText('精锐', x + 47, y + 13);
    }
    eqImages[i].forEach((e, k) => {
      if (!e) return;
      ctx.fillStyle = '#fff'; round(ctx, x + 2 + k * 22, y + 50, 20, 20, 4); ctx.fill();
      ctx.drawImage(e, x + 3 + k * 22, y + 51, 18, 18);
    });
    ctx.fillStyle = INK; ctx.font = `12px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(slot.name.length > 6 ? slot.name.slice(0, 6) : slot.name, x + 36, y + 88);
    ctx.textAlign = 'left';
    // 备选：名字下方一排小头像
    const ax = x + 36 - (slot.alt.length * (ALT + 2) - 2) / 2;
    slot.alt.forEach((a, k) => {
      const px = ax + k * (ALT + 2), py = y + CELL + 12;
      ctx.fillStyle = TIER[OPERATOR[a]?.tier ?? 0]; round(ctx, px, py, ALT, ALT, 4); ctx.fill();
      const im = altImages[i][k];
      if (im) { ctx.save(); round(ctx, px, py, ALT, ALT, 4); ctx.clip(); ctx.drawImage(im, px, py, ALT, ALT); ctx.restore(); }
    });
  });
  y += CELL + 18;
  if (hasAlt) {
    y += ALT + 6;
    ctx.fillStyle = INK3; ctx.font = `11px ${FONT}`; ctx.textAlign = 'right';
    ctx.fillText('下排小头像：抓不到时的备选', W - PAD, y + 14);
    ctx.textAlign = 'left';
  }

  // 策略
  ctx.font = `13px ${FONT}`;
  if (st) {
    const p = strategyImage;
    if (p) { ctx.save(); round(ctx, PAD, y - 4, 26, 26, 13); ctx.clip(); ctx.drawImage(p, PAD, y - 4, 26, 26); ctx.restore(); }
    ctx.fillStyle = INK; ctx.fillText(`策略 · ${st.name}「${st.skill}」`, PAD + 34, y + 14);
  } else { ctx.fillStyle = INK3; ctx.fillText('策略 · 未选', PAD, y + 14); }
  y += 40;

  // 流派说明：策略下方
  if (noteLines.length) {
    ctx.fillStyle = ACCENT; ctx.fillRect(PAD, y - 6, 3, noteLines.length * NOTE_LINE);
    ctx.fillStyle = INK; ctx.font = `13px ${FONT}`;
    noteLines.forEach((line, k) => ctx.fillText(line, PAD + 10, y + 8 + k * NOTE_LINE));
    y += noteLines.length * NOTE_LINE + 14;
  }

  // 盟约
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(PAD, y - 12); ctx.lineTo(W - PAD, y - 12); ctx.stroke();
  for (const s of stats) {
    const c = covenantColor(s.name, TEAL);
    ctx.globalAlpha = s.active ? 1 : .45;
    ctx.fillStyle = c; ctx.font = `700 14px ${FONT}`; ctx.fillText(s.name, PAD, y + 12);
    const cells = cellsOf(s);
    for (let k = 0; k < cells; k++) {
      const x = PAD + 96 + k * 26;
      ctx.fillStyle = k < s.count ? c : '#e3e9e8';
      round(ctx, x, y + 1, 22, 14, 3); ctx.fill();
      if (k + 1 === s.need || (s.bonusNeed && k + 1 === s.bonusNeed)) { ctx.fillStyle = INK; ctx.fillRect(x + 23, y - 2, 2, 20); }
    }
    ctx.fillStyle = INK3; ctx.font = `12px ${FONT}`;
    const tag = tagOf(s);
    ctx.fillText(tag, PAD + 96 + cells * 26 + 8, y + 12);
    ctx.globalAlpha = 1;
    y += 26;
  }
  if (!stats.length) { ctx.fillStyle = INK3; ctx.fillText('—', PAD, y + 12); y += 26; }

  // 二维码：盟约右侧，扫码即打开分享链接
  const qx = W - PAD - QR, qy = SECTION;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = LINE; round(ctx, qx, qy, QR, QR, 8); ctx.fill(); ctx.stroke();
  const n = qr.getModuleCount(), cell = Math.floor((QR - 16) * scale / n) / scale, off = (QR - cell * n) / 2;
  ctx.fillStyle = INK;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(qx + off + c * cell, qy + off + r * cell, cell, cell);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = `700 13px ${FONT}`; ctx.fillText('扫码导入阵容', qx + QR / 2, qy + QR + 20);
  ctx.fillStyle = ACCENT; ctx.font = `700 11px ${FONT}`; ctx.fillText('卫戍速查 · 阵容规划', qx + QR / 2, qy + QR + 37);
  ctx.textAlign = 'left';

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
