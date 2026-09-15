/* =========================================================
   USIAMS - data/elearning.js
   Per-course learning materials, assignments and seed student
   submissions. A lecturer's courses are inferred the same way
   js/timetable.js already infers "who teaches what" - by
   department, since USIAMS has no separate course-assignment
   table (see data/timetable.js lecturerForDepartment).
   ========================================================= */
(function (global) {
  "use strict";

  const MATERIAL_TYPES = ["Lecture Notes", "Slides", "Reading", "Video Link"];
  const SUBMISSION_STATUSES = ["Submitted", "Graded"];

  const SEED_MATERIALS = [
    { id: "MAT-0001", courseId: "CP101", title: "Week 1 - Introduction to Programming (Slides)", type: "Slides", uploadedDate: "2026-09-02" },
    { id: "MAT-0002", courseId: "CP101", title: "Programming Basics - Lecture Notes", type: "Lecture Notes", uploadedDate: "2026-09-05" },
    { id: "MAT-0003", courseId: "CP201", title: "Data Structures Overview (Slides)", type: "Slides", uploadedDate: "2026-09-03" },
    { id: "MAT-0004", courseId: "CP203", title: "Entity-Relationship Modeling - Reading", type: "Reading", uploadedDate: "2026-09-04" },
    { id: "MAT-0005", courseId: "CP203", title: "Normalization Walkthrough (Video)", type: "Video Link", uploadedDate: "2026-09-09" }
  ];

  const SEED_ASSIGNMENTS = [
    { id: "ASG-0001", courseId: "CP101", title: "Assignment 1: Variables and Loops", description: "Write and submit five short programs demonstrating variables, conditionals and loops.", dueDate: "2026-09-25", maxScore: 100 },
    { id: "ASG-0002", courseId: "CP201", title: "Assignment 1: Linked List Implementation", description: "Implement a singly linked list with insert, delete and search operations.", dueDate: "2026-09-28", maxScore: 100 },
    { id: "ASG-0003", courseId: "CP203", title: "Assignment 1: ER Diagram Design", description: "Design an ER diagram for a small library management system.", dueDate: "2026-09-30", maxScore: 50 }
  ];

  const SEED_SUBMISSIONS = [
    { id: "SUB-0001", assignmentId: "ASG-0001", studentId: "STU-0001", submittedDate: "2026-09-20", note: "Submitted via portal - all five programs included.", score: 88, status: "Graded" },
    { id: "SUB-0002", assignmentId: "ASG-0001", studentId: "STU-0003", submittedDate: "2026-09-21", note: "Completed programs 1-5.", score: null, status: "Submitted" },
    { id: "SUB-0003", assignmentId: "ASG-0002", studentId: "STU-0005", submittedDate: "2026-09-22", note: "Linked list with insert/delete/search implemented.", score: null, status: "Submitted" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.elearningMaterialTypes = MATERIAL_TYPES;
  global.USIAMS.data.elearningSubmissionStatuses = SUBMISSION_STATUSES;
  global.USIAMS.data.seedMaterials = SEED_MATERIALS;
  global.USIAMS.data.seedAssignments = SEED_ASSIGNMENTS;
  global.USIAMS.data.seedSubmissions = SEED_SUBMISSIONS;

})(window);
