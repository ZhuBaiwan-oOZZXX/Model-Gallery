import { test, describe, afterEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAppConfig } from "../config/appConfig.ts";
import { groupModels } from "../services/models.ts";
import { buildGroupRules } from "../config/groupConfig.ts";
import type { CustomGroupRule } from "../types.ts";

const ORIGINAL_ENV = process.env.CONFIG_JSON;
let tempDir: string | undefined;

function setEnv(config: unknown): void {
  process.env.CONFIG_JSON = JSON.stringify(config);
}

function clearEnv(): void {
  delete process.env.CONFIG_JSON;
}

async function writeConfigFixture(config: unknown): Promise<string> {
  tempDir ??= await mkdtemp(join(tmpdir(), "model-gallery-config-test-"));
  const filePath = join(tempDir, `config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(filePath, JSON.stringify(config), "utf-8");
  return filePath;
}

describe("配置加载", () => {
  before(() => {
    delete process.env.CONFIG_JSON;
  });

  after(async () => {
    if (ORIGINAL_ENV) process.env.CONFIG_JSON = ORIGINAL_ENV;
    else delete process.env.CONFIG_JSON;
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  test("环境变量 CONFIG_JSON 优先加载", async () => {
    setEnv({
      sites: [{ name: "环境站点", apiUrl: "https://env.com", apiKey: "sk-env" }],
      defaultSite: "环境站点",
    });
    const config = await loadAppConfig();
    assert.equal(config.sites[0].name, "环境站点");
    assert.equal(config.defaultSite, "环境站点");
  });

  test("无环境变量时从指定配置文件加载", async () => {
    clearEnv();
    const configPath = await writeConfigFixture({
      sites: [{ name: "文件站点", apiUrl: "https://file.com", apiKey: "sk-file" }],
    });
    const config = await loadAppConfig(configPath);
    assert.equal(config.sites[0].name, "文件站点");
    assert.equal(config.defaultSite, "文件站点");
  });

  test("CONFIG_JSON JSON 格式错误时抛错", async () => {
    process.env.CONFIG_JSON = "{invalid json";
    await assert.rejects(() => loadAppConfig(), /解析失败/);
  });
});

describe("normalizeConfig 默认值填充", () => {
  before(() => delete process.env.CONFIG_JSON);
  after(() => {
    if (ORIGINAL_ENV) process.env.CONFIG_JSON = ORIGINAL_ENV;
    else delete process.env.CONFIG_JSON;
  });

  test("apiEndpoint 默认 /v1/models", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
    });
    const config = await loadAppConfig();
    assert.equal(config.sites[0].apiEndpoint, "/v1/models");
  });

  test("externalUrl 默认值填充", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
    });
    const config = await loadAppConfig();
    assert.ok(config.sites[0].externalUrl, "externalUrl 应有默认值");
  });

  test("iconUrl 默认值填充", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
    });
    const config = await loadAppConfig();
    assert.ok(config.sites[0].iconUrl, "iconUrl 应有默认值");
  });

  test("defaultSite 缺省时取第一个站点", async () => {
    setEnv({
      sites: [
        { name: "站点A", apiUrl: "https://a.com", apiKey: "sk-a" },
        { name: "站点B", apiUrl: "https://b.com", apiKey: "sk-b" },
      ],
    });
    const config = await loadAppConfig();
    assert.equal(config.defaultSite, "站点A");
  });

  test("自定义 apiEndpoint 覆盖默认值", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1", apiEndpoint: "/custom/endpoint" }],
    });
    const config = await loadAppConfig();
    assert.equal(config.sites[0].apiEndpoint, "/custom/endpoint");
  });

  test("自定义 externalUrl 覆盖默认值", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1", externalUrl: "https://custom.com" }],
    });
    const config = await loadAppConfig();
    assert.equal(config.sites[0].externalUrl, "https://custom.com");
  });

  test("自定义 iconUrl 覆盖默认值", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1", iconUrl: "https://custom.com/icon.png" }],
    });
    const config = await loadAppConfig();
    assert.equal(config.sites[0].iconUrl, "https://custom.com/icon.png");
  });
});

describe("validateConfig 错误检测", () => {
  before(() => delete process.env.CONFIG_JSON);
  after(() => {
    if (ORIGINAL_ENV) process.env.CONFIG_JSON = ORIGINAL_ENV;
    else delete process.env.CONFIG_JSON;
  });

  test("sites 为空时抛错", async () => {
    setEnv({ sites: [] });
    await assert.rejects(() => loadAppConfig(), /sites 为空/);
  });

  test("站点缺 name 时抛错", async () => {
    setEnv({ sites: [{ apiUrl: "https://api.com", apiKey: "sk-1" }] });
    await assert.rejects(() => loadAppConfig(), /缺少 name/);
  });

  test("站点缺 apiUrl 时抛错", async () => {
    setEnv({ sites: [{ name: "测试", apiKey: "sk-1" }] });
    await assert.rejects(() => loadAppConfig(), /缺少 apiUrl/);
  });

  test("站点缺 apiKey 时抛错", async () => {
    setEnv({ sites: [{ name: "测试", apiUrl: "https://api.com" }] });
    await assert.rejects(() => loadAppConfig(), /缺少 apiKey/);
  });

  test("defaultSite 不在 sites 中时抛错", async () => {
    setEnv({
      sites: [{ name: "站点A", apiUrl: "https://a.com", apiKey: "sk-a" }],
      defaultSite: "不存在的站点",
    });
    await assert.rejects(() => loadAppConfig(), /不在 sites 列表中/);
  });

  test("externalUrl 使用非 http/https 协议时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1", externalUrl: "javascript:alert(1)" }],
    });
    await assert.rejects(() => loadAppConfig(), /externalUrl 必须是 http:\/\/ 或 https:\/\/ 协议/);
  });

  test("iconUrl 使用非 http/https 协议时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1", iconUrl: "data:image/svg+xml,<svg></svg>" }],
    });
    await assert.rejects(() => loadAppConfig(), /iconUrl 必须是 http:\/\/ 或 https:\/\/ 协议/);
  });

  test("customGroupRules name 与内置分组重复时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [{ name: "OpenAI", keywords: ["test"] }],
    });
    await assert.rejects(() => loadAppConfig(), /重复/);
  });

  test("customGroupRules 之间 name 重复时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [
        { name: "自定义1", keywords: ["a"] },
        { name: "自定义1", keywords: ["b"] },
      ],
    });
    await assert.rejects(() => loadAppConfig(), /重复/);
  });

  test("customGroupRules 缺 name 时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [{ keywords: ["a"] }] as CustomGroupRule[],
    });
    await assert.rejects(() => loadAppConfig(), /缺少 name/);
  });

  test("customGroupRules keywords 为空时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [{ name: "自定义", keywords: [] }],
    });
    await assert.rejects(() => loadAppConfig(), /keywords 为空/);
  });

  test("customGroupRules 缺 keywords 时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [{ name: "自定义" }] as CustomGroupRule[],
    });
    await assert.rejects(() => loadAppConfig(), /keywords 为空/);
  });

  test("customGroupRules position.type 无效时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [{ name: "自定义", keywords: ["t"], position: { type: "invalid" as "first" } }],
    });
    await assert.rejects(() => loadAppConfig(), /position\.type/);
  });

  test("customGroupRules position.type=before 缺 target 时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [{ name: "自定义", keywords: ["t"], position: { type: "before" } }],
    });
    await assert.rejects(() => loadAppConfig(), /必须指定 target/);
  });

  test("customGroupRules position.target 无效时抛错", async () => {
    setEnv({
      sites: [{ name: "测试", apiUrl: "https://api.com", apiKey: "sk-1" }],
      customGroupRules: [{ name: "自定义", keywords: ["t"], position: { type: "before", target: "不存在的分组" } }],
    });
    await assert.rejects(() => loadAppConfig(), /不是有效的内置分组/);
  });
});

const DEFAULT_RULES = buildGroupRules();

describe("分组逻辑 - 内置分组", () => {
  test("GPT 模型归入 OpenAI", () => {
    const result = groupModels(["gpt-4", "gpt-3.5-turbo"], DEFAULT_RULES);
    assert.ok(result["OpenAI"]);
    assert.equal(result["OpenAI"].length, 2);
  });

  test("Claude 模型归入 Claude", () => {
    const result = groupModels(["claude-3-opus", "claude-3-sonnet"], DEFAULT_RULES);
    assert.ok(result["Claude"]);
    assert.equal(result["Claude"].length, 2);
  });

  test("Gemini 模型归入 Gemini", () => {
    const result = groupModels(["gemini-pro", "gemini-1.5-flash"], DEFAULT_RULES);
    assert.ok(result["Gemini"]);
  });

  test("DeepSeek 模型归入 DeepSeek", () => {
    const result = groupModels(["deepseek-chat", "deepseek-coder"], DEFAULT_RULES);
    assert.ok(result["DeepSeek"]);
  });

  test("Qwen 模型归入 Qwen", () => {
    const result = groupModels(["qwen-max", "qwq-32b"], DEFAULT_RULES);
    assert.ok(result["Qwen"]);
  });

  test("智谱模型归入 智谱", () => {
    const result = groupModels(["glm-4", "codegeex-2"], DEFAULT_RULES);
    assert.ok(result["智谱"]);
  });

  test("中文关键词 - 通义归入 Qwen", () => {
    const result = groupModels(["通义千问-max"], DEFAULT_RULES);
    assert.ok(result["Qwen"]);
  });

  test("中文关键词 - 智谱归入 智谱", () => {
    const result = groupModels(["智谱glm-4"], DEFAULT_RULES);
    assert.ok(result["智谱"]);
  });

  test("未匹配的模型归入 default", () => {
    const result = groupModels(["unknown-model-xyz"], DEFAULT_RULES);
    assert.ok(result["default"]);
    assert.equal(result["default"].length, 1);
  });

  test("大小写不敏感匹配", () => {
    const result = groupModels(["GPT-4", "Claude-3", "DEEPSEEK-chat"], DEFAULT_RULES);
    assert.ok(result["OpenAI"], "GPT-4 应归入 OpenAI");
    assert.ok(result["Claude"], "Claude-3 应归入 Claude");
    assert.ok(result["DeepSeek"], "DEEPSEEK-chat 应归入 DeepSeek");
  });
});

describe("分组逻辑 - 自定义分组", () => {
  test("first 位置插入到最前", () => {
    const rules = buildGroupRules([{ name: "自定义首", keywords: ["custom-first"], position: { type: "first" } }]);
    assert.equal(rules[0].name, "自定义首");
  });

  test("last 位置插入到最后", () => {
    const rules = buildGroupRules([{ name: "自定义尾", keywords: ["custom-last"], position: { type: "last" } }]);
    const last = rules[rules.length - 1];
    assert.equal(last.name, "自定义尾");
  });

  test("before 位置插入到目标前", () => {
    const rules = buildGroupRules([{ name: "插入OpenAI前", keywords: ["before-openai"], position: { type: "before", target: "OpenAI" } }]);
    const idx = rules.findIndex((r) => r.name === "插入OpenAI前");
    const openaiIdx = rules.findIndex((r) => r.name === "OpenAI");
    assert.notEqual(idx, -1);
    assert.notEqual(openaiIdx, -1);
    assert.equal(idx + 1, openaiIdx, "自定义分组应在 OpenAI 前");
  });

  test("无 position 默认 first", () => {
    const rules = buildGroupRules([{ name: "默认位置", keywords: ["default-pos"] }]);
    assert.equal(rules[0].name, "默认位置");
  });

  test("icon 缺省时用默认图标", () => {
    const rules = buildGroupRules([{ name: "无图标分组", keywords: ["no-icon"] }]);
    const rule = rules.find((r) => r.name === "无图标分组");
    assert.ok(rule);
    assert.ok(rule!.icon, "应有默认图标");
  });

  test("自定义 icon 生效", () => {
    const customIcon = "https://example.com/custom.png";
    const rules = buildGroupRules([{ name: "自定义图标", keywords: ["ci"], icon: customIcon }]);
    const rule = rules.find((r) => r.name === "自定义图标");
    assert.equal(rule!.icon, customIcon);
  });

  test("自定义分组关键词匹配模型", () => {
    const rules = buildGroupRules([{ name: "Safe分组", keywords: ["safe"] }]);
    const result = groupModels(["safe-model", "gpt-4", "unknown"], rules);
    assert.ok(result["Safe分组"], "safe-model 应归入自定义分组");
    assert.ok(result["OpenAI"], "gpt-4 应归入 OpenAI");
    assert.ok(result["default"], "unknown 应归入 default");
  });

  test("自定义分组优先于内置分组匹配", () => {
    const rules = buildGroupRules([{ name: "优先分组", keywords: ["gpt"] }]);
    const result = groupModels(["gpt-4"], rules);
    assert.ok(result["优先分组"], "自定义分组应优先匹配");
    assert.ok(!result["OpenAI"], "OpenAI 不应匹配");
  });

  test("before 目标不存在时插入到最前", () => {
    const rules = buildGroupRules([{ name: "目标不存在", keywords: ["x"], position: { type: "before", target: "不存在的分组" } }]);
    assert.equal(rules[0].name, "目标不存在");
  });

  test("多个自定义分组同时生效", () => {
    const rules = buildGroupRules([
      { name: "首组", keywords: ["first-kw"], position: { type: "first" } },
      { name: "尾组", keywords: ["last-kw"], position: { type: "last" } },
      { name: "OpenAI前组", keywords: ["before-kw"], position: { type: "before", target: "OpenAI" } },
    ]);
    const result = groupModels(["first-kw-model", "last-kw-model", "before-kw-model", "gpt-4"], rules);
    assert.ok(result["首组"]);
    assert.ok(result["尾组"]);
    assert.ok(result["OpenAI前组"]);
    assert.ok(result["OpenAI"]);
  });
});
