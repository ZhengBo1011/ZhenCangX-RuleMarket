# 帧藏X 规则开发指南与注意事项

面向规则作者：如何从模板起步写出一条规则，以及**收录到本市场必须满足的要素要求**。
规则语言的完整参考见帧藏X 工程内 `docs/14-13-3规则模块与声明式规则语言参考.md`。

---

## 一、两个开发模板

### 1. 最小单文件模板（`templates/minimal.recipe.json`）

一条规则 = `matcher`（匹配哪些链接）+ `steps`（解析步骤流水线）+ `capabilities`（能力声明）。

改三处即可运行：

```jsonc
"matcher": { "hosts": ["目标站点.com"], "urlPatterns": ["目标站点\\.com/v/\\w+"] },
"steps": [
  { "kind": "http.request", "url": "https://接口地址/?id=..." },   // ② 换接口
  { "kind": "extract.jsonPath", "path": "$.data.video.playUrl" },  // ③ 换字段路径
  { "kind": "output.media", "url": "$step.N" }
]
```

保存为 `.json` → 规则中心「从文件导入」或「粘贴导入」→ 调试台试跑 → 启用。

### 2. 完整规则包模板（`templates/full-package/`）

目录形态 `manifest.json + rules/*.json`（多选导入），或把两者封成一个
`{ "manifest": …, "rules": [ … ] }` 信封改后缀 `.zrule`（单文件导入）。
适用需要回滚、启停、多条规则共存的正式发布。

### 关键语法速查

| 事项 | 写法 |
|------|------|
| 引用 | `$input.url` 输入链接 · `$step.N` 第 N 步产出 · `$var.名字` 命名变量 |
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

## 二、注意事项（**收录本市场的要素要求**，不满足不予收录）

### 1. 规则要素

- **格式**：必须是 `zhencangx.recipe` 2.0 单文件规则，或 `.zrule` 信封包；
  必须能通过帧藏X 导入校验链（清单 → 编译 → 安装），提交时附**成功导入与调试台命中的截图或描述**。
- **`meta.id` 全局唯一**：建议 `你的域.站点.用途` 形式（如 `com.alice.douyin`），不得与已有规则冲突。
- **`version`/`moduleVersion` 为三段数字**（`1.0.0`），**内容变更必须递增版本号**
  （帧藏X 靠版本号让旧解析缓存失效）。
- **禁止脚本类操作符**：`eval`/`script`/`python`/`shell` 等在编译期即被拒绝——引擎是声明式
  Recipe，不执行任何代码；把逻辑拆成 `http.request` + `extract.*` + `transform.*` 步骤。
- **能力如实**：用到网络/JSON 解析的步骤，规则头部 `capabilities` 声明（引擎会自动并集，
  但声明完整是作者义务）。
- **受限内容如实上报**：会员、付费、禁存、无权限、非视频类型等情况用 `restricted.mark`
  如实标注，**不得**绕过或伪造成功；`restricted.mark` 只能收窄结果，引擎没有放行通道。
- **下载头**：需要 Referer/UA 防盗链的站点，在 `output.media.headers` 声明；
  凭据类字面量头（Cookie/Authorization）**必须在规则描述里明示**——用户启用时会被要求授权。
- **导入默认停用**：本市场的规则链接导入后不会自动生效，需用户手动启用（设计如此，非缺陷）。

### 2. 平台要素

- **`matcher` 必须明确**：`hosts` 与 `urlPatterns` 写实际覆盖的域名与路径形态；
  短链域（如 `xhslink.cn`）、直链域（如 `www.xiaohongshu.com`）都要覆盖，
  **平台声明与规则实际能解析的链接一致**——不得宽匹配（hosts 写 `*`/空或极宽正则）。
- **不得冒充官方**：`moduleId` 禁止 `official.` 前缀，`source` 不得写 `BUILTIN`
  （帧藏X 导入时强制拒绝）；描述里不得自称"官方/内置"。
- **只写你验证过的站点**：一条规则只覆盖其真实测试过的平台；
  跨平台请拆成多条规则或多规则包的 `rules/*.json` 多文件。
- **不做访问控制绕过**：不提供破解登录、绕过会员/DRM、代理翻墙类步骤
  （引擎层面也没有这些能力）；登录态相关请声明 `auth.profile` 引用，由用户授权注入。
- **`supportedPlatforms`**（规则包）：填写规则实际覆盖的站点标识，
  与 `matcher` 保持一致（应用在规则中心展示给用户）。

### 3. 作者要素

- **`meta.author` / `manifest.author` 必填且真实可追溯**：写你的昵称、GitHub ID 或主页——
  用户要在规则中心看到"这是谁写的"并决定是否信任；**不得**留空、写 `unknown`、
  或冒充他人与帧藏X 官方。
- 第三方改编的规则，在 `meta.description` 注明**原作者与来源链接**（署名与许可证义务）。
- `manifest.license`：默认 `SEE_LICENSE`；有明确许可证的按原样标注。
- 提交者身份：PR 提交的仓库/账号应与 `author` 字段对应（或在 PR 说明中说明代发布关系）。

### 4. 日期要素

- **版本即日期载体**：每次内容变更**必须**递增 `version`/`moduleVersion`（三段数字），
  不允许"改内容不改版本"（会导致用户端缓存与回滚失效）。
- **索引登记更新日期**：README 的预置规则表必须维护「更新日期」列（`YYYY-MM-DD`），
  与本次提交日期一致。
- **失效标注**：发现平台改版导致规则失效，**48 小时内在本仓库**升版本修复，
  或在索引表标注「已失效 · MM-DD」并将失效规则移到文末归档区——
  不允许让失效规则继续留在可导入列表顶部。

---

## 三、提交方式

1. Fork 本仓库，把规则文件放进 `rules/`（模板起步的请先跑通调试台）；
2. 同步更新 `README.md` 索引表（说明 + raw 链接 + 更新日期）；
3. 发起 PR，附规则的调试台命中截图或失败/成功描述；
4. 或者在 Issue 中贴 raw 链接（gist 亦可），由维护者验收后代为收录。

**验收口径**：四要素齐 + 能导入 + 调试台命中 + 说明无误导。链式要求见上。
