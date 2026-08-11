export const JS_SCRIPTS = `
  (() => {
    const storage = (() => {
      try { return window.localStorage; } catch { return null; }
    })();
    const safeStorageGet = (key) => { try { return storage?.getItem(key); } catch { return null; } };
    const safeStorageSet = (key, value) => { try { storage?.setItem(key, value); } catch { /* storage unavailable */ } };
    const safeStorageRemove = (key) => { try { storage?.removeItem(key); } catch { /* storage unavailable */ } };
    const root = document.documentElement;
    const savedTheme = safeStorageGet('theme');
    if (savedTheme) root.setAttribute('data-theme', savedTheme);

    const systemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = () => root.getAttribute('data-theme') || systemTheme();
    const updateThemeIcon = () => {
      const button = document.getElementById('themeToggleBtn');
      if (!button) return;
      button.innerHTML = currentTheme() === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    };
    const setTheme = (theme) => {
      if (theme === 'system') {
        root.removeAttribute('data-theme');
        safeStorageRemove('theme');
      } else {
        root.setAttribute('data-theme', theme);
        safeStorageSet('theme', theme);
      }
      updateThemeIcon();
    };

    let siteSelectorOpen = false;
    const toggleSiteSelector = () => {
      const dropdown = document.getElementById('siteSelectorDropdown');
      if (!dropdown) return;
      siteSelectorOpen = !siteSelectorOpen;
      dropdown.classList.toggle('opacity-0', !siteSelectorOpen);
      dropdown.classList.toggle('invisible', !siteSelectorOpen);
      dropdown.classList.toggle('opacity-100', siteSelectorOpen);
      dropdown.classList.toggle('visible', siteSelectorOpen);
    };
    const copyModel = (model) => {
      const writeText = navigator.clipboard?.writeText;
      if (!writeText) return;
      void writeText.call(navigator.clipboard, model).then(() => {
        const notification = document.getElementById('notification');
        if (!notification) return;
        notification.classList.remove('notification-hidden');
        notification.classList.add('notification-visible');
        window.setTimeout(() => {
          notification.classList.remove('notification-visible');
          notification.classList.add('notification-hidden');
        }, 2200);
      }).catch(() => undefined);
    };

    document.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-action]') || event.target;
      if (target?.dataset.action === 'toggle-theme') setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      if (target?.dataset.action === 'toggle-site-selector') toggleSiteSelector();
      if (target?.dataset.action === 'copy-model') copyModel(target.dataset.model || '');
      if (target?.dataset.action === 'toggle-group') {
        const content = target.parentElement?.querySelector?.('[data-role="group-content"]');
        const icon = target.parentElement?.querySelector?.('[data-role="group-icon"]');
        content?.classList.toggle('collapsed');
        icon?.classList.toggle('icon-rotated');
      }
      const selector = document.getElementById('siteSelectorBtn');
      const dropdown = document.getElementById('siteSelectorDropdown');
      if (siteSelectorOpen && selector && dropdown && !selector.contains(event.target) && !dropdown.contains(event.target)) toggleSiteSelector();
    });
    updateThemeIcon();
  })();
`;
