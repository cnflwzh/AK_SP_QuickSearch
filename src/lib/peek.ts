/**
 * 速览卡片：干员 / 盟约 / 装备 / 策略的小卡片。
 *   - 鼠标：停留片刻显示，移开收起
 *   - 触屏：长按显示，松手后卡片保留，下一次点按任意位置收起；
 *     短按照常打开详情 / 跳转，滑动会取消长按
 *   - 识别规则见 resolve()：带 data-op / data-eq / data-st / data-cv 的元素，
 *     以及文字恰好是盟约名的 .cv 标签和效果文本里的 【盟约】（em.c）
 *   - 卡片用 popover 放进顶层，详情弹窗里的芯片也能正常显示
 * 两个页面共用，只依赖 data/。
 */
import {
  OPERATOR, EQUIP, STRATEGY, COVENANTS, TIER_LABELS, TIER_STATS, covenantColor, isCoreCovenant, rosterOf,
} from '../../data/index.ts';
import { esc, html } from './dom.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from './assets.ts';

const SHOW_DELAY = 280;      // 停留多久后显示（毫秒）
const SWITCH_DELAY = 60;     // 已有卡片时切换到另一个目标
const HIDE_DELAY = 100;
const GAP = 8;               // 卡片与目标的距离
const MARGIN = 8;            // 卡片与视口边缘的最小距离
const LONG_PRESS = 450;      // 触屏长按多久显示（比系统长按菜单略短）
const MOVE_TOLERANCE = 10;   // 长按期间手指移动超过这个距离视为滑动

/* ---------- 内容 ---------- */

const color = (name: string) => covenantColor(name, 'var(--teal)');

/** 效果文本：数字加粗，<时机> 和 【盟约】 上色 */
const fx = (text: string) => esc(text)
  .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
  .replace(/&lt;([^&]+?)&gt;/g, '<em class="pk-k">$1</em>')
  .replace(/【([^】]+)】/g, (_, name) => `<em class="pk-c" style="--c:${color(name)}">${name}</em>`);

const covenantTag = (name: string) => `<span class="pk-cv" style="--c:${color(name)}">${esc(name)}</span>`;

const picture = (src: string, className = '') => src
  ? `<img class="pk-pic ${className}" src="${src}" alt="" width="44" height="44">` : '';

const row = (label: string, text: string, accent = false) =>
  html`<div class="pk-row${accent ? ' a' : ''}"><span>${label}</span><div>${text}</div></div>`;

function operatorCard(name: string): string {
  const o = OPERATOR[name];
  const stats = TIER_STATS[o.tier - 1];
  return html`<div class="pk-h" data-t="${o.tier}">
    ${picture(avatarSrc(name))}
    <div>
      <div class="pk-meta"><i class="pk-tn">${TIER_LABELS[o.tier]}</i><span class="pk-stars">${'★'.repeat(o.stars)}</span><span>${esc(o.type)}</span></div>
      <b class="pk-name">${esc(name)}</b>
    </div>
  </div>
  <div class="pk-tags">${o.covenants.map(covenantTag)}</div>
  ${row('初始', fx(o.trait))}
  ${row('精锐', fx(o.elite), true)}
  <div class="pk-foot">${esc(stats.base)} → ${esc(stats.elite)}</div>`;
}

/** 盟约的两行效果（人数档 / 强化）；也用于速查页干员弹窗右侧的盟约列 */
export function covenantRows(name: string): string {
  const c = COVENANTS[name];
  const bonusHead = +(c.bonus?.match(/^(\d+)名/)?.[1] ?? 0);
  const bonusLabel = bonusHead ? `${bonusHead} 名` : '强化';
  const bonusText = (c.bonus || '').replace(/^\d+名(不同【[^】]+】)?[：:]?/, '');
  return html`${row(`${c.need} 人`, fx(c.effect))}
  ${c.bonus && row(bonusLabel, fx(bonusText), true)}`;
}

function covenantCard(name: string): string {
  return html`<div class="pk-h pk-cvh" style="--c:${color(name)}">
    <div>
      <div class="pk-meta"><span>${isCoreCovenant(name) ? '核心盟约' : '附加盟约'}</span><span>${rosterOf(name).length} 名干员</span></div>
      <b class="pk-name">${esc(name)}</b>
    </div>
  </div>
  ${covenantRows(name)}`;
}

function equipmentCard(name: string): string {
  const e = EQUIP[name];
  return html`<div class="pk-h" data-t="${e.tier}">
    ${picture(equipIconSrc(name), 'e')}
    <div>
      <div class="pk-meta"><i class="pk-tn">${TIER_LABELS[e.tier]}</i><span>${e.price} 资金</span></div>
      <b class="pk-name">${esc(name)}</b>
    </div>
  </div>
  ${e.covenant && `<div class="pk-tags">${covenantTag(e.covenant)}</div>`}
  ${row('基础', fx(e.effect))}
  ${e.advanced && row('进阶', fx(e.advanced), true)}`;
}

function strategyCard(name: string): string {
  const s = STRATEGY[name];
  return html`<div class="pk-h">
    ${picture(portraitSrc(name), 's')}
    <div>
      <div class="pk-meta"><span>${esc(s.category)}</span><span>初始生命 <b>${s.hp}</b></span></div>
      <b class="pk-name">${esc(name)}</b>
    </div>
  </div>
  ${row(esc(s.skill), fx(s.effect))}`;
}

/* ---------- 识别目标 ---------- */

const TARGET = '[data-op],[data-eq],[data-st],[data-cv],.cv,em.c';

/** 元素 → [卡片 HTML 生成函数, 名称]；不是可速览的目标时返回 null */
type CardContent = [render: (name: string) => string, name: string];
function resolve(el: HTMLElement): CardContent | null {
  const d = el.dataset;
  if (d.op) return OPERATOR[d.op] ? [operatorCard, d.op] : null;
  if (d.eq) return EQUIP[d.eq] ? [equipmentCard, d.eq] : null;
  if (d.st) return STRATEGY[d.st] ? [strategyCard, d.st] : null;
  const name = d.cv || (el.textContent || '').trim();
  return COVENANTS[name] ? [covenantCard, name] : null;
}

/* ---------- 显示与定位 ---------- */

const supportsPopover = typeof HTMLElement.prototype.showPopover === 'function';

let card: HTMLDivElement;
let current: HTMLElement | null = null;          // 当前（或即将）显示速览的元素
let showTimer: ReturnType<typeof setTimeout>;
let hideTimer: ReturnType<typeof setTimeout>;

function ensureCard() {
  if (card) return card;
  card = document.createElement('div');
  card.className = 'peek';
  card.setAttribute('role', 'tooltip');
  if (supportsPopover) card.popover = 'manual';
  document.body.appendChild(card);
  return card;
}

const isShown = () => !!card && card.classList.contains('on');

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

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
  let top = preferAbove ? above ?? below : below ?? above;
  let left;

  if (top !== undefined) {
    left = clamp(r.left, MARGIN, maxLeft);
  } else {
    top = clamp(r.top + r.height / 2 - h / 2, MARGIN, maxTop);
    if (r.right + GAP + w <= innerWidth - MARGIN) left = r.right + GAP;
    else if (r.left - GAP - w >= MARGIN) left = r.left - GAP - w;
    else left = clamp(r.left, MARGIN, maxLeft);   // 实在放不下：贴边显示
  }

  card.style.top = Math.max(MARGIN, top) + 'px';
  card.style.left = Math.max(MARGIN, left) + 'px';
}

function show(target: HTMLElement, [render, name]: CardContent, preferAbove = false) {
  ensureCard();
  card.innerHTML = render(name);
  if (supportsPopover) {
    // 重新 show 一次，保证排在刚打开的详情弹窗之上
    if (card.matches(':popover-open')) card.hidePopover();
    card.showPopover();
  } else {
    (target.closest('dialog[open]') || document.body).appendChild(card);
  }
  card.classList.add('on');
  place(target, preferAbove);
}

function hide() {
  clearTimeout(showTimer);
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
  const el = (e.target instanceof Element ? e.target.closest<HTMLElement>(TARGET) : null);
  if (!el || el.dataset.peek === 'off' || el.closest('.peek')) return null;
  const found = resolve(el);
  return found ? [el, found] : null;
}

/* ---------- 鼠标：悬停 ---------- */

function onPointerOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  const hit = targetOf(e);
  if (!hit) return;
  const [el, found] = hit;
  clearTimeout(hideTimer);
  if (el === current) return;
  current = el;
  clearTimeout(showTimer);
  showTimer = setTimeout(() => {
    if (current === el && el.isConnected) show(el, found);
  }, isShown() ? SWITCH_DELAY : SHOW_DELAY);
}

function onPointerOut(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !current) return;
  if (e.relatedTarget instanceof Node && current.contains(e.relatedTarget)) return;
  if (!(e.target instanceof Node) || !current.contains(e.target)) return;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, HIDE_DELAY);
}

/* ---------- 触屏：长按 ---------- */

let press: { x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;            // 正在进行的长按 { x, y, timer }
let swallowClick = false;    // 长按松手、或收起卡片的那次点按，不再触发点击

function cancelPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press = null;
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse') {
    hide();
    return;
  }
  swallowClick = false;
  cancelPress();
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
      press = null;
      current = el;
      swallowClick = true;
      show(el, found, true);
      navigator.vibrate?.(10);
    }, LONG_PRESS),
  };
}

function onPointerMove(e: PointerEvent) {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
}

function onClick(e: MouseEvent) {
  if (!swallowClick) return;
  swallowClick = false;
  e.preventDefault();
  e.stopPropagation();
}

/** 长按时不弹出系统菜单（Android 的上下文菜单） */
function onContextMenu(e: MouseEvent) {
  if (press || (isShown() && (e.target instanceof Element ? e.target.closest<HTMLElement>(TARGET) : null))) e.preventDefault();
}

/** Bind shared pointer interactions; return a disposer for HMR/unmount. */
export function initPeek(): () => void {
  const controller = new AbortController();
  const signal = controller.signal;
  document.addEventListener('pointerover', onPointerOver, { signal });
  document.addEventListener('pointerout', onPointerOut, { signal });
  document.addEventListener('pointerdown', onPointerDown, { capture: true, signal });
  document.addEventListener('pointermove', onPointerMove, { passive: true, signal });
  document.addEventListener('pointerup', cancelPress, { signal });
  document.addEventListener('pointercancel', cancelPress, { signal });
  document.addEventListener('click', onClick, { capture: true, signal });
  document.addEventListener('contextmenu', onContextMenu, { signal });
  document.addEventListener('keydown', hide, { capture: true, signal });
  addEventListener('scroll', () => { cancelPress(); hide(); }, { capture: true, signal });
  addEventListener('resize', hide, { signal });
  addEventListener('blur', hide, { signal });
  return () => { controller.abort(); cancelPress(); clearTimeout(hideTimer); hide(); card?.remove(); };
}
