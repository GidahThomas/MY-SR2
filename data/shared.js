/* =========================================================
   USIAMS - data/shared.js
   Rules and helpers that the browser and the server must agree on,
   defined once. The browser loads this file before every other data
   file (it becomes USIAMS.shared); the server requires it
   (require("./data/shared")).

   Change a rule here and both the pages and the API enforce the new
   value - there is no second copy to forget.
   ========================================================= */
(function (root, factory) {
  const shared = factory();
  if (typeof module === "object" && module.exports) module.exports = shared;
  else {
    root.USIAMS = root.USIAMS || {};
    root.USIAMS.shared = shared;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // Every student takes six or seven courses a semester.
  const COURSE_LOAD = { min: 6, max: 7 };

  // How long a library book may be borrowed.
  const LOAN_PERIOD_DAYS = 14;

  const COMPLAINT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  const COMPLAINT_RECIPIENT_OFFICES = [
    "IT Support / ICT Office", "Bursar / Finance Office", "Registrar / Administration",
    "Head of Department / Academic Office", "Hostel Office", "Library", "Facilities / Estates Office", "Other"
  ];

  /**
   * A repeatable pseudo-random whole number between min and max for a
   * seed string: the demo data generators use it so every run produces
   * the same register.
   */
  function seededMark(seed, min, max) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return min + (hash % (max - min + 1));
  }

  /** "YYYY-MM-DD" in local time, for a Date or a number of days from today. */
  function localDate(when = 0) {
    const date = when instanceof Date ? when : new Date(Date.now() + when * 86400000);
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  return { COURSE_LOAD, LOAN_PERIOD_DAYS, COMPLAINT_PRIORITIES, COMPLAINT_RECIPIENT_OFFICES, seededMark, localDate };
});
