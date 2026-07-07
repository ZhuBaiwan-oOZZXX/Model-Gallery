/**
 * 模型服务必要性验证
 *
 * 模拟修改前的脆弱实现：无超时、无响应结构校验、无错误分类。
 * 验证当前实现：fetchModels 在超时、非 2xx、非法 JSON、非法结构、网络异常
 * 等场景下均能返回可控错误，且不会输出 undefined/空字符串模型 ID。
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchModels } from "../../services/models.ts";
import type { SiteConfig } from "../../types.ts";

const ORIGINAL_FETCH = globalThis.fetch;

const TEST_SITE: SiteConfig = {
  name: "验证站点",
  apiUrl: "https://api.example.com/",
  apiKey: "sk-secret-key",
  apiEndpoint: "/v1/models",
  externalUrl: "https://example.com",
  iconUrl: "https://example.com/icon.png",
};

// 修改前的脆弱实现：无超时、无校验、无错误分类
async function oldFetchModels(site: SiteConfig): Promise<string[]> {
  const url = `${site.apiUrl.replace(/\/$/, "")}/${site.apiEndpoint.replace(/^\//, "")}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${site.apiKey}`, "Content-Type": "application/json" },
  });
  const data = (await response.json()) as { data: Array<{ id: string }> };
  return data.data.map((m) => m.id);
}

describe("[PoC] 模型服务：修改前 vs 修改后", () => {
  beforeEach(() => {
    globalThis.fetch = (() => {
      throw new Error("unmocked fetch");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  test("旧实现遇到非 2xx 会抛异常，新实现返回明确错误", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

    await assert.rejects(() => oldFetchModels(TEST_SITE), /unauthorized|Cannot read properties of undefined|Unexpected token|fetch failed/);

    const result = await fetchModels(TEST_SITE);
    assert.equal(result.models, null);
    assert.match(result.error!, /401/);
  });

  test("旧实现遇到非法 JSON 会抛异常，新实现返回明确错误", async () => {
    globalThis.fetch = async () => new Response("not-json", { status: 200 });

    await assert.rejects(() => oldFetchModels(TEST_SITE), /Unexpected token|JSON/);

    const result = await fetchModels(TEST_SITE);
    assert.equal(result.models, null);
    assert.equal(result.error, "API 响应不是有效 JSON");
  });

  test("旧实现会输出 undefined/非字符串/空字符串模型 ID，新实现过滤它们", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "gpt-4" }, {}, { id: 123 }, { id: "" }, { id: "   " }, { id: "claude-3" }],
        }),
        { status: 200 },
      );

    const oldResult = await oldFetchModels(TEST_SITE);
    assert.ok(oldResult.includes(undefined as unknown as string) || oldResult.includes("" as string), "旧实现包含脏数据");

    const newResult = await fetchModels(TEST_SITE);
    assert.deepEqual(newResult.models, ["gpt-4", "claude-3"]);
    assert.equal(newResult.error, null);
  });

  test("旧实现无超时会被慢响应挂住，新实现 10 秒后返回超时错误", async () => {
    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });

    const start = Date.now();
    const result = await fetchModels(TEST_SITE);
    const elapsed = Date.now() - start;

    assert.equal(result.models, null);
    assert.equal(result.error, "获取模型超时，请稍后重试");
    assert.ok(elapsed >= 9000 && elapsed <= 12000, `超时应约 10 秒，实际 ${elapsed}ms`);
  });

  test("错误信息中不泄露 API Key", async () => {
    globalThis.fetch = async () => {
      throw new Error(`connect failed with ${TEST_SITE.apiKey}`);
    };

    const result = await fetchModels(TEST_SITE);
    assert.ok(!result.error!.includes(TEST_SITE.apiKey), "错误信息不得包含 API Key");
  });
});
