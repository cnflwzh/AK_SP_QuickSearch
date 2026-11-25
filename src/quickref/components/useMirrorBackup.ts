import {onBeforeUnmount, onDeactivated, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {
  mirrorEntryDirection,
  mirrorEntryToken,
  mirrorPeer,
} from '../../lib/settings/mirrorSite.ts';

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
  const recovery = ref<'fetch' | 'manual' | null>(null);
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
    recovery.value = null;
  }
  function handleDetachedWindow() {
    if (!peer) return;
    const note =
      mirrorEntryDirection === 'fetch'
        ? `当前窗口无法将存档传回${peer.name}。可以在这里点「复制配置文本」，再回到${peer.name}点「粘贴文本导入」。存档较大时可用配置文件。`
        : mirrorEntryDirection === 'send'
          ? `当前窗口未能连接到${peer.name}。如果链接打开了已安装的 PWA，可以直接在这里取回存档。`
          : `当前窗口未能连接到${peer.name}。如果你刚从另一站点了「携带存档切换」，可以在这里取回存档。`;
    finish(note, true);
    recovery.value = mirrorEntryDirection === 'fetch' ? 'manual' : 'fetch';
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
    recovery.value = null;
    message.value = '正在连接另一站，请保持两个页面打开。';
    window.addEventListener('message', onMessage);
    const deadline = Date.now() + 45_000;
    timer = window.setInterval(() => {
      if (active.other.closed || Date.now() >= deadline) {
        if (active.child && active.phase === 'command') {
          handleDetachedWindow();
          return;
        }
        if (!active.child && active.phase === 'send' && peer) {
          finish(
            `连接已中断。如果${peer.name}已在独立应用中打开，请在该应用的「站点间存档交接」中从本站取回存档。也可以允许浏览器打开新窗口后重试。`,
            true,
          );
          return;
        }
        finish(
          '连接已中断。请允许浏览器打开新窗口后重试。若两端都打开了独立应用，可以从存档所在站复制配置文本，到接收站粘贴导入，或使用配置文件。',
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
      // 同步打开；查询参数只标识方向，保留旧版可识别的会话片段，存档仍只经 postMessage 传输。
      const other = window.open(
        `${peer.origin}/settings?mirror-action=${direction}#mirror-backup=${token}`,
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
    if (!window.opener || window.opener.closed) {
      handleDetachedWindow();
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
  return {peer, busy, message, failed, recovery, start, cancel};
}
