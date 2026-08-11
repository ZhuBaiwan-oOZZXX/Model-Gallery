import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadAppConfig } from "../config/appConfig.ts";
import { buildGroupRules } from "../config/groupConfig.ts";
import type { AppConfig, GroupRule, SiteConfig } from "../types.ts";
import { fetchModels } from "../services/models.ts";
import { renderPage } from "../ui/page.ts";
import { escapeHtml } from "../ui/escape.ts";

interface RuntimeSnapshot {
  config: AppConfig;
  rules: GroupRule[];
}

let runtimePromise: Promise<RuntimeSnapshot> | null = null;
const faviconPath = fileURLToPath(new URL("../assets/favicon.svg", import.meta.url));

function getRuntime(): Promise<RuntimeSnapshot> {
  if (!runtimePromise) {
    runtimePromise = loadAppConfig()
      .then((config) => ({ config, rules: buildGroupRules(config.customGroupRules) }))
      .catch((error) => {
        runtimePromise = null;
        throw error;
      });
  }
  return runtimePromise;
}

function writeHtml(res: http.ServerResponse, statusCode: number, html: string): void {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.statusCode = statusCode;
  res.end(html);
}

function writeError(res: http.ServerResponse, statusCode: number, title: string, message: string): void {
  writeHtml(
    res,
    statusCode,
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head><body><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></body></html>`,
  );
}

async function serveFavicon(res: http.ServerResponse, headOnly: boolean): Promise<void> {
  const file = await readFile(faviconPath);
  res.setHeader("Content-Type", "image/svg+xml");
  res.statusCode = 200;
  if (headOnly) res.end();
  else res.end(file);
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    writeError(res, 405, "不支持的请求方法", "只支持 GET 和 HEAD 请求");
    return;
  }

  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const headOnly = req.method === "HEAD";

    if (url.pathname === "/favicon.svg") {
      await serveFavicon(res, headOnly);
      return;
    }
    if (url.pathname !== "/") {
      writeError(res, 404, "页面不存在", "请求的页面不存在");
      return;
    }

    const runtime = await getRuntime();
    const requestedSite = url.searchParams.get("site");
    const siteName = requestedSite ?? runtime.config.defaultSite;
    const site = runtime.config.sites.find((candidate) => candidate.name.toLowerCase() === siteName.toLowerCase());
    if (!site) {
      writeError(res, 404, "站点不存在", "请求的站点不存在");
      return;
    }

    const result = await fetchModels(site);
    const statusCode = result.error ? (result.error.includes("超时") ? 504 : 502) : 200;
    const html = renderPage(runtime.config, site, result.models, result.error, runtime.rules);
    if (headOnly) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.statusCode = statusCode;
      res.end();
    } else {
      writeHtml(res, statusCode, html);
    }
  } catch (error) {
    console.error("请求处理失败:", error);
    if (!res.writableEnded) writeError(res, 500, "服务器错误", "服务器暂时无法处理请求");
  }
}

export default handleRequest;

if (!process.env.VERCEL && !process.env.TEST_SERVER) {
  const port = Number(process.env.PORT) || 3000;
  http.createServer(handleRequest).listen(port, () => {
    console.log(`\n  ▲ Model Gallery 开发服务器已启动`);
    console.log(`  ➜  本地访问: http://localhost:${port}\n`);
  });
}
