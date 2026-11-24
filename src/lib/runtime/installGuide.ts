/** 当前设备上的安装入口，以及用户展开后看到的操作步骤。 */
interface InstallGuide {
  title: string;
  device: string;
  steps: string[];
}

/** 根据浏览器标识和触控能力选择菜单文案。能否直接安装由浏览器事件单独决定。 */
export function getInstallGuide(
  nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>,
): InstallGuide {
  const ua = nav.userAgent;
  const embedded = /MicroMessenger|\bQQ\/|DingTalk|Weibo|AlipayClient/i.test(
    ua,
  );
  // iPadOS 请求桌面网站时也会自称 Macintosh。
  const ipad =
    /iPad/i.test(ua) || (/Macintosh/i.test(ua) && nav.maxTouchPoints > 1);
  const homeTitle = '将卫戍速查添加到主屏幕';
  if (ipad || /iPhone|iPod/i.test(ua)) {
    const safari =
      /Version\/.*Safari\//i.test(ua) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua) &&
      !embedded;
    return {
      title: homeTitle,
      device: ipad ? 'iPad · Safari' : 'iPhone · Safari',
      steps: [
        ...(!safari ? ['先用 Safari 打开当前网址。'] : []),
        ipad
          ? '轻点 Safari 工具栏的共享按钮（方框向上箭头）。如果菜单已折叠，轻点「查看更多」。'
          : '轻点 Safari 工具栏的共享按钮（方框向上箭头）。紧凑布局下，先点页面菜单，再选「共享」。',
        '选择「添加到主屏幕」。如果有「作为网页 App 打开」开关，请打开它，再点「添加」。',
      ],
    };
  }
  if (/Android|HarmonyOS|OpenHarmony/i.test(ua)) {
    if (embedded)
      return {
        title: homeTitle,
        device: '应用内浏览器',
        steps: [
          '打开页面菜单，选择「在浏览器中打开」，也可以复制当前网址到 Chrome。',
          '在浏览器中重新打开本站的安装步骤，即可看到对应的菜单位置。',
        ],
      };
    if (/HuaweiBrowser/i.test(ua))
      return {
        title: homeTitle,
        device: '华为浏览器',
        steps: [
          '打开浏览器菜单，选择「添加至桌面」。部分版本需要先收藏网页，再长按书签，选择「添加至桌面」。',
          '确认添加后，轻点桌面快捷方式即可打开速查。',
        ],
      };
    // 国产浏览器的 UA 常同时含有 Chrome；厂商标记优先于兼容内核标记。
    const androidChrome =
      /Chrome\//i.test(ua) &&
      !/MQQBrowser|QQBrowser|UCBrowser|Quark|MiuiBrowser|HeyTapBrowser|OppoBrowser|VivoBrowser|baidubrowser|baiduboxapp|Sogou|360browser|SamsungBrowser|HonorBrowser|EdgA\/|OPR\/|Version\//i.test(
        ua,
      );
    if (androidChrome)
      return {
        title: homeTitle,
        device: 'Android · Chrome',
        steps: [
          '打开右上角 ⋮ 菜单，选择「安装并创建快捷方式」或「添加到主屏幕」。部分版本直接显示「安装应用」。',
          '选择「安装」，按系统提示确认。',
        ],
      };
    return {
      title: homeTitle,
      device: '手机浏览器',
      steps: [
        '打开菜单或工具箱，查找「安装应用」「添加到桌面」或「发送到桌面」。',
        '如果只提供桌面快捷方式，点图标会在浏览器中打开。要安装独立应用，可用 Chrome 打开当前网址。',
      ],
    };
  }
  const desktopTitle = '在电脑上安装卫戍速查';
  if (/Firefox\//i.test(ua)) {
    if (/Windows/i.test(ua))
      return {
        title: '将卫戍速查固定到任务栏',
        device: 'Windows · Firefox',
        steps: [
          '在普通窗口点击地址栏的「网页应用」按钮。出现固定到任务栏的提示时，选择「是」。',
          '此功能需要 Firefox 143 或更高版本，Microsoft Store 版需要 150 或更高版本。也可以用 Chrome 或 Edge 安装。',
        ],
      };
    const mac = /Macintosh/i.test(ua);
    return {
      title: desktopTitle,
      device: mac ? 'Mac · Firefox' : '桌面版 Firefox',
      steps: [
        mac
          ? '要从程序坞打开，可用 Safari 打开当前网址，在「文件」菜单选择「添加到程序坞」（macOS 14 或更高版本）。'
          : '要以独立窗口使用，可用 Chrome 或 Edge 打开当前网址，点击地址栏的安装图标。',
        '继续使用 Firefox 时，可点击地址栏的星标收藏本站。',
      ],
    };
  }
  if (/Edg\//i.test(ua))
    return {
      title: desktopTitle,
      device: '桌面版 Edge',
      steps: [
        '点击地址栏右侧的应用安装图标。也可打开「…」菜单，在「更多工具 → 应用」中选择「将此站点安装为应用」。',
        '确认名称后点击「安装」。',
      ],
    };
  if (/Chrome\//i.test(ua))
    return {
      title: desktopTitle,
      device: '桌面版 Chrome',
      steps: [
        '点击地址栏右侧的安装图标。也可打开「⋮ → 投放、保存和分享 → 将网页安装为应用」。',
        '在弹出的窗口中点击「安装」。',
      ],
    };
  if (/Macintosh.*Version\/.*Safari\//i.test(ua))
    return {
      title: '将卫戍速查添加到程序坞',
      device: 'Mac · Safari',
      steps: [
        '在屏幕顶部的「文件」菜单中选择「添加到程序坞」，再点「添加」。',
        '此功能需要 macOS Sonoma 14 或更高版本。较早系统可用 Chrome 或 Edge 安装。',
      ],
    };
  return {
    title: '安装卫戍速查',
    device: '其他浏览器',
    steps: [
      '在浏览器菜单中查找「安装应用」或「添加到主屏幕」。',
      '找不到入口时，可用 Chrome 或 Edge 打开当前网址安装。',
    ],
  };
}
