/* =========================================================
   USIAMS - data/grading-system.js
   Single source of truth for the university grading scale.
   Consumed exclusively by js/gpa.js - never duplicate this
   table anywhere else in the codebase.
   ========================================================= */
(function (global) {
  "use strict";

  const GRADING_SCALE = [
    { grade: "A",  min: 70, max: 100, point: 5.0, remark: "Excellent" },
    { grade: "B+", min: 60, max: 69,  point: 4.0, remark: "Very Good" },
    { grade: "B",  min: 50, max: 59,  point: 3.0, remark: "Good" },
    { grade: "C",  min: 40, max: 49,  point: 2.0, remark: "Satisfactory" },
    { grade: "D",  min: 35, max: 39,  point: 1.0, remark: "Pass" },
    { grade: "F",  min: 0,  max: 34,  point: 0.0, remark: "Fail" }
  ];

  const GPA_CLASSIFICATION = [
    { min: 4.4, label: "First Class" },
    { min: 3.5, label: "Second Class Upper" },
    { min: 2.7, label: "Second Class Lower" },
    { min: 2.0, label: "Pass" },
    { min: 0,   label: "Unclassified" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.gradingScale = GRADING_SCALE;
  global.USIAMS.data.gpaClassification = GPA_CLASSIFICATION;

})(window);
