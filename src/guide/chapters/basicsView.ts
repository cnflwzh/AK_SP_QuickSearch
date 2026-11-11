/** 第 1 章 入门：难度、规程等级、解锁关系、回合时间轴、认证收益 */
import {
  DIFFICULTIES, MODES, DECISION_ROUNDS, SOLO_LEVELS, ROUND_TIME, CREDIT,
} from '../../../data/index';
import { html } from '../../lib/dom';
import { cv } from '../chips';

function difficulty(out: Record<string, string>) {
  const bars = DIFFICULTIES.map(d => {
    const hasStrength = d.strength != null;
    return html`<div class="hb">
      <span>${d.name}</span>
      <div class="hb-t"><div class="hb-f" style="width:${d.efficiency / 150 * 100}%"></div></div>
      <span class="hb-v">${d.efficiency ? d.efficiency + '%' : '—'}</span>
      <span class="tag ${hasStrength ? 'a' : ''}">${hasStrength ? '强度 +' + d.strength : d.note}</span>
    </div>`;
  });
  const notes = DIFFICULTIES.slice(1).map(d => `<span class="tag">${d.name.slice(0, 2)}：${d.note}</span>`);
  out.diff = html`${bars}<div class="row mt">${notes}</div>`;
}

/** 1.2 个人模拟：规程等级 1–20 的效率柱状图 */
function soloLevelChart(out: Record<string, string>) {
  const W = 640, x0 = 34, barWidth = 22, gap = (W - x0 - 10) / 20;
  const BASE_Y = 170;                                          // 柱底
  const heightOf = (efficiency: number) => (efficiency - 90) / 60 * 140; // 90%–150% 映射到 0–140px
  let s = '';

  for (let i = 0; i <= 2; i++) {
    const v = 100 + i * 25;
    const y = BASE_Y - heightOf(v);
    s += `<line class="gl" x1="${x0 - 4}" x2="${W}" y1="${y}" y2="${y}"/>`
      + `<text class="axl" x="${x0 - 8}" y="${y + 4}" text-anchor="end">${v}%</text>`;
  }

  SOLO_LEVELS.forEach((l, i) => {
    const x = x0 + i * gap + (gap - barWidth) / 2;
    const h = heightOf(l.efficiency);
    const y = BASE_Y - h;
    const milestone = [5, 9, 15].includes(l.level);
    const fill = milestone ? 'var(--accent)' : 'color-mix(in srgb,var(--teal) 75%,transparent)';
    s += `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="2" fill="${fill}">`
      + `<title>规程${l.level} · ${l.efficiency}% · +${l.strength}</title></rect>`
      + `<text class="axl" x="${x + barWidth / 2}" y="186" text-anchor="middle" style="fill:var(--ink)">${l.level}</text>`
      + `<text class="axl" x="${x + barWidth / 2}" y="201" text-anchor="middle">+${l.strength}</text>`;
  });

  const label = (level: number, text: string, dy: number) => {
    const x = x0 + (level - 1) * gap + gap / 2;
    const y = BASE_Y - heightOf(SOLO_LEVELS[level - 1].efficiency) - 8 - dy;
    return `<text class="axl" x="${x}" y="${y}" text-anchor="middle" style="fill:var(--accent);font-size:12px">${text}</text>`;
  };
  s += label(5, '盟约26/26', 0) + label(9, '追加敌人', 0) + label(15, '开绝境', 0) + label(9, '开险境', 14);
  s += '<text class="axl" x="4" y="186">等级</text><text class="axl" x="4" y="201">强度</text>';

  out.lvchart = s;
  out.lvmiss = ['阿戈尔', '卡西米尔', '灵巧', '奇迹', '投资人', '突袭', '独行', '绝技'].map(cv).join('');
}

/** 1.2 个人 / 联合模拟互相解锁的关系图 */
function unlockGraph(out: Record<string, string>) {
  const levelX = (L: number) => 30 + (L - 1) * 32.6;
  const soloY = 180, jointY = 48;
  const JOINT = { 标准: 60, 险境: 230, 绝境: 430, 终极: 610 };   // 联合模拟节点 x
  const KEY_LEVELS = [3, 7, 9, 13, 15];

  const marker = (id: string, fill: string) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="${fill}"/></marker>`;
  let s = `<defs>${marker('mT', 'var(--teal)')}${marker('mA', 'var(--accent)')}${marker('mI', 'var(--ink3)')}</defs>`;

  s += `<text class="axl" x="4" y="${jointY - 26}" style="letter-spacing:.2em">联合模拟</text>`
    + `<text class="axl" x="4" y="${soloY + 36}" style="letter-spacing:.2em">个人 · 规程等级</text>`;

  // 个人模拟等级轴
  s += `<line x1="${levelX(1)}" x2="${levelX(20)}" y1="${soloY}" y2="${soloY}" stroke="var(--line2)" stroke-width="2"/>`;
  for (let L = 1; L <= 20; L++) {
    const key = KEY_LEVELS.includes(L);
    s += `<circle cx="${levelX(L)}" cy="${soloY}" r="${key ? 8 : 4}" fill="${key ? 'var(--surface)' : 'var(--line2)'}" stroke="${key ? 'var(--ink)' : 'none'}" stroke-width="1.5"/>`;
    if (key || L === 1 || L === 20) {
      s += `<text class="axl" x="${levelX(L)}" y="${soloY + 24}" text-anchor="middle" style="fill:var(--ink);font-size:12px">${L}</text>`;
    }
  }

  // 联合模拟难度链
  const nodes = Object.entries(JOINT);
  nodes.forEach(([, x], i) => {
    if (i >= 3) return;
    const nextX = nodes[i + 1][1];
    s += `<line x1="${x + 34}" x2="${nextX - 38}" y1="${jointY}" y2="${jointY}" stroke="var(--ink2)" stroke-width="2" marker-end="url(#mI)"/>`;
    if (i === 2) s += `<text class="axl" x="${(x + nextX) / 2}" y="${jointY - 8}" text-anchor="middle" style="fill:var(--ink)">通关 ×3</text>`;
  });

  // 竖向连线：实线 个人 → 联合，虚线 联合 → 个人
  const curve = (x1: number, y1: number, x2: number, y2: number, stroke: string, markerId: string) => {
    const midY = (y1 + y2) / 2;
    const dash = stroke.includes('teal') ? '0' : '5 4';
    return `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-dasharray="${dash}" marker-end="url(#${markerId})"/>`;
  };
  s += curve(levelX(9), soloY - 10, JOINT.险境 + 8, jointY + 18, 'var(--teal)', 'mT');
  s += curve(levelX(15), soloY - 10, JOINT.绝境 + 8, jointY + 18, 'var(--teal)', 'mT');
  s += curve(JOINT.险境 - 12, jointY + 18, levelX(3), soloY - 10, 'var(--accent)', 'mA');
  s += curve(JOINT.绝境 - 12, jointY + 18, levelX(7), soloY - 10, 'var(--accent)', 'mA');
  s += curve(JOINT.终极 - 12, jointY + 18, levelX(13), soloY - 10, 'var(--accent)', 'mA');

  nodes.forEach(([name, x]) => {
    s += `<rect x="${x - 34}" y="${jointY - 16}" width="68" height="32" rx="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>`
      + `<text x="${x}" y="${jointY + 5}" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:700">${name}</text>`;
  });

  out.unlock = s;
}

/** Return the time-axis markup and caption for the selected difficulty index. */
export function roundTimeline(i: number) {
  const out: Record<string, string> = {};
    const mode = MODES[i];
    const standard = mode === '标准';
    const rounds = 14;
    let s = '';
    for (let r = 1; r <= rounds; r++) {
      const leader = r === rounds;
      const seconds = leader ? 120 : ROUND_TIME[r - 1];
      const decision = DECISION_ROUNDS[mode].includes(r);
      s += html`<div class="c ${leader ? 'ld' : ''} ${decision ? 'dec' : ''}">
        <span class="sec">${seconds}</span>
        <div class="bar" style="height:${seconds / 120 * 110}px"></div>
        <span class="rn">${leader ? '领袖' : 'R' + r}</span>
      </div>`;
    }
    if (!standard) {
      s += '<div class="c hid"><span class="sec">??</span><div class="bar" style="height:110px"></div><span class="rn">核心</span></div>';
    }
    out.tl = s;
    out.tlinfo = standard ? '14 回合' : '14 回合 + 隐秘核心';
  return out;
}

/** Return the scaled credit chart and leader bonus caption for a difficulty index. */
export function creditChart(i: number) {
  const out: Record<string, string> = {};
  const multipliers = DIFFICULTIES.slice(1).map(d => d.efficiency / 100);

    const m = multipliers[i];
    const W = 600, x0 = 38, bw = (W - x0 - 10) / 15, BASE_Y = 190;
    const max = (CREDIT[CREDIT.length - 1] + 50) * 1.5;
    const h = (v: number) => v / max * 170;
    let s = '';

    [0, 100, 200, 300].forEach(v => {
      const y = BASE_Y - h(v);
      s += `<line class="gl" x1="${x0}" x2="${W}" y1="${y}" y2="${y}"/><text class="axl" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
    });

    CREDIT.forEach((c, k) => {
      const v = Math.round(c * m);
      const x = x0 + k * bw + 3;
      const cx = x + (bw - 6) / 2;
      s += `<rect x="${x}" y="${BASE_Y - h(v)}" width="${bw - 6}" height="${h(v)}" rx="2" fill="color-mix(in srgb,var(--teal) 75%,transparent)" style="transform-origin:${x}px 190px;animation:growY .6s ${k * .03}s both"/>`
        + `<text class="axl" x="${cx}" y="${186 - h(v)}" text-anchor="middle" style="fill:var(--ink)">${v}</text>`
        + `<text class="axl" x="${cx}" y="206" text-anchor="middle">${k + 1}${k === 13 ? '+' : ''}</text>`;
    });

    // 击败领袖：最终通过回合的基础认证 + 50 击败奖励
    const bonus = Math.round(50 * m);
    const base = Math.round(CREDIT[CREDIT.length - 1] * m);
    const x = x0 + 14 * bw + 3;
    const h1 = base / max * 170, h2 = bonus / max * 170;
    s += `<rect x="${x}" y="${BASE_Y - h1}" width="${bw - 6}" height="${h1}" rx="2" fill="color-mix(in srgb,var(--teal) 75%,transparent)"/>`
      + `<rect x="${x}" y="${BASE_Y - h1 - h2}" width="${bw - 6}" height="${h2}" fill="var(--red)"/>`
      + `<text class="axl" x="${x + (bw - 6) / 2}" y="${186 - h1 - h2}" text-anchor="middle" style="fill:var(--red)">${base + bonus}</text>`
      + `<text class="axl" x="${x + (bw - 6) / 2}" y="206" text-anchor="middle" style="fill:var(--red)">领袖</text>`;
    s += `<text class="axl" x="${x0}" y="219">通过回合数</text>`;

    out.crchart = s;
    out.crsum = '×' + Math.round(m * 100) + '% · 击败领袖额外 +' + bonus;
  return out;
}
function seasonShopBar(out: Record<string, string>) {
  const max = 8750, x0 = 20, W = 580;
  const sx = (v: number) => x0 + v / max * (W - x0);
  let s = `<rect x="${x0}" y="64" width="${W - x0}" height="14" rx="7" fill="var(--surface2)" stroke="var(--line)"/>`
    + `<rect x="${x0}" y="64" width="${sx(6250) - x0}" height="14" rx="7" fill="var(--teal)" style="transform-origin:${x0}px 0;animation:grow 1.2s both"/>`
    + `<rect x="${sx(6250)}" y="64" width="${sx(8750) - sx(6250)}" height="14" rx="0" fill="var(--accent)" opacity=".85"/>`;

  const MARKS: [number, string, string][] = [
    [3000, '终端主题', '乌萨斯齐心团'],
    [6000, '家具', '卫戍之光投币玩偶'],
    [6250, '作战上限', ''],
    [8750, '+关键目标', ''],
  ];
  MARKS.forEach(([v, title, reward], i) => {
    const x = sx(v);
    const above = i < 2;
    const anchor = v > 8000 ? 'end' : 'middle';
    const tx = Math.min(x, W - 4);
    s += `<line x1="${x}" x2="${x}" y1="${i % 2 ? 56 : 86}" y2="${i % 2 ? 92 : 58}" stroke="var(--ink2)"/>`
      + `<text class="axl" x="${tx}" y="${above ? 40 : 116}" text-anchor="${anchor}" style="fill:var(--ink);font-size:13px">${v}</text>`
      + `<text class="axl" x="${tx}" y="${above ? 22 : 132}" text-anchor="${anchor}">${title}${reward ? ' · ' + reward : ''}</text>`;
  });
  out.shopbar = s;
}


/** Return all fixed introductory diagrams without modifying the document. */
export function basicsContent() {
 const out: Record<string, string> = {};
 difficulty(out); soloLevelChart(out); unlockGraph(out); seasonShopBar(out);
 return out;
}
