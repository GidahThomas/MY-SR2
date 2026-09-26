/* =========================================================
   USIAMS - components/navbar.js
   Top navigation bar: page title/breadcrumb, global search,
   notifications/messages icons, theme toggle, user menu.
   ========================================================= */
(function (global) {
  "use strict";

  function renderNavbar(containerId, user, basePath) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const { escapeHtml, initials } = global.USIAMS.util;
    const title = global.USIAMS.navigation.pageTitle();
    const unread = global.USIAMS.notifications ? global.USIAMS.notifications.unreadCountFor(user.id) : 0;
    const theme = localStorage.getItem("usiams.theme") || "light";

    container.innerHTML = `
      <button type="button" class="hamburger-btn" id="hamburgerBtn" aria-label="Toggle navigation menu"><i class="bi bi-list"></i></button>
      <button type="button" class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar"><i class="bi bi-layout-sidebar-inset"></i></button>
      <div class="navbar-title-block">
        <h1>${escapeHtml(title)}</h1>
        <div class="navbar-breadcrumb">
          <a href="${basePath}${global.USIAMS.navigation.menuForRole(user.role).find(i=>i.href)?.href || "pages/students.html"}">USIAMS</a>
          <span class="sep">/</span><span>${escapeHtml(title)}</span>
        </div>
      </div>
      <div class="navbar-search">
        <i class="bi bi-search"></i>
        <input type="search" id="globalSearchInput" placeholder="Search students, courses, requests..." aria-label="Global search" aria-autocomplete="list" aria-controls="globalSearchResults" aria-expanded="false">
        <div class="navbar-search-results" id="globalSearchResults" role="listbox"></div>
      </div>
      <div class="navbar-actions">
        <button type="button" class="navbar-icon-btn mobile-search-btn" id="mobileSearchBtn" title="Search" aria-label="Search"><i class="bi bi-search"></i></button>
        <button type="button" class="navbar-icon-btn" id="helpBtn" title="Help: how to use this page" aria-label="Help for this page"><i class="bi bi-question-circle"></i></button>
        <button type="button" class="navbar-icon-btn" id="themeToggleBtn" title="Toggle theme" aria-label="Toggle dark mode">
          <i class="bi ${theme === "dark" ? "bi-sun" : "bi-moon-stars"}"></i>
        </button>
        <a class="navbar-icon-btn" href="${basePath}pages/requests.html" title="Messages / Requests" aria-label="Messages">
          <i class="bi bi-chat-dots"></i>
        </a>
        <a class="navbar-icon-btn" href="${basePath}pages/notifications.html" title="Notifications" aria-label="Notifications">
          <i class="bi bi-bell"></i>
          ${unread > 0 ? `<span class="count-badge">${unread > 9 ? "9+" : unread}</span>` : ""}
        </a>
        <div class="divider-v"></div>
        <div class="navbar-user dropdown">
          <button type="button" data-bs-toggle="dropdown" aria-expanded="false" class="navbar-user-toggle d-flex align-items-center gap-2" aria-label="Open user menu">
            <div class="avatar-circle" style="background:${global.USIAMS.util.avatarColorFromString(user.name)}">${initials(user.name)}</div>
            <div class="user-meta">
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(user.roleLabel)}</span>
            </div>
            <i class="bi bi-chevron-down text-muted-usi" style="font-size:.7rem;"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><a class="dropdown-item" href="${basePath}pages/settings.html"><i class="bi bi-person me-2"></i>My Profile</a></li>
            <li><a class="dropdown-item" href="${basePath}pages/settings.html"><i class="bi bi-sliders me-2"></i>Settings</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item text-danger" id="navbarLogoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Sign Out</button></li>
          </ul>
        </div>
      </div>
    `;

    wireEvents(basePath, user);
  }

  function wireEvents(basePath, user) {
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const collapseBtn = document.getElementById("sidebarCollapseBtn");
    const shell = document.querySelector(".app-shell");

    if (hamburgerBtn) hamburgerBtn.addEventListener("click", () => shell.classList.toggle("sidebar-mobile-open"));
    if (collapseBtn) collapseBtn.addEventListener("click", () => {
      shell.classList.toggle("sidebar-collapsed");
      localStorage.setItem("usiams.sidebarCollapsed", shell.classList.contains("sidebar-collapsed") ? "1" : "0");
    });

    const backdrop = document.querySelector(".sidebar-backdrop");
    if (backdrop) backdrop.addEventListener("click", () => shell.classList.remove("sidebar-mobile-open"));

    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) themeBtn.addEventListener("click", () => global.USIAMS.applyTheme(
      (localStorage.getItem("usiams.theme") || "light") === "light" ? "dark" : "light"
    ));

    const logoutBtn = document.getElementById("navbarLogoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", () => {
      global.USIAMS.modal.confirm({
        title: "Sign out of USIAMS",
        message: "Are you sure you want to end your session and sign out?",
        confirmText: "Sign Out",
        variant: "primary",
        onConfirm: () => global.USIAMS.auth.logout()
      });
    });

    const searchInput = document.getElementById("globalSearchInput");
    const searchResults = document.getElementById("globalSearchResults");
    if (searchInput) wireSearch(searchInput, searchResults, basePath, user, ".navbar-search");

    const mobileSearchBtn = document.getElementById("mobileSearchBtn");
    if (mobileSearchBtn) mobileSearchBtn.addEventListener("click", () => openMobileSearch(basePath, user));
  }

  function wireSearch(input, results, basePath, user, closeBoundary) {
    let activeIndex = -1;
    const closeResults = () => {
      results.classList.remove("show");
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    };
    const updateActiveResult = (nextIndex) => {
      const items = [...results.querySelectorAll(".search-result-item")];
      if (!items.length) return;
      activeIndex = (nextIndex + items.length) % items.length;
      items.forEach((item, index) => item.classList.toggle("is-active", index === activeIndex));
      items[activeIndex].scrollIntoView({ block: "nearest" });
    };

    input.addEventListener("input", global.USIAMS.util.debounce(() => {
      const term = input.value.trim();
      if (term.length < 2) { results.innerHTML = ""; closeResults(); return; }
      renderSearchResults(term, results, basePath, user);
      input.setAttribute("aria-expanded", "true");
      activeIndex = -1;
    }, 200));
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); updateActiveResult(activeIndex + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); updateActiveResult(activeIndex - 1); }
      else if (event.key === "Enter" && activeIndex >= 0) {
        const item = results.querySelectorAll(".search-result-item")[activeIndex];
        if (item) { event.preventDefault(); item.click(); }
      } else if (event.key === "Escape") { closeResults(); input.focus(); }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(closeBoundary)) closeResults();
    });
  }

  function openMobileSearch(basePath, user) {
    if (!global.USIAMS.modal) return;
    const { modalEl } = global.USIAMS.modal.renderInto(`
      <div class="modal fade" tabindex="-1" aria-labelledby="mobileSearchTitle">
        <div class="modal-dialog modal-dialog-scrollable modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title" id="mobileSearchTitle">Search USIAMS</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
            <div class="modal-body pt-2"><div class="mobile-search-wrap"><i class="bi bi-search"></i><input type="search" id="mobileGlobalSearchInput" class="form-control" placeholder="Search students, courses, requests..." aria-label="Search USIAMS" aria-autocomplete="list" aria-controls="mobileGlobalSearchResults" aria-expanded="false"><div class="navbar-search-results mobile-search-results" id="mobileGlobalSearchResults" role="listbox"></div></div></div>
          </div>
        </div>
      </div>`);
    const input = modalEl.querySelector("#mobileGlobalSearchInput");
    wireSearch(input, modalEl.querySelector("#mobileGlobalSearchResults"), basePath, user, ".modal-content");
    modalEl.addEventListener("shown.bs.modal", () => input.focus());
  }

  function renderSearchResults(term, container, basePath, user) {
    const results = global.USIAMS.search.query(term, user);
    const { escapeHtml } = global.USIAMS.util;
    if (!results.length) {
      container.innerHTML = `<div class="search-empty">No matches found for "${escapeHtml(term)}"</div>`;
      container.classList.add("show");
      return;
    }
    container.innerHTML = results.map(group => `
      <div class="search-group-label">${escapeHtml(group.label)}</div>
      ${group.items.map(item => `
        <a class="search-result-item" role="option" href="${basePath}${item.href}">
          <i class="bi ${item.icon}"></i>
          <div>
            <div>${escapeHtml(item.title)}</div>
            <div class="text-soft-usi" style="font-size:.72rem;">${escapeHtml(item.subtitle || "")}</div>
          </div>
        </a>
      `).join("")}
    `).join("");
    container.classList.add("show");
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.navbarComponent = { renderNavbar };

})(window);
