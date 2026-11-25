import {onBeforeUnmount, onDeactivated, shallowRef} from 'vue';

/** 预览 URL 与文档快照一同替换。切换图片、离开缓存页面或卸载时释放旧 URL。 */
export function usePosterPreview<T extends object>() {
  const poster = shallowRef<(T & {url: string}) | null>(null);

  function clearPreview(): void {
    if (poster.value) URL.revokeObjectURL(poster.value.url);
    poster.value = null;
  }
  function setPreview(blob: Blob, metadata: T): void {
    const url = URL.createObjectURL(blob);
    clearPreview();
    poster.value = {...metadata, url};
  }

  onDeactivated(clearPreview);
  onBeforeUnmount(clearPreview);
  return {poster, setPreview, clearPreview};
}
