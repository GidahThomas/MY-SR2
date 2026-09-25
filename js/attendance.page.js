/* =========================================================
   USIAMS - js/attendance.page.js
   Attendance page logic (named .page.js to avoid clashing with
   the data/attendance.js USIAMS.attendance namespace).
   ========================================================= */
(function (global) {
  "use strict";

  const { util, charts } = global.USIAMS;
  let student = null;
  // Set by initPage. util.studentLabel() consults it to decide whether a
  // viewer may see student names or only registration numbers.
  let currentUser = null;

  function render() {
    const rows = global.USIAMS.attendance.attendanceForStudent(student.id);
    const tbody = document.getElementById("attendanceTableBody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-calendar-x"></i>No attendance records for the current semester.</div></td></tr>`;
    } else {
      tbody.innerHTML = rows.map(r => {
        const course = global.USIAMS.courses.getCourse(r.courseId);
        const status = global.USIAMS.attendance.statusForPercentage(r.percentage);
        return `<tr>
          <td>${course.id} - ${util.escapeHtml(course.title)}</td>
          <td>${util.escapeHtml(r.lecturer)}</td>
          <td>${r.totalClasses}</td>
          <td>${r.attended}</td>
          <td>${r.missed}</td>
          <td style="min-width:180px;">
            <div class="d-flex justify-content-between" style="font-size:.76rem;"><span>${r.percentage}%</span><span class="status-badge status-${status.tone === "success" ? "active" : status.tone === "danger" ? "critical" : status.tone}">${status.label}</span></div>
            <div class="attendance-bar"><div style="width:${r.percentage}%;background:var(--${status.tone === "success" ? "success" : status.tone === "info" ? "info" : status.tone === "warning" ? "warning" : "danger"});"></div></div>
          </td>
        </tr>`;
      }).join("");
    }

    document.getElementById("overallAttendanceValue").textContent = `${global.USIAMS.attendance.overallPercentageForStudent(student.id)}%`;

    charts.barChart("attendanceByCourseChart", rows.map(r => r.courseId), [{ label: "Attendance %", data: rows.map(r => r.percentage) }], { scales: { y: { min: 0, max: 100 } } });
    charts.lineChart("attendanceTrendChart", ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
      [{ label: "Average Attendance %", data: weeklyTrend(rows) }], { scales: { y: { min: 0, max: 100 } } });
  }

  function weeklyTrend(rows) {
    if (!rows.length) return [0, 0, 0, 0, 0, 0];
    const avg = Math.round(rows.reduce((s, r) => s + r.percentage, 0) / rows.length);
    // Deterministic gentle variation around the current average for a trend illustration.
    return [avg - 8, avg - 4, avg - 2, avg + 1, avg - 1, avg].map(v => Math.max(0, Math.min(100, v)));
  }

  function initPage(user) {
    currentUser = user;
    let targetStudentId = user.studentId;
    const selectorWrap = document.getElementById("studentSelectorWrap");
    if (user.role !== "STUDENT") {
      selectorWrap.classList.remove("d-none");
      const select = document.getElementById("studentSelector");
      select.innerHTML = global.USIAMS.data.students.filter(s => s.status === "Active").map(s => `<option value="${s.id}">${s.regNumber}</option>`).join("");
      targetStudentId = select.value;
      select.addEventListener("change", () => loadStudent(select.value));
    } else {
      selectorWrap.classList.add("d-none");
    }
    loadStudent(targetStudentId);
  }

  function loadStudent(id) {
    student = global.USIAMS.students.getStudent(id);
    document.getElementById("attendanceStudentName").textContent = `${global.USIAMS.util.studentLabel(student, currentUser)} (${student.regNumber})`;
    render();
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.attendancePage = { initPage };

})(window);
