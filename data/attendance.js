/* =========================================================
   USIAMS - data/attendance.js
   Attendance records for every student's current-semester
   course load (AY2025-S1, the Active semester).
   ========================================================= */
(function (global) {
  "use strict";

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

  // The courses the student registered for this semester (data/
  // registrations.js loads first); otherwise every course of their year.
  function currentCoursesFor(student) {
    const registration = (global.USIAMS.data.seedRegistrations || []).find(r => r.studentId === student.id);
    if (registration) return global.USIAMS.data.courses.filter(c => registration.courseIds.includes(c.id));
    return global.USIAMS.data.courses.filter(c =>
      c.status === "Active" && c.year === student.year && c.semesterNumber === 1 &&
      c.programmeIds.includes(student.programmeId)
    );
  }

  function buildAttendance() {
    const records = [];
    let seq = 1;
    global.USIAMS.data.students.forEach(student => {
      if (student.status !== "Active") return;
      currentCoursesFor(student).forEach(course => {
        const totalClasses = seededMark(`${student.id}-${course.id}-tc`, 12, 16);
        const attended = Math.min(totalClasses, seededMark(`${student.id}-${course.id}-att`, Math.round(totalClasses * 0.45), totalClasses));
        records.push({
          id: `ATT-${String(seq++).padStart(5, "0")}`,
          studentId: student.id,
          courseId: course.id,
          semesterId: "AY2025-S1",
          lecturer: lecturerForDepartment(course.departmentId),
          totalClasses,
          attended,
          missed: totalClasses - attended,
          percentage: Math.round((attended / totalClasses) * 100)
        });
      });
    });
    return records;
  }

  function statusForPercentage(pct) {
    if (pct >= 80) return { label: "Excellent", tone: "success" };
    if (pct >= 65) return { label: "Good", tone: "info" };
    if (pct >= 50) return { label: "Warning", tone: "warning" };
    return { label: "Critical", tone: "danger" };
  }

  function attendanceForStudent(studentId) {
    return global.USIAMS.data.attendance.filter(a => a.studentId === studentId);
  }
  function overallPercentageForStudent(studentId) {
    const rows = attendanceForStudent(studentId);
    if (!rows.length) return 0;
    const totalClasses = rows.reduce((s, r) => s + r.totalClasses, 0);
    const attended = rows.reduce((s, r) => s + r.attended, 0);
    return totalClasses ? Math.round((attended / totalClasses) * 100) : 0;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.attendance = buildAttendance();
  global.USIAMS.attendance = { attendanceForStudent, overallPercentageForStudent, statusForPercentage, currentCoursesFor };

})(window);
