/** 第 3 章 刷怪：特训敌人、漏怪动画、联防、领袖生命、悬赏与决策回合 */
import { TRAINING, LEADERS, BOUNTIES, DECISION_ROUNDS, MODES } from '../../../data/index.js';
import { $, html, range, wan, prefersReducedMotion } from '../../lib/dom.js';
import { whileVisible } from '../../lib/visibility.js';
import { mountSegmented } from '../chips.js';

const pickRandom = list => list[Math.floor(Math.random() * list.length)];

/** 3.1 每局随机 1 名领袖 + 3 类特训，每波只含其中 1 类。每 3.2 秒重抽一次 */
function trainingDemo() {
  const grid = $('#tr9');
  grid.innerHTML = TRAINING.map(t =>
    `<div><b>${t.name}</b><span style="font-size:11px;color:inherit;opacity:.75">${t.desc}</span></div>`).join('');
  const WAVE_COLORS = ['var(--teal)', 'var(--t4)', 'var(--t5)'];

  const shuffle = () => {
    const chosen = range(9).sort(() => Math.random() - .5).slice(0, 3);
    [...grid.children].forEach((c, i) => c.classList.toggle('on', chosen.includes(i)));
    $('#trLeader').textContent = '领袖：' + pickRandom(LEADERS).name;
    let waves = '';
    for (let r = 1; r <= 13; r++) {
      const k = Math.floor(Math.random() * 3);
      waves += `<div style="background:${WAVE_COLORS[k]}" title="R${r}">${TRAINING[chosen[k]].name}</div>`;
    }
    waves += '<div style="background:var(--red)">领袖</div>';
    $('#waves').innerHTML = waves;
  };
  shuffle();
  whileVisible(grid, () => { const timer = setInterval(shuffle, 3200); return () => clearInterval(timer); });
}

/** 3.2 漏怪动画：敌人从右向左走，被防线击倒或抵达目标扣血（每回合至多 10） */
function leakAnimation() {
  const svg = $('#leak');
  svg.innerHTML = '<rect class="lane" x="30" y="70" width="600" height="40" rx="4"/>'
    + '<rect class="base" x="10" y="62" width="26" height="56" rx="4"/>'
    + '<text class="lbl" x="23" y="134" text-anchor="middle">目标</text>'
    + [[320, 60], [320, 96], [350, 78]].map(([x, y]) => `<rect class="defn" x="${x}" y="${y}" width="22" height="22" rx="3"/>`).join('')
    + '<text class="lbl" x="340" y="150" text-anchor="middle">防线</text><text class="lbl" x="620" y="62" text-anchor="end">敌人出现 ◂</text>'
    + '<text class="lbl" x="40" y="26">目标生命</text><text class="lblb" id="lkHp" x="40" y="52">25</text>'
    + '<text class="lbl" x="150" y="26">本回合</text><text class="lblb" id="lkLost" x="150" y="52" style="fill:var(--red)">0</text><text class="lbl" x="196" y="52">/ 10</text>'
    + '<text class="lbl" x="470" y="26">作战时限</text><rect x="470" y="34" width="150" height="8" rx="4" fill="var(--surface2)" stroke="var(--line)"/>'
    + '<rect id="lkT" x="470" y="34" width="150" height="8" rx="4" fill="var(--accent)"/><g id="lkE"></g>';

  const layer = svg.querySelector('#lkE');
  const base = svg.querySelector('.base');
  const hpLabel = svg.querySelector('#lkHp'), lostLabel = svg.querySelector('#lkLost'), timeBar = svg.querySelector('#lkT');
  const ROUND_SECONDS = 8.5;
  const SPEED = 105;            // px / 秒
  const sim = { hp: 25, lost: 0, t: 0, enemies: [] };

  function newRound() {
    sim.lost = 0;
    sim.t = 0;
    layer.innerHTML = '';
    sim.enemies = range(14).map(i => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', 6);
      dot.setAttribute('cy', 82 + Math.random() * 16);
      dot.setAttribute('class', 'en');
      layer.appendChild(dot);
      return {
        x: 650 + i * 42,
        willDie: Math.random() < .62,      // 是否会被防线击倒
        dieAt: 300 + Math.random() * 70,
        dot,
        state: 'alive',                    // alive / killed / leaked
      };
    });
  }

  function leak() {
    if (sim.lost < 10) { sim.lost++; sim.hp--; }
    base.style.opacity = .4;
    setTimeout(() => { base.style.opacity = 1; }, 120);
  }

  const updateLabels = () => {
    if (hpLabel.textContent !== String(sim.hp)) hpLabel.textContent = sim.hp;
    if (lostLabel.textContent !== String(sim.lost)) lostLabel.textContent = sim.lost;
  };

  newRound();
  if (prefersReducedMotion) {
    sim.enemies.forEach((e, i) => {
      e.dot.setAttribute('cx', 60 + i * 40);
      if (e.willDie) e.dot.setAttribute('class', 'en k');
    });
    return;
  }

  let last = performance.now(), frameId;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    sim.t += dt;

    sim.enemies.forEach(e => {
      if (e.state !== 'alive') return;
      e.x -= SPEED * dt;
      if (e.willDie && e.x < e.dieAt) {
        e.state = 'killed';
        e.dot.setAttribute('class', 'en k');
      } else if (e.x <= 36) {
        e.state = 'leaked';
        e.dot.style.display = 'none';
        leak();
      }
      e.dot.setAttribute('cx', e.x);
    });
    timeBar.setAttribute('width', Math.max(0, 150 * (1 - sim.t / ROUND_SECONDS)));

    if (sim.t >= ROUND_SECONDS) {
      // 超时仍在场上的敌人也算漏怪
      sim.enemies.filter(e => e.state === 'alive' && e.x < 640).forEach(leak);
      if (sim.hp <= 8) sim.hp = 25;
      updateLabels();
      newRound();
    }
    updateLabels();
    frameId = requestAnimationFrame(frame);
  }
  whileVisible(svg, () => {
    last = performance.now();
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  });
}

/** 3.3 联防：完美通关者进入联防战场，清理其他人的漏怪 */
function jointDefense() {
  const PLAYERS = [['玩家 A', '完美', true], ['玩家 B', '漏 3', false], ['玩家 C', '漏 5', false], ['玩家 D', '完美', true]];
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
  $('#joint').innerHTML = s;
}

/** 3.4 领袖生命值，可切换难度；险境起显示隐秘核心 */
function leaderHp() {
  mountSegmented($('#ldseg'), MODES, 2, mode => {
    const hiddenOf = l => mode > 0 && l.hiddenCore ? l.hiddenCore[mode - 1] : 0;
    // 满条长度：有隐秘核心的取隐秘核心，否则取领袖生命
    const max = Math.max(...LEADERS.map(l => (mode > 0 && l.hiddenCore) ? l.hiddenCore[mode - 1] : l.hp[mode]));
    $('#ldr').innerHTML = LEADERS.slice().sort((a, b) => b.hp[mode] - a.hp[mode]).map(l => {
      const hp = l.hp[mode];
      const hidden = hiddenOf(l);
      return html`<span class="nm">${l.name}</span>
        <div class="tr">
          ${hidden ? `<div class="h" style="width:${hidden / max * 100}%"></div>` : ''}
          <div class="m" style="width:${hp / max * 100}%"></div>
          <span class="v">${wan(hp)}${hidden ? ' · 核心 ' + wan(hidden) : ''}</span>
        </div>`;
    }).join('');
  });
}

/** 3.5 悬赏资金分布 + 各难度决策回合 */
function bountiesAndDecisions() {
  const columns = range(6).map(funds => BOUNTIES.filter(b => b.funds === funds && b.when === '下场'));
  $('#bty').innerHTML = columns.map((list, funds) =>
    `<div><div class="col">${list.map(b => `<span>${b.name}</span>`).join('')}</div><div class="h">${funds}</div></div>`).join('');

  const cell = 'text-align:center;padding:4px 2px';
  const DIAMOND = '<span style="display:inline-block;width:10px;height:10px;background:var(--accent);transform:rotate(45deg)"></span>';
  const rows = Object.entries(DECISION_ROUNDS).map(([mode, rounds]) => html`<tr>
    <td>${mode}</td>
    ${range(13).map(r => `<td style="${cell}">${rounds.includes(r + 1)
      ? DIAMOND
      : ''}</td>`)}
  </tr>`);
  $('#decTbl').innerHTML = html`<div class="tw"><table>
    <tr><th>难度</th>${range(13).map(r => `<th style="${cell}">${r + 1}</th>`)}</tr>
    ${rows}
  </table></div>
  <div class="row" style="margin-top:6px"><span class="tag">◆ = 该回合结束后</span></div>`;
}

export function initEnemies() {
  trainingDemo();
  leakAnimation();
  jointDefense();
  leaderHp();
  bountiesAndDecisions();
}
