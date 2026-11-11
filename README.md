# 卫戍速查

《明日方舟》卫戍协议·规程（序列Ⅰ）的局内速查与图解教程。使用 Vue 3 + TypeScript + Vite，构建为静态网页，可安装为 PWA 离线使用。


- **速查**（`index.html`）：盟约、干员、装备、策略、流派、数值六个标签页，支持全局搜索、详情与悬停 / 长按速览；数值页提供盟约层数计算器
- **图解教程**（`guide.html`）：入门、招募与升本、刷怪、盟约进阶、流派、图鉴六章，含调度中心模拟器、站位示意、回合图表等交互
- **离线使用**：页面、图片和字体按访问缓存，已加载的内容可离线查看

在线使用：[速查](https://sp.enjoyacg.com/) · [图解教程](https://sp.enjoyacg.com/guide.html) · [大陆入口](https://ak.cnflwzh.top/)

## 目录结构

```text
├── index.html              速查页入口
├── guide.html              教程页入口
├── vite.config.ts          双页面构建、页脚版本号与 Service Worker 生成
├── tsconfig.json           TypeScript 配置
├── package.json            开发、构建与数据生成命令
├── .node-version           Node.js 版本
├── edgeone.json            EdgeOne 构建、路由与缓存配置
├── wrangler.jsonc          Cloudflare Workers 静态资源部署配置
├── LICENSE                 代码许可：GNU AGPL-3.0
│
├── data/                   游戏数据
│   ├── types.ts            数据类型与字段说明
│   ├── operators.ts        干员：等阶、盟约、特质、精锐特质
│   ├── covenants.ts        盟约：激活人数、效果、随层数变化的数值公式
│   ├── equipment.ts        装备与组合装备
│   ├── strategies.ts       策略（开局指挥）
│   ├── builds.ts           流派推荐
│   ├── rules.ts            调度中心、回合时限、领袖生命、悬赏等规则数值
│   ├── credits.ts          项目说明与数据来源（「关于」弹窗的内容）
│   ├── pinyin.ts           名称拼音，由 scripts/gen_pinyin.mjs 生成
│   ├── LICENSE.md          数据许可：CC BY-NC-SA 3.0
│   └── index.ts            统一出口 + 按名称查找等索引
│
├── src/
│   ├── boot.ts             页面启动、加载覆盖层与延后加载
│   ├── lib/                两页共用：图片路径、拼音匹配、速览、PWA 与「关于」弹窗
│   ├── quickref/
│   │   ├── main.ts         速查页入口
│   │   ├── QuickrefApp.vue 搜索、标签切换与页面导航
│   │   ├── state.ts        界面状态，部分选择记在 localStorage
│   │   ├── format.ts       特质文本、盟约效果等展示格式
│   │   ├── components/     卡片、芯片、头像方块与详情弹窗
│   │   └── views/          盟约、图鉴筛选、流派、数值与搜索结果
│   └── guide/
│       ├── main.ts         教程页入口
│       ├── GuideApp.vue    章节导航与按需加载
│       ├── chapters/       六章内容、图表与交互
│       └── components/     调度中心模拟器、训练示意、联防与漏怪动画
│
├── public/
│   ├── manifest.webmanifest  PWA 清单
│   ├── _headers              Cloudflare 静态资源缓存头
│   └── assets/
│       ├── css/           共用、速查、教程与字体样式
│       ├── fonts/         本地字体与许可
│       ├── img/           avatars/ 干员头像 · equipment/ 装备图标 · strategies/ 策略头像
│       └── icons/         PWA 图标
│
├── scripts/
│   ├── build-sw.mjs        根据构建产物生成离线资源清单与缓存版本号
│   ├── sw.template.js      Service Worker 模板
│   ├── gen_pinyin.mjs      生成 data/pinyin.ts
│   ├── vendor_fonts.py     下载字体分片并生成本地字体样式
│   └── build.py            Python 构建入口，调用 npm run build
│
└── .github/workflows/ci.yml  安装锁定依赖、类型检查与生产构建
```

## 本地运行

使用 Node.js 24：

```bash
npm ci
npm run dev
```

然后打开 <http://127.0.0.1:5173>。修改页面或数据后，开发服务会自动更新页面。

预览构建后的站点：

```bash
npm run build
npm run preview
```

然后打开 <http://127.0.0.1:4173>，速查页与教程页都从 `dist/` 提供。

## 构建与部署

`npm run build` 先执行 TypeScript 类型检查，再生成 `dist/`。构建时会写入 Git 提交 SHA 的前 7 位作为页脚版本号，并生成 `sw.js` 的资源清单与缓存版本号。

- **EdgeOne**：配置在 `edgeone.json`，安装命令为 `npm ci`，构建命令为 `npm run build`，输出目录为 `dist`，Node.js 为 `24.18.0`
- **Cloudflare Workers**：配置在 `wrangler.jsonc`，静态资源目录为 `dist`，版本预览地址设为关闭。完成构建后运行：

  ```bash
  npx wrangler@4.160.0 deploy
  ```

GitHub Actions 会在 PR 和 `main` 更新时执行依赖安装、类型检查与构建。

## 修改数据

1. 编辑 `data/` 下对应的 `.ts` 文件。字段说明见 `data/types.ts` 与各文件开头的注释。
2. 新干员 / 装备 / 策略的图片放进 `public/assets/img/` 对应目录，文件名写进数据的 `avatar` / `icon` / `portrait` 字段。
3. 新增或改名了干员 / 装备 / 策略 / 盟约 / 流派时，重新生成拼音表：

   ```bash
   npm run pinyin
   ```

   多音字读错时，在 `scripts/gen_pinyin.mjs` 的 `OVERRIDES` 里写出正确读法，可以写多种。
4. 用 `npm run dev` 查看修改，发布时运行 `npm run build`，离线资源清单与版本号随构建自动更新。

特质文本约定：`<进入休整期时>` 这样的尖括号表示触发时机，`【乌萨斯】` 这样的方括号表示盟约名，页面会自动上色；数字会自动加粗。

## 代码约定

- 页面使用 Vue 单文件组件和 `<script setup lang="ts">`，游戏数据与页面状态使用 TypeScript 类型
- 速查页的状态集中在 `src/quickref/state.ts`，组件通过共享动作打开详情、切换盟约与流派；筛选和数值变化由 Vue 局部更新，列表使用稳定的 `key`
- 教程页各章在接近视口时按需加载，交互写在 `.vue` 组件中，图表与排版辅助函数放在同目录的 `*View.ts`；格式化图文通过 `Markup` 转为 Vue 节点
- 两页共用 `src/lib/peek.ts` 的速览：带 `data-op` / `data-eq` / `data-st` / `data-cv` 的元素、盟约 `.cv` 标签与效果文本里的 `【盟约】`，鼠标悬停或触屏长按 0.45 秒时显示卡片。已展示完整信息的元素用 `data-peek="off"` 控制，子芯片各自响应
- 干员详情由 `DetailSheet.vue` 展示，宽屏时右侧并入盟约效果栏；当前查看的干员名记在弹窗的 `data-viewing` 上
- 搜索支持汉字、全拼与首字母，拼音从字的边界开始匹配（`src/lib/match.ts`）；`/` 聚焦搜索框，在搜索框中按 `Esc` 清空搜索
- 图片随当前视图按需加载，字体在首屏可操作后加载；离线资源按访问缓存，Service Worker 由构建产物生成

## 数据来源

首次打开页面会弹出「关于」说明，页脚可随时再次打开。内容写在 `data/credits.ts`，新增来源时在那里补一条并把 `ABOUT_VERSION` 加 1。

**Wiki 与游戏数据**

| 来源 | 页面 | 取用内容 |
|---|---|---|
| [ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) | [规程 V3_1 游戏数据](https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/activity_table.json) | 招募价格、练度、各模式升级费用与栏位、回合配置、基础认证；关卡文件核对作战时限 |
| [PRTS](https://prts.wiki/) | [卫戍协议·规程](https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE%C2%B7%E8%A7%84%E7%A8%8B) | 赛季规则、规程等级与难度、模式 |
| PRTS | [卫戍协议·规程/PRTS盟约记录](https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE%C2%B7%E8%A7%84%E7%A8%8B/PRTS%E7%9B%9F%E7%BA%A6%E8%AE%B0%E5%BD%95) | 干员盟约、特质与精锐特质，盟约效果，装备，策略效果与策略头像 |
| PRTS | [卫戍协议/帮助](https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE/%E5%B8%AE%E5%8A%A9) | 资金、调度中心、合成精锐、领袖与悬赏等基础机制 |
| PRTS | [卫戍协议：盟约](https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE%EF%BC%9A%E7%9B%9F%E7%BA%A6) | 盟约机制与上一期数值对照 |
| [可露希尔 Wiki](https://closure.wiki/zh-cn/stronghold-protocol/3) | 卫戍协议：规程 | 规程等级、盟约池、模拟强度与认证效率，干员头像与装备图标 |
| [BWIKI](https://wiki.biligame.com/arknights/%E7%9B%9F%E7%BA%A6) | 卫戍协议·规程、盟约 | 经济与流程数值核对 |
| [Arknights Wiki (wiki.gg)](https://arknights.wiki.gg/wiki/Stronghold_Protocol) | Stronghold Protocol | 调度中心等级与干员等阶数值核对 |

**流派参考（B 站）**

流派页的阵容由本项目根据上述 Wiki 的盟约与干员数据整理；核心盟约、开局策略与打法关键词参考了以下攻略：

| UP 主 | 视频 | 参考内容 |
|---|---|---|
| [小鬼卡比](https://space.bilibili.com/259571179)（UID 259571179） | [【卫戍协议：规程】保姆级【入门】攻略合集](https://www.bilibili.com/video/BV1D2Wp6kEni/) | 教程入门章节顺序；炎·杜遥夜、维多利亚·哈洛德、萨尔贡·佩佩、阿米娅多盟约的开局策略 |
| [白樱iridescent](https://space.bilibili.com/1358014912)（UID 1358014912） | [乌萨斯公式化运营一图流](https://www.bilibili.com/video/BV1CwWW6aEjh/) | 乌萨斯流派：奥术迅捷、全屏火雨 |
| 白樱iridescent | [奥术精准莱塔尼亚公式化运营一图流](https://www.bilibili.com/video/BV1UhWW6kE6t/) | 莱塔尼亚流派：奥术精准 |

延伸阅读：小鬼卡比 [核心盟约叠层方式一览](https://www.bilibili.com/video/BV1qUWJ6yEVE/)；[柏喙攻略组](https://space.bilibili.com/512280695)（UID 512280695）[刷牌or升本？抓到 key 牌的概率](https://www.bilibili.com/video/BV1uCdfBWE6y/)。

## 许可

- **代码**：[GNU AGPL-3.0](LICENSE)。修改后部署为公开网站时，需要向访问者提供修改后的源码
- **数据**（`data/` 目录）：整理自 PRTS 等 Wiki，按 [CC BY-NC-SA 3.0](data/LICENSE.md) 发布
- **游戏图片、名称与文本**：© 上海鹰角网络科技有限公司
- **视频攻略**：版权归各 UP 主
