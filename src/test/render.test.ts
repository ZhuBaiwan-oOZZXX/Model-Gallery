import { test, describe, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { applyCustomGroupRules, GROUP_RULES } from "../config/groupConfig.ts";
import { renderPage } from "../ui/page.ts";
import { renderHeader, renderSiteSelector, renderRefreshButton } from "../ui/components.ts";
import type { AppConfig, SiteConfig } from "../types.ts";

const ORIGINAL_GROUP_RULES = [...GROUP_RULES];

function resetGroupRules(): void {
  GROUP_RULES.length = 0;
  GROUP_RULES.push(...ORIGINAL_GROUP_RULES);
}

const SECRET_KEY = "sk-SECRET-KEY-12345-UNIQUE";

const TEST_SITE: SiteConfig = {
  name: "测试站点",
  apiUrl: "https://api.example.com",
  apiKey: SECRET_KEY,
  apiEndpoint: "/v1/models",
  externalUrl: "https://external.example.com",
  iconUrl: "https://icon.example.com/logo.png",
};

const TEST_OTHER_SITE: SiteConfig = {
  name: "其他站点",
  apiUrl: "https://other.com",
  apiKey: "sk-other-key",
  apiEndpoint: "/v1/models",
  externalUrl: "https://other.example.com",
  iconUrl: "https://other.example.com/icon.png",
};

const TEST_CONFIG: AppConfig = {
  sites: [TEST_SITE, TEST_OTHER_SITE],
  defaultSite: "测试站点",
};

describe("渲染字段验证", () => {
  before(() => resetGroupRules());
  after(() => resetGroupRules());
  afterEach(() => resetGroupRules());

  test("site.name 渲染到 header", () => {
    const html = renderHeader(TEST_SITE, 3, 10);
    assert.ok(html.includes("测试站点"), "header 应包含站点名");
  });

  test("groupCount 渲染到 header", () => {
    const html = renderHeader(TEST_SITE, 7, 20);
    assert.ok(html.includes(">7<"), "header 应包含渠道数");
  });

  test("modelCount 渲染到 header", () => {
    const html = renderHeader(TEST_SITE, 3, 42);
    assert.ok(html.includes(">42<"), "header 应包含模型数");
  });

  test("site.externalUrl 渲染到 header 链接", () => {
    const html = renderHeader(TEST_SITE, 3, 10);
    assert.ok(html.includes('href="https://external.example.com"'), "header 应包含 externalUrl");
  });

  test("site.iconUrl 渲染到 header 图标", () => {
    const html = renderHeader(TEST_SITE, 3, 10);
    assert.ok(html.includes('src="https://icon.example.com/logo.png"'), "header 应包含 iconUrl");
  });

  test("site selector 多站点时渲染切换链接", () => {
    const html = renderSiteSelector(TEST_CONFIG, "测试站点");
    assert.ok(html.includes("其他站点"), "应包含其他站点名");
    assert.ok(html.includes("/?site="), "应包含站点切换链接");
    assert.ok(!html.includes("测试站点".padStart(0)), "当前站点不应出现在下拉列表"); // 当前站点被过滤
  });

  test("site selector 单站点时不渲染", () => {
    const singleConfig: AppConfig = { sites: [TEST_SITE], defaultSite: "测试站点" };
    const html = renderSiteSelector(singleConfig, "测试站点");
    assert.equal(html, "", "单站点时 site selector 应为空");
  });

  test("refresh button 包含当前站点链接", () => {
    const html = renderRefreshButton("测试站点");
    const encoded = encodeURIComponent("测试站点");
    assert.ok(html.includes(`/\\?site=${encoded}`) || html.includes(`/?site=${encoded}`), "应包含编码后的站点链接");
  });

  test("refresh button 无站点名时链接为根路径", () => {
    const html = renderRefreshButton("");
    assert.ok(html.includes('href="/"'), "无站点名时应链接到根路径");
  });

  test("完整页面渲染包含站点信息", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, ["gpt-4", "claude-3"], null);
    assert.ok(html.includes("测试站点"), "页面应包含站点名");
    assert.ok(html.includes("https://external.example.com"), "页面应包含 externalUrl");
    assert.ok(html.includes("https://icon.example.com/logo.png"), "页面应包含 iconUrl");
  });

  test("完整页面渲染包含分组", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, ["gpt-4", "claude-3", "gemini-pro"], null);
    assert.ok(html.includes("OpenAI"), "页面应包含 OpenAI 分组");
    assert.ok(html.includes("Claude"), "页面应包含 Claude 分组");
    assert.ok(html.includes("Gemini"), "页面应包含 Gemini 分组");
  });

  test("自定义分组渲染到页面", () => {
    applyCustomGroupRules([{ name: "Safe分组", keywords: ["safe"] }]);
    const html = renderPage(TEST_CONFIG, TEST_SITE, ["safe-model", "gpt-4"], null);
    assert.ok(html.includes("Safe分组"), "页面应包含自定义分组名");
    resetGroupRules();
  });

  test("错误信息渲染到页面", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, null, "API 连接失败");
    assert.ok(html.includes("API 连接失败"), "页面应包含错误信息");
    assert.ok(html.includes("获取模型失败"), "页面应包含错误标题");
  });

  test("空模型列表渲染空状态", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, [], null);
    assert.ok(html.includes("暂无模型可用"), "页面应显示空状态");
  });

  test("模型名渲染到卡片", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, ["gpt-4-turbo"], null);
    assert.ok(html.includes("gpt-4-turbo"), "页面应包含模型名");
  });
});

describe("安全性验证 - API Key 不泄露", () => {
  before(() => resetGroupRules());
  after(() => resetGroupRules());

  test("renderHeader 不包含 apiKey", () => {
    const html = renderHeader(TEST_SITE, 3, 10);
    assert.ok(!html.includes(SECRET_KEY), "header 不应包含 apiKey");
    assert.ok(!html.includes("SECRET"), "header 不应包含密钥片段");
  });

  test("renderSiteSelector 不包含 apiKey", () => {
    const html = renderSiteSelector(TEST_CONFIG, "测试站点");
    assert.ok(!html.includes(SECRET_KEY), "site selector 不应包含 apiKey");
    assert.ok(!html.includes("SECRET"), "site selector 不应包含密钥片段");
  });

  test("renderRefreshButton 不包含 apiKey", () => {
    const html = renderRefreshButton("测试站点");
    assert.ok(!html.includes(SECRET_KEY), "refresh button 不应包含 apiKey");
  });

  test("renderPage 正常页不包含 apiKey", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, ["gpt-4"], null);
    assert.ok(!html.includes(SECRET_KEY), "页面不应包含 apiKey");
    assert.ok(!html.includes("SECRET"), "页面不应包含密钥片段");
  });

  test("renderPage 错误页不包含 apiKey", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, null, "测试错误");
    assert.ok(!html.includes(SECRET_KEY), "错误页不应包含 apiKey");
    assert.ok(!html.includes("SECRET"), "错误页不应包含密钥片段");
  });

  test("renderPage 空状态页不包含 apiKey", () => {
    const html = renderPage(TEST_CONFIG, TEST_SITE, [], null);
    assert.ok(!html.includes(SECRET_KEY), "空状态页不应包含 apiKey");
  });

  test("其他站点 apiKey 也不泄露", () => {
    const html = renderPage(TEST_CONFIG, TEST_OTHER_SITE, ["gpt-4"], null);
    assert.ok(!html.includes("sk-other-key"), "不应包含其他站点 apiKey");
  });
});
