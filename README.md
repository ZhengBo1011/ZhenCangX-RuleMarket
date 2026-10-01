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

## 现成规则（复制链接直接导入）

### 官方预置

| 规则 | 说明 | 导入链接（raw） | 更新日期 |
|------|------|----------------|---------|
| 小红书视频笔记解析 | 分享短链 `xhslink.cn` / 网页直链均可；提取直链、作者、发布时间，携带防盗链头下载；仅视频笔记 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/xiaohongshu.recipe.json` | 2026-10-01 |
| 示例① 最小规则 | 单文件规则骨架：正则取 ID → GET 接口 → JSONPath 取直链 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-01-minimal.recipe.json` | 2026-10-01 |
| 示例② 短链展开 | `http.resolve` 重定向展开 + `${var.xxx}` 模板拼接 + 去水印替换 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-02-shortlink.recipe.json` | 2026-10-01 |
| 示例③ 嵌入 JSON | `jsonParse` 解析页面内嵌 JSON + `.*` 动态键通配 + 下载 Referer 头 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-03-embedded-json.recipe.json` | 2026-10-01 |
| 示例④ 完整模块包 | `.zrule` 信封：manifest + 声明式函数 + 有界循环 + 受限上报 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-04-full-package.zrule` | 2026-10-01 |

### 第三方 · 可直接导入

| 内容 | 导入链接 | 说明 | 更新日期 |
|------|---------|------|---------|
| yt-dlp 小红书提取器源码（gist） | `https://gist.githubusercontent.com/ZhengBo1011/95732bbed48d43268d0ecdd497d97dd2/raw/4a6129ba6ac5216191c073c8ac651b6f204a411b/xhs_ytdlp.py` | 粘贴该链接导入 → 自动生成「URL 匹配就绪、步骤待补齐」的脚手架规则（可安装、调试台可验证匹配） | 2026-10-01 |
| 最小规则示例（gist） | `https://gist.githubusercontent.com/ZhengBo1011/370755febf00806c6033df4f02a36ae6/raw/52665d42babd338daa24361ed4e072538add86bf/rule_sample_01_minimal.json` | 网络导入通道测试用，内容同本仓库示例① | 2026-10-01 |

---

# 🛠 面向开发者

一条规则 = `matcher`（匹配哪些链接）+ `steps`（解析步骤流水线）+ `capabilities`（能力声明）。
引擎是声明式 Recipe（**不执行任何脚本**），完整语言参考见帧藏X 工程内
`docs/14-13-3规则模块与声明式规则语言参考.md`，本仓库细则见 [RULE_GUIDE.md](./RULE_GUIDE.md)。

## 开发模板（从这里起步）

| 模板 | 用途 | 链接（raw） |
|------|------|------------|
| 最小单文件模板 | 从零改出一条可运行规则（改 matcher / 接口地址 / 字段路径三处） | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/templates/minimal.recipe.json` |
| 完整规则包模板 | manifest + rules/ 目录形态（可回滚、可启停的正规发布形态） | 目录见 [templates/full-package/](./templates/full-package)，下载两个文件后在规则中心「从文件导入」多选 |

## 语法示例（最常用能力）

| 事项 | 写法 |
|------|------|
| 引用 | `$input.url` 输入链接 · `$step.N` 第 N 步产出 · `$var.名字` 命名变量 · `${var.xxx}` 模板拼接 |
| 网络 | `http.request`（GET/POST/HEAD/PUT/DELETE/PATCH/OPTIONS）· `http.resolve`（短链展开取最终地址） |
| 抽取 | `extract.regex` / `extract.jsonPath`（支持 `[*]`、`.*` 通配）/ `extract.jsonParse`（页面内嵌 JSON）/ `extract.html.*` |
| 输出 | `output.media`（可带 `headers` 防盗链下载头）· `output.metadata`（约定键 `title`/`author`/`coverUrl`/`publishAt`） |
| 受限上报 | `restricted.mark`（原因支持自由文本；如实上报，引擎没有放行通道） |
| 能力 | `network` / `json_parse` / `html_parse` / `media_resolve` / `redirect` / `media_transform` / `auth_reference` / `cookie` |

**开发流程建议**：改模板 → 规则中心「规则调试」试跑（不下载、看轨迹）→ 启用后真实解析 →
升版本号再更新发布。

## 第三方 · 参考脚本仓库（不能直接导入，供移植）

以下仓库是**代码**（Python/JS），帧藏X 引擎不执行脚本；价值在提取其中的
「URL 模式、接口地址、字段路径」，按 [RULE_GUIDE.md](./RULE_GUIDE.md) 手工转成声明式步骤，
或把提取器源码粘贴导入自动生成脚手架（见上方普通用户板块的示例）。

| 仓库 | 用途 | 移植方式 |
|------|------|---------|
| [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) | 通用视频提取器标准 | 取某站点 `_VALID_URL` 源码粘贴导入 → 脚手架；其余步骤手工补 |
| [mikf/gallery-dl](https://github.com/mikf/gallery-dl) | 图库/画廊下载 | 同上（识别 `pattern` 声明）；JSON 配置仅参数层可识别 |
| [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) | 抖音/TikTok 解析 API（约 20k★） | 提取「短链展开 → API → 字段路径」配方，移植为 Recipe 步骤 |
| [putyy/res-downloader](https://github.com/putyy/res-downloader) | 资源嗅探下载器（约 20k★） | 其自定义规则的字段思路可参考；格式不通用，需手工移植 |
| [Johnserf-Seed/f2](https://github.com/Johnserf-Seed/f2) | 多平台异步框架（按平台 YAML 配置） | 端点/请求头配置可参考移植 |
| [NanmiCoder/MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) | 浏览器驱动爬虫（约 60k★） | 依赖注入签名脚本，不适用声明式引擎；仅作字段路径参考 |

## 注意事项（收录本市场的要素要求，不满足不予收录）

- **规则**：必须是 `zhencangx.recipe` 2.0 或 `.zrule` 包且能通过导入校验链（附调试台命中说明）；
  `meta.id` 全局唯一；**内容变更必须递增三段版本号**（用户端缓存与回滚依赖它）；
  禁止脚本类操作符（引擎不执行代码）；受限内容必须 `restricted.mark` 如实上报；
  凭据类请求头（Cookie/Authorization）须在描述中明示（用户启用时会弹窗授权）。
- **平台**：`matcher` 明确锚定实际覆盖的域名与路径，不得宽匹配；`moduleId` 禁止 `official.`
  前缀、不得冒充官方；不做登录/会员/DRM 绕过（引擎也无此能力）。
- **作者**：`meta.author` / `manifest.author` 必填真实可追溯（昵称/GitHub ID/主页），
  禁止留空、`unknown` 或冒充他人；改编规则须署名原作者与来源。
- **日期**：内容变更必升版本号；本仓库索引表同步维护「更新日期」列（YYYY-MM-DD）；
  失效规则 48 小时内升版修复或标注「已失效」，不得滞留可导入列表。

> 完整细则与提交验收口径见 [RULE_GUIDE.md](./RULE_GUIDE.md)。

---

## 参与

提交你的规则：Fork → 放入 `rules/` → 更新本页索引表（说明 + raw 链接 + 更新日期）→ PR；
或开 Issue 附 raw 链接（gist 亦可），由维护者验收后代为收录。

## 免责

本仓库收录的第三方规则来自社区，帧藏X 不为其背书；导入即表示你理解「下载 ≠ 信任」，
请仅用规则归档你合法可访问的公开内容。规则随平台改版可能失效，以更新日期为准。
