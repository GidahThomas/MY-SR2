/* =========================================================
   USIAMS - data/notifications.js
   Seed notifications (localStorage-backed via js/notifications.js).
   Notifications target either a specific user id, a role, or
   "ALL" for every signed-in user.
   ========================================================= */
(function (global) {
  "use strict";

  const NOTIFICATION_CATEGORIES = ["Academic", "Finance", "Registration", "Results", "System", "Requests"];

  const SEED_NOTIFICATIONS = [
    { id: "NTF-0001", target: "USR-0001", category: "Results", title: "Semester Results Published", description: "Your results for AY2024/2025 - Semester II have been published.", date: "2026-09-10T09:00:00", read: false },
    { id: "NTF-0002", target: "USR-0001", category: "Registration", title: "Registration Period Open", description: "Course registration for AY2025/2026 - Semester I is now open until 15 Oct 2026.", date: "2026-09-08T08:00:00", read: false },
    { id: "NTF-0003", target: "USR-0001", category: "Finance", title: "Fee Balance Reminder", description: "You have an outstanding balance on your tuition invoice for this academic year.", date: "2026-09-07T10:30:00", read: true },
    { id: "NTF-0004", target: "USR-0001", category: "Requests", title: "Request Status Updated", description: "Your Course Change request (REQ-0002) is now In Progress.", date: "2026-09-06T08:35:00", read: false },
    { id: "NTF-0005", target: "ALL", category: "System", title: "Scheduled Maintenance Notice", description: "USIAMS will undergo scheduled maintenance on Saturday from 22:00 to 23:00.", date: "2026-09-05T17:00:00", read: false },
    { id: "NTF-0006", target: "USR-0001", category: "Academic", title: "Advisor Meeting Scheduled", description: "Your academic advisor has scheduled a check-in meeting for next week.", date: "2026-09-04T12:00:00", read: true },
    { id: "NTF-0007", target: "ALL", category: "System", title: "New Semester Timetable Released", description: "The timetable for AY2025/2026 - Semester I has been published.", date: "2026-09-01T09:00:00", read: true },
    { id: "NTF-0008", target: "USR-0009", category: "System", title: "New Student Enrolments", description: "12 new students completed enrolment this week across all colleges.", date: "2026-09-12T09:00:00", read: false },
    { id: "NTF-0009", target: "USR-0009", category: "Finance", title: "Fee Collection Update", description: "Fee collection for AY2025/2026 has reached 62% of the total billed amount.", date: "2026-09-11T09:00:00", read: false },
    { id: "NTF-0010", target: "USR-0013", category: "System", title: "New Quality Flags Raised", description: "3 new data quality flags were raised during the weekly audit sweep.", date: "2026-09-11T06:00:00", read: false },
    { id: "NTF-0011", target: "USR-0011", category: "Finance", title: "Large Payment Received", description: "A payment of TZS 1,800,000 was received and requires reconciliation.", date: "2026-09-10T14:00:00", read: true },
    { id: "NTF-0012", target: "USR-0012", category: "Registration", title: "Registration Deadline Approaching", description: "Course registration for AY2025/2026 - Semester I closes on 15 Oct 2026.", date: "2026-09-09T08:00:00", read: false }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.notificationCategories = NOTIFICATION_CATEGORIES;
  global.USIAMS.data.seedNotifications = SEED_NOTIFICATIONS;

})(window);
