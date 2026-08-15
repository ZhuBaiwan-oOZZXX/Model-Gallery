import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { Server } from "node:http";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_TEST_SERVER = process.env.TEST_SERVER;
const ORIGINAL_CONFIG_JSON = process.env.CONFIG_JSON;

const TEST_CONFIG = {
  sites: [
    {
      name: "测试站点A",
      apiUrl: "https://api.example.com",
      apiKey: "sk-test-key-a",
      apiEndpoint: "/v1/models",
      externalUrl: "https://a.example.com",
      iconUrl: "https://a.example.com/icon.png",
    },
    {
      name: "测试站点B",
      apiUrl: "https://api.b.example.com",
      apiKey: "sk-test-key-b",
      apiEndpoint: "/v1/models",
      externalUrl: "https://b.example.com",
      iconUrl: "https://b.example.com/icon.png",
    },
  ],
  defaultSite: "测试站点A",
};

describe("集成测试：启动服务器后检测", () => {
  let server: Server;
  let baseUrl: string;
  let handleRequest: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;

  before(async () => {
    process.env.TEST_SERVER = "1";
    process.env.CONFIG_JSON = JSON.stringify(TEST_CONFIG);

    globalThis.fetch = async (input, init) => {
      const requestUrl = String(input);
      const headers = init?.headers as Record<string, string>;
      const siteB = requestUrl.startsWith("https://api.b.example.com");
      assert.equal(headers.Authorization, siteB ? "Bearer sk-test-key-b" : "Bearer sk-test-key-a");
      return new Response(JSON.stringify({ data: [{ id: siteB ? "gemini-pro" : "gpt-4" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const module = await import("../api/index.ts");
    handleRequest = module.default;

    server = http.createServer((req, res) => {
      void handleRequest(req, res);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address && typeof address === "object") {
      baseUrl = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error("无法获取服务器地址");
    }
  });

  after(async () => {
    globalThis.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_TEST_SERVER === undefined) delete process.env.TEST_SERVER;
    else process.env.TEST_SERVER = ORIGINAL_TEST_SERVER;
    if (ORIGINAL_CONFIG_JSON === undefined) delete process.env.CONFIG_JSON;
    else process.env.CONFIG_JSON = ORIGINAL_CONFIG_JSON;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function fetchText(
    path: string,
  ): Promise<{ status: number; text: string; contentType: string | null; cacheControl: string | null }> {
    return new Promise((resolve, reject) => {
      http
        .get(`${baseUrl}${path}`, (res) => {
          let data = "";
          res.setEncoding("utf-8");
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({
              status: res.statusCode || 0,
              text: data,
              contentType: res.headers["content-type"] || null,
              cacheControl: res.headers["cache-control"] || null,
            });
          });
        })
        .on("error", reject);
    });
  }

  test("主页返回 200，包含标题、默认站点和模型，且不泄露 API Key", async () => {
    const { status, text } = await fetchText("/");

    assert.equal(status, 200);
    assert.ok(text.includes("Model Gallery"));
    assert.ok(text.includes("测试站点A"));
    assert.ok(text.includes("gpt-4"));
    assert.ok(!text.includes("sk-test-key-a"));
    assert.ok(!text.includes("sk-test-key-b"));
  });

  test("主页带边缘缓存头，错误页不缓存", async () => {
    const home = await fetchText("/");
    assert.ok(home.cacheControl?.includes("s-maxage=60"), "主页应设置边缘缓存 TTL");
    assert.ok(home.cacheControl?.includes("stale-while-revalidate"), "主页应允许后台重新验证");

    const notFound = await fetchText("/unknown-path");
    assert.equal(notFound.status, 404);
    assert.equal(notFound.cacheControl, "no-store", "错误页不应被缓存");
  });

  test("favicon 返回 200 且内容类型为 SVG", async () => {
    const { status, text, contentType } = await fetchText("/favicon.svg");

    assert.equal(status, 200);
    assert.ok(contentType?.includes("image/svg+xml"));
    assert.ok(text.includes("<svg"));
  });

  test("站点切换返回 200 并显示目标站点", async () => {
    const { status, text } = await fetchText(`/?site=${encodeURIComponent("测试站点B")}`);

    assert.equal(status, 200);
    assert.ok(text.includes("gemini-pro"));
    assert.ok(!text.includes("sk-test-key-b"));
  });

  test("未知路径返回 404", async () => {
    const { status, text } = await fetchText("/unknown-path");

    assert.equal(status, 404);
    assert.ok(text.includes("页面不存在"));
  });
});
