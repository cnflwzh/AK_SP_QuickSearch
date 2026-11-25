import {onBeforeUnmount, onDeactivated, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {mirrorEntryToken, mirrorPeer} from '../../lib/settings/mirrorSite.ts';

const channel = 'wsq.mirror.backup.v1';
type Direction = 'send' | 'fetch';
type Phase = Direction | 'command' | 'backup' | 'receipt';
interface Exchange {
  other: Window;
  token: string;
  phase: Phase;
  child: boolean;
}

/**
 * 两个顶层设置页用一次性会话交接备份。由调用方提供序列化和接收函数；
 * 接收函数须同步校验备份，失败时抛出错误。收到回执表示接收页已处理备份或进入预览。
 */
export function useMirrorBackup(
  exportText: () => string,
  receive: (text: string) => void,
) {
  const router = useRouter();
  const peer = window.top === window ? mirrorPeer(location.origin) : null;
  const busy = ref(false);
  const message = ref('');
  const failed = ref(false);
  let exchange: Exchange | undefined;
  let timer: number | undefined;

  function stop() {
    window.removeEventListener('message', onMessage);
    window.clearInterval(timer);
    exchange = undefined;
    busy.value = false;
  }
  function finish(note: string, error = false) {
    stop();
    message.value = note;
    failed.value = error;
  }
  function post(type: string, text?: string) {
    if (!exchange || !peer) return;
    exchange.other.postMessage(
      {channel, token: exchange.token, type, text},
      peer.origin,
    );
  }
  function sendBackup() {
    const text = exportText();
    if (exchange) exchange.phase = 'receipt';
    post('backup', text);
  }
  function onMessage(event: MessageEvent) {
    const active = exchange;
    if (
      !active ||
      event.source !== active.other ||
      event.origin !== peer?.origin
    )
      return;
    const data = event.data;
    if (data?.channel !== channel || data.token !== active.token) return;
    try {
      if (data.type === 'error') {
        finish(
          typeof data.text === 'string'
            ? data.text.slice(0, 240)
            : '另一站未能完成交接。',
          true,
        );
      } else if (data.type === 'ready' && active.phase === 'send') {
        sendBackup();
      } else if (data.type === 'ready' && active.phase === 'fetch') {
        active.phase = 'backup';
        post('request');
      } else if (data.type === 'request' && active.phase === 'command') {
        sendBackup();
      } else if (
        data.type === 'backup' &&
        ['command', 'backup'].includes(active.phase) &&
        typeof data.text === 'string'
      ) {
        receive(data.text);
        post('received');
        finish('');
        if (active.child) window.opener = null;
      } else if (data.type === 'received' && active.phase === 'receipt') {
        finish('存档已送达另一站，可在接收页继续。');
        if (active.child) window.close();
      }
    } catch (cause) {
      const note =
        cause instanceof Error ? cause.message : '存档交接失败，请重试。';
      try {
        post('error', note);
      } finally {
        finish(note, true);
      }
    }
  }
  function begin(active: Exchange) {
    exchange = active;
    busy.value = true;
    failed.value = false;
    message.value = '正在连接另一站，请保持两个页面打开。';
    window.addEventListener('message', onMessage);
    const deadline = Date.now() + 45_000;
    timer = window.setInterval(() => {
      if (active.other.closed || Date.now() >= deadline) {
        finish(
          '连接已中断。请确认两个站点都能打开，并允许浏览器打开新窗口后重试。',
          true,
        );
      }
    }, 500);
  }
  function cancel() {
    if (!exchange) return;
    try {
      post('error', '另一页已结束本次交接。');
    } finally {
      finish('已结束本次交接。');
    }
  }
  function start(direction: Direction) {
    if (!peer || exchange) return;
    try {
      const token = crypto.randomUUID();
      // 必须在用户点击时同步打开。存档只经 postMessage 传输，链接中只有随机会话编号。
      const other = window.open(
        peer.origin + '/settings#mirror-backup=' + token,
        '_blank',
      );
      if (!other)
        throw new Error('浏览器阻止了新窗口。请允许本站弹出窗口后重试。');
      begin({other, token, phase: direction, child: false});
    } catch (cause) {
      finish(cause instanceof Error ? cause.message : '无法打开另一站。', true);
    }
  }
  onMounted(() => {
    if (
      !peer ||
      !mirrorEntryToken ||
      location.hash !== '#mirror-backup=' + mirrorEntryToken
    )
      return;
    void router.replace({hash: ''});
    if (!window.opener) {
      finish(
        '浏览器未保留与原站的窗口连接，请在同一浏览器中重试或使用配置文件。',
        true,
      );
      return;
    }
    begin({
      other: window.opener,
      token: mirrorEntryToken,
      phase: 'command',
      child: true,
    });
    post('ready');
  });
  onDeactivated(cancel);
  onBeforeUnmount(cancel);
  return {peer, busy, message, failed, start, cancel};
}
