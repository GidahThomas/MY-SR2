/* Loads the real browser data layer (js/storage.js + js/api.js + data/*.js)
   in a VM against the live server, then exercises the exact read/write paths
   the page modules use. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const BASE = process.env.BASE || "http://127.0.0.1:3311";
let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  if (ok) { pass++; console.log("  PASS " + label); }
  else { fail++; console.log("  FAIL " + label + (detail ? " -> " + detail : "")); }
};

function makeWindow() {
  const store = new Map();
  const sandbox = {
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    location: { pathname: "/pages/library.html", href: "" },
    document: {
      body: {}, documentElement: { setAttribute() {} }, querySelector: () => null, getElementById: () => null,
      // js/api.js wires a delegated click listener for attachment downloads.
      addEventListener() {}
    },
    // Absolute-ise the API paths the client uses.
    fetch: (url, opts) => fetch(url.startsWith("http") ? url : BASE + url, opts),
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

function load(sandbox, relative) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relative), "utf8"), sandbox, { filename: relative });
}

(async () => {
  const sandbox = makeWindow();

  // Page load order, as the HTML declares it.
  load(sandbox, "js/storage.js");
  load(sandbox, "js/api.js");
  check("api.js installs the storage bridge at load", sandbox.USIAMS.storage.__apiBridged === true);

  // The data files run next and capture their overlays during evaluation -
  // this is the ordering that made the bridge install at load time.
  for (const file of ["grading-system.js", "academic-structure.js", "courses.js", "users.js",
    "students.js", "results.js", "registrations.js", "finance.js", "attendance.js", "timetable.js",
    "requests.js", "complaints.js", "notifications.js", "calendar.js", "announcements.js",
    "documents.js", "internship.js", "graduation.js", "alumni.js", "library.js", "hostel.js",
    "elearning.js", "admissions.js", "qa-flags.js", "audit-logs.js"]) {
    load(sandbox, "data/" + file);
  }
  check("data files load against the bridged storage", typeof sandbox.USIAMS.data.studentsService === "object" || !!sandbox.USIAMS.data.students);

  // Sign in and seed the token exactly as js/auth.js does.
  const loginRes = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  const login = await loginRes.json();
  sandbox.localStorage.setItem("usiams.session.token", JSON.stringify(login.token));

  console.log("\n== Hydration ==");
  await sandbox.USIAMS.api.hydrate();
  const data = sandbox.USIAMS.data;
  check("students come from the database", data.students.length === 60, String(data.students.length));
  check("courses come from the database", data.courses.length === 39);
  check("results come from the database", data.results.length === 67);
  check("library books come from the database", data.seedBooks.length === 14);
  check("attendance summary hydrated", data.attendance.length === 34);
  check("audit log hydrated", data.seedAuditLogs.length > 0);
  check("calendar hydrated", data.academicCalendar.length === 10);
  check("holidays hydrated", data.publicHolidays.length === 32);

  console.log("\n== Reads go through the bridge ==");
  const storage = sandbox.USIAMS.storage;
  check("ensureSeed('requests') returns server data",
    storage.ensureSeed("requests", () => []).length === data.seedRequests.length);
  check("getStorage('notifications') returns server data",
    storage.getStorage("notifications", []).length === data.seedNotifications.length);
  check("browser-local keys still use localStorage", (() => {
    storage.setStorage("preferences", { theme: "dark" });
    return storage.getStorage("preferences", null).theme === "dark";
  })());

  console.log("\n== Writes persist to MySQL ==");
  // This is the exact shape js/requests.js uses: read the whole list,
  // push a record, write the whole list back.
  const list = storage.ensureSeed("requests", () => []);
  const newRequest = {
    id: "REQ-FE-TEST", studentId: "STU-0003", type: "Letter",
    subject: "Frontend bridge test", description: "Written through the storage bridge.",
    status: "PENDING", priority: "LOW", attachment: null, timeline: [],
    createdAt: new Date().toISOString().slice(0, 19)
  };
  storage.setStorage("requests", [...list, newRequest]);
  await sandbox.USIAMS.api.flush();

  const verify = await fetch(BASE + "/api/data/requests/REQ-FE-TEST", { headers: { Authorization: "Bearer " + login.token } });
  const verifyJson = await verify.json();
  check("new record reached the database", verify.status === 200 && verifyJson.data.subject === "Frontend bridge test",
    JSON.stringify(verifyJson).slice(0, 160));
  check("record kept its student id", verifyJson.data && verifyJson.data.studentId === "STU-0003",
    verifyJson.data && verifyJson.data.studentId);

  // Update through the same path.
  const afterAdd = storage.ensureSeed("requests", () => []);
  storage.setStorage("requests", afterAdd.map(r => r.id === "REQ-FE-TEST" ? { ...r, status: "RESOLVED" } : r));
  await sandbox.USIAMS.api.flush();
  const verify2 = await (await fetch(BASE + "/api/data/requests/REQ-FE-TEST", { headers: { Authorization: "Bearer " + login.token } })).json();
  check("update persisted", verify2.data && verify2.data.status === "RESOLVED", verify2.data && verify2.data.status);

  // Delete through the same path.
  const afterUpdate = storage.ensureSeed("requests", () => []);
  storage.setStorage("requests", afterUpdate.filter(r => r.id !== "REQ-FE-TEST"));
  await sandbox.USIAMS.api.flush();
  const verify3 = await fetch(BASE + "/api/data/requests/REQ-FE-TEST", { headers: { Authorization: "Bearer " + login.token } });
  check("delete persisted", verify3.status === 404, String(verify3.status));

  console.log("\n== createOverlay path (library loans) ==");
  const loans = storage.createOverlay("libraryLoans", () => []);
  const before = loans.getAll().length;
  loans.add({
    id: "LOAN-FE-TEST", bookId: "BK-0005", studentId: "STU-0004",
    borrowedDate: "2026-09-01T09:00:00", dueDate: "2026-09-15T17:00:00", returnedDate: null, status: "Borrowed"
  });
  await sandbox.USIAMS.api.flush();
  check("overlay add is visible locally", loans.getAll().length === before + 1);
  const loanCheck = await (await fetch(BASE + "/api/data/loans/LOAN-FE-TEST", { headers: { Authorization: "Bearer " + login.token } })).json();
  check("overlay add reached the database", loanCheck.data && loanCheck.data.bookId === "BK-0005",
    JSON.stringify(loanCheck).slice(0, 140));
  loans.update("LOAN-FE-TEST", { status: "Returned", returnedDate: "2026-09-10T12:00:00" });
  await sandbox.USIAMS.api.flush();
  const loanCheck2 = await (await fetch(BASE + "/api/data/loans/LOAN-FE-TEST", { headers: { Authorization: "Bearer " + login.token } })).json();
  check("overlay update reached the database", loanCheck2.data && loanCheck2.data.status === "Returned");
  loans.remove("LOAN-FE-TEST");
  await sandbox.USIAMS.api.flush();
  const loanCheck3 = await fetch(BASE + "/api/data/loans/LOAN-FE-TEST", { headers: { Authorization: "Bearer " + login.token } });
  check("overlay remove reached the database", loanCheck3.status === 404);

  console.log("\n== Rejected writes are rolled back ==");
  // Sign in as the read-only QA officer and try to write.
  const qaLogin = await (await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "qa", password: "qa123" })
  })).json();
  sandbox.localStorage.setItem("usiams.session.token", JSON.stringify(qaLogin.token));
  await sandbox.USIAMS.api.hydrate();
  let toasted = null;
  sandbox.USIAMS.toast = { show: (kind, title, message) => { toasted = { kind, title, message }; } };
  const qaLoans = storage.createOverlay("libraryLoans", () => []);
  const qaCountBefore = qaLoans.getAll().length;
  qaLoans.add({ id: "LOAN-QA-TEST", bookId: "BK-0005", studentId: "STU-0004", borrowedDate: "2026-09-01T09:00:00", dueDate: "2026-09-15T17:00:00", status: "Borrowed" });
  await sandbox.USIAMS.api.flush();
  check("refusal raised a toast", toasted && toasted.kind === "error", JSON.stringify(toasted));
  check("refusal message explains read-only", toasted && /read-only/i.test(toasted.message), toasted && toasted.message);
  check("rejected record was rolled back out of the cache",
    qaLoans.getAll().length === qaCountBefore && !qaLoans.getAll().some(l => l.id === "LOAN-QA-TEST"),
    String(qaLoans.getAll().length) + " vs " + String(qaCountBefore));
  const stray = await fetch(BASE + "/api/data/loans/LOAN-QA-TEST", { headers: { Authorization: "Bearer " + login.token } });
  check("nothing was written to the database", stray.status === 404);

  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR:", e); process.exit(1); });
