/* =========================================================
   USIAMS - js/app.js
   Application bootstrap shared by every authenticated page:
   theme application, sidebar/navbar mounting, shell restore.

   Typical page usage (see any file in /pages for the pattern):
     const user = USIAMS.auth.requireAuth(["STUDENT"]);
     if (user) USIAMS.app.mountShell(user);
   ========================================================= */
(function (global) {
  "use strict";

  // The theme is saved to the user's preferences in the database; the
  // localStorage copy only lets the next page paint in the right colours
  // before the server has answered.
  function applyTheme(theme, { save = true } = {}) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("usiams.theme", theme);
    const icon = document.querySelector("#themeToggleBtn i");
    if (icon) icon.className = `bi ${theme === "dark" ? "bi-sun" : "bi-moon-stars"}`;
    document.dispatchEvent(new CustomEvent("usiams:themechange", { detail: { theme } }));
    const api = global.USIAMS.api;
    if (save && api && api.isHydrated() && api.getPreference("theme") !== theme) {
      api.savePreference("theme", theme).catch(() => {});
    }
  }

  function initTheme() {
    const saved = localStorage.getItem("usiams.theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
  }

  // Applied immediately (before DOMContentLoaded) to avoid a light-mode flash.
  initTheme();

  // Injected once per page (rather than hand-added to every page in
  // /pages) so every authenticated screen gets an identical footer without
  // 29 near-duplicate HTML edits going out of sync over time.
  function mountFooter() {
    const main = document.querySelector(".app-main");
    if (!main || main.querySelector(".app-footer")) return;
    const year = new Date().getFullYear();
    const footer = document.createElement("footer");
    footer.className = "app-footer no-print";
    footer.innerHTML = `
      <span>&copy; ${year} USIAMS - University Student Information and Academic Management System. All rights reserved.</span>
      <span class="app-footer-meta"><span class="system-status-dot"></span>All systems operational &bull; Version 1.0</span>
    `;
    main.appendChild(footer);
  }

  function mountShell(user) {
    const basePath = global.USIAMS.auth.getBasePath();
    const shell = document.getElementById("appShell");
    if (!document.querySelector(".sidebar-backdrop") && shell) {
      const backdrop = document.createElement("div");
      backdrop.className = "sidebar-backdrop";
      shell.appendChild(backdrop);
    }
    // Use the theme saved to this account, whichever device it was set on.
    const api = global.USIAMS.api;
    const savedTheme = api && api.isHydrated() ? api.getPreference("theme") : null;
    if (savedTheme && savedTheme !== document.documentElement.getAttribute("data-theme")) {
      applyTheme(savedTheme, { save: false });
    }

    global.USIAMS.sidebarComponent.renderSidebar("sidebarContainer", user, basePath);
    global.USIAMS.navbarComponent.renderNavbar("navbarContainer", user, basePath);
    mountFooter();

    if (shell && localStorage.getItem("usiams.sidebarCollapsed") === "1") {
      shell.classList.add("sidebar-collapsed");
    }

    // In-app help: the ? button's page guides and the first-sign-in tour.
    // Loaded here so every signed-in page gets it without its own tag.
    if (global.USIAMS.help) {
      global.USIAMS.help.init(user);
    } else {
      const script = document.createElement("script");
      script.src = basePath + "js/help.js";
      script.onload = () => global.USIAMS.help && global.USIAMS.help.init(user);
      document.body.appendChild(script);
    }

    // Read-only banner for QA officers on pages that would otherwise show
    // modification actions. Individual page scripts also hide/disable
    // Add/Edit/Delete/Approve buttons - see js/qa.js enforceReadOnly().
    if (global.USIAMS.auth.isReadOnlyRole(user.role)) {
      global.USIAMS.qa && global.USIAMS.qa.injectReadOnlyBadge();
    }
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.applyTheme = applyTheme;
  global.USIAMS.app = { mountShell };

})(window);
