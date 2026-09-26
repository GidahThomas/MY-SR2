/* =========================================================
   USIAMS - js/documents.js
   Document management page. File "uploads" only read the file
   name/size from the browser's file picker - nothing is actually
   transmitted anywhere in this prototype.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, modal, toast } = global.USIAMS;
  const KEY = "documents";
  let currentUser = null;

  function all() { return global.USIAMS.storage.ensureSeed(KEY, () => global.USIAMS.data.seedDocuments); }
  function save(list) { global.USIAMS.storage.setStorage(KEY, list); }

  function myDocuments() {
    if (currentUser.role === "STUDENT") return all().filter(d => d.studentId === currentUser.studentId);
    return all();
  }

  function render() {
    const docs = myDocuments();
    const container = document.getElementById("documentsList");
    if (!docs.length) { container.innerHTML = `<div class="empty-state"><i class="bi bi-folder-x"></i>No documents uploaded yet.</div>`; return; }
    container.innerHTML = `
      <div class="usi-table-wrap"><table class="usi-table">
        <thead><tr><th>Document</th><th>Type</th><th>Upload Date</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${docs.map(d => `
            <tr>
              <td><i class="bi bi-file-earmark-text me-2"></i>${util.escapeHtml(d.name)}</td>
              <td>${util.escapeHtml(d.type)}</td>
              <td>${util.formatDate(d.uploadDate)}</td>
              <td><span class="status-badge status-${d.status.toLowerCase()}">${d.status}</span></td>
              <td>
                <button class="btn btn-sm btn-outline-secondary" data-action="download" data-id="${d.id}"><i class="bi bi-download"></i></button>
                <button class="btn btn-sm btn-outline-danger write-action" data-write-action data-action="delete" data-id="${d.id}"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table></div>`;

    container.querySelectorAll("[data-action='download']").forEach(b => b.addEventListener("click", () => {
      const doc = all().find(d => d.id === b.dataset.id);
      const files = global.USIAMS.api.files;
      // Demo records from the seed data were never uploaded, so have no file.
      if (!doc || !files.isStored(doc.url)) { toast.show("info", "No file stored", "This record has no uploaded file."); return; }
      files.download(doc.url, doc.name).catch(error => toast.show("error", "Download failed", error.message));
    }));
    container.querySelectorAll("[data-action='delete']").forEach(b => b.addEventListener("click", () => {
      if (!global.USIAMS.auth.guardWrite("delete documents")) return;
      save(all().filter(d => d.id !== b.dataset.id));
      render();
      toast.show("success", "Document removed", "The document has been deleted.");
    }));
  }

  function openUploadModal() {
    if (!global.USIAMS.auth.guardWrite("upload documents")) return;
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Upload Document</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Document Type</label>
          <select class="form-select mb-3" id="docType">${global.USIAMS.data.documentTypes.map(t => `<option>${t}</option>`).join("")}</select>
          <label class="form-label">Choose File</label>
          <div class="dropzone" id="dropzone"><i class="bi bi-cloud-arrow-up fs-2 d-block mb-2"></i>Click to select a file<input type="file" id="fileInput" class="d-none"></div>
          <div class="mt-2 text-muted-usi" style="font-size:.8rem;" id="fileNamePreview"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="uploadSaveBtn" style="background:var(--primary);border-color:var(--primary);">Upload</button></div>
      </div></div></div>
    `);
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      document.getElementById("fileNamePreview").textContent = fileInput.files[0] ? `Selected: ${fileInput.files[0].name}` : "";
    });
    document.getElementById("uploadSaveBtn").addEventListener("click", async () => {
      const file = fileInput.files[0];
      if (!file) { toast.show("error", "No file selected", "Please choose a file to upload."); return; }
      const btn = document.getElementById("uploadSaveBtn");
      btn.disabled = true;
      let stored;
      try {
        // The file itself goes into the database; the document row keeps its URL.
        stored = await global.USIAMS.api.files.upload(file, "document");
      } catch (error) {
        btn.disabled = false;
        toast.show("error", "Upload failed", error.message);
        return;
      }
      const list = all();
      list.push({
        id: util.uid("DOC"), studentId: currentUser.studentId || "STU-0001",
        name: file.name, type: document.getElementById("docType").value, url: stored.url,
        uploadDate: new Date().toISOString().slice(0, 10), status: "Pending"
      });
      save(list);
      modal.close();
      render();
      toast.show("success", "Document uploaded", "Your document has been saved and submitted for verification.");
    });
  }

  function initPage(user) {
    currentUser = user;
    render();
    if (!global.USIAMS.auth.isReadOnlyRole(user.role)) document.getElementById("uploadDocBtn").addEventListener("click", openUploadModal);
    else document.getElementById("uploadDocBtn").remove();
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.documentsPage = { initPage };

})(window);
