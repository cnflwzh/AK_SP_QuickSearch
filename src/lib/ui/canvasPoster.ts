/** 海报只在用户请求预览或导出时创建画布。绘制、异步编码成功、失败或取消均释放像素缓冲。 */
export async function renderCanvasPoster(
  draw: (context: CanvasRenderingContext2D) => Promise<Blob | null>,
): Promise<Blob | null> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('2d');
    return context ? await draw(context) : null;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

/** 按逻辑宽高设置画布与绘图比例。限制单边和总像素，预览最多约 6 MB、导出约 16 MB。返回实际逻辑到物理像素倍率。 */
export function sizePoster(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: 'preview' | 'export' = 'export',
): number {
  const budget = mode === 'preview' ? 1_500_000 : 4_000_000;
  const scale = Math.min(
    mode === 'preview' ? 1 : 2,
    Math.sqrt(budget / (width * height)),
    8192 / Math.max(width, height),
  );
  const {canvas} = context;
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  // 两边向下取整后仍使用同一倍率，图片与二维码都保持原始宽高比。
  const actualScale = Math.min(canvas.width / width, canvas.height / height);
  context.scale(actualScale, actualScale);
  return actualScale;
}

/** PNG 编码失败时浏览器可返回 null；由各入口决定错误提示。 */
export const posterPng = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

/** 等待同源海报素材，超时、取消或图片错误时返回 null，由调用方绘制占位内容。 */
export function loadPosterImage(
  src: string,
  timeout: number,
  signal?: AbortSignal,
): Promise<HTMLImageElement | null> {
  if (!src || signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (value: HTMLImageElement | null): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      image.onload = image.onerror = null;
      resolve(value);
    };
    const cancel = (): void => finish(null);
    const timer = setTimeout(cancel, timeout);
    signal?.addEventListener('abort', cancel, {once: true});
    image.onload = () => finish(image);
    image.onerror = cancel;
    image.src = src;
  });
}

/** 在点击时写入 PNG 或待生成的 PNG，保留移动浏览器的用户激活。 */
export async function copyPosterPng(
  blob: Blob | Promise<Blob>,
): Promise<'copied' | 'unsupported'> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write)
    return 'unsupported';
  try {
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    return 'copied';
  } catch {
    return 'unsupported';
  }
}
