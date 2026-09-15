/* =========================================================
   USIAMS - js/gpa.js
   Single GPA calculation service. Every page that needs a
   grade, grade point, semester GPA or cumulative GPA must call
   into this service instead of re-implementing the formula.
   ========================================================= */
(function (global) {
  "use strict";

  function scaleFor(totalMark) {
    const scale = global.USIAMS.data.gradingScale;
    return scale.find(s => totalMark >= s.min && totalMark <= s.max) || scale[scale.length - 1];
  }

  function gradeFromMark(totalMark) {
    return scaleFor(totalMark).grade;
  }

  function pointFromMark(totalMark) {
    return scaleFor(totalMark).point;
  }

  function remarkFromMark(totalMark) {
    return scaleFor(totalMark).remark;
  }

  /**
   * results: [{ credits, totalMark }]
   * Returns GPA rounded to 2 decimal places using credit-weighted grade points.
   */
  function calculateGpa(results) {
    const valid = (results || []).filter(r => typeof r.totalMark === "number" && r.credits > 0);
    if (!valid.length) return 0;
    const totalPoints = valid.reduce((sum, r) => sum + pointFromMark(r.totalMark) * r.credits, 0);
    const totalCredits = valid.reduce((sum, r) => sum + r.credits, 0);
    return totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
  }

  function classify(gpa) {
    const bands = global.USIAMS.data.gpaClassification;
    const found = bands.find(b => gpa >= b.min);
    return found ? found.label : bands[bands.length - 1].label;
  }

  function gradeDistribution(results) {
    const scale = global.USIAMS.data.gradingScale;
    const dist = {};
    scale.forEach(s => dist[s.grade] = 0);
    (results || []).forEach(r => {
      const g = gradeFromMark(r.totalMark);
      dist[g] = (dist[g] || 0) + 1;
    });
    return dist;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.gpa = { gradeFromMark, pointFromMark, remarkFromMark, calculateGpa, classify, gradeDistribution };

})(window);
