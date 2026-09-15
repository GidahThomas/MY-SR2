/* =========================================================
   USIAMS - components/toast.js
   Reusable toast notification system.
   Usage: USIAMS.toast.show("success" | "error" | "warning" | "info", title, message)
   ========================================================= */
(function (global) {
  "use strict";

  const ICONS = {
    success: "bi-check-circle-fill",
    error: "bi-x-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    info: "bi-info-circle-fill"
  };

  function ensureContainer() {
    let container = document.getElementById("usiToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "usiToastContainer";
      container.className = "usi-toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  function show(type, title, message, duration = 4200) {
    const container = ensureContainer();
    const el = document.createElement("div");
    el.className = `usi-toast toast-${type}`;
    el.setAttribute("role", "status");
    el.innerHTML = `
      <i class="bi ${ICONS[type] || ICONS.info} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${global.USIAMS.util.escapeHtml(title || "")}</div>
        <div>${global.USIAMS.util.escapeHtml(message || "")}</div>
      </div>
      <button class="toast-close" aria-label="Close notification"><i class="bi bi-x"></i></button>
    `;
    el.querySelector(".toast-close").addEventListener("click", () => el.remove());
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, duration);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.toast = { show };

})(window);
