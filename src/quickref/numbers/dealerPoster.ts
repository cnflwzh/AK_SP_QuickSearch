import type {
  DealerGrade,
  DealerPosterModel,
  VerdictTone,
} from '../../lib/dealerGame.ts';

const POSTER_W = 760;
const POSTER_H = 520;
const POSTER_DPR = 2;

const FONT_EMOJI =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const FONT_SANS = `"Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif, ${FONT_EMOJI}`;
const FONT_NUM = `"Saira Condensed", "Noto Sans SC", system-ui, sans-serif`;

const INK = '#122220';
const INK2 = '#465a57';
const INK3 = '#7a8b88';
const LINE = '#cdd8d6';
const ACCENT = '#b46a07';
const TEAL = '#0f766c';
const RED = '#c13d36';

const METRIC_TONE_COLOR = {
  accent: ACCENT,
  good: TEAL,
  warn: RED,
  teal: TEAL,
} as const;

const GRADE_STYLE: Readonly<
  Record<DealerGrade, {bg: string; border: string; fg: string}>
> = {
  SSS: {bg: '#fdf4e3', border: '#b46a07', fg: '#b46a07'},
  S: {bg: '#e8f5f3', border: '#0f766c', fg: '#0f766c'},
  A: {bg: '#ebf7ef', border: '#2d8a4b', fg: '#2d8a4b'},
  B: {bg: '#eef3f2', border: '#7a8b88', fg: '#465a57'},
};

const VERDICT_STYLE: Readonly<
  Record<
    VerdictTone,
    {
      bg: string;
      border: string;
      headerBg: string;
      headerFg: string;
      circleStroke: string;
      titleFg: string;
      detailFg: string;
      dashed?: boolean;
    }
  >
> = {
  good: {
    bg: '#eaf6f4',
    border: '#8ecbc3',
    headerBg: 'rgba(255, 255, 255, 0.72)',
    headerFg: '#0f766c',
    circleStroke: '#8ecbc3',
    titleFg: '#0f766c',
    detailFg: '#3e6d68',
  },
  ult: {
    bg: '#fdf5e6',
    border: '#e2b76b',
    headerBg: 'rgba(255, 255, 255, 0.72)',
    headerFg: '#b46a07',
    circleStroke: '#e2b76b',
    titleFg: '#b46a07',
    detailFg: '#7d5a21',
  },
  warn: {
    bg: '#fceded',
    border: '#e5a49f',
    headerBg: 'rgba(255, 255, 255, 0.72)',
    headerFg: '#c13d36',
    circleStroke: '#e5a49f',
    titleFg: '#c13d36',
    detailFg: '#884641',
  },
  muted: {
    bg: '#eef3f5',
    border: '#b6c8ce',
    headerBg: 'rgba(255, 255, 255, 0.72)',
    headerFg: '#3a5259',
    circleStroke: '#b6c8ce',
    titleFg: '#3a5259',
    detailFg: '#5b7279',
  },
  empty: {
    bg: '#f7f9f9',
    border: '#c5d2d0',
    headerBg: 'rgba(255, 255, 255, 0.75)',
    headerFg: '#7a8b88',
    circleStroke: '#d2dddd',
    titleFg: '#7a8b88',
    detailFg: '#8fa09d',
    dashed: true,
  },
};

function roundRect(
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

function fillRoundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
  lineWidth = 1,
): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) {
    end--;
  }
  return `${text.slice(0, end)}…`;
}

function wrapTwoLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  let split = text.length;
  while (split > 1 && ctx.measureText(text.slice(0, split)).width > maxWidth) {
    split--;
  }
  const first = text.slice(0, split);
  const rest = fitText(ctx, text.slice(split), maxWidth);
  return rest ? [first, rest] : [first];
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    h: number;
    text: string;
    bg: string;
    border: string;
    fg: string;
    font: string;
    padX?: number;
    fixedWidth?: number;
    alignRightFrom?: number;
  },
): number {
  const {
    x,
    y,
    h,
    text,
    bg,
    border,
    fg,
    font,
    padX = 9,
    fixedWidth,
    alignRightFrom,
  } = options;
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const w = fixedWidth ?? Math.ceil(textW + padX * 2);
  const drawX = alignRightFrom !== undefined ? alignRightFrom - w : x;
  fillRoundedBox(ctx, drawX, y, w, h, 5, bg, border, 1);
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const label = fixedWidth ? fitText(ctx, text, w - padX) : text;
  ctx.fillText(label, drawX + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = 'left';
  return w;
}

function drawPaperCardFrame(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#edf1f0';
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  fillRoundedBox(ctx, 10, 10, POSTER_W - 20, POSTER_H - 20, 14, '#ffffff');
  ctx.save();
  roundRect(ctx, 10, 10, POSTER_W - 20, POSTER_H - 20, 14);
  ctx.clip();
  ctx.fillStyle = ACCENT;
  ctx.fillRect(10, 10, POSTER_W - 20, 4);
  ctx.restore();

  roundRect(ctx, 10, 10, POSTER_W - 20, POSTER_H - 20, 14);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHeroAndDealerPanel(
  ctx: CanvasRenderingContext2D,
  model: DealerPosterModel,
): void {
  const px = 26;
  const py = 24;
  const pw = POSTER_W - 52;
  const ph = 162;
  fillRoundedBox(ctx, px, py, pw, ph, 10, '#f5f8f7', '#d5e0de', 1);

  const innerLeft = px + 16;
  const stampW = 96;
  const stampH = 68;
  const stampX = px + pw - stampW - 16;
  const stampY = py + 12;

  // 左上方眉题胶囊行
  const badgeW = drawPill(ctx, {
    x: innerLeft,
    y: py + 12,
    h: 22,
    text: model.badgeText,
    bg: '#e8f5f3',
    border: '#8ecbc3',
    fg: TEAL,
    font: `600 11px ${FONT_SANS}`,
    padX: 9,
  });

  const modeW = drawPill(ctx, {
    x: innerLeft + badgeW + 7,
    y: py + 12,
    h: 22,
    text: model.modeLabel,
    bg: '#fdf4e3',
    border: '#e5c17e',
    fg: ACCENT,
    font: `700 11px ${FONT_SANS}`,
    padX: 9,
  });

  drawPill(ctx, {
    x: innerLeft + badgeW + 7 + modeW + 7,
    y: py + 12,
    h: 22,
    text: model.spoilerNotice,
    bg: '#ebf7ef',
    border: '#9bd2ad',
    fg: '#1f7040',
    font: `600 11px ${FONT_SANS}`,
    padX: 9,
  });

  // 主称号与副标题
  const maxTitleW = stampX - 16 - innerLeft;
  ctx.font = `700 24px ${FONT_SANS}`;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fitText(ctx, model.rank.title, maxTitleW), innerLeft, py + 62);

  ctx.font = `400 13.5px ${FONT_SANS}`;
  ctx.fillStyle = INK2;
  ctx.fillText(fitText(ctx, model.rank.subtitle, maxTitleW), innerLeft, py + 84);

  // 右上角质检评级印章
  const gs = GRADE_STYLE[model.grade];
  fillRoundedBox(ctx, stampX, stampY, stampW, stampH, 9, gs.bg, gs.border, 1.4);
  ctx.save();
  ctx.globalAlpha = 0.3;
  roundRect(ctx, stampX + 4, stampY + 4, stampW - 8, stampH - 8, 6);
  ctx.strokeStyle = gs.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = `600 10px ${FONT_SANS}`;
  ctx.fillStyle = INK2;
  ctx.fillText('质检评级', stampX + stampW / 2, stampY + 18);

  ctx.font = `700 31px ${FONT_NUM}`;
  ctx.fillStyle = gs.fg;
  ctx.fillText(model.grade, stampX + stampW / 2, stampY + 54);
  ctx.textAlign = 'left';

  // 面板内部分隔线
  ctx.strokeStyle = '#dde6e4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerLeft, py + 95);
  ctx.lineTo(px + pw - 16, py + 95);
  ctx.stroke();

  // 下半部：发牌员表情 + 护甲血条 + 台词气泡
  const lowerY = py + 104;
  fillRoundedBox(ctx, innerLeft, lowerY, 48, 48, 9, '#ffffff', LINE, 1);
  ctx.font = `26px ${FONT_EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(model.rank.moodEmoji, innerLeft + 24, lowerY + 25);
  ctx.textAlign = 'left';

  const barX = innerLeft + 60;
  const barW = 200;
  ctx.font = `600 12px ${FONT_SANS}`;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`发牌员护甲 ${model.dealerArmorPct}%`, barX, lowerY + 17);

  drawPill(ctx, {
    x: 0,
    y: lowerY + 2,
    h: 19,
    text: model.rank.dealerDamage,
    bg: '#fceded',
    border: '#e5a49f',
    fg: RED,
    font: `600 10px ${FONT_SANS}`,
    padX: 6,
    alignRightFrom: barX + barW,
  });

  const trackY = lowerY + 30;
  fillRoundedBox(ctx, barX, trackY, barW, 11, 5.5, '#dce5e3');
  if (model.dealerArmorPct > 0) {
    const fillW = Math.max(10, Math.round((barW * model.dealerArmorPct) / 100));
    const barColor =
      model.dealerArmorPct <= 30
        ? RED
        : model.dealerArmorPct <= 70
          ? ACCENT
          : TEAL;
    fillRoundedBox(ctx, barX, trackY, fillW, 11, 5.5, barColor);
  }

  const bubbleX = barX + barW + 14;
  const bubbleW = px + pw - 16 - bubbleX;
  const bubbleH = 48;
  fillRoundedBox(ctx, bubbleX, lowerY, bubbleW, bubbleH, 8, '#ffffff', LINE, 1);

  const speaker = '发牌员：';
  ctx.font = `700 11.5px ${FONT_SANS}`;
  const speakerW = ctx.measureText(speaker).width;

  ctx.font = `400 11.5px ${FONT_SANS}`;
  const quoteLines = wrapTwoLines(ctx, model.dealerQuote, bubbleW - 20 - speakerW);
  const firstY = quoteLines.length === 1 ? lowerY + bubbleH / 2 + 0.5 : lowerY + 16;

  ctx.font = `700 11.5px ${FONT_SANS}`;
  ctx.fillStyle = ACCENT;
  ctx.textBaseline = 'middle';
  ctx.fillText(speaker, bubbleX + 10, firstY);

  ctx.font = `400 11.5px ${FONT_SANS}`;
  ctx.fillStyle = INK;
  ctx.fillText(quoteLines[0], bubbleX + 10 + speakerW, firstY);
  if (quoteLines.length > 1) {
    ctx.fillText(quoteLines[1], bubbleX + 10, lowerY + 34);
  }
}

function drawScoreboardStrip(
  ctx: CanvasRenderingContext2D,
  model: DealerPosterModel,
): void {
  const sx = 26;
  const sy = 198;
  const sw = POSTER_W - 52;
  const sh = 64;
  fillRoundedBox(ctx, sx, sy, sw, sh, 9, '#f7f9f9', '#d5e0de', 1);

  const colW = sw / 4;
  ctx.strokeStyle = '#d5e0de';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    const dx = Math.round(sx + colW * i) + 0.5;
    ctx.moveTo(dx, sy + 12);
    ctx.lineTo(dx, sy + sh - 12);
  }
  ctx.stroke();

  model.metrics.forEach((metric, index) => {
    const cx = sx + index * colW + 16;
    const toneColor = METRIC_TONE_COLOR[metric.tone];

    ctx.font = `500 12px ${FONT_SANS}`;
    ctx.fillStyle = '#687d7a';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(metric.label, cx, sy + 23);

    ctx.font = `700 25px ${FONT_NUM}`;
    ctx.fillStyle = toneColor;
    const valW = ctx.measureText(metric.value).width;
    ctx.fillText(metric.value, cx, sy + 52);

    ctx.font = `500 12px ${FONT_SANS}`;
    ctx.fillStyle = '#687d7a';
    ctx.fillText(
      fitText(ctx, metric.unit, colW - 30 - valW),
      cx + valW + 5,
      sy + 51,
    );
  });
}

function drawVerdictCards(
  ctx: CanvasRenderingContext2D,
  model: DealerPosterModel,
): void {
  const startX = 26;
  const topY = 274;
  const totalW = POSTER_W - 52;
  const gap = 8;
  const cardW = (totalW - gap * 4) / 5;
  const cardH = 158;

  model.verdicts.slice(0, 5).forEach((verdict, index) => {
    const cx = startX + index * (cardW + gap);
    const style = VERDICT_STYLE[verdict.tone];

    ctx.save();
    roundRect(ctx, cx, topY, cardW, cardH, 9);
    ctx.fillStyle = style.bg;
    ctx.fill();
    if (style.dashed) ctx.setLineDash([4, 4]);
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();

    const headerText = `#${String(verdict.roundNumber).padStart(2, '0')} · ${verdict.scopeLabel}`;
    drawPill(ctx, {
      x: cx + 8,
      y: topY + 11,
      h: 22,
      fixedWidth: cardW - 16,
      padX: 6,
      text: headerText,
      bg: style.headerBg,
      border: 'transparent',
      fg: style.headerFg,
      font: `600 10.5px ${FONT_SANS}`,
    });

    const centerX = cx + cardW / 2;
    const emblemY = topY + 67;
    ctx.beginPath();
    ctx.arc(centerX, emblemY, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = style.circleStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = `23px ${FONT_EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(verdict.icon || '🔒', centerX, emblemY + 1);

    ctx.font = `700 15px ${FONT_SANS}`;
    ctx.fillStyle = style.titleFg;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(fitText(ctx, verdict.title, cardW - 14), centerX, topY + 119);

    ctx.font = `500 11.5px ${FONT_SANS}`;
    ctx.fillStyle = style.detailFg;
    ctx.fillText(fitText(ctx, verdict.detail, cardW - 14), centerX, topY + 141);
    ctx.textAlign = 'left';
  });
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  model: DealerPosterModel,
): void {
  const leftX = 26;
  const rightEdge = POSTER_W - 26;
  const stampW = 142;
  const maxLeftW = rightEdge - leftX - stampW - 14;

  ctx.font = `500 12px ${FONT_SANS}`;
  ctx.fillStyle = INK2;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fitText(ctx, model.ctaTitle, maxLeftW), leftX, 460);

  fillRoundedBox(ctx, leftX, 469, maxLeftW, 26, 6, '#fdf5e6', '#e2b76b', 1);
  ctx.font = `600 11.5px ${FONT_SANS}`;
  ctx.fillStyle = ACCENT;
  ctx.textBaseline = 'middle';
  ctx.fillText(
    fitText(ctx, `🔗 ${model.shareUrl}`, maxLeftW - 18),
    leftX + 10,
    482.5,
  );

  const sx = rightEdge - stampW;
  const sy = 448;
  fillRoundedBox(ctx, sx, sy, stampW, 46, 8, '#fdf5e6', '#e2b76b', 1.1);
  ctx.textAlign = 'center';
  ctx.font = `700 12px ${FONT_SANS}`;
  ctx.fillStyle = ACCENT;
  ctx.fillText('卫戍速查 · 痛扁发牌', sx + stampW / 2, sy + 17);
  ctx.font = `500 10.5px ${FONT_SANS}`;
  ctx.fillStyle = INK3;
  ctx.fillText('盟约 · 干员 · 速查工具', sx + stampW / 2, sy + 34);
  ctx.textAlign = 'left';
}

/** Renders a 2x high-DPI light-themed battle-report PNG data URL via Canvas 2D. */
export function renderDealerPosterDataUrl(model: DealerPosterModel): string {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W * POSTER_DPR;
  canvas.height = POSTER_H * POSTER_DPR;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.save();
  ctx.scale(POSTER_DPR, POSTER_DPR);
  drawPaperCardFrame(ctx);
  drawHeroAndDealerPanel(ctx, model);
  drawScoreboardStrip(ctx, model);
  drawVerdictCards(ctx, model);
  drawFooter(ctx, model);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function pngDataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], {type: 'image/png'});
}

/** Copies the rendered PNG poster to the system clipboard when supported. */
export async function copyPosterToClipboard(
  dataUrl: string,
): Promise<'copied' | 'unsupported'> {
  if (
    !dataUrl ||
    typeof ClipboardItem === 'undefined' ||
    !navigator.clipboard?.write
  ) {
    return 'unsupported';
  }
  try {
    const blob = pngDataUrlToBlob(dataUrl);
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    return 'copied';
  } catch {
    return 'unsupported';
  }
}

/** Triggers a direct PNG file download as fallback or explicit save action. */
export function downloadPosterPng(dataUrl: string, fileName: string): void {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
