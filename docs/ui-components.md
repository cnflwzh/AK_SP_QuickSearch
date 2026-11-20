# 公共 UI 组件与交互设计规范

本文档详细介绍速查页（`src/quickref/components/`）已沉淀的公共基础组件库、四级导航视觉体系、响应式（含安卓横屏小窗）策略、克制动效规范以及 Vue / CSS 常见避坑点。

---

## 1. 公共基础组件总览

新增页面、工具或改造旧界面时，**优先复用以下组件**，避免重复手写样式与交互逻辑：

| 组件 / Composable | 路径 | 职责 |
|---|---|---|
| `SubTabs.vue` | `src/quickref/components/SubTabs.vue` | 二级 / 三级视图与分类 Tab 栏（滑动滑块、数量角标、防孤项换行、矮窗横滚、键盘导航） |
| `Segmented.vue` | `src/quickref/components/Segmented.vue` | 行内轻量二三选一分段控件（设置项、初始/精锐、标注画笔） |
| `SearchInput.vue` | `src/quickref/components/SearchInput.vue` | 页内可清空搜索框（左侧图标、渐显 `✕` 清空按钮、iOS 16px 防放大、矮窗高度适配） |
| `SelectInput.vue` | `src/quickref/components/SelectInput.vue` | 下拉选择框（PC 端定制主题悬浮下拉，支持分组/键盘导航/Top Layer；移动端统一美化触发框并调起原生系统选择器） |
| `SectionHeading.vue` | `src/quickref/components/SectionHeading.vue` | 分组标题与延伸分割线（色条 / 圆点 / 极简风格、角标、副标题、`#extra` 插槽） |
| `EmptyState.vue` | `src/quickref/components/EmptyState.vue` | 空列表 / 无筛选结果提示块（卡片/平铺、紧凑模式、重置操作按钮与自定义操作插槽） |
| `CopyButton.vue` | `src/quickref/components/CopyButton.vue` | 一键复制按钮（已复制态勾选图标与配色切换、权限受限降级） |
| `ConfirmButton.vue` | `src/quickref/components/ConfirmButton.vue` | 危险操作内联二次确认按钮（替代 `window.confirm()`，外部点击 / `Esc` 自动取消） |
| `StatusNotice.vue` | `src/quickref/components/StatusNotice.vue` | 内联状态 / 成功 / 警告 / 错误提示条（自动绑定 `role="status"` / `role="alert"`） |
| `useSlidingPill.ts` | `src/quickref/components/useSlidingPill.ts` | GPU 加速滑动滑块测量、字体就绪重测、`KeepAlive` 重测与横向居中滚动 |
| `useClipboardCopy.ts` | `src/quickref/components/useClipboardCopy.ts` | 防竞态剪贴板写入、定时重置与自动降级 Composable |

---

## 2. 组件详细用法

### 2.1 `SubTabs.vue`（二 / 三级 Tab 切换栏）

泛型组件（`generic="T extends string | number = string"`），支持 `v-model` 与方向事件 `@change(id, direction)`：

```vue
<SubTabs
  v-model="activeTab"
  :items="[
    {id: 'fixed', label: '固定干员', count: 142},
    {id: 'selectable', label: '自选干员', count: 75},
    {id: 'substitute', label: '替补干员', count: 13},
  ]"
  :level="2"
  aria-label="干员来源"
  attr="roster-source"
  @change="(_, dir) => (panelDir = dir)" />
```

- **Props**：
  - `items: readonly SubTabItem<T>[]`：`{ id, label, count?, title?, disabled? }`
  - `level?: 2 | 3`（默认 `2`）：控制体量与视觉重量（见第 3 节）
  - `inline?: boolean`（默认 `false`）：独立成行时保持 `false`（启用 `@container subtabs`）；与 `<select>` / 按钮共处 `.bar` 工具栏时传 `inline`（避免独占一整行）
  - `overflow?: 'auto' | 'scroll' | 'wrap'`（默认 `'auto'`）：自动根据总宽估算值在窄屏启用均衡网格拆行，矮窗下强制单行滚动
  - `attr?: string`：为每个 Tab 按钮挂载 `data-${attr}` 属性（兼容样式或测试选择器）
  - `label?: string` 或原生 `aria-label`：透传绑定到内部 `role="tablist"` 元素
- **配合内容区过渡**：
  - 静态/条件区块：给内容容器加 `:key="activeTab" :class="{'subtab-panel': !!panelDir}" :data-dir="panelDir || undefined"`（样式定义在 `public/assets/css/quickref.css`）
  - `KeepAlive` 动态组件（如 `ToolsView.vue`）：使用 `<Transition :name="dir === 'prev' ? 'subtab-prev' : 'subtab-next'" mode="out-in">`

### 2.2 `Segmented.vue`（行内分段选项）

适合卡片或表单行内的参数开关（如「初始 / 精锐」、主题模式、画笔选择），底层同样复用 `useSlidingPill.ts`：

```vue
<Segmented
  :labels="['初始', '精锐']"
  :active="state.opElite ? 1 : 0"
  attr="opel"
  @change="state.opElite = $event === 1" />
```

### 2.3 `SearchInput.vue`（可清空搜索框）

```vue
<SearchInput
  v-model="search"
  placeholder="搜干员名 / 拼音 / 盟约…"
  aria-label="搜索干员"
  @clear="onClear" />
```

- 通过 `defineOptions({inheritAttrs: false})` 将 `class` / `style` 绑在外层容器，将 `aria-label`（或 `label` prop）精准绑在内部 `<input>` 上。
- 可选 `initial-focus` 属性会在内部 `<input>` 上添加 `data-initial-focus`（供弹层自动聚焦使用）。

### 2.4 `SelectInput.vue`（下拉选择框）

泛型组件（`generic="T extends string | number = string"`），同时支持扁平选项与 `<optgroup>` 分组选项：

```vue
<SelectInput
  v-model="state.opCovenant"
  :options="[
    {value: '', label: '全部盟约'},
    ...ALL_COVENANTS.map((name) => ({value: name, label: name})),
  ]"
  highlight-active
  aria-label="盟约" />
```

- **双端交互策略**：
  - **PC 端（非 `pointer: coarse`）**：点击触发框后通过 `Teleport` + Top Layer `popover="manual"`（不支持时自动降级为 `position: fixed`）弹出主题定制悬浮菜单，自动避让视口上下边缘并翻转，完整支持 `ArrowUp` / `ArrowDown` / `Home` / `End` / `Enter` / `Esc` 键盘导航、分组标题、禁用项与当前选中勾选标记，且不会被 `<dialog>` 或 `overflow: hidden` 容器裁切。
  - **移动端 / 触屏（`pointer: coarse`）**：保持与 PC 一致的美化触发框外观，上层覆盖透明原生 `<select>`（`font-size: 16px` 防 iOS 自动缩放），点击直接调用系统原生选择器。
- **Props**：
  - `options: readonly SelectEntry<T>[]`：支持 `{ value, label, disabled? }` 或分组 `{ label, options }`
  - `highlightActive?: boolean`（默认 `false`）：当前值非默认值（空串或 `0`，亦可通过 `defaultValue` 指定）时，以主色边框与浅底提示筛选已激活
  - `compact?: boolean`（默认 `false`）：紧凑内边距版本，适用于局内本数、地图场地等窄栏位
  - `disabled?: boolean`、`id?: string`、`placeholder?: string`、`label?: string`（或透传 `aria-label`）
- **动作型下拉**：传入固定 `:model-value="''"` 并监听 `@update:model-value` 或 `@change` 即可，移动端会在下一帧自动将原生 `<select>` 复位到绑定值。

### 2.5 `SectionHeading.vue`（分组标题栏）

```vue
<SectionHeading
  title="精二 60 · 满加成"
  count="42 名"
  desc="自持满档加成（攻+10% 防+10% 血+10%）"
  accent="var(--bx-r3)"
  variant="dot"
  :level="3">
  <template #extra>
    <!-- 可选右侧控件 -->
  </template>
</SectionHeading>
```

- `variant`：`'bar'`（左侧竖色条，适合主体内容大分组）、`'dot'`（圆点，适合状态桶分组）、`'plain'`（极简低权重小标题，适合详情弹窗内部区块）。
- `countTone`：`'default' | 'danger'`（如助战超限时切为红色警示角标）。
- 矮窗口（`max-height: 600px`）自动隐藏次要 `desc` 节省空间。

### 2.6 `EmptyState.vue`（空态提示）

```vue
<EmptyState
  v-if="!items.length"
  card
  message="当前筛选下没有匹配的干员"
  action-label="清空筛选"
  :show-action="hasActiveFilter"
  @action="resetFilters" />
```

- 支持 `card`（复用 `.nc` 卡片背景边框）、`compact`（弹窗/小区块紧凑内边距）以及默认插槽（追加次要链接或操作按钮）。

### 2.7 `CopyButton.vue` & `useClipboardCopy.ts`（一键复制）

```vue
<!-- 按钮直接复制，失败时用 prompt 降级 -->
<CopyButton
  :text="leaderBriefText"
  label="复制要点"
  copied-label="已复制"
  variant="compact"
  prompt-title="复制发给好友的领袖要点" />

<!-- 失败时由父组件展示内联只读文本框 -->
<CopyButton
  :text="wishlistText"
  label="复制给队友"
  fallback-mode="emit"
  @copied="copyFallback = ''"
  @fallback="copyFallback = $event" />
```

- `text` 支持传入字符串或函数 `() => string`（仅在点击时延迟拼接文本）。
- 若一个页面有多处自定义复制入口（如 `ExcuseTools.vue` 同时有随机抽取与正文点击复制），可直接调用 `useClipboardCopy(resetMs)`。

### 2.8 `ConfirmButton.vue`（危险操作二次确认）

```vue
<ConfirmButton
  v-if="hasAnyMarked"
  label="清空全部"
  confirm-label="确认清空"
  :reset-key="`${rosterSource}:${editMode}`"
  @confirm="confirmClearAll" />
```

- `tone`: `'danger'`（默认，红色警示）或 `'neutral'`（中性操作如「恢复默认」）。
- 内置外部点击与 `Esc` 键自动取消；传入 `reset-key` 可在切换上下文时自动复位。

### 2.9 `StatusNotice.vue`（内联提示条）

```vue
<StatusNotice
  v-if="notice"
  tone="info"
  :message="notice"
  dismissible
  @dismiss="notice = ''" />
```

- `tone`: `'info' | 'success' | 'warning' | 'danger'`；`warning` / `danger` 自动声明 `role="alert"`，其余为 `role="status"`。

---

## 3. 四级导航层级体系

为了防止多层切换栏视觉打架，全站严格区分四级切换样式：

1. **一级主导航**（`QuickrefApp.vue` `.tabs`）：顶栏吸顶、开放式底边下划线，无外框。
2. **二级切换栏**（`<SubTabs :level="2" />`）：紧贴一级导航之下的页面主子视图切换，较高高度（`36px`）、`13.5px` 粗体、**实心主色（`--accent`）滑块**与柔和阴影。
   - 例如：`干员` 顶部的固定/自选/替补、`小工具` 顶部的 7–8 个工具栏、`速览` 全部/核心/附加、`装备` 等阶、`策略` 分类、`领袖` 难度。
3. **三级切换栏**（`<SubTabs :level="3" />`）：嵌套在二级页或卡片内的子视图切换，更紧凑高度（桌面 `30px` / 触屏与小窗 `34px`）、`12.5px` 字号、**浅底描边浮卡滑块**与主色文字，视觉重量明确弱于二级。
   - 例如：`我的 Box` 内的固定/自选/替补、`干员 → 固定干员` 下的等阶栏、`领袖详情` 站位图视图、`流派` 终盘阵容/按等阶抓牌、`局内抓取` 整备区/装备、`认证效率` 模式、`痛扁发牌` 模式、导入指南弹窗来源页签。
4. **行内表单开关**（`<Segmented />`）：最小占比的表单参数选择（如「初始 / 精锐」、设置项、标注画笔）。

### 多尺寸换行与溢出策略

- **防孤项均衡拆行**：`SubTabs.vue` 按内容长度估算单行宽度，正常高度（`min-height: 601px`）窄屏下：
  - 2–4 项独立栏（如固定/自选/替补）在手机端收紧边距并等宽铺满单行，杜绝 `2+1` 孤项。
  - 5–8 项宽栏（如小工具、策略分类）在容器低于阈值时切为均衡网格（`3+2`、`3+3`、`4+3`、`4+4`），杜绝 `7+1` 孤立尾项。
- **矮窗强制单行横滚**：在 `@media (max-height: 600px)`（安卓横屏悬浮小窗 640×400 / 860×380）下**永不折成多行**，保持紧凑单行，溢出时自动横向滚动并显示左右渐变遮罩与 `‹` / `›` 边缘提示，同时自动将当前激活 Tab 滚入居中视野。

---

## 4. 响应式与安卓横屏小窗适配

- **双维度断点**：竖屏手机按宽度（`max-width` / `@container`），横屏小窗按高度（`@media (max-height: 600px)`）。
- **容器查询优先**：速查主内容区 `#view` 已声明 `container: quickref-view / inline-size`，小工具区 `.numbers-tools` 声明了 `number-tools`，独立 `SubTabs` 声明了 `subtabs`，Wiki 分屏列声明了 `quickref-column`。组件样式优先使用 `@container`，避免 PRTS Wiki 半栏或折叠屏下误判为宽桌面。
- **触控底线**：任何可点击按钮与 Tab 在触屏与小窗下高度不得低于 `34px`（常规移动 `38–42px`，矮窗可压到 `34–36px`）。
- **必测视口**：`390×844`、`640×400`、`860×380`、`625×670`、`1280×900` 及 PRTS Wiki 分屏窄栏态。

---

## 5. 克制的动效与减弱动画

- **克制原则**：动效只提供空间定位与操作确认反馈，不喧宾夺主：
  - 滑块位移：`180–240ms cubic-bezier(0.22, 1, 0.36, 1)`，无弹簧过冲；首次挂载与窗口 `ResizeObserver` 重排时直接定位（无飞入动画）。
  - Tab 内容切换：`.subtab-panel` / `.subtab-next` / `.subtab-prev` 仅做 `8px` 轻位移 + 淡入（`150–180ms`）。
  - 清空按钮、复制勾选、确认切换、提示条：`140–160ms` 轻微过渡。
- **双通道减弱动效**：所有动画和过渡必须同时响应：
  1. 系统级 `@media (prefers-reduced-motion: reduce)`
  2. 站点设置项 `:root[data-motion="reduce"]`
  3. JS 逻辑统一调用 `src/lib/ui/dom.ts` 中的 `prefersReducedMotion()`

---

## 6. Vue / CSS / TypeScript 易踩坑点

1. **Scoped CSS 中的 `:global(...)` 截断陷阱**：
   - 错误：`:global(:root[data-theme='dark']) .my-box { ... }` —— `@vue/compiler-sfc` 会丢弃 `:global(...)` 后半段，编译成 `:root[data-theme=dark] { ... }`，导致样式错挂到 `<html>` 上！
   - 正确：将整条选择器包裹在 `:global(...)` 内：
     ```css
     :global(:root[data-theme='dark'] .my-box) { ... }
     @media (prefers-color-scheme: dark) {
       :global(:root:not([data-theme='light']) .my-box) { ... }
     }
     ```
2. **原生 ARIA 属性透传**：
   - 模板中的 `aria-label="..."` 不会被 `vue-tsc` 自动映射为 `ariaLabel` prop。包装 `<input>` 或 `role="tablist"` 时，应采用 `defineOptions({inheritAttrs: false})` + `useAttrs()` 读取 `attrs['aria-label']`，并同时支持可选 `label` prop。
3. **ESLint 模板闭合规则**：
   - 本项目启用 `vue/html-closing-bracket-newline: never`（与 Prettier `bracketSameLine` 一致），多行标签的 `>` 与 `/>` 必须跟在最后一个属性同行。
