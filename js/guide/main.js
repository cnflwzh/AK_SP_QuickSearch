/**
 * 教程页入口（guide.html）
 *
 * 静态文字写在 guide.html 里，图表与交互由各章节模块填充到对应 id 的容器中。
 * 章节按页面顺序初始化。
 */
import { OPERATORS } from '../../data/index.js';
import { $, $$ } from '../lib/dom.js';
import { registerServiceWorker } from '../lib/pwa.js';
import { initAbout } from '../lib/about.js';
import { initPeek } from '../lib/peek.js';
import { decorateStaticChips } from './chips.js';
import { initBasics } from './chapters/01-basics.js';
import { initRecruit } from './chapters/02-recruit.js';
import { initEnemies } from './chapters/03-enemies.js';
import { initCovenants } from './chapters/04-covenants.js';
import { initBuilds } from './chapters/05-builds.js';
import { initDatabase } from './chapters/06-database.js';

decorateStaticChips();

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

initBasics();
initRecruit();
initEnemies();
initCovenants();
initBuilds();
initDatabase();

initPeek();
initAbout();
registerServiceWorker();
