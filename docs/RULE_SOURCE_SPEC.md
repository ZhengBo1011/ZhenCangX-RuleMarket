# 规则源与仓库导入规范

> **状态**：规范**已定稿（含四项决策）**，代码**尚未实现**。
> 本文先定边界与格式，避免"先实现再改规范"，也避免对外承诺做不到的能力。
>
> 阅读建议：只想快速了解结论 → 看 §0；
> 要写规则源 → 看 §2（L1）/ §3（L2）；
> 要实现 → 看 §5（发现顺序）/ §7（安全清单）/ §9（路线图）。

**目录**

- [§0 一句话结论](#零一句话结论)
- [§1 现状：仓库地址今天为什么用不了](#一现状仓库地址今天为什么用不了)
- [§2 L1：规则源清单 `zhencangx-rules.json`](#二l1规则源清单-zhencangx-rulesjson)
- [§3 L2：服务型规则源（最高价值）](#三l2服务型规则源最高价值)
- [§4 规则源订阅](#四规则源订阅)
- [§5 仓库地址识别与发现顺序](#五仓库地址识别与发现顺序)
- [§6 方言（Format Adapter）扩展路线](#六方言format-adapter-扩展路线)
- [§7 安全与信任清单（实现前逐条落实）](#七安全与信任清单实现前逐条落实)
- [§8 明确不做](#八明确不做)
- [§9 路线图（含订阅）](#九路线图含订阅)
- [§10 决策记录](#十决策记录)

---

## 零、一句话结论

**"复制任意 GitHub 项目地址 → 立即可用的规则"不可能做到。**
不是工程能力不足，而是帧藏X 引擎是**声明式 Recipe，不执行任何代码**
（合规基线，见 `docs/15`、`docs/17` §1），而 GitHub 上绝大多数下载项目是
**代码**（Python/JS 提取器、签名算法、浏览器驱动爬虫）。

能做且值得做的是**诚实分级**：能自动化的自动化，不能的明确告知并给指引。

| 级别 | 输入特征 | 可达成结果 | 现状 |
|---|---|---|---|
| **L1** | 仓库提供 `zhencangx-rules.json` 规则源清单，或含 `.zrule` / `*.recipe.json` | **FULL**：一键导入一条或多条**可直接用**的规则 | ❌ 未实现（本文定义） |
| **L2** | 仓库是**可自托管的解析服务**（提供 `openapi.json` 或服务声明） | **FULL**：自动合成「展开链接 → 调服务 → 抽字段 → 输出」的规则 | ❌ 未实现（本文定义） |
| **L3** | yt-dlp / gallery-dl 的 **Python 提取器源码** | **PARTIAL**：`_VALID_URL`/`pattern` → matcher + 脚手架 | ✅ 已实现 |
| **L4** | 纯代码爬虫 / 依赖签名或浏览器驱动的项目 | **UNSUPPORTED**：明确拒绝，给字段对照与移植指引 | ✅ 已实现 |

> **L2 是最贴合"复制地址就能用"的一级，也是最该做的一级。**
> 抖音这次的实践已经证明：现代平台的解析能力正在**服务化**（签名与风控在服务端解决），
> 而一个服务只要愿意提供 `openapi.json`，字段映射就能自动合成成规则。
> 本仓库的 `rules/douyin.recipe.json` 就是 L2 合成器**应该产出**的那个结构——
> 即 L2 的产物已被一条真实规则验证过。

---

## 一、现状：仓库地址今天为什么用不了

在帧藏X 规则中心「从网络导入」粘贴 `https://github.com/owner/repo`：

1. `RulePackageImporter.fetch` 取回的是 **GitHub 的 HTML 页面**（不是规则 JSON）；
2. `RulePackageImporter.fromText` 解析失败 → 回退方言识别 → 全部不匹配；
3. 用户看到 `内容不是合法的 JSON 文本` / `已识别为「…」，但无法完整转换：…`。

**只有 raw 直链文件可用**。README 里"第三方参考脚本仓库"一节写的是**供人工移植**，
与"一键导入"是两回事。

---

## 二、L1：规则源清单 `zhencangx-rules.json`

### 2.1 放哪

仓库根目录或任意子目录（由用户粘贴的地址决定）。文件名固定，便于探测。

### 2.2 格式

```jsonc
{
  "schemaVersion": "1.0",
  "source": "zhencangx.rules",           // 固定标识
  "name": "某某平台规则集合",
  "author": "GitHub ID / 昵称",           // 必填，真实可追溯
  "license": "MIT",                       // 建议填写
  "homepage": "https://github.com/owner/repo",
  "updatedAt": "2026-10-01",
  "rules": [
    {
      "name": "抖音视频解析",
      "raw": "https://cdn.example.com/rules/douyin.recipe.json",  // 见 2.4：允许外部域名
      "path": "rules/douyin.recipe.json",   // raw / path 二选一（raw 优先）
      "version": "1.0.0",                   // 与规则 meta.version 一致；不一致以规则内为准
      "platforms": ["douyin"],
      "requiresCredential": true,           // 供导入前提示，不参与授权判定
      "description": "无水印直链 + 作者 + 发布时间",
      "sha256": "…"                          // 可选：内容哈希，见 2.5
    }
  ]
}
```

### 2.3 约束（应用侧强制）

| 项 | 约束 |
|---|---|
| 清单体积 | ≤ 256KB |
| 规则条数 | ≤ 256 |
| 单条规则体积 | ≤ 2MB（与单规则上限一致） |
| 链接协议 | 仅 `https` |
| 规则内容 | 走**完全相同**的导入校验链（manifest → 编译 → 能力 → 安装），无任何豁免 |
| 安装后 | **全部默认停用**，逐条展示能力 / 凭据需求 / 来源；由用户决定启用哪些 |
| 来源标注 | 以**实际地址**为准（不采信清单自述）：GitHub 系 → GITHUB，其余 → THIRD_PARTY |

### 2.4 外部域名的 `raw`（**已决策：允许，但必须逐条确认**）

`raw` **可以**指向与清单不同源的域名（CDN、gist 等）。代价是一致性风险，
因此用**用户确认**来补：

- 导入前必须展示**完整 URL 列表**（不是只显示域名），逐条列出：`名称 → 完整 raw 地址`；
- 用户可**逐条勾选**要导入的规则，未勾选的不下载；
- 跨源条目标注醒目标识（如「⚠ 来自外部域名 cdn.example.com」）；
- 拒绝任何非 `https` 链接。

### 2.5 `sha256`（可选但推荐）

- 清单可给每条规则带 `sha256`；校验**通过** → 标注「已校验」；
- 校验**不通过** → **拒绝该条**导入，并明确说明"清单声明的哈希与实际内容不符"，
  不要静默降级为"未校验"；
- 没有 `sha256` 的条目照常导入，但标注「未校验」。

### 2.6 为什么要有清单，而不是直接扫仓库

- 扫描需要 GitHub Contents API，**未认证 60 次/小时**，大仓库必失败；
- 扫描无法区分"给人看的示例"与"给人用的规则"；
- 清单让作者**显式声明**覆盖平台与凭据需求，用户导入前就能看到。

扫描作为**兜底**保留（见 §5）。

---

## 三、L2：服务型规则源（最高价值）

### 3.1 方式 A：`zhencangx-service.json`（显式声明，推荐）

```jsonc
{
  "schemaVersion": "1.0",
  "source": "zhencangx.service",
  "name": "Douyin/TikTok 解析服务",
  "author": "…",
  "service": {
    "baseUrl": "https://api.example.com",
    "openapi": "openapi.json",                 // 可选：相对 baseUrl
    "credential": {                             // 可选：需要用户自己的密钥时
      "profile": "example-service",
      "label": "解析服务 API Key",
      "header": "X-API-Key",
      "hosts": ["api.example.com"],
      "hint": "在服务控制台创建后粘贴"
    }
  },
  "targets": [
    {
      "name": "抖音视频",
      "matcher": {
        "hosts": ["v.douyin.com", "douyin.com", "iesdouyin.com"],
        "urlPatterns": ["douyin\\.com/video/\\d+", "iesdouyin\\.com/share/(?:video|note)/\\d+"]
      },
      "idPattern": "/(?:video|note)/(\\d{6,})",   // 从展开后的 URL 取 id
      "endpoint": {
        "path": "/api/v1/douyin/video",
        "params": { "aweme_id": "${id}", "wait": "25", "include_raw": "true" },
        "timeoutMs": 45000
      },
      "map": {
        "kind":       "$.data.kind",                 // 可选：判断是否为视频
        "kindExpect": "video",
        "media":      "$.data.media.video.url",
        "title":      "$.data.title",
        "author":     "$.data.author.nickname",
        "publishAt":  "$.data.raw.create_time",      // epoch 秒/毫秒，引擎自动归一
        "coverUrl":   "$.data.media.covers[0].url"
      }
    }
  ]
}
```

### 3.2 方式 B：`openapi.json` 自动推导（零配置，结果较弱）

从 OpenAPI 找出"接受 URL 或内容 id、返回媒体直链"的端点，生成**骨架规则**：
matcher 由用户手填或从端点描述猜，字段映射给出候选路径让用户在调试台确认。
定位为**脚手架（PARTIAL）**，不承诺开箱即用。

### 3.3 合成产物

合成结果是一条**原生 Recipe**（与手写规则完全同构，走同一条校验链）：

```
http.resolve($input.url) → extract.regex(idPattern) → 变量 id
  → condition.exists(id) → control.branch
       then: http.request(endpoint) → extract.jsonPath(map.*) → 变量
             → condition.equals(kind, kindExpect) → control.branch
                  then: output.media(headers) + output.metadata ×4
                  else: restricted.mark("非视频内容")
       else: restricted.mark("不是视频分享链接")
```

> ⚠️ 实现时注意两个已实测的引擎语义（详见 [RULE_GUIDE §二](../RULE_GUIDE.md)）：
> ① **跨块传值必须用 `$var.*`**（子序列下标会遮蔽外层）；
> ② `matcher.hosts` 命中即命中，`urlPatterns` 不能收窄——非目标链接要在规则内分支上报。

### 3.4 合成规则的署名与责任（**已决策：UI 必须标注**）

自动合成 ≠ 免责。规则中心必须明确标注三件事：

```text
由服务声明自动合成 · 服务地址：https://api.example.com · 作者：<服务清单 author>
规则来自 https://github.com/owner/repo 的 zhencangx-service.json
合成时间：2026-10-01 21:50
```

- `manifest.author` 记**服务作者**（来自清单 `author`，不允许留空，缺失即拒绝合成）；
- `manifest.source` 记 THIRD_PARTY；
- `meta.description` 自动追加：`由服务声明自动合成，服务地址 X，作者 Y`；
- 规则详情页顶部展示同一句标注——用户任何时候都能看出"这条规则不是我手写的，
  也不是帧藏X 官方的，而是来自某个服务的声明"；
- 服务失效/字段变更时，用户知道该找**服务作者**，而不是找帧藏X。

---

## 四、规则源订阅

### 4.1 语义

**订阅 = 用户把某个规则源"收藏"下来，之后可以一键检查更新。**
订阅**不等于**后台自动下载，也**不等于**自动启用——这两件事都不做。

### 4.2 订阅记录

```jsonc
{
  "sourceUrl": "https://raw.githubusercontent.com/owner/repo/main/zhencangx-rules.json",
  "kind": "rules",              // rules | service
  "title": "某某规则集合",
  "author": "owner",
  "subscribedAt": 1759300000000,
  "lastCheckedAt": 1759300000000,
  "lastKnownUpdatedAt": "2026-10-01",     // 清单里的 updatedAt
  "items": [
    { "moduleId": "user.doc.com.zhencangx.douyin.service", "name": "抖音视频解析",
      "installedVersion": "1.0.0", "availableVersion": "1.1.0", "sha256": "…" }
  ]
}
```

### 4.3 行为约束

| 项 | 规则 |
|---|---|
| 检查时机 | **仅用户手动触发**（规则中心「检查更新」）。不做后台轮询、不做启动自动检查 |
| 更新内容 | 只提示「有 N 条可更新」，逐条展示：名称 / 已装版本 / 新版本 / 内容哈希是否变化 |
| 安装 | 用户**逐条勾选**后才下载安装；仍走完整校验链 |
| 启用状态 | **升级后保持原启用状态**；**新出现的规则默认停用** |
| 哈希 | 清单提供 `sha256` 且与已装版本不同 → 标注「内容已变更」；校验失败即拒绝该条 |
| 授权 | **升级不继承旧授权**（沿用现有语义）：升级后若凭据档案变了，需重新授权 |
| 退订 | 可随时退订；退订**不卸载**已装模块，只是不再提示更新 |
| 请求节流 | 单次「检查更新」最多 8 个源、每源 1 次请求；失败不重试轰炸 |
| 失败透明 | 源不可达 / 哈希不符 / 清单非法 → 如实报错，不伪装成"已是最新" |

### 4.4 订阅为什么"手动化"

订阅天然引入"后台自动拉取规则"这一新风险面：规则一旦被上游篡改，
自动安装等于把执行权交给外部。因此本期只做**手动检查 + 逐条确认安装 + 哈希校验**三件套；
"自动更新"不在计划内。

---

## 五、仓库地址识别与发现顺序

### 5.1 接受的输入形态

| 形态 | 处理 |
|---|---|
| `https://github.com/{owner}/{repo}` | 分支探测 main → master，按 §5.2 顺序发现 |
| `https://github.com/{owner}/{repo}/tree/{branch}[/{path}]` | 在指定路径下发现 |
| `https://github.com/{owner}/{repo}/blob/{branch}/{file}` | 等价 raw 直取（**最有用**，用户可精确到文件） |
| `https://raw.githubusercontent.com/...` | 现有能力（任意 https 直链） |

### 5.2 发现顺序（每步失败即下一步，最终失败给可执行的下一步建议）

```
1. 若是 blob 链接                    → 直接当 raw 文件导入
2. {path}/zhencangx-rules.json       → L1 一键导入（可能多条）
3. {path}/zhencangx-service.json     → L2 合成导入
4. {path}/openapi.json 或 .yaml      → L2-B 骨架
5. 仓库文件树扫描（GitHub Contents API）：
   *.zrule / *.recipe.json → 逐个走正常导入（全部默认停用，列给用户挑）
6. 提取器源码识别（已有能力）：yt-dlp `_VALID_URL` / gallery-dl `pattern` → 脚手架
7. 都没有 → 明确告知「这是代码项目，帧藏X 不执行脚本，无法直接转换」，
   并给出：该项目 README 中接口地址/字段路径的常见位置 + 字段对照表 + 模板链接
```

### 5.3 GitHub API 速率限制下的降级

未认证 60 次/小时。策略：

- 优先只打 1–3 个**猜测路径**的 raw 请求（不需要 API），命中即用；
- 仅在需要文件树扫描时才调用 Contents API；
- 返回 403/429 时**如实告知**"GitHub API 限额，请改用文件 raw 链接或稍后再试"，
  **不要**伪装成"该仓库没有规则"。

---

## 六、方言（Format Adapter）扩展路线

现有方言：帧藏原生、gallery-dl、yt-dlp、streamlink。可扩展的**数据型**格式：

| 格式 | 可转换部分 | 分级 |
|---|---|---|
| QX / Surge / Loon 重写模块（`[rewrite_local]`） | `^https?://…` → matcher；`url …` 重写目标 → http.request 候选 | PARTIAL |
| TVBox / 猫影视 配置（type-0 数据型站点） | `api` / `ext` / `searchable` → http.request + 查询参数；`url` 模板 → JSONPath 线索 | PARTIAL |
| Tampermonkey 脚本（`@match` + `@grant`） | `@match` → matcher；正则与接口地址 → 步骤骨架 | PARTIAL |
| res-downloader 自定义规则 | 结构不通用，仅字段思路 | 手工移植 |
| yt-dlp / gallery-dl 提取器 | 已有脚手架 | ✅ PARTIAL |

每个方言都必须遵守 `DialectImporter` 的**铁律**：转换了什么、没转换什么、为什么，
逐项说清（`converted` / `skipped` / `reason`），不得显示"导入成功"后静默丢弃功能。

---

## 七、安全与信任清单（实现前逐条落实）

- [ ] 只允许 `https`（保持现有约束）
- [ ] **外部域名 `raw`：导入前展示完整 URL 列表，用户逐条勾选确认**（§2.4，已决策）
- [ ] 一键导入多条规则 → **全部默认停用**，逐条列出：名称 / 平台 / 能力 / 是否需要凭据 / 来源
- [ ] 规则源清单本身**不得**携带凭据值（只允许声明凭据档案规格）
- [ ] 合成规则与手写规则走**同一条**校验链，不做任何豁免
- [ ] 可选 `sha256`：不匹配即**拒绝该条**，并说明"声明的哈希与实际内容不符"
- [ ] 订阅：**仅手动检查更新**、逐条确认安装、哈希校验、退订不卸载（§4.3，已决策）
- [ ] L2 合成规则在详情页标注**「由服务声明自动合成 · 服务地址 X · 作者 Y」**（§3.4，已决策）
- [ ] 下载体积与超时沿用现有口径（单包 5MB / 15s；清单 256KB）
- [ ] 不引入任何形式的远程代码执行（包括"模板表达式"）——只做**数据到数据**的映射

---

## 八、明确不做

| 项 | 原因 |
|---|---|
| **接受第三方规则包格式**（自定义 zip、他方 manifest） | **已决策：暂不接受**。保持单一格式面（`zhencangx.recipe` / `.zrule` / `zhencangx-rules.json` / `zhencangx-service.json`），降低解析面与供应链风险 |
| 后台自动拉取 / 自动更新规则 | 订阅只做手动检查；规则被上游篡改时自动安装等于交出执行权（§4.4） |
| 执行任意代码（Python/JS 提取器、签名脚本） | 引擎架构与合规基线，不是"暂不做"而是"永远不做" |
| 代理 / 翻墙类能力 | 合规红线（见 docs/05 R-08） |
| 绕过登录 / 会员 / DRM | 合规红线，引擎无此通道 |

---

## 九、路线图（含订阅）

| 期 | 内容 | 预估 | 依赖 |
|---|---|---|---|
| **P0** | 仓库地址识别 + `zhencangx-rules.json` 解析 + 发现顺序 1–3 + **外部域名逐条确认 UI** | 3–4 人日 | 无（引擎已具备） |
| **P1** | `zhencangx-service.json` → Recipe 合成器（含 `$var` 跨块传递、署名标注） | 3–5 人日 | P0 框架 |
| **P1** | **规则源订阅**（订阅记录 + 手动检查更新 + 逐条安装 + 哈希校验 + 退订） | 3–4 人日 | P0 |
| P2 | 仓库文件树扫描 + GitHub API 限流降级提示 | 1–2 人日 | P0 |
| P3 | OpenAPI 骨架推导（L2-B） | 3–5 人日 | P1 |
| P4 | 方言扩展（QX/Surge、TVBox、Tampermonkey `@match`） | 每个 1–2 人日 | 现有 `DialectRegistry` |

改动面（预估）：

- `har_parser/rules/v2/module/`：新增 `RuleSourceParser`（清单解析）、`ServiceRuleSynthesizer`（L2 合成）、
  `RuleSourceSubscriptions`（订阅记录与比对，纯函数、可单测）；
  `RulePackageImporter` 增 `discoverFromRepo(url)`；
- `har_parser/rules/v2/dialect/`：新增方言实现 + `DialectRegistry` 注册；
- `entry/`：规则中心导入面板增「仓库地址」输入、「多规则挑选」与「外部域名确认」列表；
  新增「规则源订阅」页（检查更新 / 逐条安装 / 退订）；`AppBootstrap` 增对应 API；
- 测试：清单解析边界、发现顺序、外部域名确认门控、哈希校验、订阅比对与退订、
  合成产物编译与署名标注、限流降级文案。

---

## 十、决策记录

| # | 问题 | 决策（2026-10-01） | 落点 |
|---|---|---|---|
| 1 | 是否允许清单里的 `raw` 指向外部域名？ | **允许**，但导入前必须逐条展示完整 URL 并让用户勾选确认 | §2.4、§7 |
| 2 | 是否做"规则源订阅"？ | **做**：手动检查更新 + 逐条确认安装 + `sha256` 校验 + 退订不卸载；不做后台自动更新 | §4、§9 P1 |
| 3 | L2 合成规则的署名与责任归属？ | UI 明确标注 **「由服务声明自动合成 · 服务地址 X · 作者 Y」**，`manifest.author` 记服务作者 | §3.4、§7 |
| 4 | 是否接受 `.zrule` 之外的第三方包格式？ | **暂不接受**，保持单一格式面 | §8 |
