import type { AppConfig, GroupRule, SiteConfig } from "../types.ts";
import { escapeAttribute, escapeHtml, sanitizeUrl } from "./escape.ts";

export function renderThemeToggle(): string {
  return `
    <button id="themeToggleBtn" data-action="toggle-theme"
      class="theme-toggle fixed bottom-24 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-[var(--bg-card-solid)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-medium)] hover:border-[var(--border-strong)] shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-md)] transition-all duration-200 active:scale-95 text-[var(--text-primary)]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>`;
}

export function renderSiteSelector(appConfig: AppConfig, currentSiteName: string): string {
  if (appConfig.sites.length <= 1) return "";
  const currentKey = currentSiteName.toLowerCase();
  const otherSites = appConfig.sites.filter((site) => site.name.toLowerCase() !== currentKey);
  return `
    <div class="fixed top-4 left-4 z-50">
      <button id="siteSelectorBtn" data-action="toggle-site-selector"
        class="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--bg-card-solid)]/90 hover:bg-[var(--bg-card-solid)] border border-[var(--border-medium)] hover:border-[var(--border-strong)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all duration-200">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="text-[var(--text-primary)]">
          <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div id="siteSelectorDropdown"
        class="absolute top-full left-0 mt-2 w-48 bg-[var(--bg-card-solid)]/95 backdrop-blur-xl rounded-xl border border-[var(--border-medium)] shadow-[var(--shadow-xl)] opacity-0 invisible transition-all duration-200">
        ${otherSites
          .map(
            (site) => `<a href="${escapeAttribute(`/?site=${encodeURIComponent(site.name)}`)}"
            class="block w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] first:rounded-t-xl last:rounded-b-xl transition-colors">
            ${escapeHtml(site.name)}
          </a>`,
          )
          .join("")}
      </div>
    </div>`;
}

export function renderRefreshButton(currentSiteName: string): string {
  const href = currentSiteName ? `/?site=${encodeURIComponent(currentSiteName)}` : "/";
  return `<a href="${escapeAttribute(href)}" class="fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-[var(--text-primary)] hover:opacity-90 text-[var(--bg-gradient-start)] shadow-[var(--shadow-xl)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-all duration-200 active:scale-95">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/>
      </svg>
    </a>`;
}

export function renderHeader(site: SiteConfig, groupCount: number, modelCount: number): string {
  const safeExternalUrl = sanitizeUrl(site.externalUrl);
  const safeIconUrl = sanitizeUrl(site.iconUrl, "");
  return `<header class="animate-in flex items-center justify-between mb-10 rounded-[20px] px-6 py-4 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-white)] shadow-[var(--shadow-lg)]">
      <div class="flex items-center space-x-5">
        <a href="${escapeAttribute(safeExternalUrl)}" target="_blank" rel="noopener noreferrer" class="group">
          <div class="logo-container w-16 h-16 rounded-[18px] bg-[var(--bg-card-solid)] p-1 shadow-[var(--logo-shadow)] overflow-hidden relative">
            ${safeIconUrl ? `<img src="${escapeAttribute(safeIconUrl)}" alt="站点图标" loading="lazy" class="w-full h-full rounded-[14px] object-cover">` : ""}
          </div>
        </a>
        <h1 class="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">${escapeHtml(site.name)}</h1>
      </div>
      <div class="flex items-center space-x-4 mr-6"><div class="text-center"><div class="text-[17px] font-semibold text-[var(--text-primary)] tracking-tight">${groupCount}</div><div class="text-xs text-[var(--text-secondary)] mt-0.5">渠道</div></div><div class="w-px h-10 bg-[var(--divider)]"></div><div class="text-center"><div class="text-[17px] font-semibold text-[var(--text-primary)] tracking-tight">${modelCount}</div><div class="text-xs text-[var(--text-secondary)] mt-0.5">模型</div></div></div>
    </header>`;
}

export function renderNotification(): string {
  return `<div id="notification" class="notification notification-hidden fixed top-6 right-6 px-5 py-3.5 z-50 text-[var(--bg-gradient-start)] text-sm font-medium rounded-[14px] shadow-[var(--shadow-xl)] transition-all duration-400 ease-out"><div class="flex items-center space-x-2.5"><span>已复制到剪贴板</span></div></div>`;
}

function renderModelCard(model: string, group: GroupRule): string {
  const icon = sanitizeUrl(group.icon, "");
  return `<div class="group relative bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-light)] hover:border-[var(--border-medium)] rounded-2xl p-4 cursor-pointer shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-px active:scale-[0.98] transition-all duration-200" data-action="copy-model" data-model="${escapeAttribute(model)}">
      <div class="flex items-center space-x-3"><img src="${escapeAttribute(icon)}" alt="${escapeAttribute(group.name)}" loading="lazy" class="w-9 h-9 rounded-[10px] object-cover flex-shrink-0"><div class="flex-1 min-w-0 text-[13px] font-medium text-[var(--text-primary)] leading-snug break-all tracking-tight">${escapeHtml(model)}</div></div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="absolute top-3 right-3 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity duration-200"><path d="M4.5 2H11V8.5M11 2L3 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>`;
}

export function renderGroupSection(group: GroupRule, models: string[], index = 0): string {
  const displayName = group.name.toLowerCase() === "default" ? "其他" : group.name;
  const delayClass = index < 5 ? `delay-${index + 1}` : "";
  const icon = sanitizeUrl(group.icon, "");
  return `<section class="animate-in ${escapeAttribute(delayClass)} mb-6 rounded-[20px] bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-white)] shadow-[var(--shadow-lg)] transition-shadow duration-400">
      <div class="flex items-center justify-between p-5 cursor-pointer select-none rounded-t-[20px] hover:bg-[var(--hover-bg)] transition-colors" data-action="toggle-group" data-group="${escapeAttribute(group.name)}">
        <div class="flex items-center space-x-4"><div class="w-11 h-11 rounded-[14px] bg-[var(--bg-input)] flex items-center justify-center overflow-hidden"><img src="${escapeAttribute(icon)}" alt="${escapeAttribute(displayName)}" loading="lazy" class="w-7 h-7 object-cover"></div><div><h3 class="text-[17px] font-semibold text-[var(--text-primary)] tracking-tight">${escapeHtml(displayName)}</h3><p class="text-[13px] text-[var(--text-secondary)] mt-0.5">${models.length} 个模型</p></div></div>
        <div class="w-8 h-8 rounded-full bg-[var(--bg-input)] flex items-center justify-center transition-all duration-300 hover:bg-[var(--bg-input-hover)]"><svg data-role="group-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" class="text-[var(--text-secondary)] transition-transform duration-300"><path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div><div data-role="group-content" class="overflow-hidden transition-all duration-400 ease-out max-h-[2000px] opacity-100"><div class="px-5 pb-5"><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">${models.map((model) => renderModelCard(model, group)).join("")}</div></div></div>
    </section>`;
}

export function renderError(error: string): string {
  return `<div class="animate-in delay-2 rounded-[20px] p-10 text-center max-w-[480px] mx-auto mb-12 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-white)] shadow-[var(--shadow-lg)] border-red-500/15"><h3 class="text-[19px] font-semibold text-[var(--text-primary)] mb-2 tracking-tight">获取模型失败</h3><p class="text-[15px] text-[var(--text-secondary)]">${escapeHtml(error)}</p></div>`;
}

export function renderEmpty(): string {
  return `<div class="animate-in delay-2 rounded-[20px] p-16 text-center max-w-[480px] mx-auto bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-white)] shadow-[var(--shadow-lg)]"><h3 class="text-[19px] font-semibold text-[var(--text-primary)] mb-2 tracking-tight">暂无模型可用</h3><p class="text-[15px] text-[var(--text-secondary)]">请检查 API 配置或稍后重试</p></div>`;
}
