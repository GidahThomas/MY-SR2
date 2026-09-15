/* =========================================================
   USIAMS - js/students.js
   Student Management page: searchable/filterable/paginated
   table, Add/Edit/Delete (layered over the generated dataset via
   USIAMS.storage.createOverlay), CSV export and the full student
   profile modal.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, modal, table, toast, academic } = global.USIAMS;
  let dataTable = null;
  let currentUser = null;

  function getStudents() { return global.USIAMS.students.allStudents(); }

  function canWrite() {
    return !global.USIAMS.auth.isReadOnlyRole(currentUser.role) && currentUser.role !== "STUDENT";
  }

  function programmeName(id) { return academic.getProgramme(id)?.name || "-"; }
  function collegeName(deptId) { return academic.collegeNameForDepartment(deptId); }

  function renderFilters() {
    const progSelect = document.getElementById("filterProgramme");
    progSelect.innerHTML = `<option value="">All Programmes</option>` + global.USIAMS.data.programmes.map(p => `<option value="${p.id}">${util.escapeHtml(p.name)}</option>`).join("");
  }

  function applyFilters() {
    const search = document.getElementById("studentSearchInput").value.toLowerCase();
    const programme = document.getElementById("filterProgramme").value;
    const status = document.getElementById("filterStatus").value;
    const year = document.getElementById("filterYear").value;
    dataTable.setFilter(s =>
      (!programme || s.programmeId === programme) &&
      (!status || s.status === status) &&
      (!year || String(s.year) === year) &&
      (!search || s.fullName.toLowerCase().includes(search) || s.regNumber.toLowerCase().includes(search) || s.email.toLowerCase().includes(search))
    );
  }

  function rowActions(student) {
    const writeButtons = canWrite() ? `
      <button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="edit" data-id="${student.id}" title="Edit"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-outline-danger write-action" data-write-action data-action="delete" data-id="${student.id}" title="Delete"><i class="bi bi-trash"></i></button>
    ` : "";
    return `
      <div class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${student.id}" title="View Profile"><i class="bi bi-eye"></i></button>
        ${writeButtons}
      </div>`;
  }

  function initTable() {
    dataTable = table.createDataTable({
      containerId: "studentsTableContainer",
      data: getStudents(),
      pageSize: 10,
      searchKeys: ["fullName", "regNumber", "email"],
      emptyMessage: "No students match your filters.",
      columns: [
        { key: "photo", label: "Photo", render: s => `<div class="avatar-circle" style="background:${util.avatarColorFromString(s.fullName)}">${util.initials(s.fullName)}</div>` },
        { key: "regNumber", label: "Reg. Number", sortable: true },
        { key: "fullName", label: "Full Name", sortable: true },
        { key: "gender", label: "Gender", sortable: true },
        { key: "programmeId", label: "Programme", sortable: true, render: s => util.escapeHtml(programmeName(s.programmeId)) },
        { key: "year", label: "Year", sortable: true },
        { key: "status", label: "Status", sortable: true, render: s => `<span class="status-badge status-${s.status.toLowerCase().replace(/\s+/g, "_")}">${util.escapeHtml(s.status)}</span>` }
      ],
      rowActions,
      afterRender: () => wireRowActions()
    });
  }

  function wireRowActions() {
    document.querySelectorAll("#studentsTableContainer [data-action='view']").forEach(btn => btn.addEventListener("click", () => openProfile(btn.dataset.id)));
    document.querySelectorAll("#studentsTableContainer [data-action='edit']").forEach(btn => btn.addEventListener("click", () => openStudentForm(btn.dataset.id)));
    document.querySelectorAll("#studentsTableContainer [data-action='delete']").forEach(btn => btn.addEventListener("click", () => confirmDelete(btn.dataset.id)));
  }

  function confirmDelete(id) {
    if (!global.USIAMS.auth.guardWrite("delete student records")) return;
    const student = getStudents().find(s => s.id === id);
    modal.confirm({
      title: "Delete Student Record",
      message: `Are you sure you want to delete <strong>${util.escapeHtml(student.fullName)}</strong> (${student.regNumber})? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: () => {
        global.USIAMS.students.removeStudent(id);
        dataTable.refresh(getStudents());
        toast.show("success", "Student deleted", `${student.fullName}'s record has been removed.`);
      }
    });
  }

  // ---- Add / Edit form modal -------------------------------------------
  function openStudentForm(id) {
    if (!global.USIAMS.auth.guardWrite("add or edit student records")) return;
    const editing = id ? getStudents().find(s => s.id === id) : null;
    const progOptions = global.USIAMS.data.programmes.map(p => `<option value="${p.id}" ${editing?.programmeId === p.id ? "selected" : ""}>${util.escapeHtml(p.name)}</option>`).join("");

    modal.renderInto(`
      <div class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${editing ? "Edit Student" : "Add New Student"}</h5>
              <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="studentForm" novalidate>
                <div class="row g-3">
                  <div class="col-md-6"><label class="form-label">First Name</label><input class="form-control" id="sfFirstName" value="${editing ? util.escapeHtml(editing.firstName) : ""}" required></div>
                  <div class="col-md-6"><label class="form-label">Last Name</label><input class="form-control" id="sfLastName" value="${editing ? util.escapeHtml(editing.lastName) : ""}" required></div>
                  <div class="col-md-6"><label class="form-label">Gender</label>
                    <select class="form-select" id="sfGender">
                      <option ${editing?.gender === "Male" ? "selected" : ""}>Male</option>
                      <option ${editing?.gender === "Female" ? "selected" : ""}>Female</option>
                    </select>
                  </div>
                  <div class="col-md-6"><label class="form-label">Programme</label><select class="form-select" id="sfProgramme">${progOptions}</select></div>
                  <div class="col-md-6"><label class="form-label">Year of Study</label>
                    <select class="form-select" id="sfYear">
                      ${[1, 2, 3, 4].map(y => `<option value="${y}" ${editing?.year === y ? "selected" : ""}>${y}</option>`).join("")}
                    </select>
                  </div>
                  <div class="col-md-6"><label class="form-label">Status</label>
                    <select class="form-select" id="sfStatus">
                      ${["Active", "On Leave", "Suspended", "Graduated"].map(s => `<option ${editing?.status === s ? "selected" : ""}>${s}</option>`).join("")}
                    </select>
                  </div>
                  <div class="col-md-6"><label class="form-label">Email</label><input type="email" class="form-control" id="sfEmail" value="${editing ? util.escapeHtml(editing.email) : ""}" required></div>
                  <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" id="sfPhone" placeholder="+2557XXXXXXXX" value="${editing ? util.escapeHtml(editing.phone) : ""}" required></div>
                  <div class="col-12"><label class="form-label">Address</label><input class="form-control" id="sfAddress" value="${editing ? util.escapeHtml(editing.address) : ""}"></div>
                </div>
                <div id="studentFormError" class="alert alert-danger mt-3 d-none"></div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary" id="saveStudentBtn" style="background:var(--primary);border-color:var(--primary);">Save Student</button>
            </div>
          </div>
        </div>
      </div>
    `);

    document.getElementById("saveStudentBtn").addEventListener("click", () => saveStudentForm(editing));
  }

  function saveStudentForm(editing) {
    const firstName = document.getElementById("sfFirstName").value.trim();
    const lastName = document.getElementById("sfLastName").value.trim();
    const email = document.getElementById("sfEmail").value.trim();
    const phone = document.getElementById("sfPhone").value.trim();
    const errorBox = document.getElementById("studentFormError");
    const errors = [];

    if (!firstName || !lastName) errors.push("First and last name are required.");
    if (!util.validateEmail(email)) errors.push("Please enter a valid email address.");
    if (!util.validatePhone(phone)) errors.push("Please enter a valid Tanzanian phone number (e.g. +255712345678).");
    const duplicate = getStudents().find(s => s.email.toLowerCase() === email.toLowerCase() && s.id !== editing?.id);
    if (duplicate) errors.push("A student with this email already exists.");

    if (errors.length) {
      errorBox.innerHTML = errors.join("<br>");
      errorBox.classList.remove("d-none");
      return;
    }

    const programmeId = document.getElementById("sfProgramme").value;
    const programme = academic.getProgramme(programmeId);
    const payload = {
      firstName, lastName, fullName: `${firstName} ${lastName}`,
      gender: document.getElementById("sfGender").value,
      programmeId, departmentId: programme.departmentId,
      year: parseInt(document.getElementById("sfYear").value, 10),
      status: document.getElementById("sfStatus").value,
      email, phone, address: document.getElementById("sfAddress").value.trim()
    };

    if (editing) {
      global.USIAMS.students.updateStudent(editing.id, payload);
      toast.show("success", "Student updated", `${payload.fullName}'s record has been updated.`);
    } else {
      const newId = global.USIAMS.storage.nextId("STU", getStudents());
      const serial = parseInt(newId.split("-")[1], 10);
      global.USIAMS.students.addStudent({
        id: newId, regNumber: global.USIAMS.students.buildRegNumber(programme, 2025, serial),
        admission: { date: new Date().toISOString().slice(0, 10), entryQualification: "Advanced Certificate of Secondary Education (ACSEE)", previousSchool: "-" },
        emergencyContact: { name: "-", relation: "-", phone: "-" }, photo: null,
        ...payload
      });
      toast.show("success", "Student added", `${payload.fullName} has been added to the register.`);
    }
    modal.close();
    dataTable.refresh(getStudents());
  }

  // ---- Bulk Add (University Admin pastes a list, one student per line) --
  function openBulkAddModal() {
    if (!global.USIAMS.auth.guardWrite("bulk add student records")) return;
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Bulk Add Students</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <p class="text-muted-usi" style="font-size:.82rem;">One student per line, comma-separated: <code>Full Name, email, Programme Code</code>. Example: <code>Juma Shayo, juma.shayo@students.usiams.ac.tz, BSCS</code><br>New students start with an empty profile - they will be prompted to complete it themselves (personal details, emergency contact, academic background, documents) the first time they sign in.</p>
          <textarea class="form-control" id="bulkAddTextarea" rows="8" placeholder="Juma Shayo, juma.shayo@students.usiams.ac.tz, BSCS&#10;Grace Kessy, grace.kessy@students.usiams.ac.tz, BCOMACC"></textarea>
          <div id="bulkAddError" class="alert alert-danger mt-3 d-none"></div>
          <div id="bulkAddSummary" class="alert alert-success mt-3 d-none"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button><button class="btn btn-primary" id="bulkAddSubmitBtn" style="background:var(--primary);border-color:var(--primary);">Add Students</button></div>
      </div></div></div>
    `);
    document.getElementById("bulkAddSubmitBtn").addEventListener("click", runBulkAdd);
  }

  function runBulkAdd() {
    const raw = document.getElementById("bulkAddTextarea").value;
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const errorBox = document.getElementById("bulkAddError");
    const summaryBox = document.getElementById("bulkAddSummary");
    errorBox.classList.add("d-none");
    summaryBox.classList.add("d-none");

    if (!lines.length) { errorBox.textContent = "Please paste at least one student line."; errorBox.classList.remove("d-none"); return; }

    const added = [];
    const skipped = [];
    lines.forEach((line, i) => {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) { skipped.push(`Line ${i + 1}: expected "Full Name, email, Programme Code".`); return; }
      const [fullName, email, progCode] = parts;
      if (!util.validateEmail(email)) { skipped.push(`Line ${i + 1}: "${email}" is not a valid email.`); return; }
      const programme = global.USIAMS.data.programmes.find(p => p.code.toLowerCase() === progCode.toLowerCase() || p.id.toLowerCase() === progCode.toLowerCase());
      if (!programme) { skipped.push(`Line ${i + 1}: no programme matches code "${progCode}".`); return; }
      if (getStudents().some(s => s.email.toLowerCase() === email.toLowerCase()) || added.some(s => s.email.toLowerCase() === email.toLowerCase())) {
        skipped.push(`Line ${i + 1}: a student with email "${email}" already exists.`); return;
      }
      const nameParts = fullName.split(" ");
      const newId = global.USIAMS.storage.nextId("STU", [...getStudents(), ...added]);
      const serial = parseInt(newId.split("-")[1], 10);
      added.push({
        id: newId, regNumber: global.USIAMS.students.buildRegNumber(programme, 2025, serial),
        firstName: nameParts[0], lastName: nameParts.slice(1).join(" ") || nameParts[0], fullName,
        gender: null, programmeId: programme.id, departmentId: programme.departmentId,
        year: 1, status: "Active", email, phone: null, address: null, dob: null,
        emergencyContact: null, admission: { date: new Date().toISOString().slice(0, 10), entryQualification: null, previousSchool: null },
        documentsSubmitted: false, photo: null
      });
    });

    added.forEach(s => global.USIAMS.students.addStudent(s));

    if (added.length) {
      summaryBox.textContent = `${added.length} student(s) added.${skipped.length ? ` ${skipped.length} line(s) skipped - see below.` : ""}`;
      summaryBox.classList.remove("d-none");
      dataTable.refresh(getStudents());
      toast.show("success", "Bulk add complete", `${added.length} student record(s) created.`);
    }
    if (skipped.length) {
      errorBox.innerHTML = skipped.map(util.escapeHtml).join("<br>");
      errorBox.classList.remove("d-none");
    }
    if (added.length && !skipped.length) {
      document.getElementById("bulkAddTextarea").value = "";
    }
  }

  // ---- Profile modal ----------------------------------------------------
  function openProfile(id) {
    const s = getStudents().find(st => st.id === id);
    if (!s) return;
    const documents = global.USIAMS.storage.getStorage("documents", global.USIAMS.data.seedDocuments).filter(d => d.studentId === id);
    const results = global.USIAMS.results.resultsForStudent(id);
    const gpa = global.USIAMS.gpa.calculateGpa(results.map(r => ({ ...r, credits: global.USIAMS.courses.getCourse(r.courseId)?.credits || 0 })));
    const balance = global.USIAMS.finance.balanceForStudent(id);

    modal.renderInto(`
      <div class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <div class="d-flex align-items-center gap-3">
                <div class="avatar-circle" style="width:52px;height:52px;font-size:1.1rem;background:${util.avatarColorFromString(s.fullName)}">${util.initials(s.fullName)}</div>
                <div>
                  <h5 class="modal-title mb-0">${util.escapeHtml(s.fullName)}</h5>
                  <div class="text-muted-usi" style="font-size:.8rem;">${util.escapeHtml(s.regNumber)} &bull; ${util.escapeHtml(programmeName(s.programmeId))}</div>
                </div>
              </div>
              <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <ul class="nav nav-tabs mb-3" role="tablist">
                <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabPersonal">Personal</button></li>
                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabAcademic">Academic</button></li>
                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabContact">Contact</button></li>
                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabDocs">Documents</button></li>
                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabHistory">History</button></li>
              </ul>
              <div class="tab-content">
                <div class="tab-pane fade show active" id="tabPersonal">
                  <dl class="kv-list row">
                    <div class="col-md-6"><dt>Full Name</dt><dd>${util.escapeHtml(s.fullName)}</dd></div>
                    <div class="col-md-6"><dt>Gender</dt><dd>${s.gender}</dd></div>
                    <div class="col-md-6"><dt>Date of Birth</dt><dd>${util.formatDate(s.dob)}</dd></div>
                    <div class="col-md-6"><dt>Status</dt><dd><span class="status-badge status-${s.status.toLowerCase().replace(/\s+/g, "_")}">${s.status}</span></dd></div>
                    <div class="col-md-6"><dt>Admission Date</dt><dd>${util.formatDate(s.admission.date)}</dd></div>
                    <div class="col-md-6"><dt>Entry Qualification</dt><dd>${util.escapeHtml(s.admission.entryQualification)}</dd></div>
                    <div class="col-md-6"><dt>Previous School</dt><dd>${util.escapeHtml(s.admission.previousSchool)}</dd></div>
                  </dl>
                </div>
                <div class="tab-pane fade" id="tabAcademic">
                  <dl class="kv-list row">
                    <div class="col-md-6"><dt>Programme</dt><dd>${util.escapeHtml(academic.programmeFullPath(s.programmeId))}</dd></div>
                    <div class="col-md-6"><dt>Year of Study</dt><dd>${s.year}</dd></div>
                    <div class="col-md-6"><dt>Overall GPA</dt><dd>${gpa.toFixed(2)} (${global.USIAMS.gpa.classify(gpa)})</dd></div>
                    <div class="col-md-6"><dt>Outstanding Fees</dt><dd>${util.formatCurrency(balance.balance)}</dd></div>
                  </dl>
                </div>
                <div class="tab-pane fade" id="tabContact">
                  <dl class="kv-list row">
                    <div class="col-md-6"><dt>Email</dt><dd>${util.escapeHtml(s.email)}</dd></div>
                    <div class="col-md-6"><dt>Phone</dt><dd>${util.escapeHtml(s.phone)}</dd></div>
                    <div class="col-md-12"><dt>Address</dt><dd>${util.escapeHtml(s.address)}</dd></div>
                    <div class="col-md-6"><dt>Emergency Contact</dt><dd>${util.escapeHtml(s.emergencyContact.name)} (${s.emergencyContact.relation})</dd></div>
                    <div class="col-md-6"><dt>Emergency Phone</dt><dd>${util.escapeHtml(s.emergencyContact.phone)}</dd></div>
                  </dl>
                </div>
                <div class="tab-pane fade" id="tabDocs">
                  ${documents.length ? documents.map(d => `
                    <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                      <div><i class="bi bi-file-earmark-text me-2"></i>${util.escapeHtml(d.name)}<div class="text-muted-usi" style="font-size:.75rem;margin-left:1.4rem;">${d.type} &bull; ${util.formatDate(d.uploadDate)}</div></div>
                      <span class="status-badge status-${d.status.toLowerCase()}">${d.status}</span>
                    </div>`).join("") : `<div class="empty-state"><i class="bi bi-folder-x"></i>No documents uploaded.</div>`}
                </div>
                <div class="tab-pane fade" id="tabHistory">
                  <ul class="usi-timeline">
                    <li><span class="tl-dot done"></span><div class="tl-title">Admitted to ${util.escapeHtml(programmeName(s.programmeId))}</div><div class="tl-meta">${util.formatDate(s.admission.date)}</div></li>
                    ${global.USIAMS.results.semestersWithResults(s.id).map(sem => `
                      <li><span class="tl-dot done"></span><div class="tl-title">Completed ${util.escapeHtml(sem.label)}, ${global.USIAMS.data.academicYears.find(a=>a.id===sem.academicYearId).label}</div><div class="tl-meta">Results published</div></li>
                    `).join("")}
                    <li><span class="tl-dot"></span><div class="tl-title">Currently enrolled - Year ${s.year}</div><div class="tl-meta">${academic.activeSemester().label}, ${academic.activeAcademicYear().label}</div></li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  function exportCsv() {
    const rows = getStudents().map(s => ({
      RegNumber: s.regNumber, FullName: s.fullName, Gender: s.gender,
      Programme: programmeName(s.programmeId), Department: academic.getDepartment(s.departmentId)?.name,
      College: collegeName(s.departmentId), Year: s.year, Status: s.status, Email: s.email, Phone: s.phone
    }));
    util.downloadCsv("students-export", rows);
  }

  function initPage(user) {
    currentUser = user;
    renderFilters();
    initTable();
    document.getElementById("studentSearchInput").addEventListener("input", global.USIAMS.util.debounce(applyFilters, 200));
    document.getElementById("filterProgramme").addEventListener("change", applyFilters);
    document.getElementById("filterStatus").addEventListener("change", applyFilters);
    document.getElementById("filterYear").addEventListener("change", applyFilters);
    document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
    if (canWrite()) {
      document.getElementById("addStudentBtn").addEventListener("click", () => openStudentForm(null));
      document.getElementById("bulkAddStudentsBtn").classList.remove("d-none");
      document.getElementById("bulkAddStudentsBtn").addEventListener("click", openBulkAddModal);
    } else {
      document.getElementById("addStudentBtn").remove();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("openStudent")) openProfile(params.get("openStudent"));
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.studentsPage = { initPage };

})(window);
