/**
 * 漏怪文书高清 PNG 绘制器：将《漏怪道歉书》《使用申请书》渲染为红头公文预览或高清分享图。
 * 所有头像与盟约图标均来自同源 /assets/img/，canvas 不会被污染，可直接复制或保存 PNG。
 */
import type {
  ApologyDocument,
  ApologyTargetBadge,
} from '../../lib/apology/index.ts';
import {avatarSrc, covenantIconSrc} from '../../lib/ui/assets.ts';

import {loadPosterImage, posterPng, renderCanvasPoster, sizePoster} from '../../lib/ui/canvasPoster.ts';
export {copyPosterPng as copyApologyImage} from '../../lib/ui/canvasPoster.ts';

const POSTER_W = 680;
const OUTER_PAD = 14;
const INNER_PAD = 28;
const CONTENT_W = POSTER_W - (OUTER_PAD + INNER_PAD) * 2;

const FONT_SANS =
  '"Noto Sans SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif';
const FONT_SERIF =
  '"Songti SC", "SimSun", "STSong", "Noto Serif SC", Georgia, serif';
const FONT_MONO = '"JetBrains Mono", Consolas, monospace';

const PAPER_BG = '#fdfcf8';
const DESK_BG = '#ebe7dc';
const INK = '#182220';
const INK2 = '#44524f';
const INK3 = '#737f7c';
const GRID_LINE = '#cfc6b4';
const CELL_TINT = '#f4efe2';
const RED_HEADER = '#b8322a';

function tintIcon(
  img: HTMLImageElement,
  size: number,
  color: string,
): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  if (!octx) return off;
  octx.drawImage(img, 0, 0, size, size);
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = color;
  octx.fillRect(0, 0, size, size);
  return off;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const rawParagraph of text.split('\n')) {
    const paragraph = rawParagraph.trimEnd();
    if (!paragraph) continue;
    let line = '';
    for (const ch of paragraph) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function measureTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
): {fontSize: number; lines: string[]; lineHeight: number} {
  for (const fontSize of [30, 26, 23]) {
    ctx.font = `800 ${fontSize}px ${FONT_SERIF}`;
    if (ctx.measureText(title).width <= CONTENT_W) {
      return {fontSize, lines: [title], lineHeight: fontSize + 10};
    }
  }
  const fontSize = 24;
  ctx.font = `800 ${fontSize}px ${FONT_SERIF}`;
  return {
    fontSize,
    lines: wrapText(ctx, title, CONTENT_W),
    lineHeight: fontSize + 9,
  };
}

function fillRounded(
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
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

interface PairedRowLayout {
  readonly left: {readonly label: string; readonly lines: string[]};
  readonly right?: {readonly label: string; readonly lines: string[]};
  readonly height: number;
}

interface NumberedRowLayout {
  readonly index: number;
  readonly lines: string[];
  readonly height: number;
}

interface PosterLayout {
  readonly totalHeight: number;
  readonly title: {
    readonly fontSize: number;
    readonly lines: string[];
    readonly lineHeight: number;
  };
  readonly badge: ReturnType<typeof measureBadge> | null;
  readonly salutationLines: readonly string[];
  readonly signatureLines: readonly string[];
  readonly tableRows: readonly PairedRowLayout[];
  readonly openingLines: readonly string[];
  readonly reasonRows: readonly NumberedRowLayout[];
  readonly pledgeRows: readonly NumberedRowLayout[];
  readonly quoteLines: readonly string[];
}

const TABLE_LABEL_W = 104;
const TABLE_LINE_H = 23;
const OPENING_LINE_H = 28;
const ITEM_LINE_H = 26;
const QUOTE_LINE_H = 27;
const SIGNATURE_WIDTH = 180;
const SIGNATURE_LINE_H = 28;
const BADGE_TEXT_INSET = 18 + 54 + 16;
const BADGE_NAME_LINE_H = 27;

function measureBadge(
  ctx: CanvasRenderingContext2D,
  badge: ApologyTargetBadge,
) {
  const width = CONTENT_W - BADGE_TEXT_INSET - 16;
  ctx.font = `700 22px ${FONT_SANS}`;
  const nameLines = wrapText(ctx, badge.name, width);
  const detailOffset = ctx.measureText(badge.name).width + 10;
  ctx.font = `500 14.5px ${FONT_SANS}`;
  const inline =
    nameLines.length === 1 &&
    detailOffset + ctx.measureText(`·  ${badge.detail}`).width <= width;
  return {
    nameLines,
    detailOffset: inline ? detailOffset : 0,
    height: Math.max(
      74,
      34 + nameLines.length * BADGE_NAME_LINE_H + (inline ? 0 : 20) + 10,
    ),
  };
}

function measureLayout(
  ctx: CanvasRenderingContext2D,
  doc: ApologyDocument,
): PosterLayout {
  const title = measureTitle(ctx, doc.title);
  const halfW = CONTENT_W / 2;
  const valMaxW = halfW - TABLE_LABEL_W - 20;
  const fullValMaxW = CONTENT_W - TABLE_LABEL_W - 20;

  ctx.font = `600 16px ${FONT_SANS}`;
  const tableRows: PairedRowLayout[] = [];
  for (let i = 0; i < doc.metaRows.length; i += 2) {
    const leftMeta = doc.metaRows[i];
    const rightMeta = doc.metaRows[i + 1];
    if (rightMeta) {
      const leftLines = wrapText(ctx, leftMeta.value, valMaxW);
      const rightLines = wrapText(ctx, rightMeta.value, valMaxW);
      const maxLines = Math.max(leftLines.length, rightLines.length);
      tableRows.push({
        left: {label: leftMeta.label, lines: leftLines},
        right: {label: rightMeta.label, lines: rightLines},
        height: Math.max(44, maxLines * TABLE_LINE_H + 18),
      });
    } else {
      const leftLines = wrapText(ctx, leftMeta.value, fullValMaxW);
      tableRows.push({
        left: {label: leftMeta.label, lines: leftLines},
        height: Math.max(44, leftLines.length * TABLE_LINE_H + 18),
      });
    }
  }

  ctx.font = `500 17px ${FONT_SANS}`;
  const openingLines = doc.opening.trim()
    ? wrapText(ctx, `　　${doc.opening}`, CONTENT_W - 4)
    : [];

  const checkedReasons = doc.reasons.filter((item) => item.checked);
  ctx.font = `500 16px ${FONT_SANS}`;
  const reasonRows: NumberedRowLayout[] = checkedReasons.map((item, idx) => {
    const lines = wrapText(ctx, `${idx + 1}. ${item.text}`, CONTENT_W - 30);
    return {
      index: idx + 1,
      lines,
      height: lines.length * ITEM_LINE_H + 8,
    };
  });

  const checkedPledges = doc.pledges.filter((item) => item.checked);
  const pledgeRows: NumberedRowLayout[] = checkedPledges.map((item, idx) => {
    const lines = wrapText(ctx, `${idx + 1}. ${item.text}`, CONTENT_W - 30);
    return {
      index: idx + 1,
      lines,
      height: lines.length * ITEM_LINE_H + 8,
    };
  });

  ctx.font = `500 17px ${FONT_SERIF}`;
  const quoteLines = doc.quoteText
    ? wrapText(ctx, `“${doc.quoteText}”`, CONTENT_W - 38)
    : [];

  const badge = doc.targetBadge ? measureBadge(ctx, doc.targetBadge) : null;
  ctx.font = `700 17.5px ${FONT_SANS}`;
  const salutationLines = doc.salutation
    ? wrapText(ctx, doc.salutation, CONTENT_W - 4)
    : [];
  ctx.font = `700 22px ${FONT_SERIF}`;
  const signatureLines = wrapText(ctx, doc.signature, SIGNATURE_WIDTH - 16);

  let y = OUTER_PAD + 28;
  // 红头机构名 + 编号行 + 双红线 + 标题 + 副标题
  y += 34 + 24 + 20 + title.lines.length * title.lineHeight + 24;
  // 关联干员 / 盟约 / 流派卡
  if (badge) y += badge.height + 16;
  // 表格
  for (const row of tableRows) y += row.height;
  y += 18;
  // 正式称呼行
  y += salutationLines.length * 30;
  // 正文导语
  if (openingLines.length) y += openingLines.length * OPENING_LINE_H + 18;
  // 原因区（仅显示已选）
  if (reasonRows.length) {
    y += 42 + 12;
    for (const row of reasonRows) y += row.height;
    y += 18;
  }
  // 条款区（仅显示已选）
  if (pledgeRows.length) {
    y += 42 + 12;
    for (const row of pledgeRows) y += row.height;
    y += 18;
  }
  // 补充声明
  if (quoteLines.length) {
    y += 34 + quoteLines.length * QUOTE_LINE_H + 18 + 16;
  }
  // 结语
  if (doc.closingLines.length) {
    y += doc.closingLines.length * 28 + 10;
  }
  // 底部日期与落款 + 页脚
  y += 74 + (signatureLines.length - 1) * SIGNATURE_LINE_H + 38 + OUTER_PAD;

  return {
    totalHeight: Math.ceil(y),
    title,
    badge,
    salutationLines,
    signatureLines,
    tableRows,
    openingLines,
    reasonRows,
    pledgeRows,
    quoteLines,
  };
}

function drawNumberedSection(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y: number,
  title: string,
  titleColor: string,
  rows: readonly NumberedRowLayout[],
): number {
  const headerH = 42;
  const bodyH = 12 + rows.reduce((sum, item) => sum + item.height, 0);
  fillRounded(
    ctx,
    x0,
    y,
    CONTENT_W,
    headerH + bodyH,
    6,
    '#ffffff',
    GRID_LINE,
    1.2,
  );
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y, CONTENT_W, headerH + bodyH, 6);
  ctx.clip();
  ctx.fillStyle = CELL_TINT;
  ctx.fillRect(x0, y, CONTENT_W, headerH);
  ctx.restore();

  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y + headerH);
  ctx.lineTo(x0 + CONTENT_W, y + headerH);
  ctx.stroke();

  ctx.fillStyle = titleColor;
  ctx.font = `700 17px ${FONT_SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x0 + 14, y + headerH / 2);

  let cursorY = y + headerH + 10;
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `500 16px ${FONT_SANS}`;
  for (const row of rows) {
    row.lines.forEach((line, lineIdx) => {
      ctx.fillText(line, x0 + 15, cursorY + lineIdx * ITEM_LINE_H);
    });
    cursorY += row.height;
  }
  return y + headerH + bodyH + 18;
}

/** 按文书快照生成 PNG。预览优先节省内存，导出最高 2 倍。取消或编码失败时拒绝。 */
export async function renderApologyPoster(
  doc: ApologyDocument,
  mode: 'preview' | 'export',
  signal: AbortSignal,
): Promise<Blob> {
  signal.throwIfAborted();
  const badge = doc.targetBadge;
  const src =
    badge?.kind === 'operator'
      ? avatarSrc(badge.name)
      : badge?.kind === 'covenant'
        ? covenantIconSrc(badge.name)
        : '';
  const targetImage = loadPosterImage(src, 6000, signal);
  const blob = await renderCanvasPoster(async (ctx) => {
    const targetImg = await targetImage;
    signal.throwIfAborted();
    drawDocument(ctx, doc, targetImg, mode);
    return posterPng(ctx.canvas);
  });
  signal.throwIfAborted();
  if (!blob) throw new Error('无法生成文书 PNG');
  return blob;
}

function drawDocument(
  ctx: CanvasRenderingContext2D,
  doc: ApologyDocument,
  targetImg: HTMLImageElement | null,
  mode: 'preview' | 'export',
): void {
  const layout = measureLayout(ctx, doc);
  sizePoster(ctx, POSTER_W, layout.totalHeight, mode);

  // 背景与纸张
  ctx.fillStyle = DESK_BG;
  ctx.fillRect(0, 0, POSTER_W, layout.totalHeight);

  const paperX = OUTER_PAD;
  const paperY = OUTER_PAD;
  const paperW = POSTER_W - OUTER_PAD * 2;
  const paperH = layout.totalHeight - OUTER_PAD * 2;
  fillRounded(
    ctx,
    paperX,
    paperY,
    paperW,
    paperH,
    10,
    PAPER_BG,
    GRID_LINE,
    1.2,
  );

  // 纸张顶部红头装饰细条
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(paperX, paperY, paperW, paperH, 10);
  ctx.clip();
  ctx.fillStyle = RED_HEADER;
  ctx.fillRect(paperX, paperY, paperW, 6);
  ctx.restore();

  const x0 = paperX + INNER_PAD;
  let y = paperY + 28;

  // 机构红头
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = RED_HEADER;
  ctx.font = `700 24px ${FONT_SERIF}`;
  ctx.fillText(doc.issuer, POSTER_W / 2, y);
  y += 34;

  // 文件编号与日期
  ctx.font = `500 13.5px ${FONT_MONO}`;
  ctx.fillStyle = INK3;
  ctx.textAlign = 'left';
  ctx.fillText(`编号：${doc.docNo}`, x0, y);
  ctx.textAlign = 'right';
  ctx.fillText(`日期：${doc.dateText}`, x0 + CONTENT_W, y);
  y += 24;

  // 红头双横线
  ctx.fillStyle = RED_HEADER;
  ctx.fillRect(x0, y, CONTENT_W, 3);
  ctx.fillRect(x0, y + 6, CONTENT_W, 1.2);
  y += 20;

  // 主标题与副标题（长自定义流派名自动缩号或换行）
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 ${layout.title.fontSize}px ${FONT_SERIF}`;
  for (const line of layout.title.lines) {
    ctx.fillText(line, POSTER_W / 2, y);
    y += layout.title.lineHeight;
  }

  ctx.fillStyle = INK3;
  ctx.font = `600 12px ${FONT_MONO}`;
  ctx.fillText(doc.subtitle, POSTER_W / 2, y);
  y += 24;
  ctx.textAlign = 'left';

  // 关联干员 / 盟约 / 流派档案条
  if (doc.targetBadge && layout.badge) {
    const badgeH = layout.badge.height;
    fillRounded(ctx, x0, y, CONTENT_W, badgeH, 8, CELL_TINT, GRID_LINE, 1);
    ctx.fillStyle = doc.targetBadge.color;
    ctx.fillRect(x0, y + 10, 5, badgeH - 20);

    const iconX = x0 + 18;
    const iconY = y + 10;
    const iconSize = 54;
    if (targetImg) {
      if (doc.targetBadge.kind === 'operator') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 8);
        ctx.clip();
        ctx.drawImage(targetImg, iconX, iconY, iconSize, iconSize);
        ctx.restore();
        ctx.strokeStyle = doc.targetBadge.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 8);
        ctx.stroke();
      } else {
        fillRounded(
          ctx,
          iconX,
          iconY,
          iconSize,
          iconSize,
          8,
          '#ffffff',
          doc.targetBadge.color,
          1.5,
        );
        const tinted = tintIcon(targetImg, 72, doc.targetBadge.color);
        ctx.drawImage(
          tinted,
          iconX + 8,
          iconY + 8,
          iconSize - 16,
          iconSize - 16,
        );
        tinted.width = tinted.height = 0;
      }
    } else {
      fillRounded(
        ctx,
        iconX,
        iconY,
        iconSize,
        iconSize,
        8,
        '#ffffff',
        doc.targetBadge.color,
        1.4,
      );
      ctx.fillStyle = doc.targetBadge.color;
      ctx.font = `700 22px ${FONT_SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        doc.targetBadge.name.slice(0, 1),
        iconX + iconSize / 2,
        iconY + iconSize / 2 + 1,
      );
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }

    const textX = x0 + BADGE_TEXT_INSET;
    ctx.fillStyle = INK3;
    ctx.font = `600 13px ${FONT_SANS}`;
    const kindLabel =
      doc.template === 'application'
        ? doc.targetBadge.kind === 'operator'
          ? '报备关键干员'
          : '拟游玩流派 / 盟约'
        : doc.targetBadge.kind === 'operator'
          ? '本局相关干员'
          : '本局使用盟约';
    ctx.fillText(kindLabel, textX, y + 12);

    ctx.fillStyle = INK;
    ctx.font = `700 22px ${FONT_SANS}`;
    const {nameLines, detailOffset} = layout.badge;
    for (const [index, line] of nameLines.entries()) {
      ctx.fillText(line, textX, y + 34 + index * BADGE_NAME_LINE_H);
    }
    ctx.fillStyle = INK2;
    ctx.font = `500 14.5px ${FONT_SANS}`;
    ctx.fillText(
      detailOffset ? `·  ${doc.targetBadge.detail}` : doc.targetBadge.detail,
      textX + detailOffset,
      detailOffset ? y + 40 : y + 34 + nameLines.length * BADGE_NAME_LINE_H,
      CONTENT_W - BADGE_TEXT_INSET - detailOffset - 16,
    );

    y += badgeH + 16;
  }

  // 基本信息表格
  const halfW = CONTENT_W / 2;
  const tableTop = y;
  for (const row of layout.tableRows) {
    ctx.fillStyle = CELL_TINT;
    ctx.fillRect(x0, y, TABLE_LABEL_W, row.height);
    ctx.fillStyle = INK2;
    ctx.font = `600 15px ${FONT_SANS}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(row.left.label, x0 + 10, y + row.height / 2);

    ctx.fillStyle = INK;
    ctx.font = `600 16px ${FONT_SANS}`;
    ctx.textBaseline = 'top';
    const leftBlockH = row.left.lines.length * TABLE_LINE_H;
    const leftStartY = y + (row.height - leftBlockH) / 2 + 2;
    row.left.lines.forEach((line, idx) => {
      ctx.fillText(
        line,
        x0 + TABLE_LABEL_W + 10,
        leftStartY + idx * TABLE_LINE_H,
      );
    });

    if (row.right) {
      const rx = x0 + halfW;
      ctx.fillStyle = CELL_TINT;
      ctx.fillRect(rx, y, TABLE_LABEL_W, row.height);
      ctx.fillStyle = INK2;
      ctx.font = `600 15px ${FONT_SANS}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(row.right.label, rx + 10, y + row.height / 2);

      ctx.fillStyle = INK;
      ctx.font = `600 16px ${FONT_SANS}`;
      ctx.textBaseline = 'top';
      const rightBlockH = row.right.lines.length * TABLE_LINE_H;
      const rightStartY = y + (row.height - rightBlockH) / 2 + 2;
      row.right.lines.forEach((line, idx) => {
        ctx.fillText(
          line,
          rx + TABLE_LABEL_W + 10,
          rightStartY + idx * TABLE_LINE_H,
        );
      });
    }

    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y, CONTENT_W, row.height);
    ctx.beginPath();
    ctx.moveTo(x0 + TABLE_LABEL_W, y);
    ctx.lineTo(x0 + TABLE_LABEL_W, y + row.height);
    if (row.right) {
      ctx.moveTo(x0 + halfW, y);
      ctx.lineTo(x0 + halfW, y + row.height);
      ctx.moveTo(x0 + halfW + TABLE_LABEL_W, y);
      ctx.lineTo(x0 + halfW + TABLE_LABEL_W, y + row.height);
    }
    ctx.stroke();

    y += row.height;
  }
  ctx.strokeStyle = '#b9af9b';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x0, tableTop, CONTENT_W, y - tableTop);
  y += 18;

  // 正式公函称呼行（申请书）
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `700 17.5px ${FONT_SANS}`;
  for (const line of layout.salutationLines) {
    ctx.fillText(line, x0 + 2, y);
    y += 30;
  }

  // 正文导语
  ctx.fillStyle = INK;
  ctx.font = `500 17px ${FONT_SANS}`;
  for (const line of layout.openingLines) {
    ctx.fillText(line, x0 + 2, y);
    y += OPENING_LINE_H;
  }
  if (layout.openingLines.length) y += 18;

  // 一、原因区（仅显示勾选及自定义项）
  if (layout.reasonRows.length) {
    y = drawNumberedSection(
      ctx,
      x0,
      y,
      `一、${doc.reasonHeading}`,
      RED_HEADER,
      layout.reasonRows,
    );
  }

  // 二、遵守/保证条款区（仅显示勾选及自定义项）
  if (layout.pledgeRows.length) {
    const pledgePrefix = layout.reasonRows.length ? '二、' : '一、';
    y = drawNumberedSection(
      ctx,
      x0,
      y,
      `${pledgePrefix}${doc.pledgeHeading}`,
      '#0f766c',
      layout.pledgeRows,
    );
  }

  // 补充声明引文框
  if (layout.quoteLines.length) {
    const qBoxH = 34 + layout.quoteLines.length * QUOTE_LINE_H + 16;
    fillRounded(ctx, x0, y, CONTENT_W, qBoxH, 6, '#faf5e8', '#e2d2b0', 1);
    ctx.fillStyle = RED_HEADER;
    ctx.fillRect(x0, y + 6, 5, qBoxH - 12);

    ctx.fillStyle = INK2;
    ctx.font = `700 14.5px ${FONT_SANS}`;
    ctx.fillText(doc.quoteLabel, x0 + 16, y + 10);

    ctx.fillStyle = INK;
    ctx.font = `500 17px ${FONT_SERIF}`;
    layout.quoteLines.forEach((line, idx) => {
      ctx.fillText(line, x0 + 16, y + 36 + idx * QUOTE_LINE_H);
    });
    y += qBoxH + 16;
  }

  // 正式结语（申请书保留「妥否，请批示。」）
  if (doc.closingLines.length) {
    ctx.fillStyle = INK;
    ctx.font = `600 16.5px ${FONT_SERIF}`;
    for (const closing of doc.closingLines) {
      ctx.fillText(`　　${closing}`, x0 + 2, y);
      y += 28;
    }
    y += 10;
  }

  // 底部签字栏：左日期，右签署人/申请人
  const footY = y + 8;

  ctx.fillStyle = INK2;
  ctx.font = `500 16px ${FONT_SANS}`;
  ctx.fillText(`日　期：${doc.dateText}`, x0 + 4, footY + 14);

  const rightEdge = x0 + CONTENT_W - 4;
  const sigLabel = `${doc.signatureLabel}：`;
  ctx.font = `600 16px ${FONT_SANS}`;
  const sigLabelW = ctx.measureText(sigLabel).width;
  const sigLineStartX = rightEdge - SIGNATURE_WIDTH;
  ctx.fillStyle = INK2;
  ctx.fillText(sigLabel, sigLineStartX - sigLabelW - 2, footY + 14);

  ctx.fillStyle = INK;
  ctx.font = `700 22px ${FONT_SERIF}`;
  for (const [index, line] of layout.signatureLines.entries()) {
    ctx.fillText(line, sigLineStartX + 8, footY + 8 + index * SIGNATURE_LINE_H);
  }
  const underlineY =
    footY + 38 + (layout.signatureLines.length - 1) * SIGNATURE_LINE_H;

  ctx.strokeStyle = '#9c9280';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(sigLineStartX, underlineY);
  ctx.lineTo(rightEdge, underlineY);
  ctx.stroke();

  // 页脚
  const footerY = layout.totalHeight - OUTER_PAD - 26;
  ctx.strokeStyle = '#e4ddce';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, footerY - 10);
  ctx.lineTo(x0 + CONTENT_W, footerY - 10);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = INK3;
  ctx.font = `500 13px ${FONT_SANS}`;
  ctx.fillText(doc.footerNote, POSTER_W / 2, footerY);
}
