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

  // Admins below university level manage accounts only in their own
  // department or unit, and only these roles. Mirrors SCOPED_ACCOUNT_MANAGERS
  // in server.js, which enforces it; this copy only shapes the page.
  const SCOPED_MANAGERS = {
    DEPARTMENT_ADMIN: { scope: "department", roles: ["LECTURER", "ACADEMIC_ADVISOR"] },
    HEAD_OF_DEPARTMENT: { scope: "department", roles: ["LECTURER", "ACADEMIC_ADVISOR"] },
    COLLEGE_ADMIN: { scope: "unit", roles: ["LECTURER", "ACADEMIC_ADVISOR", "HEAD_OF_DEPARTMENT", "DEPARTMENT_ADMIN"] },
    INSTITUTE_ADMIN: { scope: "unit", roles: ["LECTURER", "ACADEMIC_ADVISOR", "HEAD_OF_DEPARTMENT", "DEPARTMENT_ADMIN"] },
    SCHOOL_ADMIN: { scope: "unit", roles: ["LECTURER", "ACADEMIC_ADVISOR", "HEAD_OF_DEPARTMENT", "DEPARTMENT_ADMIN"] }
  };

  function scopeRule() {
    const me = window.USIAMS.auth.getCurrentUser() || {};
    return SCOPED_MANAGERS[me.role] || null;
  }

  /** Departments the signed-in admin may place accounts in (all, for full admins). */
  function allowedDepartments() {
    const rule = scopeRule();
    const departments = window.USIAMS.data.departments;
    if (!rule) return departments;
    const me = window.USIAMS.auth.getCurrentUser();
    return rule.scope === "department"
      ? departments.filter(d => d.id === me.departmentId)
      : departments.filter(d => d.unitId === me.unitId);
  }

  /** The accounts this admin can see and manage on the Users tab. */
  function visibleUsers() {
    const rule = scopeRule();
    const all = usersOverlay.getAll();
    if (!rule) return all;
    const departmentIds = allowedDepartments().map(d => d.id);
    return all.filter(u => rule.roles.includes(u.role) && departmentIds.includes(u.departmentId));
  }

  /** visibleUsers() narrowed by the Role and Status dropdowns above the table. */
  function filteredUsers() {
    const role = (document.getElementById("userRoleFilter") || {}).value || "";
    const status = (document.getElementById("userStatusFilter") || {}).value || "";
    return visibleUsers().filter(u => (!role || u.role === role) && (!status || u.status === status));
  }

  // Fills the Role dropdown with the roles this admin can see, each with a
  // count, keeping the current choice.
  function renderRoleFilter() {
    const select = document.getElementById("userRoleFilter");
    if (!select) return;
    const current = select.value;
    const rule = scopeRule();
    const users = visibleUsers();
    const roleIds = Object.keys(window.USIAMS.data.roles).filter(r => !rule || rule.roles.includes(r));
    select.innerHTML = `<option value="">All roles (${users.length})</option>` + roleIds.map(r =>
      `<option value="${r}">${util.escapeHtml(window.USIAMS.data.roles[r])} (${users.filter(u => u.role === r).length})</option>`).join("");
    select.value = roleIds.includes(current) ? current : "";
  }

  function refreshUsers() {
    renderRoleFilter();
    dataTable.refresh(filteredUsers());
  }

  function renderUsersTab() {
    dataTable = table.createDataTable({
      containerId: "usersTableContainer",
      data: filteredUsers(),
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
      rowActions: u => u.status === "Pending"
        ? `<div class="d-flex gap-1">
        <button class="btn btn-sm btn-success write-action" data-write-action data-action="approve" data-id="${u.id}" title="Approve account request"><i class="bi bi-check-lg"></i></button>
        <button class="btn btn-sm btn-outline-danger write-action" data-write-action data-action="reject" data-id="${u.id}" title="Reject account request"><i class="bi bi-x-lg"></i></button>
      </div>`
        : `<div class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="toggle-status" data-id="${u.id}" title="${u.status === "Active" ? "Deactivate" : "Activate"}"><i class="bi ${u.status === "Active" ? "bi-person-dash" : "bi-person-check"}"></i></button>
      </div>`,
      afterRender: () => {
        document.querySelectorAll("#usersTableContainer [data-action='toggle-status']").forEach(b => b.addEventListener("click", () => toggleUserStatus(b.dataset.id)));
        document.querySelectorAll("#usersTableContainer [data-action='approve']").forEach(b => b.addEventListener("click", () => decideRequest(b.dataset.id, true)));
        document.querySelectorAll("#usersTableContainer [data-action='reject']").forEach(b => b.addEventListener("click", () => decideRequest(b.dataset.id, false)));
      }
    });
    renderPendingNotice();
  }

  // Staff who registered themselves on the login page wait here as Pending
  // until an administrator approves (Active) or rejects (Inactive) them.
  function renderPendingNotice() {
    const pending = visibleUsers().filter(u => u.status === "Pending");
    let notice = document.getElementById("pendingAccountsNotice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "pendingAccountsNotice";
      notice.className = "alert alert-warning d-flex align-items-center gap-2";
      notice.setAttribute("role", "status");
      document.getElementById("usersTableContainer").before(notice);
    }
    notice.classList.toggle("d-none", !pending.length);
    notice.innerHTML = `<i class="bi bi-hourglass-split"></i><span><strong>${pending.length} account request${pending.length === 1 ? "" : "s"}</strong> awaiting approval: ${pending.map(u => `${util.escapeHtml(u.name)} (${util.escapeHtml(window.USIAMS.data.roles[u.role] || u.role)})`).join(", ")}.</span>`;
  }

  function decideRequest(id, approve) {
    if (!window.USIAMS.auth.guardWrite(approve ? "approve account requests" : "reject account requests")) return;
    const user = usersOverlay.getAll().find(u => u.id === id);
    usersOverlay.update(id, { status: approve ? "Active" : "Inactive" });
    refreshUsers();
    renderPendingNotice();
    renderRolesTab();
    toast.show(approve ? "success" : "info",
      approve ? "Account approved" : "Account request rejected",
      approve ? `${user.name} can now sign in as ${window.USIAMS.data.roles[user.role] || user.role}.`
        : `${user.name}'s request was rejected; the account stays disabled.`);
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
    refreshUsers();
    toast.show("success", "User status updated", `${user.name} is now ${newStatus}.`);
  }

  function renderRolesTab() {
    const roles = window.USIAMS.data.roles;
    const container = document.getElementById("rolesList");
    if (!container) return; // not shown to scoped admins
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
    const rule = scopeRule();
    if (rule) {
      // Scoped admins only manage users; the university-wide tabs are not theirs.
      document.querySelectorAll(".nav-tabs .nav-item").forEach((item, index) => { if (index > 0) item.remove(); });
      ["tabRoles", "tabOrg", "tabSettings", "tabAudit"].forEach(id => document.getElementById(id).remove());
      const place = rule.scope === "department"
        ? (window.USIAMS.academic.getDepartment(user.departmentId) || {}).name || "your department"
        : ((window.USIAMS.data.orgUnits.find(u => u.id === user.unitId) || {}).name || "your unit");
      document.querySelector(".page-header h1").textContent = "User Management";
      document.querySelector(".page-header p").textContent =
        `Add and manage ${rule.roles.map(r => window.USIAMS.data.roles[r]).join(", ")} accounts in ${place}.`;
    } else {
      renderRolesTab();
      renderSettingsTab();
      renderOrgSummaryTab();
      window.USIAMS.auditLogsModule.renderInto("auditLogsTableContainer", "auditFilterWrap");
    }

    document.getElementById("userSearchInput").addEventListener("input", util.debounce(() => dataTable.setSearch(document.getElementById("userSearchInput").value), 200));
    renderRoleFilter();
    ["userRoleFilter", "userStatusFilter"].forEach(id => document.getElementById(id).addEventListener("change", () => dataTable.refresh(filteredUsers())));
    // Add User starts on the role being viewed, when that role can be assigned.
    document.getElementById("addUserBtn").addEventListener("click", () => openAddUserModal(document.getElementById("userRoleFilter").value));
    if (window.USIAMS.auth.isReadOnlyRole(user.role)) document.getElementById("addUserBtn").remove();
  }

  // Roles whose data is scoped to one department, and admin roles scoped to
  // one organisational unit of a given type. The form asks for the matching
  // scope so the new account does not land in an empty workspace.
  const DEPARTMENT_ROLES = ["LECTURER", "ACADEMIC_ADVISOR", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT"];
  const UNIT_ROLES = { COLLEGE_ADMIN: "College", INSTITUTE_ADMIN: "Institute", SCHOOL_ADMIN: "School" };

  // A student account is tied to its student record by email, so students
  // are created through admissions and registration rather than here.
  const NON_ASSIGNABLE_ROLES = ["STUDENT"];

  function temporaryPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = new Uint32Array(10);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
  }

  function openAddUserModal(presetRole) {
    if (!window.USIAMS.auth.guardWrite("add new users")) return;
    const rule = scopeRule();
    const roleOptions = Object.entries(window.USIAMS.data.roles)
      .filter(([k]) => !NON_ASSIGNABLE_ROLES.includes(k) && (!rule || rule.roles.includes(k)))
      .map(([k, v]) => `<option value="${k}">${util.escapeHtml(v)}</option>`).join("");
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Add New User</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12"><label class="form-label" for="nuRole">Role</label>
              <select class="form-select" id="nuRole"><option value="">Select a role...</option>${roleOptions}</select>
              <div class="form-text">Student accounts are created through admissions and registration.</div>
            </div>
            <div class="col-12 d-none" id="nuScopeWrap"><label class="form-label" for="nuScope" id="nuScopeLabel"></label>
              <select class="form-select" id="nuScope"></select>
            </div>
            <div class="col-md-6"><label class="form-label" for="nuName">Full Name</label><input class="form-control" id="nuName"></div>
            <div class="col-md-6"><label class="form-label" for="nuUsername">Username</label><input class="form-control" id="nuUsername" autocomplete="off"></div>
            <div class="col-md-6"><label class="form-label" for="nuEmail">Email</label><input type="email" class="form-control" id="nuEmail"></div>
            <div class="col-md-6"><label class="form-label" for="nuPassword">Temporary Password</label>
              <div class="input-group">
                <input class="form-control" id="nuPassword" value="${temporaryPassword()}" autocomplete="off">
                <button class="btn btn-outline-secondary" type="button" id="nuRegenPassword" title="Generate another"><i class="bi bi-arrow-repeat"></i></button>
              </div>
              <div class="form-text">Share this with the user; at least 8 characters.</div>
            </div>
          </div>
          <div id="nuFormError" class="alert alert-danger mt-3 d-none"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveNewUserBtn" style="background:var(--primary);border-color:var(--primary);">Add User</button></div>
      </div></div></div>
    `);

    const roleSelect = document.getElementById("nuRole");
    if (presetRole && [...roleSelect.options].some(o => o.value === presetRole)) {
      roleSelect.value = presetRole;
      // Run the change handler below once it is attached.
      setTimeout(() => roleSelect.dispatchEvent(new Event("change")));
    }
    const scopeWrap = document.getElementById("nuScopeWrap");
    const scopeSelect = document.getElementById("nuScope");
    const scopeLabel = document.getElementById("nuScopeLabel");

    roleSelect.addEventListener("change", () => {
      const role = roleSelect.value;
      let options = null;
      if (DEPARTMENT_ROLES.includes(role)) {
        scopeLabel.textContent = "Department";
        options = allowedDepartments();
      } else if (UNIT_ROLES[role]) {
        scopeLabel.textContent = UNIT_ROLES[role];
        options = window.USIAMS.data.orgUnits.filter(u => u.type === UNIT_ROLES[role]);
      }
      scopeWrap.classList.toggle("d-none", !options);
      scopeSelect.innerHTML = options
        ? `<option value="">Select ${scopeLabel.textContent.toLowerCase()}...</option>` +
          options.map(o => `<option value="${util.escapeHtml(o.id)}">${util.escapeHtml(o.name)}</option>`).join("")
        : "";
    });
    document.getElementById("nuRegenPassword").addEventListener("click", () => {
      document.getElementById("nuPassword").value = temporaryPassword();
    });

    document.getElementById("saveNewUserBtn").addEventListener("click", () => {
      const role = roleSelect.value;
      const scope = scopeSelect.value;
      const name = document.getElementById("nuName").value.trim();
      const username = document.getElementById("nuUsername").value.trim();
      const email = document.getElementById("nuEmail").value.trim();
      const password = document.getElementById("nuPassword").value.trim();
      const errorBox = document.getElementById("nuFormError");
      const fail = message => { errorBox.textContent = message; errorBox.classList.remove("d-none"); };
      const existing = usersOverlay.getAll();
      errorBox.classList.add("d-none");

      if (!role) return fail("Please select a role for this user.");
      if (!scopeWrap.classList.contains("d-none") && !scope) return fail(`Please select a ${scopeLabel.textContent.toLowerCase()} for this role.`);
      if (!name || !username || !util.validateEmail(email)) return fail("Please complete all fields with a valid email address.");
      if (password.length < 8) return fail("The temporary password must be at least 8 characters.");
      if (existing.some(u => u.username.toLowerCase() === username.toLowerCase())) return fail("This username is already taken.");
      if (existing.some(u => (u.email || "").toLowerCase() === email.toLowerCase())) return fail("Another account already uses this email address.");

      const id = window.USIAMS.storage.nextId("USR", existing);
      const record = { id, name, username, email, role, password, status: "Active", lastLogin: null };
      if (DEPARTMENT_ROLES.includes(role)) record.departmentId = scope;
      if (UNIT_ROLES[role]) record.unitId = scope;
      usersOverlay.add(record);
      modal.close();
      refreshUsers();
      renderRolesTab();
      toast.show("success", "User added",
        `${name} was added as ${window.USIAMS.data.roles[role]}. Username: ${username}, temporary password: ${password}`, 15000);
    });
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.administrationPage = { initPage };

})(window);
