/* =========================================================
   USIAMS - js/elearning.js
   Per-course materials and assignments: lecturers publish
   content and grade submissions, students view materials and
   submit assignments for their registered courses.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, toast, modal } = global.USIAMS;
  const materialsOverlay = global.USIAMS.storage.createOverlay("elearningMaterials", () => global.USIAMS.data.seedMaterials);
  const assignmentsOverlay = global.USIAMS.storage.createOverlay("elearningAssignments", () => global.USIAMS.data.seedAssignments);
  const submissionsOverlay = global.USIAMS.storage.createOverlay("elearningSubmissions", () => global.USIAMS.data.seedSubmissions);
  let currentUser = null;
  let selectedCourseId = null;

  function lecturerCourses(user) {
    return global.USIAMS.data.courses.filter(c => c.departmentId === user.departmentId && c.status === "Active");
  }

  function studentCourses(user) {
    const semester = global.USIAMS.academic.activeSemester();
    const registrations = global.USIAMS.storage.getStorage("registrations", global.USIAMS.data.seedRegistrations);
    const reg = registrations.find(r => r.studentId === user.studentId && r.semesterId === semester.id);
    const ids = reg ? reg.courseIds : [];
    return global.USIAMS.data.courses.filter(c => ids.includes(c.id));
  }

  function coursesForUser(user) {
    return user.role === "STUDENT" ? studentCourses(user) : lecturerCourses(user);
  }

  function materialsFor(courseId) { return materialsOverlay.getAll().filter(m => m.courseId === courseId).sort((a, b) => new Date(b.uploadedDate) - new Date(a.uploadedDate)); }
  function assignmentsFor(courseId) { return assignmentsOverlay.getAll().filter(a => a.courseId === courseId).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)); }
  function submissionsFor(assignmentId) { return submissionsOverlay.getAll().filter(s => s.assignmentId === assignmentId); }
  function mySubmission(assignmentId, studentId) { return submissionsOverlay.getAll().find(s => s.assignmentId === assignmentId && s.studentId === studentId); }

  function renderCourseSelector(user) {
    const courses = coursesForUser(user);
    const select = document.getElementById("courseSelect");
    if (!courses.length) {
      select.innerHTML = `<option value="">No courses available</option>`;
      select.disabled = true;
      return courses;
    }
    select.disabled = false;
    select.innerHTML = courses.map(c => `<option value="${c.id}">${util.escapeHtml(c.id)} - ${util.escapeHtml(c.title)}</option>`).join("");
    if (!selectedCourseId || !courses.some(c => c.id === selectedCourseId)) selectedCourseId = courses[0].id;
    select.value = selectedCourseId;
    select.onchange = () => { selectedCourseId = select.value; renderCourseContent(user); };
    return courses;
  }

  function renderMaterials(user) {
    const materials = materialsFor(selectedCourseId);
    const isLecturer = user.role !== "STUDENT";
    document.getElementById("materialsList").innerHTML = (materials.length ? materials.map(m => `
      <div class="usi-card mb-2"><div class="usi-card-body d-flex justify-content-between align-items-center">
        <div><strong>${util.escapeHtml(m.title)}</strong><div class="text-muted-usi" style="font-size:.76rem;">${util.escapeHtml(m.type)} &bull; Uploaded ${util.formatDate(m.uploadedDate)}</div></div>
        <i class="bi bi-file-earmark-text fs-4 text-muted-usi"></i>
      </div></div>`).join("") : `<div class="empty-state"><i class="bi bi-folder2-open"></i>No materials uploaded for this course yet.</div>`)
      + (isLecturer ? `<button class="btn btn-outline-primary btn-sm mt-2" id="addMaterialBtn"><i class="bi bi-plus-lg me-1"></i>Add Material</button>` : "");

    if (isLecturer) document.getElementById("addMaterialBtn").addEventListener("click", openAddMaterialModal);
  }

  function openAddMaterialModal() {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Add Material</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Title</label><input type="text" class="form-control mb-3" id="materialTitleInput" placeholder="e.g. Week 3 - Slides">
          <label class="form-label">Type</label>
          <select class="form-select" id="materialTypeInput">${global.USIAMS.data.elearningMaterialTypes.map(t => `<option>${t}</option>`).join("")}</select>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveMaterialBtn" style="background:var(--primary);border-color:var(--primary);">Save</button></div>
      </div></div></div>
    `);
    document.getElementById("saveMaterialBtn").addEventListener("click", () => {
      const title = document.getElementById("materialTitleInput").value.trim();
      if (!title) { toast.show("error", "Title required", "Please enter a title for the material."); return; }
      materialsOverlay.add({ id: util.uid("MAT"), courseId: selectedCourseId, title, type: document.getElementById("materialTypeInput").value, uploadedDate: new Date().toISOString().slice(0, 10) });
      modal.close();
      renderMaterials(currentUser);
      toast.show("success", "Material added", "The course material has been published.");
    });
  }

  function renderAssignments(user) {
    const assignments = assignmentsFor(selectedCourseId);
    const isLecturer = user.role !== "STUDENT";
    const container = document.getElementById("assignmentsList");
    container.innerHTML = (assignments.length ? assignments.map(a => {
      if (isLecturer) {
        const subs = submissionsFor(a.id);
        return `
        <div class="usi-card mb-3">
          <div class="usi-card-header"><div><h3>${util.escapeHtml(a.title)}</h3><div class="text-muted-usi" style="font-size:.78rem;">Due ${util.formatDate(a.dueDate)} &bull; Max Score ${a.maxScore}</div></div></div>
          <div class="usi-card-body">
            <p style="font-size:.85rem;">${util.escapeHtml(a.description)}</p>
            <div id="subs-${a.id}"></div>
          </div>
        </div>`;
      }
      const submission = mySubmission(a.id, user.studentId);
      return `
      <div class="usi-card mb-3">
        <div class="usi-card-header">
          <div><h3>${util.escapeHtml(a.title)}</h3><div class="text-muted-usi" style="font-size:.78rem;">Due ${util.formatDate(a.dueDate)} &bull; Max Score ${a.maxScore}</div></div>
          ${submission ? `<span class="status-badge status-${submission.status.toLowerCase()}">${submission.status}${submission.status === "Graded" ? ` - ${submission.score}/${a.maxScore}` : ""}</span>` : ""}
        </div>
        <div class="usi-card-body">
          <p style="font-size:.85rem;">${util.escapeHtml(a.description)}</p>
          ${submission ? `<p class="text-muted-usi" style="font-size:.78rem;">Submitted ${util.formatDate(submission.submittedDate)}: ${util.escapeHtml(submission.note)}${global.USIAMS.api.files.isStored(submission.url) ? ` &middot; <a href="#" data-action="download-attachment" data-url="${util.escapeHtml(submission.url)}">download</a>` : ""}</p>`
            : `<button class="btn btn-sm btn-outline-primary" data-action="submit" data-id="${a.id}"><i class="bi bi-upload me-1"></i>Submit Assignment</button>`}
        </div>
      </div>`;
    }).join("") : `<div class="empty-state"><i class="bi bi-clipboard"></i>No assignments posted for this course yet.</div>`)
      + (isLecturer ? `<button class="btn btn-outline-primary btn-sm" id="addAssignmentBtn"><i class="bi bi-plus-lg me-1"></i>Add Assignment</button>` : "");

    if (isLecturer) {
      document.getElementById("addAssignmentBtn").addEventListener("click", openAddAssignmentModal);
      assignments.forEach(a => renderSubmissionsTable(a));
    } else {
      container.querySelectorAll("[data-action='submit']").forEach(btn => btn.addEventListener("click", () => openSubmitModal(assignments.find(a => a.id === btn.dataset.id))));
    }
  }

  function renderSubmissionsTable(assignment) {
    const el = document.getElementById(`subs-${assignment.id}`);
    if (!el) return;
    const subs = submissionsFor(assignment.id);
    if (!subs.length) { el.innerHTML = `<div class="text-muted-usi" style="font-size:.78rem;">No submissions yet.</div>`; return; }
    el.innerHTML = `<div class="usi-table-wrap"><table class="usi-table"><thead><tr><th>Student</th><th>Submitted</th><th>Status</th><th>Score</th><th>Action</th></tr></thead><tbody>
      ${subs.map(s => {
        const student = global.USIAMS.students.getStudent(s.studentId);
        return `<tr>
          <td>${student ? util.escapeHtml(util.studentLabel(student, currentUser)) : s.studentId}</td>
          <td>${util.formatDate(s.submittedDate)}${global.USIAMS.api.files.isStored(s.url) ? `<div><a href="#" data-action="download-attachment" data-url="${util.escapeHtml(s.url)}" style="font-size:.78rem;"><i class="bi bi-download me-1"></i>Download work</a></div>` : ""}</td>
          <td><span class="status-badge status-${s.status.toLowerCase()}">${s.status}</span></td>
          <td>${s.score !== null ? `${s.score}/${assignment.maxScore}` : "-"}</td>
          <td>${s.status !== "Graded" ? `<button class="btn btn-sm btn-outline-primary" data-action="grade" data-id="${s.id}" data-max="${assignment.maxScore}"><i class="bi bi-check2-square"></i> Grade</button>` : ""}</td>
        </tr>`;
      }).join("")}
    </tbody></table></div>`;
    el.querySelectorAll("[data-action='grade']").forEach(btn => btn.addEventListener("click", () => openGradeModal(btn.dataset.id, Number(btn.dataset.max))));
  }

  function openAddAssignmentModal() {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Add Assignment</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Title</label><input type="text" class="form-control mb-3" id="asgTitleInput">
          <label class="form-label">Description</label><textarea class="form-control mb-3" id="asgDescInput" rows="3"></textarea>
          <div class="row">
            <div class="col-6"><label class="form-label">Due Date</label><input type="date" class="form-control" id="asgDueInput"></div>
            <div class="col-6"><label class="form-label">Max Score</label><input type="number" class="form-control" id="asgMaxInput" value="100"></div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="saveAsgBtn" style="background:var(--primary);border-color:var(--primary);">Save</button></div>
      </div></div></div>
    `);
    document.getElementById("saveAsgBtn").addEventListener("click", () => {
      const title = document.getElementById("asgTitleInput").value.trim();
      const dueDate = document.getElementById("asgDueInput").value;
      if (!title || !dueDate) { toast.show("error", "Missing fields", "Please provide a title and due date."); return; }
      assignmentsOverlay.add({
        id: util.uid("ASG"), courseId: selectedCourseId, title,
        description: document.getElementById("asgDescInput").value.trim(),
        dueDate, maxScore: Number(document.getElementById("asgMaxInput").value) || 100
      });
      modal.close();
      renderAssignments(currentUser);
      toast.show("success", "Assignment posted", "The assignment has been published to the course.");
    });
  }

  function openSubmitModal(assignment) {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Submit: ${util.escapeHtml(assignment.title)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label" for="submissionFileInput">Your work (file, up to 5 MB)</label>
          <input type="file" class="form-control mb-3" id="submissionFileInput">
          <label class="form-label">Submission Note</label>
          <textarea class="form-control" id="submissionNoteInput" rows="4" placeholder="Describe your submission or paste a link to your work"></textarea>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="confirmSubmitBtn" style="background:var(--primary);border-color:var(--primary);">Submit</button></div>
      </div></div></div>
    `);
    document.getElementById("confirmSubmitBtn").addEventListener("click", async () => {
      const note = document.getElementById("submissionNoteInput").value.trim();
      const file = document.getElementById("submissionFileInput").files[0];
      if (!note && !file) { toast.show("error", "Nothing to submit", "Attach your work or describe it in the note."); return; }
      // The file itself is stored in the database; the submission keeps its URL.
      let stored = null;
      if (file) {
        const btn = document.getElementById("confirmSubmitBtn");
        btn.disabled = true;
        try { stored = await global.USIAMS.api.files.upload(file, "submission"); }
        catch (error) { btn.disabled = false; toast.show("error", "Upload failed", error.message); return; }
      }
      submissionsOverlay.add({
        id: util.uid("SUB"), assignmentId: assignment.id, studentId: currentUser.studentId,
        submittedDate: new Date().toISOString().slice(0, 10), note: note || (file ? `Submitted ${file.name}` : ""),
        url: stored ? stored.url : null, score: null, status: "Submitted"
      });
      modal.close();
      renderAssignments(currentUser);
      toast.show("success", "Assignment submitted", "Your submission has been recorded.");
    });
  }

  function openGradeModal(submissionId, maxScore) {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Grade Submission</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Score (out of ${maxScore})</label>
          <input type="number" class="form-control" id="gradeScoreInput" min="0" max="${maxScore}">
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="confirmGradeBtn" style="background:var(--primary);border-color:var(--primary);">Save Grade</button></div>
      </div></div></div>
    `);
    document.getElementById("confirmGradeBtn").addEventListener("click", () => {
      const score = Number(document.getElementById("gradeScoreInput").value);
      if (isNaN(score) || score < 0 || score > maxScore) { toast.show("error", "Invalid score", `Please enter a score between 0 and ${maxScore}.`); return; }
      submissionsOverlay.update(submissionId, { score, status: "Graded" });
      modal.close();
      renderAssignments(currentUser);
      toast.show("success", "Grade saved", "The submission has been graded.");
    });
  }

  function renderCourseContent(user) {
    if (!selectedCourseId) { document.getElementById("materialsList").innerHTML = ""; document.getElementById("assignmentsList").innerHTML = ""; return; }
    renderMaterials(user);
    renderAssignments(user);
  }

  function initPage(user) {
    currentUser = user;
    const courses = renderCourseSelector(user);
    if (!courses.length) {
      document.getElementById("elearningContent").innerHTML = `<div class="empty-state"><i class="bi bi-mortarboard"></i>${user.role === "STUDENT" ? "You are not registered for any courses this semester." : "No courses found for your department."}</div>`;
      return;
    }
    renderCourseContent(user);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.elearning = {
    coursesForUser,
    allMaterials: () => materialsOverlay.getAll(),
    allAssignments: () => assignmentsOverlay.getAll(),
    allSubmissions: () => submissionsOverlay.getAll(),
    mySubmission
  };
  global.USIAMS.elearningPage = { initPage };

})(window);
