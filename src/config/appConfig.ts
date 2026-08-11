import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig, CustomGroupRule, GroupPosition, SiteConfig } from "../types.ts";
import { BUILTIN_GROUP_NAMES } from "./groupConfig.ts";
import { isSafeUrl } from "../ui/escape.ts";

const DEFAULT_SITE_CONFIG = {
  apiEndpoint: "/v1/models",
  externalUrl: "https://github.com/ZhuBaiwan-oOZZXX/Model-Gallery",
  iconUrl: "https://docs.newapi.pro/assets/logo.png",
} as const;

const BUILTIN_GROUP_NAME_SET = new Set(BUILTIN_GROUP_NAMES.map((name) => name.toLowerCase()));
const MAX_ENDPOINT_LENGTH = 200;
const MAX_NAME_LENGTH = 120;
const MAX_KEYWORD_LENGTH = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, label: string, required = true): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`配置错误: ${label} 必须是非空字符串`);
  }
  const result = value.trim();
  if (result.length > MAX_NAME_LENGTH && (label.endsWith("name") || label.includes("站点"))) {
    throw new Error(`配置错误: ${label} 超过长度限制`);
  }
  return result;
}

function parseUrl(value: unknown, label: string): string {
  const url = parseString(value, label)!;
  if (!isSafeUrl(url)) {
    throw new Error(`配置错误: ${label} 必须是 http:// 或 https:// 协议`);
  }
  return url;
}

function parseEndpoint(value: unknown, label: string): string {
  const endpoint = (parseString(value, label, false) || DEFAULT_SITE_CONFIG.apiEndpoint).trim();
  if (endpoint.length > MAX_ENDPOINT_LENGTH || !endpoint.startsWith("/") || endpoint.startsWith("//")) {
    throw new Error(`配置错误: ${label} 必须是有效的相对路径`);
  }
  try {
    const parsed = new URL(endpoint, "https://model-gallery.invalid");
    if (parsed.origin !== "https://model-gallery.invalid" || parsed.search || parsed.hash) {
      throw new Error();
    }
  } catch {
    throw new Error(`配置错误: ${label} 必须是有效的相对路径`);
  }
  return endpoint.replace(/\/+/g, "/");
}

function parseSite(raw: unknown, index: number): SiteConfig {
  if (!isRecord(raw)) throw new Error(`配置错误: sites[${index}] 必须是对象`);
  ensureKnownKeys(raw, ["name", "apiUrl", "apiKey", "apiEndpoint", "externalUrl", "iconUrl"], `sites[${index}]`);
  const name = parseString(raw.name, `sites[${index}].name`)!;
  const label = `站点 "${name}"`;
  return {
    name,
    apiUrl: parseUrl(raw.apiUrl, `${label} apiUrl`),
    apiKey: parseString(raw.apiKey, `${label} apiKey`)!,
    apiEndpoint: parseEndpoint(raw.apiEndpoint, `${label} apiEndpoint`),
    externalUrl:
      raw.externalUrl === undefined
        ? DEFAULT_SITE_CONFIG.externalUrl
        : parseUrl(raw.externalUrl, `${label} externalUrl`),
    iconUrl: raw.iconUrl === undefined ? DEFAULT_SITE_CONFIG.iconUrl : parseUrl(raw.iconUrl, `${label} iconUrl`),
  };
}

function ensureKnownKeys(raw: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedKeys = new Set(allowed);
  const unknownKey = Object.keys(raw).find((key) => !allowedKeys.has(key));
  if (unknownKey) throw new Error(`配置错误: ${label} 包含未知字段 "${unknownKey}"`);
}

function parsePosition(raw: unknown, label: string): GroupPosition | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    throw new Error(`配置错误: ${label}.position 必须是对象`);
  }
  ensureKnownKeys(raw, ["type", "target"], `${label}.position`);
  if (!["first", "last", "before"].includes(raw.type as string)) {
    throw new Error(`配置错误: ${label}.position.type 必须是 "first"、"last" 或 "before"`);
  }
  if (raw.type === "before") {
    const target = parseString(raw.target, `${label}.position.target`)!;
    return { type: "before", target };
  }
  if (raw.target !== undefined) {
    throw new Error(`配置错误: ${label}.position.target 仅可用于 before`);
  }
  return { type: raw.type as GroupPosition["type"] };
}

function parseCustomGroupRule(raw: unknown, index: number): CustomGroupRule {
  if (!isRecord(raw)) throw new Error(`配置错误: customGroupRules[${index}] 必须是对象`);
  const label = `customGroupRules[${index}]`;
  ensureKnownKeys(raw, ["name", "icon", "keywords", "position"], label);
  const name = parseString(raw.name, `${label}.name`)!;
  if (
    !Array.isArray(raw.keywords) ||
    raw.keywords.length === 0 ||
    raw.keywords.some(
      (keyword) => typeof keyword !== "string" || keyword.trim() === "" || keyword.length > MAX_KEYWORD_LENGTH,
    )
  ) {
    throw new Error(`配置错误: ${label} ("${name}") keywords 必须是非空字符串数组`);
  }
  return {
    name,
    keywords: raw.keywords.map((keyword) => keyword.trim()),
    ...(raw.icon === undefined ? {} : { icon: parseUrl(raw.icon, `${label} ("${name}") icon`) }),
    ...(raw.position === undefined ? {} : { position: parsePosition(raw.position, label) }),
  };
}

function parseConfig(raw: unknown): AppConfig {
  if (!isRecord(raw)) throw new Error("配置错误: 根配置必须是 JSON 对象");
  if (!Array.isArray(raw.sites) || raw.sites.length === 0)
    throw new Error("配置错误: sites 为空，请检查 CONFIG_JSON 环境变量");

  const sites = raw.sites.map(parseSite);
  const siteNames = new Set<string>();
  for (const site of sites) {
    const key = site.name.toLowerCase();
    if (siteNames.has(key)) throw new Error(`配置错误: 站点名称 "${site.name}" 重复`);
    siteNames.add(key);
  }

  const defaultSite = raw.defaultSite === undefined ? sites[0].name : parseString(raw.defaultSite, "defaultSite")!;
  const defaultSiteConfig = sites.find((site) => site.name.toLowerCase() === defaultSite.toLowerCase());
  if (!defaultSiteConfig) throw new Error(`配置错误: defaultSite "${defaultSite}" 不在 sites 列表中`);

  const customGroupRules =
    raw.customGroupRules === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(raw.customGroupRules)) throw new Error("配置错误: customGroupRules 必须是数组");
          return raw.customGroupRules.map((rule, index) => parseCustomGroupRule(rule, index));
        })();

  const availableGroupNames = new Set([
    ...BUILTIN_GROUP_NAME_SET,
    ...(customGroupRules ?? []).map((rule) => rule.name.toLowerCase()),
  ]);
  for (const rule of customGroupRules ?? []) {
    if (rule.position?.type === "before" && !availableGroupNames.has(rule.position.target!.toLowerCase())) {
      throw new Error(
        `配置错误: customGroupRules ("${rule.name}") position.target "${rule.position.target}" 不是有效的分组名称`,
      );
    }
  }

  return { sites, defaultSite: defaultSiteConfig.name, customGroupRules };
}

async function readConfig(configPath: string): Promise<unknown> {
  const raw = process.env.CONFIG_JSON;
  if (raw !== undefined) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("CONFIG_JSON 环境变量解析失败，请检查 JSON 格式");
    }
  }
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(`未设置 CONFIG_JSON 环境变量，且本地配置文件不存在: ${configPath}`);
    if (error instanceof SyntaxError) throw new Error("读取配置文件失败: JSON 格式无效");
    throw new Error(`读取配置文件失败: ${(error as Error).message}`);
  }
}

export async function loadAppConfig(configPath = path.join(process.cwd(), "config.json")): Promise<AppConfig> {
  return parseConfig(await readConfig(configPath));
}
