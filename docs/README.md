# 卫戍速查 · 开发文档

本目录面向开发者、数据维护者与 AI 协作者，涵盖项目架构、公共 UI 组件规范、赛季数据维护、测试验证与构建部署的完整细节。

> 面向普通玩家的功能介绍与使用指南请看根目录 [README.md](../README.md)；日常编码硬性红线与自检清单请看 [AGENTS.md](../AGENTS.md)。

## 文档索引

| 文档 | 内容范围 |
|---|---|
| **[开发总览（本页）](README.md)** | 技术栈、目录结构、开发脚本、Git 钩子、CI 与部署方式 |
| **[系统架构与核心模块](architecture.md)** | 双入口构建、路由与实体短码、状态/本地存储、领域模块与单元测试体系 |
| **[公共 UI 组件与交互规范](ui-components.md)** | 基础组件库 API 与用法、四级导航层级、安卓横屏小窗适配、克制动效与 Vue CSS 避坑 |
| **[赛季数据维护指南](data-guide.md)** | 多赛季架构、`data/seasons/s1/*` 字段约定、自选/替补数据、图片资源与拼音表生成 |

---

## 技术栈与运行环境

- **框架与语言**：Vue 3.5（`<script setup lang="ts">` + 泛型 SFC）+ TypeScript 6 + Vue Router 4
- **构建与工具链**：Vite 8（Rolldown）、`vue-tsc`、ESLint 10（`--max-warnings 0`）、Prettier 3
- **运行时环境**：Node.js 24（版本固定在 [`.node-version`](../.node-version)，要求 `>=22.18.0`）
- **测试**：Node.js 原生测试运行器（`node --test tests/*.test.mjs`），无需额外测试框架依赖
- **离线化**：构建时由 `scripts/build-sw.mjs` 扫描 `dist/` 产物并基于模板生成 `sw.js`

---

## 目录结构

```text
├── index.html                    速查页入口
├── guide.html                    图解教程页入口
├── vite.config.ts                双页面构建、Commit 版本号注入与 SW 生成
├── tsconfig.json                 TypeScript 编译配置
├── eslint.config.js              ESLint 扁平配置（含 vue/html-closing-bracket-newline）
├── package.json                  脚本与锁定依赖
├── AGENTS.md                     开发约定与必检项
├── edgeone.json                  EdgeOne 构建、路由与缓存配置
├── wrangler.jsonc                Cloudflare Workers 静态资源部署配置
├── .github/workflows/ci.yml      GitHub Actions CI（lint → test → build）
│
├── docs/                         详细开发文档（本目录）
│   ├── README.md                 开发总览、脚本与部署
│   ├── architecture.md           路由、状态存储、核心逻辑模块与测试架构
│   ├── ui-components.md          公共基础组件 API、导航层级、小窗与动效规范
│   └── data-guide.md             赛季数据结构、实体字段、图片与拼音生成
│
├── data/                         游戏数据与赛季定义（业务代码只从 data/index.ts 导入）
│   ├── types.ts                  全部实体与赛季定义 TypeScript 类型
│   ├── season.ts                 当前启用赛季切换点
│   ├── seasons/
│   │   ├── registry.ts           多赛季注册表
│   │   └── s1/                   序列Ⅰ「卫戍协议·规程」数据模块
│   ├── credits.ts                由当前赛季衍生「关于」弹窗内容
│   ├── pinyin.ts                 自动生成的名称拼音索引（勿手改）
│   └── index.ts                  唯一对外出口与衍生索引
│
├── src/
│   ├── boot.ts                   页面启动、加载覆盖层、字体等待与延后缓存
│   ├── router/                   History 路由、实体 ID 映射与 URL 查询同步
│   ├── lib/                      无 UI 耦合的纯逻辑与领域状态层
│   │   ├── box/                  干员持有/练度/助战借用模型、外部导入与存储
│   │   ├── dealer/               痛扁发牌题库、出题、错题本、文案与战报
│   │   ├── leaders/              领袖数据格式化与路径寻路
│   │   ├── numbers/              层数门槛、刷牌预算及图解教程的回合认证收益计算
│   │   ├── plans/                流派方案、费用、盟约统计、诊断、备份与分享编码
│   │   ├── prts/                 PRTS 维基外链构造与正文解析
│   │   ├── recommendation/       流派规划推荐与局内抓取实时建议引擎
│   │   ├── runtime/              字体加载、PWA、Service Worker 注册与统计
│   │   ├── season/               赛季版本辅助
│   │   ├── settings/             全局界面设置、主题同步与配置导入导出
│   │   └── ui/                   资源路径、拼音匹配、悬停速览、「关于」与无障碍组件
│   ├── quickref/                 速查页（index.html）
│   │   ├── main.ts               入口挂载
│   │   ├── QuickrefApp.vue       顶栏搜索、最近查看、一级栏目导航与 Wiki 分屏
│   │   ├── state.ts              速查界面状态与共享动作注入
│   │   ├── planStore.ts          本局流派、禁池与本地预设存储
│   │   ├── recentStore.ts        最近查看历史记录
│   │   ├── searchRanking.ts      全局搜索排序与实战职能匹配
│   │   ├── format.ts             特质、盟约与数值富文本格式化
│   │   ├── wikiPanel.ts          PRTS Wiki 分屏阅读状态管理
│   │   ├── workbench.css         小工具与规划器共用表单控件外观
│   │   ├── components/           公用基础组件库 + 业务卡片与详情弹层
│   │   ├── views/                一级页面视图（速览/盟约/图鉴/流派/规划器/领袖/小工具/搜索/设置）
│   │   ├── numbers/              小工具子面板与专用样式
│   │   ├── advisor/              实验性局内抓取顾问与选择弹层
│   │   └── planner/              流派规划器小屏适配逻辑
│   └── guide/                    图解教程页（guide.html）
│       ├── main.ts               入口挂载
│       ├── GuideApp.vue          章节导航与按需懒加载
│       ├── chapters/             六章正文、图表与 *View.ts 辅助函数
│       └── components/           调度中心模拟器、训练示意、联防与漏怪动画
│
├── tests/                        Node 原生单元测试（覆盖核心算法、存储、路由与架构不变量）
├── public/                       静态资源（样式、本地字体分片、游戏图标头像、PWA 清单）
└── scripts/                      构建 SW、生成拼音、提交前校验与字体本地化脚本
```

---

## 本地开发与校验命令

### 首次环境准备

```bash
npm ci
npm run hooks:install   # 可选：安装本地 Git pre-commit 钩子
npm run dev             # 启动 http://127.0.0.1:5173
```

### 全部 npm 脚本

| 命令 | 作用说明 |
|---|---|
| `npm run dev` | 启动 Vite 本地开发服务（`127.0.0.1:5173`） |
| `npm run check` | **提交前必跑全量验收**：依次执行 `lint` → `test` → `build` |
| `npm run lint` | 执行 `eslint . --max-warnings 0`，任何警告都会失败 |
| `npm test` | 运行 `tests/*.test.mjs` 全量单元测试 |
| `npm run typecheck` | 执行 `vue-tsc --noEmit` 全量 Vue + TypeScript 类型检查 |
| `npm run build` | 先运行 `typecheck`，再通过 Vite 构建 `dist/` 并生成 `dist/sw.js` |
| `npm run preview` | 预览生产构建产物（`127.0.0.1:4173`） |
| `npm run pinyin` | 重新生成 `data/pinyin.ts`（改动实体名或拼音覆写后必跑） |
| `npm run sw` | 单独根据现有 `dist/` 重新生成 `dist/sw.js` |
| `npm run precommit` | 手动运行暂存区 Prettier + ESLint 检查（`scripts/check-staged.mjs`） |
| `npm run hooks:install` | 安装本地 Git `pre-commit` 钩子 |

---

## Git 工作流与 CI 校验

1. **本地提交前钩子（`scripts/check-staged.mjs`）**：
   - 只读取暂存区内容（`git show :<path>`），绝不改写工作区或破坏部分暂存（partial staging）。
   - 对暂存的 `.ts` / `.vue` / `.js` / `.mjs` 文件依次校验 Prettier 格式与 ESLint 零警告。
2. **GitHub Actions CI（`.github/workflows/ci.yml`）**：
   - 在 `main` 分支的 `push` 和 `pull_request` 上自动运行 `Validate site` 任务：
     1. `npm ci`
     2. `npm run lint`
     3. `npm test`
     4. `npm run build`（含 `vue-tsc --noEmit` 与 `sw.js` 生成）
3. **修改数据后的提交流程**：
   - 编辑 `data/seasons/<season>/*.ts` → 补充图片资源 → 运行 `npm run pinyin` → 运行 `npm run check` → 确认无误后提交。

---

## 构建与部署

`vite.config.ts` 在构建阶段会执行以下额外步骤：

1. 读取当前 Git `HEAD` 提交 SHA（或环境变量 `CF_PAGES_COMMIT_SHA` / `BUILD_COMMIT_SHA`），将前 7 位注入页面页脚 `<code class="build-version">`。
2. 为入口 `<script type="module">` 附加 `onerror` 回调，脚本下载失败时加载遮罩自动切到可重试错误态。
3. 打包结束后复制 `LICENSE` 至 `dist/LICENSE`，并调用 `scripts/build-sw.mjs` 生成包含核心静态资源清单与内容哈希版本号的 `dist/sw.js`。

### 部署目标

- **EdgeOne**：配置位于 [`edgeone.json`](../edgeone.json)，使用 Node.js `24.18.0`，安装命令 `npm ci`，构建命令 `npm run build`，产物目录 `dist`。
- **Cloudflare Workers**：配置位于 [`wrangler.jsonc`](../wrangler.jsonc)，静态资源指向 `dist`。构建完成后执行：
  ```bash
  npx wrangler@4.160.0 deploy
  ```
- **Cloudflare 开发预览**　推送到 `develop` 后，Workers Builds 会运行 `npm run build` 和 `npx wrangler@4.160.0 preview`。每次成功构建都会更新同一个[开发预览地址](https://develop-ak-sp-quicksearch.cnflwzh.workers.dev)。`main` 继续用于正式部署。
- **缓存头**：静态资源缓存策略定义在 [`public/_headers`](../public/_headers)。
