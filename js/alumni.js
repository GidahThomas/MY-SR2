/* =========================================================
   USIAMS - js/alumni.js
   Alumni register: searchable/filterable table of graduates.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, table } = window.USIAMS;
  let dataTable = null;

  function initTable() {
    dataTable = table.createDataTable({
      containerId: "alumniTableContainer",
      data: window.USIAMS.data.alumni,
      pageSize: 10,
      searchKeys: ["name", "regNumber", "organization"],
      emptyMessage: "No alumni records found.",
      columns: [
        { key: "name", label: "Name", sortable: true },
        { key: "regNumber", label: "Reg. Number", sortable: true },
        { key: "programmeId", label: "Programme", render: a => util.escapeHtml(window.USIAMS.academic.getProgramme(a.programmeId)?.name || "-") },
        { key: "graduationYear", label: "Graduation Year", sortable: true },
        { key: "employmentStatus", label: "Employment", sortable: true, render: a => `<span class="status-badge status-${a.employmentStatus === "Employed" ? "active" : a.employmentStatus === "Seeking Employment" ? "pending" : "info"}">${a.employmentStatus}</span>` },
        { key: "organization", label: "Organization" },
        { key: "contact", label: "Contact" }
      ]
    });
  }

  function initPage() {
    initTable();
    document.getElementById("alumniSearchInput").addEventListener("input", util.debounce(() => dataTable.setSearch(document.getElementById("alumniSearchInput").value), 200));
    document.getElementById("alumniYearFilter").addEventListener("change", (e) => dataTable.setFilter(a => !e.target.value || String(a.graduationYear) === e.target.value));
    document.getElementById("exportAlumniCsvBtn").addEventListener("click", () => {
      util.downloadCsv("alumni-export", window.USIAMS.data.alumni.map(a => ({
        Name: a.name, RegNumber: a.regNumber, GraduationYear: a.graduationYear, Employment: a.employmentStatus, Organization: a.organization, Contact: a.contact
      })));
    });
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.alumniPage = { initPage };

})(window);
