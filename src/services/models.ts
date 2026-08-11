import type { ModelResponse, SiteConfig } from "../types.ts";

export const MODEL_FETCH_TIMEOUT_MS = 5_000;
export const MAX_MODELS = 500;
export const MAX_MODEL_ID_LENGTH = 200;
export const MAX_RESPONSE_BYTES = 1_000_000;

export async function fetchModels(
  site: SiteConfig,
  timeoutMs = MODEL_FETCH_TIMEOUT_MS,
): Promise<{ models: string[] | null; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(site.apiEndpoint, site.apiUrl.endsWith("/") ? site.apiUrl : `${site.apiUrl}/`).toString();

  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${site.apiKey}`, "Content-Type": "application/json" },
    });

    if (!response.ok) return { models: null, error: `获取模型失败: ${response.status} ${response.statusText}` };

    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) return { models: null, error: "模型接口响应过大" };

    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES)
      return { models: null, error: "模型接口响应过大" };

    let data: ModelResponse;
    try {
      data = JSON.parse(text) as ModelResponse;
    } catch {
      return { models: null, error: "API 响应不是有效 JSON" };
    }
    if (!Array.isArray(data.data)) return { models: null, error: "API 响应格式不符合预期" };
    if (data.data.length > MAX_MODELS) return { models: null, error: "模型数量超过限制" };

    const models = data.data
      .map((model) =>
        typeof model === "object" && model !== null && typeof (model as { id?: unknown }).id === "string"
          ? (model as { id: string }).id.trim()
          : "",
      )
      .filter((id) => id.length > 0 && id.length <= MAX_MODEL_ID_LENGTH);
    return { models, error: null };
  } catch (error) {
    if ((error as Error).name === "AbortError" || (error as Error).name === "TimeoutError")
      return { models: null, error: "获取模型超时，请稍后重试" };
    if ((error as Error).message === "redirected") return { models: null, error: "模型接口禁止重定向" };
    return { models: null, error: "模型接口请求失败，请稍后重试" };
  } finally {
    clearTimeout(timeout);
  }
}
