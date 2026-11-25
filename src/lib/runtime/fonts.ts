const FONT_CACHE = 'wsq-font-local-v1';
const FAMILIES = [
  'Noto Sans SC',
  'ZCOOL QingKe HuangYou',
  'Saira Condensed',
] as const;
type Family = (typeof FAMILIES)[number];
type Samples = Map<Family, number[]>;

// A system-installed Noto may have the same name as the bundled one. Keep the
// document's chosen fallback stable even when the declaration sheet arrives late.
const screenFamily = (family: Family) => 'WSQ Screen ' + family;
function selectScreenFamilies() {
  const style = document.documentElement.style;
  const body = '"' + screenFamily('Noto Sans SC') + '",system-ui,sans-serif';
  style.setProperty('--fb', body);
  style.setProperty(
    '--fd',
    '"' + screenFamily('ZCOOL QingKe HuangYou') + '",' + body,
  );
  style.setProperty(
    '--fn',
    '"' + screenFamily('Saira Condensed') + '",' + body,
  );
}

interface Source {
  family: Family;
  url: string;
  descriptors: FontFaceDescriptors;
  /** Range left for later routes after excluding characters already on screen. */
  remaining: string;
  used: boolean;
}

/** Read text from the mounted app under its visibility mask, including form placeholders. */
function currentCharacters(): Samples {
  const points = new Map(FAMILIES.map((family) => [family, new Set<number>()]));
  const collect = (element: Element, value: string) => {
    if (!value.trim() || element.closest('script,style,noscript,#load-screen'))
      return;
    const stack = getComputedStyle(element).fontFamily;
    for (const [family, codes] of points) {
      if (stack.includes(family))
        for (const char of value) codes.add(char.codePointAt(0)!);
    }
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    if (node.parentElement) collect(node.parentElement, node.nodeValue || '');
  for (const input of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >('input,textarea'))
    collect(input, input.value || input.placeholder);
  return new Map(
    [...points].map(([family, codes]) => [
      family,
      [...codes].sort((a, b) => a - b),
    ]),
  );
}

/** Split each CSS unicode interval around the first screen's codepoints, retaining unseen glyphs. */
function remainingRange(
  range: string,
  codes: number[],
): {remaining: string; used: boolean} {
  if (!codes.length) return {remaining: range, used: false};
  const spans: string[] = [];
  let used = false;
  const span = (a: number, b: number) =>
    'U+' + a.toString(16) + (a === b ? '' : '-' + b.toString(16));
  for (const part of range.split(',')) {
    const [start, end] = part.trim().slice(2).split('-');
    let low = parseInt(start.replaceAll('?', '0'), 16);
    const high = parseInt((end || start).replaceAll('?', 'F'), 16);
    // Ranges and text are both sorted. Locate the first possibly overlapping codepoint.
    let left = 0,
      right = codes.length;
    while (left < right) {
      const mid = (left + right) >>> 1;
      if (codes[mid] < low) left = mid + 1;
      else right = mid;
    }
    if (left === codes.length || codes[left] > high) {
      spans.push(part);
      continue;
    }
    for (let i = left; i < codes.length && codes[i] <= high; i++) {
      used = true;
      if (low < codes[i]) spans.push(span(low, codes[i] - 1));
      low = codes[i] + 1;
    }
    if (low <= high) spans.push(span(low, high));
  }
  return {used, remaining: used ? spans.join(',') : range};
}

function sources(sheet: CSSStyleSheet, url: string, chars: Samples): Source[] {
  return [...sheet.cssRules].flatMap((rule) => {
    if (!(rule instanceof CSSFontFaceRule)) return [];
    const style = rule.style;
    const family = style
      .getPropertyValue('font-family')
      .replace(/["']/g, '') as Family;
    const sample = chars.get(family);
    const file = style
      .getPropertyValue('src')
      .match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!sample || !file) return [];
    const sourceUrl = new URL(file, url);
    if (sourceUrl.origin !== location.origin) return [];
    const unicodeRange =
      style.getPropertyValue('unicode-range') || 'U+0-10FFFF';
    return [
      {
        family,
        url: sourceUrl.href,
        descriptors: {
          weight: style.getPropertyValue('font-weight') || 'normal',
          style: style.getPropertyValue('font-style') || 'normal',
          unicodeRange,
          display: 'optional' as const,
        },
        ...remainingRange(unicodeRange, sample),
      },
    ];
  });
}

function addRemaining(source: Source, pendingBytes?: Promise<ArrayBuffer>) {
  if (!source.remaining) return;
  const register = (url: string) => {
    const face = new FontFace(
      screenFamily(source.family),
      'url("' + url + '")',
      {
        ...source.descriptors,
        // Initial glyphs were removed from this range. New text stays readable on
        // slow links and can use its downloaded face without changing the first screen.
        display: 'swap',
        unicodeRange: source.remaining,
      },
    );
    document.fonts.add(face);
    if (url !== source.url) {
      const release = () => URL.revokeObjectURL(url);
      void face.loaded.then(release, release);
    }
  };
  if (!pendingBytes) {
    register(source.url);
    return;
  }
  // The first visit may already be fetching this file for other glyphs. Reuse
  // those bytes lazily instead of issuing a second HTTP request for the same URL.
  void pendingBytes
    .then(
      (bytes) => {
        register(URL.createObjectURL(new Blob([bytes], {type: 'font/woff2'})));
      },
      () => register(source.url),
    )
    .catch(() => {});
}

/** Reuse a locally cached sheet even when the stylesheet request has not completed. */
async function cachedSheet(url: string): Promise<CSSStyleSheet | null> {
  try {
    const cached = await caches.match(url);
    if (cached?.ok) {
      const sheet = new CSSStyleSheet({baseURL: url});
      sheet.replaceSync(await cached.text());
      return sheet;
    }
  } catch {
    /* Restricted storage still permits normal stylesheet loading. */
  }
  return null;
}

async function downloadFont(url: string, cache?: Cache): Promise<Response> {
  const response = await fetch(url, {cache: 'force-cache'});
  if (
    !response.ok ||
    response.headers.get('Content-Type')?.includes('text/html')
  )
    throw new Error('Font download failed');
  if (cache && !navigator.serviceWorker?.controller)
    void cache.put(url, response.clone()).catch(() => {});
  return response;
}

/**
 * Select fonts once beneath the loading screen. Cached faces finish local decoding even
 * beyond the network budget. Cold downloads can still populate the next visit's cache.
 * Late faces cover only unseen characters, keeping previously displayed glyphs stable.
 */
export async function settleInitialFonts(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('#site-fonts');
  if (!link || !document.fonts) return;
  let expired = false;
  let timer = 0;
  const deadline = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => {
      expired = true;
      resolve(null);
    }, 700);
  });
  try {
    selectScreenFamilies();
    const initial = currentCharacters();
    const stylesheet = link.sheet
      ? Promise.resolve(link.sheet)
      : new Promise<CSSStyleSheet | null>((resolve) => {
          link.addEventListener('load', () => resolve(link.sheet), {
            once: true,
          });
          link.addEventListener('error', () => resolve(null), {once: true});
        });
    // A slow local CacheStorage read, like a slow cached font decode, is independent
    // of the network deadline. Offline reloads must see the same font selection.
    const sheet =
      link.sheet ||
      (await cachedSheet(link.href)) ||
      (await Promise.race([stylesheet, deadline]));
    let cache: Cache | undefined;
    try {
      cache = await caches.open(FONT_CACHE);
    } catch {
      /* HTTP cache only. */
    }
    if (!sheet) {
      // Keep the non-applying link. A slow CSS response can still serve a later route,
      // without suddenly changing any characters visible when the sheet arrives.
      void stylesheet
        .then(async (late) => {
          if (!late) return;
          const shown = currentCharacters();
          for (const family of FAMILIES)
            shown.set(
              family,
              [
                ...new Set([
                  ...(shown.get(family) || []),
                  ...(initial.get(family) || []),
                ]),
              ].sort((a, b) => a - b),
            );
          const faces = sources(late, link.href, shown);
          // The screen uses private family names. Explicit consumers such as canvas
          // posters can still request the original families from the regular CSS.
          link.media = 'all';
          const warming = new Map<string, Promise<ArrayBuffer>>();
          for (const source of faces) {
            if (source.used && !warming.has(source.url)) {
              const bytes = async () => {
                const hit = await cache
                  ?.match(source.url, {ignoreVary: true})
                  .catch(() => undefined);
                const response = hit?.ok
                  ? hit
                  : await downloadFont(source.url, cache);
                return response.arrayBuffer();
              };
              warming.set(source.url, bytes());
            }
            addRemaining(source, warming.get(source.url));
          }
          await Promise.allSettled(warming.values());
        })
        .catch(() => {});
      return;
    }
    const faces = sources(sheet, link.href, initial);
    link.media = 'all';
    const required = faces.filter((face) => face.used);
    const urls = [...new Set(required.map((source) => source.url))];
    const hits = new Map<string, Response>();
    await Promise.all(
      urls.map(async (url) => {
        const hit = await cache
          ?.match(url, {ignoreVary: true})
          .catch(() => undefined);
        if (hit?.ok) hits.set(url, hit);
      }),
    );
    const downloads = new Map<string, Promise<ArrayBuffer>>();
    const bytesFor = (url: string) => {
      let bytes = downloads.get(url);
      if (!bytes) {
        const hit = hits.get(url);
        bytes = hit
          ? hit.arrayBuffer()
          : downloadFont(url, cache).then((response) => response.arrayBuffer());
        downloads.set(url, bytes);
      }
      return bytes;
    };
    const ready = new Map<Source, FontFace>();
    const loads = required.map(async (source) => {
      try {
        const bytes = await bytesFor(source.url);
        if (expired && !hits.has(source.url)) return;
        const face = await new FontFace(
          screenFamily(source.family),
          bytes,
          source.descriptors,
        ).load();
        if (!expired || hits.has(source.url)) ready.set(source, face);
      } catch {
        if (hits.has(source.url))
          await cache?.delete(source.url).catch(() => {});
      }
    });
    await Promise.race([Promise.all(loads), deadline]);
    await Promise.all(loads.filter((_, i) => hits.has(required[i].url)));
    for (const source of faces) {
      const selected = ready.get(source);
      if (selected) document.fonts.add(selected);
      else
        addRemaining(
          source,
          hits.has(source.url) ? undefined : downloads.get(source.url),
        );
    }
  } catch {
    // Optional font APIs or storage failures must never strand the startup screen.
  } finally {
    clearTimeout(timer);
    document.documentElement.dataset.fonts = 'settled';
  }
}
