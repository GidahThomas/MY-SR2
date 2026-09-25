/* =========================================================
   USIAMS - js/administration.js
   Administration hub: Users, Roles & Permissions, Organisational
   Units, Academic Years/Semesters (linked from here), System
   Settings and Audit Logs.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, modal, table, toast } = window.USIAMS;
  const usersOverlay = window.USIAMS.storage.createOverlay("users", () => window.USIAMS.data.users);
  let dataTable = null;

  function renderUsersTab() {
    dataTable = table.createDataTable({
      containerId: "usersTableContainer",
      data: usersOverlay.getAll(),
      pageSize: 10,
      searchKeys: ["username", "name", "email"],
      emptyMessage: "No users found.",
      columns: [
        { key: "name", label: "Name", sortable: true, render: u => `<div class="d-flex align-items-center gap-2"><div class="avatar-circle" style="width:30px;height:30px;font-size:.68rem;background:${util.avatarColorFromString(u.name)}">${util.initials(u.name)}</div>${util.escapeHtml(u.name)}</div>` },
        { key: "username", label: "Username", sortable: true },
        { key: "email", label: "Email" },
        { key: "role", label: "Role", sortable: true, render: u => `<span class="badge text-bg-light border">${util.titleCase(u.role)}</span>` },
        { key: "status", label: "Status", sortable: true, render: u => `<span class="status-badge status-${u.status.toLowerCase()}">${u.status}</span>` },
        { key: "lastLogin", label: "Last Login", sortable: true, render: u => u.lastLogin ? util.formatDateTime(u.lastLogin) : "Never" }
      ],
      rowActions: u => `<div class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="toggle-status" data-id="${u.id}" title="${u.status === "Active" ? "Deactivate" : "Activate"}"><i class="bi ${u.status === "Active" ? "bi-person-dash" : "bi-person-check"}"></i></button>
      </div>`,
      afterRender: () => {
        document.querySelectorAll("#usersTableContainer [data-action='toggle-status']").forEach(b => b.addEventListener("click", () => toggleUserStatus(b.dataset.id)));
      }
    });
  }

  function toggleUserStatus(id) {
    if (!window.USIAMS.auth.guardWrite("change user account status")) return;
    const user = usersOverlay.getAll().find(u => u.id === id);
    const newStatus = user.status === "Active" ? "Inactive" : "Active";

    // The server refuses both of these outright; checking here means the
    // administrator gets told why before the row appears to change.
    if (newStatus !== "Active") {
      const signedIn = window.USIAMS.auth.getCurrentUser();
      if (signedIn && signedIn.id === id) {
        toast.show("error", "Not allowed", "You cannot deactivate the account you are signed in with.");
        return;
      }
      const ADMIN_ROLES = ["SYSTEM_ADMIN", "UNIVERSITY_ADMIN"];
      const otherActiveAdmins = usersOverlay.getAll()
        .filter(u => u.id !== id && u.status === "Active" && ADMIN_ROLES.includes(u.role));
      if (ADMIN_ROLES.includes(user.role) && !otherActiveAdmins.length) {
        toast.show("error", "Not allowed",
          "This is the last active administrator account. Grant another account an administrator role first.");
        return;
      }
    }
    usersOverlay.update(id, { status: newStatus });
    dataTable.refresh(usersOverlay.getAll());
    toast.show("success", "User status updated", `${user.name} is now ${newStatus}.`);
  }

  function renderRolesTab() {
    const roles = window.USIAMS.data.roles;
    const container = document.getElementById("rolesList");
    container.innerHTML = Object.entries(roles).map(([key, label]) => {
      const isReadOnly = key === "QUALITY_ASSURANCE_OFFICER";
      const count = window.USIAMS.data.users.filter(u => u.role === key).length;
      return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><strong style="font-size:.85rem;">${util.escapeHtml(label)}</strong><div class="text-muted-usi" style="font-size:.75rem;">${count} account(s)</div></div>
        <span class="status-badge ${isReadOnly ? "status-info" : "status-active"}">${isReadOnly ? "Read-Only" : "Full Access"}</span>
      </div>`;
    }).join("");
  }

  function renderSettingsTab() {
    const settings = window.USIAMS.storage.getStorage("systemSettings", { maintenanceMode: false, selfRegistration: false, emailNotifications: true });
    const container = document.getElementById("systemSettingsList");
    const items = [
      { key: "maintenanceMode", label: "Maintenance Mode", desc: "Temporarily restrict access for non-admin users." },
      { key: "selfRegistration", label: "Allow Self Registration", desc: "Let prospective students create their own accounts." },
      { key: "emailNotifications", label: "Email Notifications", desc: "Send email copies of in-app notifications." }
    ];
    container.innerHTML = items.map(i => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><strong style="font-size:.85rem;">${i.label}</strong><div class="text-muted-usi" style="font-size:.75rem;">${i.desc}</div></div>
        <div class="form-check form-switch">
          <input class="form-check-input write-action" data-write-action type="checkbox" role="switch" data-key="${i.key}" ${settings[i.key] ? "checked" : ""}>
        </div>
      </div>`).join("");

    container.querySelectorAll("input[type='checkbox']").forEach(cb => cb.addEventListener("change", () => {
      if (!window.USIAMS.auth.guardWrite("change system settings")) { cb.checked = !cb.checked; return; }
      const s = window.USIAMS.storage.getStorage("systemSettings", {});
      s[cb.dataset.key] = cb.checked;
      window.USIAMS.storage.setStorage("systemSettings", s);
      toast.show("success", "Setting updated", "System setting has been saved.");
    }));
  }

  function renderOrgSummaryTab() {
    document.getElementById("orgSummaryStats").innerHTML = [
      { label: "Colleges", value: window.USIAMS.data.orgUnits.filter(u => u.type === "College").length },
      { label: "Institutes", value: window.USIAMS.data.orgUnits.filter(u => u.type === "Institute").length },
      { label: "Schools", value: window.USIAMS.data.orgUnits.filter(u => u.type === "School").length },
      { label: "Departments", value: window.USIAMS.data.departments.length },
      { label: "Programmes", value: window.USIAMS.data.programmes.length },
      { label: "Academic Years", value: window.USIAMS.data.academicYears.length }
    ].map(s => `<div class="col-6 col-md-4 col-lg-2"><div class="usi-card p-3 text-center"><div class="stat-value" style="font-size:1.3rem;">${s.value}</div><div class="stat-label mb-0">${s.label}</div></div></div>`).join("");
  }

  function initPage(user) {
    renderUsersTab();
    renderRolesTab();
    renderSettingsTab();
    renderOrgSummaryTab();
    window.USIAMS.auditLogsModule.renderInto("auditLogsTableContainer", "auditFilterWrap");

    document.getElementById("userSearchInput").addEventListener("input", util.debounce(() => dataTable.setSearch(document.getElementById("userSearchInput").value), 200));
    document.getElementById("addUserBtn").addEventListener("click", () => openAddUserModal());
    if (window.USIAMS.auth.isReadOnlyRole(user.role)) document.getElementById("addUserBtn").remove();
  }

  function openAddUserModal() {
    if (!window.USIAMS.auth.guardWrite("add new users")) return;
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Add New User</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label">Full Name</label><input class="form-control" id="nuName"></div>
            <div class="col-md-6"><label class="form-label">Username</label><input class="form-control" id="nuUsername"></div>
            <div class="col-md-6"><label class="form-label">Email</label><input type="email" class="form-control" id="nuEmail"></div>
            <div class="col-md-6"><label class="form-label">Role</label>
              <select class="form-select" id="nuRole">${Object.entries(window.USIAMS.data.roles).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
            </div>
          </div>
          <div id="nuFormError" class="alert alert-danger mt-3 d-none"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveNewUserBtn" style="background:var(--primary);border-color:var(--primary);">Add User</button></div>
      </div></div></div>
    `);
    document.getElementById("saveNewUserBtn").addEventListener("click", () => {
      const name = document.getElementById("nuName").value.trim();
      const username = document.getElementById("nuUsername").value.trim();
      const email = document.getElementById("nuEmail").value.trim();
      const errorBox = document.getElementById("nuFormError");
      if (!name || !username || !util.validateEmail(email)) { errorBox.textContent = "Please complete all fields with a valid email address."; errorBox.classList.remove("d-none"); return; }
      if (usersOverlay.getAll().some(u => u.username === username)) { errorBox.textContent = "This username is already taken."; errorBox.classList.remove("d-none"); return; }
      const id = window.USIAMS.storage.nextId("USR", usersOverlay.getAll());
      usersOverlay.add({ id, name, username, email, role: document.getElementById("nuRole").value, password: "changeme123", status: "Active", lastLogin: null });
      modal.close();
      dataTable.refresh(usersOverlay.getAll());
      toast.show("success", "User added", `${name} has been added with a temporary password.`);
    });
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.administrationPage = { initPage };

})(window);
