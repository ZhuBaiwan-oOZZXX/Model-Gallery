import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadAppConfig } from "../config/appConfig.ts";
import { buildGroupRules } from "../config/groupConfig.ts";
import type { AppConfig, GroupRule } from "../types.ts";
import { fetchModels } from "../services/models.ts";
import { renderPage } from "../ui/page.ts";
import { escapeHtml } from "../ui/escape.ts";

let appConfigPromise: Promise<AppConfig> | null = null;
let groupRules: GroupRule[] | null = null;

function getAppConfig(): Promise<AppConfig> {
  if (!appConfigPromise) {
    appConfigPromise = loadAppConfig();
  }
  return appConfigPromise;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (url.pathname === "/favicon.svg") {
      const filePath = path.join(process.cwd(), "src/assets/favicon.svg");
      const file = await readFile(filePath);
      res.setHeader("Content-Type", "image/svg+xml");
      res.statusCode = 200;
      res.end(file);
      return;
    }

    const appConfig = await getAppConfig();
    if (!groupRules) {
      groupRules = buildGroupRules(appConfig.customGroupRules);
    }

    const siteName = url.searchParams.get("site") || appConfig.defaultSite;
    const site = appConfig.sites.find((s) => s.name === siteName) || appConfig.sites[0];

    if (!site) {
      res.statusCode = 500;
      res.end("没有可用的站点配置");
      return;
    }

    const { models, error } = await fetchModels(site);
    const html = renderPage(appConfig, site, models, error, groupRules);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.statusCode = 200;
    res.end(html);
  } catch (err) {
    const message = (err as Error).message || "服务器内部错误";
    if (!res.writableEnded) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.statusCode = 500;
      res.end(`<!DOCTYPE html><html><body><h2>配置错误</h2><pre>${escapeHtml(message)}</pre></body></html>`);
    }
  }
}

export default handleRequest;

if (!process.env.VERCEL && !process.env.TEST_SERVER) {
  const PORT = Number(process.env.PORT) || 3000;
  http.createServer(handleRequest).listen(PORT, () => {
    console.log(`\n  ▲ Model Gallery 开发服务器已启动`);
    console.log(`  ➜  本地访问: http://localhost:${PORT}\n`);
  });
}
