import type { AppConfig, GroupRule, SiteConfig } from "../types.ts";
import { getGroupDisplayName } from "../config/groupConfig.ts";
import { escapeAttribute, escapeHtml, sanitizeUrl } from "./escape.ts";
import { ICON_CHEVRON, ICON_COPY, ICON_MENU, ICON_MOON, ICON_REFRESH, ICON_SUN } from "./icons.ts";
import { UI_TEXT } from "./messages.ts";

/** 参与错落入场动画的分组数量上限，与 app.css 的 .delay-1..5 对应。 */
const ANIMATED_GROUP_LIMIT = 5;

export function renderThemeToggle(): string {
  return `
    <button id="themeToggleBtn" type="button" data-action="toggle-theme"
      class="icon-btn theme-toggle" aria-label="${UI_TEXT.themeToggleLabel}" title="${UI_TEXT.themeToggleLabel}">
      <span class="icon-sun">${ICON_SUN}</span>
      <span class="icon-moon">${ICON_MOON}</span>
    </button>`;
}

export function renderSiteSelector(appConfig: AppConfig, currentSiteName: string): string {
  if (appConfig.sites.length <= 1) return "";
  const currentKey = currentSiteName.toLowerCase();
  const otherSites = appConfig.sites.filter((site) => site.name.toLowerCase() !== currentKey);
  return `
    <div class="site-selector">
      <button id="siteSelectorBtn" type="button" data-action="toggle-site-selector"
        class="site-selector-btn" aria-label="${UI_TEXT.siteSelectorLabel}" aria-haspopup="listbox"
        aria-controls="siteSelectorDropdown" aria-expanded="false">
        ${ICON_MENU}
      </button>
      <div id="siteSelectorDropdown" class="site-selector-dropdown" hidden>
        ${otherSites
          .map(
            (site) => `
          <a class="site-selector-link" href="${escapeAttribute(`/?site=${encodeURIComponent(site.name)}`)}">
            ${escapeHtml(site.name)}
          </a>`,
          )
          .join("")}
      </div>
    </div>`;
}

export function renderRefreshButton(currentSiteName: string): string {
  const href = currentSiteName ? `/?site=${encodeURIComponent(currentSiteName)}` : "/";
  return `<a href="${escapeAttribute(href)}" class="icon-btn refresh-btn" aria-label="${UI_TEXT.refreshLabel}" title="${UI_TEXT.refreshLabel}">${ICON_REFRESH}</a>`;
}

export function renderHeader(site: SiteConfig, groupCount: number, modelCount: number): string {
  const safeExternalUrl = sanitizeUrl(site.externalUrl);
  const safeIconUrl = sanitizeUrl(site.iconUrl, "");
  return `
    <header class="page-header animate-in">
      <div class="page-header-left">
        <a href="${escapeAttribute(safeExternalUrl)}" target="_blank" rel="noopener noreferrer"
          class="logo-link" aria-label="${escapeAttribute(UI_TEXT.siteHomepage(site.name))}">
          <span class="logo">
            ${safeIconUrl ? `<img src="${escapeAttribute(safeIconUrl)}" alt="${escapeAttribute(UI_TEXT.siteIcon(site.name))}" loading="lazy" class="logo-img">` : ""}
          </span>
        </a>
        <h1 class="site-name">${escapeHtml(site.name)}</h1>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-value">${groupCount}</span>
          <span class="stat-label">${UI_TEXT.groupCountLabel}</span>
        </div>
        <span class="stat-divider" aria-hidden="true"></span>
        <div class="stat">
          <span class="stat-value">${modelCount}</span>
          <span class="stat-label">${UI_TEXT.modelCountLabel}</span>
        </div>
      </div>
    </header>`;
}

export function renderNotification(): string {
  return `<div id="notification" class="toast toast-hidden" role="status" aria-live="polite">${UI_TEXT.copiedToClipboard}</div>`;
}

function renderModelCard(model: string, group: GroupRule): string {
  const icon = sanitizeUrl(group.icon, "");
  return `
    <button type="button" class="model-card" data-action="copy-model" data-model="${escapeAttribute(model)}"
      aria-label="${escapeAttribute(UI_TEXT.copyModel(model))}">
      ${icon ? `<span class="model-card-icon"><img src="${escapeAttribute(icon)}" alt="${escapeAttribute(group.name)}" loading="lazy"></span>` : ""}
      <span class="model-name">${escapeHtml(model)}</span>
      <span class="copy-icon" aria-hidden="true">${ICON_COPY}</span>
    </button>`;
}

export function renderGroupSection(group: GroupRule, models: string[], rules: readonly GroupRule[], index = 0): string {
  const displayName = getGroupDisplayName(group.name, rules);
  const icon = sanitizeUrl(group.icon, "");
  const delayClass = index < ANIMATED_GROUP_LIMIT ? `delay-${index + 1}` : "";
  return `
    <section class="group animate-in ${delayClass}">
      <button type="button" class="group-header" data-action="toggle-group" aria-expanded="true">
        <span class="group-header-left">
          <span class="group-icon-box">
            ${icon ? `<img src="${escapeAttribute(icon)}" alt="" loading="lazy">` : ""}
          </span>
          <span>
            <span class="group-title">${escapeHtml(displayName)}</span>
            <span class="group-subtitle">${UI_TEXT.modelCount(models.length)}</span>
          </span>
        </span>
        <span class="group-chevron">${ICON_CHEVRON}</span>
      </button>
      <div data-role="group-content" class="group-content">
        <div class="group-inner">
          <div class="model-grid">
            ${models.map((model) => renderModelCard(model, group)).join("")}
          </div>
        </div>
      </div>
    </section>`;
}

export function renderError(error: string): string {
  return `
    <div class="state-card error-card animate-in delay-2" role="alert">
      <h3 class="state-title">${UI_TEXT.fetchFailedTitle}</h3>
      <p class="state-text">${escapeHtml(error)}</p>
    </div>`;
}

export function renderEmpty(): string {
  return `
    <div class="state-card empty-card animate-in delay-2">
      <h3 class="state-title">${UI_TEXT.emptyTitle}</h3>
      <p class="state-text">${UI_TEXT.emptyHint}</p>
    </div>`;
}
