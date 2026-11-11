/**
 * 「关于」弹窗：项目目的、数据来源、参考攻略与许可。两个页面共用。
 *   - 首次打开（或 ABOUT_VERSION 变化后）自动弹出一次
 *   - 页面上任何带 data-about 的元素点击后重新打开
 * 内容来自 data/credits.js。
 */
import {
  ABOUT_VERSION, REPO_URL, PURPOSE, WIKIS, UPLOADERS, FURTHER_READING, LICENSES, spaceUrl, videoUrl,
} from '../../data/credits.js';
import { esc, html } from './dom.js';

const STORAGE_KEY = 'wsq.about';

const seenVersion = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};
const markSeen = () => {
  try { localStorage.setItem(STORAGE_KEY, String(ABOUT_VERSION)); } catch { /* 隐私模式等情况下忽略 */ }
};

const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${text}</a>`;

const wikiItem = w => html`<li>
  <div class="ab-src">${link(w.url, `<b>${esc(w.name)}</b> ${esc(w.page)}`)}</div>
  <div class="ab-use">${esc(w.used)}</div>
</li>`;

const uploaderCard = u => html`<div class="ab-up">
  <div class="ab-uh">
    <b>${esc(u.name)}</b>
    ${link(spaceUrl(u.uid), `UID ${u.uid}`)}
  </div>
  <ul>${u.videos.map(v => html`<li>
    <div class="ab-src">${link(videoUrl(v.bv), esc(v.title))}<span class="ab-bv">${v.bv}</span></div>
    <div class="ab-use">${esc(v.used)}</div>
  </li>`)}</ul>
</div>`;

function render() {
  return html`<div class="ab-h">
    <div>
      <div class="kicker">ABOUT · 关于本项目</div>
      <h2>卫戍协议·规程 速查</h2>
    </div>
    <button type="button" class="ab-x" data-about-close aria-label="关闭">✕</button>
  </div>
  <div class="ab-b">
    <section>${PURPOSE.map(p => `<p>${esc(p)}</p>`)}</section>

    <section>
      <h3><i>01</i>数据来源</h3>
      <ul class="ab-list">${WIKIS.map(wikiItem)}</ul>
    </section>

    <section>
      <h3><i>02</i>流派参考 · B 站</h3>
      <p class="ab-note">流派页的阵容由本项目根据上方 Wiki 的盟约与干员数据整理；核心盟约、开局策略与打法关键词参考了以下 UP 主的攻略。完整运营思路请看原视频。</p>
      ${UPLOADERS.map(uploaderCard)}
    </section>

    <section>
      <h3><i>03</i>延伸阅读</h3>
      ${FURTHER_READING.map(uploaderCard)}
    </section>

    <section>
      <h3><i>04</i>许可</h3>
      <dl class="ab-lic">${LICENSES.map(([what, license]) => `<dt>${esc(what)}</dt><dd>${esc(license)}</dd>`)}</dl>
    </section>
  </div>
  <div class="ab-f">
    ${REPO_URL && link(REPO_URL, '源码与反馈')}
    <button type="button" class="ab-ok" data-about-close>开始使用</button>
  </div>`;
}

let dialog;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'about';
  dialog.setAttribute('aria-label', '关于本项目');
  dialog.innerHTML = render();
  const close = () => {
    markSeen();
    dialog.close();
  };
  dialog.addEventListener('click', e => {
    // 点关闭按钮，或点到弹窗外的遮罩
    if (e.target.closest('[data-about-close]') || e.target === dialog) close();
  });
  // Esc 键
  dialog.addEventListener('cancel', markSeen);
  document.body.appendChild(dialog);
  return dialog;
}

export function showAbout() {
  const d = ensureDialog();
  if (d.open) return;
  d.showModal();
  d.querySelector('.ab-b').scrollTop = 0;
  d.querySelector('.ab-ok').focus({ preventScroll: true });
}

/** 绑定 data-about 入口，并在首次访问时自动弹出 */
export function initAbout() {
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-about]')) return;
    e.preventDefault();
    showAbout();
  });
  if (seenVersion() !== String(ABOUT_VERSION)) showAbout();
}
