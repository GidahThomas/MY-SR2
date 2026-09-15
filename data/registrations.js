/* =========================================================
   USIAMS - data/registrations.js
   Seed course registrations for the active semester (AY2025-S1).
   js/registration.js copies this into localStorage on first run
   (see USIAMS.storage.ensureSeed) so Reports > Registration
   Report and the admin/registration-officer views have real data
   to show before anyone has used the interactive registration
   flow - new registrations submitted during the demo persist on
   top of this seed exactly like requests/complaints/notifications.
   ========================================================= */
(function (global) {
  "use strict";

  function seededMark(seed, min, max) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return min + (hash % (max - min + 1));
  }

  function buildSeedRegistrations() {
    const registrations = [];
    const semesterId = "AY2025-S1";
    const students = global.USIAMS.data.students.filter(s => s.status === "Active");

    students.forEach(student => {
      // Only ~70% of active students have completed registration by demo
      // time - the rest show up correctly as "Not Registered" in reports.
      if (seededMark(`${student.id}-registered`, 0, 99) >= 70) return;

      const programme = global.USIAMS.academic.getProgramme(student.programmeId);
      const available = global.USIAMS.data.courses.filter(c =>
        c.status === "Active" && c.year === student.year && c.semesterNumber === 1 &&
        c.programmeIds.includes(student.programmeId)
      );
      if (!available.length) return;

      // Core courses first, then electives, stopping at the programme's
      // per-semester credit limit - the same rule the live registration
      // page enforces.
      const ordered = [...available].sort((a, b) => (a.type === "Core" ? -1 : 1) - (b.type === "Core" ? -1 : 1));
      const selected = [];
      let totalCredits = 0;
      ordered.forEach(course => {
        if (totalCredits + course.credits <= programme.creditLimitPerSemester) {
          selected.push(course.id);
          totalCredits += course.credits;
        }
      });
      if (!selected.length) return;

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
