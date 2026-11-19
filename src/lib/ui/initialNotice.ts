import {shallowRef} from 'vue';

// 全站公告晚于首屏挂载。页面自己的首次引导等它关闭，以免同时弹出两层。
export const initialNoticeComplete = shallowRef(false);

/** 启动时的公告已处理，或公告加载失败，页面可以展示自己的引导。 */
export function finishInitialNotice(): void {
  initialNoticeComplete.value = true;
}
