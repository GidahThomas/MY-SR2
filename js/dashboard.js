/* =========================================================
   USIAMS - js/dashboard.js
   Role-specific dashboard rendering. One render function per
   dashboard page; each pulls exclusively from the shared data/
   services (gpa.js, finance.js, attendance.js, etc.) so nothing
   here recomputes a GPA, balance or percentage on its own.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, cards, charts, gpa, finance, attendance, academic } = global.USIAMS;

  function greetingPrefix() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  // ---------------------------------------------------------------------
  // STUDENT DASHBOARD
  // ---------------------------------------------------------------------
  function renderStudentDashboard(user) {
    const student = global.USIAMS.students.getStudent(user.studentId);
    const programme = academic.getProgramme(student.programmeId);
    const semester = academic.activeSemester();
    const results = global.USIAMS.results.resultsForStudent(student.id);
    const semesters = global.USIAMS.results.semestersWithResults(student.id);
    const lastSemester = semesters[semesters.length - 1];
    const currentSemGpa = lastSemester ? gpa.calculateGpa(global.USIAMS.results.resultsForStudentSemester(student.id, lastSemester.id).map(withCredits)) : 0;
    const overallGpa = gpa.calculateGpa(results.map(withCredits));
    const currentCourses = attendance.currentCoursesFor(student);
    const balance = finance.balanceForStudent(student.id);
    const attendancePct = attendance.overallPercentageForStudent(student.id);

    document.getElementById("welcomeName").textContent = `${greetingPrefix()}, ${student.firstName}!`;
    document.getElementById("studentMetaLine").innerHTML = `
      ${util.escapeHtml(student.regNumber)} &bull; ${util.escapeHtml(programme.name)} &bull;
      ${util.escapeHtml(academic.collegeNameForDepartment(student.departmentId))} &bull;
      Year ${student.year} &bull; ${util.escapeHtml(semester.label)}, ${util.escapeHtml(academic.activeAcademicYear().label)}
    `;
    document.getElementById("regStatusBadge").innerHTML = `<span class="status-badge status-active">Registration ${semester.registrationOpen ? "Open" : "Closed"}</span>`;

    cards.renderStatGrid("statGrid", [
      { label: "Current Semester GPA", value: currentSemGpa.toFixed(2), icon: "bi-graph-up-arrow", tint: "primary" },
      { label: "Overall GPA", value: overallGpa.toFixed(2), icon: "bi-award", tint: "success", trend: gpa.classify(overallGpa) },
      { label: "Registered Courses", value: currentCourses.length, icon: "bi-journal-bookmark", tint: "info" },
      { label: "Outstanding Fees", value: util.formatCurrency(balance.balance), icon: "bi-cash-coin", tint: balance.balance > 0 ? "warning" : "success" }
    ]);

    // GPA trend chart
    const semesterGpas = semesters.map(s => gpa.calculateGpa(global.USIAMS.results.resultsForStudentSemester(student.id, s.id).map(withCredits)));
    charts.lineChart("gpaTrendChart",
      semesters.map(s => `${s.label.replace("Semester ", "S")} ${global.USIAMS.data.academicYears.find(a => a.id === s.academicYearId).label}`),
      [{ label: "Semester GPA", data: semesterGpas }],
      { scales: { y: { min: 0, max: 5 } } }
    );

    // Attendance doughnut
    const attRows = attendance.attendanceForStudent(student.id);
    charts.doughnutChart("attendanceChart", ["Attended", "Missed"], [
      attRows.reduce((s, r) => s + r.attended, 0),
      attRows.reduce((s, r) => s + r.missed, 0)
    ]);

    // Course performance (latest semester marks)
    if (lastSemester) {
      const semResults = global.USIAMS.results.resultsForStudentSemester(student.id, lastSemester.id);
      charts.barChart("coursePerformanceChart",
        semResults.map(r => r.courseId),
        [{ label: "Total Mark", data: semResults.map(r => r.totalMark) }]
      );
    }

    renderCurrentCourses(currentCourses);
    renderRecentResults(results.slice(-5).reverse());
    renderStudentNotifications(user);
    renderPendingRequests(student.id);
    renderUpcomingTimetable(student);
    renderAnnouncements();
  }

  function withCredits(result) {
    const course = global.USIAMS.courses.getCourse(result.courseId);
    return { ...result, credits: course ? course.credits : 0 };
  }

  function renderCurrentCourses(courses) {
    const el = document.getElementById("currentCoursesList");
    if (!courses.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-journal-x"></i>No courses registered yet this semester.</div>`; return; }
    el.innerHTML = courses.map(c => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <strong style="font-size:.85rem;">${c.id} - ${util.escapeHtml(c.title)}</strong>
          <div class="text-muted-usi" style="font-size:.76rem;">${c.credits} Credits &bull; ${c.type}</div>
        </div>
        <span class="status-badge status-active">Active</span>
      </div>
    `).join("");
  }

  function renderRecentResults(results) {
    const el = document.getElementById("recentResultsList");
    if (!results.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-clipboard-x"></i>No published results yet.</div>`; return; }
    el.innerHTML = results.map(r => {
      const course = global.USIAMS.courses.getCourse(r.courseId);
      const grade = gpa.gradeFromMark(r.totalMark);
      return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <strong style="font-size:.85rem;">${course.id} - ${util.escapeHtml(course.title)}</strong>
          <div class="text-muted-usi" style="font-size:.76rem;">Total: ${r.totalMark}/100</div>
        </div>
        <span class="status-badge status-active">${grade}</span>
      </div>`;
    }).join("");
  }

  function renderStudentNotifications(user) {
    const el = document.getElementById("dashNotificationsList");
    const list = global.USIAMS.notifications.forUser(user).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
    if (!list.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-bell-slash"></i>No notifications.</div>`; return; }
    el.innerHTML = list.map(n => {
      const meta = global.USIAMS.notifications.categoryIcon(n.category);
      return `<div class="notif-item ${n.read ? "" : "unread"}">
        <div class="notif-icon icon-tint-${meta.tint}"><i class="bi ${meta.icon}"></i></div>
        <div><div class="notif-title">${util.escapeHtml(n.title)}</div><div class="notif-time">${util.timeAgo(n.date)}</div></div>
      </div>`;
    }).join("");
  }

  function renderPendingRequests(studentId) {
    const el = document.getElementById("pendingRequestsList");
    const list = global.USIAMS.storage.getStorage("requests", global.USIAMS.data.seedRequests)
      .filter(r => r.studentId === studentId && !["RESOLVED", "REJECTED", "CLOSED"].includes(r.status));
    if (!list.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-check2-circle"></i>No pending requests.</div>`; return; }
    el.innerHTML = list.map(r => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><strong style="font-size:.85rem;">${r.id}</strong><div class="text-muted-usi" style="font-size:.76rem;">${util.escapeHtml(r.type)}</div></div>
        <span class="status-badge status-${r.status.toLowerCase()}">${util.titleCase(r.status)}</span>
      </div>`).join("");
  }

  function renderUpcomingTimetable(student) {
    const el = document.getElementById("upcomingTimetableList");
    const entries = global.USIAMS.timetable.timetableForProgrammeYear(student.programmeId, student.year).slice(0, 5);
    if (!entries.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-x"></i>No classes scheduled.</div>`; return; }
    el.innerHTML = entries.map(e => {
      const course = global.USIAMS.courses.getCourse(e.courseId);
      return `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><strong style="font-size:.85rem;">${course.id}</strong><div class="text-muted-usi" style="font-size:.76rem;">${e.day}, ${e.time} &bull; ${e.room}</div></div>
        <span class="text-muted-usi" style="font-size:.76rem;">${util.escapeHtml(e.lecturer)}</span>
      </div>`;
    }).join("");
  }

  function renderAnnouncements() {
    const el = document.getElementById("announcementsList");
    const items = [
      { title: "Mid-Semester Break", body: "Mid-semester break runs from 20-24 October 2026 across all campuses.", tone: "info" },
      { title: "Library Extended Hours", body: "The main library will remain open until midnight during examination weeks.", tone: "success" },
      { title: "Graduation Ceremony Save-the-Date", body: "The 2026 graduation ceremony is scheduled for 12 December 2026.", tone: "gold" }
    ];
    el.innerHTML = items.map(i => `
      <div class="d-flex gap-3 py-2 border-bottom">
        <div class="icon-tint-${i.tone}" style="width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-megaphone"></i></div>
        <div><strong style="font-size:.85rem;">${i.title}</strong><div class="text-muted-usi" style="font-size:.78rem;">${i.body}</div></div>
      </div>`).join("");
  }

  // ---------------------------------------------------------------------
  // UNIVERSITY / STAFF ADMIN DASHBOARD (shared shell for 10 staff roles)
  // ---------------------------------------------------------------------
  const ROLE_FOCUS = {
    FINANCE_OFFICER: { subtitle: "Here is today's finance and fee collection overview.", quick: ["finance"] },
    REGISTRATION_OFFICER: { subtitle: "Here is today's course registration overview.", quick: ["registration"] },
    EXAMINATION_OFFICER: { subtitle: "Here is today's results and examinations overview.", quick: ["results"] }
  };

  function renderAdminDashboard(user) {
    const students = global.USIAMS.data.students;
    const focus = ROLE_FOCUS[user.role];
    document.getElementById("welcomeName").textContent = `${greetingPrefix()}, ${user.name.split(" ")[0]}!`;
    document.getElementById("studentMetaLine").textContent = focus ? focus.subtitle : `${user.roleLabel} overview across the university.`;

    const active = students.filter(s => s.status === "Active").length;
    const graduated = global.USIAMS.data.alumni.length;

    cards.renderStatGrid("statGrid", [
      { label: "Total Students", value: students.length, icon: "bi-people", tint: "primary" },
      { label: "Active Students", value: active, icon: "bi-person-check", tint: "success" },
      { label: "Graduated Students", value: graduated, icon: "bi-mortarboard", tint: "gold" },
      { label: "Programmes", value: global.USIAMS.data.programmes.length, icon: "bi-diagram-3", tint: "info" }
    ]);

    document.getElementById("orgUnitStats").innerHTML = [
      { label: "Colleges", value: global.USIAMS.data.orgUnits.filter(u => u.type === "College").length },
      { label: "Institutes", value: global.USIAMS.data.orgUnits.filter(u => u.type === "Institute").length },
      { label: "Schools", value: global.USIAMS.data.orgUnits.filter(u => u.type === "School").length },
      { label: "Departments", value: global.USIAMS.data.departments.length },
      { label: "Courses", value: global.USIAMS.data.courses.filter(c => c.status === "Active").length }
    ].map(s => `<div class="col-6 col-md"><div class="usi-card p-3 text-center"><div class="stat-value" style="font-size:1.3rem;">${s.value}</div><div class="stat-label mb-0">${s.label}</div></div></div>`).join("");

    // Student population by college
    const byCollege = global.USIAMS.data.orgUnits.filter(u => u.type === "College").map(u => ({
      name: u.id,
      count: global.USIAMS.data.departments.filter(d => d.unitId === u.id).reduce((sum, d) => sum + students.filter(s => s.departmentId === d.id).length, 0)
    }));
    charts.doughnutChart("populationByCollegeChart", byCollege.map(c => c.name), byCollege.map(c => c.count));

    // Population by programme (top 8)
    const byProgramme = global.USIAMS.data.programmes.map(p => ({ name: p.code, count: students.filter(s => s.programmeId === p.id).length }));
    charts.barChart("populationByProgrammeChart", byProgramme.map(p => p.name), [{ label: "Students", data: byProgramme.map(p => p.count) }]);

    // Registration trend (mocked historical + current)
    charts.lineChart("registrationTrendChart", ["AY2023 S1", "AY2023 S2", "AY2024 S1", "AY2024 S2", "AY2025 S1"], [
      { label: "Registrations", data: [180, 195, 210, 225, students.length] }
    ]);

    // GPA distribution across all published results
    const allResults = global.USIAMS.data.results;
    const dist = gpa.gradeDistribution(allResults);
    charts.barChart("gpaDistributionChart", Object.keys(dist), [{ label: "Students", data: Object.values(dist) }]);

    // Graduation trend (alumni by year)
    const gradYears = [...new Set(global.USIAMS.data.alumni.map(a => a.graduationYear))].sort();
    charts.lineChart("graduationTrendChart", gradYears, [{ label: "Graduates", data: gradYears.map(y => global.USIAMS.data.alumni.filter(a => a.graduationYear === y).length) }]);

    renderRecentActivities();
    renderSystemHealth();
  }

  function renderRecentActivities() {
    const el = document.getElementById("recentActivitiesList");
    if (!el) return;
    const items = [
      { icon: "bi-person-plus", tint: "success", text: "New student STU-0054 completed enrolment.", time: "2026-09-13T07:20:00" },
      { icon: "bi-pencil-square", tint: "info", text: "34 students registered for AY2025/2026 - Semester I.", time: "2026-09-12T15:00:00" },
      { icon: "bi-clipboard-data", tint: "primary", text: "Results for CP203 Database Systems were published.", time: "2026-09-12T10:30:00" },
      { icon: "bi-cash-coin", tint: "warning", text: "Payment of TZS 1,800,000 received from student STU-0011.", time: "2026-09-11T14:00:00" },
      { icon: "bi-envelope-paper", tint: "danger", text: "New clearance request escalated to Head of Department.", time: "2026-09-04T12:00:00" },
      { icon: "bi-flag", tint: "gold", text: "Complaint CMP-0003 escalated to bank reconciliation team.", time: "2026-09-09T09:00:00" }
    ];
    el.innerHTML = items.map(i => `
      <div class="activity-item">
        <div class="activity-icon icon-tint-${i.tint}"><i class="bi ${i.icon}"></i></div>
        <div><div style="font-size:.85rem;">${i.text}</div><div class="notif-time">${util.timeAgo(i.time)}</div></div>
      </div>`).join("");
  }

  function renderSystemHealth() {
    const el = document.getElementById("systemHealthList");
    if (!el) return;
    const rows = [
      { name: "Database Connection", status: "Operational", tone: "success" },
      { name: "API Gateway", status: "Operational", tone: "success" },
      { name: "Notification Service", status: "Operational", tone: "success" },
      { name: "File Storage", status: "78% Capacity", tone: "warning" },
      { name: "Security & Access Control", status: "Secure", tone: "success" }
    ];
    el.innerHTML = rows.map(r => `
      <div class="system-health-row">
        <span class="health-name"><span class="system-status-dot" style="background:var(--${r.tone === "success" ? "success" : "warning"})"></span>${r.name}</span>
        <span class="status-badge status-${r.tone === "success" ? "active" : "warning"}">${r.status}</span>
      </div>`).join("");
  }

  // ---------------------------------------------------------------------
  // QA DASHBOARD (strictly read-only)
  // ---------------------------------------------------------------------
  function renderQaDashboard(user) {
    document.getElementById("welcomeName").textContent = `${greetingPrefix()}, ${user.name.split(" ")[0]}!`;
    document.getElementById("studentMetaLine").textContent = "Quality Assurance overview - read-only access across all academic records.";

    const students = global.USIAMS.data.students;
    const flags = global.USIAMS.data.qaFlags;
    cards.renderStatGrid("statGrid", [
      { label: "Total Students", value: students.length, icon: "bi-people", tint: "primary" },
      { label: "Active Students", value: students.filter(s => s.status === "Active").length, icon: "bi-person-check", tint: "success" },
      { label: "Open Quality Flags", value: flags.filter(f => f.status === "OPEN").length, icon: "bi-flag", tint: "danger" },
      { label: "Published Results", value: global.USIAMS.data.results.length, icon: "bi-clipboard-data", tint: "info" }
    ]);

    const dist = gpa.gradeDistribution(global.USIAMS.data.results);
    charts.barChart("gpaDistributionChart", Object.keys(dist), [{ label: "Students", data: Object.values(dist) }]);

    charts.lineChart("registrationTrendChart", ["AY2023 S1", "AY2023 S2", "AY2024 S1", "AY2024 S2", "AY2025 S1"], [
      { label: "Registrations", data: [180, 195, 210, 225, students.length] }
    ]);

    const byProgramme = global.USIAMS.data.programmes.map(p => ({ name: p.code, count: students.filter(s => s.programmeId === p.id).length }));
    charts.barChart("populationByProgrammeChart", byProgramme.map(p => p.name), [{ label: "Students", data: byProgramme.map(p => p.count) }]);

    const byCollege = global.USIAMS.data.orgUnits.filter(u => u.type === "College").map(u => ({
      name: u.id, count: global.USIAMS.data.departments.filter(d => d.unitId === u.id).reduce((sum, d) => sum + students.filter(s => s.departmentId === d.id).length, 0)
    }));
    charts.doughnutChart("populationByCollegeChart", byCollege.map(c => c.name), byCollege.map(c => c.count));

    const indicators = [
      { label: "Missing Student Information", count: flags.filter(f => f.category === "Student Records").length },
      { label: "Duplicate Records", count: 1 },
      { label: "Missing Results", count: flags.filter(f => f.category === "Results").length },
      { label: "Invalid Course Registration", count: flags.filter(f => f.category === "Registration").length },
      { label: "Missing Attendance", count: flags.filter(f => f.category === "Attendance").length },
      { label: "Unusual Grade Patterns", count: 1 }
    ];
    document.getElementById("qualityIndicatorsList").innerHTML = indicators.map(i => `
      <div class="quality-indicator-row">
        <span style="font-size:.85rem;">${i.label}</span>
        <span class="status-badge ${i.count > 0 ? "status-warning" : "status-active"}">${i.count} ${i.count === 1 ? "issue" : "issues"}</span>
      </div>`).join("");
  }

  // ---------------------------------------------------------------------
  // LECTURER DASHBOARD
  // ---------------------------------------------------------------------
  function renderLecturerDashboard(user) {
    document.getElementById("welcomeName").textContent = `${greetingPrefix()}, ${user.name.split(" ")[1] || user.name}!`;
    const myTimetable = global.USIAMS.timetable.timetableForLecturer(user.name);
    const myCourseIds = [...new Set(myTimetable.map(e => e.courseId))];
    const myStudentCount = global.USIAMS.data.students.filter(s => {
      const courses = global.USIAMS.attendance.currentCoursesFor(s);
      return courses.some(c => myCourseIds.includes(c.id));
    }).length;

    document.getElementById("studentMetaLine").textContent = `${util.escapeHtml(global.USIAMS.academic.getDepartment(user.departmentId)?.name || "")} - ${myCourseIds.length} course(s) this semester.`;

    cards.renderStatGrid("statGrid", [
      { label: "Courses Teaching", value: myCourseIds.length, icon: "bi-journal-bookmark", tint: "primary" },
      { label: "Total Students", value: myStudentCount, icon: "bi-people", tint: "info" },
      { label: "Classes This Week", value: myTimetable.length, icon: "bi-calendar3-week", tint: "success" },
      { label: "Pending Result Entries", value: 2, icon: "bi-pencil-square", tint: "warning" }
    ]);

    const el = document.getElementById("myCoursesList");
    if (!myCourseIds.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-journal-x"></i>No courses assigned this semester.</div>`; }
    else {
      el.innerHTML = myCourseIds.map(id => {
        const course = global.USIAMS.courses.getCourse(id);
        const enrolled = global.USIAMS.data.students.filter(s => global.USIAMS.attendance.currentCoursesFor(s).some(c => c.id === id)).length;
        return `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div><strong style="font-size:.85rem;">${course.id} - ${util.escapeHtml(course.title)}</strong><div class="text-muted-usi" style="font-size:.76rem;">${enrolled} students enrolled</div></div>
          <span class="status-badge status-active">${course.credits} Credits</span>
        </div>`;
      }).join("");
    }

    const ttEl = document.getElementById("myTimetableList");
    if (!myTimetable.length) { ttEl.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-x"></i>No classes scheduled.</div>`; }
    else {
      ttEl.innerHTML = myTimetable.map(e => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div><strong style="font-size:.85rem;">${e.courseId}</strong><div class="text-muted-usi" style="font-size:.76rem;">${e.day}, ${e.time}</div></div>
          <span class="text-muted-usi" style="font-size:.76rem;">${e.room}</span>
        </div>`).join("");
    }
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.dashboard = { renderStudentDashboard, renderAdminDashboard, renderQaDashboard, renderLecturerDashboard };

})(window);
