# 文档地图 · 从这里开始

本目录是**开发者文档**（普通用户看仓库根 [README.md](../README.md) 即可）。
按"我想做什么"选入口：

| 我想… | 看这篇 | 预计耗时 |
|---|---|---|
| 从零写一条能跑的规则 | [RULE_GUIDE.md](../RULE_GUIDE.md) §一（模板）+ §二（**必读的六个坑**） | 30 分钟 |
| 看懂一条真实复杂规则（含分支、凭据、跨块传值） | [WALKTHROUGH_DOUYIN.md](./WALKTHROUGH_DOUYIN.md) 完整实例精读 | 20 分钟 |
| 知道收录到市场要满足什么 | [RULE_GUIDE.md](../RULE_GUIDE.md) §四（要素要求） | 10 分钟 |
| 处理"需要登录 / 需要 API Key" | [RULE_GUIDE.md](../RULE_GUIDE.md) §三（凭据三通道） | 10 分钟 |
| 确认自己的"免登录"规则是否越线 | [RULE_GUIDE.md](../RULE_GUIDE.md) §五（合法的"跳过登录"） | 5 分钟 |
| 提 PR 前自检 | `node tools/validate-rules.mjs rules` + [RULE_GUIDE.md](../RULE_GUIDE.md) §六 | 5 分钟 |
| 了解"复制 GitHub 地址就能导入"能不能做、怎么做 | [RULE_SOURCE_SPEC.md](./RULE_SOURCE_SPEC.md) | 20 分钟 |
| 查规则语言的完整语法（算子全集、引用空间、资源上限） | 帧藏X 工程内 `docs/14-13-3规则模块与声明式规则语言参考.md` | 参考 |

---

## 本目录文件

| 文件 | 内容 | 状态 |
|---|---|---|
| [WALKTHROUGH_DOUYIN.md](./WALKTHROUGH_DOUYIN.md) | 抖音规则逐步骤精读：为什么这样写、坑在哪、怎么套到别的平台、失败对照表 | ✅ 现行 |
| [RULE_SOURCE_SPEC.md](./RULE_SOURCE_SPEC.md) | 规则源与仓库导入规范（L1–L4 分级、清单格式、订阅、安全清单、路线图、决策记录） | ✅ 已定稿，**未实现** |

仓库其他位置：

| 路径 | 内容 |
|---|---|
| [../RULE_GUIDE.md](../RULE_GUIDE.md) | 规则开发指南 + 收录要素要求（**规则作者的唯一权威入口**） |
| [../rules/](../rules) | 收录的规则（可直接导入） |
| [../templates/](../templates) | 开发模板（最小单文件 / 完整规则包） |
| [../tools/validate-rules.mjs](../tools/validate-rules.mjs) | 规则静态校验器（CI 与本地共用） |
| [../.github/workflows/validate-rules.yml](../.github/workflows/validate-rules.yml) | PR 自动校验 |

---

## 三条最重要的经验（来自真机实测）

写在最显眼处，因为它们是"规则编译通过但解析不出东西"的头号原因：

1. **`matcher.hosts` 命中就命中**——`urlPatterns` 只加分、不能收窄。
   写了宽域名，该域名下任何链接都会命中你的规则；不支持的形态要在规则内
   `restricted.mark` 说人话，别让它撞成 `HTTP 400`。
2. **跨块传值只用 `$var.*`**——嵌套分支/循环里 `$step.N` 会**先按本层解析**，
   很容易取到本层尚未执行的步骤。用变量表绕开整个问题。
3. **`output.metadata` 空值静默跳过、`output.media` 空值整步失败**——
   直链可能取不到时，先用 `condition.*` 分支分流。

完整六条见 [RULE_GUIDE §二](../RULE_GUIDE.md)。

---

## 贡献文档

发现文档与引擎实际行为不一致时，请**以实测为准**并提 PR 修正文档
（附：引擎版本、复现步骤、调试台轨迹截图）。文档滞后比没有文档更危险。
