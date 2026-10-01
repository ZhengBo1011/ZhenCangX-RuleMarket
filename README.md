# ZhenCangX-RuleMarket · 帧藏X 规则市场

[帧藏X](https://github.com/ZhengBo1011/ZhenCangX)（私有主仓库）的**规则应用市场**：整理、预置与发布可直接导入的解析规则，以及第三方规则链接索引。

## 快速使用

1. 打开帧藏X → **我的 → 规则中心**；
2. 顶栏「粘贴导入」或导入面板的「**从网络导入**」；
3. 粘贴下方表格中的 **raw 链接** → 校验并安装（导入默认停用，复核作者与能力后手动启用）。

> 也可在系统浏览器/文件管理器打开 raw 链接选择用帧藏X打开，直达导入面板。

## 预置规则（可直接导入）

| 规则 | 说明 | 导入链接（raw） | 更新日期 |
|------|------|----------------|---------|
| 小红书视频笔记解析 | 分享短链 `xhslink.cn` / 网页直链均可；提取直链、作者、发布时间，携带防盗链头下载；仅视频笔记 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/xiaohongshu.recipe.json` | 2026-10-01 |
| 示例① 最小规则 | 单文件规则骨架：正则取 ID → GET 接口 → JSONPath 取直链 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-01-minimal.recipe.json` | 2026-10-01 |
| 示例② 短链展开 | `http.resolve` 重定向展开 + `${var.xxx}` 模板拼接 + 去水印替换 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-02-shortlink.recipe.json` | 2026-10-01 |
| 示例③ 嵌入 JSON | `jsonParse` 解析页面内嵌 JSON + `.*` 动态键通配 + 下载 Referer 头 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-03-embedded-json.recipe.json` | 2026-10-01 |
| 示例④ 完整模块包 | `.zrule` 信封：manifest + 声明式函数 + 有界循环 + 受限上报 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/rules/sample-04-full-package.zrule` | 2026-10-01 |

## 开发模板

| 模板 | 用途 | 链接（raw） |
|------|------|------------|
| 最小单文件模板 | 从零改出一条可运行规则 | `https://raw.githubusercontent.com/ZhengBo1011/ZhenCangX-RuleMarket/main/templates/minimal.recipe.json` |
| 完整规则包模板 | manifest + rules/ 目录形态（可回滚、可启停的正规发布形态） | 目录形态见 [templates/full-package/](./templates/full-package)，下载两个文件后多选导入 |

模板用法与字段说明见 [RULE_GUIDE.md](./RULE_GUIDE.md)。

## 第三方规则链接索引

### A. 可直接导入 / 可直接转换的链接

| 内容 | 链接 | 说明 |
|------|------|------|
| yt-dlp 小红书提取器源码（gist） | https://gist.github.com/ZhengBo1011/95732bbed48d43268d0ecdd497d97dd2 | 粘贴源码或用其 raw 链接导入 → 自动生成「URL 匹配就绪、步骤待补齐」的脚手架规则（可安装、可在调试台验证匹配） |
| 最小规则示例（gist） | https://gist.github.com/ZhengBo1011/370755febf00806c6033df4f02a36ae6 | 网络导入通道测试用；内容与本仓库 sample-01 相同 |

### B. 参考脚本仓库（Python/代码型，**不能直接导入**，可取其提取器源码生成脚手架）

| 仓库 | 用途 | 与帧藏X 的关系 |
|------|------|---------------|
| [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) | 通用视频提取器标准 | 粘贴某站点提取器的 `_VALID_URL` 源码 → 自动转脚手架；其余步骤按 RULE_GUIDE 手工补齐 |
| [mikf/gallery-dl](https://github.com/mikf/gallery-dl) | 图库/画廊下载 | 同上（识别 `pattern` 声明）；JSON 配置仅参数层可识别 |
| [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) | 抖音/TikTok 解析 API（约 20k★） | 提取「短链展开 → API → 字段路径」配方，参考移植为 Recipe 步骤 |
| [putyy/res-downloader](https://github.com/putyy/res-downloader) | 资源嗅探下载器（约 20k★） | 其自定义规则的字段思路可参考；格式不通用，需手工移植 |
| [Johnserf-Seed/f2](https://github.com/Johnserf-Seed/f2) | 多平台异步框架（按平台 YAML 配置） | 端点/请求头配置可参考移植 |
| [NanmiCoder/MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) | 浏览器驱动爬虫（约 60k★） | 依赖注入签名脚本，**不适用于**帧藏X 声明式引擎；仅作字段路径参考 |

> 注意：B 类是**代码**，帧藏X 引擎不执行任何脚本（架构边界）；价值在提取其中的「URL 模式、接口地址、字段路径」，按 [RULE_GUIDE.md](./RULE_GUIDE.md) 手工转成声明式步骤。

## 参与

欢迎提交你写的规则（PR 或 Issue 附 raw 链接）。**提交前请阅读 [RULE_GUIDE.md](./RULE_GUIDE.md) 的注意事项**——对规则、平台、作者、日期四类要素有明确要求，不满足的提交不予收录。

## 免责

本仓库收录的第三方规则来自社区，帧藏X 不为其行为背书；导入即表示你理解「下载 ≠ 信任」，请仅用规则归档你合法可访问的公开内容。规则随平台改版可能失效，以仓库更新日期为准。
