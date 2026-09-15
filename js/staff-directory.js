/* =========================================================
   USIAMS - js/staff-directory.js
   Read-only directory of academic staff (Lecturer, Academic
   Advisor, Head of Department), built from the existing user
   records - published system-wide so students and staff can
   look up who teaches/advises in each department.
   ========================================================= */
(function (global) {
  "use strict";

  const { util } = global.USIAMS;
  const ACADEMIC_STAFF_ROLES = ["LECTURER", "ACADEMIC_ADVISOR", "HEAD_OF_DEPARTMENT"];

  function academicStaff() {
    return global.USIAMS.data.users.filter(u => ACADEMIC_STAFF_ROLES.includes(u.role) && u.status === "Active");
  }

  function render() {
    const staff = academicStaff();
    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Academic Staff", value: staff.length, icon: "bi-person-badge", tint: "primary" },
      { label: "Departments Represented", value: new Set(staff.map(s => s.departmentId)).size, icon: "bi-diagram-3", tint: "info" },
      { label: "Lecturers", value: staff.filter(s => s.role === "LECTURER").length, icon: "bi-easel", tint: "success" },
      { label: "Heads of Department", value: staff.filter(s => s.role === "HEAD_OF_DEPARTMENT").length, icon: "bi-award", tint: "gold" }
    ]);

    const deptSelect = document.getElementById("staffDeptFilter");
    deptSelect.innerHTML = `<option value="">All Departments</option>` + global.USIAMS.data.departments.map(d => `<option value="${d.id}">${util.escapeHtml(d.name)}</option>`).join("");

    const dataTable = global.USIAMS.table.createDataTable({
      containerId: "staffDirectoryContainer",
      data: staff,
      pageSize: 12,
      searchKeys: ["name", "email"],
      columns: [
        { key: "name", label: "Name", sortable: true, render: s => `<div class="d-flex align-items-center gap-2"><div class="avatar-circle" style="background:${util.avatarColorFromString(s.name)};width:32px;height:32px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;">${util.escapeHtml(util.initials(s.name))}</div><strong>${util.escapeHtml(s.name)}</strong></div>` },
        { key: "role", label: "Role", sortable: true, render: s => util.escapeHtml(global.USIAMS.users.roleLabel(s.role)) },
        { key: "department", label: "Department", sortable: true, render: s => util.escapeHtml(global.USIAMS.academic.getDepartment(s.departmentId)?.name || "-") },
        { key: "college", label: "College / School / Institute", render: s => util.escapeHtml(global.USIAMS.academic.collegeNameForDepartment(s.departmentId)) },
        { key: "email", label: "Email", render: s => `<a href="mailto:${util.escapeHtml(s.email)}">${util.escapeHtml(s.email)}</a>` }
      ]
    });

    document.getElementById("staffSearchInput").addEventListener("input", util.debounce(() => dataTable.setSearch(document.getElementById("staffSearchInput").value), 200));
    deptSelect.addEventListener("change", () => dataTable.setFilter(s => !deptSelect.value || s.departmentId === deptSelect.value));
  }

  function initPage() { render(); }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.staffDirectoryPage = { initPage };

})(window);
