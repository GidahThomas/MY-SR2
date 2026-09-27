/* =========================================================
   USIAMS - js/qa.js
   Quality Assurance read-only enforcement + QA dashboard/flag
   rendering helpers.

   IMPORTANT: everything in this file is a FRONTEND DEMONSTRATION
   of read-only behaviour only. It hides/blocks "write" buttons in
   the browser so the prototype behaves correctly during a demo,
   but a real attacker could still call any write function directly
   from the browser console. The actual Yii2 backend MUST enforce
   this by checking the authenticated user's role on every request
   and responding with HTTP 403 Forbidden for QA (or any
   unauthorized) write attempts - never trust the client.
   ========================================================= */
(function (global) {
  "use strict";

  function injectReadOnlyBadge() {
    document.body.classList.add("qa-readonly");

    const header = document.querySelector(".page-header");
    if (header && !header.querySelector(".read-only-badge")) {
      const badgeWrap = document.createElement("div");
      badgeWrap.innerHTML = `<span class="read-only-badge"><i class="bi bi-eye"></i> Read-Only Access</span>`;
      header.appendChild(badgeWrap.firstElementChild);
    }

    // Defense-in-depth: even if a write control wasn't hidden by CSS,
    // intercept clicks on it in the capture phase and block the action.
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-write-action]");
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation();
        global.USIAMS.toast.show("error", "Access denied", "Quality Assurance Officer has read-only access to this module.");
      }
    }, true);
  }

  function accessDeniedBanner(container, message) {
    if (!container) return;
    container.insertAdjacentHTML("afterbegin", `
      <div class="access-denied-banner">
        <i class="bi bi-shield-lock fs-5"></i>
        <div>${message || "Access denied. QA Officer has read-only access."}</div>
      </div>
    `);
  }

  global.USIAMS = global.USIAMS || {};
  // Data-quality indicators from the QA flags, shown on the QA dashboard and
  // the Quality Assurance page.
  function qualityIndicators(flags) {
    const count = test => flags.filter(test).length;
    return [
      { label: "Missing Student Information", count: count(f => f.category === "Student Records") },
      { label: "Duplicate Records", count: count(f => String(f.description || "").toLowerCase().includes("duplicate")) },
      { label: "Missing Results", count: count(f => f.category === "Results") },
      { label: "Invalid Course Registration", count: count(f => f.category === "Registration") },
      { label: "Missing Attendance", count: count(f => f.category === "Attendance") },
      { label: "Inconsistent Academic Records", count: count(f => f.category === "Graduation") }
    ];
  }

  function renderQualityIndicators(containerId, flags) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = qualityIndicators(flags).map(i => `
      <div class="quality-indicator-row">
        <span style="font-size:.85rem;">${i.label}</span>
        <span class="status-badge ${i.count > 0 ? "status-warning" : "status-active"}">${i.count} ${i.count === 1 ? "issue" : "issues"}</span>
      </div>`).join("");
  }

  global.USIAMS.qa = { injectReadOnlyBadge, accessDeniedBanner, qualityIndicators, renderQualityIndicators };

})(window);
