/** 命中安装白名单后显示的设备名、标题和操作步骤。 */
export interface InstallGuide {
  title: string;
  device: string;
  steps: string[];
}

type BrowserIdentity = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
  userAgentData?: {
    brands: readonly {brand: string}[];
    platform?: string;
  };
};

const homeTitle = '将卫戍速查添加到主屏幕';
const desktopTitle = '在电脑上安装卫戍速查';
const guides = {
  chrome: {
    title: desktopTitle,
    device: '桌面版 Chrome',
    steps: [
      '点击地址栏右侧的安装图标，或打开「⋮ → 投放、保存和分享 → 将网页安装为应用」。',
      '在弹出的窗口中点击「安装」。',
    ],
  },
  edge: {
    title: desktopTitle,
    device: '桌面版 Edge',
    steps: [
      '点击地址栏右侧的应用安装图标，或在「… → 更多工具 → 应用」中选择安装此站点。',
      '确认名称后点击「安装」。',
    ],
  },
  firefoxWindows: {
    title: '将卫戍速查固定到任务栏',
    device: 'Windows · Firefox',
    steps: [
      '在普通窗口点击地址栏的网页应用按钮。',
      '在固定到任务栏的提示中选择「是」。',
    ],
  },
  chromeAndroid: {
    title: homeTitle,
    device: 'Android · Chrome',
    steps: [
      '打开 ⋮ 菜单，选择「添加到主屏幕」或「安装应用」。',
      '如果出现「安装」选项，点它并按系统提示确认。',
    ],
  },
  edgeAndroid: {
    title: homeTitle,
    device: 'Android · Edge',
    steps: [
      '打开 Edge 菜单，选择「添加到手机」或「添加到主屏幕」。',
      '按系统提示将图标添加到桌面。',
    ],
  },
  firefoxAndroid: {
    title: homeTitle,
    device: 'Android · Firefox',
    steps: [
      '打开 ⋮ 菜单，点击「安装」。',
      '在「添加到主屏幕」面板中确认，或将图标拖到想放的位置。',
    ],
  },
  samsung: {
    title: homeTitle,
    device: 'Android · 三星浏览器',
    steps: [
      '点击地址栏的安装图标，或在浏览器菜单中选择「添加页面至 → 主屏幕」。',
      '按提示确认添加。',
    ],
  },
  safariMac: {
    title: '将卫戍速查添加到程序坞',
    device: 'Mac · Safari',
    steps: [
      '在屏幕顶部选择「文件 → 添加到程序坞」，也可以从 Safari 的共享菜单进入。',
      '确认名称后点「添加」。',
    ],
  },
} satisfies Record<string, InstallGuide>;

function appleGuide(
  platform: string,
  product: string,
  touchPoints: number,
): InstallGuide | null {
  const mac = /^Macintosh; Intel Mac OS X (\d+)[._\d]*$/.exec(platform);
  const ios =
    /^(iPhone|iPod|iPad); CPU (?:iPhone )?OS (\d+)[._](\d+)(?:[._]\d+)* like Mac OS X$/.exec(
      platform,
    );
  // iPad 请求桌面网站时使用 Macintosh 标识。
  const ipad = ios?.[1] === 'iPad' || (!!mac && touchPoints > 1);
  const mobile = ipad || !!ios;
  const safari =
    /^Version\/(\d+)[.\d]* (?:Mobile\/[\w]+ )?Safari\/[\d.]+$/.exec(product);
  if (!mobile) {
    if (!mac || !safari || Number(safari[1]) < 17) return null;
    // 17/18 也可运行在旧 macOS 上。系统版本被冻结为 10_15_7 时，26 起才可直接确认支持 Sonoma。
    const frozenMac = platform === 'Macintosh; Intel Mac OS X 10_15_7';
    return Number(mac[1]) >= 14 || (frozenMac && Number(safari[1]) >= 26)
      ? guides.safariMac
      : null;
  }

  let browser = 'Safari';
  if (
    ios &&
    (Number(ios[2]) < 11 || (Number(ios[2]) === 11 && Number(ios[3]) < 3))
  )
    return null;
  if (!safari) {
    // 从 iOS/iPadOS 16.4 起，第三方浏览器才能使用系统分享菜单安装。
    if (
      !ios ||
      Number(ios[2]) < 16 ||
      (Number(ios[2]) === 16 && Number(ios[3]) < 4)
    )
      return null;
    const named =
      /^(?:Version\/[\d.]+ )?(CriOS|EdgiOS|FxiOS)\/(\d+)[.\d]* (?:Version\/[\d.]+ )?Mobile\/\w+ Safari\/[\d.]+$/.exec(
        product,
      );
    if (!named) return null;
    if (named[1] === 'CriOS' && Number(named[2]) < 115) return null;
    browser =
      named[1] === 'CriOS'
        ? 'Chrome'
        : named[1] === 'EdgiOS'
          ? 'Edge'
          : 'Firefox';
  }
  return {
    title: homeTitle,
    device: (ipad ? 'iPad' : 'iPhone') + ' · ' + browser,
    steps: [
      safari
        ? '轻点 Safari 工具栏的共享按钮（方框向上箭头）。紧凑布局下可先打开页面菜单。'
        : '打开浏览器的共享菜单，调出系统分享面板。',
      '选择「添加到主屏幕」。如果菜单已折叠，先点「查看更多」。如果有「作为网页 App 打开」开关，打开后点「添加」。',
    ],
  };
}

/** 按平台和浏览器的完整产品标识匹配安装入口。未知浏览器、内嵌壳或版本无法确认时返回 null。 */
export function getInstallGuide(nav: BrowserIdentity): InstallGuide | null {
  const firefox =
    /^Mozilla\/5\.0 \(([^()]+); rv:[\d.]+\) Gecko\/[\d.]+ Firefox\/(\d+)[.\d]*$/.exec(
      nav.userAgent,
    );
  if (firefox) {
    if (
      /^Android [\d.]+; (Mobile|Tablet)$/.test(firefox[1]) &&
      Number(firefox[2]) >= 58
    )
      return guides.firefoxAndroid;
    // 普通发行版从 143 起支持，Microsoft Store 版从 150 起支持。网页无法区分安装渠道。
    if (
      /^Windows NT 10\.0(?:; (?:Win64|x64|WOW64|ARM64))*$/i.test(firefox[1]) &&
      Number(firefox[2]) >= 150
    )
      return guides.firefoxWindows;
    return null;
  }

  const webkit =
    /^Mozilla\/5\.0 \(([^()]+)\) AppleWebKit\/[\d.]+ \(KHTML, like Gecko\) (.+)$/.exec(
      nav.userAgent,
    );
  if (!webkit) return null;
  const [, platform, product] = webkit;
  if (/^(?:iPhone;|iPad;|iPod;|Macintosh;)/.test(platform)) {
    const apple = appleGuide(platform, product, nav.maxTouchPoints);
    if (apple) return apple;
  }

  const android =
    platform.startsWith('Linux; Android ') ||
    nav.userAgentData?.platform === 'Android';
  const desktop =
    /^(?:Windows NT |Macintosh; Intel Mac OS X |X11; Linux )/.test(platform);
  if (!android && !desktop && !platform.startsWith('X11; CrOS ')) return null;
  const brands = nav.userAgentData?.brands.map(({brand}) => brand);
  // 仅匹配独立浏览器的标准产品串，避免把附带 Chrome/Safari 兼容标识的其他产品放行。
  const samsung =
    /^SamsungBrowser\/(\d+)\.(\d+)[.\d]* Chrome\/[\d.]+ (?:Mobile )?Safari\/[\d.]+$/.exec(
      product,
    );
  if (
    android &&
    samsung &&
    (!brands?.length ||
      brands.includes('Samsung Internet') ||
      brands.includes('Samsung Browser')) &&
    (Number(samsung[1]) > 5 ||
      (Number(samsung[1]) === 5 && Number(samsung[2]) >= 2))
  )
    return guides.samsung;
  const chromium =
    /^Chrome\/[\d.]+ (?:Mobile )?Safari\/[\d.]+(?: (EdgA|Edg)\/[\d.]+)?$/.exec(
      product,
    );
  if (!chromium) return null;
  if (chromium[1]) {
    if (brands?.length && !brands.includes('Microsoft Edge')) return null;
    if (android) return guides.edgeAndroid;
    return chromium[1] === 'Edg' && desktop ? guides.edge : null;
  }
  // 单凭 Chrome/… 也会匹配只报告 Chromium 内核的浏览器；需有明确的 Chrome 品牌。
  if (brands?.includes('Google Chrome'))
    return android ? guides.chromeAndroid : guides.chrome;
  return null;
}
