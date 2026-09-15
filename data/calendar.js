/* =========================================================
   USIAMS - data/calendar.js
   National calendar and university events.

   PUBLIC_HOLIDAYS are Tanzania's real official public holidays
   (Public Holidays Act, Cap. 35) for 2025 and 2026, covering the
   AY2025/2026 academic year this prototype treats as active. Fixed
   dates and the Christian Good Friday/Easter Monday dates are exact.
   The three Islamic holidays (Idd-el-Fitri, Idd-el-Haji, Mawlid) are
   lunar and only confirmed by moon sighting close to the date even
   in the real national calendar, so the dates here are the commonly
   published estimates and are marked "(approx.)" - exactly how
   Tanzanian public calendars themselves caveat them.

   ACADEMIC_CALENDAR follows the semester structure already defined
   in data/academic-structure.js (SEMESTERS) and typical Tanzanian
   university scheduling (Semester I ~Oct-Feb, Semester II ~Feb-Jun).
   UDOM's own internal almanac PDF was not accessible while building
   this, so these milestone dates are realistic placeholders, not
   verified against UDOM's actual published almanac.

   js/notifications.js merges both lists into the notification feed
   (target "ALL") so every signed-in user is notified of upcoming
   national holidays and university events.
   ========================================================= */
(function (global) {
  "use strict";

  const PUBLIC_HOLIDAYS = [
    { id: "HOL-2025-01", date: "2025-01-01", title: "New Year's Day" },
    { id: "HOL-2025-02", date: "2025-01-12", title: "Zanzibar Revolution Day" },
    { id: "HOL-2025-03", date: "2025-03-31", title: "Idd-el-Fitri (approx.)" },
    { id: "HOL-2025-04", date: "2025-04-07", title: "Karume Day" },
    { id: "HOL-2025-05", date: "2025-04-18", title: "Good Friday" },
    { id: "HOL-2025-06", date: "2025-04-21", title: "Easter Monday" },
    { id: "HOL-2025-07", date: "2025-04-26", title: "Union Day" },
    { id: "HOL-2025-08", date: "2025-05-01", title: "International Workers' Day" },
    { id: "HOL-2025-09", date: "2025-06-06", title: "Idd-el-Haji (approx.)" },
    { id: "HOL-2025-10", date: "2025-07-07", title: "Saba Saba Day" },
    { id: "HOL-2025-11", date: "2025-08-08", title: "Nane Nane Day" },
    { id: "HOL-2025-12", date: "2025-09-04", title: "Maulid Day (approx.)" },
    { id: "HOL-2025-13", date: "2025-10-14", title: "Nyerere Day" },
    { id: "HOL-2025-14", date: "2025-12-09", title: "Independence Day" },
    { id: "HOL-2025-15", date: "2025-12-25", title: "Christmas Day" },
    { id: "HOL-2025-16", date: "2025-12-26", title: "Boxing Day" },

    { id: "HOL-2026-01", date: "2026-01-01", title: "New Year's Day" },
    { id: "HOL-2026-02", date: "2026-01-12", title: "Zanzibar Revolution Day" },
    { id: "HOL-2026-03", date: "2026-03-20", title: "Idd-el-Fitri (approx.)" },
    { id: "HOL-2026-04", date: "2026-04-03", title: "Good Friday" },
    { id: "HOL-2026-05", date: "2026-04-06", title: "Easter Monday" },
    { id: "HOL-2026-06", date: "2026-04-07", title: "Karume Day" },
    { id: "HOL-2026-07", date: "2026-04-26", title: "Union Day" },
    { id: "HOL-2026-08", date: "2026-05-01", title: "International Workers' Day" },
    { id: "HOL-2026-09", date: "2026-05-27", title: "Idd-el-Haji (approx.)" },
    { id: "HOL-2026-10", date: "2026-07-07", title: "Saba Saba Day" },
    { id: "HOL-2026-11", date: "2026-08-08", title: "Nane Nane Day" },
    { id: "HOL-2026-12", date: "2026-08-25", title: "Maulid Day (approx.)" },
    { id: "HOL-2026-13", date: "2026-10-14", title: "Nyerere Day" },
    { id: "HOL-2026-14", date: "2026-12-09", title: "Independence Day" },
    { id: "HOL-2026-15", date: "2026-12-25", title: "Christmas Day" },
    { id: "HOL-2026-16", date: "2026-12-26", title: "Boxing Day" }
  ];

  const ACADEMIC_CALENDAR = [
    { id: "CAL-0001", date: "2025-09-22", endDate: "2025-09-26", title: "New Student Orientation Week", description: "Orientation programme for newly admitted students, all colleges/schools/institutes." },
    { id: "CAL-0002", date: "2025-10-01", title: "Semester I Registration Opens", description: "Course registration for AY2025/2026 - Semester I opens for continuing and new students." },
    { id: "CAL-0003", date: "2025-10-15", title: "Semester I Registration Deadline", description: "Last day to complete course registration for AY2025/2026 - Semester I." },
    { id: "CAL-0004", date: "2025-12-15", endDate: "2025-12-19", title: "Semester I Mid-Semester Break", description: "No lectures during the mid-semester break week." },
    { id: "CAL-0005", date: "2026-01-26", endDate: "2026-02-06", title: "Semester I End-of-Semester Examinations", description: "University-wide end-of-semester examination period." },
    { id: "CAL-0006", date: "2026-02-16", title: "Semester II Begins", description: "Lectures for AY2025/2026 - Semester II commence." },
    { id: "CAL-0007", date: "2026-03-02", title: "Semester II Registration Deadline", description: "Last day to complete course registration for AY2025/2026 - Semester II." },
    { id: "CAL-0008", date: "2026-04-20", endDate: "2026-04-24", title: "Semester II Mid-Semester Break", description: "No lectures during the mid-semester break week." },
    { id: "CAL-0009", date: "2026-06-15", endDate: "2026-06-26", title: "Semester II End-of-Semester Examinations", description: "University-wide end-of-semester examination period." },
    { id: "CAL-0010", date: "2026-10-23", title: "Annual Graduation Ceremony", description: "University-wide graduation ceremony for AY2025/2026 finalists." }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.publicHolidays = PUBLIC_HOLIDAYS;
  global.USIAMS.data.academicCalendar = ACADEMIC_CALENDAR;

  function allEvents() {
    return [
      ...PUBLIC_HOLIDAYS.map(h => ({ ...h, type: "Public Holiday" })),
      ...ACADEMIC_CALENDAR.map(e => ({ ...e, type: "Academic Calendar" }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function formatEventDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  // Every signed-in user gets notified ahead of national holidays and
  // university calendar milestones - this is the "system" broadcasting
  // the calendar automatically, not something a staff member has to
  // type up by hand for every event.
  function buildEventNotifications(referenceDate, windowDays, leadDays) {
    const ref = new Date(referenceDate);
    return allEvents()
      .filter(e => {
        const diffDays = (new Date(e.date) - ref) / 86400000;
        return diffDays >= -windowDays && diffDays <= windowDays;
      })
      .map(e => {
        const posted = new Date(e.date);
        posted.setDate(posted.getDate() - leadDays);
        const isHoliday = e.type === "Public Holiday";
        return {
          id: `NTF-CAL-${e.id}`,
          target: "ALL",
          category: "Academic",
          title: isHoliday ? `Public Holiday: ${e.title}` : e.title,
          description: isHoliday
            ? `${e.title} falls on ${formatEventDate(e.date)}. The university calendar has been updated accordingly.`
            : `${e.description || e.title} (${formatEventDate(e.date)}${e.endDate ? " to " + formatEventDate(e.endDate) : ""}).`,
          date: `${posted.toISOString().slice(0, 10)}T08:00:00`,
          read: false
        };
      });
  }

  // Merge into the notification feed loaded by data/notifications.js
  // (which must be included on the page before this file).
  if (global.USIAMS.data.seedNotifications) {
    global.USIAMS.data.seedNotifications = [
      ...global.USIAMS.data.seedNotifications,
      ...buildEventNotifications("2026-09-12", 60, 7)
    ];
  }

  global.USIAMS.calendar = { allEvents };

})(window);
