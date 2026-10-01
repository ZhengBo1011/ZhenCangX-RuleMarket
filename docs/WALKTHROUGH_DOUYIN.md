# 附录 A · 完整实例精读：抖音规则

> 目的：用一条**真实在用的规则**把 [RULE_GUIDE](../RULE_GUIDE.md) 里的概念串起来。
> 读完本文你应该能：看懂任何一条复杂规则，并把本结构改成别的平台。
>
> 对照文件：[`rules/douyin.recipe.json`](../rules/douyin.recipe.json)
> 相关：[`rules/douyin-local.recipe.json`](../rules/douyin-local.recipe.json)（同一结构、改指向本机服务）、
> [`rules/douyin-anonymous.recipe.json`](../rules/douyin-anonymous.recipe.json)（不触网的诚实降级规则）

---

## 0. 先看结论：这条规则在做什么

```
用户粘贴的抖音分享链接
   ↓ ①http.resolve        展开 v.douyin.com 短链，拿到最终地址
   ↓ ②extract.regex       从最终地址里取出视频 ID
   ↓ ③condition.exists    ID 取到了吗？
   ├─ 没取到 → restricted.mark「不是抖音视频分享链接」（如实上报，不报错）
   └─ 取到 → ④http.request 调解析服务拿视频信息
              ↓ ⑤extract.jsonPath 取值 → ⑥variable.set 存进变量
              ↓ ⑦condition.equals 是不是视频？
              ├─ 是 → output.media（无水印直链）+ output.metadata ×4
              └─ 否 → restricted.mark「图文/图集或服务无结果」
```

**为什么是这个形状**——三条都是被引擎语义逼出来的（见下），不是审美选择。

---

## 1. 头部：meta / matcher / capabilities / auth / variables

```jsonc
{
  "schemaVersion": "2.0",
  "format": "zhencangx.recipe",
  "meta": {
    "id": "com.zhencangx.douyin.service",   // ① 全局唯一
    "name": "抖音视频解析（解析服务）",
    "author": "帧藏X 官方规则",              // ② 必填且真实可追溯
    "version": "1.0.0",                     // ③ 三段数字；改内容必须 +1
    "description": "…"                      // ④ 写清：覆盖范围 / 需要什么凭据 / 何时会失效
  },
  "matcher": {
    "hosts": ["v.douyin.com", "douyin.com", "iesdouyin.com"],
    "urlPatterns": [
      "douyin\\.com/video/\\d+",
      "douyin\\.com/(?!(?:discover|user|search|following|recommend)(?:/|$))[A-Za-z0-9_-]{5,}",
      "iesdouyin\\.com/share/(?:video|note)/\\d+"
    ],
    "priority": 30
  },
  "capabilities": ["network", "json_parse", "media_resolve", "redirect", "auth_reference"],
```

**① meta.id**：单文件规则导入时会自动推导模块 ID（`user.doc.<净化后的规则 id>`），
所以取一个像域名的名字最稳。

**② description 不是摆设**：规则中心会把原文展示给用户；用户看到"需要 API Key"
才知道去哪里填。写清失效情形也能减少"这条规则坏了"的误报。

**③ version**：引擎靠它让旧解析缓存失效。改了内容不升版本，用户的缓存不会刷新。

**④ matcher 的真相（踩坑 1）**：
`hosts` 命中**单独即可命中**，`urlPatterns` 只是**加分项**。
所以 `hosts` 里写了 `douyin.com`，`douyin.com/user/xxx` **同样会命中本规则**。
这就是规则里必须有第 ③ 步"ID 取到了吗"分支的原因——否则用户主页链接会直接
撞上 `http.request` 的 HTTP 400，报一句看不懂的错。

> 想真正收窄？**不要把宽域名写进 `hosts`**，只留窄域（如只有 `v.douyin.com`），
> 其余靠 `urlPatterns` 命中。代价是具体度下降；两种做法都合法，看你要什么。

**⑤ capabilities**：声明了才能用对应步骤。`auth_reference` 是"引用凭据档案"的门票，
漏了就编译不过。1.5.0 起模块能力会自动取并集，但**声明完整是作者义务**。

**⑥ auth：自定义凭据档案（本规则的关键）**

```jsonc
"auth": {
  "profile": "douyin-service",       // 档案名（用户不需要知道，只用于绑定）
  "label": "抖音解析服务 API Key",     // 用户看到的"要填什么"
  "header": "X-API-Key",             // 注入成哪个请求头
  "hosts": ["api.douyin.wtf"],       // 允许发往哪里（必填！）
  "hint": "在解析服务控制台创建 API Key 后粘贴…"
}
```

- 用户导入后，规则中心会出现一个输入框，填完点「保存并授权」；
- 值存 HUKS 加密仓库，**规则本体读不到它**（引擎没有取凭据的算子）；
- 只有用户显式授权、且目标主机在 `hosts` 内时才注入；
- **`hosts` 是唯一约束**：写漏了域名 = 凭据不会发过去 = 规则报"凭据为空"。
  自建服务请把域名补进 `hosts`。

**⑦ variables：给"常量"起名字**

```jsonc
"variables": [
  { "name": "base", "value": "https://api.douyin.wtf" },   // 服务地址，改这一处即可指向自建
  { "name": "ua",   "value": "Mozilla/5.0 (iPhone; …" },
  { "name": "referer", "value": "https://www.douyin.com/" },
  { "name": "awemeId", "value": "" }                        // 先占位，后面 variable.set 覆写
]
```

好处：地址/UA 只写一遍；引用用 `$var.名字`，**跨块传值不受下标遮蔽影响**（踩坑 2）。

---

## 2. 前半段：拿 ID，取不到就如实上报

```jsonc
{ "kind": "http.resolve", "url": "$input.url", "headers": { "User-Agent": "$var.ua" },
  "timeoutMs": 15000 },                                    // 步 0
{ "kind": "extract.regex", "input": "$step.0",
  "pattern": "/(?:video|note)/(\\d{6,})", "group": 1, "all": false },  // 步 1
{ "kind": "variable.set", "name": "awemeId", "value": "$step.1" },     // 步 2
{ "kind": "condition.exists", "left": "$step.1" },                     // 步 3
{ "kind": "control.branch", "condition": "$step.3",
  "then": [ /* 见第 3 节 */ ],
  "else": [
    { "kind": "restricted.mark",
      "reason": "不是抖音视频分享链接",
      "message": "该链接未解析出抖音视频 ID：可能指向用户主页、发现页或直播间…请使用抖音 App 的「分享 → 复制链接」…" }
  ] }                                                                    // 步 4
}
```

**为什么要 `http.resolve` 而不是 `http.request` + `followRedirects`**：
`http.resolve` 的产出是**最终生效的 URL**，正是我们要的东西；用 `http.request` 只能拿到
响应体，还得再从 HTML 里刨地址。短链展开 `v.douyin.com/xxx → iesdouyin.com/share/video/{id}`
就是它最典型的用途。

**为什么要 `variable.set` 再 `condition.exists`**：
`condition.exists` 判断的是"引用解出来非空"。直接判断 `$step.1` 也行，
但先存变量让后面的步骤有稳定名字（步骤增删不会连带改引用）。

**`else` 分支的意义**：让"不支持的链接形态"变成**一句人话**，而不是
`规则 xxx 执行失败：HTTP 400`。这是"如实上报"的具体做法：
`restricted.mark` 只收窄结果，不会伪造成功，也不会被当成执行失败。

---

## 3. 中段：调服务、取值、存进变量

```jsonc
"then": [
  { "kind": "http.request", "method": "GET",
    "url": "${var.base}/api/v1/douyin/video?aweme_id=${var.awemeId}&wait=25&include_raw=true",
    "headers": { "User-Agent": "$var.ua", "Accept": "application/json" },
    "timeoutMs": 45000 },                                   // then 步 0
  { "kind": "extract.jsonPath", "input": "$step.0", "path": "$.data.kind" },   // 1
  { "kind": "variable.set", "name": "kind", "value": "$step.1" },              // 2
  { "kind": "extract.jsonPath", "input": "$step.0", "path": "$.data.media.video.url" }, // 3
  { "kind": "variable.set", "name": "mediaUrl", "value": "$step.3" },          // 4
  { "kind": "extract.jsonPath", "input": "$step.0", "path": "$.data.title" },  // 5
  { "kind": "variable.set", "name": "mediaTitle", "value": "$step.5" },        // 6
  { "kind": "extract.jsonPath", "input": "$step.0", "path": "$.data.author.nickname" }, // 7
  { "kind": "variable.set", "name": "mediaAuthor", "value": "$step.7" },       // 8
  { "kind": "extract.jsonPath", "input": "$step.0", "path": "$.data.raw.create_time" }, // 9
  { "kind": "variable.set", "name": "mediaAt", "value": "$step.9" },           // 10
  { "kind": "extract.jsonPath", "input": "$step.0", "path": "$.data.media.covers[0].url" }, // 11
  { "kind": "variable.set", "name": "mediaCover", "value": "$step.11" },       // 12
  { "kind": "condition.equals", "left": "$var.kind", "right": "video" },       // 13
  { "kind": "control.branch", "condition": "$step.13", "then": [ /* 第 4 节 */ ], "else": [ … ] } // 14
]
```

要点逐个说：

**`${var.base}` 模板插值**：字符串里任意 `${表达式}` 会按引用空间求值后拼接。
编译期会逐片段校验引用合法性——写错变量名当场报错，不会拖到运行期。

**`input: "$step.0"` 在这里指的是 `then` 自己的第 0 步**。
子序列是**独立下标空间**：`then` 的第 1 步引用 `$step.0` 就是 `then` 的第 0 步（那个 HTTP 响应）。
这跟"引用外层"是两回事，见踩坑 2。

**为什么每个提取都紧跟一个 `variable.set`（踩坑 2）**：
内层分支里写 `$step.N` 会**先按本层解析**。本层只有 15 步，所以内层想引用
"外层第 3 步"时，如果那个下标 < 内层步数，就会被**遮蔽**成内层自己的步骤（通常还没执行）。
用 `$var.*` 绕开整个问题：变量表是执行级的，没有遮蔽。

**`$.data.media.video.url` 已经是无水印最优档**（实测 `watermark: false`），
不需要再挑 `streams[*]`。另外 `media.streams` 里有一条 `watermark: true` 的 720×720，
用错了会下到带水印的版本——这也是"不要盲目取数组第一项"的原因。

**`$.data.raw.create_time` 为什么要 `include_raw=true`（踩坑 5）**：
接口归一化后的 `$.data.created_at` 是 `"2021-01-07T09:33:13Z"`，而 `publishAt`
约定要 **epoch 毫秒**，引擎没有日期解析算子。原始 payload 里有数字的
`create_time`（epoch 秒，`OutputResolver` 会自动 ×1000），所以带上 `include_raw=true` 取它。
站点只给字符串又找不到数字字段时，正确做法是**省略这个输出**，而不是填当前时间。

**为什么用 `condition.equals` 而不是直接输出**：抖音链接可能是图文/图集，
此时 `$.data.media.video.url` 取不到 → `output.media` 会**整步失败**（踩坑 6）。
先判断 `kind`，把"不是视频"导向受限上报。

---

## 4. 输出：媒体 + 四个元数据键

```jsonc
"then": [   // 内层 then，独立下标空间（0..4）
  { "kind": "output.media", "url": "$var.mediaUrl",
    "mimeType": "video/mp4", "extension": "mp4", "title": "$var.mediaTitle",
    "headers": { "Referer": "$var.referer", "User-Agent": "$var.ua" } },   // 0
  { "kind": "output.metadata", "key": "title",     "value": "$var.mediaTitle" },  // 1
  { "kind": "output.metadata", "key": "author",    "value": "$var.mediaAuthor" }, // 2
  { "kind": "output.metadata", "key": "publishAt", "value": "$var.mediaAt" },     // 3
  { "kind": "output.metadata", "key": "coverUrl",  "value": "$var.mediaCover" }   // 4
],
"else": [
  { "kind": "restricted.mark", "reason": "非视频内容或解析服务未返回结果",
    "message": "未取得抖音视频信息：该链接可能指向图文/图集内容，或解析服务返回了异步任务、额度不足…" }
]
```

- **`output.media` 四个字段的实际作用**：`url` 是直链；`mimeType`/`extension` 决定
  落盘类型；`title` 用作文件名；`headers` 是**下载时**带的请求头（防盗链站点必填）。
- **四个元数据键**：`title` / `author` / `publishAt` / `coverUrl`。
  其中 `author` 与 `publishAt` 是**收录硬要求**——缺了媒体库就显示不出
  `发布者 · 平台 · 发布日期`。取不到时 `output.metadata` 会**静默跳过**（不报错），
  所以"规则能跑通"不代表"四要素齐"，要自己核对。
- **`$var.*` 在这里不是可选风格，是必需**：内层只有 5 步，若写 `$step.2` 会被解析成
  内层第 2 步（还没执行）而不是 `then` 的第 2 步。

---

## 5. 把这份结构套到别的平台（"改五处"）

前提：目标平台有**可调用的解析服务或公开接口**（否则先看 [RULE_SOURCE_SPEC](./RULE_SOURCE_SPEC.md) 的 L3/L4）。

| 改哪里 | 从哪来 |
|---|---|
| ① `matcher.hosts` / `urlPatterns` | 你要覆盖的域名与路径形态 |
| ② `extract.regex` 的 `pattern` | 从展开后的 URL 里取 ID 的正则 |
| ③ `variables.base` + `http.request.url` | 服务的 Base URL 与端点、查询参数名 |
| ④ 六个 `extract.jsonPath` 的 `path` | 服务响应里的真实字段路径（用「规则调试」的轨迹核对） |
| ⑤ `auth.profile/label/header/hosts` | 服务是否需要用户自己的密钥、以什么头、发往哪个域名 |
| ⑥ 若响应里没有 epoch 时间字段 | 找原始 payload 里的数字时间，或**省略 `publishAt`** |

服务地址在本机/局域网时：把 URL 写成 `http://127.0.0.1:8080/...`（必须是**字面量**，
否则引擎检测不到内网地址、规则中心不会出现"访问本机与局域网"授权项），
并在 `description` 里说明需要开这个授权——否则 CI 会拦你（见 RULE_GUIDE §六）。

---

## 6. 调试与常见失败对照

用 **规则中心 → 规则调试** 跑一条真实链接，看轨迹定位到具体哪一步：

| 现象 | 大概率原因 |
|---|---|
| `凭据档案 douyin-service 为空（未登录或未配置）` | 没在规则中心填值并授权 —— 这不是规则坏了 |
| `HTTP 400 / 403` | ID 没取到（正则不匹配该链接形态），或服务地址/端点变了 |
| `output.media 解析出的直链为空` | 响应结构变了，或 `kind` 不是视频但没走分支 |
| 媒体库没有发布者/日期 | 缺 `output.metadata`，或字段路径取值为空（元数据空值会静默跳过） |
| 编译期 `$step.N` 报错 | 跨块引用被遮蔽 —— 改用 `$var.*` |
| 规则装上了但解析没变化 | 没升 `version`（缓存未失效），或模块没启用（导入默认停用） |
| 粘贴链接提示"不支持的平台" | `matcher` 没覆盖该域名/路径 → 检查 `hosts` 与 `urlPatterns` |

---

## 7. 一句话记住的规则

1. **能出直链**，能出 `author` + `publishAt`（+ `title` / `coverUrl` 更好）；
2. **跨块传值只用 `$var.*`**；
3. **取不到就 `restricted.mark` 说人话**，别让它变成 `HTTP 400`；
4. **需要用户密钥就用自定义凭据档案**，永远不要把密钥写进规则文件；
5. **改内容就升版本号**，并在 PR 里附调试台命中的证据。
