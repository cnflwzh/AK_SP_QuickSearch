# 域名迁移与旧存档取回

| 地区 | 旧网址 | 对应的新网址 |
|---|---|---|
| 主站 | `sp.enjoyacg.com` | `global.arksp.top` |
| 大陆镜像 | `ak.cnflwzh.top` | `arksp.top` |

## 四站并行

1. 在切换游戏版本前，固定一份含本次迁移功能的旧赛季（`s1`）源码。从该版本运行 `npm run build:legacy-parallel` 和 `npm run build:retirement`，留存产物、构建清单和 Git 版本。旧主站和旧镜像使用这份并行版读取此前写入的 S1 存档。两个旧域的自动部署应固定到这个版本。
2. 给两个新域名准备独立部署、HTTPS 证书和应用路由。游戏版本更新时，在新站构建中设置 `VITE_DOMAIN_MIGRATION=parallel`，用实际发布的游戏数据构建。静态文件托管设置 `WSQ_STATIC_ROUTES=1`，各站继续使用自己的统计配置。迁移依据 `SEASON_META.id` 区分赛季，季中更新只要赛季 ID 相同，仍按同季交接。
3. 分别访问新主站、新大陆镜像的 `/settings?mirror-action=send`，确认 HTTP 200 且设置页能加载。检查速查、图解教程、对比页及分享深链后，再把准备好的旧赛季并行版部署到两个旧域名。在每个地区用一份含自建流派、自持干员和旧季助战的样本点「迁移存档到新域名」，逐项核对下表。原主站和镜像之间仍可按原方式交接配置。
4. 从四站均可访问且旧站提示可见之日算起，并行运行约半个月。具体退役日由维护者决定。常规构建默认关闭提示。

玩家可在旧站一键迁移、直接打开新站的同一页面，或收起提示继续使用旧站。新站设置和页脚提供取回入口。跨域交接在同一浏览器中完成。换设备或浏览器、或者弹窗受限时，在旧站设置中下载迁移备份，再到新站设置中导入文件。

| 数据 | 同赛季换域 | 跨赛季换域 |
|---|---|---|
| 页面设置、账号自持干员练度 | 可恢复，Box 合并时保留较高练度 | 可恢复，按干员账号标识合并，已持有精零也算自持 |
| 自建或修改的流派、助战选择、痛扁发牌错题本和最近查看 | 可恢复，有差异时可选择保留新站记录 | 留在原赛季，可下载旧季原始备份 |
| 本局流派与阶段、禁选、领袖、局内抓取和每日同题牌局 | 排除 | 排除 |

同季空站可直接接收。跨季时，即使新站为空，也先列出来源与目标赛季以及可导入的内容，再由玩家确认。遇到已经退出本季的实体，原始文件可供留存和在对应赛季恢复。请在清理旧站浏览器数据前完成取回或下载备份。

## 旧站退役与回退

1. 记录两个旧域名当前绑定的部署版本，保留四站并行版作回退。保留旧域名的 DNS 和有效 HTTPS 证书，旧域名还负责接收原书签和读取旧域存档。
2. 使用第一步留存的 S1 退役构建，对照 `dist/legacy-source.json` 和 `.codex-retirement/legacy-source.json` 的来源赛季和版本。将 `.codex-retirement/cloudflare/` 作为独立 Worker 部署，只绑定 `sp.enjoyacg.com`。将 `.codex-retirement/edgeone/` 作为独立 EdgeOne Pages 项目部署，只绑定 `ak.cnflwzh.top`。EdgeOne 项目根需包含 `middleware.js` 和 `edgeone.json`，仅上传 `public/` 会显示部署检查页。两个新域名继续运行启用迁移开关的新赛季应用。
3. 用旧书签访问两个旧站，检查路径、查询串和片段仍在，并确认目标属于对应地区。普通 GET/HEAD 返回 `307` 和 `Cache-Control: no-store`，方便必要时回退。旧域 `/sw.js` 提供退役更新，旧 Service Worker 更新时会清理本站离线缓存。已离线的设备需要重新联网才能收到更新。
4. 在保留旧档的浏览器，从新站点击「从旧主站取回存档」或「从旧大陆镜像取回存档」。旧域会为这次交接提供独立恢复页。只要仍提供这条旧域 HTTPS 路由，错过并行期的用户也有机会取回本地数据。请避免在 DNS 服务商或 CDN 上另加覆盖全部路径的整站跳转，否则会跳过恢复页及 Service Worker 更新。
5. 两个地区均验收完成后，更新项目首页和对外发布的常用入口，让新用户直接访问新域名。如需回退，把受影响的旧域重新绑定到四站并行版，重新验证该地区的旧书签和一次存档交接。保留新站已经接收的存档。

## 本地演练

在 PowerShell 中使用下列命令生成并行版和退役版。部署脚本与本地演练脚本均可在仓库根目录执行。

```powershell
npm run check
$env:WSQ_STATIC_ROUTES = '1'
npm run build:legacy-parallel
npm run build:retirement
node scripts/build-migration-rehearsal.mjs
```

最后一条命令在独立目录用不同的赛季 ID 编译第二份应用。它复用现有游戏素材，用来验证换季后的存储键、迁移协议和两站的版本差异。拿到真实新赛季数据后，用其正式构建和实际赛季 ID 再演练一次。

本机需有 Chromium、Playwright 和 OpenSSL。默认覆盖启用及禁用 Service Worker 两种情况。四个 HTTPS 来源都映射到回环测试服务，使用临时浏览器配置。另传入迁移前的真实静态构建可验证仍在使用旧版页面的玩家，该目录需包含 `settings.html`。

```powershell
npm exec --offline --package=playwright -- node scripts/rehearse-domain-migration.mjs --next-season-dist=.codex-migration-fixture/dist --next-season=rehearsal-next --legacy-dist=已有旧版静态构建目录
```

可用 `--sw=on|off` 或 `--phase=parallel|retired|layout` 单跑一组。已在其他目录安装 Playwright 时，可设置 `WSQ_PLAYWRIGHT_MODULE`，直接运行 `node scripts/rehearse-domain-migration.mjs` 并传入相同参数。`WSQ_CHROMIUM_CHANNEL`、`WSQ_CHROMIUM_EXECUTABLE` 和 `WSQ_OPENSSL` 可指定本机浏览器及 OpenSSL。演练验证浏览器和构建产物之间的交接。公开域名、证书、CDN 路由和真实设备仍需在正式切换时按前两节验收。
