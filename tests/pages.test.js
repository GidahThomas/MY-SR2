/* =========================================================
   USIAMS - tests/pages.test.js
   Loads every authenticated page in a real DOM, signed in as each
   role that is allowed to open it, and fails on any uncaught error
   or failed render.

   This is the suite that exercises the forty page modules end to
   end: the pages are served by the running server, their scripts
   execute for real, USIAMS.boot() fetches live data over HTTP, and
   the modules render against it. A module reading a field the API
   no longer returns shows up here as a thrown TypeError rather
   than as a silently blank panel in the browser.
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole, requestInterceptor } = require("jsdom");

/**
 * Serves only the application's own files. Bootstrap, Chart.js and the icon
 * font come from a CDN, and fetching them for every page/role combination
 * made the suite both slow and flaky: under that load jsdom's resource
 * queue stalls and a page that renders perfectly well appears not to mount.
 * Those two libraries are stubbed on the window instead - see beforeParse.
 */
function localOnly() {
  return requestInterceptor(request => {
    // Third-party libraries (served from assets/vendor/) are stubbed, as
    // they were when they came from a CDN: the harness supplies its own
    // bootstrap and Chart stand-ins.
    if (request.url.startsWith(BASE) && !request.url.includes("/assets/vendor/")) return undefined;
    return new Response("", { status: 200, headers: { "Content-Type": "text/plain" } });
  });
}

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
  if (!result.token) throw new Error(`could not sign in as ${role}: ${result.message}`);
  sessions[role] = result;
  return result;
}

/**
 * js/auth.js restricts two roles to a short list of pages, whatever the
 * page's own role list says. A librarian opening pages/academics.html is
 * supposed to be bounced to 403, so those combinations are asserted as
 * redirects rather than renders.
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

/** The roles a page's own USIAMS.boot(...) call admits. */
function rolesFor(html) {
  const match = html.match(/USIAMS\.boot\(\s*(\[[^\]]*\]|null)/);
  if (!match) return null;
  if (match[1] === "null") return Object.keys(CREDENTIALS);
  try {
    return JSON.parse(match[1].replace(/'/g, '"')).filter(role => CREDENTIALS[role]);
  } catch {
    return null;
  }
}

/** Renders one page as one role and returns everything that went wrong. */
async function renderPage(pageUrl, role) {
  const session = await signIn(role);
  const problems = [];
  const virtualConsole = new VirtualConsole();
  const navigations = [];
  virtualConsole.on("jsdomError", error => {
    // Stylesheet and font fetches from the CDN are not what we are testing.
    if (/Could not load|stylesheet/i.test(error.message)) return;
    // jsdom has no 2D canvas, so Chart.js cannot draw. That is a limitation
    // of this harness, not of the page; the charts render in a browser.
    if (/getContext|canvas npm package|acquire context/i.test(error.message)) return;
    // jsdom does not navigate; it reports the attempt. That is how a
    // redirect to login.html or 403.html surfaces here.
    if (/Not implemented: navigation/i.test(error.message)) {
      navigations.push(error.message);
      return;
    }
    problems.push(error.stack || error.message);
  });
  virtualConsole.on("error", (...args) => {
    const text = args.join(" ");
    if (/acquire context|canvas/i.test(text)) return;
    problems.push("console.error: " + text);
  });

  const dom = await JSDOM.fromURL(pageUrl, {
    runScripts: "dangerously",
    resources: { interceptors: [localOnly()] },
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // Stand-ins for the two CDN libraries, which are not loaded here.
      // Only bootstrap.Modal and the Chart constructor are ever used.
      window.bootstrap = {
        Modal: class {
          constructor(element) { this.element = element; }
          show() {} hide() {} dispose() {}
          static getInstance() { return null; }
          static getOrCreateInstance(element) { return new window.bootstrap.Modal(element); }
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
              target[key] = isPlain(value) && isPlain(target[key])
                ? window.Chart.helpers.merge({ ...target[key] }, value)
                : value;
            }
          }
          return target;
        }
      };
      // Seed the session the way a real sign-in would, before any script runs.
      window.localStorage.setItem("usiams.session.token", JSON.stringify(session.token));
      window.localStorage.setItem("usiams.session.currentUser", JSON.stringify(session.user));
      // jsdom ships no fetch; every browser the app targets has one.
      // Relative API paths are resolved against the page being rendered.
      window.fetch = (input, init) => fetch(new URL(String(input), pageUrl).href, init);
      window.Headers = Headers;
      window.Request = Request;
      window.Response = Response;
      window.confirm = () => false;
      window.alert = () => {};
      window.scrollTo = () => {};
      window.print = () => {};
      window.URL.createObjectURL = () => "blob:stub";
      window.URL.revokeObjectURL = () => {};
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    }
  });

  // Wait for boot() to hydrate and mount, rather than guessing a delay:
  // the heavier pages take noticeably longer than the simple ones.
  const { window } = dom;
  const deadline = Date.now() + 8000;
  const isMounted = () => !!window.document.querySelector("#sidebarContainer .sidebar-nav, #sidebarContainer a, .app-footer");
  while (Date.now() < deadline && !isMounted() && !/USIAMS is unavailable/.test(window.document.body.textContent)) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // Give the page module a moment to finish rendering after the shell.
  await new Promise(resolve => setTimeout(resolve, 250));
  const bodyText = window.document.body ? window.document.body.textContent : "";
  // jsdom reports "Not implemented: navigation" without the target URL,
  // so an attempted navigation during boot is taken as the redirect that
  // requireAuth performs for a role the page will not serve.
  const redirected = navigations.length > 0;
  const fatal = /USIAMS is unavailable/.test(bodyText);
  const mounted = isMounted();

  dom.window.close();
  return { problems, redirected, fatal, mounted, bodyText };
}

(async () => {
  const pageFiles = fs.readdirSync(path.join(ROOT, "pages"))
    .filter(f => f.endsWith(".html"))
    .filter(f => !["403.html", "404.html", "500.html"].includes(f));

  console.log(`== Rendering ${pageFiles.length} pages in a real DOM ==\n`);

  for (const file of pageFiles) {
    const html = fs.readFileSync(path.join(ROOT, "pages", file), "utf8");
    const roles = rolesFor(html);
    if (!roles || !roles.length) { console.log(`  SKIP ${file} (no boot roles found)`); continue; }

    // Every role the page admits is rendered, not a representative sample.
    // Dashboards in particular branch per role - the librarian and hostel
    // officer panels each threw a ReferenceError that a sample of three
    // roles walked straight past.
    const chosen = roles.filter(role => CREDENTIALS[role]);
    if (!chosen.length) chosen.push(roles[0]);

    for (const role of chosen) {
      let result;
      try {
        result = await renderPage(`${BASE}/pages/${file}`, role);
        // A bare mount timeout with nothing else wrong is this harness
        // stalling, not the page failing - jsdom occasionally takes longer
        // than the deadline when a whole suite runs back to back. Anything
        // that actually threw is reported at once and never retried.
        if (!result.mounted && !result.problems.length && !result.fatal && !result.redirected) {
          result = await renderPage(`${BASE}/pages/${file}`, role);
        }
      } catch (error) {
        check(`${file} [${role}]`, false, "render threw: " + error.message);
        continue;
      }

      if (isRestricted(role, file)) {
        // The page must refuse to render for this role.
        check(`${file} [${role}] is refused`, result.redirected && !result.mounted,
          result.mounted ? "the page rendered for a role the allowlist forbids" : "no redirect was attempted");
        continue;
      }

      const detail = [
        result.problems.length ? result.problems.slice(0, 2).join("\n         ") : "",
        result.fatal ? "page showed the 'USIAMS is unavailable' screen" : "",
        result.redirected ? "redirected away instead of rendering" : "",
        !result.mounted ? "application shell did not mount" : ""
      ].filter(Boolean).join("\n         ");

      check(`${file} [${role}]`, !detail, detail);
    }
  }

  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
})();
