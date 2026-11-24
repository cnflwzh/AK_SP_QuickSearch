/** 第 5 章 热门流派：核心盟约流派面板 + 进阶变阵混搭流 */
import {
  CORE_BUILDS,
  COVENANTS,
  MIXED_BUILDS,
  OPERATOR,
  TIERS,
  TIER_LABELS,
  lineupCovenantCount,
  rosterOf,
} from '../../../data/index.ts';
import {esc, html, range} from '../../lib/ui/dom.ts';
import {glossaryHtml} from '../../lib/ui/glossaryText.ts';
import {avatar, color, cv, emblem, eq, op, st} from '../chips.ts';
import {iconSvg} from '../icons.ts';

function sparkline(name: string) {
  const main = COVENANTS[name].scaling[0];
  if (!main) return '';
  const f = main.at;
  const values = range(151).map(f);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map(
    (v, x) =>
      `${((x / 150) * 300).toFixed(1)},${(56 - ((v - min) / (max - min || 1)) * 50).toFixed(1)}`,
  );
  return html`
    <div class="spark-box">
      <div class="spark-top">
        <span>${esc(main.label)}成长曲线</span>
        <span>0 → 150 层</span>
      </div>
      <svg
        class="spark"
        viewBox="0 0 300 60"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false">
        <path class="a" d="M0,60 L${points.join(' L')} L300,60Z" />
        <path d="M${points.join(' L')}" />
      </svg>
      <div class="spark-foot">
        <span>0 层 · ${Math.round(f(0))}${main.unit}</span>
        <span>150 层 · ${Math.round(f(150))}${main.unit}</span>
      </div>
    </div>
  `;
}

/** Format the selected core build while retaining card keys across tab changes. */
export function drawBuild(name: string) {
  const out: Record<string, string> = {};
  const build = CORE_BUILDS[name];
  const roster = rosterOf(name);
  const covenant = COVENANTS[name];

  const tierRows = TIERS.map((tier) => {
    const list = roster.filter((o) => o.tier === tier);
    if (!list.length) return '';
    return html`
      <div class="tr" data-key="${tier}">
        <i data-t="${tier}">${TIER_LABELS[tier]}</i>
        <div class="row">
          ${list.map((o) =>
            op(o.name, build.lineup.includes(o.name) ? 'hl' : ''),
          )}
        </div>
      </div>
    `;
  }).join('');

  const lineup = build.lineup.map((n) => {
    const tier = OPERATOR[n].tier;
    const alts = build.alternatives?.[n];
    return html`
      <div
        class="${build.carries.includes(n) ? 'c' : ''}"
        data-key="${esc(n)}"
        data-op="${esc(n)}"
        data-t="${tier}">
        ${avatar(n)}
        <i>${TIER_LABELS[tier]}</i>
        <b>${esc(n)}</b>
        ${
          alts?.length
            ? `<span class="alt-hint">过渡/替：${esc(alts.join('·'))}</span>`
            : ''
        }
      </div>
    `;
  });

  out.bpanel = html`
    <div class="bp" style="--c:${color(name)}">
      <div class="bp-h">
        <div class="bp-title">
          ${emblem(name, 46)}
          <div>
            <div class="row" style="gap:10px">
              <h3>${esc(name)}</h3>
              <a class="qlink" href="/builds/${esc(covenant.id)}">
                打开流派 ${iconSvg('link', 'g-ic sm')}
              </a>
            </div>
            <div class="tg">${esc(build.tagline)}</div>
          </div>
        </div>
        ${sparkline(name)}
      </div>
      <div class="bp-grid">
        <div>
          <p class="lab">本阵营全干员（高亮为终盘推荐）</p>
          <div class="tierrows">${tierRows}</div>
          <p class="lab" style="margin-top:16px">核心盟约基础与 6 人质变</p>
          <div style="font-size:13px;color:var(--ink2)">
            ${glossaryHtml(covenant.effect)}
          </div>
          <div style="font-size:13px;margin-top:4px;font-weight:500">
            ${glossaryHtml(covenant.bonus)}
          </div>
        </div>
        <div>
          <p class="lab">成型 8 人阵容（悬停/长按头像看特质）</p>
          <div class="fin">${lineup}</div>
          <p class="lab" style="margin-top:16px">前中后期三步公式化运营</p>
          <ol class="steps">
            ${build.tips.map((t) => `<li>${glossaryHtml(t)}</li>`)}
          </ol>
          <p class="lab" style="margin-top:16px">
            搭配附加盟约（阵容人数 / 门槛）
          </p>
          <div class="row">
            ${build.addons.map((n) => {
              const cnt = lineupCovenantCount(build.lineup, n);
              const need = COVENANTS[n].need;
              return html`
                <span class="row" data-key="${esc(n)}">
                  ${cv(n)}
                  <span class="tag ${cnt >= need ? 't' : ''}">
                    ${cnt} / ${need}${cnt >= need ? ' ✔' : ''}
                  </span>
                </span>
              `;
            })}
          </div>
          <p class="lab" style="margin-top:12px">推荐开局策略</p>
          <div class="row">${build.strategies.map(st)}</div>
          <p class="lab" style="margin-top:12px">优先抓取装备</p>
          <div class="row">${build.equipment.map((n) => eq(n))}</div>
        </div>
      </div>
    </div>
  `;
  return out.bpanel;
}

/** Format the shared mixed-build recommendations without modifying their data. */
export function mixedBuilds() {
  const out: Record<string, string> = {};
  out.hyb = MIXED_BUILDS.map(
    (b) => html`
      <div class="card">
        <div class="hyb-head">
          <div>
            <h5>${esc(b.name)}</h5>
            <div class="sub">${esc(b.tagline)}</div>
          </div>
          <a class="qlink" href="/builds/${esc(b.id)}">
            打开流派 ${iconSvg('link', 'g-ic sm')}
          </a>
        </div>
        <div class="row">
          ${b.lineup.map((n) => op(n, b.carries?.includes(n) ? 'hl' : ''))}
        </div>
        <div class="row mt">${b.strategies.map(st)}</div>
        <div class="row mt">${b.equipment.map((n) => eq(n))}</div>
        <ol class="steps mt" style="--c:var(--accent)">
          ${b.tips.map((t) => `<li>${glossaryHtml(t)}</li>`)}
        </ol>
      </div>
    `,
  ).join('');
  return out.hyb;
}
