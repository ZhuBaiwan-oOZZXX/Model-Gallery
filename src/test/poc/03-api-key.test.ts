/**
 * API Key 防泄露必要性验证
 *
 * 模拟修改前的脆弱实现：将站点对象直接序列化或拼接进 HTML。
 * 验证当前实现：renderHeader / renderSiteSelector / renderRefreshButton / renderPage
 * 均不会把 apiKey 输出到页面。
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderHeader, renderRefreshButton, renderSiteSelector } from "../../ui/components.ts";
import { renderPage } from "../../ui/page.ts";
import { buildGroupRules } from "../../config/groupConfig.ts";
import type { AppConfig, SiteConfig } from "../../types.ts";

const RULES = buildGroupRules();

const SITE: SiteConfig = {
  name: "泄漏风险站点",
  apiUrl: "https://api.example.com",
  apiKey: "sk-live-secret-key-12345",
  apiEndpoint: "/v1/models",
  externalUrl: "https://example.com",
  iconUrl: "https://example.com/icon.png",
};

const APP_CONFIG: AppConfig = {
  sites: [SITE, { ...SITE, name: "另一个站点", apiKey: "sk-another-secret" }],
  defaultSite: SITE.name,
};

// 修改前的脆弱实现：可能把站点对象序列化到某个属性或直接输出
function oldRenderHeader(site: SiteConfig): string {
  return `<header data-site='${JSON.stringify(site)}'><h1>${site.name}</h1></header>`;
}

describe("[PoC] API Key 防泄露：修改前 vs 修改后", () => {
  test("旧实现会把包含 apiKey 的 JSON 直接输出到 HTML", () => {
    const html = oldRenderHeader(SITE);
    assert.ok(html.includes(SITE.apiKey), "旧实现泄露了 API Key");
  });

  test("renderHeader 不输出 apiKey", () => {
    const html = renderHeader(SITE, 1, 1);
    assert.ok(!html.includes(SITE.apiKey), "renderHeader 不得包含 apiKey");
  });

  test("renderSiteSelector 不输出任何站点的 apiKey", () => {
    const html = renderSiteSelector(APP_CONFIG, SITE.name);
    assert.ok(!html.includes("sk-live-secret-key-12345"), "不得包含第一个站点 apiKey");
    assert.ok(!html.includes("sk-another-secret"), "不得包含第二个站点 apiKey");
  });

  test("renderRefreshButton 不输出 apiKey", () => {
    const html = renderRefreshButton(SITE.name);
    assert.ok(!html.includes(SITE.apiKey), "renderRefreshButton 不得包含 apiKey");
  });

  test("renderPage 在正常页、错误页、空状态页均不输出 apiKey", () => {
    const normalHtml = renderPage(APP_CONFIG, SITE, ["gpt-4"], null, RULES);
    const errorHtml = renderPage(APP_CONFIG, SITE, null, "获取模型失败", RULES);
    const emptyHtml = renderPage(APP_CONFIG, SITE, [], null, RULES);

    for (const html of [normalHtml, errorHtml, emptyHtml]) {
      assert.ok(!html.includes(SITE.apiKey), "renderPage 不得包含 apiKey");
    }
  });
});
