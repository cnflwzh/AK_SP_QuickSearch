# 开发约定（给 AI 助手与协作者）

修改界面、新增页面或工具时，请先遵守本文件约定；详细开发文档见 [docs/README.md](docs/README.md)（架构见 [docs/architecture.md](docs/architecture.md)，公共组件 API 见 [docs/ui-components.md](docs/ui-components.md)，赛季数据维护见 [docs/data-guide.md](docs/data-guide.md)），面向玩家的介绍见 [README.md](README.md)。

## 项目背景与目标

「卫戍速查」是《明日方舟》卫戍协议的开源局内速查工具，当前收录「规程（序列Ⅰ）」。每回合留给玩家抓牌、配装和调整站位的时间有限。玩家在电脑分屏或手机小窗里打开速查页，通常是为了解决眼前的一个问题，查完就回到游戏。

- **让玩家一眼找到答案。** 查干员时，先看等阶、盟约和特质；查层数门槛时，先看多少层生效、效果怎么变。列表里能说清的内容直接展示，完整说明放在详情里。
- **让局内操作尽量少。** 小工具默认就能查表，需要算「还差几层」或「还能刷几次」时再填层数或资金。从结果打开详情再返回时，保留原来的搜索、筛选和浏览位置。
- **速查页和图解教程各有侧重。** 速查页方便对局中查具体数值、比选项；图解教程按章节讲清招募、升本、叠层和流派成型的过程。两边沿用同一赛季的数据和游戏内术语，方便玩家把教程里学到的机制带回局内使用。

## 1. 响应式：必须兼容安卓横屏小窗

玩家常在游戏里开**安卓横屏小窗 / 悬浮窗**查资料。这类窗口的特点是 **宽度中等、高度很矮**，例如 640×400、860×380；也有接近正方形的小窗，例如 625×670。只按宽度判断“手机 / 桌面”会出错，修改界面时请注意以下几点：

- **同时考虑宽度和高度。** 竖屏手机用 `max-width` 断点；矮窗口另用 `@media (max-height: 600px)` 压缩页眉、控件高度、区块间距和次要说明，把空间留给列表内容。
- **筛选栏优先放一行。** 搜索框、下拉选择、切换栏只在窄屏竖屏（约 `max-width: 520px`）才换行；宽度足够时保持一行，不要用 `flex-basis: 100%` 无条件换行。
- **弹层和底部面板在矮窗口下尽量占满高度**（参考 `.ra-overlay`、`PlannerSheet.vue`、`BoxImportGuide.vue`）。页眉保持单行、紧凑；列表区域内部滚动，筛选栏吸顶。
- **组件内部布局优先用容器查询**（`@container quickref-view`、`number-tools`、`run-advisor`、`subtabs`、`extra-roster` 等）。PRTS Wiki 分屏、折叠屏、悬浮小窗下，组件实际宽度和视口宽度并不一致。
- **触控高度底线。** 小窗下页面依然可触控，按钮与可点控件高度不低于 `34px`；矮窗口可以从 `40–42px` 收到 `34–36px`，不要更小。

**自检尺寸：** 改完界面后至少检查 **390×844**（竖屏手机）、**640×400** 与 **860×380**（横屏小窗）、**625×670**（方形小窗）、**1280×900**（桌面），以及打开 PRTS Wiki 分屏时的窄栏状态。

## 2. 公共组件优先复用（禁止重复手写）

速查页已在 `src/quickref/components/` 沉淀出一套统一基础组件（详细 API 见 [docs/ui-components.md](docs/ui-components.md)）。新增功能或改造旧页面时，遇到以下场景**必须直接调用公用组件**，不要在业务页面里另写一套样式或逻辑：

| 场景 | 公用组件 / Composable | 说明 |
|---|---|---|
| 二级 / 三级视图或分类 Tab 栏 | `SubTabs.vue` | 带平滑滑动高亮块、数量角标、防孤项换行、矮窗单行横滚与方向键无障碍导航 |
| 行内轻量选项 / 状态切换 | `Segmented.vue` | 用于表单/设置/工具栏内的二三选一（如「初始 / 精锐」、主题模式、标注画笔），自带滑动滑块 |
| 页内可清空搜索框 | `SearchInput.vue` | 统一搜索图标、渐显 `✕` 清空按钮、iOS 防放大字号与矮窗高度 |
| 下拉选择框 | `SelectInput.vue` | 统一美化触发框与高亮激活态；PC 端定制主题悬浮下拉（支持分组、键盘导航与 Top Layer 弹层），移动端展开调用系统原生选择器 |
| 分组标题与分割线 | `SectionHeading.vue` | 统一左侧色条/圆点（`variant="bar" \| "dot" \| "plain"`）、标题、数量角标、副标题、延伸线与 `#extra` 插槽 |
| 空态 / 无匹配提示 | `EmptyState.vue` | 统一空列表提示文案、可选卡片边框（`card`）、紧凑模式（`compact`）与清空/重置按钮 |
| 一键复制按钮与剪贴板逻辑 | `CopyButton.vue`、`useClipboardCopy.ts` | 统一防竞态复制、已复制反馈与剪贴板权限受限时的 `prompt` / 文本框降级 |
| 危险操作二次确认 | `ConfirmButton.vue` | 替代原生 `window.confirm()`，内联展开确认/取消，点击外部或按 `Esc` 自动取消 |
| 内联状态 / 警告 / 错误提示条 | `StatusNotice.vue` | `tone="info" \| "success" \| "warning" \| "danger"`，自动匹配 `role="status"` / `role="alert"` |
| 滑动指示器通用底层 | `useSlidingPill.ts` | 封装 `ResizeObserver`、字体加载与 `KeepAlive`（`onActivated`）重测、横向滚动居中 |

## 3. 导航与 Tab 层级规范

页面内不要把不同层级的切换栏做成同尺寸、同视觉重量，请严格按四级体系使用：

1. **一级主导航**（`QuickrefApp.vue` 顶栏 `.tabs`）：底部下划线风格，常驻吸顶。
2. **二级切换栏**（`<SubTabs :level="2" />`）：紧贴一级导航下的主子视图切换（如 `干员` 与 `我的 Box` 的固定/自选/替补、`敌人` 的 Boss/悬赏敌人/普通敌人、`小工具` 顶栏、`速览` 全部/核心/附加、`装备` 等阶、`策略` 分类）。采用较大体量与**实心主色（`--accent`）滑块**。
3. **三级切换栏**（`<SubTabs :level="3" />`）：嵌套在二级页面或卡片内的子视图切换（如 `干员 → 固定干员` 下的等阶栏、`敌人 → Boss` 的难度与特性筛选、`敌人 → 悬赏敌人` 的发放时机、`Boss 详情` 站位图视图、`流派` 终盘阵容/按等阶抓牌、`对局速查` 分区、`局内抓取` 整备区/装备、`痛扁发牌` 模式等）。采用更紧凑尺寸与**浅底描边浮卡滑块**，视觉重量明确弱于二级，避免与上方二级栏抢焦点。
4. **行内表单切换**（`<Segmented />`）：卡片或设置行内的参数开关（如「初始 / 精锐」、设置项、画笔选择），保持最小视觉占比。

**换行与溢出原则：**
- 多项 Tab 在正常高度窄屏下按均衡列数拆行（如 7–8 项拆成 `4+3` / `4+4`），避免 `N-1 + 1` 的孤立尾项；少项独立栏（2–4 项）在竖屏手机单行铺满。
- 矮窗口（`max-height: 600px`）下**禁止折成多行**，保持紧凑单行并在溢出时横向滚动 + 左右渐变箭头提示。

## 4. 动效克制与减弱动画规范

- **克制、服务于反馈，不喧宾夺主。**
  - 滑块位移控制在 `180–240ms`（`cubic-bezier(0.22, 1, 0.36, 1)`，无弹簧过冲）；二/三级内容区切换使用 `quickref.css` 的 `.subtab-panel` / `.subtab-next` / `.subtab-prev`（轻量 `8px` 方向滑入、`150–180ms`）；清空按钮、提示条、确认切换控制在 `140–160ms` 微淡入。
  - 不要给高频列表、密集卡片或静默状态刷新添加夸张缩放、弹跳或长动画。
- **必须同时遵守两套减弱动效开关：**
  - CSS 同时处理 `@media (prefers-reduced-motion: reduce)` 与 `:root[data-motion="reduce"]`；
  - JS 滚动/动效判断统一调用 `src/lib/ui/dom.ts` 的 `prefersReducedMotion()`。

## 5. Vue / CSS / TypeScript 易踩坑点

- **Scoped CSS 严禁写 `:global(:root[...]) .cls`！** Vue 的 scoped CSS 编译器会把 `:global(...)` 之后的选择器截断，导致规则错误作用到 `:root` 本身（例如误涂整页背景或深色变量不生效）。正确写法是把**整条选择器**包进 `:global(...)`：
  ```css
  :global(:root[data-theme='dark'] .my-block) { ... }
  :global(:root[data-motion='reduce'] .my-el) { transition: none !important; }
  ```
- **深色主题双分支：** 组件自定义深色变量时，必须同时写 `:root[data-theme='dark']` 和 `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) ... }`，确保「跟随系统」与「手动夜间模式」表现一致。
- **原生 ARIA 属性透传：** `vue-tsc` 不会把模板里的 `aria-label="..."` 映射为组件必填的 `ariaLabel` prop。包装 `<input>` 或 `role="tablist"` 时，请使用 `defineOptions({inheritAttrs: false})` + `useAttrs()` 读取 `attrs['aria-label']` 并支持可选 `label` prop，同时把 `attrs.class` / `attrs.style` 绑在外层容器上。
- **模板标签闭合风格：** ESLint 启用了 `vue/html-closing-bracket-newline: never`，多行标签的 `>` 和 `/>` 必须跟在最后一个属性同行，不要另起一行。
- **安全浏览优先：** 含批量修改/删除的页面（如 `BoxTools.vue`）默认应为只读浏览态，编辑画笔等易误触模式需显式开启；危险清空/删除必须经过二次确认。

## 6. 数据与提交前验证流程

- **严禁硬编码赛季实体：** 业务组件与算法只能从 `data/index.ts` 读取数据，不直接引用 `data/seasons/s1/*`。
- **更新数据后同步拼音：** 修改干员、装备、策略、盟约、流派、领袖或实战职能名称后，务必运行 `npm run pinyin`。
- **交付前必跑全量检查：**
  ```bash
  npm run check
  ```
  等同于依次运行 `npm run lint`（ESLint `--max-warnings 0`）→ `npm test`（`tests/*.test.mjs` 全量单测）→ `npm run build`（`vue-tsc --noEmit` + `vite build` + `sw.js` 生成）。
- 涉及核心逻辑或数据结构改动时，需在 `tests/` 补充或更新对应 `.test.mjs` 单元测试。提交前可安装本地钩子（`npm run hooks:install`），`scripts/check-staged.mjs` 会自动校验暂存区的 Prettier 格式与 ESLint。
