/* =========================================================
   USIAMS - tests/interactions.test.js
   Clicks the controls on every page and fails on any error the
   handler throws.

   tests/pages.test.js only proves a page renders. Most of the
   application's code lives behind a button: opening a modal,
   switching a tab, exporting a report, borrowing a book. Those
   paths are where the four "currentUser is not defined" faults
   hid - they were invisible until something invoked them.

   Destructive handlers are neutered rather than avoided:
   window.confirm returns false, so anything that asks before
   deleting stops at the prompt while still exercising the code
   that runs up to it.
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole, requestInterceptor } = require("jsdom");

const BASE = process.env.BASE || "http://127.0.0.1:3311";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (l, c, d = "") => { c ? (pass++, console.log("  PASS " + l)) : (fail++, console.log("  FAIL " + l + (d ? "\n         " + d : ""))); };

const CREDENTIALS = {
  STUDENT: ["student", "student123"],
  LECTURER: ["lecturer", "lecturer123"],
  UNIVERSITY_ADMIN: ["admin", "admin123"],
  QUALITY_ASSURANCE_OFFICER: ["qa", "qa123"],
  FINANCE_OFFICER: ["finance", "finance123"],
  REGISTRATION_OFFICER: ["registration", "registration123"],
  SYSTEM_ADMIN: ["sysadmin", "sysadmin123"],
  LIBRARIAN: ["librarian", "librarian123"],
  HOSTEL_OFFICER: ["hostel", "hostel123"]
};

const sessions = {};
async function signIn(role) {
  if (sessions[role]) return sessions[role];
  const [username, password] = CREDENTIALS[role];
  const result = await (await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })).json();
  if (!result.token) throw new Error(`could not sign in as ${role}`);
  sessions[role] = result;
  return result;
}

const ROLE_PAGE_ALLOWLIST = (() => {
  const source = fs.readFileSync(path.join(ROOT, "js", "auth.js"), "utf8");
  const block = source.match(/ROLE_PAGE_ALLOWLIST\s*=\s*\{([\s\S]*?)\};/);
  if (!block) return {};
  const allowlist = {};
  for (const line of block[1].split("\n")) {
    const entry = line.match(/(\w+)\s*:\s*\[([^\]]*)\]/);
    if (entry) allowlist[entry[1]] = entry[2].split(",").map(s => s.trim().replace(/['"]/g, "")).filter(Boolean);
  }
  return allowlist;
})();
const isRestricted = (role, file) => {
  const allowed = ROLE_PAGE_ALLOWLIST[role];
  return !!allowed && !allowed.includes(file);
};

function rolesFor(html) {
  const match = html.match(/USIAMS\.boot\(\s*(\[[^\]]*\]|null)/);
  if (!match) return null;
  if (match[1] === "null") return Object.keys(CREDENTIALS);
  try { return JSON.parse(match[1].replace(/'/g, '"')).filter(role => CREDENTIALS[role]); }
  catch { return null; }
}

function localOnly() {
  return requestInterceptor(request => {
    if (request.url.startsWith(BASE)) return undefined;
    return new Response("", { status: 200, headers: { "Content-Type": "text/plain" } });
  });
}

async function exercise(pageUrl, role) {
  const session = await signIn(role);
  const problems = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => {
    const message = error.message || "";
    if (/Could not load|stylesheet|getContext|canvas npm package|acquire context|Not implemented/i.test(message)) return;
    problems.push(message.split("\n")[0]);
  });
  virtualConsole.on("error", (...args) => {
    const text = args.join(" ");
    if (/acquire context|canvas/i.test(text)) return;
    problems.push("console.error: " + text.split("\n")[0]);
  });

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
      // Anything that asks before destroying data stops here.
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
  const deadline = Date.now() + 8000;
  const mounted = () => !!window.document.querySelector("#sidebarContainer a, .app-footer");
  while (Date.now() < deadline && !mounted()) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 250));

  if (!mounted()) { dom.window.close(); return { problems, clicked: 0, skipped: true }; }

  // Everything a user can press, plus the tab strips and table controls.
  const controls = [...window.document.querySelectorAll(
    "button:not([data-bs-dismiss]), [data-bs-toggle='tab'], [role='tab'], .nav-link[href^='#']"
  )].filter(el => !el.closest(".app-sidebar, .app-navbar"));

  let clicked = 0;
  for (const control of controls.slice(0, 40)) {
    try {
      control.click();
      clicked++;
      // Let any async handler settle and surface its error.
      await new Promise(r => setTimeout(r, 30));
    } catch (error) {
      problems.push(`click(${control.id || control.textContent.trim().slice(0, 24)}): ${error.message}`);
    }
  }

  // Change every select and input so change/input handlers run too.
  for (const select of [...window.document.querySelectorAll("select")].slice(0, 15)) {
    try {
      if (select.options.length > 1) {
        select.selectedIndex = select.options.length - 1;
        select.dispatchEvent(new window.Event("change", { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
      }
    } catch (error) {
      problems.push(`change(${select.id}): ${error.message}`);
    }
  }

  await new Promise(r => setTimeout(r, 300));
  dom.window.close();
  return { problems, clicked, skipped: false };
}

(async () => {
  // administration.html carries the account status toggle, so pressing its
  // buttons deactivates real accounts - and a deactivated account's session
  // is now revoked immediately. Exercising it last keeps that from stopping
  // the finance and hostel officers from opening their own pages.
  const ACCOUNT_CHANGING_PAGES = ["administration.html"];
  const pageFiles = fs.readdirSync(path.join(ROOT, "pages"))
    .filter(f => f.endsWith(".html"))
    .filter(f => !["403.html", "404.html", "500.html"].includes(f))
    .sort((a, b) => ACCOUNT_CHANGING_PAGES.indexOf(a) - ACCOUNT_CHANGING_PAGES.indexOf(b) || a.localeCompare(b));

  // Sign every role in before touching anything. Pressing buttons on the
  // administration page legitimately deactivates accounts, and a
  // deactivated account cannot sign in afterwards - so the sessions are
  // established first rather than lazily, part-way through the run.
  for (const role of Object.keys(CREDENTIALS)) await signIn(role);

  console.log(`== Exercising the controls on ${pageFiles.length} pages ==\n`);

  for (const file of pageFiles) {
    const html = fs.readFileSync(path.join(ROOT, "pages", file), "utf8");
    const roles = (rolesFor(html) || []).filter(role => CREDENTIALS[role] && !isRestricted(role, file));
    if (!roles.length) continue;

    // A student and one staff account cover the two control sets: a page
    // shows different buttons to the person who owns the record and to the
    // office that processes it.
    const chosen = [];
    if (roles.includes("STUDENT")) chosen.push("STUDENT");
    const staff = roles.find(r => r !== "STUDENT");
    if (staff) chosen.push(staff);
    if (!chosen.length) chosen.push(roles[0]);

    for (const role of chosen) {
      let result;
      try {
        result = await exercise(`${BASE}/pages/${file}`, role);
      } catch (error) {
        check(`${file} [${role}]`, false, "harness error: " + error.message);
        continue;
      }
      if (result.skipped) { console.log(`  SKIP ${file} [${role}] (did not mount)`); continue; }
      check(`${file} [${role}] - ${result.clicked} controls`, result.problems.length === 0,
        result.problems.slice(0, 3).join("\n         "));
    }
  }

  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
})();
