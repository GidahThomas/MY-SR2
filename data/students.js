/* =========================================================
   USIAMS - data/students.js
   Demo student register (54 students spread across every
   programme). Generated deterministically from name pools so
   the roster stays realistic (Tanzanian naming conventions)
   without hand-authoring every record.

   Deliberately does NOT store GPA, attendance % or fee balance -
   those are always derived on demand from results.js / attendance.js /
   finance.js through their respective services, so there is a
   single source of truth for every calculation (see js/gpa.js).
   ========================================================= */
(function (global) {
  "use strict";

  const MALE_FIRST = ["Baraka", "Juma", "Emmanuel", "Deogratius", "Godbless", "Innocent", "Yohana", "Godfrey", "Elias", "Frank", "Augustino", "Method", "Amani", "Edwin", "Reginald", "Nickson", "Samwel", "Erasto", "Castus", "Longin", "Method", "Athumani", "Kelvin", "Ombeni", "Paschal", "Raymond", "Silas"];
  const FEMALE_FIRST = ["Neema", "Zawadi", "Furaha", "Happiness", "Mwajuma", "Rehema", "Salome", "Upendo", "Victoria", "Zainabu", "Editha", "Consolata", "Grace", "Anastazia", "Beatrice", "Faraja", "Joyce", "Lightness", "Modesta", "Pendo", "Winfrida", "Tatu", "Scholastica", "Neemah", "Devotha", "Restituta", "Veronica"];
  const SURNAMES = ["Mushi", "Kileo", "Mrema", "Komba", "Massawe", "Shayo", "Ngowi", "Mwakalinga", "Temba", "Kimaro", "Lyimo", "Swai", "Mbwana", "Chacha", "Ndosi", "Mgaya", "Mallya", "Mtui", "Ndumbaro", "Sanga", "Kessy", "Mollel", "Nyalusi", "Kayombo", "Mnyika", "Mbise", "Rutta", "Materu"];
  const SECONDARY_SCHOOLS = ["Mzumbe Secondary School", "Tambaza High School", "Kibaha Secondary School", "Ilboru Secondary School", "Milambo Secondary School", "Feza Boys Secondary School", "St. Francis Girls Secondary", "Songea Boys Secondary School", "Iringa Girls Secondary School", "Mkwawa High School"];
  const STATUS_CYCLE = ["Active", "Active", "Active", "Active", "Active", "On Leave", "Active", "Active", "Suspended", "Active"];

  const programmes = () => global.USIAMS.data.programmes;

  // Registration number prefix by academic level. This is how USIAMS tells
  // Diploma, Degree (Undergraduate) and PhD students apart at a glance -
  // e.g. Degree "T23-03-20452", Diploma "D24-01-10087", PhD "PhD22-08-00104".
  const REG_PREFIX_BY_LEVEL = { Undergraduate: "T", Diploma: "D", PhD: "PhD" };
  // Serial numbers start from a different band per level purely so the
  // generated numbers look like real institutional ranges rather than a
  // suspiciously tidy 1, 2, 3...
  const SERIAL_BASE_BY_LEVEL = { Undergraduate: 20000, Diploma: 10000, PhD: 100 };

  function buildRegNumber(programme, admissionYear, sequenceInProgramme) {
    const department = global.USIAMS.academic.getDepartment(programme.departmentId);
    const prefix = REG_PREFIX_BY_LEVEL[programme.level] || "T";
    const yy = String(admissionYear).slice(-2);
    const serial = (SERIAL_BASE_BY_LEVEL[programme.level] || 20000) + sequenceInProgramme;
    return `${prefix}${yy}-${department.code}-${String(serial).padStart(5, "0")}`;
  }

  function buildStudents() {
    const students = [];
    const progSeq = {};
    // A separate counter from progSeq: the registration number's serial
    // only has department + level visible in it (not the programme), so it
    // must be unique across every programme that shares a department and
    // level - e.g. BSSE and BSCDS are different programmes but both sit
    // under DCSE, so they must not both hand out serial "20001".
    const regSeq = {};
    const total = 60;
    for (let i = 0; i < total; i++) {
      const isMale = i % 2 === 0;
      const firstName = isMale ? MALE_FIRST[i % MALE_FIRST.length] : FEMALE_FIRST[i % FEMALE_FIRST.length];
      const lastName = SURNAMES[(i * 7 + 3) % SURNAMES.length];
      const prog = programmes()[i % programmes().length];
      progSeq[prog.id] = (progSeq[prog.id] || 0) + 1;
      // Cycle year 1-3 per programme (not per global index) so every
      // programme has students spread across all study years.
      const year = ((progSeq[prog.id] - 1) % 3) + 1;
      const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
      const admissionYear = 2025 - (year - 1);
      const regKey = `${prog.departmentId}-${prog.level}`;
      regSeq[regKey] = (regSeq[regKey] || 0) + 1;
      const regNumber = buildRegNumber(prog, admissionYear, regSeq[regKey]);
      const dobYear = 2007 - year;
      const idNum = String(i + 1).padStart(4, "0");

      students.push({
        id: `STU-${idNum}`,
        regNumber,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        gender: isMale ? "Male" : "Female",
        dob: `${dobYear}-${String(((i % 12) + 1)).padStart(2, "0")}-${String(((i * 3) % 27) + 1).padStart(2, "0")}`,
        programmeId: prog.id,
        departmentId: prog.departmentId,
        year,
        status,
        email: `${firstName}.${lastName}${idNum}@students.usiams.ac.tz`.toLowerCase(),
        phone: `+2557${String(10000000 + i * 137).slice(0, 8)}`,
        address: `P.O. Box ${1000 + i}, Dar es Salaam, Tanzania`,
        emergencyContact: {
          name: `${SURNAMES[(i + 5) % SURNAMES.length]} ${lastName}`,
          relation: i % 3 === 0 ? "Father" : i % 3 === 1 ? "Mother" : "Guardian",
          phone: `+2556${String(20000000 + i * 219).slice(0, 8)}`
        },
        admission: {
          date: `${admissionYear}-10-0${(i % 9) + 1}`,
          entryQualification: "Advanced Certificate of Secondary Education (ACSEE)",
          previousSchool: SECONDARY_SCHOOLS[i % SECONDARY_SCHOOLS.length]
        },
        photo: null
      });
    }
    return students;
  }

  function applyDemoOverrides(students) {
    // The "student" demo login (js/data/users.js -> STU-0001) is pinned to
    // year 3 with two completed academic years of history so the sample
    // transcript, GPA trend and attendance charts have real data to show.
    const demo = students.find(s => s.id === "STU-0001");
    if (demo) {
      demo.year = 3;
      demo.regNumber = buildRegNumber(global.USIAMS.academic.getProgramme(demo.programmeId), 2023, 1);
      demo.admission.date = "2023-10-02";
      demo.status = "Active";
    }
    return students;
  }

  function getStudent(id) {
    return global.USIAMS.data.students.find(s => s.id === id);
  }
  function getStudentByReg(regNumber) {
    return global.USIAMS.data.students.find(s => s.regNumber === regNumber);
  }
  function studentsForProgramme(programmeId) {
    return global.USIAMS.data.students.filter(s => s.programmeId === programmeId);
  }
  function studentsForDepartment(departmentId) {
    return global.USIAMS.data.students.filter(s => s.departmentId === departmentId);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.students = applyDemoOverrides(buildStudents());
  global.USIAMS.students = { getStudent, getStudentByReg, studentsForProgramme, studentsForDepartment, buildRegNumber };

})(window);
