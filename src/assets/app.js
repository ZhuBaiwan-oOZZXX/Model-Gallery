(() => {
  "use strict";

  // 与 assets.ts 中 THEME_INIT_SCRIPT 共用的 localStorage 键，修改需两处同步。
  const THEME_KEY = "theme";
  const TOAST_DURATION_MS = 2200;

  const storage = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const safeSet = (key, value) => {
    try {
      storage?.setItem(key, value);
    } catch {
      /* storage 不可用 */
    }
  };

  const root = document.documentElement;
  const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const currentTheme = () => root.getAttribute("data-theme") || (systemDark() ? "dark" : "light");

  const setTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    safeSet(THEME_KEY, theme);
  };

  let siteSelectorOpen = false;
  const toggleSiteSelector = (force) => {
    const button = document.getElementById("siteSelectorBtn");
    const dropdown = document.getElementById("siteSelectorDropdown");
    if (!button || !dropdown) return;
    siteSelectorOpen = force !== undefined ? force : !siteSelectorOpen;
    dropdown.hidden = !siteSelectorOpen;
    button.setAttribute("aria-expanded", String(siteSelectorOpen));
  };

  const copyModel = (model) => {
    const writeText = navigator.clipboard?.writeText;
    if (!writeText) return;
    void writeText
      .call(navigator.clipboard, model)
      .then(() => {
        const toast = document.getElementById("notification");
        if (!toast) return;
        toast.classList.remove("toast-hidden");
        toast.classList.add("toast-visible");
        window.setTimeout(() => {
          toast.classList.remove("toast-visible");
          toast.classList.add("toast-hidden");
        }, TOAST_DURATION_MS);
      })
      .catch(() => undefined);
  };

  const toggleGroup = (header) => {
    const section = header.parentElement;
    const content = section?.querySelector?.('[data-role="group-content"]');
    const icon = section?.querySelector?.('[data-role="group-icon"]');
    if (!content) return;
    const collapsed = content.classList.toggle("collapsed");
    header.setAttribute("aria-expanded", String(!collapsed));
    icon?.classList.toggle("icon-rotated", collapsed);
  };

  document.addEventListener("click", (event) => {
    const target = event.target?.closest?.("[data-action]") || event.target;
    if (target?.dataset) {
      if (target.dataset.action === "toggle-theme") setTheme(currentTheme() === "dark" ? "light" : "dark");
      if (target.dataset.action === "toggle-site-selector") toggleSiteSelector();
      if (target.dataset.action === "copy-model") copyModel(target.dataset.model || "");
      if (target.dataset.action === "toggle-group") toggleGroup(target);
    }
    const selector = document.getElementById("siteSelectorBtn");
    const dropdown = document.getElementById("siteSelectorDropdown");
    if (
      siteSelectorOpen &&
      selector &&
      dropdown &&
      !selector.contains(event.target) &&
      !dropdown.contains(event.target)
    ) {
      toggleSiteSelector(false);
    }
  });
})();
