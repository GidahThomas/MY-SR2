/* =========================================================
   USIAMS - components/table.js
   Generic sortable, searchable, paginated table renderer used
   across Students, Courses, Alumni, Reports, Audit Logs, etc.
   ========================================================= */
(function (global) {
  "use strict";

  /**
   * createDataTable(config)
   * config = {
   *   containerId, columns: [{key,label,sortable,render(row)}],
   *   data: [...], pageSize, searchKeys: [...],
   *   rowActions(row) -> html string, emptyMessage
   * }
   * Returns { refresh(data), getState() }
   */
  function createDataTable(config) {
    const state = {
      data: config.data || [],
      filtered: config.data || [],
      search: "",
      sortKey: null,
      sortDir: 1,
      page: 1,
      pageSize: config.pageSize || 10
    };

    const container = document.getElementById(config.containerId);
    if (!container) return null;

    function applyFilters() {
      let rows = state.data;
      if (state.search) {
        const q = state.search.toLowerCase();
        const keys = config.searchKeys || config.columns.map(c => c.key);
        rows = rows.filter(row => keys.some(k => String(row[k] ?? "").toLowerCase().includes(q)));
      }
      if (config.externalFilter) {
        rows = rows.filter(config.externalFilter);
      }
      if (state.sortKey) {
        rows = [...rows].sort((a, b) => {
          const av = a[state.sortKey], bv = b[state.sortKey];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * state.sortDir;
        });
      }
      state.filtered = rows;
      if (state.page > Math.ceil(rows.length / state.pageSize)) state.page = 1;
    }

    function render() {
      applyFilters();
      const { util } = global.USIAMS;
      const pg = util.paginate(state.filtered, state.page, state.pageSize);
      const hasActions = typeof config.rowActions === "function";

      const thead = config.columns.map(col => {
        const sortIcon = state.sortKey === col.key
          ? (state.sortDir === 1 ? '<i class="bi bi-sort-alpha-down"></i>' : '<i class="bi bi-sort-alpha-up"></i>')
          : (col.sortable ? '<i class="bi bi-arrow-down-up"></i>' : "");
        return `<th data-key="${col.key}" data-sortable="${!!col.sortable}">${util.escapeHtml(col.label)} ${sortIcon}</th>`;
      }).join("") + (hasActions ? `<th>Actions</th>` : "");

      const tbody = pg.items.length ? pg.items.map(row => {
        const cells = config.columns.map(col => `<td>${col.render ? col.render(row) : util.escapeHtml(row[col.key] ?? "-")}</td>`).join("");
        return `<tr data-row-id="${util.escapeHtml(row.id ?? "")}">${cells}${hasActions ? `<td>${config.rowActions(row)}</td>` : ""}</tr>`;
      }).join("") : `<tr><td colspan="${config.columns.length + (hasActions ? 1 : 0)}"><div class="empty-state"><i class="bi bi-inbox"></i>${util.escapeHtml(config.emptyMessage || "No records found.")}</div></td></tr>`;

      container.innerHTML = `
        <div class="usi-table-wrap">
          <table class="usi-table">
            <thead><tr>${thead}</tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        <div class="pagination-bar">
          <span class="page-info">Showing ${pg.start}-${pg.end} of ${pg.total} records</span>
          <div class="btn-group btn-group-sm" role="group" aria-label="Pagination">
            <button class="btn btn-outline-secondary" data-page="prev" ${pg.currentPage <= 1 ? "disabled" : ""}><i class="bi bi-chevron-left"></i></button>
            <button class="btn btn-outline-secondary disabled">Page ${pg.currentPage} / ${pg.totalPages}</button>
            <button class="btn btn-outline-secondary" data-page="next" ${pg.currentPage >= pg.totalPages ? "disabled" : ""}><i class="bi bi-chevron-right"></i></button>
          </div>
        </div>
      `;

      container.querySelectorAll("thead th[data-sortable='true']").forEach(th => {
        th.addEventListener("click", () => {
          const key = th.dataset.key;
          if (state.sortKey === key) state.sortDir *= -1; else { state.sortKey = key; state.sortDir = 1; }
          render();
        });
      });
      const prevBtn = container.querySelector("[data-page='prev']");
      const nextBtn = container.querySelector("[data-page='next']");
      if (prevBtn) prevBtn.addEventListener("click", () => { state.page--; render(); });
      if (nextBtn) nextBtn.addEventListener("click", () => { state.page++; render(); });

      if (typeof config.afterRender === "function") config.afterRender(pg.items);
    }

    render();

    return {
      refresh(newData) { state.data = newData; state.page = 1; render(); },
      setSearch(term) { state.search = term; state.page = 1; render(); },
      setFilter(fn) { config.externalFilter = fn; state.page = 1; render(); },
      rerender: render,
      getState: () => state
    };
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.table = { createDataTable };

})(window);
