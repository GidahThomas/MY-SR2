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
const { BASE, ROOT, check, finish, CREDENTIALS, signIn, isRestricted, rolesFor, openPage, pressControls } = require("./helpers");

/** Opens a page as a role, presses its controls and changes its selects. */
async function exercise(pageUrl, role) {
  const { window, problems, mounted } = await openPage(pageUrl, await signIn(role));
  if (!mounted) { window.close(); return { problems, clicked: 0, skipped: true }; }

  const clicked = await pressControls(window, problems, { limit: 40 });

  // Change every select so change handlers run too.
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
  window.close();
  // jsdom's "not implemented" notices (downloads, window features) are the
  // harness's limits, not the page's faults.
  return { problems: problems.filter(p => !/Not implemented/i.test(p)), clicked, skipped: false };
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

  finish();
})();
