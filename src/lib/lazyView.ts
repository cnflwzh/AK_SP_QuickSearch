import { defineAsyncComponent, h, type Component } from 'vue';

/** Shared recovery for optional views. Reload is explicit so pagehide can flush pending drafts. */
export function lazyView(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({
    loader,
    loadingComponent: { render: () => h('div', { class: 'empty', role: 'status' }, '正在加载…') },
    errorComponent: {
      render: () => h('div', { class: 'route-message', role: 'alert' }, [
        '内容加载失败，请检查网络后重新加载。',
        h('button', { type: 'button', onClick: () => location.reload() }, '重新加载'),
      ]),
    },
  });
}
