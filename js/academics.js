/* =========================================================
   USIAMS - js/academics.js
   Academic Structure hub: Colleges/Institutes/Schools ->
   Departments -> Programmes hierarchy, plus Academic Years and
   Semesters management. Uses overlay CRUD so new organisational
   units can always be appended - nothing here assumes a fixed
   count of colleges/institutes/schools.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, modal, toast, academic } = global.USIAMS;
  const unitsOverlay = global.USIAMS.storage.createOverlay("orgUnits", () => global.USIAMS.data.orgUnits);
  const deptOverlay = global.USIAMS.storage.createOverlay("departments", () => global.USIAMS.data.departments);
  const progOverlay = global.USIAMS.storage.createOverlay("programmes", () => global.USIAMS.data.programmes);
  const ayOverlay = global.USIAMS.storage.createOverlay("academicYears", () => global.USIAMS.data.academicYears);
  let currentUser = null;

  function canWrite() { return !global.USIAMS.auth.isReadOnlyRole(currentUser.role) && !["STUDENT", "LECTURER"].includes(currentUser.role); }

  function renderStructure() {
    const units = unitsOverlay.getAll();
    const departments = deptOverlay.getAll();
    const programmes = progOverlay.getAll();
    const container = document.getElementById("structureTree");

    container.innerHTML = units.map(unit => {
      const deptsOfUnit = departments.filter(d => d.unitId === unit.id);
      return `
      <div class="usi-card mb-3">
        <div class="usi-card-header">
          <div>
            <h3><i class="bi bi-building me-2"></i>${util.escapeHtml(unit.name)} <span class="badge text-bg-light border ms-1">${unit.type}</span></h3>
            <div class="text-muted-usi" style="font-size:.78rem;">Established ${unit.established} &bull; ${deptsOfUnit.length} department(s)</div>
          </div>
        </div>
        <div class="usi-card-body">
          ${deptsOfUnit.length ? deptsOfUnit.map(dept => {
            const progsOfDept = programmes.filter(p => p.departmentId === dept.id);
            return `
            <div class="border rounded-3 p-3 mb-2">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div><strong style="font-size:.88rem;"><i class="bi bi-diagram-2 me-1"></i>${util.escapeHtml(dept.name)}</strong>
                  <div class="text-muted-usi" style="font-size:.76rem;">Head of Department: ${util.escapeHtml(dept.hod)}</div>
                </div>
                <span class="badge text-bg-light border">${progsOfDept.length} programme(s)</span>
              </div>
              ${progsOfDept.length ? `<div class="d-flex flex-wrap gap-2 mt-2">
                ${progsOfDept.map(p => `<span class="status-badge status-active"><i class="bi bi-mortarboard me-1"></i>${util.escapeHtml(p.name)}</span>`).join("")}
              </div>` : `<div class="text-soft-usi" style="font-size:.78rem;">No programmes yet.</div>`}
            </div>`;
          }).join("") : `<div class="empty-state py-3"><i class="bi bi-diagram-3"></i>No departments yet under this unit.</div>`}
        </div>
      </div>`;
    }).join("");
  }

  function renderCurriculum() {
    const select = document.getElementById("curriculumProgramme");
    if (!select.options.length) {
      select.innerHTML = progOverlay.getAll().map(p => `<option value="${p.id}">${util.escapeHtml(p.name)} (${p.level})</option>`).join("");
    }
    const programme = academic.getProgramme(select.value);
    const container = document.getElementById("curriculumContainer");
    if (!programme) { container.innerHTML = `<div class="empty-state"><i class="bi bi-journal-x"></i>Select a programme to view its curriculum.</div>`; return; }

    document.getElementById("curriculumLevelBadge").innerHTML =
      `<span class="status-badge status-${programme.level === "PhD" ? "info" : programme.level === "Diploma" ? "warning" : "active"}">${programme.level}</span>
       <span class="text-muted-usi ms-2" style="font-size:.78rem;">${programme.durationYears}-year programme &bull; ${academic.collegeNameForDepartment(programme.departmentId)}</span>`;

    const years = Array.from({ length: programme.durationYears }, (_, i) => i + 1);
    container.innerHTML = years.map(year => {
      const semesters = [1, 2].map(semNum => {
        const courses = global.USIAMS.data.courses.filter(c => c.status === "Active" && c.year === year && c.semesterNumber === semNum && c.programmeIds.includes(programme.id));
        return `
          <div class="col-md-6">
            <div class="border rounded-3 p-3 h-100">
              <strong style="font-size:.82rem;">Semester ${semNum === 1 ? "I" : "II"}</strong>
              ${courses.length ? `<div class="mt-2">${courses.map(c => `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" style="font-size:.8rem;">
                  <span>${c.id} - ${util.escapeHtml(c.title)}</span>
                  <span class="text-muted-usi">${c.credits} cr &bull; ${c.type}</span>
                </div>`).join("")}</div>` : `<div class="text-soft-usi mt-2" style="font-size:.78rem;">No courses mapped for this semester yet.</div>`}
            </div>
          </div>`;
      }).join("");
      return `
        <div class="mb-3">
          <div class="section-title">Year ${year}</div>
          <div class="row g-3">${semesters}</div>
        </div>`;
    }).join("");
  }

  function renderYears() {
    const years = ayOverlay.getAll();
    const semesters = global.USIAMS.storage.getStorage("semesters", global.USIAMS.data.semesters);
    const container = document.getElementById("academicYearsList");
    container.innerHTML = years.map(y => {
      const sems = semesters.filter(s => s.academicYearId === y.id);
      return `
      <div class="usi-card mb-3">
        <div class="usi-card-header">
          <h3>${util.escapeHtml(y.label)}</h3>
          <span class="status-badge status-${y.status === "Active" ? "active" : y.status === "Upcoming" ? "warning" : "closed"}">${y.status}</span>
        </div>
        <div class="usi-card-body">
          <div class="usi-table-wrap"><table class="usi-table"><thead><tr><th>Semester</th><th>Status</th><th>Registration</th><th>Action</th></tr></thead><tbody>
            ${sems.map(s => `
              <tr>
                <td>${util.escapeHtml(s.label)}</td>
                <td><span class="status-badge status-${s.status === "Active" ? "active" : s.status === "Upcoming" ? "warning" : "closed"}">${s.status}</span></td>
                <td>${s.registrationOpen ? `<span class="status-badge status-active">Open until ${util.formatDate(s.registrationDeadline)}</span>` : `<span class="status-badge status-inactive">Closed</span>`}</td>
                <td>
                  <button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="toggle-reg" data-id="${s.id}">
                    ${s.registrationOpen ? "Close Registration" : "Open Registration"}
                  </button>
                </td>
              </tr>`).join("")}
          </tbody></table></div>
        </div>
      </div>`;
    }).join("");

    container.querySelectorAll("[data-action='toggle-reg']").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!global.USIAMS.auth.guardWrite("open or close registration periods")) return;
        const list = global.USIAMS.storage.getStorage("semesters", global.USIAMS.data.semesters).map(s =>
          s.id === btn.dataset.id ? { ...s, registrationOpen: !s.registrationOpen } : s);
        global.USIAMS.storage.setStorage("semesters", list);
        toast.show("success", "Registration status updated", "The semester registration status has been changed.");
        renderYears();
      });
    });
  }

  function openAddUnitModal() {
    if (!global.USIAMS.auth.guardWrite("add organisational units")) return;
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Add College / Institute / School</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Unit Name</label><input class="form-control mb-3" id="unitName" placeholder="e.g. College of Health Sciences">
          <label class="form-label">Type</label>
          <select class="form-select" id="unitType"><option>College</option><option>Institute</option><option>School</option></select>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveUnitBtn" style="background:var(--primary);border-color:var(--primary);">Add Unit</button></div>
      </div></div></div>
    `);
    document.getElementById("saveUnitBtn").addEventListener("click", () => {
      const name = document.getElementById("unitName").value.trim();
      if (!name) { toast.show("error", "Missing name", "Please enter a name for the new unit."); return; }
      const id = util.slugify(name).toUpperCase().slice(0, 8);
      unitsOverlay.add({ id, name, type: document.getElementById("unitType").value, established: new Date().getFullYear() });
      modal.close();
      renderStructure();
      toast.show("success", "Unit added", `${name} has been added to the academic structure.`);
    });
  }

  function openAddYearModal() {
    if (!global.USIAMS.auth.guardWrite("add academic years")) return;
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Add Academic Year</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body"><label class="form-label">Academic Year Label</label><input class="form-control" id="ayLabel" placeholder="e.g. 2026/2027"></div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveYearBtn" style="background:var(--primary);border-color:var(--primary);">Add Year</button></div>
      </div></div></div>
    `);
    document.getElementById("saveYearBtn").addEventListener("click", () => {
      const label = document.getElementById("ayLabel").value.trim();
      if (!label) { toast.show("error", "Missing label", "Please enter an academic year label."); return; }
      const id = "AY" + label.slice(0, 4);
      ayOverlay.add({ id, label, status: "Upcoming" });
      const semesters = global.USIAMS.storage.getStorage("semesters", global.USIAMS.data.semesters);
      semesters.push({ id: `${id}-S1`, academicYearId: id, label: "Semester I", status: "Upcoming", registrationOpen: false });
      semesters.push({ id: `${id}-S2`, academicYearId: id, label: "Semester II", status: "Upcoming", registrationOpen: false });
      global.USIAMS.storage.setStorage("semesters", semesters);
      modal.close();
      renderYears();
      toast.show("success", "Academic year added", `${label} has been created with two semesters.`);
    });
  }

  function initPage(user) {
    currentUser = user;
    renderStructure();
    renderCurriculum();
    renderYears();
    document.getElementById("curriculumProgramme").addEventListener("change", renderCurriculum);
    if (canWrite()) {
      document.getElementById("addUnitBtn").addEventListener("click", openAddUnitModal);
      document.getElementById("addYearBtn").addEventListener("click", openAddYearModal);
    } else {
      document.getElementById("addUnitBtn").remove();
      document.getElementById("addYearBtn").remove();
    }
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.academicsPage = { initPage };

})(window);
