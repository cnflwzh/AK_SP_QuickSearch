// 与 Service Worker 共用内容哈希缓存；不依赖可能与实际文件脱节的 localStorage 标记。
const FONT_CACHE = 'wsq-font-local-v1';
const NETWORK_FONT_BUDGET_MS = 700;
const FAMILIES = [
  'Noto Sans SC',
  'ZCOOL QingKe HuangYou',
  'Saira Condensed',
] as const;
type FontFamily = (typeof FAMILIES)[number];

// 一个字包覆盖全部已发布界面文字，包括首屏尚未出现的盟约和流派标题。
// 由 scripts/subset_interface_font.py 从本地原始字库生成，避免预载整套 92 个分片。
const INTERFACE_FONT_PREFIX = 'zcoolqingkehuangyou-ui-';

interface FontSource {
  face: FontFace;
  url: string;
  interfaceSubset: boolean;
}

/** 去掉 CSS 引号及空白差异，匹配 CSS 规则和浏览器 FontFace 描述。 */
function faceKey(
  family: string,
  weight: string,
  style: string,
  range: string,
): string {
  return [family.replace(/["']/g, ''), weight, style, range]
    .map((value) => value.replace(/\s/g, '').toLowerCase())
    .join('|');
}

function familyOf(face: FontFace): string {
  return face.family.replace(/["']/g, '');
}

/** 收集本站界面优先字包及首屏实际使用的其他分片，不下载未使用的字形。 */
function currentSources(): FontSource[] {
  const urls = new Map<string, string>();
  for (const sheet of document.styleSheets) {
    if (!sheet.href || new URL(sheet.href).pathname !== '/assets/css/fonts.css')
      continue;
    try {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const style = rule.style;
        const source = style
          .getPropertyValue('src')
          .match(/url\(["']?([^"')]+)["']?\)/)?.[1];
        if (!source) continue;
        const url = new URL(source, sheet.href);
        if (url.origin !== location.origin) continue;
        urls.set(
          faceKey(
            style.getPropertyValue('font-family'),
            style.getPropertyValue('font-weight') || 'normal',
            style.getPropertyValue('font-style') || 'normal',
            style.getPropertyValue('unicode-range') || 'U+0-10FFFF',
          ),
          url.href,
        );
      }
    } catch {
      /* 受限样式表不会阻止页面使用系统字体。 */
    }
  }
  return [...document.fonts].flatMap((face) => {
    if (!FAMILIES.includes(familyOf(face) as FontFamily)) return [];
    const url = urls.get(
      faceKey(face.family, face.weight, face.style, face.unicodeRange),
    );
    if (!url) return [];
    const interfaceSubset = new URL(url).pathname.startsWith(
      `/assets/fonts/${INTERFACE_FONT_PREFIX}`,
    );
    if (face.status === 'unloaded' && !interfaceSubset) return [];
    return [{face, url, interfaceSubset}];
  });
}

/** 从已下载的二进制创建独立字体族；只有展示前确认就绪的字体才加入文档。 */
function decodeFace(
  source: FontSource,
  bytes: ArrayBuffer,
): Promise<FontFace> {
  const original = source.face;
  const font = new FontFace(
    `WSQ Ready ${familyOf(original)}`,
    bytes,
    {
      weight: original.weight,
      style: original.style,
      stretch: original.stretch,
      unicodeRange: original.unicodeRange,
    },
  );
  return font.load();
}

/**
 * 在加载遮罩下冻结本次页面的字体选择。
 * 缓存命中的字体等待本地解码，不受网络预算限制；未缓存字体继续在后台下载并保存。
 * 返回后不再向显示用字体族添加字体，避免迟到的分片使可见文字换字体、改变布局。
 * 下载、缓存或字体解码失败时回退系统字体，不向页面初始化抛出异常。
 */
export async function settleInitialFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  void document.body.offsetHeight;
  const sources = currentSources();
  let cache: Cache | undefined;
  try {
    cache = await caches.open(FONT_CACHE);
  } catch {
    /* 隐私模式下仍可使用 HTTP 缓存。 */
  }

  const cached = new Map<string, Response>();
  await Promise.all(
    [...new Set(sources.map((source) => source.url))].map(async (url) => {
      try {
        const response = await cache?.match(url, {ignoreVary: true});
        if (response?.ok) cached.set(url, response);
      } catch {
        /* 单个缓存读取失败不影响其他字体。 */
      }
    }),
  );

  // 同一字体文件可能被多个字重引用，只读取/下载一次，避免并行重复请求。
  const downloads = new Map<string, Promise<ArrayBuffer>>();
  const scheduledWrites = new Set<string>();
  const bytesFor = (source: FontSource): Promise<ArrayBuffer> => {
    let download = downloads.get(source.url);
    if (!download) {
      download = (async () => {
        const hit = cached.get(source.url);
        if (hit) return hit.arrayBuffer();
        // 首屏分片复用 CSS 请求；界面字包优先于未使用的字体分片，
        // 不调用原始 face.load()，避免原字体在加载遮罩外发生迟到替换。
        if (source.face.status !== 'unloaded') await source.face.load();
        const response = await fetch(source.url, {
          cache: 'force-cache',
          priority: source.interfaceSubset ? 'high' : 'low',
        });
        if (!response.ok) throw new Error('Font download failed');
        return response.arrayBuffer();
      })();
      downloads.set(source.url, download);
    }
    return download;
  };

  const ready = new Map<FontFamily, FontFace[]>();
  const familyLoads = FAMILIES.map(async (family) => {
    const required = sources.filter(
      (source) => familyOf(source.face) === family,
    );
    if (!required.length) return;
    const loaded = await Promise.allSettled(
      required.map(async (source) => {
        try {
          const bytes = await bytesFor(source);
          const font = await decodeFace(source, bytes);
          // 相同文件的多个字重只需保存一次。写盘耗时不占用首屏的字体显示预算。
          if (
            cache &&
            !cached.has(source.url) &&
            !scheduledWrites.has(source.url)
          ) {
            scheduledWrites.add(source.url);
            const response = new Response(bytes, {
              headers: {'Content-Type': 'font/woff2'},
            });
            void cache.put(source.url, response).catch(() => {});
          }
          return font;
        } catch (error) {
          // 清除损坏的缓存，以便下次访问能够重新下载。
          try {
            if (cached.has(source.url)) await cache?.delete(source.url);
          } catch {
            /* 缓存可能已被浏览器清除。 */
          }
          throw error;
        }
      }),
    );
    if (loaded.every((result) => result.status === 'fulfilled')) {
      ready.set(
        family,
        loaded.map(
          (result) => (result as PromiseFulfilledResult<FontFace>).value,
        ),
      );
    }
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(familyLoads),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, NETWORK_FONT_BUDGET_MS);
    }),
  ]);
  clearTimeout(timeout);
  // 已缓存的一组不再与下载比赛，等待读取与解码完成，避免反复刷新碰时间窗口。
  await Promise.all(
    familyLoads.filter((_, index) => {
      const required = sources.filter(
        (source) => familyOf(source.face) === FAMILIES[index],
      );
      return (
        required.length > 0 &&
        required.every((source) => cached.has(source.url))
      );
    }),
  );
  for (const faces of ready.values())
    for (const face of faces) document.fonts.add(face);
  const stack = (family: FontFamily): string => {
    const families = ready.has(family) ? [`"WSQ Ready ${family}"`] : [];
    if (family !== 'Noto Sans SC' && ready.has('Noto Sans SC'))
      families.push('"WSQ Ready Noto Sans SC"');
    return [...families, 'system-ui', 'sans-serif'].join(',');
  };
  const root = document.documentElement;
  root.style.setProperty('--fb', stack('Noto Sans SC'));
  root.style.setProperty('--fd', stack('ZCOOL QingKe HuangYou'));
  root.style.setProperty('--fn', stack('Saira Condensed'));
  root.dataset.fonts = 'settled';
}
