import {onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef} from 'vue';
import {useRouter} from 'vue-router';
import {SEASON_META} from '../../../data/index.ts';
import {
  isLegacyOrigin,
  migrationEnabled,
  migrationPeer,
} from '../../lib/settings/domainMigration.ts';
import {
  mirrorEntry,
  mirrorPeer,
  mirrorTransferUrl,
  type MirrorDirection,
  type MirrorPeer,
} from '../../lib/settings/mirrorSite.ts';

const channel = 'wsq.mirror.backup.v1';
type ExportText = (migrating: boolean) => string | Promise<string>;
type Receive = (
  text: string,
  source: MirrorPeer,
  sourceSeason?: string,
) => void;
type Phase =
  MirrorDirection | 'command' | 'request' | 'backup' | 'exporting' | 'receipt';
interface Exchange {
  other: Window;
  peer: MirrorPeer;
  token: string;
  phase: Phase;
  child: boolean;
  migrating: boolean;
  remoteSeason?: string;
}

// 顶层迁移提示和设置页可能同时出现，同一窗口只允许一次交接。
const busy = ref(false);

function useExchange(exportText: ExportText, receive?: Receive) {
  const activeHere = ref(false);
  const message = ref('');
  const failed = ref(false);
  const recovery = shallowRef<MirrorPeer | null>(null);
  let exchange: Exchange | undefined;
  let timer: number | undefined;

  function finish(note: string, error = false) {
    if (exchange) {
      window.removeEventListener('message', onMessage);
      window.clearInterval(timer);
      exchange = undefined;
      activeHere.value = false;
      busy.value = false;
    }
    message.value = note;
    failed.value = error;
    recovery.value = null;
  }

  function detached(entry: NonNullable<typeof mirrorEntry>) {
    const {peer, direction} = entry;
    if (direction === 'fetch') {
      const file =
        peer.origin === migrationPeer(location.origin)?.origin
          ? '迁移备份文件'
          : '配置文件';
      finish(
        `无法将存档传回${peer.name}。请在这里下载${file}，再到${peer.name}导入。`,
        true,
      );
    } else {
      finish(
        `当前窗口未能连接到${peer.name}。可以在这里从${peer.name}取回存档。`,
        true,
      );
      recovery.value = peer;
    }
  }

  function post(active: Exchange, type: string, text?: string) {
    active.other.postMessage(
      {
        channel,
        token: active.token,
        type,
        text,
        ...(active.migrating ? {season: SEASON_META.id} : {}),
      },
      active.peer.origin,
    );
  }

  async function onMessage(event: MessageEvent) {
    const active = exchange;
    if (
      !active ||
      event.source !== active.other ||
      event.origin !== active.peer.origin
    )
      return;
    const data = event.data;
    if (data?.channel !== channel || data.token !== active.token) return;
    try {
      // 老版本没有握手赛季，接收时沿用备份自带赛季。新版从各自构建声明赛季，
      // 同一窗口若中途响应了另一份赛季数据，应中止而非用目标站的数据表解释它。
      if (active.migrating && data.season !== undefined) {
        if (
          typeof data.season !== 'string' ||
          !data.season ||
          data.season.length > 80 ||
          (active.remoteSeason && active.remoteSeason !== data.season)
        ) {
          throw new Error('对站赛季已变化，请重新打开交接窗口。');
        }
        active.remoteSeason = data.season;
      }
      if (data.type === 'error') {
        finish(
          typeof data.text === 'string'
            ? data.text.slice(0, 240)
            : '另一站未能完成交接。',
          true,
        );
      } else if (
        (data.type === 'ready' && active.phase === 'send') ||
        (data.type === 'request' &&
          (active.phase === 'request' || active.phase === 'command'))
      ) {
        // 标记后才序列化，防止重复 ready/request；延迟加载期间允许取消会话。
        active.phase = 'exporting';
        const text = await exportText(active.migrating);
        if (exchange !== active) return;
        active.phase = 'receipt';
        post(active, 'backup', text);
      } else if (data.type === 'ready' && active.phase === 'fetch') {
        active.phase = 'backup';
        post(active, 'request');
      } else if (
        data.type === 'backup' &&
        receive &&
        (active.phase === 'command' || active.phase === 'backup') &&
        typeof data.text === 'string'
      ) {
        receive(data.text, active.peer, active.remoteSeason);
        post(active, 'received');
        finish('');
        if (active.child) window.opener = null;
      } else if (data.type === 'received' && active.phase === 'receipt') {
        finish(`存档已送达${active.peer.name}，可在接收页继续。`);
        if (active.child) window.close();
      }
    } catch (cause) {
      // 已取消的异步导出失败时，不影响随后开启的另一场交接。
      if (exchange !== active) return;
      const note =
        cause instanceof Error ? cause.message : '存档交接失败，请重试。';
      try {
        post(active, 'error', note);
      } finally {
        finish(note, true);
      }
    }
  }

  function begin(active: Exchange) {
    exchange = active;
    busy.value = true;
    activeHere.value = true;
    failed.value = false;
    recovery.value = null;
    message.value = `正在连接${active.peer.name}，请保持两个页面打开。`;
    window.addEventListener('message', onMessage);
    const deadline = Date.now() + 45_000;
    timer = window.setInterval(() => {
      if (!active.other.closed && Date.now() < deadline) return;
      if (active.child && mirrorEntry) {
        detached(mirrorEntry);
      } else {
        const note =
          active.phase === 'send'
            ? `如果${active.peer.name}已在独立应用中打开，请在该应用的「站点间存档交接」中从本站取回存档。`
            : active.peer.origin === migrationPeer(location.origin)?.origin
              ? '也可以到存档所在站下载迁移备份，再回到接收站点「选择文件导入」。'
              : '也可以从存档所在站复制配置文本或导出配置文件，到接收站导入。';
        finish(`连接已中断。请允许浏览器打开新窗口后重试。${note}`, true);
      }
    }, 500);
  }

  function cancel() {
    if (!exchange) return;
    try {
      post(exchange, 'error', '另一页已结束本次交接。');
    } finally {
      finish('已结束本次交接。');
    }
  }

  function start(direction: MirrorDirection, peer: MirrorPeer | null) {
    if (!peer || busy.value || window.top !== window) return;
    try {
      const token = crypto.randomUUID();
      const url = mirrorTransferUrl(
        location.origin,
        peer.origin,
        direction,
        token,
      );
      if (!url) throw new Error('当前站点无法与这个网址交接存档。');
      const other = window.open(url, '_blank');
      if (!other)
        throw new Error('浏览器阻止了新窗口。请允许本站弹出窗口后重试。');
      begin({
        other,
        peer,
        token,
        phase: direction,
        child: false,
        migrating: peer.origin === migrationPeer(location.origin)?.origin,
      });
    } catch (cause) {
      finish(cause instanceof Error ? cause.message : '无法打开另一站。', true);
    }
  }

  function acceptEntry(entry: NonNullable<typeof mirrorEntry>) {
    if (busy.value) return;
    const other = window.opener as Window | null;
    if (!other || other.closed) {
      detached(entry);
      return;
    }
    // 旧版无方向链接才同时兼容两种命令；显式 send 的接收页不会响应反向导出请求。
    const phase =
      entry.direction === 'send'
        ? 'backup'
        : entry.direction === 'fetch'
          ? 'request'
          : 'command';
    const active: Exchange = {
      other,
      peer: entry.peer,
      token: entry.token,
      phase,
      child: true,
      migrating: entry.peer.origin === migrationPeer(location.origin)?.origin,
    };
    begin(active);
    post(active, 'ready');
  }

  onDeactivated(cancel);
  onBeforeUnmount(cancel);
  return {
    activeHere,
    busy,
    message,
    failed,
    recovery,
    start,
    cancel,
    finish,
    acceptEntry,
  };
}

/** 设置页交接界面；接收函数同步校验来自指定来源的文本，失败时抛错，由协议通知发送方。 */
export function useMirrorBackup(exportText: ExportText, receive: Receive) {
  const router = useRouter();
  const peer = window.top === window ? mirrorPeer(location.origin) : null;
  const migration =
    peer && migrationEnabled ? migrationPeer(location.origin) : null;
  const session = useExchange(exportText, receive);
  onMounted(() => {
    if (!mirrorEntry || location.hash !== '#mirror-backup=' + mirrorEntry.token)
      return;
    void router.replace({hash: ''});
    session.acceptEntry(mirrorEntry);
  });
  const {activeHere, busy, message, failed, recovery, start, cancel} = session;
  return {
    peer,
    migration,
    activeHere,
    busy,
    message,
    failed,
    recovery,
    start,
    cancel,
  };
}

/**
 * 旧站任意路由的迁移按钮。点击时同步开新窗，握手后调用 exportText 获取存档。
 * busy 为提示与设置页共享的锁，message/failed 仅反映本按钮发起的会话。
 */
export function useMigrationSender(exportText: ExportText) {
  const session = useExchange(exportText);
  const target =
    migrationEnabled && isLegacyOrigin(location.origin)
      ? migrationPeer(location.origin)
      : null;
  return {
    busy,
    activeHere: session.activeHere,
    message: session.message,
    failed: session.failed,
    cancel: session.cancel,
    start: () => session.start('send', target),
  };
}

/** 仅供退役页响应同地区新站的显式取回，不接受反向写入，也不主动打开窗口。 */
export function useRetiredBackupSource(exportText: ExportText) {
  const session = useExchange(exportText);
  onMounted(() => {
    if (
      !mirrorEntry ||
      !isLegacyOrigin(location.origin) ||
      mirrorEntry.direction !== 'fetch' ||
      mirrorEntry.peer.origin !== migrationPeer(location.origin)?.origin ||
      location.hash !== '#mirror-backup=' + mirrorEntry.token
    ) {
      session.finish('请从新网址的设置页重新取回存档。', true);
      return;
    }
    history.replaceState(history.state, '', '/settings');
    session.acceptEntry(mirrorEntry);
  });
  return {message: session.message, failed: session.failed, busy};
}
