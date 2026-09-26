/* =========================================================
   USIAMS - js/complaints.js
   Complaints module: students submit and track; staff view,
   assign, escalate, respond and resolve. Saved to the database through the API.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, modal, table, toast } = window.USIAMS;
  const KEY = "complaints";
  let currentUser = null;
  let dataTable = null;

  function all() { return window.USIAMS.storage.ensureSeed(KEY, () => window.USIAMS.data.seedComplaints); }
  function save(list) { window.USIAMS.storage.setStorage(KEY, list); }
  function mine() { return currentUser.role === "STUDENT" ? all().filter(c => c.studentId === currentUser.studentId) : all(); }
  function canManage() { return !window.USIAMS.auth.isReadOnlyRole(currentUser.role) && currentUser.role !== "STUDENT"; }

  function rowActions(c) {
    return `<div class="d-flex gap-1">
      <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${c.id}"><i class="bi bi-eye"></i></button>
      ${canManage() ? `<button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="manage" data-id="${c.id}"><i class="bi bi-gear"></i></button>` : ""}
    </div>`;
  }

  function initTable() {
    dataTable = table.createDataTable({
      containerId: "complaintsTableContainer",
      data: mine(),
      pageSize: 8,
      searchKeys: ["id", "category", "description"],
      emptyMessage: "No complaints found.",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "category", label: "Category", sortable: true },
        { key: "priority", label: "Priority", sortable: true, render: c => `<span class="status-badge priority-${c.priority.toLowerCase()}">${c.priority}</span>` },
        { key: "createdAt", label: "Submitted", sortable: true, render: c => util.formatDate(c.createdAt) },
        { key: "assignedTo", label: "Assigned To", render: c => c.assignedTo ? util.escapeHtml(c.assignedTo) : "<span class='text-soft-usi'>Unassigned</span>" },
        { key: "status", label: "Status", sortable: true, render: c => `<span class="status-badge status-${c.status.toLowerCase()}">${util.titleCase(c.status)}</span>` }
      ],
      rowActions,
      afterRender: () => {
        document.querySelectorAll("#complaintsTableContainer [data-action='view']").forEach(b => b.addEventListener("click", () => openDetails(b.dataset.id)));
        document.querySelectorAll("#complaintsTableContainer [data-action='manage']").forEach(b => b.addEventListener("click", () => openManageModal(b.dataset.id)));
      }
    });
  }

  function openDetails(id) {
    const c = all().find(x => x.id === id);
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-scrollable"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">${c.id} - ${util.escapeHtml(c.category)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <p>${util.escapeHtml(c.description)}</p>
          <p><span class="status-badge priority-${c.priority.toLowerCase()}">${c.priority} PRIORITY</span> ${c.assignedTo ? `&bull; Assigned to ${util.escapeHtml(c.assignedTo)}` : ""}</p>
          ${c.attachment ? `<p class="text-muted-usi" style="font-size:.8rem;"><i class="bi bi-paperclip me-1"></i>${c.attachmentUrl ? `<a href="#" data-action="download-attachment" data-url="${util.escapeHtml(c.attachmentUrl)}" data-name="${util.escapeHtml(c.attachment)}">${util.escapeHtml(c.attachment)}</a>` : util.escapeHtml(c.attachment)}</p>` : ""}
          <h6 class="mt-3">Timeline</h6>
          <ul class="usi-timeline">
            ${c.timeline.map(t => `<li><span class="tl-dot ${t.status === "REJECTED" ? "rej" : t.status === "RESOLVED" || t.status === "CLOSED" ? "done" : "warn"}"></span>
              <div class="tl-title">${util.titleCase(t.status)}</div><div class="tl-meta">${util.formatDateTime(t.date)} - ${util.escapeHtml(t.note)}</div></li>`).join("")}
          </ul>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div></div>
    `);
  }

  function openManageModal(id) {
    if (!window.USIAMS.auth.guardWrite("manage complaints")) return;
    const c = all().find(x => x.id === id);
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Manage Complaint ${c.id}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Assign To</label>
          <input class="form-control mb-3" id="assignTo" value="${util.escapeHtml(c.assignedTo || "")}" placeholder="e.g. Head of Department">
          <label class="form-label">Status</label>
          <select class="form-select mb-3" id="newStatus">${window.USIAMS.data.complaintStatuses.map(s => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          <label class="form-label">Response / Note</label>
          <textarea class="form-control" id="responseNote" rows="3" placeholder="Add a response or resolution note..."></textarea>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveManageBtn" style="background:var(--primary);border-color:var(--primary);">Save</button></div>
      </div></div></div>
    `);
    document.getElementById("saveManageBtn").addEventListener("click", () => {
      const status = document.getElementById("newStatus").value;
      const assignedTo = document.getElementById("assignTo").value.trim() || null;
      const note = document.getElementById("responseNote").value.trim() || `Status updated to ${util.titleCase(status)}.`;
      const list = all().map(x => x.id === id ? { ...x, status, assignedTo, timeline: [...x.timeline, { status, date: new Date().toISOString(), note }] } : x);
      save(list);
      modal.close();
      dataTable.refresh(mine());
      toast.show("success", "Complaint updated", `${id} has been updated.`);
    });
  }

  function openSubmitModal() {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Submit a Complaint</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Category</label>
          <select class="form-select mb-3" id="cmpCategory">${window.USIAMS.data.complaintCategories.map(c => `<option>${c}</option>`).join("")}</select>
          <label class="form-label">Send To</label>
          <select class="form-select mb-3" id="cmpRecipient">${window.USIAMS.data.complaintRecipientOffices.map(o => `<option>${o}</option>`).join("")}</select>
          <p class="text-muted-usi mb-3" style="font-size:.78rem;">Submitting here reaches the right office directly - there is no need to visit in person.</p>
          <label class="form-label">Priority</label>
          <select class="form-select mb-3" id="cmpPriority">${window.USIAMS.data.complaintPriorities.map(p => `<option>${p}</option>`).join("")}</select>
          <label class="form-label">Description</label>
          <textarea class="form-control mb-3" id="cmpDesc" rows="4" placeholder="Describe your complaint in detail..."></textarea>
          <label class="form-label">Attachment (optional)</label>
          <input type="file" class="form-control" id="cmpFile">
          <div id="cmpFormError" class="alert alert-danger mt-3 d-none"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="submitCmpBtn" style="background:var(--primary);border-color:var(--primary);">Submit Complaint</button></div>
      </div></div></div>
    `);
    document.getElementById("submitCmpBtn").addEventListener("click", async () => {
      const desc = document.getElementById("cmpDesc").value.trim();
      if (!desc) { document.getElementById("cmpFormError").textContent = "Please describe your complaint."; document.getElementById("cmpFormError").classList.remove("d-none"); return; }
      const file = document.getElementById("cmpFile").files[0];
      // The attachment itself is stored in the database; the complaint keeps its URL.
      let stored = null;
      if (file) {
        try { stored = await window.USIAMS.api.files.upload(file, "complaint"); }
        catch (error) { document.getElementById("cmpFormError").textContent = error.message; document.getElementById("cmpFormError").classList.remove("d-none"); return; }
      }
      const recipient = document.getElementById("cmpRecipient").value;
      const newCmp = {
        id: util.uid("CMP"), studentId: currentUser.studentId, category: document.getElementById("cmpCategory").value,
        priority: document.getElementById("cmpPriority").value, description: desc, attachment: file ? file.name : null,
        attachmentUrl: stored ? stored.url : null,
        status: "PENDING", assignedTo: recipient, createdAt: new Date().toISOString(),
        timeline: [{ status: "PENDING", date: new Date().toISOString(), note: `Complaint submitted by student, routed to ${recipient}.` }]
      };
      const list = all(); list.push(newCmp); save(list);
      modal.close();
      dataTable.refresh(mine());
      toast.show("success", "Complaint submitted", "Your complaint has been logged and will be reviewed.");
    });
  }

  function applyFilters() {
    const priority = document.getElementById("complaintPriorityFilter").value;
    const recipient = document.getElementById("complaintRecipientFilter").value;
    dataTable.setFilter(c => (!priority || c.priority === priority) && (!recipient || c.assignedTo === recipient));
  }

  function initPage(user) {
    currentUser = user;
    initTable();
    document.getElementById("submitComplaintBtn").addEventListener("click", openSubmitModal);
    document.getElementById("complaintSearchInput").addEventListener("input", util.debounce(() => dataTable.setSearch(document.getElementById("complaintSearchInput").value), 200));

    const recipientFilter = document.getElementById("complaintRecipientFilter");
    if (recipientFilter) {
      // Staff-only: students only ever see their own complaints, so
      // filtering by recipient office is a staff triage convenience.
      recipientFilter.classList.toggle("d-none", currentUser.role === "STUDENT");
      recipientFilter.innerHTML = `<option value="">All Offices</option>` + window.USIAMS.data.complaintRecipientOffices.map(o => `<option>${o}</option>`).join("");
      recipientFilter.addEventListener("change", applyFilters);
    }
    document.getElementById("complaintPriorityFilter").addEventListener("change", applyFilters);

    const params = new URLSearchParams(window.location.search);
    if (params.get("openComplaint")) openDetails(params.get("openComplaint"));
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.complaintsPage = { initPage };

})(window);
