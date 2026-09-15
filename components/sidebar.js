/* =========================================================
   USIAMS - components/sidebar.js
   Renders the left navigation sidebar (and its mobile offcanvas
   behaviour) based on the signed-in user's role.
   ========================================================= */
(function (global) {
  "use strict";

  function renderSidebar(containerId, user, basePath) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const { escapeHtml, initials } = global.USIAMS.util;
    const menu = global.USIAMS.navigation.menuForRole(user.role);
    const currentFile = global.USIAMS.navigation.currentPageFile();

    const navHtml = menu.map(item => {
      if (item.section) {
        return `<div class="sidebar-section-label">${escapeHtml(item.section)}</div>`;
      }
      const targets = item.match || [item.href.split("/").pop()];
      const isActive = targets.includes(currentFile);
      return `
        <a href="${basePath}${item.href}" class="sidebar-link ${isActive ? "active" : ""}">
          <i class="bi ${item.icon}"></i><span>${escapeHtml(item.label)}</span>
        </a>`;
    }).join("");

    container.innerHTML = `
      <div class="sidebar-brand">
        <div class="brand-mark">US</div>
        <div class="brand-text">
          <strong>USIAMS</strong>
          <span>University Student Information &amp; Academic Mgmt.</span>
        </div>
      </div>
      <nav class="sidebar-nav" aria-label="Primary">${navHtml}</nav>
      <div class="sidebar-footer">
        <div class="user-row">
          <div class="avatar-circle" style="background:${global.USIAMS.util.avatarColorFromString(user.name)}">${initials(user.name)}</div>
          <div class="user-meta">
            <strong>${escapeHtml(user.name)}</strong>
            <span>${escapeHtml(user.roleLabel)}</span>
          </div>
        </div>
        <button type="button" class="logout-btn" id="sidebarLogoutBtn">
          <i class="bi bi-box-arrow-right"></i> Sign Out
        </button>
      </div>
    `;

    document.getElementById("sidebarLogoutBtn").addEventListener("click", () => {
      global.USIAMS.modal.confirm({
        title: "Sign out of USIAMS",
        message: "Are you sure you want to end your session and sign out?",
        confirmText: "Sign Out",
        variant: "primary",
        onConfirm: () => global.USIAMS.auth.logout()
      });
    });
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.sidebarComponent = { renderSidebar };

})(window);
