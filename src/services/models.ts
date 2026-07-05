import type { ModelResponse, SiteConfig } from "../types.ts";
import { GROUP_RULES } from "../config/groupConfig.ts";

export function groupModels(models: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const model of models) {
    const modelLower = model.toLowerCase();
    let groupName = "default";

    for (const rule of GROUP_RULES) {
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

export async function fetchModels(
  site: SiteConfig,
): Promise<{ models: string[] | null; error: string | null }> {
  try {
    const url = `${site.apiUrl.replace(/\/$/, "")}/${site.apiEndpoint.replace(/^\//, "")}`;
    const response = await fetch(url, {
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

    const data: ModelResponse = await response.json();
    if (data?.data && Array.isArray(data.data)) {
      return { models: data.data.map((m) => m.id), error: null };
    }

    return { models: null, error: "API 响应格式不符合预期" };
  } catch (error) {
    return { models: null, error: (error as Error).message };
  }
}
