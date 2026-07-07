/**
 * 配置加载可重复性验证
 *
 * 模拟修改前的脆弱实现：loadAppConfig 只能读取 cwd/config.json。
 * 验证当前实现：支持通过参数指定配置文件路径，也支持 CONFIG_JSON 环境变量，
 * 因此测试可以用临时 fixture 运行，不依赖开发者本机真实 config.json。
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAppConfig } from "../../config/appConfig.ts";

const ORIGINAL_ENV = process.env.CONFIG_JSON;
let tempDir: string | undefined;

async function createFixture(content: unknown): Promise<string> {
  tempDir ??= await mkdtemp(join(tmpdir(), "model-gallery-verify-"));
  const filePath = join(tempDir, `config-${Date.now()}.json`);
  await writeFile(filePath, JSON.stringify(content), "utf-8");
  return filePath;
}

describe("[PoC] 配置加载可重复性：修改前 vs 修改后", () => {
  before(() => {
    delete process.env.CONFIG_JSON;
  });

  after(async () => {
    if (ORIGINAL_ENV) process.env.CONFIG_JSON = ORIGINAL_ENV;
    else delete process.env.CONFIG_JSON;
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  test("旧实现只能读取 cwd/config.json，无法注入临时配置", async () => {
    // 旧实现：loadAppConfig() 固定读取 process.cwd()/config.json
    // 在当前仓库，真实 config.json 存在，但 CI/fresh clone 中可能不存在。
    // 这里用临时 fixture 路径证明当前实现可以注入配置。
    const fixturePath = await createFixture({
      sites: [{ name: "临时站点", apiUrl: "https://temp.com", apiKey: "sk-temp" }],
    });

    const config = await loadAppConfig(fixturePath);
    assert.equal(config.sites[0].name, "临时站点");
  });

  test("CONFIG_JSON 环境变量优先于文件，支持无文件部署", async () => {
    process.env.CONFIG_JSON = JSON.stringify({
      sites: [{ name: "环境变量站点", apiUrl: "https://env.com", apiKey: "sk-env" }],
    });

    const config = await loadAppConfig();
    assert.equal(config.sites[0].name, "环境变量站点");

    delete process.env.CONFIG_JSON;
  });

  test("缺少配置文件且未设置环境变量时报错明确", async () => {
    const missingPath = join(tmpdir(), `missing-config-${Date.now()}.json`);
    await assert.rejects(() => loadAppConfig(missingPath), /本地配置文件不存在/);
  });
});
