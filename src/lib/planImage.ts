/**
 * 阵容分享图：干员头像、装备、策略、盟约进度和分享码画到一张 PNG 上。
 * 图片都在同源 assets/ 下，canvas 不会被污染，可以直接导出。
 */
import { OPERATOR, STRATEGY, covenantColor } from '../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from './assets.ts';
import { covenantStats, planCost, type Plan } from './planner.ts';

const W = 720, PAD = 24, CELL = 84;
const TIER = ['#7a8b88', '#434343', '#626654', '#445760', '#615B74', '#6C5E41', '#5d341e'];
const FONT = '"Noto Sans SC","Microsoft YaHei",sans-serif';
const INK = '#122220', INK3 = '#7a8b88', LINE = '#cdd8d6', ACCENT = '#b46a07', TEAL = '#0f766c';

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = () => resolve(null);
    img.src = src;
  });
}
function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

export async function planImage(plan: Plan, code: string): Promise<Blob | null> {
  const stats = covenantStats(plan.ops, 0);
  const cost = planCost(plan.ops);
  const rows = Math.max(1, stats.length);
  const H = PAD + 46 + CELL + 40 + 28 + rows * 26 + 20 + 58 + PAD;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
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
  const images = await Promise.all(plan.ops.map(o => load(avatarSrc(o.name))));
  const eqImages = await Promise.all(plan.ops.map(o => Promise.all(o.eq.map(e => load(equipIconSrc(e))))));
  plan.ops.forEach((slot, i) => {
    const x = PAD + i * CELL, tier = OPERATOR[slot.name]?.tier ?? 0;
    ctx.fillStyle = TIER[tier]; round(ctx, x, y, 72, 72, 6); ctx.fill();
    const img = images[i];
    if (img) { ctx.save(); round(ctx, x, y, 72, 72, 6); ctx.clip(); ctx.drawImage(img, x, y, 72, 72); ctx.restore(); }
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
  });
  y += CELL + 18;

  // 策略
  const st = STRATEGY[plan.strategy];
  ctx.font = `13px ${FONT}`;
  if (st) {
    const p = await load(portraitSrc(st.name));
    if (p) { ctx.save(); round(ctx, PAD, y - 4, 26, 26, 13); ctx.clip(); ctx.drawImage(p, PAD, y - 4, 26, 26); ctx.restore(); }
    ctx.fillStyle = INK; ctx.fillText(`策略 · ${st.name}「${st.skill}」`, PAD + 34, y + 14);
  } else { ctx.fillStyle = INK3; ctx.fillText('策略 · 未选', PAD, y + 14); }
  y += 40;

  // 盟约
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(PAD, y - 12); ctx.lineTo(W - PAD, y - 12); ctx.stroke();
  for (const s of stats) {
    const c = covenantColor(s.name, TEAL);
    ctx.globalAlpha = s.active ? 1 : .45;
    ctx.fillStyle = c; ctx.font = `700 14px ${FONT}`; ctx.fillText(s.name, PAD, y + 12);
    const cells = Math.max(s.count, s.bonusNeed && !s.bonusElite ? s.bonusNeed : 0, s.need);
    for (let k = 0; k < cells; k++) {
      const x = PAD + 96 + k * 26;
      ctx.fillStyle = k < s.count ? c : '#e3e9e8';
      round(ctx, x, y + 1, 22, 14, 3); ctx.fill();
      if (k + 1 === s.need || (s.bonusNeed && k + 1 === s.bonusNeed)) { ctx.fillStyle = INK; ctx.fillRect(x + 23, y - 2, 2, 20); }
    }
    ctx.fillStyle = INK3; ctx.font = `12px ${FONT}`;
    const tag = s.broken ? '失效' : s.bonusActive ? '强化' : s.active ? '激活' : `差 ${s.next}`;
    ctx.fillText(tag, PAD + 96 + cells * 26 + 8, y + 12);
    ctx.globalAlpha = 1;
    y += 26;
  }
  if (!stats.length) { ctx.fillStyle = INK3; ctx.fillText('—', PAD, y + 12); y += 26; }
  y += 20;

  // 分享码
  ctx.fillStyle = '#f4f7f6'; round(ctx, PAD, y - 6, W - PAD * 2, 34, 6); ctx.fill();
  ctx.fillStyle = INK; ctx.font = `12px ui-monospace,Consolas,monospace`;
  ctx.fillText(code.length > 88 ? code.slice(0, 88) + '…' : code, PAD + 10, y + 15);
  ctx.fillStyle = ACCENT; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText('卫戍速查 · 阵容规划 · 在「规划」里导入分享码', W - PAD, y + 48);
  ctx.textAlign = 'left';

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
