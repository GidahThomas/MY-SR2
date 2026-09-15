/* =========================================================
   USIAMS - js/calendar.js
   Academic Calendar page: national public holidays and
   university calendar milestones from data/calendar.js.
   ========================================================= */
(function (global) {
  "use strict";

  const { util } = global.USIAMS;
  let dataTable = null;

  function applyFilter() {
    const type = document.getElementById("calendarTypeFilter").value;
    dataTable.setFilter(e => !type || e.type === type);
  }

  function render() {
    const events = global.USIAMS.calendar.allEvents();

    const upcoming = events.filter(e => new Date(e.date) >= new Date("2026-09-12"));
    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Total Events", value: events.length, icon: "bi-calendar3", tint: "primary" },
      { label: "Public Holidays", value: events.filter(e => e.type === "Public Holiday").length, icon: "bi-flag", tint: "info" },
      { label: "Academic Milestones", value: events.filter(e => e.type === "Academic Calendar").length, icon: "bi-mortarboard", tint: "success" },
      { label: "Upcoming", value: upcoming.length, icon: "bi-arrow-up-right-circle", tint: "warning" }
    ]);

    dataTable = global.USIAMS.table.createDataTable({
      containerId: "calendarTableContainer",
      data: events,
      pageSize: 15,
      searchKeys: ["title", "description"],
      columns: [
        { key: "date", label: "Date", sortable: true, render: e => util.formatDate(e.date) + (e.endDate ? ` - ${util.formatDate(e.endDate)}` : "") },
        { key: "title", label: "Event", sortable: true },
        { key: "type", label: "Type", sortable: true, render: e => `<span class="status-badge status-${e.type === "Public Holiday" ? "info" : "active"}">${e.type}</span>` },
        { key: "description", label: "Details", render: e => util.escapeHtml(e.description || "") }
      ]
    });

    document.getElementById("calendarSearchInput").addEventListener("input", util.debounce(() => dataTable.setSearch(document.getElementById("calendarSearchInput").value), 200));
    document.getElementById("calendarTypeFilter").addEventListener("change", applyFilter);
  }

  function initPage() { render(); }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.calendarPage = { initPage };

})(window);
