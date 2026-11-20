# 系统架构与核心模块

本文档说明「卫戍速查」的双入口构建、前端路由、状态持久化、核心领域模块划分与单元测试体系。

---

## 1. 双入口与启动流程

项目通过 [`vite.config.ts`](../vite.config.ts) 构建为两个共享基础代码与静态资源的独立 HTML 入口：

- **`index.html` → `src/quickref/main.ts`**：速查应用（Vue Router History 模式），涵盖 9 个一级栏目（速览、盟约详情、干员、流派、装备、策略、敌人、小工具、设置）、独立个人档案路由 `/box` 与全局搜索。
- **`guide.html` → `src/guide/main.ts`**：图解教程页，按章节接近视口时动态懒加载组件与交互演示。

两页均通过 [`src/boot.ts`](../src/boot.ts) 统一管理首屏加载遮罩（`#load-screen`）、字体就绪窗口、Service Worker 注册与延后缓存，确保字体或网络波动时不阻塞首屏可交互。

---

## 2. 路由与状态同步（`src/router/`）

速查页所有可分享的状态均同步到 URL，支持刷新保持、浏览器前进后退与直链分享：

| 文件 | 职责 |
|---|---|
| `src/router/index.ts` | 定义 Vue Router 路由表、导航错误与提示状态（`navigationError` / `routeNotice`） |
| `src/router/location.ts` | 栏目路径常量（`PAGE_PATHS`）、标签文案（`PAGE_LABELS`）、职能 ID 映射与 query 读写工具 |
| `src/router/entities.ts` | 干员 / 装备 / 策略 / 盟约 / 流派 / 领袖实体名称与 URL 短 ID 双向解析（如 `?card=op-char_4177_brigid`） |
| `src/router/navigation.ts` | 封装 `navigate`、`updateQuery`、`openCard`、`closeCard` 与各栏目链接生成函数 |

典型路由参数约定：
- `?q=<关键词>`：全局搜索视图（挂载 `SearchView.vue`，通过 `v-show` 保留背景页状态与滚动位置）
- `?card=<kind>-<id>`：在当前页面之上打开 `DetailSheet.vue` 详情弹窗，关闭时返回原背景视图
- `/operators?roster=<avatar>`：定位自选或替补干员名单中的对应条目
- `/tools?tool=<id>`：「小工具」页的当前二级子工具，对局速查使用 `match-reference`
- `?group=core|addon`：「速览」页的盟约分类筛选
- `/enemies?kind=bounty|normal`：「敌人」页切换悬赏敌人 / 普通敌人二级视图（默认 Boss）
- `/enemies/<id>?round=hidden&skill=<label>`：「Boss 详情」页的隐秘核心与技能范围选中态

---

## 3. 状态管理与本地存储

项目不使用外部状态库，而是以轻量 Vue 响应式模块配合 `localStorage` 持久化：

| 模块 | 持久化范围 | 说明 |
|---|---|---|
| `src/quickref/state.ts` | 部分筛选与当前实体 | 集中维护当前 Tab、盟约、流派、领袖、难度、筛选条件，并通过 `provide/inject`（`useQuickrefActions`）向子组件暴露跨页动作 |
| `src/quickref/planStore.ts` | 自建/修改流派、本局流派、本局领袖、本局禁池 | 维护内置流派与用户方案合并视图，派生 `runStat`、`inRunAny`、`runBans`、`runEquipRecommended` 等全站联动状态；页面退出时通过 `flushSave` 刷盘 |
| `src/lib/box/` | 个人干员练度与助战借用（按赛季隔离） | 区分自持练度（`0` 未练精 0、`1` 精一、`2` 精二、`3` 精二 60）、已借用（`-2`）与未持有（`-1`）；`initBoxStorageSync()` 支持多标签页 `storage` 事件实时同步 |
| `src/lib/settings/` | 主题、卡片密度、字号、减弱动效、模块开关、栏目排序、隐藏工具 | 响应式同步至 `<html>` 属性（`data-theme`、`data-font`、`data-motion="reduce"`、`data-hide-footer`），支持完整 JSON 配置（可附带流派与练度）导出与导入 |
| `src/quickref/recentStore.ts` | 最近查看历史 | 记录用户近期打开过的干员、装备、策略、盟约与领袖，聚焦搜索框时展示 |
| `src/quickref/numbers/useNumberToolsState.ts` | 小工具会话输入 | 在 `KeepAlive` 与子工具切换期间保持层数、调度等级与认证效率等计算器输入状态 |

---

## 4. 核心领域逻辑层（`src/lib/`）

`src/lib/` 下的模块尽量保持与 Vue 视图解耦，便于直接被 `tests/*.test.mjs` 单元测试验证：

- **`src/lib/box/`**：
  - `model.ts`：练度等级常量（`BOX_RANK_BORROWED = -2` 等）、可借用 6★ 与系统预设 6★ 分类规则、流派自持覆盖率统计 `lineupBoxCoverage`
  - `import.ts`：解析 MAA 导出 JSON、一图流 `.xlsx` 练度表（经 `read-excel-file`）与纯干员名单文本，输出结构化预览
  - `store.ts`：响应式 Box 存储、助战借用数量上限校验（读取 `data/index.ts` 的 `BORROW_LIMIT`）与备份导入导出
- **`src/lib/plans/`**：
  - 方案规范化、招募/精锐费用计算、盟约人数与层数统计、阵容实战职能诊断（`diagnostics.ts`）、禁池自动替补替换、分享短码编解码（`fflate` 压缩）与 Canvas 一图流生成（`image.ts` + `qrcode-generator`）
- **`src/lib/recommendation/`**：
  - 静态流派补位推荐与「局内抓取」实时抓取建议引擎（`live/runAdvisor.ts`、`advisorRules.ts`）
- **`src/lib/numbers/`**：
  - 层数门槛与循环奖励计算、各模式/调度中心等级出牌池统计与合成概率、刷牌预算、认证效率与里程碑换算（`numberTools.ts`、`creditTools.ts`）
- **`src/lib/dealer/`**：
  - 「痛扁发牌」7 种题型生成器、每日同题确定性种子、实战局面最优解出题（复用实时推荐引擎验证无歧义）、错题本熟练度与连对掌握机制
- **`src/lib/leaders/`**：
  - 领袖能力富文本高亮、对策标签分类，以及基于真实地图地形与障碍的地面/飞行路径与巡逻时间轴计算
- **`src/lib/ui/`**：
  - `match.ts`：中文 / 全拼 / 拼音首字母边界匹配与相关度打分
  - `peek.ts`：全局委托式悬停 / 0.45 秒长按速览小卡，通过 `data-op` / `data-eq` / `data-st` / `data-cv` / `data-ld` 与 `data-peek="off"` 控制触发范围
  - `dom.ts`：`prefersReducedMotion()` 统一读取系统 `prefers-reduced-motion` 与站点 `data-motion="reduce"`

---

## 5. 单元测试体系（`tests/`）

所有测试均为 Node.js 原生 `node:test` + `node:assert`，可直接通过 `npm test` 执行（当前 20 个测试文件、100+ 用例）：

| 测试文件 | 验证重点 |
|---|---|
| `season-architecture.test.mjs` | 校验赛季数据完整性与「业务代码不硬编码赛季文件」架构约束 |
| `box.test.mjs` | 练度模型、官方 V3_1 可借用与系统预设 6★ 划分、外部导入解析与存储操作 |
| `routing.test.mjs` / `search-ranking.test.mjs` / `recent-store.test.mjs` | 路由实体编解码、搜索排序、实战职能匹配与最近记录 |
| `planner-presets.test.mjs` / `planner-share.test.mjs` / `plan-backup.test.mjs` / `plan-store.test.mjs` | 流派预设、禁池替换、分享码往返、备份恢复与持久化 |
| `diagnostics.test.mjs` / `planner-recommendations.test.mjs` / `run-advisor.test.mjs` / `advisor-capacity.test.mjs` / `advisor-strategy.test.mjs` | 实战职能诊断与局内抓取实时推荐 |
| `number-tools.test.mjs` / `leader-movement.test.mjs` | 层数门槛、刷新预算、认证计算与领袖路径寻路 |
| `dealer-game.test.mjs` / `dealer-session.test.mjs` / `dealer-extensions.test.mjs` | 痛扁发牌出题、每日同题持久化、错题本与局面决策题 |
| `settings.test.mjs` | 设置同步、配置备份解析与回滚 |

> **编写测试原则**：凡修改 `src/lib/` 下的规则、计算、导入导出或数据不变量时，都应在对应的 `tests/*.test.mjs` 补充覆盖用例，并执行 `npm run check` 验证通过。
