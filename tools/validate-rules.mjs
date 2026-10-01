#!/usr/bin/env node
/*
 * 帧藏X 规则市场 · 规则静态校验器
 *
 * 职责：对 rules/*.json（帧藏 Recipe 2.0 单文件规则）与 *.zrule（信封包）做**收录要件**校验，
 *      把 RULE_GUIDE.md 第四节的"要素要求"从人工承诺变成机器闸门。
 *
 * 边界（务必诚实）：本脚本只做**结构**校验，不能替代真机调试台验证。
 *      "能否真的解析出一条视频"必须由提交者用规则调试台实测并附证据，
 *      本脚本只能在 PR 上拦住"少了发布者 / 少了时间 / 冒充官方 / 用了脚本操作符"这类硬伤。
 *
 * 用法：node tools/validate-rules.mjs [rules 目录]
 * 退出码：0 = 全部通过；1 = 存在不合规规则
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

/** 引擎编译期即拒绝的脚本类操作符名（与 RuleValidator.FORBIDDEN_KINDS 同源口径） */
const FORBIDDEN_KINDS = [
  'eval', 'script', 'js', 'javascript', 'python', 'shell', 'command', 'exec',
  'nativecall', 'dynamicimport', 'import', 'require', 'load', 'loadcode',
  'executescript', 'system', 'spawn', 'wasm', 'reflect', 'proxy', 'function'
];

/** 能力名白名单（与 RuleCapability 同源） */
const KNOWN_CAPABILITIES = [
  'network', 'json_parse', 'html_parse', 'media_resolve', 'media_transform',
  'redirect', 'auth_reference', 'cookie'
];

/** 凭据注入头禁用名单（逐跳头；与 RuleCredentialProfiles.FORBIDDEN_HEADERS 同源） */
const FORBIDDEN_HEADERS = [
  'host', 'content-length', 'connection', 'transfer-encoding', 'upgrade',
  'proxy-connection', 'te', 'trailer'
];

/** 必需要素的约定键（RULE_GUIDE 第四节） */
const REQUIRED_METADATA_KEYS = ['author', 'publishAt'];

/**
 * 官方教学示例豁免清单（**精确文件名**，不接受模式匹配，避免被滥用绕过校验）。
 *
 * 为什么豁免：这四个文件是市场随仓库附带的"从零学写规则"示例，指向
 * `api.demo-short.com` 这类虚构域名，不是可用的收录规则；它们保留在 rules/ 是为了让
 * 作者就近对照（如删除/移动会破坏已分享的 raw 链接）。豁免范围**仅限**这 4 个文件，
 * 且仍会做结构校验（JSON / matcher / 脚本禁令等），只跳过 author/publishAt 四要素要求。
 */
const OFFICIAL_SAMPLE_EXEMPT = new Set([
  'sample-01-minimal.recipe.json',
  'sample-02-shortlink.recipe.json',
  'sample-03-embedded-json.recipe.json',
  'sample-04-full-package.zrule'
]);

/** 当前文件是否豁免四要素要求 */
let currentExempt = false;

const errors = [];
const warnings = [];
const seenIds = new Map();

/**
 * 记录一条错误。
 * @param {string} file 文件名
 * @param {string} msg 错误信息
 */
function fail(file, msg) {
  errors.push(`[${file}] ${msg}`);
}

/**
 * 记录一条警告。
 * @param {string} file 文件名
 * @param {string} msg 警告信息
 */
function warn(file, msg) {
  warnings.push(`[${file}] ${msg}`);
}

/**
 * 递归收集一条规则里的全部操作符 kind。
 * @param {any[]} steps 步骤数组
 * @param {string[]} out 收集结果
 */
function collectKinds(steps, out) {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (step && typeof step === 'object' && typeof step.kind === 'string') {
      out.push(step.kind);
      // 控制流体内嵌步骤：branch 的 then/else、foreach/map 的 steps
      collectKinds(step['then'], out);
      collectKinds(step['else'], out);
      collectKinds(step['steps'], out);
    }
  }
}

/**
 * 收集步骤序列中的 output.metadata 键与 output.media 是否出现。
 * @param {any[]} steps 步骤数组
 * @param {Set<string>} metaKeys 收集到的元数据键
 * @param {{media: boolean}} flags 其他标志
 */
function collectOutputs(steps, metaKeys, flags) {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    if (step.kind === 'output.media') flags.media = true;
    if (step.kind === 'output.metadata' && typeof step.key === 'string') metaKeys.add(step.key);
    if (step.kind === 'http.resolve') flags.resolve = true;
    collectOutputs(step['then'], metaKeys, flags);
    collectOutputs(step['else'], metaKeys, flags);
    collectOutputs(step['steps'], metaKeys, flags);
  }
}

/**
 * 收集步骤里出现的 http.request / http.resolve 的 URL 字面量。
 * @param {any[]} steps 步骤数组
 * @param {string[]} out 收集结果
 */
function collectHttpUrls(steps, out) {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (step && typeof step === 'object') {
      if (step.kind === 'http.request' || step.kind === 'http.resolve') {
        if (typeof step.url === 'string') out.push(step.url);
      }
      collectHttpUrls(step['then'], out);
      collectHttpUrls(step['else'], out);
      collectHttpUrls(step['steps'], out);
    }
  }
}

/**
 * 校验 auth 声明（通道 A/B/C；RULE_GUIDE 第三节）。
 * @param {string} file 文件名
 * @param {any} auth auth 对象
 */
function checkAuth(file, auth) {
  if (auth === undefined) return;
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    fail(file, 'auth 必须是对象');
    return;
  }
  const profile = auth.profile;
  if (typeof profile !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(profile)) {
    fail(file, `auth.profile 非法（只允许小写字母/数字/._-，首字符为字母或数字）：${JSON.stringify(profile)}`);
  }
  const hasExtras = ['label', 'header', 'hint', 'loginUrl'].some((k) => auth[k] !== undefined);
  const hasHosts = Array.isArray(auth.hosts) && auth.hosts.length > 0;
  if (hasExtras && !hasHosts) {
    fail(file, 'auth 声明了 label/header/hint/loginUrl 却没有 hosts —— 引擎会编译期拒绝'
      + '（允许域名是凭据注入的唯一约束）');
  }
  if (auth.header !== undefined) {
    if (typeof auth.header !== 'string' || !/^[A-Za-z0-9!#$%&'*+\-.^_`|~]{1,64}$/.test(auth.header)) {
      fail(file, `auth.header 不是合法 HTTP 头名：${JSON.stringify(auth.header)}`);
    } else if (FORBIDDEN_HEADERS.includes(auth.header.toLowerCase())) {
      fail(file, `auth.header 不得是逐跳头：${auth.header}`);
    }
  }
  if (Array.isArray(auth.hosts)) {
    for (const host of auth.hosts) {
      if (typeof host !== 'string' || host.includes('*') || /[:/@\s]/.test(host)) {
        fail(file, `auth.hosts 含非法域名（不得含通配符/端口/路径）：${JSON.stringify(host)}`);
      }
    }
  }
  // 登录页地址（可选）：声明后规则详情页会出现「通过网页登录获取」入口，必须是 https 绝对地址
  if (auth.loginUrl !== undefined) {
    if (typeof auth.loginUrl !== 'string'
      || !/^https:\/\/[a-z0-9][a-z0-9.-]*/i.test(auth.loginUrl)) {
      fail(file, `auth.loginUrl 必须是 https 绝对地址（登录页会放入内嵌 Web）：${JSON.stringify(auth.loginUrl)}`);
    }
    if (!hasHosts) {
      fail(file, 'auth.loginUrl 必须与 auth.hosts 同时声明（取 Cookie 的域来自 hosts）');
    }
  }
}

/**
 * 校验单条帧藏 Recipe 2.0 规则。
 * @param {string} file 文件名
 * @param {any} doc 规则对象
 */
function checkRule(file, doc) {
  if (doc.format !== 'zhencangx.recipe') {
    fail(file, `format 必须是 zhencangx.recipe（实际 ${JSON.stringify(doc.format)}）`);
  }
  if (doc.schemaVersion !== '2.0') {
    fail(file, `schemaVersion 必须是 2.0（实际 ${JSON.stringify(doc.schemaVersion)}）`);
  }
  const meta = doc.meta;
  if (!meta || typeof meta !== 'object') {
    fail(file, '缺少 meta');
    return;
  }
  for (const key of ['id', 'name', 'version']) {
    if (typeof meta[key] !== 'string' || meta[key].length === 0) {
      fail(file, `meta.${key} 必填`);
    }
  }
  if (typeof meta.id === 'string') {
    if (seenIds.has(meta.id)) {
      fail(file, `meta.id 与 ${seenIds.get(meta.id)} 重复：${meta.id}`);
    } else {
      seenIds.set(meta.id, file);
    }
    if (meta.id.startsWith('official.')) {
      fail(file, `meta.id 不得使用 official. 前缀（防冒充官方）：${meta.id}`);
    }
  }
  if (typeof meta.version === 'string' && !/^\d+\.\d+\.\d+$/.test(meta.version)) {
    fail(file, `meta.version 必须是三段数字：${meta.version}`);
  }
  if (typeof meta.author !== 'string' || meta.author.trim().length === 0) {
    fail(file, 'meta.author 必填真实可追溯（禁止留空 / unknown / 冒充官方）');
  } else if (/^(unknown|none|null|n\/a|匿名)$/i.test(meta.author.trim())) {
    fail(file, `meta.author 不得写占位值：${meta.author}`);
  }
  if (typeof meta.description !== 'string' || meta.description.length < 20) {
    warn(file, 'meta.description 过短：请说明覆盖范围、需要什么凭据、失效情形');
  }

  const matcher = doc.matcher;
  if (!matcher || typeof matcher !== 'object') {
    fail(file, '缺少 matcher');
  } else {
    if (!Array.isArray(matcher.hosts) || matcher.hosts.length === 0) {
      fail(file, 'matcher.hosts 必须是非空数组');
    } else {
      for (const host of matcher.hosts) {
        if (typeof host !== 'string' || host.includes('*') || host.includes('/')) {
          fail(file, `matcher.hosts 不得含通配符/路径：${JSON.stringify(host)}`);
        }
      }
    }
    if (!Array.isArray(matcher.urlPatterns) || matcher.urlPatterns.length === 0) {
      fail(file, 'matcher.urlPatterns 必须是非空数组');
    } else {
      for (const pattern of matcher.urlPatterns) {
        if (typeof pattern !== 'string') {
          fail(file, 'matcher.urlPatterns 元素必须是字符串');
          continue;
        }
        if (pattern.length > 2000) {
          fail(file, 'matcher.urlPatterns 单项长度超限（>2000）');
        }
        try {
          new RegExp(pattern.startsWith('^') ? pattern : `^(?:[a-z][a-z0-9+.\\-]*://)?(?:[a-z0-9\\-]+\\.)*${pattern}`, 'i');
        } catch (e) {
          fail(file, `matcher.urlPatterns 正则无法编译：${pattern}（${e.message}）`);
        }
      }
    }
    if (typeof matcher.priority !== 'number') {
      fail(file, 'matcher.priority 必须是数字');
    }
  }

  const caps = doc.capabilities;
  if (caps !== undefined) {
    if (!Array.isArray(caps)) {
      fail(file, 'capabilities 必须是数组');
    } else {
      for (const cap of caps) {
        if (!KNOWN_CAPABILITIES.includes(cap)) {
          fail(file, `未知能力名：${JSON.stringify(cap)}`);
        }
      }
    }
  }

  if (!Array.isArray(doc.steps) || doc.steps.length === 0) {
    fail(file, 'steps 必须是非空数组');
    return;
  }

  const kinds = [];
  collectKinds(doc.steps, kinds);
  for (const kind of kinds) {
    const norm = kind.toLowerCase().replace(/[._-]/g, '');
    for (const bad of FORBIDDEN_KINDS) {
      if (norm === bad.replace(/[._-]/g, '')) {
        fail(file, `禁止脚本类操作符：${kind}（引擎不执行任何代码）`);
      }
    }
  }

  const metaKeys = new Set();
  const flags = { media: false, resolve: false };
  collectOutputs(doc.steps, metaKeys, flags);
  if (!flags.media) {
    // 纯受限上报型规则（如抖音匿名降级说明）允许不产出媒体，但必须上报受限
    if (!kinds.includes('restricted.mark')) {
      fail(file, 'steps 中没有 output.media，也没有 restricted.mark —— 规则既不出档位也不上报受限');
    }
  } else {
    if (!currentExempt) {
      for (const key of REQUIRED_METADATA_KEYS) {
        if (!metaKeys.has(key)) {
          fail(file, `缺少 output.metadata key=${key}（媒体库会缺${key === 'author' ? '发布者' : '发布日期'}）`);
        }
      }
    }
    if (!metaKeys.has('title')) {
      warn(file, '建议输出 output.metadata key=title（媒体库标题与文件名）');
    }
    if (!metaKeys.has('coverUrl')) {
      warn(file, '建议输出 output.metadata key=coverUrl（媒体库封面）');
    }
  }

  // 网络相关能力与步骤一致性（引擎会自动并集，这里只提醒作者补声明）
  const urls = [];
  collectHttpUrls(doc.steps, urls);
  if (urls.length > 0 && Array.isArray(caps) && !caps.includes('network')) {
    warn(file, '使用了 http.request/http.resolve 但未声明 network 能力（引擎会自动并集，声明完整是作者义务）');
  }
  if (kinds.includes('extract.jsonPath') && Array.isArray(caps) && !caps.includes('json_parse')) {
    warn(file, '使用了 extract.jsonPath 但未声明 json_parse 能力');
  }
  if (flags.media && Array.isArray(caps) && !caps.includes('media_resolve')) {
    warn(file, '使用了 output.media 但未声明 media_resolve 能力');
  }

  checkAuth(file, doc.auth);

  // 本机/内网地址必须在描述里告知用户需要开授权
  const privateUrls = urls.filter((u) => /^https?:\/\/(127\.|localhost|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i.test(u));
  if (privateUrls.length > 0) {
    const desc = typeof meta.description === 'string' ? meta.description : '';
    if (!desc.includes('本机') && !desc.includes('局域网') && !desc.includes('内网')) {
      fail(file, '步骤指向本机/内网地址，但 meta.description 未说明需要用户在规则中心开启「访问本机与局域网」授权');
    }
  }

  // 凭据类字面量头必须在描述里明示（RULE_GUIDE）
  const literalCredentialHeaders = [];
  const scanHeaders = (steps) => {
    if (!Array.isArray(steps)) return;
    for (const step of steps) {
      if (!step || typeof step !== 'object') continue;
      if (step.headers && typeof step.headers === 'object') {
        for (const [name, value] of Object.entries(step.headers)) {
          const norm = name.toLowerCase();
          const credentialLike = ['cookie', 'authorization', 'proxy-authorization'].includes(norm)
            || /token|api-key|apikey|session|secret|password|credential|auth/.test(norm);
          if (credentialLike && typeof value === 'string' && !value.startsWith('$') && !value.includes('${')) {
            literalCredentialHeaders.push(name);
          }
        }
      }
      scanHeaders(step['then']);
      scanHeaders(step['else']);
      scanHeaders(step['steps']);
    }
  };
  scanHeaders(doc.steps);
  if (literalCredentialHeaders.length > 0) {
    const desc = typeof meta.description === 'string' ? meta.description : '';
    if (!desc.includes('明文') && !desc.includes('公开') && !desc.includes('演示')) {
      fail(file, `规则内嵌凭据类字面量头（${[...new Set(literalCredentialHeaders)].join('、')}）`
        + '：必须在 meta.description 明示该凭据是公开/演示用途、会随规则文件泄露；'
        + '推荐改用自定义凭据档案（通道 C）');
    }
    warn(file, `规则内嵌凭据类字面量头（${[...new Set(literalCredentialHeaders)].join('、')}），建议改用自定义凭据档案`);
  }
}

/**
 * 校验 .zrule 信封包（manifest + rules）。
 * @param {string} file 文件名
 * @param {any} doc 信封对象
 */
function checkPackage(file, doc) {
  const manifest = doc.manifest;
  if (!manifest || typeof manifest !== 'object') {
    fail(file, '.zrule 缺少 manifest');
    return;
  }
  if (typeof manifest.moduleId !== 'string' || manifest.moduleId.length === 0) {
    fail(file, 'manifest.moduleId 必填');
  } else if (manifest.moduleId.startsWith('official.')) {
    fail(file, `manifest.moduleId 不得使用 official. 前缀：${manifest.moduleId}`);
  }
  if (manifest.source === 'BUILTIN') {
    fail(file, 'manifest.source 不得声明 BUILTIN');
  }
  if (typeof manifest.moduleVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.moduleVersion)) {
    fail(file, `manifest.moduleVersion 必须是三段数字：${JSON.stringify(manifest.moduleVersion)}`);
  }
  if (typeof manifest.author !== 'string' || manifest.author.trim().length === 0) {
    fail(file, 'manifest.author 必填真实可追溯');
  }
  if (manifest.implementation !== 'declarative') {
    fail(file, 'manifest.implementation 只能声明式（declarative）');
  }
  if (!Array.isArray(doc.rules) || doc.rules.length === 0) {
    fail(file, '.zrule 内没有规则');
    return;
  }
  doc.rules.forEach((text, i) => {
    if (typeof text !== 'string') {
      fail(file, `rules[${i}] 必须是字符串`);
      return;
    }
    try {
      checkRule(`${file}#rules[${i}]`, JSON.parse(text));
    } catch (e) {
      fail(file, `rules[${i}] 不是合法 JSON：${e.message}`);
    }
  });
}

/**
 * 校验单个文件。
 * @param {string} path 文件路径
 */
function checkFile(path) {
  const file = basename(path);
  currentExempt = OFFICIAL_SAMPLE_EXEMPT.has(file);
  if (currentExempt) {
    console.log(`SKIP  [${file}] 官方教学示例：跳过 author/publishAt 四要素要求（仍做结构校验）`);
  }
  const text = readFileSync(path, 'utf8');
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    fail(file, `不是合法 JSON：${e.message}`);
    return;
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    fail(file, '顶层必须是 JSON 对象');
    return;
  }
  if (file.endsWith('.zrule') || doc.manifest !== undefined) {
    checkPackage(file, doc);
    return;
  }
  if (doc.format === 'zhencangx.recipe') {
    checkRule(file, doc);
    return;
  }
  // 非规则文件（第三方脚本参考、README 索引等）不入库校验范围
  warn(file, '不是 zhencangx.recipe 规则，已跳过校验（本仓库 rules/ 只应放可导入规则）');
}

/** 入口 */
function main() {
  const dir = process.argv[2] ?? 'rules';
  let entries = [];
  try {
    entries = readdirSync(dir).filter((f) => {
      const p = join(dir, f);
      return statSync(p).isFile() && /\.(json|zrule)$/.test(f);
    }).sort();
  } catch (e) {
    console.error(`无法读取目录 ${dir}：${e.message}`);
    process.exit(1);
  }
  if (entries.length === 0) {
    console.error(`目录 ${dir} 下没有可校验的规则文件`);
    process.exit(1);
  }
  for (const name of entries) {
    checkFile(join(dir, name));
  }
  for (const w of warnings) {
    console.log(`WARN  ${w}`);
  }
  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`ERROR ${e}`);
    }
    console.error(`\n规则校验失败：${errors.length} 个错误，${entries.length} 个文件`);
    process.exit(1);
  }
  console.log(`\n规则校验通过：${entries.length} 个文件，${warnings.length} 条提醒`);
}

main();
