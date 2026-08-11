import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fetchModels } from "../services/models.ts";
import type { SiteConfig } from "../types.ts";

const ORIGINAL_FETCH = globalThis.fetch;

const TEST_SITE: SiteConfig = {
  name: "测试站点",
  apiUrl: "https://api.example.com/",
  apiKey: "sk-test-key",
  apiEndpoint: "/v1/models",
  externalUrl: "https://example.com",
  iconUrl: "https://example.com/icon.png",
};

type FetchMock = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function mockFetch(handler: FetchMock): void {
  globalThis.fetch = handler as typeof fetch;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), init);
}

describe("模型服务 fetchModels", () => {
  beforeEach(() => {
    globalThis.fetch = (() => {
      throw new Error("测试未 mock fetch，禁止真实网络请求");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  test("成功响应返回模型 ID，并使用站点 URL、Endpoint 和鉴权头", async () => {
    let called = false;
    mockFetch(async (input, init) => {
      called = true;
      const headers = init?.headers as Record<string, string>;
      assert.equal(input, "https://api.example.com/v1/models");
      assert.equal(headers.Authorization, "Bearer sk-test-key");
      assert.equal(headers["Content-Type"], "application/json");
      assert.ok(init?.signal instanceof AbortSignal);
      return jsonResponse({ data: [{ id: "gpt-4" }, { id: "claude-3" }] }, { status: 200 });
    });

    const result = await fetchModels(TEST_SITE);

    assert.equal(called, true);
    assert.deepEqual(result, { models: ["gpt-4", "claude-3"], error: null });
  });

  test("非 2xx 响应返回明确错误", async () => {
    mockFetch(async () => jsonResponse({ error: "unauthorized" }, { status: 401, statusText: "Unauthorized" }));

    const result = await fetchModels(TEST_SITE);

    assert.equal(result.models, null);
    assert.equal(result.error, "获取模型失败: 401 Unauthorized");
  });

  test("非法 JSON 返回明确错误", async () => {
    mockFetch(async () => new Response("not-json", { status: 200 }));

    const result = await fetchModels(TEST_SITE, 20);

    assert.equal(result.models, null);
    assert.equal(result.error, "API 响应不是有效 JSON");
  });

  test("非法响应结构返回明确错误", async () => {
    mockFetch(async () => jsonResponse({ models: ["gpt-4"] }, { status: 200 }));

    const result = await fetchModels(TEST_SITE);

    assert.equal(result.models, null);
    assert.equal(result.error, "API 响应格式不符合预期");
  });

  test("忽略缺失、非字符串和空字符串模型 ID", async () => {
    mockFetch(async () =>
      jsonResponse(
        {
          data: [{ id: "gpt-4" }, {}, { id: 123 }, { id: "" }, { id: "   " }, { id: " claude-3 " }],
        },
        { status: 200 },
      ),
    );

    const result = await fetchModels(TEST_SITE);

    assert.deepEqual(result, { models: ["gpt-4", "claude-3"], error: null });
  });

  test("网络异常返回通用请求失败错误且不泄露 API Key", async () => {
    mockFetch(async () => {
      throw new Error("connect failed with sk-test-key");
    });

    const result = await fetchModels(TEST_SITE);

    assert.equal(result.models, null);
    assert.equal(result.error, "模型接口请求失败，请稍后重试");
    assert.ok(!result.error.includes(TEST_SITE.apiKey));
  });

  test("超时中止请求并返回超时错误且不泄露 API Key", async () => {
    let aborted = false;
    mockFetch(
      (async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        })) as FetchMock,
    );

    const result = await fetchModels(TEST_SITE, 20);

    assert.equal(aborted, true);
    assert.deepEqual(result, { models: null, error: "获取模型超时，请稍后重试" });
    assert.ok(!result.error.includes(TEST_SITE.apiKey));
  });
});
