/* =========================================================
   USIAMS - data/timetable.js
   Weekly class timetable for the active semester (AY2025-S1).
   One entry per course/programme/year combination. A deliberate
   double-booking is included (CP304 vs CP302) so the conflict
   detector in js/timetable.js has something real to flag.
   ========================================================= */
(function (global) {
  "use strict";

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  // Real campus venue codes: LRB100-LRB106 (Lecture Room Block), plus
  // the numbered room blocks 001-005, each split into lettered rooms -
  // not every block has the same set of letters (e.g. 004 only has
  // C and D), matching the actual room list provided.
  const ROOMS = [
    "LRB100", "LRB101", "LRB102", "LRB103", "LRB104", "LRB105", "LRB106",
    "001A", "001B", "001C", "001D",
    "002A", "002B", "002C", "002D",
    "003B", "003C", "003D",
    "004C", "004D",
    "005B", "005C",
    "Auditorium"
  ];
  // The Auditorium is the one large multi-purpose venue on this list -
  // besides being scheduled for classes like every other room here, it
  // is also the venue used for meetings and student study sessions.
  const AUDITORIUM = "Auditorium";

  function seededMark(seed, min, max) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return min + (hash % (max - min + 1));
  }

  function lecturerForDepartment(departmentId) {
    const lecturer = global.USIAMS.data.users.find(u => u.role === "LECTURER" && u.departmentId === departmentId);
    if (lecturer) return lecturer.name;
    const dept = global.USIAMS.academic.getDepartment(departmentId);
    return dept ? dept.hod : "Staff Lecturer";
  }

  function buildTimetable() {
    const entries = [];
    let seq = 1;
    const semesterCourses = global.USIAMS.data.courses.filter(c => c.status === "Active" && c.semesterNumber === 1);

    semesterCourses.forEach(course => {
      course.programmeIds.forEach(programmeId => {
        const day = DAYS[seededMark(`${course.id}-${programmeId}-day`, 0, DAYS.length - 1)];
        const time = TIMES[seededMark(`${course.id}-${programmeId}-time`, 0, TIMES.length - 1)];
        const room = ROOMS[seededMark(`${course.id}-${programmeId}-room`, 0, ROOMS.length - 1)];
        entries.push({
          id: `TT-${String(seq++).padStart(4, "0")}`,
          courseId: course.id,
          programmeId,
          year: course.year,
          semesterId: "AY2025-S1",
          day, time, room,
          lecturer: lecturerForDepartment(course.departmentId)
        });
      });
    });

    // Deliberate conflict for demonstration purposes: force two different
    // year-3 BSCS courses into the same day/time/room.
    const cs302 = entries.find(e => e.courseId === "CP302" && e.programmeId === "BSCS");
    const cs304 = entries.find(e => e.courseId === "CP304" && e.programmeId === "BSCS");
    if (cs302 && cs304) {
      cs304.day = cs302.day;
      cs304.time = cs302.time;
      cs304.room = cs302.room;
    }

    return entries;
  }

  function detectConflicts(entries) {
    const conflicts = new Set();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        if (a.day === b.day && a.time === b.time && (a.room === b.room || a.lecturer === b.lecturer)) {
          conflicts.add(a.id);
          conflicts.add(b.id);
        }
      }
    }
    return conflicts;
  }

  function timetableForProgrammeYear(programmeId, year) {
    return global.USIAMS.data.timetable.filter(e => e.programmeId === programmeId && e.year === year);
  }
  function timetableForLecturer(lecturerName) {
    return global.USIAMS.data.timetable.filter(e => e.lecturer === lecturerName);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.timetable = buildTimetable();
  global.USIAMS.timetable = { DAYS, TIMES, ROOMS, AUDITORIUM, detectConflicts, timetableForProgrammeYear, timetableForLecturer };

})(window);
