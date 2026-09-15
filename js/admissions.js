/* =========================================================
   USIAMS - js/admissions.js
   Staff-side admissions review: Registration Officers/Admins
   triage applications submitted through the public apply.html
   form (see js/apply.js) and move them through Submitted ->
   Under Review -> Accepted/Rejected.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, toast, modal } = global.USIAMS;
  const applicationsOverlay = global.USIAMS.storage.createOverlay("admissionApplications", () => global.USIAMS.data.seedApplications);

  function all() { return applicationsOverlay.getAll(); }

  function setStatus(id, status, notes) {
    const patch = { status };
    if (notes !== undefined) patch.notes = notes;
    applicationsOverlay.update(id, patch);
  }

  function openDetailModal(app) {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">${util.escapeHtml(app.fullName)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <dl class="kv-list row">
            <div class="col-md-6"><dt>Email</dt><dd>${util.escapeHtml(app.email)}</dd></div>
            <div class="col-md-6"><dt>Phone</dt><dd>${util.escapeHtml(app.phone)}</dd></div>
            <div class="col-md-6"><dt>Gender</dt><dd>${util.escapeHtml(app.gender)}</dd></div>
            <div class="col-md-6"><dt>Programme Applied For</dt><dd>${util.escapeHtml(global.USIAMS.academic.getProgramme(app.programmeId)?.name || app.programmeId)}</dd></div>
            <div class="col-md-6"><dt>Previous School</dt><dd>${util.escapeHtml(app.previousSchool)}</dd></div>
            <div class="col-md-6"><dt>Entry Qualification</dt><dd>${util.escapeHtml(app.entryQualification)}</dd></div>
            <div class="col-md-6"><dt>Applied</dt><dd>${util.formatDate(app.applicationDate)}</dd></div>
            <div class="col-md-6"><dt>Status</dt><dd><span class="status-badge status-${app.status.toLowerCase().replace(/\s+/g, "_")}">${app.status}</span></dd></div>
          </dl>
          <label class="form-label">Review Notes</label>
          <textarea class="form-control" id="reviewNotesInput" rows="3">${util.escapeHtml(app.notes || "")}</textarea>
        </div>
        <div class="modal-footer flex-wrap">
          <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
          <button class="btn btn-outline-warning write-action" data-write-action id="markReviewBtn">Mark Under Review</button>
          <button class="btn btn-outline-danger write-action" data-write-action id="rejectAppBtn">Reject</button>
          <button class="btn btn-primary write-action" data-write-action id="acceptAppBtn" style="background:var(--primary);border-color:var(--primary);">Accept</button>
        </div>
      </div></div></div>
    `);
    const notesVal = () => document.getElementById("reviewNotesInput").value.trim();
    document.getElementById("markReviewBtn").addEventListener("click", () => { if (!global.USIAMS.auth.guardWrite("update this application")) return; setStatus(app.id, "Under Review", notesVal()); modal.close(); render(); toast.show("success", "Status updated", "Application marked as under review."); });
    document.getElementById("rejectAppBtn").addEventListener("click", () => { if (!global.USIAMS.auth.guardWrite("update this application")) return; setStatus(app.id, "Rejected", notesVal()); modal.close(); render(); toast.show("success", "Application rejected", "The applicant has been notified in this simulation."); });
    document.getElementById("acceptAppBtn").addEventListener("click", () => { if (!global.USIAMS.auth.guardWrite("update this application")) return; setStatus(app.id, "Accepted", notesVal()); modal.close(); render(); toast.show("success", "Application accepted", "The applicant has been notified in this simulation."); });
  }

  function render() {
    const apps = all();
    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Total Applications", value: apps.length, icon: "bi-inboxes", tint: "primary" },
      { label: "Submitted", value: apps.filter(a => a.status === "Submitted").length, icon: "bi-envelope", tint: "info" },
      { label: "Under Review", value: apps.filter(a => a.status === "Under Review").length, icon: "bi-hourglass-split", tint: "warning" },
      { label: "Accepted", value: apps.filter(a => a.status === "Accepted").length, icon: "bi-check2-circle", tint: "success" }
    ]);

    const appsTable = global.USIAMS.table.createDataTable({
      containerId: "applicationsTableContainer",
      data: [...apps].sort((a, b) => new Date(b.applicationDate) - new Date(a.applicationDate)),
      searchKeys: ["fullName", "email", "id"],
      columns: [
        { key: "id", label: "Application ID", sortable: true },
        { key: "fullName", label: "Applicant", sortable: true },
        { key: "programme", label: "Programme", render: a => util.escapeHtml(global.USIAMS.academic.getProgramme(a.programmeId)?.code || a.programmeId) },
        { key: "applicationDate", label: "Applied", sortable: true, render: a => util.formatDate(a.applicationDate) },
        { key: "status", label: "Status", render: a => `<span class="status-badge status-${a.status.toLowerCase().replace(/\s+/g, "_")}">${a.status}</span>` }
      ],
      rowActions: a => `<button class="btn btn-sm btn-outline-secondary" data-action="view" data-id="${a.id}"><i class="bi bi-eye"></i> Review</button>`,
      afterRender() {
        document.querySelectorAll("#applicationsTableContainer [data-action='view']").forEach(btn => btn.addEventListener("click", () => openDetailModal(apps.find(a => a.id === btn.dataset.id))));
      }
    });
    document.getElementById("applicationsSearchInput").addEventListener("input", util.debounce(() => appsTable.setSearch(document.getElementById("applicationsSearchInput").value), 200));
  }

  function initPage() { render(); }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.admissionsPage = { initPage };

})(window);
