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
const { BASE, ROOT, check, finish, CREDENTIALS, signIn, isRestricted, rolesFor, openPage } = require("./helpers");

/** Renders one page as one role and reports what went wrong. */
async function renderPage(pageUrl, role) {
  const { window, problems, navigations, mounted } = await openPage(pageUrl, await signIn(role));
  const bodyText = window.document.body ? window.document.body.textContent : "";
  window.close();
  return {
    problems,
    // jsdom reports "Not implemented: navigation" without the target, so an
    // attempted navigation during boot is taken as the redirect requireAuth
    // performs for a role the page will not serve.
    redirected: navigations.length > 0,
    fatal: /USIAMS is unavailable/.test(bodyText),
    mounted,
    bodyText
  };
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

  finish();
})();
