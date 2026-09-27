/* =========================================================
   USIAMS - js/requests.js
   Requests module: students submit and track requests; staff
   view, progress and resolve them. Saved to the database through the API.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, modal, table, toast } = window.USIAMS;
  const KEY = "requests";
  let currentUser = null;
  let dataTable = null;

  function all() { return window.USIAMS.storage.ensureSeed(KEY, () => window.USIAMS.data.seedRequests); }
  function save(list) { window.USIAMS.storage.setStorage(KEY, list); }
  function myRequests() { return currentUser.role === "STUDENT" ? all().filter(r => r.studentId === currentUser.studentId) : all(); }
  function canManage() { return !window.USIAMS.auth.isReadOnlyRole(currentUser.role) && currentUser.role !== "STUDENT"; }

  function rowActions(req) {
    return `<div class="d-flex gap-1">
      <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${req.id}"><i class="bi bi-eye"></i></button>
      ${canManage() ? `<button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="progress" data-id="${req.id}"><i class="bi bi-arrow-right-circle"></i></button>` : ""}
    </div>`;
  }

  function initTable() {
    dataTable = table.createDataTable({
      containerId: "requestsTableContainer",
      data: myRequests(),
      pageSize: 8,
      searchKeys: ["id", "type", "description"],
      emptyMessage: "No requests found.",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "type", label: "Type", sortable: true },
        { key: "description", label: "Description", render: r => `<span title="${util.escapeHtml(r.description)}">${util.escapeHtml(r.description.slice(0, 50))}${r.description.length > 50 ? "..." : ""}</span>` },
        { key: "createdAt", label: "Submitted", sortable: true, render: r => util.formatDate(r.createdAt) },
        { key: "status", label: "Status", sortable: true, render: r => `<span class="status-badge status-${r.status.toLowerCase()}">${util.titleCase(r.status)}</span>` }
      ],
      rowActions,
      afterRender: () => {
        document.querySelectorAll("#requestsTableContainer [data-action='view']").forEach(b => b.addEventListener("click", () => openDetails(b.dataset.id)));
        document.querySelectorAll("#requestsTableContainer [data-action='progress']").forEach(b => b.addEventListener("click", () => openProgressModal(b.dataset.id)));
      }
    });
  }

  function openDetails(id) {
    const req = all().find(r => r.id === id);
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-scrollable"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">${req.id} - ${util.escapeHtml(req.type)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <p>${util.escapeHtml(req.description)}</p>
          ${req.attachment ? `<p class="text-muted-usi" style="font-size:.8rem;"><i class="bi bi-paperclip me-1"></i>${req.attachmentUrl ? `<a href="#" data-action="download-attachment" data-url="${util.escapeHtml(req.attachmentUrl)}" data-name="${util.escapeHtml(req.attachment)}">${util.escapeHtml(req.attachment)}</a>` : util.escapeHtml(req.attachment)}</p>` : ""}
          <h6 class="mt-3">Timeline</h6>
          ${util.timelineHtml(req.timeline)}
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div></div>
    `);
  }

  function openProgressModal(id) {
    if (!window.USIAMS.auth.guardWrite("update request status")) return;
    const req = all().find(r => r.id === id);
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Update Request ${req.id}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">New Status</label>
          <select class="form-select mb-3" id="newStatus">${window.USIAMS.data.requestStatuses.map(s => `<option ${s === req.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          <label class="form-label">Note</label>
          <textarea class="form-control" id="statusNote" rows="3" placeholder="Add a note about this update..."></textarea>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveStatusBtn" style="background:var(--primary);border-color:var(--primary);">Save Update</button></div>
      </div></div></div>
    `);
    document.getElementById("saveStatusBtn").addEventListener("click", () => {
      const status = document.getElementById("newStatus").value;
      const note = document.getElementById("statusNote").value.trim() || `Status updated to ${util.titleCase(status)}.`;
      const list = all().map(r => r.id === id ? { ...r, status, timeline: [...r.timeline, { status, date: new Date().toISOString(), note }] } : r);
      save(list);
      modal.close();
      dataTable.refresh(myRequests());
      toast.show("success", "Request updated", `${id} status changed to ${util.titleCase(status)}.`);
    });
  }

  function openSubmitModal() {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Submit a Request</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Request Type</label>
          <select class="form-select mb-3" id="reqType">${window.USIAMS.data.requestTypes.map(t => `<option>${t}</option>`).join("")}</select>
          <label class="form-label">Description</label>
          <textarea class="form-control mb-3" id="reqDesc" rows="4" placeholder="Describe your request in detail..."></textarea>
          <label class="form-label">Attachment (optional)</label>
          <input type="file" class="form-control" id="reqFile">
          <div id="reqFormError" class="alert alert-danger mt-3 d-none"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="submitReqBtn" style="background:var(--primary);border-color:var(--primary);">Submit Request</button></div>
      </div></div></div>
    `);
    document.getElementById("submitReqBtn").addEventListener("click", async () => {
      const desc = document.getElementById("reqDesc").value.trim();
      if (!desc) { document.getElementById("reqFormError").textContent = "Please provide a description for your request."; document.getElementById("reqFormError").classList.remove("d-none"); return; }
      const file = document.getElementById("reqFile").files[0];
      // The attachment itself is stored in the database; the request keeps its URL.
      let stored = null;
      if (file) {
        try { stored = await window.USIAMS.api.files.upload(file, "request"); }
        catch (error) { document.getElementById("reqFormError").textContent = error.message; document.getElementById("reqFormError").classList.remove("d-none"); return; }
      }
      const newReq = {
        id: util.uid("REQ"), studentId: currentUser.studentId, type: document.getElementById("reqType").value,
        description: desc, attachment: file ? file.name : null, attachmentUrl: stored ? stored.url : null, status: "PENDING", createdAt: new Date().toISOString(),
        timeline: [{ status: "PENDING", date: new Date().toISOString(), note: "Request submitted by student." }]
      };
      const list = all(); list.push(newReq); save(list);
      modal.close();
      dataTable.refresh(myRequests());
      toast.show("success", "Request submitted", "Your request has been submitted and will be reviewed shortly.");
    });
  }

  function exportCsv() {
    util.downloadCsv("requests-export", myRequests().map(r => {
      const student = window.USIAMS.students.getStudent(r.studentId);
      return { ID: r.id, Student: student ? util.studentLabel(student, currentUser) : r.studentId, Type: r.type, Description: r.description, Status: r.status, Submitted: util.formatDate(r.createdAt) };
    }));
  }

  function initPage(user) {
    currentUser = user;
    initTable();
    document.getElementById("submitRequestBtn").addEventListener("click", openSubmitModal);
    document.getElementById("exportRequestsCsvBtn").addEventListener("click", exportCsv);
    document.getElementById("requestSearchInput").addEventListener("input", util.debounce(() => dataTable.setSearch(document.getElementById("requestSearchInput").value), 200));
    document.getElementById("requestStatusFilter").addEventListener("change", (e) => dataTable.setFilter(r => !e.target.value || r.status === e.target.value));

    const params = new URLSearchParams(window.location.search);
    if (params.get("openRequest")) openDetails(params.get("openRequest"));
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.requestsPage = { initPage };

})(window);
