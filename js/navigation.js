/* =========================================================
   USIAMS - js/navigation.js
   Sidebar menu configuration and breadcrumb helper.
   The sidebar is intentionally data-driven: every entry below
   declares which roles may see it, so hiding/showing links for
   a role never requires touching HTML on every page.

   NOTE: hiding a link here is a UX convenience only. It is NOT a
   security control - see js/auth.js requireAuth()/isReadOnlyRole()
   for the (still frontend-only) access checks, and the top-level
   comment in js/auth.js for what the real backend must enforce.
   ========================================================= */
(function (global) {
  "use strict";

  const ALL_ROLES = Object.keys(global.USIAMS.data.roles);
  const NOT_STUDENT = ALL_ROLES.filter(r => r !== "STUDENT");

  function dashboardHrefFor(role) {
    if (role === "STUDENT") return "pages/student-dashboard.html";
    if (role === "LECTURER") return "pages/lecturer-dashboard.html";
    if (role === "QUALITY_ASSURANCE_OFFICER") return "pages/qa-dashboard.html";
    return "pages/admin-dashboard.html";
  }

  function buildMenu(role) {
    return [
      { section: "Overview" },
      { label: "Dashboard", icon: "bi-speedometer2", href: dashboardHrefFor(role), roles: ALL_ROLES, match: ["student-dashboard.html", "admin-dashboard.html", "qa-dashboard.html", "lecturer-dashboard.html"] },

      { section: "Academic" },
      { label: "Students", icon: "bi-people", href: "pages/students.html", roles: NOT_STUDENT },
      { label: "Academics", icon: "bi-diagram-3", href: "pages/academics.html", roles: NOT_STUDENT },
      { label: "Courses", icon: "bi-journal-bookmark", href: "pages/courses.html", roles: NOT_STUDENT },
      { label: "Registration", icon: "bi-pencil-square", href: "pages/registration.html", roles: ["STUDENT", "REGISTRATION_OFFICER", "ACADEMIC_ADVISOR", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT", "UNIVERSITY_ADMIN", "QUALITY_ASSURANCE_OFFICER"] },
      { label: "Results", icon: "bi-clipboard-data", href: "pages/results.html", roles: ALL_ROLES },
      { label: "Attendance", icon: "bi-calendar-check", href: "pages/attendance.html", roles: ALL_ROLES },
      { label: "Timetable", icon: "bi-calendar3-week", href: "pages/timetable.html", roles: ALL_ROLES },

      { section: "Services" },
      { label: "Finance", icon: "bi-cash-coin", href: "pages/finance.html", roles: ["STUDENT", "FINANCE_OFFICER", "UNIVERSITY_ADMIN", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "SYSTEM_ADMIN"] },
      { label: "Documents", icon: "bi-file-earmark-text", href: "pages/documents.html", roles: ["STUDENT", "REGISTRATION_OFFICER", "DEPARTMENT_ADMIN", "UNIVERSITY_ADMIN"] },
      { label: "Requests", icon: "bi-envelope-paper", href: "pages/requests.html", roles: ALL_ROLES },
      { label: "Complaints", icon: "bi-flag", href: "pages/complaints.html", roles: ALL_ROLES },
      { label: "Notifications", icon: "bi-bell", href: "pages/notifications.html", roles: ALL_ROLES },
      { label: "Internship", icon: "bi-briefcase", href: "pages/internship.html", roles: ["STUDENT", "ACADEMIC_ADVISOR", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT", "UNIVERSITY_ADMIN"] },
      { label: "Graduation", icon: "bi-mortarboard", href: "pages/graduation.html", roles: ["STUDENT", "REGISTRATION_OFFICER", "HEAD_OF_DEPARTMENT", "UNIVERSITY_ADMIN"] },
      { label: "Alumni", icon: "bi-people-fill", href: "pages/alumni.html", roles: NOT_STUDENT },
      { label: "E-Learning", icon: "bi-laptop", href: "pages/elearning.html", roles: ["STUDENT", "LECTURER"] },
      { label: "Library", icon: "bi-journal-richtext", href: "pages/library.html", roles: ["STUDENT", "LIBRARIAN", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
      { label: "Hostel", icon: "bi-houses", href: "pages/hostel.html", roles: ["STUDENT", "HOSTEL_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
      { label: "Admissions", icon: "bi-person-plus", href: "pages/admissions.html", roles: ["REGISTRATION_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },

      { section: "Governance" },
      { label: "Quality Assurance", icon: "bi-patch-check", href: "pages/quality-assurance.html", roles: ["UNIVERSITY_ADMIN", "QUALITY_ASSURANCE_OFFICER", "HEAD_OF_DEPARTMENT", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "SYSTEM_ADMIN"] },
      { label: "Reports", icon: "bi-bar-chart-line", href: "pages/reports.html", roles: NOT_STUDENT },
      { label: "Administration", icon: "bi-gear-wide-connected", href: "pages/administration.html", roles: ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
      { label: "Audit Logs", icon: "bi-shield-lock", href: "pages/audit-logs.html", roles: ["UNIVERSITY_ADMIN", "QUALITY_ASSURANCE_OFFICER", "SYSTEM_ADMIN", "EXAMINATION_OFFICER"] },
      { label: "Settings", icon: "bi-sliders", href: "pages/settings.html", roles: ALL_ROLES }
    ];
  }

  function menuForRole(role) {
    return buildMenu(role).filter(item => item.section || (item.roles || []).includes(role));
  }

  const PAGE_TITLES = {
    "index.html": "Home",
    "login.html": "Sign In",
    "student-dashboard.html": "Student Dashboard",
    "admin-dashboard.html": "Administration Dashboard",
    "qa-dashboard.html": "Quality Assurance Dashboard",
    "lecturer-dashboard.html": "Lecturer Dashboard",
    "students.html": "Student Management",
    "student-profile.html": "Student Profile",
    "academics.html": "Academic Structure",
    "courses.html": "Course Management",
    "registration.html": "Course Registration",
    "results.html": "Results & Transcripts",
    "attendance.html": "Attendance",
    "timetable.html": "Timetable",
    "finance.html": "Finance & Fees",
    "documents.html": "Documents",
    "requests.html": "Requests",
    "complaints.html": "Complaints",
    "notifications.html": "Notifications",
    "internship.html": "Internship",
    "graduation.html": "Graduation Clearance",
    "alumni.html": "Alumni",
    "elearning.html": "E-Learning",
    "library.html": "Library",
    "hostel.html": "Hostel & Accommodation",
    "admissions.html": "Admissions",
    "quality-assurance.html": "Quality Assurance",
    "reports.html": "Reports",
    "administration.html": "Administration",
    "audit-logs.html": "Audit Logs",
    "settings.html": "Settings",
    "403.html": "Access Denied",
    "404.html": "Page Not Found",
    "500.html": "System Error"
  };

  function currentPageFile() {
    const parts = window.location.pathname.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "index.html";
  }

  function pageTitle() {
    return PAGE_TITLES[currentPageFile()] || "USIAMS";
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.navigation = { menuForRole, currentPageFile, pageTitle, dashboardHrefFor };

})(window);
