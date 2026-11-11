import { LEADERS, BOUNTIES, DECISION_ROUNDS } from '../../../data/index';
import { html, range, wan } from '../../lib/dom';
/** Format the joint-defense SVG; omit moving dots when reduced motion is requested. */
export function jointDefense(prefersReducedMotion: boolean) {
 const out: Record<string, string> = {};
  const PLAYERS: [string, string, boolean][] = [['玩家 A', '完美', true], ['玩家 B', '漏 3', false], ['玩家 C', '漏 5', false], ['玩家 D', '完美', true]];
  let s = '';
  PLAYERS.forEach(([name, result, perfect], i) => {
    const y = 30 + i * 52;
    const c = perfect ? 'var(--green)' : 'var(--red)';
    s += `<rect x="10" y="${y}" width="120" height="38" rx="5" fill="var(--surface)" stroke="${c}" stroke-width="1.5"/>`
      + `<text x="24" y="${y + 24}" style="fill:var(--ink);font-size:13px">${name}</text>`
      + `<text x="118" y="${y + 24}" text-anchor="end" style="fill:${c};font-size:12px">${result}</text>`;
  });
  s += '<rect x="360" y="40" width="150" height="150" rx="8" fill="var(--teal-soft)" stroke="var(--teal)"/>'
    + '<text x="435" y="66" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:700">联防战场</text>'
    + '<text x="435" y="86" text-anchor="middle" class="axl">漏怪合并</text>'
    + '<rect x="380" y="140" width="50" height="34" rx="4" fill="var(--surface)" stroke="var(--green)"/><text x="405" y="162" text-anchor="middle" style="fill:var(--ink);font-size:12px">A</text>'
    + '<rect x="440" y="140" width="50" height="34" rx="4" fill="var(--surface)" stroke="var(--green)"/><text x="465" y="162" text-anchor="middle" style="fill:var(--ink);font-size:12px">D</text>';

  // 漏怪的玩家：红点沿路径流入战场
  [1, 2].forEach(i => {
    const y = 49 + i * 52;
    s += `<path id="jp${i}" d="M132,${y} C250,${y} 280,110 400,110" fill="none" stroke="var(--red)" stroke-dasharray="4 4" opacity=".6"/>`;
    if (prefersReducedMotion) return;
    const leaked = i === 1 ? 3 : 5;
    for (let k = 0; k < leaked; k++) {
      s += `<circle r="4.5" fill="var(--red)"><animateMotion dur="2.6s" begin="${k * .45}s" repeatCount="indefinite"><mpath href="#jp${i}"/></animateMotion></circle>`;
    }
  });
  // 完美通关的玩家：绿线进入战场
  [0, 3].forEach(i => {
    const y = 49 + i * 52;
    s += `<path d="M132,${y} C240,${y} 300,${i ? 190 : 150} ${i ? 465 : 405},${i ? 176 : 138}" fill="none" stroke="var(--green)" stroke-width="1.5" marker-end="url(#ah)" opacity=".8"/>`;
  });
  out.joint = s;
return out.joint;
}
/** Format leader and hidden-core HP bars for the difficulty index. */
export function leaderHp(mode: number) {
 const out: Record<string, string> = {};
    const hiddenOf = (l: typeof LEADERS[number]) => mode > 0 && l.hiddenCore ? l.hiddenCore[mode - 1] : 0;
    // 满条长度：有隐秘核心的取隐秘核心，否则取领袖生命
    const max = Math.max(...LEADERS.map(l => (mode > 0 && l.hiddenCore) ? l.hiddenCore[mode - 1] : l.hp[mode]));
    out.ldr = LEADERS.slice().sort((a, b) => b.hp[mode] - a.hp[mode]).map(l => {
      const hp = l.hp[mode];
      const hidden = hiddenOf(l);
      return html`<span class="nm" data-key="name:${l.name}">${l.name}</span>
        <div class="tr" data-key="hp:${l.name}">
          ${hidden ? `<div class="h" data-key="hidden" style="width:${hidden / max * 100}%"></div>` : ''}
          <div class="m" data-key="main" style="width:${hp / max * 100}%"></div>
          <span class="v">${wan(hp)}${hidden ? ' · 核心 ' + wan(hidden) : ''}</span>
        </div>`;
    }).join('');
return out.ldr;
}
/** Return bounty and decision-round illustrations from the shared rules. */
export function enemyContent() {
 const out: Record<string, string> = {};
  const columns = range(6).map(funds => BOUNTIES.filter(b => b.funds === funds && b.when === '下场'));
  out.bty = columns.map((list, funds) =>
    `<div><div class="col">${list.map(b => `<span>${b.name}</span>`).join('')}</div><div class="h">${funds}</div></div>`).join('');

  const cell = 'text-align:center;padding:4px 2px';
  const DIAMOND = '<span style="display:inline-block;width:10px;height:10px;background:var(--accent);transform:rotate(45deg)"></span>';
  const rows = Object.entries(DECISION_ROUNDS).map(([mode, rounds]) => html`<tr>
    <td>${mode}</td>
    ${range(13).map(r => `<td style="${cell}">${rounds.includes(r + 1)
      ? DIAMOND
      : ''}</td>`)}
  </tr>`);
  out.decTbl = html`<div class="tw"><table>
    <tr><th>难度</th>${range(13).map(r => `<th style="${cell}">${r + 1}</th>`)}</tr>
    ${rows}
  </table></div>
  <div class="row" style="margin-top:6px"><span class="tag">◆ = 该回合结束后</span></div>`;
return out;
}
