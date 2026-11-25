# 赛季数据架构与维护指南

本项目采用「赛季数据与业务代码完全解耦」的架构。全部游戏实体与规则数值集中在 `data/seasons/<season>/` 下，**业务组件、路由与推荐算法只允许从 `data/index.ts` 导入**，不得直接引用具体赛季目录。

---

## 1. 数据目录与文件职责

```text
data/
├── types.ts                      所有实体、规则与 SeasonDefinition 接口定义
├── season.ts                     当前启用的赛季出口（切换赛季只改此文件）
├── index.ts                      唯一业务出口 + 衍生索引（按名称查表、盟约分类、实战职能检索等）
├── credits.ts                    由 CURRENT_SEASON.credits 衍生「关于」弹窗内容
├── pinyin.ts                     由 scripts/gen_pinyin.mjs 自动生成的拼音表（勿手改）
├── LICENSE.md                    数据许可：CC BY-NC-SA 3.0
└── seasons/
    ├── catalog.ts                设置页显示的轻量赛季清单
    ├── registry.ts               对比页使用的完整赛季对象（SEASONS / getSeason）
    └── s1/                       序列Ⅰ「卫戍协议·规程」数据
        ├── index.ts              汇总导出 S1_SEASON: SeasonDefinition
        ├── meta.ts               赛季元信息、默认盟约/流派、分享编码干员表与拼音覆写
        ├── covenants.ts          盟约：路由 ID、核心/附加分类、激活人数、效果公式、门槛与规则机制
        ├── operators.ts          固定池干员：等阶、星级、盟约、特质、实战职能、可借用与替补映射
        ├── additionalOperators.ts 自选干员（自有 6★ / 系统特派原型）与替补原型/预备干员名单
        ├── equipment.ts          装备、散件组合配方、实战职能与机制标记
        ├── strategies.ts         开局策略与局内抓取推荐评分配置
        ├── builds.ts             核心盟约流派与混搭流派推荐
        ├── leaders.ts            领袖四档血量、隐秘核心、能力、对策、站位与随行敌人
        ├── leader-movement.ts    领袖战场地形格网与敌人巡逻/行进轨迹定义
        ├── rules.ts              调度中心概率/费用、回合时限、悬赏、特质与实战职能表、借用上限
        └── credits.ts            本赛季数据来源、版本说明与攻略致谢
```

---

## 2. 实体级配置原则

所有实体差异化行为应写在实体数据自身字段上（类型定义详见 [`data/types.ts`](../data/types.ts)），不要在组件或算法里用干员名/盟约名做 `if` 硬编码：

- **盟约（`covenants.ts`）**：`id`（URL 标识）、`kind`（`'core' | 'addon'`）、`layerBreakpoints`（层数门槛）、`cycleReward`（循环奖励）、`headcountBreakpoint`（人数里程碑）、`restrictedModeAbsent`（受限模式缺席）、`mechanics`（如 `countsReserve` 是否计入整备区、`countMode` 是否按场上精锐计）。
- **固定池干员（`operators.ts`）**：
  - `tier`（1–6 阶）、`stars`（星级）、`covenants`、`type`（特质类型）、`trait` / `elite`
  - `roles` / `eliteOnlyRoles`（实战职能；仅精锐解锁的职能写在 `eliteOnlyRoles`）
  - `price` / `eliteCopies`（特殊改价或非默认精锐合成张数）
  - `borrowable?: true`（非系统预设的可借用 6★ 干员；与官方 `V3_1` `NORMAL` vs `PRESET` 列表对齐，由 `tests/box.test.mjs` 校验）
  - `backupOperator?: string`（未持有且未借用时局内替补上场的原型/预备干员名）
- **自选与替补干员（`additionalOperators.ts`）**：
  - 按 `source` 区分 `'operator'`（自有 6★ 自选）、`'system'`（6★ 系统特派原型，可自选或作替补）与 `'reserve'`（4★ 罗德岛预备干员，仅作替补）。
  - 固定商店概率、阵容推荐与分享编码只读取 `OPERATORS`，自选与替补按身份通过 `ADDITIONAL_OPERATORS` 与 `SELECTION_LIMITS` 独立提供。
- **装备（`equipment.ts`）**：`roles`（提供给阵容诊断与对策反查的实战职能）、`mechanics`（如赋予同伴盟约、增加部署上限等）。
- **策略（`strategies.ts`）**：`advisor` 字段配置局内抓取推荐的策略打分规则。
- 装备和策略的 `shareId` 是稳定正整数，范围为 1–65535。两类分别编号，增补时不得复用下架条目的编号。更换图标不影响分享码。干员槽位与 `shareLayerIds` 的盟约槽位仅在末尾追加，退出者保留位置。S1 旧码沿用最初 22 个盟约槽的位图，其他赛季或超出旧位宽的方案使用带赛季标识的新码。
- Box 短码 `WB` 及 `#b=` 链接使用 `meta.boxShare` 的槽位表。S1 沿用已发布的无赛季头格式。其他赛季将赛季 ID 写入校验覆盖的包头，只有赛季和 1–15 的码表版本均匹配才能导入。每季最多 511 个槽位，保留下架干员的原位置，新干员追加在末尾。
- 筛选分类使用稳定的 `id` 和展示用的 `label`。教学示例干员、筛选盟约和阵容在 `rules.recruitExamples` 设置。
- **赛季元信息（`meta.ts`）**：`defaultCovenant`、`defaultBuild`、`roundLimits`、`tierBasePrices`、`shareOperatorIds`（分享短码顺序，已发布赛季切勿重排旧条目，只可在末尾追加）、`pinyinOverrides`。

---

## 3. 特质与说明富文本语法

`trait`、`elite`、`effect` 等展示文本由 `src/quickref/format.ts` 自动解析上色，请遵守统一标记语法：

- `<进入休整期时>`：尖括号包裹的**触发时机**会自动以青色高亮，并被干员页「触发时机」筛选器识别（映射表在 `rules.ts` 的 `operatorTriggers`）。
- `【乌萨斯】`：方括号包裹的**盟约名**会自动按盟约主题色加底线，且支持鼠标悬停 / 触屏长按弹出该盟约速览卡。
- 百分比、正负数值与倍率会自动使用等宽数字字体（`--fn`）加粗。

---

## 4. 图片资源命名规范

图片统一放在 `public/assets/img/` 下，推荐使用 `.webp` 格式以减小体积并提升离线缓存效率：

| 类型 | 目录 | 命名约定 |
|---|---|---|
| 干员头像（含自选/替补原型） | `public/assets/img/avatars/` | 与实体 `avatar` 字段一致（如 `char_1035_wisdel.webp`） |
| 装备图标 | `public/assets/img/equipment/` | 与实体 `icon` 字段一致 |
| 策略头像 | `public/assets/img/strategies/` | 与实体 `portrait` 字段一致 |
| 领袖头像 | `public/assets/img/leaders/` | 默认与领袖 `id` 一致（`leaders/<id>.webp`） |
| 盟约图标 | `public/assets/img/covenants/` | 默认与盟约 `id` 一致（`covenants/<id>.webp`，可通过可选 `icon` 字段覆写） |

---

## 5. 更新拼音索引与数据来源

### 5.1 生成拼音表（修改名称后必跑）

每当新增或修改干员、自选/替补干员、装备、策略、盟约、流派、领袖或实战职能名称，或切换赛季时，必须运行：

```bash
npm run pinyin
```

该脚本（[`scripts/gen_pinyin.mjs`](../scripts/gen_pinyin.mjs)）会扫描当前赛季实体并重新生成 `data/pinyin.ts`。

若遇到多音字读音偏差或玩家常用别名读法（例如「重岳」「仇白」「行箸」等），在当前赛季的 `meta.ts` 中通过 `pinyinOverrides` 覆写（音节间用空格分隔，支持数组配置多组读法），再重新执行 `npm run pinyin`。

### 5.2 更新「关于」弹窗来源说明

新增或更新数据参考来源时，在 `data/seasons/<season>/credits.ts` 中补充条目；若希望已访问用户下次打开时重新看到更新提示，将 `aboutVersion` 加 `1`。

---

## 6. 新增或切换赛季流程

1. 复制 `data/seasons/s1/` 结构新建 `data/seasons/<season>/`，按 `SeasonDefinition` 补全全部数据文件并在 `index.ts` 导出赛季对象。
2. 在 `data/seasons/catalog.ts` 登记轻量元信息，在 `data/seasons/registry.ts` 登记供对比页加载的完整对象。赛季 ID 使用字母、数字、下划线或连字符。
3. 将 `data/season.ts` 中的 `CURRENT_SEASON` 指向新赛季对象。
4. 补齐对应图片资源至 `public/assets/img/`。
5. 运行 `npm run pinyin` 重新生成拼音索引。
6. 运行 `npm run check`，确认 `tests/season-architecture.test.mjs`、`tests/box.test.mjs` 与全量单测、类型检查和生产构建全部通过。

无赛季后缀的历史存档和无赛季标识的旧备份属于 S1。后续赛季使用独立的流派、本局和工具进度。Box 自持练度按账号共享，助战选择按赛季保存。

## 7. 赛季更新对比

对比页从 `data/comparison/index.ts` 读取可选择的版本。正式赛季注册到 `SEASONS` 后会自动出现在两个选择器中。比较任意两份完整的 `SeasonDefinition` 即可，两个版本之间可以跳过多个赛季。

正式赛季的版本 ID 由赛季 ID 和 `meta.ruleVersion` 组成。需要给玩家保留一次季中更新时，先保存更新前的独立快照，并以原版本 ID 注册在比较目录中。更新当前数据时填写新版本号，为两次修订提供易区分的标签，按发布时间从旧到新排列。这样旧的对比链接仍会选中原来的两版。
