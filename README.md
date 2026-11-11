# 卫戍协议·规程 速查

《明日方舟》卫戍协议·规程（序列Ⅰ）的局内速查与图解教程。纯静态网页，无需前端打包，部署时生成发布目录，可安装为 PWA 离线使用。

- **速查**（`index.html`）：盟约、干员、装备、策略、流派、数值六个标签页与全局搜索，针对横屏小窗优化
- **图解教程**（`guide.html`）：从入门到流派的六章图解，含调度中心模拟器、盟约数值计算器等交互

## 目录结构

```
├── index.html              速查页骨架
├── guide.html              教程页（静态文字 + 图表容器）
├── manifest.webmanifest    PWA 清单
├── sw.js                   Service Worker（由 scripts/build_sw.py 生成，勿手改）
├── _headers                Cloudflare 静态资源缓存头
├── LICENSE                 代码许可：GNU AGPL-3.0
├── package.json            仅用于生成拼音表（npm run pinyin），网站本身不需要安装依赖
│
├── data/                   游戏数据，每个文件开头注释说明了字段含义
│   ├── operators.js        干员：等阶、盟约、特质、精锐特质
│   ├── covenants.js        盟约：激活人数、效果、随层数变化的数值公式
│   ├── equipment.js        装备与组合装备
│   ├── strategies.js       策略（开局指挥）
│   ├── builds.js           流派推荐
│   ├── rules.js            调度中心、回合时限、领袖生命、悬赏等规则数值
│   ├── credits.js          项目说明与数据来源（「关于」弹窗的内容）
│   ├── pinyin.js           名称拼音，供搜索使用（由 scripts/gen_pinyin.mjs 生成）
│   ├── LICENSE.md          数据许可：CC BY-NC-SA 3.0
│   └── index.js            统一出口 + 按名称查找等索引
│
├── js/
│   ├── lib/                两个页面共用：DOM / HTML 拼接、图片路径、PWA 注册、「关于」弹窗、
│   │                       悬停 / 长按速览（peek.js）、拼音匹配（match.js）
│   ├── quickref/           速查页
│   │   ├── main.js         入口：标签切换、点击委托、搜索框
│   │   ├── state.js        界面状态（部分记在 localStorage）
│   │   ├── chips.js        干员 / 装备 / 策略 / 盟约芯片与头像方块
│   │   ├── search.js       全局搜索
│   │   ├── sheet.js        详情弹窗
│   │   └── views/          六个标签页，各自导出 { id, label, count, render(), mount?() }
│   └── guide/              教程页
│       ├── main.js         入口：依次初始化各章
│       ├── chips.js        展示用芯片、分段按钮
│       └── chapters/       01–06 各章的图表与交互，shop-simulator.js 为调度中心模拟器
│
├── assets/
│   ├── css/                base.css（共用）· quickref.css · guide.css
│   ├── img/                avatars/ 干员头像 · equipment/ 装备图标 · strategies/ 策略头像
│   └── icons/              PWA 图标
│
└── scripts/
    ├── build.py            部署构建：生成 sw.js 并输出到 dist/
    ├── build_sw.py         生成 sw.js 的预缓存清单与版本号
    ├── gen_pinyin.mjs      生成 data/pinyin.js
    └── sw.template.js      sw.js 模板
```

## 本地运行

页面使用 ES Module，需要通过 HTTP 访问（直接双击打开 HTML 不行）：

```bash
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 修改数据

1. 编辑 `data/` 下对应文件。字段说明见各文件开头的注释。
2. 新干员 / 装备 / 策略需要把图片放进 `assets/img/` 对应目录，文件名写进数据的 `avatar` / `icon` / `portrait` 字段。
3. 新增或改名了干员 / 装备 / 策略 / 盟约 / 流派时，重新生成拼音表（需要 Node.js）：
   ```bash
   npm install
   npm run pinyin
   ```
   多音字读错时，在 `scripts/gen_pinyin.mjs` 的 `OVERRIDES` 里写出正确读法（可以写多种）。
4. 运行 `python scripts/build_sw.py` 更新离线缓存版本，否则已安装的用户会继续看到旧缓存。

特质文本约定：`<进入休整期时>` 这样的尖括号表示触发时机，`【乌萨斯】` 这样的方括号表示盟约名，页面会自动上色；数字会自动加粗。

## 部署（Cloudflare Workers 静态资源）

线上地址：<https://sp.enjoyacg.com>。Workers 项目 `ak-sp-quicksearch` 连接本仓库，推送到 `main` 由 Workers Builds 自动构建发布。配置在 Cloudflare 后台的项目构建设置中维护。

- 构建命令：`python scripts/build.py`（重新生成 `sw.js`，再把网站文件复制到 `dist/`）
- 项目根目录：`/`；发布目录：`dist`
- 部署命令：`npx wrangler@4.160.0 deploy --assets ./dist --name ak-sp-quicksearch --compatibility-date 2026-11-10`
- `--assets ./dist` 显式指定发布目录；省略时自动识别可能选中仓库根目录，把构建脚本、依赖和嵌套的 `dist/` 一并上传
- 部署时会自动重新生成 `sw.js`；本地预览离线缓存时仍需手动运行 `python scripts/build_sw.py`
- `_headers` 已配置：页面、脚本、样式、数据每次向服务器确认新版本；图片长期缓存；带内容哈希的 WOFF2 字体缓存一年
- Workers 静态资源会把 `/guide.html` 重定向到 `/guide`，Service Worker 已兼容两种路径
- 自定义域名绑定到该 Worker 的 production 环境；Cloudflare 跳转规则将 `sp.enjoyacg.com` 的 HTTP 请求以 301 跳转到 HTTPS，保留路径和查询参数

## 代码约定

- 不依赖任何框架和构建工具。HTML 用 `js/lib/dom.js` 里的 `` html`…` `` 模板标签拼接：数组自动拼接，`null` / `false` 输出为空，模板内的换行缩进会被去掉
- 速查页的点击统一走 `main.js` 的事件委托：元素上的 `data-op` / `data-eq` / `data-st` 打开详情，`data-cv` / `data-build` 跳转，其余 `data-*` 切换筛选
- 教程页的静态说明直接写在 `guide.html`，脚本只负责填充带 `id` 的图表容器
- 带 `data-op` / `data-eq` / `data-st` / `data-cv` 的元素、文字为盟约名的 `.cv` 标签和效果文本里的 `【盟约】`，鼠标悬停、或触屏长按 0.45 秒时显示速览卡片（`js/lib/peek.js`；触屏松手后卡片保留，点任意处收起，短按与滑动不受影响）。元素本身已展示同样信息时加 `data-peek="off"`（如叠层条目），其中的子芯片仍可速览
- 速查页干员弹窗在 ≥1000px 宽时在同一张卡片右侧并入该干员各盟约的效果栏（`sheet.js` 的 `covenantSide`，效果行与速览共用 `peek.js` 的 `covenantRows`）；当前干员名记在弹窗的 `data-viewing` 上，不要用 `data-op`，否则整个弹窗会被当作干员芯片
- 搜索支持汉字、全拼、首字母，拼音只从字的边界开始匹配（`js/lib/match.js`）

## 数据来源

首次打开页面会弹出「关于」说明，页脚可随时再次打开。内容写在 `data/credits.js`，新增来源时在那里补一条并把 `ABOUT_VERSION` 加 1。

**Wiki**

| 来源 | 页面 | 取用内容 |
|---|---|---|
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
- **游戏图片、名称与文本**：© 上海鹰角网络科技有限公司，本项目仅作攻略用途
- **视频攻略**：版权归各 UP 主

## 2026-11-11 数据核对

价格、练度、分模式调度中心、回合及认证已按 [ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/activity_table.json) 的 `act3autochess.V3_1` 核对；作战时限使用 `gamedata/levels/activities/act3autochess` 关卡的 `options.maxPlayTime`。精锐奖励按 [PRTS 基础操作](https://prts.wiki/w/卫戍协议/帮助) 的当前中心高一阶规则计算。

联合模拟均为14回合，险境以上可追加隐秘核心；极速模拟9回合。调度模拟器的模式选择同时切换升级费用和栏位表。模拟器记录累计净花费，支持招募、晋升奖励、冻结补位、出售与海沫售价成长。

离线图片缓存按图片内容单独计算版本，文字更新复用已有图片；首次预取最多4个图片请求并发。教程中的持续脚本动画仅在可见且未开启减少动态效果时运行。


## 本地字体

三款字体保持原样：Noto Sans SC、Saira Condensed、ZCOOL QingKe HuangYou（站酷庆科黄油体）。原版 WOFF2 分片随站点发布，保留原字重、Unicode 范围和 `font-display: swap`；浏览器按页面所需字符下载，页面加载不再连接 Google Fonts。

`assets/css/fonts.css` 由 `python scripts/vendor_fonts.py` 生成，通常构建直接使用已提交的资源，无需联网下载字体。更新字体时手动运行该脚本，再运行构建并提交生成文件。文件名包含内容哈希，可长期缓存；字体仅按需写入离线缓存，避免预取全字库。各字体的 OFL 许可证和原始资源映射位于 `assets/fonts/`。
