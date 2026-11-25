/**
 * 速览卡片：在速查与教程正文中查看实体和术语。
 *   - 鼠标：停留片刻显示，移开收起
 *   - 键盘：聚焦入口显示，Escape 收起。正文中的独立术语也支持回车或空格。
 *   - 触屏：长按预览，滑动取消长按。短按独立术语显示解释，链接内短按继续跳转。
 *   - 卡片用 popover 放进顶层，详情弹窗里的芯片也能正常显示
 * 两个页面共用，只依赖 data/。
 */
import {
  OPERATOR,
  EQUIP,
  STRATEGY,
  LEADER,
  LEADERS,
  COVENANTS,
  ENEMY_GLOSSARY,
  MODES,
  TIER_LABELS,
  TIER_STATS,
  covenantColor,
  isCoreCovenant,
  rosterOf,
  type EnemyTerm,
} from '../../../data/index.ts';
import {esc, html, wan} from './dom.ts';
import {tokenizeTrait} from './traitText.ts';
import {
  findGlossaryTerm,
  GLOSSARY_KIND_LABELS,
  type GlossaryEntry,
} from '../glossary.ts';
import {
  avatarSrc,
  covenantIconHtml,
  covenantIconSrc,
  equipIconSrc,
  leaderSrc,
  portraitSrc,
} from './assets.ts';
import {
  abilityLabel,
  damageClass,
  leaderFx,
  resolveEnemyTerm,
} from '../leaders/leader.ts';

const SHOW_DELAY = 280; // 停留多久后显示（毫秒）
const SWITCH_DELAY = 60; // 已有卡片时切换到另一个目标
const HIDE_DELAY = 100;
const GAP = 8; // 卡片与目标的距离
const MARGIN = 8; // 卡片与视口边缘的最小距离
const LONG_PRESS = 450; // 触屏长按多久显示（比系统长按菜单略短）
const MOVE_TOLERANCE = 10; // 长按期间手指移动超过这个距离视为滑动
const TOOLTIP_ID = 'quickref-peek';

/* ---------- 内容 ---------- */

const color = (name: string) => covenantColor(name, 'var(--teal)');

/** 效果文本：数字加粗，<时机> 和 【盟约】 上色 */
const fx = (text: string) =>
  tokenizeTrait(text).map(part => {
    const label = esc(part.text);
    if (part.kind === 'trigger') return `<em class="pk-k">${label}</em>`;
    if (part.kind === 'covenant') return `<em class="pk-c" style="--c:${esc(color(part.text))}">${label}</em>`;
    if (part.kind === 'num') return `<b>${label}</b>`;
    return label;
  }).join('');

const covenantTag = (name: string) =>
  `<span class="pk-cv" style="--c:${color(name)}">${covenantIconHtml(name)}${esc(name)}</span>`;

const picture = (src: string, className = '') =>
  src
    ? `<img class="pk-pic ${className}" src="${src}" alt="" width="44" height="44">`
    : '';

const row = (label: string, text: string, accent = false) => html`
  <div class="pk-row${accent ? ' a' : ''}">
    <span>${label}</span>
    <div>${text}</div>
  </div>
`;

function operatorCard(name: string): string {
  const o = OPERATOR[name];
  const stats = TIER_STATS[o.tier - 1];
  return html`
    <div class="pk-h" data-t="${o.tier}">
      ${picture(avatarSrc(name))}
      <div>
        <div class="pk-meta">
          <i class="pk-tn">${TIER_LABELS[o.tier]}</i>
          <span class="pk-stars">${'★'.repeat(o.stars)}</span>
          <span>${esc(o.type)}</span>
        </div>
        <b class="pk-name">${esc(name)}</b>
      </div>
    </div>
    <div class="pk-tags">${o.covenants.map(covenantTag)}</div>
    ${row('初始', fx(o.trait))} ${row('精锐', fx(o.elite), true)}
    <div class="pk-foot">${esc(stats.base)} → ${esc(stats.elite)}</div>
  `;
}

/** 盟约的两行效果（人数档 / 强化）；也用于速查页干员弹窗右侧的盟约列 */
export function covenantRows(name: string): string {
  const c = COVENANTS[name];
  const bonusHead = +(c.bonus?.match(/^(\d+)名/)?.[1] ?? 0);
  const bonusLabel = bonusHead ? `${bonusHead} 名` : '强化';
  const bonusText = (c.bonus || '').replace(
    /^\d+名(不同【[^】]+】)?[：:]?/,
    '',
  );
  return html`
    ${row(`${c.need} 人`, fx(c.effect))}
    ${c.bonus && row(bonusLabel, fx(bonusText), true)}
  `;
}

function covenantCard(name: string): string {
  return html`
    <div class="pk-h pk-cvh" style="--c:${color(name)}">
      ${picture(covenantIconSrc(name), 'cv')}
      <div>
        <div class="pk-meta">
          <span>${isCoreCovenant(name) ? '核心盟约' : '附加盟约'}</span>
          <span>${rosterOf(name).length} 名干员</span>
        </div>
        <b class="pk-name">${esc(name)}</b>
      </div>
    </div>
    ${covenantRows(name)}
  `;
}

function equipmentCard(name: string): string {
  const e = EQUIP[name];
  return html`
    <div class="pk-h" data-t="${e.tier}">
      ${picture(equipIconSrc(name), 'e')}
      <div>
        <div class="pk-meta">
          <i class="pk-tn">${TIER_LABELS[e.tier]}</i>
          <span>${e.price} 资金</span>
        </div>
        <b class="pk-name">${esc(name)}</b>
      </div>
    </div>
    ${e.covenant && `<div class="pk-tags">${covenantTag(e.covenant)}</div>`}
    ${row('基础', fx(e.effect))}
    ${e.advanced && row('进阶', fx(e.advanced), true)}
  `;
}

function strategyCard(name: string): string {
  const s = STRATEGY[name];
  return html`
    <div class="pk-h">
      ${picture(portraitSrc(name), 's')}
      <div>
        <div class="pk-meta">
          <span>${esc(s.category)}</span>
          <span>
            初始生命
            <b>${s.hp}</b>
          </span>
        </div>
        <b class="pk-name">${esc(name)}</b>
      </div>
    </div>
    ${row(esc(s.skill), fx(s.effect))}
  `;
}

/** 领袖：四档生命值、能力，隐秘核心另起一段 */
function leaderCard(name: string): string {
  const l = LEADER[name];
  return html`
    <div class="pk-h pk-ldh">
      ${picture(leaderSrc(name), 'l')}
      <div>
        <div class="pk-meta">
          <span>领袖</span>
          ${l.damage.map((d) => `<i class="ldt ${damageClass(d)}">${d}</i>`)}
        </div>
        <b class="pk-name">${esc(name)}</b>
      </div>
    </div>
    <div class="pk-hp">
      ${MODES.map((mode, i) => `<span><i>${mode}</i><b>${wan(l.hp[i])}</b></span>`)}
    </div>
    ${l.abilities.map((a) => row(esc(abilityLabel(a.skill)), leaderFx(a.text)))}
    ${
      l.hiddenAbilities.length > 0 &&
      html`
        <div class="pk-hc">
          隐秘核心${l.hiddenCore && ` · 险境 ${wan(l.hiddenCore[0])} 起`}
        </div>
        ${l.hiddenAbilities.map((a) => row(esc(abilityLabel(a.skill, true)), leaderFx(a.text), true))}
      `
    }
  `;
}

const TERM_KIND_COLOR = {
  unit: 'var(--teal)',
  status: 'var(--red)',
  mechanic: 'var(--accent)',
  recruit: 'var(--accent)',
  lineup: 'var(--accent)',
};

function termCard(entry: EnemyTerm | GlossaryEntry): string {
  return html`
    <div class="pk-h pk-cvh" style="--c:${TERM_KIND_COLOR[entry.kind]}">
      <div>
        <div class="pk-meta">
          <span>${esc(GLOSSARY_KIND_LABELS[entry.kind])}</span>
        </div>
        <b class="pk-name">${esc(entry.term)}</b>
      </div>
    </div>
    <div class="pk-term-desc">${esc(entry.desc)}</div>
  `;
}

/* ---------- 识别目标 ---------- */

const TARGET =
  '[data-op],[data-eq],[data-st],[data-ld],[data-cv],[data-term],[data-glossary-term],.cv,em.c';

/** 元素 → [卡片 HTML 生成函数, 名称]；不是可速览的目标时返回 null */
type CardContent = [render: (name: string) => string, name: string];
function resolve(el: HTMLElement): CardContent | null {
  const d = el.dataset;
  if (d.glossaryTerm) {
    const entry = findGlossaryTerm(d.glossaryTerm);
    return entry ? [() => termCard(entry), entry.term] : null;
  }
  if (d.op) return OPERATOR[d.op] ? [operatorCard, d.op] : null;
  if (d.eq) return EQUIP[d.eq] ? [equipmentCard, d.eq] : null;
  if (d.st) return STRATEGY[d.st] ? [strategyCard, d.st] : null;
  if (d.ld) return LEADER[d.ld] ? [leaderCard, d.ld] : null;
  if (d.term) {
    const leaderName = el.closest<HTMLElement>('[data-leader]')?.dataset.leader;
    const entry = resolveEnemyTerm(d.term, ENEMY_GLOSSARY, LEADERS, leaderName);
    return entry ? [() => termCard(entry), entry.term] : null;
  }
  const name = d.cv || (el.textContent || '').trim();
  return COVENANTS[name] ? [covenantCard, name] : null;
}

/* ---------- 显示与定位 ---------- */

const supportsPopover = typeof HTMLElement.prototype.showPopover === 'function';

let card: HTMLDivElement;
let current: HTMLElement | null = null; // 当前（或即将）显示速览的元素
let showTimer: ReturnType<typeof setTimeout>;
let hideTimer: ReturnType<typeof setTimeout>;
let describedTarget: HTMLElement | null = null;
let keyboardTarget: HTMLElement | null = null;
let overPreview = false;
let previewBounds: DOMRectReadOnly | undefined;

function ensureCard() {
  if (card?.isConnected) return card;
  card = document.createElement('div');
  card.id = TOOLTIP_ID;
  card.className = 'peek';
  card.setAttribute('role', 'tooltip');
  if (supportsPopover) card.popover = 'manual';
  document.body.appendChild(card);
  return card;
}

const isShown = () => !!card && card.classList.contains('on');

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * 优先放在目标下方，其次上方（触屏优先上方，避开手指）；
 * 横屏小窗上下都放不下时放到左右两侧。
 */
function place(target: HTMLElement, preferAbove: boolean) {
  const r = target.getBoundingClientRect();
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const maxTop = innerHeight - MARGIN - h;
  const maxLeft = innerWidth - MARGIN - w;
  const below = r.bottom + GAP <= maxTop ? r.bottom + GAP : undefined;
  const above = r.top - GAP - h >= MARGIN ? r.top - GAP - h : undefined;
  let top = preferAbove ? (above ?? below) : (below ?? above);
  let left;

  if (top !== undefined) {
    left = clamp(r.left, MARGIN, maxLeft);
  } else {
    top = clamp(r.top + r.height / 2 - h / 2, MARGIN, maxTop);
    if (r.right + GAP + w <= innerWidth - MARGIN) left = r.right + GAP;
    else if (r.left - GAP - w >= MARGIN) left = r.left - GAP - w;
    else left = clamp(r.left, MARGIN, maxLeft); // 实在放不下：贴边显示
  }

  previewBounds = new DOMRect(Math.max(MARGIN, left), Math.max(MARGIN, top), w, h);
  card.style.top = previewBounds.top + 'px';
  card.style.left = previewBounds.left + 'px';
}

/** Remove only our description token; other help text belongs to the caller. */
function clearDescription(): void {
  if (!describedTarget) return;
  const ids = (describedTarget.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter((id) => id && id !== TOOLTIP_ID);
  if (ids.length)
    describedTarget.setAttribute('aria-describedby', ids.join(' '));
  else describedTarget.removeAttribute('aria-describedby');
  describedTarget = null;
}

function show(
  target: HTMLElement,
  [render, name]: CardContent,
  preferAbove = false,
  trigger = target,
) {
  ensureCard();
  clearDescription();
  card.innerHTML = render(name);
  if (supportsPopover) {
    // 重新 show 一次，保证排在刚打开的详情弹窗之上
    if (card.matches(':popover-open')) card.hidePopover();
    card.showPopover();
  } else {
    (target.closest('dialog[open]') || document.body).appendChild(card);
  }
  card.classList.add('on');
  card.classList.toggle('scrollable', card.scrollHeight > card.clientHeight);
  place(target, preferAbove);
  document.addEventListener('pointermove', trackPreviewHover, {passive: true});
  const ids = new Set(
    (trigger.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean),
  );
  ids.add(TOOLTIP_ID);
  trigger.setAttribute('aria-describedby', [...ids].join(' '));
  describedTarget = trigger;
}

function hide() {
  document.removeEventListener('pointermove', trackPreviewHover);
  overPreview = false;
  previewBounds = undefined;
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  clearDescription();
  keyboardTarget = null;
  current = null;
  if (!isShown()) return;
  card.classList.remove('on');
  if (supportsPopover && card.matches(':popover-open')) card.hidePopover();
}

/**
 * 事件目标 → [可速览的元素, resolve 结果]，不是目标时返回 null。
 * data-peek="off"：元素本身已展示了相同信息（如叠层条目），不弹卡片；其中的子芯片不受影响。
 */
function targetOf(e: Event): [HTMLElement, CardContent] | null {
  if (document.documentElement.dataset.peek === 'off') return null;
  const el =
    e.target instanceof Element ? e.target.closest<HTMLElement>(TARGET) : null;
  if (!el || el.dataset.peek === 'off' || el.closest('.peek')) return null;
  const found = resolve(el);
  return found ? [el, found] : null;
}

/* ---------- 鼠标：悬停 ---------- */

/** 展示卡可穿透点击，同时保留鼠标停在文字上阅读的时间。 */
function pointerOverPreview(e: PointerEvent): boolean {
  const rect = previewBounds;
  return !!rect && e.clientX >= rect.left && e.clientX < rect.right &&
    e.clientY >= rect.top && e.clientY < rect.bottom;
}

function trackPreviewHover(e: PointerEvent): void {
  if (e.pointerType !== 'mouse') return;
  const inside = pointerOverPreview(e);
  if (inside) clearTimeout(hideTimer);
  else if (overPreview && e.target instanceof Node && !current?.contains(e.target)) {
    if (targetOf(e)) onPointerOver(e);
    else {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_DELAY);
    }
  }
  overPreview = inside;
}

function onPointerOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  if (pointerOverPreview(e)) {
    clearTimeout(hideTimer);
    return;
  }
  const hit = targetOf(e);
  if (!hit) return;
  const [el, found] = hit;
  clearTimeout(hideTimer);
  if (el === current) return;
  keyboardTarget = null;
  current = el;
  clearTimeout(showTimer);
  showTimer = setTimeout(
    () => {
      if (current === el && el.isConnected) show(el, found);
    },
    isShown() ? SWITCH_DELAY : SHOW_DELAY,
  );
}

function onPointerOut(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !current) return;
  if (keyboardTarget === document.activeElement) return;
  if (e.relatedTarget && pointerOverPreview(e)) return;
  const insidePreview = (node: EventTarget | null) =>
    node instanceof Node && (current?.contains(node) || card?.contains(node));
  if (insidePreview(e.relatedTarget) || !insidePreview(e.target)) return;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, HIDE_DELAY);
}

/* ---------- 键盘：沿用现有链接 / 按钮的焦点 ---------- */

function onFocusIn(event: FocusEvent): void {
  const trigger = event.target;
  // Pointer clicks retain their existing behaviour; only keyboard focus opens a preview.
  if (!(trigger instanceof HTMLElement) || !trigger.matches(':focus-visible'))
    return;
  const hit = targetOf(event);
  if (!hit) return;
  hide();
  const [target, content] = hit;
  current = target;
  keyboardTarget = trigger;
  show(target, content, false, trigger);
}

function onFocusOut(event: FocusEvent): void {
  if (event.target === keyboardTarget) hide();
}

// 正文中可独立操作的词也可点按。卡片或导航链接内的词只接受悬停和长按，
// 短按与回车继续交给原来的控件。显式查词无需开启自动悬停预览。
function openInlineDefinition(event: Event, keyboard: boolean): boolean {
  const term =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-glossary-term][role="button"]')
      : null;
  if (!term) return false;
  const content = resolve(term);
  if (!content) return false;
  hide();
  current = term;
  if (keyboard) keyboardTarget = term;
  show(term, content);
  return true;
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isShown()) {
    hide();
    // Dismiss the preview first; a second Escape can close the underlying dialog.
    event.preventDefault();
    event.stopPropagation();
  } else if (event.key === 'Enter' || event.key === ' ') {
    if (openInlineDefinition(event, true)) {
      event.preventDefault();
      event.stopPropagation();
    } else hide();
  }
}

function onScroll(event: Event): void {
  if (event.target instanceof Node && card?.contains(event.target)) return;
  cancelPress();
  // Tabbing can scroll a card into view after focusin; retain and reposition its preview.
  if (keyboardTarget === document.activeElement && current && isShown())
    place(current, false);
  else hide();
}

/* ---------- 触屏：长按 ---------- */

let press: {x: number; y: number; timer: ReturnType<typeof setTimeout>} | null =
  null; // 正在进行的长按 { x, y, timer }
let swallowClick = false; // 长按松手、或收起卡片的那次点按，不再触发点击

function cancelPress() {
  if (!press) return;
  document.removeEventListener('pointermove', onPointerMove);
  clearTimeout(press.timer);
  press = null;
}

function onPointerDown(e: PointerEvent) {
  cancelPress();
  swallowClick = false;
  // 超高卡片保留原生滚动，点在其他位置才收起它。
  if (isShown() && e.target instanceof Node && card.contains(e.target)) return;
  // Wiki 链接使用浏览器原生点击与长按菜单，不消耗一次触摸来关闭速览。
  if (e.target instanceof Element && e.target.closest('[data-prts-link]')) {
    hide();
    return;
  }
  if (e.pointerType === 'mouse') {
    hide();
    return;
  }
  // 卡片开着时，这次点按只用来收起卡片
  if (isShown()) {
    hide();
    swallowClick = true;
    return;
  }
  const hit = targetOf(e);
  if (!hit) return;
  const [el, found] = hit;
  press = {
    x: e.clientX,
    y: e.clientY,
    timer: setTimeout(() => {
      cancelPress();
      current = el;
      swallowClick = true;
      show(el, found, true);
      navigator.vibrate?.(10);
    }, LONG_PRESS),
  };
  document.addEventListener('pointermove', onPointerMove, {passive: true});
}

function onPointerMove(e: PointerEvent) {
  if (
    press &&
    Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE
  )
    cancelPress();
}

function onClick(e: MouseEvent) {
  if (!(swallowClick && e.detail !== 0) && !openInlineDefinition(e, false)) return;
  swallowClick = false;
  e.preventDefault();
  e.stopPropagation();
}

/** 长按时不弹出系统菜单（Android 的上下文菜单） */
function onContextMenu(e: MouseEvent) {
  if (
    press ||
    (isShown() &&
      (e.target instanceof Element
        ? e.target.closest<HTMLElement>(TARGET)
        : null))
  )
    e.preventDefault();
}

/** Bind shared pointer and focus interactions; dispose listeners, descriptions and timers on unmount. */
export function initPeek(): () => void {
  const controller = new AbortController();
  const signal = controller.signal;
  document.addEventListener('pointerover', onPointerOver, {signal});
  document.addEventListener('pointerout', onPointerOut, {signal});
  document.addEventListener('pointerdown', onPointerDown, {
    capture: true,
    signal,
  });
  document.addEventListener('pointerup', cancelPress, {signal});
  document.addEventListener('pointercancel', () => {
    cancelPress();
    swallowClick = false;
  }, {signal});
  document.addEventListener('click', onClick, {capture: true, signal});
  document.addEventListener('contextmenu', onContextMenu, {signal});
  document.addEventListener('focusin', onFocusIn, {signal});
  document.addEventListener('focusout', onFocusOut, {signal});
  document.addEventListener('keydown', onKeyDown, {capture: true, signal});
  addEventListener('scroll', onScroll, {capture: true, signal});
  addEventListener('resize', hide, {signal});
  addEventListener('blur', hide, {signal});
  return () => {
    controller.abort();
    cancelPress();
    clearTimeout(hideTimer);
    hide();
    card?.remove();
  };
}
