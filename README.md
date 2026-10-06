# ZhenCangX-RuleMarket · 帧藏X 规则市场

[帧藏X](https://github.com/ZhengBo1011/ZhenCangX)（主仓库，私有）的**规则应用市场**：整理与发布可直接导入的解析规则、开发模板与第三方规则链接。

> 本页分两大板块：**普通用户**复制链接即可导入使用；**开发者**从模板起步开发规则并了解注意事项。

---

# 📱 面向普通用户

## 使用方法（三步）

1. **复制**下方表格中任意规则的「导入链接（raw）」；
2. 打开帧藏X → **我的 → 规则中心** → 导入面板（顶栏「粘贴导入」或「从网络导入」）；
3. **粘贴链接** → 校验并安装 → 回列表**启用**该规则（导入默认停用，需手动启用，这是安全设计）。

> 也可以在系统浏览器或文件管理器打开 raw 链接，选择「用帧藏X打开」，直达导入面板。
> 解析失败时可用规则中心的「规则调试」看卡在哪一步；规则随平台改版可能失效，以更新日期为准。
>
> 若某条规则「需要凭据」，请在 **规则中心 → 该条规则 → 凭据授权** 里填写你自己的密钥并授权。
> 密钥经 HUKS 加密存储在本机，**规则文件里读不到它**，且只会发往规则声明的域名，可随时撤回。

## 现成规则（复制链接直接导入）

| 规则 | 说明 | 需要凭据 | 导入链接（raw） | 更新日期 |
|------|------|---------|----------------|---------|
| 小红书视频笔记解析 | 分享短链 `xhslink.cn` / 网页直链均可；提取直链、作者、发布时间，携带防盗链头下载；仅视频笔记 | 否 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/xiaohongshu.recipe.json` | 2026-10-01 |
| **抖音视频解析（解析服务）** | **主推**。短链展开 → 调解析服务 → 输出**无水印**直链 + 标题 / 发布者 / 发布时间 / 封面 | **是**（解析服务 API Key，自定义档案 `douyin-service`） | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/douyin.recipe.json` | 2026-10-01 |
| 抖音视频解析（本机服务） | 指向你在本机/局域网自建的服务（默认 `127.0.0.1:8080`），需在规则中心开启「访问本机与局域网」授权 | 否（自建实例若开鉴权需自行加头） | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/douyin-local.recipe.json` | 2026-10-01 |
| 抖音视频解析（匿名降级说明） | 不触网，仅如实说明「为什么匿名解析不了」及解决办法。适合暂时不想配密钥的用户 | 否 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/douyin-anonymous.recipe.json` | 2026-10-01 |
| X（推特）无登录解析（社区规则） | 全程匿名不登录：guest 访客令牌 + 公开 GraphQL 主通道，FxTwitter 公开镜像备通道；公开推文多码率 mp4 直链 + 标题 / 作者 / 封面 / 日期。敏感、受保护等仅登录可见内容会如实上报受限 | 否（启用时需同意「携带凭据头」——发送的 `Authorization` / `x-guest-token` 均为 X 网页客户端公开常量，非个人凭据） | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/x-nologin-rule-package.zrule` | 2026-10-06 |

### 关于抖音：为什么必须经解析服务？

2026-10 端侧实测结论（**不是规则写得不好，是平台侧加固**）：

- `v.douyin.com/xxx` 短链仍可 302 展开 ✅；
- 分享页 `window._ROUTER_DATA` 已**不再下发** `videoInfoRes` / `play_addr` ❌；
- web 详情接口返回 **403 ArgusSecurityPlugin**（需 `a_bogus` 签名 + 客户端指纹）❌；
- 旧 `iteminfo` 接口返回 **空响应体** ❌；换爬虫 UA 亦无效 ❌。

所以任何"复制一条规则就能匿名解析抖音"的说法都不成立。上表三条抖音规则是**并列模块**：

- 有解析服务（公共实例自备 API Key，或本机自建）→ 用前两条，能拿无水印原片；
- 都没有 → 用第三条，至少能拿到一句明确的解释和解决路径；
- 同时启用多条也没关系，帧藏X 会按具体度择优，也可以只启用其中一条。

> ⚠️ 「解析服务」规则默认指向公共实例 `https://api.douyin.wtf`（**第三方服务**）。
> 你的链接会经该服务解析，请自行评估信任与隐私；在意隐私请改用「本机服务」规则。
> 本机自建可参考 [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)（docker 起一个即可）。

### 关于 X（推特）无登录解析：能做什么、不能做什么

**适用人群**：X 账号被平台限制登录、无法在应用内登录，但仍想下载自己**本来就能看到的公开视频**的用户。
这正是帧藏X 内置 X 解析的匿名通道之外的一条**社区兜底**（规则由社区维护，与帧藏X 官方开发无关）。

**两条通道，都只走平台/社区对匿名访客开放的公开出口**（实现思路与 [yt-dlp](https://github.com/yt-dlp/yt-dlp)、
[FxTwitter](https://github.com/FxEmbed/FxEmbed) 等开源项目一致，感谢这些维护者）：

1. **主通道 · X 公开 GraphQL**：公开 Web Bearer 换取临时访客令牌 → `TweetResultByRestId`，
   提取推文全部 mp4 变体直链（多码率）+ 标题 / 作者 / 封面；
2. **备通道 · FxTwitter 公开镜像**：主通道未取得视频时自动改走 `api.fxtwitter.com`（第三方公共实例，
   限流 1000 次/分/IP，可自托管后改规则里的域名），并补充发布时间。

**边界（如实说明）**：只覆盖**公开推文**。敏感（NSFW）、受保护、仅登录可见的内容，匿名通道本就拿不到
——规则会如实上报受限原因，不会伪装成失败或绕过任何访问控制。已删除推文与纯图文推文会得到明确提示。

**维护**：X 前端发版可能更换 GraphQL 的 `queryId`。失效时**改规则文件即可修复，无需升级 App**：
从 X 网页版开发者工具的请求里取最新 queryId，更新规则 `variables.queryId` 后重新导入（或提 PR 升版本号）。


## 📎 社区共享文档

**[帧藏X 规则共享文档（金山文档）](https://www.kdocs.cn/l/cn40bZCWccah)** —— 社区协作收集的
规则链接与使用心得，在线查看、直接复制其中的导入链接使用，也欢迎在线补充你找到的规则。

> 同一链接也可在帧藏X **规则中心 →「规则共享文档」**入口一键打开（系统浏览器）。

---

# 🛠 面向开发者

一条规则 = `matcher`（匹配哪些链接）+ `steps`（解析步骤流水线）+ `capabilities`（能力声明）。
引擎是声明式 Recipe（**不执行任何脚本**），完整语言参考见帧藏X 工程内
`docs/14-13-3规则模块与声明式规则语言参考.md`，本仓库细则见 [RULE_GUIDE.md](./RULE_GUIDE.md)。

## 📚 文档地图（按"我想做什么"选）

| 我想… | 看这篇 |
|---|---|
| 从零写一条能跑的规则 | [RULE_GUIDE.md](./RULE_GUIDE.md) §一模板 + §二**必读的六个坑** |
| 看懂一条真实复杂规则（分支 / 凭据 / 跨块传值） | [docs/WALKTHROUGH_DOUYIN.md](./docs/WALKTHROUGH_DOUYIN.md) 完整实例精读 |
| 知道收录要满足什么 | [RULE_GUIDE.md](./RULE_GUIDE.md) §四要素要求 |
| 处理"需要登录 / 需要 API Key" | [RULE_GUIDE.md](./RULE_GUIDE.md) §三凭据三通道 |
| 确认"免登录"规则是否越线 | [RULE_GUIDE.md](./RULE_GUIDE.md) §五合法的"跳过登录" |
| 提 PR 前自检 | `node tools/validate-rules.mjs rules` |
| 了解"复制 GitHub 地址就能导入" | [docs/RULE_SOURCE_SPEC.md](./docs/RULE_SOURCE_SPEC.md) |

> 全部文档索引：[docs/README.md](./docs/README.md)

## 开发模板（从这里起步）

| 模板 | 用途 | 链接（raw） |
|------|------|------------|
| 最小单文件模板 | 从零改出一条可运行规则（改 matcher / 接口地址 / 直链字段 / 发布者与时间字段四处） | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/templates/minimal.recipe.json` |
| 完整规则包模板 | manifest + rules/ 目录形态（可回滚、可启停的正规发布形态） | 目录见 [templates/full-package/](./templates/full-package)，下载两个文件后在规则中心「从文件导入」多选 |

## 语法示例（最常用能力）

| 事项 | 写法 |
|------|------|
| 引用 | `$input.url` 输入链接 · `$step.N` **同层**第 N 步产出 · `$var.名字` 命名变量 · `${var.xxx}` 模板拼接 |
| 网络 | `http.request`（GET/POST/HEAD/PUT/DELETE/PATCH/OPTIONS）· `http.resolve`（短链展开取最终地址） |
| 抽取 | `extract.regex` / `extract.jsonPath`（支持 `[*]`、`.*` 通配）/ `extract.jsonParse`（页面内嵌 JSON）/ `extract.html.*` |
| 输出 | `output.media`（可带 `headers` 防盗链下载头）· `output.metadata`（约定键 `title`/`author`/`coverUrl`/`publishAt`） |
| 受限上报 | `restricted.mark`（原因支持自由文本；如实上报，引擎没有放行通道） |
| 能力 | `network` / `json_parse` / `html_parse` / `media_resolve` / `redirect` / `media_transform` / `auth_reference` / `cookie` |

## ⚠️ 六个高频踩坑（先看这节再动手）

1. **`matcher.hosts` 命中就命中，`urlPatterns` 不能收窄** ——
   `hosts: ["example.com"]` 会让该域名下**任何**链接命中本规则。要收窄就别把宽域名写进 `hosts`，
   或在规则内用分支对不支持的形态如实 `restricted.mark`。
2. **跨块引用会被遮蔽** —— 嵌套分支/循环里 `$step.N` 先按本层解析；跨块传值一律用 `$var.*`。
3. **`http.request` 的 `body` 不支持 `${}` 插值** —— 参数请放进 URL 查询串。
4. **`collection.sort` 是字典序** —— 不能用它按码率/分辨率选最高画质。
5. **`publishAt` 要 epoch 毫秒** —— 站点只给 ISO 字符串时，去找同一响应里的数字时间字段；
   实在没有就省略该输出，**不要**填当前时间。
6. **`output.media` 空值会报错** —— 直链可能取不到时，先用 `condition.*` 分支导向 `restricted.mark`。

## 凭据：优先用「自定义凭据档案」

需要用户自己提供 API Key / Cookie 时，**不要**把密钥明文写进规则文件，改用通道 C：

```jsonc
"capabilities": ["network", "json_parse", "media_resolve", "auth_reference"],
"auth": {
  "profile": "douyin-service",          // 档案名（小写字母/数字/._-）
  "label": "抖音解析服务 API Key",        // 用户看到的展示名
  "header": "X-API-Key",                // 注入的请求头名（缺省 Cookie）
  "hosts": ["api.douyin.wtf"],          // 允许注入的域名（必填；不得含通配符）
  "hint": "在服务控制台创建后粘贴",        // 填写指引
  "loginUrl": "https://example.com/login" // 可选：界面会出现「通过网页登录获取」入口
}
```

用户导入后在规则中心填值并授权；密钥 HUKS 加密存储、规则读不到、只发往 `hosts` 里的域名。
**声明 `loginUrl`（https）后**，凭据卡片会多出「通过网页登录获取」按钮：用户在内嵌网页里
登录自己的账号，应用自动从 `hosts` 声明的域取 Cookie 存为该档案的值——适合需要登录态的站点。
指向本机/局域网（`127.0.0.1` 等）的规则，用户在规则中心开启「访问本机与局域网」后才放行。

> ⚠️ 不是所有站点都能靠 Cookie 拿到数据：需要请求签名（如抖音的 `a_bogus`）的平台
> 单有 Cookie 仍会被拒，请改用「服务型规则」（把签名交给服务）。

## 规则中心页面结构（1.5.0 三级导航）

```text
我的 / 首页
 └─ 规则中心（二级）            ← 模块列表 + 四个入口
     ├─ 模块详情（三级）         ← 凭据授权 / 高级权限 / 启用停用 / 回滚 / 删除
     ├─ 规则包导入（三级）        ← 粘贴 / 文件 / 网络地址；外部打开规则文件也进这里
     ├─ 示例与说明（三级）        ← 快速上手、六个踩坑、凭据、合规边界、6 个内置示例
     ├─ 规则调试台（三级）
     └─ 网页登录获取凭据（三级）   ← 声明了 auth.loginUrl 的凭据档案才有
```

三级页面返回即回规则中心列表（不再直接退出规则中心）。

## 第三方 · 参考脚本仓库（不能直接导入，供移植）

以下仓库是**代码**（Python/JS），帧藏X 引擎不执行脚本；价值在提取其中的
「URL 模式、接口地址、字段路径」，按 [RULE_GUIDE.md](./RULE_GUIDE.md) 手工转成声明式步骤，
或把提取器源码粘贴导入自动生成脚手架。

> 「**复制 GitHub 项目地址就能直接导入使用**」目前**尚不支持**。规范已定稿（含四项决策：
> 允许清单指向外部域名但需逐条确认、做规则源订阅、合成规则标注服务来源与作者、
> 不接受第三方包格式），代码尚未实现。规范与分级见
> [docs/RULE_SOURCE_SPEC.md](./docs/RULE_SOURCE_SPEC.md)。
>
> 简言之：仓库若提供 `zhencangx-rules.json`（规则清单）或 `zhencangx-service.json`
> （服务声明，配 `openapi.json` 可自动合成规则）→ 可实现一键导入；
> 纯代码爬虫项目（绝大多数）**永远不能**直接转换——帧藏X 不执行脚本。

| 仓库 | 用途 | 移植方式 |
|------|------|---------|
| [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) | 通用视频提取器标准 | 取某站点 `_VALID_URL` 源码粘贴导入 → 脚手架；其余步骤手工补 |
| [mikf/gallery-dl](https://github.com/mikf/gallery-dl) | 图库/画廊下载 | 同上（识别 `pattern` 声明）；JSON 配置仅参数层可识别 |
| [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) | 抖音/TikTok 解析 API（约 20k★） | **本仓库抖音规则的默认服务**；可 docker 自建后配合 `douyin-local` 规则使用 |
| [putyy/res-downloader](https://github.com/putyy/res-downloader) | 资源嗅探下载器（约 20k★） | 其自定义规则的字段思路可参考；格式不通用，需手工移植 |
| [Johnserf-Seed/f2](https://github.com/Johnserf-Seed/f2) | 多平台异步框架（按平台 YAML 配置） | 端点/请求头配置可参考移植 |
| [NanmiCoder/MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) | 浏览器驱动爬虫（约 60k★） | 依赖注入签名脚本，不适用声明式引擎；仅作字段路径参考 |

## 注意事项（收录本市场的要素要求，不满足不予收录）

- **规则**：必须是 `zhencangx.recipe` 2.0 或 `.zrule` 包且能通过导入校验链（附调试台命中说明）；
  `meta.id` 全局唯一；**内容变更必须递增三段版本号**（用户端缓存与回滚依赖它），索引表同步维护
  「更新日期」、失效规则 48 小时内升版或标注；`meta.author`/`manifest.author` 必填真实可追溯
  （规则作者署名，禁止留空或冒充），改编规则署名原作者与来源；
  禁止脚本类操作符（引擎不执行代码）；受限内容必须 `restricted.mark` 如实上报。
- **凭据**：优先用自定义凭据档案（通道 C，见上）；若确实要写凭据类**字面量**请求头，
  必须在描述中明示「该凭据是公开/演示用途，会随规则文件泄露」，且用户启用时会被要求授权。
- **平台**：`matcher` 写实际覆盖的域名与路径形态；⚠️ `hosts` 命中即命中、`urlPatterns` 不能收窄；
  `moduleId` 禁止 `official.` 前缀、不得冒充官方。
- **发布者（视频）**：规则须提取**视频的发布者**（站点的昵称/用户名字段）并经
  `output.metadata key=author` 输出——该值展示在媒体库条目信息行（`发布者 · 平台 · 发布日期`），
  缺这步媒体库就没有发布者；字段必须来自站点数据，禁止伪造。
- **时间（视频上传时间）**：规则须提取**视频的上传/发布时间**并经
  `output.metadata key=publishAt` 输出（epoch 毫秒，站点给秒会自动换算）——该值展示在媒体库的
  发布日期；取不到就省略该输出，禁止写入错误时间。
- **标题 / 封面**：建议一并输出 `title` 与 `coverUrl`。

> 完整细则与提交验收口径见 [RULE_GUIDE.md](./RULE_GUIDE.md)。

---

## 参与

提交你的规则：Fork → 放入 `rules/` → 更新本页索引表（说明 + raw 链接 + 更新日期 + 是否需要凭据）→ PR；
或开 Issue 附 raw 链接（gist 亦可），由维护者验收后代为收录。
CI 会对 `rules/*.json` 跑结构校验（见 [.github/workflows/validate-rules.yml](./.github/workflows/validate-rules.yml)）。

## 免责

本仓库收录的第三方规则来自社区，帧藏X 不为其背书；导入即表示你理解「下载 ≠ 信任」，
请仅用规则归档你合法可访问的公开内容。规则随平台改版可能失效，以更新日期为准。
