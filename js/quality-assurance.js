/* =========================================================
   USIAMS - js/quality-assurance.js
   Quality Assurance flags module. QA Officers may only VIEW
   flags - no Add/Edit/Delete/Approve action is ever rendered for
   that role (see js/qa.js for the shared read-only enforcement).
   A limited set of admin-tier roles may progress a flag's status.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, modal, toast, charts, gpa } = window.USIAMS;
  const KEY = "qaFlags";
  let currentUser = null;

  function all() { return window.USIAMS.storage.ensureSeed(KEY, () => window.USIAMS.data.qaFlags); }
  function save(list) { window.USIAMS.storage.setStorage(KEY, list); }
  function canManage() {
    return !window.USIAMS.auth.isReadOnlyRole(currentUser.role) &&
      ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN", "HEAD_OF_DEPARTMENT", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN"].includes(currentUser.role);
  }

  function renderIndicators() {
    const flags = all();
    const indicators = [
      { label: "Missing Student Information", count: flags.filter(f => f.category === "Student Records").length },
      { label: "Duplicate Records", count: flags.filter(f => f.description.toLowerCase().includes("duplicate")).length },
      { label: "Missing Results", count: flags.filter(f => f.category === "Results").length },
      { label: "Invalid Course Registration", count: flags.filter(f => f.category === "Registration").length },
      { label: "Missing Attendance", count: flags.filter(f => f.category === "Attendance").length },
      { label: "Inconsistent Academic Records", count: flags.filter(f => f.category === "Graduation").length }
    ];
    document.getElementById("qualityIndicatorsList").innerHTML = indicators.map(i => `
      <div class="quality-indicator-row">
        <span style="font-size:.85rem;">${i.label}</span>
        <span class="status-badge ${i.count > 0 ? "status-warning" : "status-active"}">${i.count} ${i.count === 1 ? "issue" : "issues"}</span>
      </div>`).join("");
  }

  function renderFlags() {
    const category = document.getElementById("flagCategoryFilter").value;
    const status = document.getElementById("flagStatusFilter").value;
    const flags = all().filter(f => (!category || f.category === category) && (!status || f.status === status));
    const container = document.getElementById("flagsList");
    if (!flags.length) { container.innerHTML = `<div class="empty-state"><i class="bi bi-patch-check"></i>No quality flags match your filters.</div>`; return; }
    container.innerHTML = flags.map(f => `
      <div class="usi-card flag-card severity-${f.severity.toLowerCase()} mb-2">
        <div class="usi-card-body d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <strong>${f.id}</strong>
              <span class="badge text-bg-light border">${util.escapeHtml(f.category)}</span>
              <span class="status-badge priority-${f.severity === "Critical" ? "urgent" : f.severity === "High" ? "high" : f.severity === "Medium" ? "medium" : "low"}">${f.severity}</span>
            </div>
            <div style="font-size:.85rem;">${util.escapeHtml(f.description)}</div>
            <div class="text-muted-usi" style="font-size:.75rem;">${util.escapeHtml(f.entityLabel)} &bull; Raised ${util.formatDate(f.date)}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="status-badge status-${f.status.toLowerCase()}">${util.titleCase(f.status)}</span>
            ${canManage() && f.status !== "RESOLVED" ? `<button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="progress" data-id="${f.id}"><i class="bi bi-arrow-right-circle"></i></button>` : ""}
          </div>
        </div>
      </div>`).join("");

    container.querySelectorAll("[data-action='progress']").forEach(b => b.addEventListener("click", () => progressFlag(b.dataset.id)));
  }

  function progressFlag(id) {
    if (!window.USIAMS.auth.guardWrite("update quality flag status")) return;
    const flag = all().find(f => f.id === id);
    const nextStatus = flag.status === "OPEN" ? "UNDER_REVIEW" : "RESOLVED";
    modal.confirm({
      title: "Update Quality Flag",
      message: `Mark <strong>${id}</strong> as <strong>${util.titleCase(nextStatus)}</strong>?`,
      confirmText: "Update Status", variant: "primary",
      onConfirm: () => {
        save(all().map(f => f.id === id ? { ...f, status: nextStatus } : f));
        renderFlags();
        renderIndicators();
        toast.show("success", "Flag updated", `${id} is now ${util.titleCase(nextStatus)}.`);
      }
    });
  }

  function renderCharts() {
    const students = window.USIAMS.data.students;
    const dist = gpa.gradeDistribution(window.USIAMS.data.results);
    charts.barChart("qaGpaDistributionChart", Object.keys(dist), [{ label: "Students", data: Object.values(dist) }]);

    const byDept = window.USIAMS.data.departments.map(d => ({
      name: d.id,
      avgGpa: (() => {
        const deptStudents = students.filter(s => s.departmentId === d.id);
        const results = window.USIAMS.data.results.filter(r => deptStudents.some(s => s.id === r.studentId)).map(r => ({ ...r, credits: window.USIAMS.courses.getCourse(r.courseId)?.credits || 0 }));
        return gpa.calculateGpa(results);
      })()
    }));
    charts.barChart("departmentPerformanceChart", byDept.map(d => d.name), [{ label: "Average GPA", data: byDept.map(d => d.avgGpa) }], { scales: { y: { min: 0, max: 5 } } });
  }

  function exportFlagsCsv() {
    util.downloadCsv("qa-flags-export", all().map(f => ({
      ID: f.id, Category: f.category, Severity: f.severity, Entity: f.entityLabel,
      Description: f.description, DateRaised: f.date, Status: f.status
    })));
  }

  function initPage(user) {
    currentUser = user;
    document.getElementById("flagCategoryFilter").innerHTML = `<option value="">All Categories</option>` +
      [...new Set(all().map(f => f.category))].map(c => `<option>${c}</option>`).join("");
    renderIndicators();
    renderFlags();
    renderCharts();
    document.getElementById("flagCategoryFilter").addEventListener("change", renderFlags);
    document.getElementById("flagStatusFilter").addEventListener("change", renderFlags);
    document.getElementById("exportFlagsCsvBtn").addEventListener("click", exportFlagsCsv);
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.qaPage = { initPage };

})(window);
