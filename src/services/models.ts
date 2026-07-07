import type { GroupRule, ModelResponse, SiteConfig } from "../types.ts";

export const MODEL_FETCH_TIMEOUT_MS = 5_000;

export function groupModels(models: string[], rules: GroupRule[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const model of models) {
    const modelLower = model.toLowerCase();
    let groupName = "default";

    for (const rule of rules) {
      if (rule.name === "default") continue;

      if (rule.keywords?.some((kw) => modelLower.includes(kw.toLowerCase()))) {
        groupName = rule.name;
        break;
      }
    }

    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(model);
  }

  return groups;
}

export async function fetchModels(site: SiteConfig, timeoutMs = MODEL_FETCH_TIMEOUT_MS): Promise<{ models: string[] | null; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${site.apiUrl.replace(/\/$/, "")}/${site.apiEndpoint.replace(/^\//, "")}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${site.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        models: null,
        error: `获取模型失败: ${response.status} ${response.statusText}`,
      };
    }

    let data: ModelResponse;
    try {
      data = (await response.json()) as ModelResponse;
    } catch {
      return { models: null, error: "API 响应不是有效 JSON" };
    }

    if (data && Array.isArray(data.data)) {
      const models = data.data.map((model) => (typeof model?.id === "string" ? model.id.trim() : "")).filter((id) => id.length > 0);
      return { models, error: null };
    }

    return { models: null, error: "API 响应格式不符合预期" };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return { models: null, error: "获取模型超时，请稍后重试" };
    }
    return { models: null, error: "模型接口请求失败，请稍后重试" };
  } finally {
    clearTimeout(timeout);
  }
}
