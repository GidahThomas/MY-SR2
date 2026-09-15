/* =========================================================
   USIAMS - data/announcements.js
   University-wide announcements. Previously the dashboards showed
   a hardcoded, unchangeable list of three sample announcements -
   this replaces that with real, staff-published data (localStorage-
   backed via js/announcements.js) that can target everyone or a
   specific role, and that recent entries auto-notify users about.
   ========================================================= */
(function (global) {
  "use strict";

  const ANNOUNCEMENT_TONES = ["info", "success", "warning", "gold"];
  // "ALL" or one role key from data/users.js ROLES.
  const ANNOUNCEMENT_AUDIENCES = ["ALL", "STUDENT", "LECTURER"];

  const SEED_ANNOUNCEMENTS = [
    { id: "ANN-0001", title: "Mid-Semester Break", body: "Mid-semester break runs from 20-24 October 2026 across all campuses - see the Academic Calendar for the full schedule.", audience: "ALL", tone: "info", publishedBy: "USR-0009", publishedDate: "2026-09-01" },
    { id: "ANN-0002", title: "Library Extended Hours", body: "The main library will remain open until midnight during examination weeks. Visit the Library module to check current opening hours.", audience: "ALL", tone: "success", publishedBy: "USR-0019", publishedDate: "2026-09-03" },
    { id: "ANN-0003", title: "Annual Graduation Ceremony - Save the Date", body: "The 2025/2026 graduation ceremony is scheduled for 23 October 2026. Finalists should check their clearance status on the Graduation module.", audience: "ALL", tone: "gold", publishedBy: "USR-0009", publishedDate: "2026-09-05" },
    { id: "ANN-0004", title: "E-Learning Portal Now Available", body: "Lecturers can now publish course materials and assignments, and students can submit work, directly from the E-Learning module.", audience: "ALL", tone: "info", publishedBy: "USR-0009", publishedDate: "2026-09-07" },
    { id: "ANN-0005", title: "Semester I Registration Now Open", body: "Course registration for AY2025/2026 - Semester I is open until 15 October 2025. Register early to secure your preferred electives.", audience: "STUDENT", tone: "warning", publishedBy: "USR-0012", publishedDate: "2026-09-08" },
    { id: "ANN-0006", title: "Read the Student By-Laws and Regulations", body: "All students are required to read and comply with the university's By-Laws and Regulations, covering academic integrity, attendance, examinations and conduct. Available under Student By-Laws in the sidebar.", audience: "STUDENT", tone: "info", publishedBy: "USR-0009", publishedDate: "2026-09-09" },
    { id: "ANN-0007", title: "Semester I Result Submission Deadline", body: "All lecturers must submit final results for AY2025/2026 - Semester I coursework no later than two weeks after the end-of-semester examination period.", audience: "LECTURER", tone: "warning", publishedBy: "USR-0010", publishedDate: "2026-09-10" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.announcementTones = ANNOUNCEMENT_TONES;
  global.USIAMS.data.announcementAudiences = ANNOUNCEMENT_AUDIENCES;
  global.USIAMS.data.seedAnnouncements = SEED_ANNOUNCEMENTS;

  // Merge recent announcements into the notification feed loaded by
  // data/notifications.js (must be included on the page before this
  // file - same requirement as data/calendar.js). "ALL"-audience
  // announcements become one target:"ALL" notification; role-scoped
  // announcements become one notification per matching user, so a
  // lecturer-only announcement never notifies a student.
  if (global.USIAMS.data.seedNotifications) {
    const REFERENCE_DATE = "2026-09-12";
    const WINDOW_DAYS = 14;
    const inWindow = (dateStr) => Math.abs((new Date(dateStr) - new Date(REFERENCE_DATE)) / 86400000) <= WINDOW_DAYS;

    const generated = [];
    SEED_ANNOUNCEMENTS.filter(a => inWindow(a.publishedDate)).forEach(a => {
      const base = { category: "Academic", title: `Announcement: ${a.title}`, description: a.body, date: `${a.publishedDate}T09:00:00`, read: false };
      if (a.audience === "ALL") {
        generated.push({ id: `NTF-ANN-${a.id}`, target: "ALL", ...base });
      } else {
        (global.USIAMS.data.users || []).filter(u => u.role === a.audience).forEach(u => {
          generated.push({ id: `NTF-ANN-${a.id}-${u.id}`, target: u.id, ...base });
        });
      }
    });
    global.USIAMS.data.seedNotifications = [...global.USIAMS.data.seedNotifications, ...generated];
  }

})(window);
