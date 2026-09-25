/* =========================================================
   USIAMS - tests/registration.test.js
   Registers a new student through the public sign-up route, then
   signs in as them and opens every page they are allowed to use.

   A freshly registered student is the emptiest account the system
   ever has: no results, no registration, no invoice, no timetable,
   no attendance. Pages that assume a student always has history
   break here and nowhere else - and this account is also the one
   that must never be able to read anybody else's records.
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole, requestInterceptor } = require("jsdom");

const BASE = process.env.BASE || "http://127.0.0.1:3311";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (l, c, d = "") => { c ? (pass++, console.log("  PASS " + l)) : (fail++, console.log("  FAIL " + l + (d ? "\n         " + d : ""))); };

const call = async (p, { method = "GET", token, body } = {}) => {
  const r = await fetch(BASE + p, {
    method,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};

function localOnly() {
  return requestInterceptor(request => {
    if (request.url.startsWith(BASE)) return undefined;
    return new Response("", { status: 200, headers: { "Content-Type": "text/plain" } });
  });
}

async function renderAs(file, session) {
  const problems = [];
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => {
    const message = error.message || "";
    if (/Could not load|stylesheet|getContext|canvas npm package|acquire context/i.test(message)) return;
    if (/Not implemented: navigation/i.test(message)) { navigations.push(message); return; }
    problems.push(message.split("\n")[0]);
  });
  virtualConsole.on("error", (...args) => {
    const text = args.join(" ");
    if (/acquire context|canvas/i.test(text)) return;
    problems.push("console.error: " + text.split("\n")[0]);
  });

  const pageUrl = `${BASE}/pages/${file}`;
  const dom = await JSDOM.fromURL(pageUrl, {
    runScripts: "dangerously",
    resources: { interceptors: [localOnly()] },
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.bootstrap = {
        Modal: class {
          constructor(element) { this.element = element; }
          show() {} hide() {} dispose() {}
          static getInstance() { return null; }
          static getOrCreateInstance(element) { return new window.bootstrap.Modal(element); }
        },
        Tab: class { constructor(element) { this.element = element; } show() {} }
      };
      window.Chart = class {
        constructor() { this.data = {}; this.options = {}; }
        update() {} destroy() {} resize() {}
        static register() {}
      };
      window.Chart.helpers = {
        merge(target, ...sources) {
          const isPlain = v => v && typeof v === "object" && !Array.isArray(v);
          for (const source of sources) {
            if (!isPlain(source)) continue;
            for (const [key, value] of Object.entries(source)) {
              target[key] = isPlain(value) && isPlain(target[key])
                ? window.Chart.helpers.merge({ ...target[key] }, value)
                : value;
            }
          }
          return target;
        }
      };
      window.localStorage.setItem("usiams.session.token", JSON.stringify(session.token));
      window.localStorage.setItem("usiams.session.currentUser", JSON.stringify(session.user));
      window.fetch = (input, init) => fetch(new URL(String(input), pageUrl).href, init);
      window.Headers = Headers; window.Request = Request; window.Response = Response;
      window.confirm = () => false;
      window.alert = () => {};
      window.scrollTo = () => {};
      window.print = () => {};
      window.URL.createObjectURL = () => "blob:stub";
      window.URL.revokeObjectURL = () => {};
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    }
  });

  const { window } = dom;
  const mounted = () => !!window.document.querySelector("#sidebarContainer a, .app-footer");
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && !mounted() && !/USIAMS is unavailable/.test(window.document.body.textContent)) {
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 250));

  // Only a navigation during boot is an auth redirect. Downloads are
  // triggered by clicking a generated anchor, which jsdom also reports as
  // navigation - counting those would fail any page with a CSV export.
  const redirectedDuringBoot = navigations.length > 0;

  // Press the page's own controls too - empty-state pages often only fail
  // once something asks them to act on data that is not there.
  let clicked = 0;
  if (mounted()) {
    const controls = [...window.document.querySelectorAll("button:not([data-bs-dismiss]), [data-bs-toggle='tab']")]
      .filter(el => !el.closest(".app-sidebar, .app-navbar"));
    for (const control of controls.slice(0, 25)) {
      try { control.click(); clicked++; await new Promise(r => setTimeout(r, 25)); }
      catch (error) { problems.push(`click(${control.id || "?"}): ${error.message}`); }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const result = {
    problems, clicked,
    mounted: mounted(),
    fatal: /USIAMS is unavailable/.test(window.document.body.textContent),
    navigated: redirectedDuringBoot
  };
  dom.window.close();
  return result;
}

(async () => {
  console.log("== Registering a new student ==");
  const stamp = Date.now().toString(36).slice(-7);
  const username = `newstudent${stamp}`;
  const email = `${username}@students.usiams.ac.tz`;

  const programmes = await call("/api/public/programmes");
  check("the public programme list is available to the sign-up form",
    programmes.status === 200 && programmes.json.data.length > 0, String(programmes.status));

  const missingProgramme = await call("/api/auth/register", {
    method: "POST", body: { username: username + "a", fullName: "No Programme", email: `${username}a@x.ac.tz`, password: "password123" }
  });
  check("registration without a programme is refused", missingProgramme.status === 422, String(missingProgramme.status));

  const badProgramme = await call("/api/auth/register", {
    method: "POST", body: { username: username + "b", fullName: "Bad Programme", email: `${username}b@x.ac.tz`, password: "password123", programmeId: "NOT-A-PROGRAMME" }
  });
  check("an unknown programme is refused", badProgramme.status === 422, String(badProgramme.status));

  const shortPassword = await call("/api/auth/register", {
    method: "POST", body: { username: username + "c", fullName: "Short Pass", email: `${username}c@x.ac.tz`, password: "short", programmeId: "BSCS" }
  });
  check("a short password is refused", shortPassword.status === 422, String(shortPassword.status));

  const registered = await call("/api/auth/register", {
    method: "POST", body: { username, fullName: "Neema Testerson", email, password: "password123", programmeId: "BSCS" }
  });
  check("the account is created", registered.status === 201, JSON.stringify(registered.json));
  check("a student record was created with it", !!(registered.json && registered.json.studentId),
    JSON.stringify(registered.json));

  const duplicate = await call("/api/auth/register", {
    method: "POST", body: { username, fullName: "Copy", email: `other${stamp}@x.ac.tz`, password: "password123", programmeId: "BSCS" }
  });
  check("the same username cannot be taken twice", duplicate.status === 409, String(duplicate.status));
  const duplicateEmail = await call("/api/auth/register", {
    method: "POST", body: { username: username + "d", fullName: "Copy", email, password: "password123", programmeId: "BSCS" }
  });
  check("the same email cannot be taken twice", duplicateEmail.status === 409, String(duplicateEmail.status));

  console.log("\n== Several people registering at once ==");
  // Concurrent sign-ups read the same highest registration serial and then
  // both claim it. Three of five used to be refused, with a message blaming
  // the username - which was not the field that clashed.
  const batch = Date.now().toString(36).slice(-5);
  const together = await Promise.all(Array.from({ length: 6 }, (_, i) => call("/api/auth/register", {
    method: "POST",
    body: {
      username: `race${batch}${i}`, fullName: `Race Test ${i}`,
      email: `race${batch}${i}@students.usiams.ac.tz`, password: "password123", programmeId: "BSCS"
    }
  })));
  check("every concurrent registration succeeds", together.every(r => r.status === 201),
    together.map(r => r.status + (r.json && r.json.message ? " " + r.json.message : "")).join(" | "));
  const issued = together.filter(r => r.json && r.json.registrationNumber !== undefined)
    .map(r => r.json.registrationNumber);
  const studentIds = together.filter(r => r.json && r.json.studentId).map(r => r.json.studentId);
  check("each one gets its own student record", new Set(studentIds).size === studentIds.length,
    studentIds.join(", "));
  if (issued.length) {
    check("no two share a registration number", new Set(issued).size === issued.length, issued.join(", "));
  }

  console.log("\n== Signing in as the new student ==");
  const login = await call("/api/auth/login", { method: "POST", body: { username, password: "password123" } });
  check("the new account signs in", login.status === 200 && !!login.json.token);
  const session = { token: login.json.token, user: login.json.user };
  check("the session carries a studentId", !!session.user.studentId, JSON.stringify(session.user));
  check("the role is STUDENT", session.user.role === "STUDENT");

  const boot = await call("/api/bootstrap", { token: session.token });
  const data = boot.json.data;
  check("the student sees exactly one student record - their own",
    data.students.length === 1 && data.students[0].id === session.user.studentId,
    `${data.students.length} record(s)`);
  check("their registration number follows the institutional format",
    /^T\d{2}-\d{2}-\d{5}$/.test(data.students[0].regNumber), data.students[0].regNumber);
  check("the programme and department were set",
    data.students[0].programmeId === "BSCS" && data.students[0].departmentId === "DCSE",
    `${data.students[0].programmeId}/${data.students[0].departmentId}`);

  console.log("\n== The new account must not see anyone else's records ==");
  for (const [label, key] of [["results", "results"], ["invoices", "invoices"], ["payments", "payments"],
    ["registrations", "seedRegistrations"], ["attendance", "attendance"], ["requests", "seedRequests"],
    ["complaints", "seedComplaints"], ["documents", "seedDocuments"], ["loans", "seedLoans"]]) {
    const rows = data[key] || [];
    const foreign = rows.filter(r => r.studentId && r.studentId !== session.user.studentId);
    check(`no other student's ${label} are returned`, foreign.length === 0,
      `${foreign.length} of ${rows.length} belong to someone else`);
  }
  check("the shared course catalogue is still visible", data.courses.length > 0, String(data.courses.length));
  check("staff registers stay withheld",
    boot.json.withheld.includes("users") && boot.json.withheld.includes("auditLogs"),
    JSON.stringify(boot.json.withheld));

  console.log("\n== Every student page opens for a brand-new account ==");
  const pageFiles = fs.readdirSync(path.join(ROOT, "pages"))
    .filter(f => f.endsWith(".html"))
    .filter(f => !["403.html", "404.html", "500.html"].includes(f))
    .filter(f => {
      const html = fs.readFileSync(path.join(ROOT, "pages", f), "utf8");
      const match = html.match(/USIAMS\.boot\(\s*(\[[^\]]*\]|null)/);
      if (!match) return false;
      return match[1] === "null" || match[1].includes("STUDENT");
    });

  for (const file of pageFiles) {
    let result;
    try {
      result = await renderAs(file, session);
    } catch (error) {
      check(`${file}`, false, "render threw: " + error.message);
      continue;
    }
    const detail = [
      result.problems.length ? result.problems.slice(0, 2).join("\n         ") : "",
      result.fatal ? "showed the 'USIAMS is unavailable' screen" : "",
      result.navigated ? "redirected away instead of rendering" : "",
      !result.mounted ? "the application shell did not mount" : ""
    ].filter(Boolean).join("\n         ");
    check(`${file} - ${result.clicked} controls`, !detail, detail);
  }

  console.log("\n== The new student can use the system ==");
  const filed = await call("/api/data/requests", {
    method: "POST", token: session.token,
    body: { type: "Letter", subject: "Introduction letter", description: "Requesting an introduction letter.", status: "PENDING" }
  });
  check("they can file a service request", filed.status === 201, JSON.stringify(filed.json).slice(0, 160));
  check("it is filed against their own record",
    filed.json.data && filed.json.data.studentId === session.user.studentId);
  const mine = await call("/api/data/requests", { token: session.token });
  check("and they see it back", mine.json.data.some(r => r.id === filed.json.data.id));
  check("but still only their own", mine.json.data.every(r => r.studentId === session.user.studentId));
  await call("/api/data/requests/" + filed.json.data.id, { method: "DELETE", token: session.token });

  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
})();
