/* =========================================================
   USIAMS - js/audit-logs.js
   Audit trail viewer. Strictly append-only in this prototype -
   no role (QA, System Admin, or any other) is given an Edit or
   Delete action for audit log entries.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, table } = window.USIAMS;
  let dataTable = null;

  function all() { return window.USIAMS.storage.getStorage("auditLogs", window.USIAMS.data.seedAuditLogs); }

  function renderInto(containerId, filterContainerId) {
    dataTable = table.createDataTable({
      containerId,
      data: all(),
      pageSize: 10,
      searchKeys: ["user", "action", "entity", "entityId"],
      emptyMessage: "No audit log entries found.",
      columns: [
        { key: "date", label: "Date", sortable: true, render: l => `${util.formatDate(l.date)} ${l.time}` },
        { key: "user", label: "User", sortable: true },
        { key: "role", label: "Role", sortable: true, render: l => util.titleCase(l.role) },
        { key: "action", label: "Action", sortable: true, render: l => `<span class="badge text-bg-light border">${l.action}</span>` },
        { key: "entity", label: "Entity", render: l => `${util.escapeHtml(l.entity)} (${util.escapeHtml(l.entityId)})` },
        { key: "ip", label: "IP Address" },
        { key: "status", label: "Status", sortable: true, render: l => `<span class="status-badge status-${l.status === "Success" ? "active" : "rejected"}">${l.status}</span>` }
      ]
    });

    if (filterContainerId) {
      const filterWrap = document.getElementById(filterContainerId);
      filterWrap.querySelector("[data-role='search']").addEventListener("input", util.debounce((e) => dataTable.setSearch(e.target.value), 200));
      filterWrap.querySelector("[data-role='action-filter']").addEventListener("change", (e) => dataTable.setFilter(l => !e.target.value || l.action === e.target.value));
    }
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.auditLogsModule = { renderInto, all };

})(window);
