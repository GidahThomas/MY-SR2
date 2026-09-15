/* =========================================================
   USIAMS - components/cards.js
   Renders stat cards and quick action tiles used on dashboards.
   ========================================================= */
(function (global) {
  "use strict";

  function statCard({ label, value, icon, tint = "primary", trend, trendUp = true }) {
    const { escapeHtml } = global.USIAMS.util;
    return `
      <div class="stat-card">
        <div>
          <div class="stat-label">${escapeHtml(label)}</div>
          <div class="stat-value">${escapeHtml(String(value))}</div>
          ${trend ? `<div class="stat-trend ${trendUp ? "up" : "down"}"><i class="bi bi-arrow-${trendUp ? "up" : "down"}-short"></i>${escapeHtml(trend)}</div>` : ""}
        </div>
        <div class="stat-icon icon-tint-${tint}"><i class="bi ${icon}"></i></div>
      </div>
    `;
  }

  function quickAction({ label, icon, href, onclick }) {
    const { escapeHtml } = global.USIAMS.util;
    // Wrapped in the same col-6/col-md-4/col-lg-2 grid column every
    // hand-coded quick-actions row in /pages uses - .quick-action-tile
    // is width:100% of its column, not a fixed-size flex item, so it
    // needs that wrapper to lay out as a compact tile grid.
    const inner = onclick
      ? `<button type="button" class="quick-action-tile" onclick="${onclick}"><i class="bi ${icon}"></i><span>${escapeHtml(label)}</span></button>`
      : `<a href="${href}" class="quick-action-tile"><i class="bi ${icon}"></i><span>${escapeHtml(label)}</span></a>`;
    return `<div class="col-6 col-md-4 col-lg-2">${inner}</div>`;
  }

  function renderStatGrid(containerId, cards) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = cards.map(statCard).join("");
  }

  function renderQuickActions(containerId, actions) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = actions.map(quickAction).join("");
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.cards = { statCard, quickAction, renderStatGrid, renderQuickActions };

})(window);
