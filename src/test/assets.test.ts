import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CSS_STYLES, JS_SCRIPTS, THEME_INIT_SCRIPT } from "../ui/assets.ts";

describe("内联资源（app.css / app.js）", () => {
  test("CSS 使用 light-dark 主题且不再依赖 Tailwind CDN", () => {
    assert.ok(CSS_STYLES.includes("light-dark("), "样式应使用 light-dark() 合并主题色板");
    assert.ok(!CSS_STYLES.includes("cdn.tailwindcss.com"), "样式不应包含 Tailwind CDN");
  });

  test("CSS 包含核心组件样式", () => {
    for (const token of [
      ".theme-toggle",
      ".model-card",
      ".group-content",
      ".page-header",
      ".site-selector",
      ".toast",
    ]) {
      assert.ok(CSS_STYLES.includes(token), `样式应包含 ${token}`);
    }
  });

  test("theme-toggle 继承 icon-btn 的 fixed 定位（回归：不得覆盖 position）", () => {
    const iconBtn = CSS_STYLES.match(/\.icon-btn\s*\{([^}]*)\}/)?.[1] ?? "";
    const themeToggle = CSS_STYLES.match(/\.theme-toggle\s*\{([^}]*)\}/)?.[1] ?? "";
    assert.ok(iconBtn.includes("position: fixed"), ".icon-btn 应声明 fixed 定位");
    assert.ok(!themeToggle.includes("position"), ".theme-toggle 不应覆盖 position 属性");
  });

  test("JS 包含全部交互处理器", () => {
    for (const token of ["toggle-theme", "toggle-site-selector", "copy-model", "toggle-group"]) {
      assert.ok(JS_SCRIPTS.includes(token), `脚本应包含 ${token} 处理器`);
    }
  });

  test("JS 维护 aria-expanded 与 hidden 状态而非拼 Tailwind 类名", () => {
    assert.ok(JS_SCRIPTS.includes('setAttribute("aria-expanded"'), "脚本应维护 aria-expanded");
    assert.ok(JS_SCRIPTS.includes("dropdown.hidden"), "脚本应通过 hidden 属性控制下拉框");
  });

  test("主题初始化脚本读取 localStorage 并设置 data-theme", () => {
    assert.ok(THEME_INIT_SCRIPT.includes('localStorage.getItem("theme")'), "应读取已保存主题");
    assert.ok(THEME_INIT_SCRIPT.includes("data-theme"), "应设置 data-theme");
  });
});
