/* =========================================================
   USIAMS - tests/helpers.js
   What the test suites share, so each suite holds only its own
   checks:

     check / finish         PASS/FAIL lines and the closing summary
     call / login           JSON requests against the running server
     CREDENTIALS, signIn    the demo accounts (test database only)
     rolesFor, isRestricted which roles a page admits
     openPage               a page loaded in jsdom, signed in, with the
                            browser libraries stubbed
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE || "http://127.0.0.1:3311";
const ROOT = path.join(__dirname, "..");

// ---- Results ------------------------------------------------------------
let pass = 0, fail = 0;

function check(label, condition, detail = "") {
  if (condition) { pass++; console.log("  PASS " + label); }
  else { fail++; console.log("  FAIL " + label + (detail ? "\n         " + detail : "")); }
}

/** Prints the summary and exits with the suite's result. */
function finish() {
  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
}

// ---- API ------------------------------------------------------------------
async function call(urlPath, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, json };
}

/** { token, user } for a successful sign-in, otherwise null. */
async function login(username, password) {
  const r = await call("/api/auth/login", { method: "POST", body: { username, password } });
  return r.json && r.json.token ? { token: r.json.token, user: r.json.user } : null;
}

// ---- Demo accounts (seeded into the test database only) --------------------
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
/** Signs a role in once and reuses the session. */
async function signIn(role) {
  if (sessions[role]) return sessions[role];
  const session = await login(...CREDENTIALS[role]);
  if (!session) throw new Error(`could not sign in as ${role}`);
  sessions[role] = session;
  return session;
}

// ---- Which roles a page admits ------------------------------------------------
/**
 * js/auth.js restricts some roles to a short list of pages, whatever the
 * page's own role list says; such a role opening another page is sent to
 * 403.
 */
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

function isRestricted(role, file) {
  const allowed = ROLE_PAGE_ALLOWLIST[role];
  return !!allowed && !allowed.includes(file);
}

/** The demo roles a page's own USIAMS.boot(...) call admits. */
function rolesFor(html) {
  const match = html.match(/USIAMS\.boot\(\s*(\[[^\]]*\]|null)/);
  if (!match) return null;
  if (match[1] === "null") return Object.keys(CREDENTIALS);
  try { return JSON.parse(match[1].replace(/'/g, '"')).filter(role => CREDENTIALS[role]); }
  catch { return null; }
}

// ---- Pages in jsdom -------------------------------------------------------
const IGNORED = /Could not load|stylesheet|getContext|canvas npm package|acquire context/i;

/**
 * Loads a page signed in as `session` and waits for it to mount.
 * Only the application's own files are fetched; Bootstrap and Chart.js are
 * replaced by small stand-ins (jsdom has no canvas, and loading them for
 * every page and role made the suites slow and flaky).
 *
 * Returns { window, dom, problems, navigations, mounted }. `problems`
 * collects uncaught errors and console.error output; `navigations` the
 * redirects jsdom reports but does not follow.
 */
async function openPage(pageUrl, session) {
  const { JSDOM, VirtualConsole, requestInterceptor } = require("jsdom");
  const problems = [];
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => {
    const message = error.message || "";
    if (IGNORED.test(message)) return;
    if (/Not implemented: navigation/i.test(message)) { navigations.push(message); return; }
    problems.push(message.split("\n")[0]);
  });
  virtualConsole.on("error", (...args) => {
    const text = args.join(" ");
    if (/acquire context|canvas/i.test(text)) return;
    problems.push("console.error: " + text.split("\n")[0]);
  });

  const dom = await JSDOM.fromURL(pageUrl, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    resources: {
      interceptors: [requestInterceptor(request =>
        request.url.startsWith(BASE) && !request.url.includes("/assets/vendor/")
          ? undefined
          : new Response("", { status: 200, headers: { "Content-Type": "text/plain" } }))]
    },
    beforeParse(window) {
      window.bootstrap = {
        Modal: class {
          constructor(element) { this.element = element; }
          show() {} hide() {} dispose() {}
          static getInstance() { return null; }
          static getOrCreateInstance(element) { return new window.bootstrap.Modal(element); }
        },
        Tab: class { constructor(element) { this.element = element; } show() {} },
        Offcanvas: class {
          show() {} hide() {}
          static getOrCreateInstance() { return new window.bootstrap.Offcanvas(); }
        }
      };
      window.Chart = class {
        constructor() { this.data = {}; this.options = {}; }
        update() {} destroy() {} resize() {}
        static register() {}
      };
      // js/charts.js builds its options with Chart.helpers.merge().
      window.Chart.helpers = {
        merge(target, ...sources) {
          const isPlain = v => v && typeof v === "object" && !Array.isArray(v);
          for (const source of sources) {
            if (!isPlain(source)) continue;
            for (const [key, value] of Object.entries(source)) {
              target[key] = isPlain(value) && isPlain(target[key]) ? window.Chart.helpers.merge({ ...target[key] }, value) : value;
            }
          }
          return target;
        }
      };
      // The session a real sign-in would leave, before any script runs.
      if (session) {
        window.localStorage.setItem("usiams.session.token", JSON.stringify(session.token));
        window.localStorage.setItem("usiams.session.currentUser", JSON.stringify(session.user));
      }
      // Relative API paths resolve against the page being rendered.
      window.fetch = (input, init) => fetch(new URL(String(input), pageUrl).href, init);
      window.Headers = Headers; window.Request = Request; window.Response = Response;
      // Anything that asks before destroying data stops at the question.
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
  const isMounted = () => !!window.document.querySelector("#sidebarContainer .sidebar-nav, #sidebarContainer a, .app-footer");
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && !isMounted() && !/USIAMS is unavailable/.test(window.document.body.textContent)) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // Give the page module a moment to finish rendering after the shell.
  await new Promise(resolve => setTimeout(resolve, 250));
  return { window, dom, problems, navigations, mounted: isMounted() };
}

/** Clicks a page's own controls (not the shell's); returns how many. */
async function pressControls(window, problems, { limit = 40, selector = "button:not([data-bs-dismiss]), [data-bs-toggle='tab'], [role='tab'], .nav-link[href^='#']" } = {}) {
  const controls = [...window.document.querySelectorAll(selector)].filter(el => !el.closest(".app-sidebar, .app-navbar"));
  let clicked = 0;
  for (const control of controls.slice(0, limit)) {
    try { control.click(); clicked++; }
    catch (error) { problems.push(`click(${control.id || control.textContent.trim().slice(0, 24)}): ${error.message}`); }
    // Let any async handler settle and surface its error.
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  return clicked;
}

module.exports = {
  BASE, ROOT, check, finish, call, login, CREDENTIALS, signIn, isRestricted, rolesFor, openPage, pressControls
};
