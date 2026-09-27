/* =========================================================
   USIAMS - data/registrations.js
   Seed course registrations for the active semester (AY2025-S1):
   every active student, six or seven courses each.
   js/registration.js copies this into localStorage on first run
   (see USIAMS.storage.ensureSeed) so Reports > Registration
   Report and the admin/registration-officer views have real data
   to show before anyone has used the interactive registration
   flow - new registrations submitted during the demo persist on
   top of this seed exactly like requests/complaints/notifications.
   ========================================================= */
(function (global) {
  "use strict";

  const { seededMark } = global.USIAMS.shared;

  function buildSeedRegistrations() {
    const registrations = [];
    const semesterId = "AY2025-S1";
    const students = global.USIAMS.data.students.filter(s => s.status === "Active");

    const load = global.USIAMS.academic.COURSE_LOAD;

    // Every active student is registered for six or seven courses - the
    // load js/registration.js and server.js enforce.
    students.forEach(student => {
      const programme = global.USIAMS.academic.getProgramme(student.programmeId);
      const available = global.USIAMS.data.courses.filter(c =>
        c.status === "Active" && c.year === student.year && c.semesterNumber === 1 &&
        c.programmeIds.includes(student.programmeId)
      );
      const target = seededMark(`${student.id}-load`, load.min, load.max);

      // Core courses first, then electives, up to the target count and
      // within the programme's credit limit.
      const ordered = [...available].sort((a, b) => (a.type === "Core" ? -1 : 1) - (b.type === "Core" ? -1 : 1));
      const selected = [];
      let totalCredits = 0;
      ordered.forEach(course => {
        if (selected.length < target && totalCredits + course.credits <= programme.creditLimitPerSemester) {
          selected.push(course.id);
          totalCredits += course.credits;
        }
      });
      if (selected.length < load.min) return;

      registrations.push({
        id: `REG-${String(registrations.length + 1).padStart(4, "0")}`,
        studentId: student.id,
        semesterId,
        courseIds: selected,
        totalCredits,
        status: "Registered",
        registeredAt: `2025-09-${String((seededMark(student.id, 0, 8) + 2)).padStart(2, "0")}T09:00:00`
      });
    });

    return registrations;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.seedRegistrations = buildSeedRegistrations();

})(window);
