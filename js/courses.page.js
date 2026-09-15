/* =========================================================
   USIAMS - js/courses.page.js
   Course Management page logic. (Named courses.page.js to avoid
   clashing with data/courses.js's USIAMS.courses namespace -
   this file exposes USIAMS.coursesPage instead.)
   ========================================================= */
(function (global) {
  "use strict";

  const { util, modal, table, toast, academic } = global.USIAMS;
  const overlay = global.USIAMS.storage.createOverlay("courses", () => global.USIAMS.data.courses);
  let dataTable = null;
  let currentUser = null;

  function getCourses() { return overlay.getAll(); }
  function canWrite() { return !global.USIAMS.auth.isReadOnlyRole(currentUser.role) && !["STUDENT", "LECTURER"].includes(currentUser.role); }

  function renderFilters() {
    document.getElementById("filterDept").innerHTML = `<option value="">All Departments</option>` +
      global.USIAMS.data.departments.map(d => `<option value="${d.id}">${util.escapeHtml(d.name)}</option>`).join("");
  }

  function applyFilters() {
    const search = document.getElementById("courseSearchInput").value.toLowerCase();
    const dept = document.getElementById("filterDept").value;
    const type = document.getElementById("filterType").value;
    const sem = document.getElementById("filterSemester").value;
    dataTable.setFilter(c =>
      (!dept || c.departmentId === dept) &&
      (!type || c.type === type) &&
      (!sem || String(c.semesterNumber) === sem) &&
      (!search || c.id.toLowerCase().includes(search) || c.title.toLowerCase().includes(search))
    );
  }

  function rowActions(course) {
    const writeButtons = canWrite() ? `
      <button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="edit" data-id="${course.id}"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-outline-danger write-action" data-write-action data-action="delete" data-id="${course.id}"><i class="bi bi-trash"></i></button>` : "";
    return `<div class="d-flex gap-1">
      <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${course.id}"><i class="bi bi-eye"></i></button>${writeButtons}</div>`;
  }

  function initTable() {
    dataTable = table.createDataTable({
      containerId: "coursesTableContainer",
      data: getCourses(),
      pageSize: 10,
      searchKeys: ["id", "title"],
      emptyMessage: "No courses match your filters.",
      columns: [
        { key: "id", label: "Code", sortable: true },
        { key: "title", label: "Title", sortable: true },
        { key: "credits", label: "Credits", sortable: true },
        { key: "type", label: "Type", sortable: true, render: c => `<span class="status-badge ${c.type === "Core" ? "status-active" : "status-info"}">${c.type}</span>` },
        { key: "departmentId", label: "Department", render: c => util.escapeHtml(academic.getDepartment(c.departmentId)?.name || "-") },
        { key: "semesterNumber", label: "Semester", sortable: true, render: c => `Year ${c.year} - Sem ${c.semesterNumber}` },
        { key: "status", label: "Status", sortable: true, render: c => `<span class="status-badge ${c.status === "Active" ? "status-active" : "status-inactive"}">${c.status}</span>` }
      ],
      rowActions,
      afterRender: () => wireRowActions()
    });
  }

  function wireRowActions() {
    document.querySelectorAll("#coursesTableContainer [data-action='view']").forEach(b => b.addEventListener("click", () => openCourseDetails(b.dataset.id)));
    document.querySelectorAll("#coursesTableContainer [data-action='edit']").forEach(b => b.addEventListener("click", () => openCourseForm(b.dataset.id)));
    document.querySelectorAll("#coursesTableContainer [data-action='delete']").forEach(b => b.addEventListener("click", () => confirmDelete(b.dataset.id)));
  }

  function confirmDelete(id) {
    if (!global.USIAMS.auth.guardWrite("delete courses")) return;
    const course = getCourses().find(c => c.id === id);
    modal.confirm({
      title: "Delete Course", message: `Delete <strong>${id} - ${util.escapeHtml(course.title)}</strong>? Students already registered will keep their historical records.`,
      confirmText: "Delete", variant: "danger",
      onConfirm: () => { overlay.remove(id); dataTable.refresh(getCourses()); toast.show("success", "Course deleted", `${id} has been removed from the catalogue.`); }
    });
  }

  function openCourseDetails(id) {
    const course = getCourses().find(c => c.id === id);
    const prereqs = course.prerequisites.map(p => global.USIAMS.courses.getCourse(p)).filter(Boolean);
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">${course.id} - ${util.escapeHtml(course.title)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <dl class="kv-list row">
            <div class="col-6"><dt>Credits</dt><dd>${course.credits}</dd></div>
            <div class="col-6"><dt>Type</dt><dd>${course.type}</dd></div>
            <div class="col-6"><dt>Department</dt><dd>${util.escapeHtml(academic.getDepartment(course.departmentId)?.name)}</dd></div>
            <div class="col-6"><dt>Year / Semester</dt><dd>Year ${course.year}, Semester ${course.semesterNumber}</dd></div>
            <div class="col-12"><dt>Offered To Programmes</dt><dd>${course.programmeIds.map(p => academic.getProgramme(p)?.code).join(", ")}</dd></div>
            <div class="col-12"><dt>Prerequisites</dt><dd>${prereqs.length ? prereqs.map(p => `${p.id} - ${util.escapeHtml(p.title)}`).join("<br>") : "None"}</dd></div>
          </dl>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div></div>
    `);
  }

  function openCourseForm(id) {
    if (!global.USIAMS.auth.guardWrite("add or edit courses")) return;
    const editing = id ? getCourses().find(c => c.id === id) : null;
    const deptOptions = global.USIAMS.data.departments.map(d => `<option value="${d.id}" ${editing?.departmentId === d.id ? "selected" : ""}>${util.escapeHtml(d.name)}</option>`).join("");
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">${editing ? "Edit Course" : "Add New Course"}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <form id="courseForm">
            <div class="row g-3">
              <div class="col-md-4"><label class="form-label">Course Code</label><input class="form-control" id="cfCode" value="${editing ? editing.id : ""}" ${editing ? "disabled" : ""} placeholder="e.g. CP106"></div>
              <div class="col-md-8"><label class="form-label">Course Title</label><input class="form-control" id="cfTitle" value="${editing ? util.escapeHtml(editing.title) : ""}"></div>
              <div class="col-md-4"><label class="form-label">Credits</label><input type="number" min="1" max="6" class="form-control" id="cfCredits" value="${editing ? editing.credits : 3}"></div>
              <div class="col-md-4"><label class="form-label">Type</label><select class="form-select" id="cfType"><option ${editing?.type === "Core" ? "selected" : ""}>Core</option><option ${editing?.type === "Elective" ? "selected" : ""}>Elective</option></select></div>
              <div class="col-md-4"><label class="form-label">Status</label><select class="form-select" id="cfStatus"><option ${editing?.status === "Active" ? "selected" : ""}>Active</option><option ${editing?.status === "Retired" ? "selected" : ""}>Retired</option></select></div>
              <div class="col-md-6"><label class="form-label">Department</label><select class="form-select" id="cfDept">${deptOptions}</select></div>
              <div class="col-md-3"><label class="form-label">Year</label><select class="form-select" id="cfYear">${[1,2,3,4].map(y=>`<option value="${y}" ${editing?.year===y?"selected":""}>${y}</option>`).join("")}</select></div>
              <div class="col-md-3"><label class="form-label">Semester</label><select class="form-select" id="cfSem">${[1,2].map(s=>`<option value="${s}" ${editing?.semesterNumber===s?"selected":""}>${s}</option>`).join("")}</select></div>
            </div>
            <div id="courseFormError" class="alert alert-danger mt-3 d-none"></div>
          </form>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveCourseBtn" style="background:var(--primary);border-color:var(--primary);">Save Course</button></div>
      </div></div></div>
    `);
    document.getElementById("saveCourseBtn").addEventListener("click", () => saveCourseForm(editing));
  }

  function saveCourseForm(editing) {
    const code = document.getElementById("cfCode").value.trim().toUpperCase();
    const title = document.getElementById("cfTitle").value.trim();
    const errorBox = document.getElementById("courseFormError");
    const errors = [];
    if (!code || !title) errors.push("Course code and title are required.");
    if (!editing && getCourses().some(c => c.id === code)) errors.push("A course with this code already exists.");
    if (errors.length) { errorBox.innerHTML = errors.join("<br>"); errorBox.classList.remove("d-none"); return; }

    const payload = {
      title, credits: parseInt(document.getElementById("cfCredits").value, 10),
      type: document.getElementById("cfType").value, status: document.getElementById("cfStatus").value,
      departmentId: document.getElementById("cfDept").value,
      year: parseInt(document.getElementById("cfYear").value, 10), semesterNumber: parseInt(document.getElementById("cfSem").value, 10)
    };
    if (editing) { overlay.update(editing.id, payload); toast.show("success", "Course updated", `${editing.id} has been updated.`); }
    else { overlay.add({ id: code, prerequisites: [], programmeIds: [], ...payload }); toast.show("success", "Course added", `${code} has been added to the catalogue.`); }
    modal.close();
    dataTable.refresh(getCourses());
  }

  function exportCsv() {
    util.downloadCsv("courses-export", getCourses().map(c => ({
      Code: c.id, Title: c.title, Credits: c.credits, Type: c.type,
      Department: academic.getDepartment(c.departmentId)?.name, Year: c.year, Semester: c.semesterNumber, Status: c.status
    })));
  }

  function initPage(user) {
    currentUser = user;
    renderFilters();
    initTable();
    document.getElementById("courseSearchInput").addEventListener("input", util.debounce(applyFilters, 200));
    document.getElementById("filterDept").addEventListener("change", applyFilters);
    document.getElementById("filterType").addEventListener("change", applyFilters);
    document.getElementById("filterSemester").addEventListener("change", applyFilters);
    document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
    if (canWrite()) document.getElementById("addCourseBtn").addEventListener("click", () => openCourseForm(null));
    else document.getElementById("addCourseBtn").remove();

    const params = new URLSearchParams(window.location.search);
    if (params.get("openCourse")) openCourseDetails(params.get("openCourse"));
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.coursesPage = { initPage };

})(window);
