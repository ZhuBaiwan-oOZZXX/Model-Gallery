import { readFileSync } from "node:fs";

// 零构建：CSS/JS 以真实文件存放在 src/assets/，模块加载时读取一次并内联进 HTML。
// 与 favicon 的读取方式一致，Vercel 侧由 vercel.json 的 includeFiles: "src/**" 保证文件随函数打包。

/** 页面内联样式。 */
export const CSS_STYLES = readFileSync(new URL("../assets/app.css", import.meta.url), "utf-8");

/** 页面内联脚本（body 末尾执行）。 */
export const JS_SCRIPTS = readFileSync(new URL("../assets/app.js", import.meta.url), "utf-8");

/** <head> 内联的主题初始化脚本：首屏渲染前恢复已保存主题，避免暗色用户闪烁。localStorage 键与 app.js 的 THEME_KEY 保持一致。 */
export const THEME_INIT_SCRIPT = `
  (() => {
    try {
      const theme = localStorage.getItem("theme");
      if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
    } catch { /* storage 不可用 */ }
  })();
`;
