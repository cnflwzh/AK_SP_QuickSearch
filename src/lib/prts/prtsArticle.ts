import DOMPurify from 'dompurify';
import { operatorWikiUrl } from './prts.ts';

/** 来自 PRTS 公开解析接口的正文；html 仍需清理后才能用于展示。 */
export interface PrtsArticle {
  name: string;
  url: string;
  html: string;
}

interface ParseResponse {
  parse?: { title?: string; text?: { '*': string } };
  error?: { info?: string };
}

const CACHE_DURATION = 10 * 60_000;
const CACHE_LIMIT = 6;
const READER_SKIN = 'vector';
const articleCache = new Map<string, { article: PrtsArticle; savedAt: number }>();

/** 从指定的 PRTS 官方站点读取正文；网络、HTTP 或解析接口未返回正文时抛出错误。 */
async function requestArticle(origin: string, name: string, signal: AbortSignal, timeoutMs: number): Promise<PrtsArticle> {
  signal.throwIfAborted();
  const endpoint = new URL('/api.php', origin);
  endpoint.search = new URLSearchParams({
    action: 'parse', page: name, prop: 'text', format: 'json', origin: '*', redirects: '1',
    useskin: READER_SKIN,
  }).toString();
  const attempt = new AbortController();
  const cancel = () => attempt.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => attempt.abort(new DOMException('PRTS request timed out', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetch(endpoint, { credentials: 'omit', signal: attempt.signal });
    if (!response.ok) throw new Error(`PRTS returned HTTP ${response.status}`);
    const result = await response.json() as ParseResponse;
    const html = result.parse?.text?.['*'];
    if (typeof html !== 'string' || !html.trim()) throw new Error(result.error?.info || 'PRTS returned an empty article');
    return { name, url: operatorWikiUrl(result.parse?.title || name), html };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}

/**
 * 按完整干员名获取匿名公开正文，最近六篇在当前会话中缓存十分钟。
 * 主站最多等待九秒，失败时把二十秒总预算的余量留给官方移动站。
 * 切换干员或关闭阅读器时通过 signal 取消；网络或接口异常会抛出 Error。
 */
export async function fetchPrtsArticle(name: string, signal: AbortSignal): Promise<PrtsArticle> {
  signal.throwIfAborted();
  const cached = articleCache.get(name);
  if (cached && Date.now() - cached.savedAt < CACHE_DURATION) {
    articleCache.delete(name);
    articleCache.set(name, cached);
    return cached.article;
  }

  const deadline = performance.now() + 20_000;
  let article: PrtsArticle;
  try {
    article = await requestArticle('https://prts.wiki', name, signal, 9_000);
  } catch (error) {
    signal.throwIfAborted();
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw error;
    article = await requestArticle('https://m.prts.wiki', name, signal, remaining);
  }
  signal.throwIfAborted();
  articleCache.delete(name);
  articleCache.set(name, { article, savedAt: Date.now() });
  while (articleCache.size > CACHE_LIMIT) articleCache.delete(articleCache.keys().next().value!);
  return article;
}

function originalLink(document: Document, url: string, section: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'reader-original-link';
  link.href = `${url}#${encodeURIComponent(section)}`;
  link.textContent = `${label} ↗`;
  link.dataset.readerExternal = 'true';
  return link;
}

function normalizeLink(link: HTMLAnchorElement, articleUrl: string): void {
  const href = link.getAttribute('href');
  if (!href) return;
  try {
    const destination = new URL(href, articleUrl);
    if (!['https:', 'http:'].includes(destination.protocol)) {
      link.removeAttribute('href');
      return;
    }
    const article = new URL(articleUrl);
    if (!link.dataset.readerExternal && destination.origin === article.origin
      && destination.pathname === article.pathname && !destination.search && destination.hash) {
      // 保留原站 href 以支持复制链接和组合键；普通点击在阅读器内定位。
      link.dataset.readerAnchor = destination.hash.slice(1);
    }
    link.href = destination.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } catch {
    link.removeAttribute('href');
  }
}

/** 按完整章节移除档案和悖论模拟；包含其子标题，不影响下一个一级章节。 */
function removeExcludedSections(document: Document): void {
  for (const id of ['干员档案', '人员档案', '悖论模拟']) {
    const heading = document.getElementById(id)?.closest('h2');
    if (!heading) continue;
    const start = heading.closest('.mw-heading') ?? heading;
    let node: ChildNode | null = start;
    while (node) {
      if (node !== start && node instanceof Element && node.matches('h2, .mw-heading2')) break;
      const next: ChildNode | null = node.nextSibling;
      node.remove();
      node = next;
    }
  }
  // 目录跟随实际保留的章节，避免留下通往已移除内容的入口。
  for (const link of document.querySelectorAll<HTMLAnchorElement>('#toc a[href^="#"]')) {
    let id = link.getAttribute('href')!.slice(1);
    try { id = decodeURIComponent(id); } catch { /* 兼容原文未编码的锚点。 */ }
    if (!document.getElementById(id)) link.closest('li')?.remove();
  }
}

function renumberContents(list: Element, prefix = ''): void {
  [...list.children].forEach((item, index) => {
    const number = prefix ? `${prefix}.${index + 1}` : String(index + 1);
    const label = item.querySelector(':scope > a > .tocnumber');
    if (label) label.textContent = number;
    const nested = item.querySelector(':scope > ul');
    if (nested) renumberContents(nested, number);
  });
}

/** HTML 只携带本站样式。经过筛选的模板 CSS 由父页面在正文就绪后作为 CSS 文本应用。 */
export interface PrtsReaderDocument {
  html: string;
  templateCss: string;
}

/** 只保留 MediaWiki TemplateStyles 的展示规则，忽略导入、字体及未知规则。 */
function templateRules(parsed: Document): string {
  if (typeof CSSStyleSheet === 'undefined' || !CSSStyleSheet.prototype.replaceSync) return '';
  const sheet = new CSSStyleSheet();
  const rules: string[] = [];
  for (const style of parsed.querySelectorAll('style[data-mw-deduplicate]')) {
    if (!(style instanceof HTMLStyleElement) ||
        !/^TemplateStyles:r\d+$/.test(style.getAttribute('data-mw-deduplicate') ?? '')) continue;
    // 新建且未挂载的样式表不会加载 @import。仅允许普通规则及其媒体/支持查询。
    sheet.replaceSync(style.textContent ?? '');
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && !rule.cssRules?.length) rules.push(rule.cssText);
      else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
        const children = [...rule.cssRules].filter(
          (child): child is CSSStyleRule => child instanceof CSSStyleRule && !child.cssRules?.length,
        );
        if (children.length) rules.push(`@${rule instanceof CSSMediaRule ? 'media' : 'supports'} ${rule.conditionText}{${children.map(child => child.cssText).join('\n')}}`);
      }
    }
  }
  return rules.join('\n');
}

/**
 * PRTS 的范围格子通过 SVG use 引用当前图中的 rect。
 * 将局部图形引用展开后再清理，避免 base URL 和重复 ID 让格子引用到其他图或原站。
 * 只展开同一 SVG 内的静态形状，不加载外部引用或执行脚本。
 */
function inlineRangeShapes(document: Document): void {
  for (const svg of document.querySelectorAll('svg')) {
    const shapes = new Map([...svg.querySelectorAll('defs > [id]')].map(shape => [shape.id, shape]));
    for (const use of svg.querySelectorAll('use')) {
      const reference = use.getAttribute('href') ?? use.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      const shape = reference?.startsWith('#') ? shapes.get(reference.slice(1)) : undefined;
      if (!shape || !['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line'].includes(shape.localName)) {
        use.remove();
        continue;
      }
      const x = Number(use.getAttribute('x') ?? 0);
      const y = Number(use.getAttribute('y') ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        use.remove();
        continue;
      }
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      for (const attribute of ['fill', 'stroke', 'opacity', 'style']) {
        const value = use.getAttribute(attribute);
        if (value !== null) group.setAttribute(attribute, value);
      }
      group.setAttribute('transform', `${use.getAttribute('transform') ?? ''} translate(${x} ${y})`.trim());
      const copy = shape.cloneNode(true) as Element;
      copy.removeAttribute('id');
      group.append(copy);
      use.replaceWith(group);
    }
  }
}

/** 运算符直接使用文字，保留原文颜色，不再依赖原站的 Font Awesome / MDI 字体。 */
function replaceFormulaIcons(document: Document): void {
  const symbols = [
    { selector: '.fa-plus, .mdi-plus', text: '+' },
    { selector: '.fa-minus, .mdi-minus', text: '−' },
    { selector: '.fa-times, .mdi-close', text: '×' },
  ];
  for (const { selector, text } of symbols) {
    for (const icon of document.querySelectorAll<HTMLElement>(selector)) {
      const symbol = document.createElement('span');
      symbol.className = 'reader-math-symbol';
      symbol.textContent = text;
      symbol.style.color = icon.style.color;
      icon.replaceWith(symbol);
    }
  }
}

/**
 * 生成只含正文的隔离阅读文档。去掉原站脚本、导航和编辑入口，保留表格、图片及模板样式。
 * html 仅用于禁用脚本的 sandbox iframe；styles 是本站维护的阅读器 CSS。
 */
export function createPrtsReaderDocument(article: PrtsArticle, styles: string, topInset: number): PrtsReaderDocument {
  const parsed = new DOMParser().parseFromString(article.html, 'text/html');
  removeExcludedSections(parsed);
  inlineRangeShapes(parsed);
  replaceFormulaIcons(parsed);
  const templateCss = templateRules(parsed);

  parsed.querySelectorAll('.mw-editsection, .ak-pathnav, .prts-pathnav2, .navbox, .catlinks, .printfooter, .charimg-m, #equip-selector')
    .forEach(element => element.remove());
  parsed.querySelectorAll('.charinfo-container').forEach(element =>
    element.replaceWith(originalLink(parsed, article.url, '干员信息', '立绘与干员信息')));
  parsed.querySelectorAll('#calc').forEach(element =>
    element.replaceWith(originalLink(parsed, article.url, '属性', '属性计算器')));
  parsed.querySelectorAll('#spine-root').forEach(element =>
    element.replaceWith(originalLink(parsed, article.url, '动态形象', '动态形象')));

  const toc = parsed.getElementById('toc');
  if (toc) {
    const list = toc.querySelector('ul');
    const contents = parsed.createElement('details');
    contents.className = 'reader-contents';
    const summary = parsed.createElement('summary');
    summary.textContent = '目录';
    contents.append(summary);
    if (list) {
      renumberContents(list);
      contents.append(list);
    }
    toc.replaceWith(contents);
  }

  // 仅识别已知的两组文本切换声明，不执行或保留原站的内联 JavaScript。
  for (const input of parsed.querySelectorAll<HTMLInputElement>('input[type="checkbox"][onchange]')) {
    const toggle = /^switchDisplay([\p{L}\p{N}_]+)\(this\)$/u.exec(input.getAttribute('onchange') ?? '');
    if (toggle) input.dataset.readerToggle = toggle[1];
  }
  for (const tooltip of parsed.querySelectorAll<HTMLElement>('.mc-tooltips')) {
    const content = [...tooltip.children].find(child => child instanceof HTMLElement && child.style.display === 'none');
    if (!content) continue;
    tooltip.setAttribute('title', content.textContent?.trim() ?? '');
    tooltip.dataset.readerTooltip = 'true';
    tooltip.tabIndex = 0;
    tooltip.setAttribute('role', 'button');
    tooltip.setAttribute('aria-expanded', 'false');
    (content as HTMLElement).dataset.readerTip = 'true';
  }
  parsed.querySelectorAll('.mw-collapsible').forEach(element => element.classList.remove('mw-collapsed'));
  for (const image of parsed.images) {
    image.loading = 'lazy';
    image.decoding = 'async';
    const src = image.getAttribute('src');
    if (src) {
      try { image.src = new URL(src, article.url).href; } catch { image.removeAttribute('src'); }
    }
  }
  for (const link of parsed.querySelectorAll<HTMLAnchorElement>('a[href]')) normalizeLink(link, article.url);

  const body = DOMPurify.sanitize(parsed.body, {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: ['script', 'style', 'link', 'meta', 'base', 'iframe', 'object', 'embed', 'form', 'canvas'],
    FORBID_ATTR: ['autofocus', 'srcdoc', 'formaction', 'ping'],
    ADD_ATTR: ['target'],
  });
  const document = new DOMParser().parseFromString('<!doctype html><html lang="zh-CN"><head></head><body class="mediawiki skin-vector"><main id="content"><div id="mw-content-text"></div></main></body></html>', 'text/html');
  document.title = `${article.name} · PRTS Wiki`;
  document.documentElement.dataset.prtsArticle = article.name;
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https://prts.wiki https://static.prts.wiki; img-src https://prts.wiki https://*.prts.wiki data:; font-src https://prts.wiki https://*.prts.wiki; media-src https://prts.wiki https://*.prts.wiki; base-uri https://prts.wiki; form-action 'none'";
  const base = document.createElement('base');
  base.href = article.url;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `https://prts.wiki/load.php?lang=zh-cn&modules=site.styles&only=styles&skin=${READER_SKIN}`;
  document.head.append(policy, base, stylesheet);
  const readerStyle = document.createElement('style');
  readerStyle.textContent = styles;
  document.head.append(readerStyle);
  document.documentElement.style.setProperty('--reader-top', `${Math.max(0, topInset)}px`);
  document.getElementById('mw-content-text')!.replaceChildren(body);
  const credit = document.createElement('footer');
  credit.className = 'reader-credit';
  const source = originalLink(document, article.url, '', 'PRTS Wiki 原文');
  normalizeLink(source, article.url);
  credit.append(source);
  document.getElementById('content')!.append(credit);
  return { html: `<!doctype html>${document.documentElement.outerHTML}`, templateCss };
}
