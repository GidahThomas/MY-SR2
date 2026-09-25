/* =========================================================
   USIAMS - db/load-seed-data.js
   Executes the browser-side data/*.js seed files inside a Node
   VM with a minimal `window` shim, then returns the assembled
   USIAMS.data object.

   The seed files were written for the browser prototype: they are
   IIFEs that attach generated datasets to `window.USIAMS.data`, and
   a couple of them call `USIAMS.storage.createOverlay` at load time.
   Rather than duplicating those generators in SQL (the student
   register, timetable and results are all generated deterministically
   from name/course pools), we run the real files and seed MySQL from
   their output, so the database and the prototype agree exactly.
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DATA_DIR = path.join(__dirname, "..", "data");

// Load order matters: later seed files read datasets produced by earlier ones
// (students.js needs programmes, results.js needs courses, and so on).
const LOAD_ORDER = [
  "grading-system.js", "academic-structure.js", "courses.js", "users.js", "students.js",
  "results.js", "registrations.js", "finance.js", "attendance.js", "timetable.js",
  "requests.js", "complaints.js", "notifications.js", "calendar.js", "announcements.js",
  "documents.js", "internship.js", "graduation.js", "alumni.js", "library.js",
  "hostel.js", "elearning.js", "admissions.js", "qa-flags.js", "audit-logs.js"
];

/**
 * Minimal stand-in for js/storage.js. The seed files only use it to wrap a
 * base dataset in the localStorage overlay; with no browser storage present
 * the overlay is just the untouched base list, which is exactly the clean
 * dataset we want to load into MySQL.
 */
function storageShim() {
  const memory = new Map();
  return {
    setStorage(key, value) { memory.set(key, value); return true; },
    getStorage(key, fallback = null) { return memory.has(key) ? memory.get(key) : fallback; },
    removeStorage(key) { memory.delete(key); },
    ensureSeed(key, seedFactory) {
      if (!memory.has(key)) memory.set(key, typeof seedFactory === "function" ? seedFactory() : seedFactory);
      return memory.get(key);
    },
    nextId(prefix, list) {
      const numbers = (list || []).map(item => {
        const match = String(item.id || "").match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      return `${prefix}-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(4, "0")}`;
    },
    createOverlay(name, baseListFn) {
      return {
        getAll: () => baseListFn(),
        add(item) { return item; },
        update() {},
        remove() {}
      };
    }
  };
}

function loadSeedData() {
  const sandbox = {
    console,
    USIAMS: { storage: storageShim(), data: {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  for (const file of LOAD_ORDER) {
    const fullPath = path.join(DATA_DIR, file);
    if (!fs.existsSync(fullPath)) throw new Error(`Seed data file missing: data/${file}`);
    vm.runInContext(fs.readFileSync(fullPath, "utf8"), sandbox, { filename: `data/${file}` });
  }

  return sandbox.USIAMS.data;
}

module.exports = { loadSeedData, LOAD_ORDER };
