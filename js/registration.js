/* =========================================================
   USIAMS - js/registration.js
   Course registration engine. Validates duplicates, credit
   limits, prerequisites, course availability and the
   registration window before allowing a student to confirm
   registration. Registration state is persisted in localStorage
   under the "registrations" key.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, modal, toast, academic, courses: courseSvc, gpa } = global.USIAMS;
  const KEY = "registrations";
  let student = null;
  let semester = null;
  let programme = null;
  let draftCourseIds = [];

  function allRegistrations() { return global.USIAMS.storage.ensureSeed(KEY, () => global.USIAMS.data.seedRegistrations); }
  function saveRegistrations(list) { global.USIAMS.storage.setStorage(KEY, list); }

  function semesterNumber(sem) { return sem.label.includes("II") ? 2 : 1; }

  function existingRegistration() {
    return allRegistrations().find(r => r.studentId === student.id && r.semesterId === semester.id);
  }

  function passedCourseIds() {
    return global.USIAMS.results.resultsForStudent(student.id).filter(r => r.totalMark >= 35).map(r => r.courseId);
  }

  function availableCourses() {
    return global.USIAMS.data.courses.filter(c =>
      c.status === "Active" && c.year === student.year && c.semesterNumber === semesterNumber(semester) &&
      c.programmeIds.includes(student.programmeId)
    );
  }

  function creditsOf(ids) {
    return ids.reduce((sum, id) => sum + (courseSvc.getCourse(id)?.credits || 0), 0);
  }

  function render() {
    document.getElementById("regAcademicYear").textContent = academic.activeAcademicYear().label;
    document.getElementById("regSemester").textContent = semester.label;
    document.getElementById("regPeriod").innerHTML = semester.registrationOpen
      ? `<span class="status-badge status-active">Open until ${util.formatDate(semester.registrationDeadline)}</span>`
      : `<span class="status-badge status-inactive">Closed</span>`;

    const existing = existingRegistration();
    document.getElementById("regStatusValue").innerHTML = existing
      ? `<span class="status-badge status-active">${existing.status}</span>`
      : `<span class="status-badge status-pending">Not Registered</span>`;

    const totalCredits = creditsOf(draftCourseIds);
    document.getElementById("totalCreditsValue").textContent = totalCredits;
    document.getElementById("creditLimitValue").textContent = `${programme.creditMinPerSemester} - ${programme.creditLimitPerSemester}`;

    renderAvailable();
    renderSelected();

    const locked = existing && existing.status === "Registered";
    document.getElementById("confirmRegistrationBtn").classList.toggle("d-none", locked);
    document.getElementById("amendRegistrationBtn").classList.toggle("d-none", !locked);
  }

  function renderAvailable() {
    const el = document.getElementById("availableCoursesList");
    const passed = passedCourseIds();
    const available = availableCourses();
    if (!available.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-journal-x"></i>No courses are offered for your programme this semester.</div>`; return; }

    el.innerHTML = available.map(c => {
      const already = draftCourseIds.includes(c.id);
      const prereqOk = courseSvc.prerequisitesMet(c.id, passed);
      return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <strong style="font-size:.85rem;">${c.id} - ${util.escapeHtml(c.title)}</strong>
          <div class="text-muted-usi" style="font-size:.76rem;">
            ${c.credits} Credits &bull; ${c.type}
            ${c.prerequisites.length ? `&bull; Requires: ${c.prerequisites.join(", ")}` : ""}
            ${!prereqOk ? `<span class="text-danger"> &bull; Prerequisite not met</span>` : ""}
          </div>
        </div>
        <button class="btn btn-sm ${already ? "btn-outline-secondary" : "btn-outline-primary"}" data-action="add" data-id="${c.id}" ${already || !prereqOk ? "disabled" : ""}>
          ${already ? "Added" : "Add"} <i class="bi bi-plus-lg"></i>
        </button>
      </div>`;
    }).join("");

    el.querySelectorAll("[data-action='add']").forEach(btn => btn.addEventListener("click", () => addCourse(btn.dataset.id)));
  }

  function renderSelected() {
    const el = document.getElementById("selectedCoursesList");
    if (!draftCourseIds.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-inbox"></i>No courses selected yet.</div>`; return; }
    el.innerHTML = draftCourseIds.map(id => {
      const c = courseSvc.getCourse(id);
      return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><strong style="font-size:.85rem;">${c.id} - ${util.escapeHtml(c.title)}</strong><div class="text-muted-usi" style="font-size:.76rem;">${c.credits} Credits</div></div>
        <button class="btn btn-sm btn-outline-danger" data-action="remove" data-id="${c.id}"><i class="bi bi-x-lg"></i></button>
      </div>`;
    }).join("");
    el.querySelectorAll("[data-action='remove']").forEach(btn => btn.addEventListener("click", () => removeCourse(btn.dataset.id)));
  }

  function addCourse(courseId) {
    if (!global.USIAMS.auth.guardWrite("modify course registration")) return;
    const errors = [];
    if (!semester.registrationOpen) errors.push("The registration period for this semester is closed.");
    if (draftCourseIds.includes(courseId)) errors.push("This course has already been added to your registration.");
    const course = courseSvc.getCourse(courseId);
    if (course.status !== "Active") errors.push("This course is not currently available for registration.");
    if (!courseSvc.prerequisitesMet(courseId, passedCourseIds())) errors.push(`Prerequisite requirement not satisfied for ${courseId}.`);
    const projectedCredits = creditsOf(draftCourseIds) + course.credits;
    if (projectedCredits > programme.creditLimitPerSemester) errors.push(`Adding this course exceeds your maximum credit load of ${programme.creditLimitPerSemester}.`);

    if (errors.length) {
      toast.show("error", "Cannot add course", errors[0]);
      return;
    }
    draftCourseIds.push(courseId);
    render();
    toast.show("success", "Course added", `${courseId} has been added to your registration.`);
  }

  function removeCourse(courseId) {
    if (!global.USIAMS.auth.guardWrite("modify course registration")) return;
    draftCourseIds = draftCourseIds.filter(id => id !== courseId);
    render();
  }

  function confirmRegistration() {
    if (!global.USIAMS.auth.guardWrite("confirm course registration")) return;
    if (!semester.registrationOpen) { toast.show("error", "Registration closed", "The registration period for this semester has closed."); return; }
    const totalCredits = creditsOf(draftCourseIds);
    if (totalCredits < programme.creditMinPerSemester) {
      toast.show("warning", "Below minimum credits", `You must register for at least ${programme.creditMinPerSemester} credits (currently ${totalCredits}).`);
      return;
    }
    if (totalCredits > programme.creditLimitPerSemester) {
      toast.show("error", "Credit limit exceeded", `Your total credits (${totalCredits}) exceed the maximum of ${programme.creditLimitPerSemester}.`);
      return;
    }
    if (!draftCourseIds.length) { toast.show("warning", "No courses selected", "Please add at least one course before registering."); return; }

    modal.confirm({
      title: "Confirm Course Registration",
      message: `You are about to register for <strong>${draftCourseIds.length} course(s)</strong> totalling <strong>${totalCredits} credits</strong> for ${semester.label}, ${academic.activeAcademicYear().label}. Do you want to proceed?`,
      confirmText: "Confirm Registration",
      variant: "primary",
      onConfirm: () => {
        const list = allRegistrations().filter(r => !(r.studentId === student.id && r.semesterId === semester.id));
        list.push({ id: util.uid("REG"), studentId: student.id, semesterId: semester.id, courseIds: [...draftCourseIds], totalCredits, status: "Registered", registeredAt: new Date().toISOString() });
        saveRegistrations(list);
        render();
        toast.show("success", "Registration successful", "Your course registration has been submitted successfully.");
      }
    });
  }

  function amendRegistration() {
    if (!global.USIAMS.auth.guardWrite("amend registration")) return;
    const existing = existingRegistration();
    if (existing) {
      const list = allRegistrations().map(r => r.id === existing.id ? { ...r, status: "Draft" } : r);
      saveRegistrations(list);
    }
    render();
    toast.show("info", "Registration reopened", "You can now modify your course selection.");
  }

  function initPage(user) {
    let targetStudentId = user.studentId;
    const selectorWrap = document.getElementById("studentSelectorWrap");
    if (user.role !== "STUDENT") {
      selectorWrap.classList.remove("d-none");
      const select = document.getElementById("studentSelector");
      select.innerHTML = global.USIAMS.data.students.filter(s => s.status === "Active").map(s => `<option value="${s.id}">${s.regNumber} - ${s.fullName}</option>`).join("");
      targetStudentId = select.value;
      select.addEventListener("change", () => { loadStudent(select.value); });
    } else {
      selectorWrap.classList.add("d-none");
    }
    loadStudent(targetStudentId);

    document.getElementById("confirmRegistrationBtn").addEventListener("click", confirmRegistration);
    document.getElementById("amendRegistrationBtn").addEventListener("click", amendRegistration);
  }

  function loadStudent(studentId) {
    student = global.USIAMS.students.getStudent(studentId);
    programme = academic.getProgramme(student.programmeId);
    semester = academic.activeSemester();
    const existing = existingRegistration();
    draftCourseIds = existing ? [...existing.courseIds] : [];
    document.getElementById("regStudentName").textContent = `${student.fullName} (${student.regNumber})`;
    render();
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.registrationPage = { initPage };

})(window);
