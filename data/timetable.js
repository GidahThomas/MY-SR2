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

  const { seededMark } = global.USIAMS.shared;

  // Teaching staff per department: its lecturer account (if any), its head,
  // and further members of staff, so a department with many classes can
  // teach them without one person being double-booked.
  const STAFF_FIRST = ["Agnes", "Baraka", "Consolata", "Daudi", "Esther", "Faustine", "Grace", "Hamisi",
    "Irene", "Joseph", "Khadija", "Leonard", "Mwanaidi", "Nassoro", "Oliva", "Peter", "Rehema", "Salim",
    "Tumaini", "Upendo", "Wilbroad", "Zawadi"];
  const STAFF_LAST = ["Mushi", "Lyimo", "Kweka", "Mwakyusa", "Shayo", "Mbwambo", "Kisanga", "Mrisho",
    "Lema", "Swai", "Mtei", "Ngowi", "Kavishe", "Mollel", "Minja", "Urio", "Kimario", "Mahenge"];
  const EXTRA_STAFF_PER_DEPARTMENT = 5;
  const staffByDepartment = {};
  const usedStaffNames = new Set();

  function departmentStaff(departmentId) {
    if (staffByDepartment[departmentId]) return staffByDepartment[departmentId];
    const accounts = global.USIAMS.data.users
      .filter(u => u.role === "LECTURER" && u.departmentId === departmentId).map(u => u.name);
    const dept = global.USIAMS.academic.getDepartment(departmentId);
    const head = dept ? dept.hod : null;
    const extra = [];
    for (let i = 0; extra.length < EXTRA_STAFF_PER_DEPARTMENT && i < 400; i++) {
      const first = STAFF_FIRST[seededMark(`${departmentId}-first-${i}`, 0, STAFF_FIRST.length - 1)];
      const last = STAFF_LAST[seededMark(`${departmentId}-last-${i}`, 0, STAFF_LAST.length - 1)];
      const name = `Dr. ${first} ${last}`;
      if (usedStaffNames.has(name) || accounts.includes(name) || name === head) continue;
      usedStaffNames.add(name);
      extra.push(name);
    }
    staffByDepartment[departmentId] = { accounts, head, extra };
    return staffByDepartment[departmentId];
  }

  /** Generated curriculum courses (see data/courses.js fillCurriculum). */
  function isGenerated(course) {
    return course.programmeIds.length === 1 && course.id.startsWith(course.programmeIds[0]) &&
      /^\d{3}$/.test(course.id.slice(course.programmeIds[0].length));
  }

  // Who may teach a course, most preferred first. The original courses stay
  // with the department's lecturer account, so the demo lecturer still sees
  // them; generated courses go to the wider staff first. The preferred group
  // is rotated per course to spread the load.
  function candidateLecturers(course) {
    const staff = departmentStaff(course.departmentId);
    const generated = isGenerated(course);
    const preferred = generated ? staff.extra : (staff.accounts.length ? staff.accounts : [staff.head]);
    const rest = generated ? [staff.head, ...staff.accounts] : [staff.head, ...staff.extra];
    const r = preferred.length ? seededMark(`${course.id}-lecturer`, 0, preferred.length - 1) : 0;
    const rotated = [...preferred.slice(r), ...preferred.slice(0, r)];
    return [...new Set([...rotated, ...rest].filter(Boolean))];
  }

  /**
   * The weekly timetable for the active semester, for every programme's
   * first year and every year that has students - so each student's
   * timetable holds all of their courses.
   *
   * A class group (programme + year) never has two classes at once, and no
   * room or lecturer is booked twice in a slot. If a department ever has
   * more classes than slots, a lecturer clash is allowed as a last resort
   * and detectConflicts reports it.
   */
  function buildTimetable() {
    const entries = [];
    let seq = 1;
    const data = global.USIAMS.data;
    const semesterCourses = data.courses.filter(c => c.status === "Active" && c.semesterNumber === 1);

    const groups = new Set();
    data.programmes.forEach(p => groups.add(`${p.id}|1`));
    (data.students || []).forEach(s => groups.add(`${s.programmeId}|${s.year}`));
    semesterCourses.filter(c => !isGenerated(c))
      .forEach(c => c.programmeIds.forEach(p => groups.add(`${p}|${c.year}`)));

    const SLOTS = [];
    DAYS.forEach(day => TIMES.forEach(time => SLOTS.push({ day, time })));
    const taken = new Set();

    [...groups].sort().forEach(group => {
      const [programmeId, yearText] = group.split("|");
      const year = Number(yearText);
      semesterCourses.filter(c => c.year === year && c.programmeIds.includes(programmeId)).forEach(course => {
        const lecturers = candidateLecturers(course);
        const slotOffset = seededMark(`${course.id}-${programmeId}-slot`, 0, SLOTS.length - 1);
        const roomOffset = seededMark(`${course.id}-${programmeId}-room`, 0, ROOMS.length - 1);
        let placed = null;
        for (let pass = 0; pass < 2 && !placed; pass++) {
          for (let i = 0; i < SLOTS.length && !placed; i++) {
            const slot = SLOTS[(slotOffset + i) % SLOTS.length];
            const at = `${slot.day}|${slot.time}`;
            if (taken.has(`group|${group}|${at}`)) continue;
            const lecturer = pass === 0 ? lecturers.find(l => !taken.has(`lecturer|${l}|${at}`)) : lecturers[0];
            if (!lecturer) continue;
            let room = null;
            for (let r = 0; r < ROOMS.length && !room; r++) {
              const candidate = ROOMS[(roomOffset + r) % ROOMS.length];
              if (!taken.has(`room|${candidate}|${at}`)) room = candidate;
            }
            if (room) placed = { day: slot.day, time: slot.time, room, lecturer, at };
          }
        }
        if (!placed) return;
        taken.add(`group|${group}|${placed.at}`);
        taken.add(`room|${placed.room}|${placed.at}`);
        taken.add(`lecturer|${placed.lecturer}|${placed.at}`);
        entries.push({
          id: `TT-${String(seq++).padStart(4, "0")}`,
          courseId: course.id,
          programmeId,
          year,
          semesterId: "AY2025-S1",
          day: placed.day, time: placed.time, room: placed.room,
          lecturer: placed.lecturer
        });
      });
    });

    // Attendance records (data/attendance.js, loaded earlier) name the
    // lecturer who actually takes the class.
    (data.attendance || []).forEach(record => {
      const student = (data.students || []).find(s => s.id === record.studentId);
      const entry = student && entries.find(e => e.courseId === record.courseId && e.programmeId === student.programmeId);
      if (entry) record.lecturer = entry.lecturer;
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
