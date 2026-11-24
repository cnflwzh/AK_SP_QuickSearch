/** 第 3 章 敌人与对策：联防示意、悬赏分层与机变回合表 */
import {BOUNTIES, DECISION_ROUNDS} from '../../../data/index.ts';
import {esc, html, range} from '../../lib/ui/dom.ts';
import {bountyAvatar} from '../chips.ts';

/** 生成联防示意 SVG；组件通过 whileVisible 控制播放和减弱动效。 */
export function jointDefense(): string {
  const PLAYERS: [string, string, boolean][] = [
    ['玩家 A', '完美 0漏', true],
    ['玩家 B', '漏 3 只', false],
    ['玩家 C', '漏 5 只', false],
    ['玩家 D', '完美 0漏', true],
  ];
  let s =
    '<defs><marker id="jah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--green)"/></marker></defs>';
  PLAYERS.forEach(([name, result, perfect], i) => {
    const y = 30 + i * 52;
    const c = perfect ? 'var(--green)' : 'var(--red)';
    s +=
      `<rect x="10" y="${y}" width="126" height="38" rx="5" fill="var(--surface)" stroke="${c}" stroke-width="1.5"/>` +
      `<text x="22" y="${y + 24}" style="fill:var(--ink);font-size:13px">${name}</text>` +
      `<text x="124" y="${y + 24}" text-anchor="end" style="fill:${c};font-size:12px;font-weight:600">${result}</text>`;
  });
  s +=
    '<rect x="356" y="40" width="154" height="150" rx="8" fill="var(--teal-soft)" stroke="var(--teal)"/>' +
    '<text x="433" y="66" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:700">联防战场</text>' +
    '<text x="433" y="86" text-anchor="middle" class="axl">合并清理队友漏怪</text>' +
    '<rect x="378" y="140" width="52" height="34" rx="4" fill="var(--surface)" stroke="var(--green)"/><text x="404" y="162" text-anchor="middle" style="fill:var(--ink);font-size:12px">A 阵地</text>' +
    '<rect x="438" y="140" width="52" height="34" rx="4" fill="var(--surface)" stroke="var(--green)"/><text x="464" y="162" text-anchor="middle" style="fill:var(--ink);font-size:12px">D 阵地</text>';

  [1, 2].forEach((i) => {
    const y = 49 + i * 52;
    s += `<path id="jp${i}" d="M138,${y} C250,${y} 280,110 400,110" fill="none" stroke="var(--red)" stroke-dasharray="4 4" opacity=".6"/>`;
    const leaked = i === 1 ? 3 : 5;
    for (let k = 0; k < leaked; k++) {
      s += `<circle class="joint-enemy" r="4.5" fill="var(--red)"><animateMotion dur="2.6s" begin="${k * 0.45}s" repeatCount="indefinite"><mpath href="#jp${i}"/></animateMotion></circle>`;
    }
  });
  [0, 3].forEach((i) => {
    const y = 49 + i * 52;
    s += `<path d="M138,${y} C240,${y} 300,${i ? 190 : 150} ${i ? 464 : 404},${i ? 176 : 138}" fill="none" stroke="var(--green)" stroke-width="1.5" marker-end="url(#jah)" opacity=".85"/>`;
  });
  return (
    `<desc id="joint-defense-description">${PLAYERS.map(([name, result]) => `${name}：${result}`).join('；')}。漏怪合并到联防战场，由完美通关的玩家 A 和 D 清理。</desc>` +
    s
  );
}

/** Return bounty risk tiers and decision-round illustrations from the shared rules. */
export function enemyContent() {
  const out: Record<string, string> = {};
  const singleSafe = BOUNTIES.filter((b) => b.when === '下场' && b.funds <= 1);
  const singleMid = BOUNTIES.filter(
    (b) => b.when === '下场' && b.funds >= 2 && b.funds <= 3,
  );
  const singleDanger = BOUNTIES.filter(
    (b) => b.when === '下场' && b.funds >= 4,
  );
  const multiRound = BOUNTIES.filter((b) => b.when !== '下场');

  const chip = (b: (typeof BOUNTIES)[number]) => {
    const rewardLabel =
      b.when === '下场'
        ? `+${b.funds}`
        : b.when === '两场'
          ? `两场各+${b.funds}`
          : `每场+${b.funds}`;
    return `<span class="bty-item" title="${esc(b.mechanics)}">${bountyAvatar(b.enemyId)}<span>${esc(b.name)}</span><i>${rewardLabel}</i></span>`;
  };

  const tierBlock = (
    title: string,
    note: string,
    color: string,
    list: readonly (typeof BOUNTIES)[number][],
  ) => html`
    <div class="bty-tier" style="--bc:${color}">
      <div class="bty-tier-h">
        <b>${title}</b>
        <span class="cnt">${note}</span>
      </div>
      <div class="bty-chips">${list.map(chip)}</div>
    </div>
  `;

  out.bty =
    tierBlock(
      '低危过渡 · +0～+1 资金',
      '战力弱时选源石虫保血',
      'var(--green)',
      singleSafe,
    ) +
    tierBlock(
      '中期外快 · +2～+3 资金',
      '注意对空 / 反隐 / 元素奶',
      'var(--teal)',
      singleMid,
    ) +
    tierBlock(
      '高危强敌 · +4～+5 资金',
      '多带重生/缴械/秒坦，未成型慎点！',
      'var(--red)',
      singleDanger,
    ) +
    tierBlock(
      '多轮提款机 · 两场 / 之后每场',
      '资金逐只归实际击倒者',
      'var(--accent)',
      multiRound,
    );

  const cell = 'text-align:center;padding:4px 2px';
  const DIAMOND =
    '<span style="display:inline-block;width:10px;height:10px;background:var(--accent);transform:rotate(45deg)"></span>';
  const rows = Object.entries(DECISION_ROUNDS).map(
    ([mode, rounds]) => html`
      <tr>
        <td><b>${mode}</b></td>
        ${range(13).map(
          (r) =>
            `<td style="${cell}">${rounds.includes(r + 1) ? DIAMOND : ''}</td>`,
        )}
      </tr>
    `,
  );
  out.decTbl = html`
    <div class="tw">
      <table>
        <tr>
          <th>难度</th>
          ${range(13).map((r) => `<th style="${cell}">R${r + 1}</th>`)}
        </tr>
        ${rows}
      </table>
    </div>
    <div class="row" style="margin-top:8px">
      <span class="tag">◆ = 该回合结束后进入机变阶段</span>
    </div>
  `;
  return out;
}
