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

  // Set by whichever dashboard is being rendered. util.studentLabel()
  // consults it to decide whether the viewer may see student names or only
  // registration numbers, and the ROLE_NEEDS_ATTENTION panels below read it
  // from inside their build() callbacks.
  let currentUser = null;

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
    currentUser = user;
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

    document.getElementById("welcomeName").textContent = `${greetingPrefix()}, ${student.firstName}!`;
    document.getElementById("studentMetaLine").innerHTML = `
      ${util.escapeHtml(student.regNumber)} &bull; ${util.escapeHtml(programme.name)} &bull;
      ${util.escapeHtml(academic.collegeNameForDepartment(student.departmentId))} &bull;
      Year ${student.year} &bull; ${util.escapeHtml(semester.label)}, ${util.escapeHtml(academic.activeAcademicYear().label)}
    `;
    document.getElementById("regStatusBadge").innerHTML = `<span class="status-badge status-active">Registration ${semester.registrationOpen ? "Open" : "Closed"}</span>`;

    cards.renderStatGrid("statGrid", [
      { label: "Current Semester GPA", value: currentSemGpa.toFixed(2), icon: "bi-graph-up-arrow", tint: "primary", private: true },
      { label: "Overall GPA", value: overallGpa.toFixed(2), icon: "bi-award", tint: "success", trend: gpa.classify(overallGpa), private: true },
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
    if (global.USIAMS.classChecklist) global.USIAMS.classChecklist.start("todayClassesList", student);
    renderAnnouncements(user.role);
    renderStudentNeedsAttention(user, student);
    renderBylawsReminder(student);
    renderProfileReminder(student);
  }

  function renderProfileReminder(student) {
    const banner = document.getElementById("profileReminderBanner");
    if (!banner) return;
    const pct = global.USIAMS.students.profileCompletionPercent(student);
    banner.classList.toggle("d-none", pct >= 100);
    if (pct < 100) document.getElementById("profileReminderPct").textContent = `${pct}%`;
  }

  // Shows until the student either acknowledges the by-laws (permanent,
  // tracked per student - see pages/bylaws.html) or dismisses for this
  // browser session ("Remind Me Later", sessionStorage so it returns
  // next time they sign in).
  function renderBylawsReminder(student) {
    const banner = document.getElementById("bylawsReminderBanner");
    if (!banner) return;
    const acknowledged = global.USIAMS.storage.getStorage(`bylawsAcknowledged.${student.id}`, false);
    const dismissedThisSession = sessionStorage.getItem("usiams.bylawsBannerDismissed") === "1";
    banner.classList.toggle("d-none", acknowledged || dismissedThisSession);
    if (acknowledged || dismissedThisSession) return;
    document.getElementById("dismissBylawsBannerBtn").addEventListener("click", () => {
      sessionStorage.setItem("usiams.bylawsBannerDismissed", "1");
      banner.classList.add("d-none");
    });
  }

  // "Now" for demo purposes - see data/calendar.js for why this mirrors
  // the same fixed reference date rather than using the real new Date().
  const DEMO_TODAY = "2026-09-12";

  // Pulls together anything across the new modules (library, hostel,
  // e-learning, calendar) that genuinely needs the student's attention,
  // instead of making them go check four separate pages to find out.
  function renderStudentNeedsAttention(user, student) {
    const el = document.getElementById("needsAttentionList");
    if (!el) return;
    const items = [];

    if (global.USIAMS.library) {
      const overdue = global.USIAMS.library.loansForStudent(student.id).filter(l => global.USIAMS.library.effectiveStatus(l) === "Overdue");
      overdue.forEach(l => {
        const book = global.USIAMS.library.getBook(l.bookId);
        items.push({ icon: "bi-journal-x", tint: "danger", text: `"${book ? book.title : l.bookId}" is overdue - please return it.`, href: "library.html" });
      });
    }

    if (global.USIAMS.hostel) {
      const allocation = global.USIAMS.hostel.activeAllocationForStudent(student.id);
      if (allocation && allocation.status === "Requested") {
        items.push({ icon: "bi-hourglass-split", tint: "warning", text: "Your accommodation request is still awaiting allocation.", href: "hostel.html" });
      }
    }

    if (global.USIAMS.elearning) {
      const courseIds = global.USIAMS.elearning.coursesForUser(user).map(c => c.id);
      const assignments = global.USIAMS.elearning.allAssignments().filter(a => courseIds.includes(a.courseId));
      assignments.forEach(a => {
        if (global.USIAMS.elearning.mySubmission(a.id, student.id)) return;
        const dueDiff = (new Date(a.dueDate) - new Date(DEMO_TODAY)) / 86400000;
        if (dueDiff < 0) items.push({ icon: "bi-exclamation-circle", tint: "danger", text: `Assignment "${a.title}" was due ${util.formatDate(a.dueDate)} and hasn't been submitted.`, href: "elearning.html" });
        else if (dueDiff <= 7) items.push({ icon: "bi-clock-history", tint: "warning", text: `Assignment "${a.title}" is due ${util.formatDate(a.dueDate)}.`, href: "elearning.html" });
      });
    }

    if (global.USIAMS.calendar) {
      const next = global.USIAMS.calendar.allEvents().find(e => new Date(e.date) >= new Date(DEMO_TODAY));
      if (next) items.push({ icon: "bi-calendar3", tint: "info", text: `${next.title} - ${util.formatDate(next.date)}${next.type === "Public Holiday" ? " (public holiday)" : ""}.`, href: "calendar.html" });
    }

    el.innerHTML = items.length ? items.map(i => `
      <a href="${i.href}" class="d-flex gap-3 py-2 border-bottom text-decoration-none">
        <div class="icon-tint-${i.tint}" style="width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi ${i.icon}"></i></div>
        <div style="font-size:.85rem;color:var(--text);">${util.escapeHtml(i.text)}</div>
      </a>`).join("") : `<div class="empty-state"><i class="bi bi-check2-circle"></i>Nothing needs your attention right now.</div>`;
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

  function renderAnnouncements(role) {
    if (!global.USIAMS.announcements) return;
    global.USIAMS.announcements.renderList("announcementsList", global.USIAMS.announcements.recent(role, 3));
  }

  // ---------------------------------------------------------------------
  // UNIVERSITY / STAFF ADMIN DASHBOARD (shared shell for 10 staff roles)
  // ---------------------------------------------------------------------
  const ROLE_FOCUS = {
    FINANCE_OFFICER: { subtitle: "Here is today's finance and fee collection overview." },
    REGISTRATION_OFFICER: { subtitle: "Here is today's course registration and admissions overview." },
    EXAMINATION_OFFICER: { subtitle: "Here is today's results and examinations overview." },
    LIBRARIAN: { subtitle: "Here is today's library catalog and loans overview." },
    HOSTEL_OFFICER: { subtitle: "Here is today's hostel occupancy and allocations overview." }
  };

  // Every tile's `roles` list is copied verbatim from that destination
  // page's own requireAuth() call, so a role can never see a tile here
  // that then 403s them - see js/navigation.js for the same discipline
  // applied to the sidebar.
  const QUICK_ACTIONS = [
    { label: "Manage Students", icon: "bi-people", href: "students.html", roles: ["UNIVERSITY_ADMIN", "ACADEMIC_ADVISOR", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "EXAMINATION_OFFICER", "FINANCE_OFFICER", "REGISTRATION_OFFICER", "QUALITY_ASSURANCE_OFFICER", "SYSTEM_ADMIN", "LECTURER", "LIBRARIAN", "HOSTEL_OFFICER"] },
    { label: "Manage Courses", icon: "bi-journal-bookmark", href: "courses.html", roles: ["UNIVERSITY_ADMIN", "ACADEMIC_ADVISOR", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "EXAMINATION_OFFICER", "FINANCE_OFFICER", "REGISTRATION_OFFICER", "QUALITY_ASSURANCE_OFFICER", "SYSTEM_ADMIN", "LECTURER", "LIBRARIAN", "HOSTEL_OFFICER"] },
    { label: "Finance Overview", icon: "bi-cash-coin", href: "finance.html", roles: ["FINANCE_OFFICER", "UNIVERSITY_ADMIN", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "SYSTEM_ADMIN"] },
    { label: "Admissions", icon: "bi-person-plus", href: "admissions.html", roles: ["REGISTRATION_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
    { label: "Library", icon: "bi-journal-richtext", href: "library.html", roles: ["LIBRARIAN", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
    { label: "Hostel", icon: "bi-houses", href: "hostel.html", roles: ["HOSTEL_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
    { label: "Generate Reports", icon: "bi-bar-chart-line", href: "reports.html", roles: ["UNIVERSITY_ADMIN", "ACADEMIC_ADVISOR", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "EXAMINATION_OFFICER", "FINANCE_OFFICER", "REGISTRATION_OFFICER", "QUALITY_ASSURANCE_OFFICER", "SYSTEM_ADMIN", "LECTURER", "LIBRARIAN", "HOSTEL_OFFICER"] },
    { label: "Academic Calendar", icon: "bi-calendar3", href: "calendar.html", roles: null },
    { label: "Audit Logs", icon: "bi-shield-lock", href: "audit-logs.html", roles: ["UNIVERSITY_ADMIN", "QUALITY_ASSURANCE_OFFICER", "SYSTEM_ADMIN", "EXAMINATION_OFFICER"] },
    { label: "Administration", icon: "bi-gear-wide-connected", href: "administration.html", roles: ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
    { label: "Manage Users", icon: "bi-person-plus", href: "administration.html", roles: ["DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN"] }
  ];

  function renderAdminDashboard(user) {
    currentUser = user;
    const students = global.USIAMS.data.students;
    const focus = ROLE_FOCUS[user.role];
    document.getElementById("welcomeName").textContent = `${greetingPrefix()}, ${user.name.split(" ")[0]}!`;
    document.getElementById("studentMetaLine").textContent = focus ? focus.subtitle : `${user.roleLabel} overview across the university.`;

    cards.renderQuickActions("quickActionsGrid", QUICK_ACTIONS.filter(a => !a.roles || a.roles.includes(user.role)));

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

    // Registration trend: semester registrations recorded in the database,
    // oldest semester first. Rejected registrations are not counted.
    const registrations = (global.USIAMS.data.seedRegistrations || []).filter(r => r.status !== "Rejected");
    const trendSemesters = (global.USIAMS.data.semesters || [])
      .filter(s => registrations.some(r => r.semesterId === s.id))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const yearLabel = s => {
      const year = (global.USIAMS.data.academicYears || []).find(a => a.id === s.academicYearId);
      return `${s.label.replace("Semester ", "S")} ${year ? year.label : ""}`.trim();
    };
    charts.lineChart("registrationTrendChart", trendSemesters.map(yearLabel), [
      { label: "Registrations", data: trendSemesters.map(s => registrations.filter(r => r.semesterId === s.id).length) }
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
    renderRoleNeedsAttention(user);
  }

  // Librarian/Hostel Officer/Registration Officer each get their own
  // "needs attention" queue on the shared admin dashboard - everyone
  // else keeps the card hidden. Uses the same live accessors as global
  // search (USIAMS.library/hostel/admissions) rather than the static seed.
  const ROLE_NEEDS_ATTENTION = {
    LIBRARIAN: {
      title: "Overdue Library Loans",
      href: "library.html",
      build: () => global.USIAMS.library.allLoans()
        .filter(l => global.USIAMS.library.effectiveStatus(l) === "Overdue")
        .map(l => {
          const book = global.USIAMS.library.getBook(l.bookId);
          const student = global.USIAMS.students.getStudent(l.studentId);
          return { title: book ? book.title : l.bookId, subtitle: `${student ? util.studentLabel(student, currentUser) : l.studentId} - due ${util.formatDate(l.dueDate)}` };
        })
    },
    HOSTEL_OFFICER: {
      title: "Pending Accommodation Requests",
      href: "hostel.html",
      build: () => global.USIAMS.hostel.allAllocations()
        .filter(a => a.status === "Requested")
        .map(a => {
          const student = global.USIAMS.students.getStudent(a.studentId);
          return { title: student ? util.studentLabel(student, currentUser) : a.studentId, subtitle: `Requested ${util.formatDate(a.requestedDate)}` };
        })
    },
    REGISTRATION_OFFICER: {
      title: "Pending Admission Applications",
      href: "admissions.html",
      build: () => global.USIAMS.admissions.allApplications()
        .filter(a => a.status === "Submitted" || a.status === "Under Review")
        .map(a => ({ title: a.fullName, subtitle: `${a.id} - ${a.status}` }))
    }
  };

  function renderRoleNeedsAttention(user) {
    const card = document.getElementById("roleNeedsAttentionCard");
    if (!card) return;
    const config = ROLE_NEEDS_ATTENTION[user.role];
    if (!config) { card.classList.add("d-none"); return; }
    card.classList.remove("d-none");
    document.getElementById("roleNeedsAttentionTitle").innerHTML = `<i class="bi bi-exclamation-circle me-1"></i>${util.escapeHtml(config.title)}`;
    const rows = config.build();
    document.getElementById("roleNeedsAttentionList").innerHTML = rows.length ? rows.map(r => `
      <a href="${config.href}" class="d-flex justify-content-between align-items-center py-2 border-bottom text-decoration-none">
        <div><strong style="font-size:.85rem;color:var(--text);">${util.escapeHtml(r.title)}</strong><div class="text-muted-usi" style="font-size:.76rem;">${util.escapeHtml(r.subtitle)}</div></div>
        <i class="bi bi-arrow-right-short" style="color:var(--text-muted);"></i>
      </a>`).join("") : `<div class="empty-state"><i class="bi bi-check2-circle"></i>Nothing needs your attention right now.</div>`;
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
    currentUser = user;
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
    currentUser = user;
    document.getElementById("welcomeName").textContent = `${greetingPrefix()}, ${user.name.split(" ")[1] || user.name}!`;
    const myTimetable = global.USIAMS.timetable.timetableForLecturer(user.name);
    const myCourseIds = [...new Set(myTimetable.map(e => e.courseId))];
    const myStudentCount = global.USIAMS.data.students.filter(s => {
      const courses = global.USIAMS.attendance.currentCoursesFor(s);
      return courses.some(c => myCourseIds.includes(c.id));
    }).length;

    document.getElementById("studentMetaLine").textContent = `${util.escapeHtml(global.USIAMS.academic.getDepartment(user.departmentId)?.name || "")} - ${myCourseIds.length} course(s) this semester.`;

    const myElearningCourseIds = global.USIAMS.elearning ? global.USIAMS.elearning.coursesForUser(user).map(c => c.id) : [];
    const ungradedSubmissions = global.USIAMS.elearning
      ? global.USIAMS.elearning.allSubmissions().filter(s => s.status !== "Graded" && global.USIAMS.elearning.allAssignments().some(a => a.id === s.assignmentId && myElearningCourseIds.includes(a.courseId)))
      : [];

    cards.renderStatGrid("statGrid", [
      { label: "Courses Teaching", value: myCourseIds.length, icon: "bi-journal-bookmark", tint: "primary" },
      { label: "Total Students", value: myStudentCount, icon: "bi-people", tint: "info" },
      { label: "Classes This Week", value: myTimetable.length, icon: "bi-calendar3-week", tint: "success" },
      { label: "Ungraded Submissions", value: ungradedSubmissions.length, icon: "bi-pencil-square", tint: ungradedSubmissions.length ? "warning" : "success" }
    ]);

    renderNeedsGrading(ungradedSubmissions);

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

    renderAnnouncements(user.role);
  }

  function renderNeedsGrading(submissions) {
    const el = document.getElementById("needsGradingList");
    if (!el) return;
    if (!submissions.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-check2-circle"></i>No submissions waiting to be graded.</div>`; return; }
    el.innerHTML = submissions.map(s => {
      const assignment = global.USIAMS.elearning.allAssignments().find(a => a.id === s.assignmentId);
      const student = global.USIAMS.students.getStudent(s.studentId);
      return `<a href="elearning.html" class="d-flex justify-content-between align-items-center py-2 border-bottom text-decoration-none">
        <div><strong style="font-size:.85rem;color:var(--text);">${assignment ? util.escapeHtml(assignment.title) : s.assignmentId}</strong><div class="text-muted-usi" style="font-size:.76rem;">${student ? util.escapeHtml(util.studentLabel(student, currentUser)) : s.studentId} &bull; Submitted ${util.formatDate(s.submittedDate)}</div></div>
        <span class="status-badge status-submitted">Ungraded</span>
      </a>`;
    }).join("");
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.dashboard = { renderStudentDashboard, renderAdminDashboard, renderQaDashboard, renderLecturerDashboard };

})(window);
