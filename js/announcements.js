/* =========================================================
   USIAMS - js/announcements.js
   University-wide announcements: any signed-in user sees the
   ones addressed to "ALL" or their own role; University Admin/
   System Admin can publish new ones or retract old ones.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, toast, modal } = global.USIAMS;
  const overlay = global.USIAMS.storage.createOverlay("announcements", () => global.USIAMS.data.seedAnnouncements);
  const CAN_PUBLISH = ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"];
  let currentUser = null;

  function allAnnouncements() { return overlay.getAll(); }
  function visibleFor(role) { return allAnnouncements().filter(a => a.audience === "ALL" || a.audience === role); }
  function recent(role, limit = 3) {
    return visibleFor(role).sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate)).slice(0, limit);
  }
  function canPublish(user) { return CAN_PUBLISH.includes(user.role); }

  function publish(announcement) {
    overlay.add({ id: util.uid("ANN"), publishedDate: new Date().toISOString().slice(0, 10), ...announcement });
  }
  function retract(id) { overlay.remove(id); }

  function toneIcon() { return "bi-megaphone"; }

  function renderList(containerId, list, { showAudience = false, showActions = false } = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!list.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-megaphone"></i>No announcements yet.</div>`; return; }
    el.innerHTML = list.map(a => `
      <div class="d-flex gap-3 py-2 border-bottom">
        <div class="icon-tint-${a.tone}" style="width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi ${toneIcon()}"></i></div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <strong style="font-size:.85rem;">${util.escapeHtml(a.title)}</strong>
            <span class="text-muted-usi" style="font-size:.72rem;white-space:nowrap;">${util.formatDate(a.publishedDate)}</span>
          </div>
          <div class="text-muted-usi" style="font-size:.78rem;">${util.escapeHtml(a.body)}</div>
          ${showAudience ? `<span class="status-badge status-info mt-1" style="display:inline-flex;">${a.audience === "ALL" ? "Everyone" : util.titleCase(a.audience)}</span>` : ""}
          ${showActions ? `<button class="btn btn-sm btn-outline-danger write-action mt-2" data-write-action data-action="retract" data-id="${a.id}"><i class="bi bi-trash"></i> Retract</button>` : ""}
        </div>
      </div>`).join("");

    if (showActions) {
      el.querySelectorAll("[data-action='retract']").forEach(btn => btn.addEventListener("click", () => {
        if (!global.USIAMS.auth.guardWrite("retract this announcement")) return;
        retract(btn.dataset.id);
        render();
        toast.show("success", "Announcement retracted", "The announcement has been removed.");
      }));
    }
  }

  function openPublishModal() {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Publish Announcement</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Title</label>
          <input type="text" class="form-control mb-3" id="annTitleInput">
          <label class="form-label">Message</label>
          <textarea class="form-control mb-3" id="annBodyInput" rows="3"></textarea>
          <div class="row">
            <div class="col-6">
              <label class="form-label">Audience</label>
              <select class="form-select" id="annAudienceInput">
                <option value="ALL">Everyone</option>
                <option value="STUDENT">Students</option>
                <option value="LECTURER">Lecturers</option>
              </select>
            </div>
            <div class="col-6">
              <label class="form-label">Tone</label>
              <select class="form-select" id="annToneInput">
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="gold">Highlight</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="savePublishBtn" style="background:var(--primary);border-color:var(--primary);">Publish</button></div>
      </div></div></div>
    `);
    document.getElementById("savePublishBtn").addEventListener("click", () => {
      const title = document.getElementById("annTitleInput").value.trim();
      const body = document.getElementById("annBodyInput").value.trim();
      if (!title || !body) { toast.show("error", "Missing fields", "Please provide both a title and a message."); return; }
      publish({
        title, body,
        audience: document.getElementById("annAudienceInput").value,
        tone: document.getElementById("annToneInput").value,
        publishedBy: currentUser.id
      });
      modal.close();
      render();
      toast.show("success", "Announcement published", "It is now visible to its audience across the system.");
    });
  }

  function render() {
    // Publishers see everything (they manage the system), everyone
    // else sees only what's addressed to their role or to "ALL" -
    // same "don't show what you can't act on" principle as elsewhere.
    const isPublisher = canPublish(currentUser);
    const list = (isPublisher ? allAnnouncements() : visibleFor(currentUser.role))
      .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
    const publishBtn = document.getElementById("publishAnnouncementBtn");
    if (publishBtn) {
      publishBtn.classList.toggle("d-none", !isPublisher);
      publishBtn.onclick = openPublishModal;
    }
    renderList("announcementsPageList", list, { showAudience: true, showActions: isPublisher });
  }

  function initPage(user) {
    currentUser = user;
    render();
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.announcements = { allAnnouncements, visibleFor, recent, canPublish, renderList };
  global.USIAMS.announcementsPage = { initPage };

})(window);
