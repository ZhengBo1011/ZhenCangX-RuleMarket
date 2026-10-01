# 帧藏X 规则开发指南与注意事项

面向规则作者：如何从模板起步写出一条规则，以及**收录到本市场必须满足的要素要求**。
规则语言的完整参考见帧藏X 工程内 `docs/14-13-3规则模块与声明式规则语言参考.md`；
1.5.0 的能力放宽与安全模型见 `docs/17-1.5用户规则全面放开与第三方兼容方案.md`。

> 适用引擎版本：**帧藏X 1.5.0 及以上**（1.5.0 新增 `http.resolve`、`extract.jsonParse`、
> JSONPath 通配、`output.media` 下载头、`${}` 模板插值、自定义凭据档案、任意 https 导入）。

## 30 秒速查（第一次读本文先看这段）

```jsonc
{
  "schemaVersion": "2.0", "format": "zhencangx.recipe",
  "meta": { "id": "你的域.站点.用途", "name": "展示名", "author": "你的署名", "version": "1.0.0",
            "description": "覆盖什么链接、需要什么凭据、什么情况下会失效" },
  "matcher": { "hosts": ["站点域名"], "urlPatterns": ["站点域名/v/\\d+"], "priority": 10 },
  "capabilities": ["network", "json_parse", "media_resolve"],
  "steps": [
    { "kind": "extract.regex",    "input": "$input.url", "pattern": "/v/(\\d+)", "group": 1 },
    { "kind": "http.request",     "method": "GET", "url": "https://站点域名/api?id=$step.0" },
    { "kind": "extract.jsonPath", "input": "$step.1", "path": "$.data.playUrl" },
    { "kind": "output.media",     "url": "$step.2", "mimeType": "video/mp4", "extension": "mp4" },
    { "kind": "extract.jsonPath", "input": "$step.1", "path": "$.data.author.name" },
    { "kind": "output.metadata",  "key": "author",   "value": "$step.4" },
    { "kind": "extract.jsonPath", "input": "$step.1", "path": "$.data.publishTime" },
    { "kind": "output.metadata",  "key": "publishAt", "value": "$step.6" }
  ]
}
```

**四条必须做到**：① 能出媒体直链；② 有 `author`；③ 有 `publishAt`（epoch 毫秒，秒会自动换算）；
④ `matcher` 写真实覆盖范围、不冒充官方。做完在 **规则中心 → 规则调试** 试跑，再提 PR。

**动手前务必扫一眼 [§二 六个高频踩坑](#二️-六个高频踩坑都是引擎实测语义不是文档口径)**——
它们全部来自真机实测，踩中任何一条都会让你"规则编译通过但解析不出东西"。

**目录**

| 章节 | 内容 | 谁该看 |
|---|---|---|
| [§一 两个开发模板](#一两个开发模板) | 从模板起步 + 关键语法速查 | 所有人 |
| [§二 六个高频踩坑](#二️-六个高频踩坑都是引擎实测语义不是文档口径) | matcher 语义 / 跨块遮蔽 / body 无插值 / sort 字典序 / publishAt / 空值行为 | **所有人（必读）** |
| [§三 凭据三通道](#三凭据怎么用三条通道按推荐程度排序) | 自定义凭据档案（推荐）/ 内置平台 / 字面量头 | 需要登录态或 API Key 的规则 |
| [§四 收录要素要求](#四注意事项收录本市场的要素要求不满足不予收录) | 规则 / 平台 / 发布者 / 时间 / 标题封面 | 提 PR 前自查 |
| [§五 合法的"跳过登录"](#五什么叫合法的跳过登录) | 什么能做、什么绝对不能做 | 想写"免登录"规则的作者 |
| [§六 提交方式](#六提交方式) | PR / Issue + CI 自检 | 提 PR 时 |
| [附录 A 完整实例精读](./docs/WALKTHROUGH_DOUYIN.md) | 抖音规则逐步骤拆解（含分支与凭据） | **想学怎么写复杂规则的人** |

---

## 一、两个开发模板

### 1. 最小单文件模板（`templates/minimal.recipe.json`）

一条规则 = `matcher`（匹配哪些链接）+ `steps`（解析步骤流水线）+ `capabilities`（能力声明）。

改四处即可运行：

```jsonc
"matcher": { "hosts": ["目标站点.com"], "urlPatterns": ["目标站点\\.com/v/\\w+"] },  // ① 换站点
"steps": [
  { "kind": "http.request", "url": "https://接口地址/?id=..." },   // ② 换接口
  { "kind": "extract.jsonPath", "path": "$.data.video.playUrl" },  // ③ 换直链字段路径
  // ④ 换「发布者」「上传时间」两个字段路径（模板已内置 author / publishAt 两个
  //    output.metadata 输出 —— 值会展示在媒体库，缺了这两步媒体库就缺发布者和日期）
]
```

保存为 `.json` → 规则中心「从文件导入」或「粘贴导入」→ 调试台试跑 → 启用。

### 2. 完整规则包模板（`templates/full-package/`）

目录形态 `manifest.json + rules/*.json`（多选导入），或把两者封成一个
`{ "manifest": ..., "rules": [ ... ] }` 信封改后缀 `.zrule`（单文件导入）。
适用需要回滚、启停、多条规则共存的正式发布。

### 关键语法速查

| 事项 | 写法 |
|------|------|
| 引用 | `$input.url` 输入链接 · `$step.N` **同层**第 N 步产出 · `$var.名字` 命名变量 |
| 模板拼接 | `"url": "https://api.example.com/?id=${var.videoId}"` |
| 网络 | `http.request`（GET/POST/HEAD/PUT/DELETE/PATCH/OPTIONS）、`http.resolve`（短链展开取最终地址） |
| 抽取 | `extract.regex` / `extract.jsonPath`（支持 `[*]`、`.*` 通配）/ `extract.jsonParse`（页面内嵌 JSON）/ `extract.html.*` |
| 输出 | `output.media`（可带 `headers` 下载防盗链头）、`output.metadata`（约定键 `title`/`author`/`coverUrl`/`publishAt`） |
| 受限上报 | `restricted.mark`（原因支持自由文本；有上报时如实展示，不误报执行失败） |
| 能力 | `network` / `json_parse` / `html_parse` / `media_resolve` / `redirect` / `media_transform` / `auth_reference` / `cookie`（漏声明不影响安装，安装时自动取并集） |

### 开发建议流程

1. 粘贴平台分享文案到帧藏X首页 → 确认当前表现（命中情况、失败原因）；
2. 从模板改出规则 → **规则中心 → 规则调试**试跑（不下载、看轨迹）；
3. 启用后真实解析一条链接 → 出档位即成功；
4. 失效时用调试台看失败在哪一步，针对性更新并**升版本号**。

---

## 二、⚠️ 六个高频踩坑（都是引擎实测语义，不是文档口径）

### 1. `matcher.hosts` 命中就命中，`urlPatterns` **不能收窄**

引擎的匹配判定是：`hosts` 命中 **或** `urlPatterns` 命中 → 该规则命中；
两者都命中只是**具体度更高**（同域名多规则时优先）。所以

```jsonc
"hosts": ["example.com"], "urlPatterns": ["example\\.com/video/\\d+"]
```

**不会**把规则限制在 `/video/` 路径上——`example.com/user/xxx` 同样会命中本规则。

- 想让规则只覆盖特定形态：**不要把宽域名写进 `hosts`**，改成只靠 `urlPatterns` 命中
  （具体度较低但仍有效）；
- 或者接受宽命中，并在规则内用 `condition.*` + `control.branch` 对不支持的形态
  如实 `restricted.mark`（不要让它硬失败成一句 `HTTP 400`）。
  参考 `rules/douyin.recipe.json`：非视频链接走 `else` 分支上报「不是抖音视频分享链接」。

### 2. 跨块引用会被"遮蔽"，跨块传值请用 `$var`

`control.branch` 的 `then`/`else`、循环体各自是**独立下标空间**，解析顺序是
「先看本层，本层有该下标就取本层的，否则穿透到外层」。嵌套两层时极易误取本层
尚未执行的步骤：

```jsonc
// ❌ 内层块有 5 步，这里 $step.2 取的是内层第 2 步（还没执行），不是外层第 2 步
{ "kind": "output.media", "url": "$step.2" }
// ✅ 显式用变量跨块传递（变量表是执行级的，不受遮蔽影响）
{ "kind": "variable.set", "name": "mediaUrl", "value": "$step.2" },
{ "kind": "output.media", "url": "$var.mediaUrl" }
```

### 3. `http.request` 的 `body` **不支持** `$` / `${}` 插值

URL 与 headers 支持引用与模板插值；**请求体不支持**（写进去就是字面量）。
需要 POST 数据时，把参数放进 **URL 查询串**（可配合 `${var.xxx}`）：

```jsonc
"url": "https://api.example.com/parse?url=${var.shareUrl}&wait=25"
```

若目标接口只接受 JSON body，请先用 `transform.urlEncode` 把数据编码进查询串，
或换用支持查询参数的端点。

### 4. `collection.sort` 是**字典序**，不能按数值选最高画质

`"879059" > "1537788"`（字典序）——按 `bitrate` 排序会选错。选清晰度请：

- 优先用接口已给出的"最佳"字段（如 `$.data.media.video.url` 本身就是无水印最优档）；
- 或用 `collection.filter` 按正则筛出目标清晰度标签后再取首项；
- 不要用 `collection.sort` 处理纯数字量。

### 5. `publishAt` 要 **epoch 毫秒**，不支持日期字符串

`output.metadata key=publishAt` 的约定是 epoch 毫秒（**小于 1e11 视为秒并自动 ×1000**）。
引擎**没有**日期解析算子，所以：

- 站点返回 `publish_time` / `create_time`（数字）→ 直接用，最省事；
- 站点只返回 `2021-01-07T09:33:13Z` 这类 ISO 字符串 → 找同一响应里的数字时间字段
  （很多接口在 `include_raw` / `*_raw` / 原始 payload 里同时给 `create_time` 秒值）；
  实在没有就**省略该输出**（媒体库不显示日期），**禁止**写当前时间或猜值。

### 6. `output.metadata` 空值跳过，`output.media` 空值**报错**

`output.metadata` 取不到值时静默跳过（媒体库少一列，不报错）；
`output.media` 取不到 URL 时**整步失败**。所以不确定能取到直链时，
务必先用 `condition.exists` / `condition.equals` 分支，把"取不到"的路径导向
`restricted.mark`，而不是让它撞上 `output.media` 报错。

---

## 三、凭据怎么用（三条通道，按推荐程度排序）

| 通道 | 写法 | 凭据值在哪 | 适用 |
|------|------|-----------|------|
| **C｜自定义凭据档案（推荐）** | `auth: { profile, label, header, hosts, hint }` | 用户在规则中心填写，HUKS 加密 | 第三方规则引用**用户自己的** API Key / Token / Cookie（解析服务、需登录站点） |
| **A｜内置平台档案** | `auth: { "profile": "bilibili-main" }` | 用户的平台登录态 | 只覆盖帧藏X 内置平台（telegram / bili / x） |
| **B｜规则内字面量头** | `headers: { "X-API-Key": "明文" }` | **规则文件里，明文** | 仅限公开/演示凭据；⚠️ 一分享就泄露，且需用户启用时同意「携带凭据头」 |

### 通道 C 完整写法

```jsonc
"capabilities": ["network", "json_parse", "media_resolve", "auth_reference"],
"auth": {
  "profile": "douyin-service",          // 档案名：小写字母/数字/._-
  "label": "抖音解析服务 API Key",        // 授权界面展示名
  "header": "X-API-Key",                // 注入的请求头名（缺省 Cookie）
  "hosts": ["api.douyin.wtf"],          // 允许注入的域名（必填；不得含通配符/协议/端口/路径）
  "hint": "在服务控制台创建后粘贴"          // 填写指引
}
```

要点：

- **必须同时声明 `auth_reference` 能力**，否则编译期拒绝；
- 声明 `label` / `header` / `hint` 却**不声明 `hosts`** 会被编译期拒绝
  （不允许"以为约束生效了其实没有"）；
- 用 `header` 指向自己的域名不生效——凭据只会发往 `hosts` 里列出的域名
  （精确或子域后缀），指向别处一律不注入；所以 `hosts` 要列全（含自建服务域名）；
- **规则本体读不到凭据值**：引擎没有取凭据的 Operator，凭据只在发请求时装配进头；
- 规则描述里要**说清楚这个凭据是什么、会被发往哪里**（用户会看到，也才敢授权）；
- 本机/局域网地址（`127.0.0.1`、`localhost`、`192.168.*`、`10.*` 等）默认被网络策略拒绝，
  规则指向它们时，用户需要在规则中心开启「访问本机与局域网」授权——
  规则描述里请写明这一点（参考 `rules/douyin-local.recipe.json`）。

---

## 四、注意事项（**收录本市场的要素要求**，不满足不予收录）

### 1. 规则要素

- **格式**：必须是 `zhencangx.recipe` 2.0 单文件规则，或 `.zrule` 信封包；
  必须能通过帧藏X 导入校验链（清单 → 编译 → 安装），提交时附**成功导入与调试台命中的截图或描述**。
- **`meta.id` 全局唯一**：建议 `你的域.站点.用途` 形式（如 `com.alice.douyin`），不得与已有规则冲突。
- **`version`/`moduleVersion` 为三段数字**（`1.0.0`），**内容变更必须递增版本号**
  （帧藏X 靠版本号让旧解析缓存失效）；本仓库索引表同步维护「更新日期」列，
  失效规则 48 小时内升版修复或标注「已失效」，不得滞留可导入列表。
- **规则作者署名**：`meta.author` / `manifest.author` 必填真实可追溯（昵称 / GitHub ID / 主页），
  不得留空、写 `unknown` 或冒充他人与帧藏X 官方；第三方改编的规则在 `meta.description`
  注明原作者与来源链接（署名与许可证义务）；`manifest.license` 默认 `SEE_LICENSE`。
- **禁止脚本类操作符**：`eval`/`script`/`python`/`shell` 等在编译期即被拒绝——引擎是声明式
  Recipe，不执行任何代码；把逻辑拆成 `http.request` + `extract.*` + `transform.*` 步骤。
- **能力如实**：用到网络/JSON 解析的步骤，规则头部 `capabilities` 声明（引擎会自动并集，
  但声明完整是作者义务）。
- **受限内容如实上报**：会员、付费、禁存、无权限、非视频类型等情况用 `restricted.mark`
  如实标注，**不得**绕过或伪造成功；`restricted.mark` 只能收窄结果，引擎没有放行通道。
  取不到数据时请在 `message` 里写清楚**用户能做什么**（补凭据 / 换规则 / 换链接形态）。
- **下载头**：需要 Referer/UA 防盗链的站点，在 `output.media.headers` 声明。
- **导入默认停用**：本市场的规则链接导入后不会自动生效，需用户手动启用（设计如此，非缺陷）。

### 2. 平台要素

- **`matcher` 必须明确**：`hosts` 与 `urlPatterns` 写实际覆盖的域名与路径形态；
  短链域（如 `xhslink.cn`）、直链域（如 `www.xiaohongshu.com`）都要覆盖。
  ⚠️ 注意上面第 1 条踩坑：`hosts` 命中即命中，**不能靠 `urlPatterns` 收窄**——
  宽命中的链接形态要么在规则内分支如实上报，要么不把宽域名写进 `hosts`。
- **不得冒充官方**：`moduleId` 禁止 `official.` 前缀，`source` 不得写 `BUILTIN`
  （帧藏X 导入时强制拒绝）；描述里不得自称"官方/内置"。
- **只写你验证过的站点**：一条规则只覆盖其真实测试过的平台；
  跨平台请拆成多条规则或多规则包的 `rules/*.json` 多文件。
- **`supportedPlatforms`**（规则包）：填写规则实际覆盖的站点标识，
  与 `matcher` 保持一致（应用在规则中心展示给用户）。

### 3. 发布者要素（**视频的发布者**，用于媒体库展示）

> 注意：本节的「发布者」指规则**解析到的视频的作者/UP 主/昵称**，
> 不是规则作者（规则作者的要求见第 1 节「规则作者署名」）。

- **规则必须提取视频发布者**并经 `output.metadata key=author` 输出：

  ```jsonc
  { "kind": "extract.jsonPath", "input": "$step.2", "path": "$.data.author.nickname" },
  { "kind": "output.metadata", "key": "author", "value": "$step.N" }
  ```

  该值会随任务进入媒体库，在条目信息行展示为 `发布者 · 平台 · 发布日期`；
  缺这一步，媒体库该条目将**没有发布者**。
- **字段路径以目标站点真实字段为准**（接口返回或页面嵌入 JSON 里的昵称/用户名），
  提交前用规则调试台验证取值非空；帧藏X 示例参考：
  小红书为 `$.noteData.data.noteData.user.nickName`，抖音（经解析服务）为
  `$.data.author.nickname`。
- **不得伪造**：发布者必须来自站点数据，禁止硬编码他人昵称或写规则作者的名字顶替。
- 站点确实不提供发布者字段时，可在 `meta.description` 注明「该站点无发布者字段」，
  此时省略该输出（媒体库留空，不报错）。

### 4. 日期要素（**视频的上传/发布时间**，用于媒体库展示）

> 注意：本节的「时间」指规则**解析到的视频的发布时间**，
> 不是规则的版本日期（版本与索引日期的要求见第 1 节）。

- **规则必须提取视频上传/发布时间**并经 `output.metadata key=publishAt` 输出：

  ```jsonc
  { "kind": "extract.jsonPath", "input": "$step.2", "path": "$.data.video.publishTime" },
  { "kind": "output.metadata", "key": "publishAt", "value": "$step.N" }
  ```

  **值为 epoch 毫秒**；若站点给的是秒（小于 1e11），帧藏X 会自动换算为毫秒。
- **常见来源**：接口的 `publish_time` / `create_time` 字段、页面嵌入 JSON 的 `time` 字段；
  帧藏X 示例参考：小红书为 `$.noteData.data.noteData.time`（毫秒），
  抖音（经解析服务）为 `$.data.raw.create_time`（秒）。
- 提交前用规则调试台确认取值是数字且量级正确（13 位是毫秒、10 位是秒）。
- **不得写入错误时间**：取不到时省略该输出（媒体库不显示日期），禁止用当前时间或猜值填充。
  站点只给 ISO 8601 字符串时，见上面第 5 条踩坑的处理办法。

### 5. 标题与封面（**建议输出**，用于媒体库与文件名）

- `output.metadata key=title`（标题，来自站点描述/标题字段）；
- `output.metadata key=coverUrl`（封面图直链）；
- 两者缺失不会报错，但媒体库体验会明显变差（无标题、无封面）。

---

## 五、什么叫合法的"跳过登录"

"第三方规则可以跳过登录"是常见诉求，但边界必须写清楚——**引擎层面也不存在绕过通道**：

| ✅ 允许（本市场鼓励） | ❌ 禁止（编译期或合规层拒绝，且引擎无此能力） |
|---|---|
| 对平台**本就匿名开放**的公开内容，改走不依赖登录态的解析路径（如改用公开分享页、公开接口） | 破解登录、伪造账号身份、绕过验证码/短信校验 |
| 由**用户自己**提供自己的 Cookie / API Key（通道 A / C），以用户自己的身份访问用户有权访问的内容 | 使用他人凭据、批量共享账号、凭据窃取 |
| 选择平台给匿名用户的可用清晰度（哪怕是较低档） | 绕过会员/付费墙/DRM 获取本无权访问的清晰度 |
| 如实上报"该内容需要登录，请先授权凭据" | 伪造"解析成功"或把受限内容包装成正常媒体 |

换句话说：**"跳过登录"只能指"不强制用户登录"，绝不能指"绕过平台的访问控制"。**
规则做到前者即可，后者既违反平台条款，也违反帧藏X 的合规红线，且没有任何实现路径。

---

## 六、提交方式

1. Fork 本仓库，把规则文件放进 `rules/`（模板起步的请先跑通调试台）；
2. 同步更新 `README.md` 索引表（说明 + raw 链接 + 更新日期 + 是否需要凭据）；
3. 发起 PR，附规则的调试台命中截图或失败/成功描述；
4. 或者在 Issue 中贴 raw 链接（gist 亦可），由维护者验收后代为收录。

PR 会自动跑 [.github/workflows/validate-rules.yml](./.github/workflows/validate-rules.yml)
（脚本 [`tools/validate-rules.mjs`](./tools/validate-rules.mjs)），本地可先自检：

```bash
node tools/validate-rules.mjs rules
```

它会拦住这些硬伤：JSON 非法 / `format`/`schemaVersion` 不对 / `meta.id` 重复或带 `official.` 前缀 /
版本号不是三段 / 作者留空或写 `unknown` / `hosts` 含通配符 / 正则编译不过 / 能力名未知 /
用了脚本类操作符 / **缺 `author` 或 `publishAt` 输出** / 内嵌凭据类字面量头未在描述里明示 /
指向本机地址却没说需要开内网授权 / `auth` 声明了 `header` 却漏了 `hosts`。
原生示例文件（`rules/sample-0*.json|.zrule`）豁免四要素要求，但仍做结构校验。

> ⚠️ **结构校验通过 ≠ 规则可用。** 脚本无法判断"这条规则能不能真的解析出视频"，
> 那必须由你用规则中心的**规则调试台**在真实链接上验证，并在 PR 里附上证据。

**验收口径**：四要素齐（直链 + 标题 + 发布者 + 发布时间）+ 能导入 + 调试台命中 + 说明无误导。
链式要求见上。
