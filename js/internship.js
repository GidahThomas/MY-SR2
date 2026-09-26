/* =========================================================
   USIAMS - js/internship.js
   Internship placement tracking: organization, supervisor,
   dates, status, logbook entries and final assessment.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, toast } = window.USIAMS;
  const KEY = "internships";
  let currentUser = null;

  function all() { return window.USIAMS.storage.ensureSeed(KEY, () => window.USIAMS.data.seedInternships); }
  function save(list) { window.USIAMS.storage.setStorage(KEY, list); }
  function mine() { return currentUser.role === "STUDENT" ? all().filter(i => i.studentId === currentUser.studentId) : all(); }

  function render() {
    const list = mine();
    const container = document.getElementById("internshipList");
    if (!list.length) { container.innerHTML = `<div class="empty-state"><i class="bi bi-briefcase"></i>No internship placements found.</div>`; return; }
    container.innerHTML = list.map(i => {
      const student = window.USIAMS.students.getStudent(i.studentId);
      return `
      <div class="usi-card mb-3">
        <div class="usi-card-header">
          <div>
            <h3>${util.escapeHtml(i.organization)}</h3>
            <div class="text-muted-usi" style="font-size:.78rem;">${util.escapeHtml(util.studentLabel(student, currentUser))} &bull; ${util.escapeHtml(i.location)}</div>
          </div>
          <span class="status-badge status-${i.status.toLowerCase().replace(/\s+/g, "_")}">${i.status}</span>
        </div>
        <div class="usi-card-body">
          <dl class="kv-list row">
            <div class="col-md-3"><dt>Supervisor</dt><dd>${util.escapeHtml(i.supervisor)}</dd></div>
            <div class="col-md-3"><dt>Start Date</dt><dd>${i.startDate ? util.formatDate(i.startDate) : "-"}</dd></div>
            <div class="col-md-3"><dt>End Date</dt><dd>${i.endDate ? util.formatDate(i.endDate) : "-"}</dd></div>
            <div class="col-md-3"><dt>Logbook Entries</dt><dd>${i.logbookEntries}</dd></div>
          </dl>
          ${i.assessment ? `
            <div class="border rounded-3 p-3 mt-2">
              <strong style="font-size:.85rem;">Final Assessment</strong>
              <div class="row mt-2">
                <div class="col-md-4"><span class="text-muted-usi" style="font-size:.76rem;">Supervisor Score</span><div class="fw-700">${i.assessment.supervisorScore}/100</div></div>
                <div class="col-md-4"><span class="text-muted-usi" style="font-size:.76rem;">Academic Score</span><div class="fw-700">${i.assessment.academicScore}/100</div></div>
                <div class="col-md-4"><span class="text-muted-usi" style="font-size:.76rem;">Final Grade</span><div class="fw-700">${i.assessment.finalGrade}</div></div>
              </div>
            </div>` : ""}
          ${currentUser.role === "STUDENT" && i.status === "In Progress" ? `
            <button class="btn btn-sm btn-outline-primary mt-3" data-action="log" data-id="${i.id}"><i class="bi bi-journal-plus me-1"></i>Add Logbook Entry</button>` : ""}
        </div>
      </div>`;
    }).join("");

    container.querySelectorAll("[data-action='log']").forEach(b => b.addEventListener("click", () => addLogEntry(b.dataset.id)));
  }

  function addLogEntry(id) {
    const list = all().map(i => i.id === id ? { ...i, logbookEntries: i.logbookEntries + 1 } : i);
    save(list);
    render();
    toast.show("success", "Logbook entry added", "Your internship logbook has been updated.");
  }

  function initPage(user) {
    currentUser = user;
    render();
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.internshipPage = { initPage };

})(window);
