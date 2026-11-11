/**
 * 教程页入口（guide.html）
 *
 * 静态文字写在 guide.html 里，图表与交互由各章节模块填充到对应 id 的容器中。
 * 章节接近视口、或用户点击目录时才加载。
 */
import { OPERATORS } from '../../data/index.js';
import { $, $$ } from '../lib/dom.js';
import { initPeek } from '../lib/peek.js';
import { decorateStaticChips } from './chips.js';

/* 页头数字 */
$('#kpis').innerHTML = [
  ['14', '回合 + ??'], ['8', '部署上限'], ['3→1', '合成精锐'],
  ['6', '级调度中心'], ['26', '盟约'], [OPERATORS.length, '干员'],
].map(([value, label]) => `<div class="kpi"><b>${value}</b><span>${label}</span></div>`).join('');

/* 滚动时高亮当前章节的导航链接 */
const links = $$('#nav a');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('.chap').forEach(section => observer.observe(section));

initPeek();

const chapters = {
  c1: () => import('./chapters/01-basics.js').then(m => m.initBasics()),
  c2: () => import('./chapters/02-recruit.js').then(m => m.initRecruit()),
  c3: () => import('./chapters/03-enemies.js').then(m => m.initEnemies()),
  c4: () => import('./chapters/04-covenants.js').then(m => m.initCovenants()),
  c5: () => import('./chapters/05-builds.js').then(m => m.initBuilds()),
  c6: () => import('./chapters/06-database.js').then(m => m.initDatabase()),
};
const pending = new Map();

/** 同一章节只初始化一次；失败时允许用户重试，不影响其他已加载章节。 */
function loadChapter(section) {
  if (pending.has(section.id)) return pending.get(section.id);
  section.setAttribute('aria-busy', 'true');
  const task = chapters[section.id]().then(() => {
    decorateStaticChips(section);
    section.dataset.loaded = 'true';
    section.removeAttribute('aria-busy');
    section.querySelector('.chapter-retry')?.remove();
  }).catch(error => {
    pending.delete(section.id);
    section.removeAttribute('aria-busy');
    if (!section.querySelector('.chapter-retry')) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn chapter-retry';
      retry.textContent = '重新加载本章';
      retry.onclick = () => loadChapter(section);
      section.querySelector('.chap-h').after(retry);
    }
    console.error('Chapter initialization failed', section.id, error);
  });
  pending.set(section.id, task);
  return task;
}

const nearby = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      nearby.unobserve(entry.target);
      loadChapter(entry.target);
    }
  }
}, { rootMargin: '240px 0px' });

// 直接打开 #c4 / #s44 等锚点时，也先初始化目标章节，保留目录跳转体验。
const hashSection = () => document.getElementById(location.hash.slice(1))?.closest('.chap');
const initial = new Set([hashSection()].filter(Boolean));
for (const section of $$('.chap')) {
  const rect = section.getBoundingClientRect();
  if (initial.has(section) || (rect.top < innerHeight + 240 && rect.bottom > -240)) initial.add(section);
  else nearby.observe(section);
}
document.getElementById('nav').addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  const section = link && document.getElementById(link.hash.slice(1))?.closest('.chap');
  if (section) loadChapter(section);
});
addEventListener('hashchange', () => {
  const section = hashSection();
  if (section) loadChapter(section);
});
await Promise.all([...initial].map(loadChapter));
