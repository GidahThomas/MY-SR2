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
          title: s.fullName, subtitle: `${s.regNumber} - ${global.USIAMS.academic.getProgramme(s.programmeId)?.name || ""}`,
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

    return groups;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.search = { query };

})(window);
