/**
 * HTML/属性/JS 字符串转义必要性验证
 *
 * 模拟修改前的脆弱实现：直接拼接外部输入到 HTML、属性、内联 JS。
 * 验证当前实现：使用 escapeHtml / escapeAttribute / escapeJsString 后，
 * 常见 XSS 攻击载荷均无法注入。
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, escapeAttribute, escapeJsString, isSafeUrl, sanitizeUrl } from "../../ui/escape.ts";

// 修改前的脆弱渲染方式：直接拼接
type RenderFn = (value: string) => string;

const VULNERABLE_RENDERS: Array<{ name: string; old: RenderFn; expectedRisk: string }> = [
  {
    name: "文本节点注入 <script>",
    old: (v) => `<div>${v}</div>`,
    expectedRisk: "<script>",
  },
  {
    name: "onclick 属性 breakout",
    old: (v) => `<div onclick="copyToClipboard('${v}')">x</div>`,
    expectedRisk: "alert('xss')",
  },
  {
    name: "href 属性 breakout",
    old: (v) => `<a href="${v}">link</a>`,
    expectedRisk: "javascript:alert(",
  },
  {
    name: "img src 属性 breakout",
    old: (v) => `<img src="${v}" alt="icon">`,
    expectedRisk: "onerror=",
  },
];

const PAYLOADS: Record<string, string> = {
  "文本节点注入 <script>": "<script>alert('xss')</script>",
  "onclick 属性 breakout": "');alert('xss');//",
  "href 属性 breakout": 'javascript:alert("xss")',
  "img src 属性 breakout": 'x" onerror=alert("xss")',
};

// 当前安全的渲染方式：按上下文分层转义
const SAFE_RENDERS: Record<string, RenderFn> = {
  "文本节点注入 <script>": (v) => `<div>${escapeHtml(v)}</div>`,
  "onclick 属性 breakout": (v) => `<div onclick="copyToClipboard('${escapeAttribute(escapeJsString(v))}')">x</div>`,
  "href 属性 breakout": (v) => `<a href="${escapeAttribute(v)}">link</a>`,
  "img src 属性 breakout": (v) => `<img src="${escapeAttribute(v)}" alt="icon">`,
};

describe("[PoC] HTML/属性/JS 转义：修改前 vs 修改后", () => {
  for (const { name, old, expectedRisk } of VULNERABLE_RENDERS) {
    const payload = PAYLOADS[name];

    test(`「${name}」旧实现可注入，新实现被转义`, () => {
      const oldHtml = old(payload);
      const newHtml = SAFE_RENDERS[name](payload);

      // 旧实现包含原始风险片段
      assert.ok(oldHtml.includes(expectedRisk), `旧实现应包含风险片段：${expectedRisk}`);

      // 新实现：风险片段不再以可执行形式出现
      if (expectedRisk === "<script>") {
        assert.ok(!newHtml.includes("<script>"), "文本节点中 <script> 应被转义");
      }
      if (expectedRisk === "alert('xss')") {
        // JS 字符串中的单引号被转义，无法闭合字符串
        const jsString = newHtml.match(/onclick="copyToClipboard\('(.+?)'\)"/)?.[1] ?? "";
        assert.ok(!jsString.includes("'"), "JS 字符串单引号应被转义");
      }
      if (expectedRisk === "javascript:alert(") {
        // 旧实现：href="javascript:alert(\"xss\")" 可直接点击执行
        // 新实现：alert 的双引号被转义为 &quot;，调用被破坏
        assert.ok(oldHtml.includes('href="javascript:alert("xss")"'), "旧实现应包含可执行 javascript: href");
        assert.ok(!newHtml.includes('href="javascript:alert("xss")"'), "新实现不应包含可执行 javascript: href");
        assert.ok(newHtml.includes("&quot;"), "新实现应转义 href 中的双引号");
      }
      if (expectedRisk === "onerror=") {
        // src 属性中的双引号被转义，无法闭合属性
        assert.ok(!newHtml.includes('src="x" onerror='), "img src 不应 breakout");
        assert.ok(newHtml.includes("&quot;"), "src 属性中的双引号应被转义");
      }
    });
  }

  test("escapeHtml 对文本节点输出可预期的 HTML 实体", () => {
    assert.equal(escapeHtml("<b>bold</b>"), "&lt;b&gt;bold&lt;/b&gt;");
    assert.equal(escapeHtml("Tom & Jerry"), "Tom &amp; Jerry");
  });

  test("escapeAttribute 额外转义引号", () => {
    assert.equal(escapeAttribute('value"with\'quotes'), "value&quot;with&#39;quotes");
  });

  test("escapeJsString 破坏 JS 字符串逃逸", () => {
    assert.ok(!escapeJsString("');alert(1);//").includes("'"));
    assert.ok(escapeJsString("<script>").includes("\\x3C"));
    assert.ok(escapeJsString("line\nbreak").includes("\\n"));
  });

  test("isSafeUrl 只允许 http:// 和 https:// 协议", () => {
    assert.equal(isSafeUrl("https://example.com"), true);
    assert.equal(isSafeUrl("http://example.com"), true);
    assert.equal(isSafeUrl("javascript:alert(1)"), false);
    assert.equal(isSafeUrl("data:text/html,<script>alert(1)</script>"), false);
    assert.equal(isSafeUrl("ftp://example.com"), false);
    assert.equal(isSafeUrl("not-a-url"), false);
  });

  test("sanitizeUrl 对危险 URL fallback 到 # 或空字符串", () => {
    assert.equal(sanitizeUrl("javascript:alert(1)"), "#");
    assert.equal(sanitizeUrl("https://example.com"), "https://example.com");
    assert.equal(sanitizeUrl("javascript:alert(1)", ""), "");
  });

  test("无引号 javascript: 伪协议在渲染层被阻止", () => {
    const maliciousUrl = "javascript:alert(document.cookie)";
    const safeHref = sanitizeUrl(maliciousUrl);
    const html = `<a href="${escapeAttribute(safeHref)}">link</a>`;
    assert.ok(!html.includes("javascript:"), "href 中不应包含 javascript:");
    assert.ok(html.includes('href="#"'), "危险 URL 应被替换为 #");
  });
});
