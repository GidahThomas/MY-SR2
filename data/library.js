/* =========================================================
   USIAMS - data/library.js
   Library catalog and seed borrowing history. A book's available
   copy count is deliberately NOT stored here - js/library.js
   always derives it from totalCopies minus currently active
   loans, the same single-source-of-truth approach used by
   data/students.js for GPA/attendance/fee balance.
   ========================================================= */
(function (global) {
  "use strict";

  const LOAN_STATUSES = ["Borrowed", "Returned", "Overdue"];
  const LOAN_PERIOD_DAYS = global.USIAMS.shared.LOAN_PERIOD_DAYS;

  const SEED_BOOKS = [
    { id: "BK-0001", title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", isbn: "978-0262046305", category: "Computer Science", totalCopies: 5 },
    { id: "BK-0002", title: "Clean Code", author: "Robert C. Martin", isbn: "978-0132350884", category: "Computer Science", totalCopies: 4 },
    { id: "BK-0003", title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", isbn: "978-0078022159", category: "Computer Science", totalCopies: 3 },
    { id: "BK-0004", title: "Computer Networking: A Top-Down Approach", author: "Kurose & Ross", isbn: "978-0133594140", category: "Computer Science", totalCopies: 3 },
    { id: "BK-0005", title: "Circuits, Devices and Systems", author: "Ralph J. Smith", isbn: "978-0471074958", category: "Engineering", totalCopies: 3 },
    { id: "BK-0006", title: "Calculus: Early Transcendentals", author: "James Stewart", isbn: "978-1285741550", category: "Mathematics", totalCopies: 4 },
    { id: "BK-0007", title: "Principles of Financial Accounting", author: "Weygandt, Kimmel, Kieso", isbn: "978-1119298229", category: "Business", totalCopies: 4 },
    { id: "BK-0008", title: "Principles of Marketing", author: "Philip Kotler & Gary Armstrong", isbn: "978-0134492513", category: "Business", totalCopies: 3 },
    { id: "BK-0009", title: "Campbell Biology", author: "Urry, Cain, Wasserman", isbn: "978-0134093413", category: "Biological Sciences", totalCopies: 3 },
    { id: "BK-0010", title: "Constitutional Law of Tanzania", author: "Chris Maina Peter", isbn: "978-9987080123", category: "Law", totalCopies: 2 },
    { id: "BK-0011", title: "Foundations of Education", author: "Allan C. Ornstein", isbn: "978-0134806918", category: "Education", totalCopies: 3 },
    { id: "BK-0012", title: "Development Studies: Theory and Practice", author: "Damien Kingsbury", isbn: "978-1741148804", category: "Development Studies", totalCopies: 2 },
    { id: "BK-0013", title: "Artificial Intelligence: A Modern Approach", author: "Russell & Norvig", isbn: "978-0134610993", category: "Computer Science", totalCopies: 3 },
    { id: "BK-0014", title: "Research Methods for Business Students", author: "Saunders, Lewis, Thornhill", isbn: "978-1292208787", category: "Business", totalCopies: 3 }
  ];

  const SEED_LOANS = [
    { id: "LOAN-0001", bookId: "BK-0001", studentId: "STU-0001", borrowedDate: "2026-08-20", dueDate: "2026-09-03", returnedDate: "2026-09-01", status: "Returned" },
    { id: "LOAN-0002", bookId: "BK-0002", studentId: "STU-0004", borrowedDate: "2026-08-25", dueDate: "2026-09-08", returnedDate: null, status: "Overdue" },
    { id: "LOAN-0003", bookId: "BK-0003", studentId: "STU-0007", borrowedDate: "2026-09-05", dueDate: "2026-09-19", returnedDate: null, status: "Borrowed" },
    { id: "LOAN-0004", bookId: "BK-0006", studentId: "STU-0012", borrowedDate: "2026-09-08", dueDate: "2026-09-22", returnedDate: null, status: "Borrowed" },
    { id: "LOAN-0005", bookId: "BK-0007", studentId: "STU-0018", borrowedDate: "2026-08-15", dueDate: "2026-08-29", returnedDate: "2026-08-27", status: "Returned" },
    { id: "LOAN-0006", bookId: "BK-0013", studentId: "STU-0001", borrowedDate: "2026-08-28", dueDate: "2026-09-11", returnedDate: null, status: "Overdue" },
    { id: "LOAN-0007", bookId: "BK-0004", studentId: "STU-0007", borrowedDate: "2026-09-10", dueDate: "2026-09-24", returnedDate: null, status: "Borrowed" },
    { id: "LOAN-0008", bookId: "BK-0009", studentId: "STU-0021", borrowedDate: "2026-08-18", dueDate: "2026-09-01", returnedDate: "2026-08-30", status: "Returned" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.libraryLoanStatuses = LOAN_STATUSES;
  global.USIAMS.data.libraryLoanPeriodDays = LOAN_PERIOD_DAYS;
  global.USIAMS.data.seedBooks = SEED_BOOKS;
  global.USIAMS.data.seedLoans = SEED_LOANS;

})(window);
