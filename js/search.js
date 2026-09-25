/* =========================================================
   USIAMS - js/search.js
   Global search across students, courses, programmes, requests,
   complaints and notifications. Powers the navbar search box.
   ========================================================= */
(function (global) {
  "use strict";

  function query(term, user) {
    const q = term.toLowerCase();
    const groups = [];
    const data = global.USIAMS.data;
    const limit = 5;

    const students = data.students.filter(s =>
      s.fullName.toLowerCase().includes(q) || s.regNumber.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    ).slice(0, limit);
    if (students.length) {
      groups.push({
        label: "Students",
        items: students.map(s => ({
          title: global.USIAMS.util.studentLabel(s, user), subtitle: global.USIAMS.util.canViewStudentNames(user, s) ? `${s.regNumber} - ${global.USIAMS.academic.getProgramme(s.programmeId)?.name || ""}` : global.USIAMS.academic.getProgramme(s.programmeId)?.name || "",
          icon: "bi-person-badge", href: `pages/students.html?openStudent=${s.id}`
        }))
      });
    }

    const courses = data.courses.filter(c => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)).slice(0, limit);
    if (courses.length) {
      groups.push({
        label: "Courses",
        items: courses.map(c => ({ title: `${c.id} - ${c.title}`, subtitle: `${c.credits} Credits - ${c.type}`, icon: "bi-journal-bookmark", href: `pages/courses.html?openCourse=${c.id}` }))
      });
    }

    const programmes = data.programmes.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, limit);
    if (programmes.length) {
      groups.push({
        label: "Programmes",
        items: programmes.map(p => ({ title: p.name, subtitle: p.code, icon: "bi-mortarboard", href: `pages/academics.html?tab=programmes` }))
      });
    }

    const requests = global.USIAMS.storage.getStorage("requests", data.seedRequests).filter(r =>
      (user.role === "STUDENT" ? r.studentId === user.studentId : true) &&
      (r.type.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    ).slice(0, limit);
    if (requests.length) {
      groups.push({
        label: "Requests",
        items: requests.map(r => ({ title: `${r.id} - ${r.type}`, subtitle: r.status, icon: "bi-envelope-paper", href: `pages/requests.html?openRequest=${r.id}` }))
      });
    }

    const complaints = global.USIAMS.storage.getStorage("complaints", data.seedComplaints).filter(c =>
      (user.role === "STUDENT" ? c.studentId === user.studentId : true) &&
      (c.category.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    ).slice(0, limit);
    if (complaints.length) {
      groups.push({
        label: "Complaints",
        items: complaints.map(c => ({ title: `${c.id} - ${c.category}`, subtitle: c.status, icon: "bi-flag", href: `pages/complaints.html?openComplaint=${c.id}` }))
      });
    }

    const notifications = global.USIAMS.storage.getStorage("notifications", data.seedNotifications).filter(n =>
      (n.target === user.id || n.target === "ALL") && n.title.toLowerCase().includes(q)
    ).slice(0, limit);
    if (notifications.length) {
      groups.push({
        label: "Notifications",
        items: notifications.map(n => ({ title: n.title, subtitle: n.category, icon: "bi-bell", href: `pages/notifications.html` }))
      });
    }

    if (global.USIAMS.library) {
      const books = global.USIAMS.library.books().filter(b =>
        b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)
      ).slice(0, limit);
      if (books.length) {
        groups.push({
          label: "Library",
          items: books.map(b => ({ title: b.title, subtitle: `${b.author} - ${b.category}`, icon: "bi-journal-richtext", href: `pages/library.html` }))
        });
      }
    }

    if (global.USIAMS.hostel) {
      const hostels = global.USIAMS.hostel.hostels().filter(h => h.name.toLowerCase().includes(q)).slice(0, limit);
      if (hostels.length) {
        groups.push({
          label: "Hostel",
          items: hostels.map(h => ({ title: h.name, subtitle: `${h.gender} Hall`, icon: "bi-houses", href: `pages/hostel.html` }))
        });
      }
    }

    // E-Learning results are limited to the user's own registered/teaching
    // courses - showing materials for a course they can't select on the
    // page itself would be a confusing dead end, not a genuine result.
    // (coursesForUser() returns [] for roles with no courses of their own,
    // e.g. admins with no departmentId - safe, just yields no results.)
    if (global.USIAMS.elearning) {
      const myCourseIds = global.USIAMS.elearning.coursesForUser(user).map(c => c.id);
      const materials = global.USIAMS.elearning.allMaterials().filter(m =>
        myCourseIds.includes(m.courseId) && m.title.toLowerCase().includes(q)
      ).slice(0, limit);
      const assignments = global.USIAMS.elearning.allAssignments().filter(a =>
        myCourseIds.includes(a.courseId) && a.title.toLowerCase().includes(q)
      ).slice(0, limit);
      const elearningItems = [
        ...materials.map(m => ({ title: m.title, subtitle: `${m.courseId} - ${m.type}`, icon: "bi-file-earmark-text", href: `pages/elearning.html` })),
        ...assignments.map(a => ({ title: a.title, subtitle: `${a.courseId} - Assignment`, icon: "bi-clipboard-check", href: `pages/elearning.html` }))
      ].slice(0, limit);
      if (elearningItems.length) groups.push({ label: "E-Learning", items: elearningItems });
    }

    // Admissions applications are only searchable by the roles that can
    // actually open pages/admissions.html - matching its requireAuth().
    if (global.USIAMS.admissions && ["REGISTRATION_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"].includes(user.role)) {
      const applications = global.USIAMS.admissions.allApplications().filter(a =>
        a.fullName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
      ).slice(0, limit);
      if (applications.length) {
        groups.push({
          label: "Admissions",
          items: applications.map(a => ({ title: a.fullName, subtitle: `${a.id} - ${a.status}`, icon: "bi-person-plus", href: `pages/admissions.html` }))
        });
      }
    }

    if (global.USIAMS.calendar) {
      const events = global.USIAMS.calendar.allEvents().filter(e => e.title.toLowerCase().includes(q)).slice(0, limit);
      if (events.length) {
        groups.push({
          label: "Academic Calendar",
          items: events.map(e => ({ title: e.title, subtitle: e.type, icon: "bi-calendar3", href: `pages/calendar.html` }))
        });
      }
    }

    return groups;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.search = { query };

})(window);
