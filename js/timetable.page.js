/* =========================================================
   USIAMS - js/timetable.page.js
   Weekly timetable grid + conflict detection (named .page.js to
   avoid clashing with data/timetable.js's USIAMS.timetable
   namespace).
   ========================================================= */
(function (global) {
  "use strict";

  const { util } = global.USIAMS;
  const DAYS = global.USIAMS.timetable.DAYS;
  const TIMES = global.USIAMS.timetable.TIMES;

  function renderGrid(entries) {
    const conflicts = global.USIAMS.timetable.detectConflicts(entries);
    const grid = document.getElementById("timetableGrid");

    let html = `<div class="tt-head"></div>` + DAYS.map(d => `<div class="tt-head">${d}</div>`).join("");
    TIMES.forEach(time => {
      html += `<div class="tt-time">${time}</div>`;
      DAYS.forEach(day => {
        const cellEntries = entries.filter(e => e.day === day && e.time === time);
        html += `<div class="tt-cell">${cellEntries.map(e => {
          const course = global.USIAMS.courses.getCourse(e.courseId);
          const isConflict = conflicts.has(e.id);
          return `<div class="tt-class ${isConflict ? "conflict" : ""}" title="${isConflict ? "Scheduling conflict detected" : ""}">
            <strong>${course.id}</strong>${util.escapeHtml(course.title)}<br>${util.escapeHtml(e.lecturer)} &bull; ${e.room}
            ${isConflict ? `<br><i class="bi bi-exclamation-triangle-fill"></i> Conflict` : ""}
          </div>`;
        }).join("")}</div>`;
      });
    });
    grid.innerHTML = html;

    const conflictBanner = document.getElementById("conflictBanner");
    const conflictCourses = [...new Set([...conflicts].map(id => entries.find(e => e.id === id)?.courseId))];
    if (conflicts.size) {
      conflictBanner.classList.remove("d-none");
      conflictBanner.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i>Scheduling conflict detected between: ${conflictCourses.join(", ")}. Please contact the Registration Officer.`;
    } else {
      conflictBanner.classList.add("d-none");
    }
  }

  function initPage(user) {
    const filterWrap = document.getElementById("timetableFilterWrap");

    if (user.role === "STUDENT") {
      const student = global.USIAMS.students.getStudent(user.studentId);
      document.getElementById("timetableSubtitle").textContent = `${global.USIAMS.academic.getProgramme(student.programmeId).name} - Year ${student.year}`;
      renderGrid(global.USIAMS.timetable.timetableForProgrammeYear(student.programmeId, student.year));
      filterWrap.classList.add("d-none");
      if (global.USIAMS.classChecklist) {
        document.getElementById("todayClassesCard").classList.remove("d-none");
        global.USIAMS.classChecklist.start("todayClassesList", student);
      }
    } else if (user.role === "LECTURER") {
      document.getElementById("timetableSubtitle").textContent = `Teaching schedule for ${user.name}`;
      renderGrid(global.USIAMS.timetable.timetableForLecturer(user.name));
      filterWrap.classList.add("d-none");
    } else {
      filterWrap.classList.remove("d-none");
      const progSelect = document.getElementById("timetableProgramme");
      const yearSelect = document.getElementById("timetableYear");
      progSelect.innerHTML = global.USIAMS.data.programmes.map(p => `<option value="${p.id}">${util.escapeHtml(p.name)}</option>`).join("");
      const update = () => {
        document.getElementById("timetableSubtitle").textContent = `${global.USIAMS.academic.getProgramme(progSelect.value).name} - Year ${yearSelect.value}`;
        renderGrid(global.USIAMS.timetable.timetableForProgrammeYear(progSelect.value, parseInt(yearSelect.value, 10)));
      };
      progSelect.addEventListener("change", update);
      yearSelect.addEventListener("change", update);
      update();
    }
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.timetablePage = { initPage };

})(window);
