const INITIAL_FONT_BUDGET_MS = 350;

/**
 * Settle the mounted page's current font requests before removing its loading overlay.
 * Only faces already needed by the rendered DOM are loaded. A slow font keeps downloading
 * for the next visit, while this document uses a stable system-font fallback after the deadline.
 * Resolves without throwing on failed font downloads; never waits beyond the font budget.
 */
export async function settleInitialFonts(): Promise<void> {
  if (!('fonts' in document)) return;

  // Vue has mounted, but the browser may not have resolved its font usage yet. One layout
  // here starts exactly those requests while the content is still behind the loading overlay.
  void document.body.offsetHeight;
  const pendingFaces = [...document.fonts].filter(face => face.status === 'loading');
  if (!pendingFaces.length) return;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const completed = await Promise.race([
    Promise.allSettled(pendingFaces.map(face => face.load())).then(() => true),
    new Promise<false>(resolve => { timeout = setTimeout(() => resolve(false), INITIAL_FONT_BUDGET_MS); }),
  ]);
  clearTimeout(timeout);
  if (!completed) document.documentElement.dataset.fonts = 'fallback';
}
