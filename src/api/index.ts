import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadAppConfig } from "../config/appConfig.ts";
import { applyCustomGroupRules } from "../config/groupConfig.ts";
import type { AppConfig } from "../types.ts";
import { fetchModels } from "../services/models.ts";
import { renderPage } from "../ui/page.ts";

let appConfigPromise: Promise<AppConfig> | null = null;

function getAppConfig(): Promise<AppConfig> {
  if (!appConfigPromise) {
    appConfigPromise = (async () => {
      const config = await loadAppConfig();
      applyCustomGroupRules(config.customGroupRules);
      return config;
    })();
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
    const siteName = url.searchParams.get("site") || appConfig.defaultSite;
    const site = appConfig.sites.find((s) => s.name === siteName) || appConfig.sites[0];

    if (!site) {
      res.statusCode = 500;
      res.end("没有可用的站点配置");
      return;
    }

    const { models, error } = await fetchModels(site);
    const html = renderPage(appConfig, site, models, error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.statusCode = 200;
    res.end(html);
  } catch (err) {
    const message = (err as Error).message || "服务器内部错误";
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end(`<!DOCTYPE html><html><body><h2>配置错误</h2><pre>${message}</pre></body></html>`);
    }
  }
}

export default handleRequest;

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  http.createServer(handleRequest).listen(PORT, () => {
    console.log(`\n  ▲ Model Gallery 开发服务器已启动`);
    console.log(`  ➜  本地访问: http://localhost:${PORT}\n`);
  });
}
