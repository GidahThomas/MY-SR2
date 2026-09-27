/* =========================================================
   USIAMS - page-includes.js
   The stylesheets and scripts every application page loads, listed
   once. A page marks where they go:

     <!-- include: app-styles -->           the stylesheet links
     <!-- include: app-scripts -->          the shared scripts, in order
     <!-- include: app-scripts charts -->   the same, plus Chart.js
     <!-- include: app-shell-start -->      the sidebar, navbar and the
     <!-- include: app-shell-end -->        <main> the page's content goes in

   and server.js replaces each marker as it sends the page. Before this
   every page repeated the same ~57 lines, so adding a script meant
   editing 38 files - and missing one.

   Paths are written from the project root; the "../" a page in pages/
   needs is added here.
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");

const APP_STYLES = [
  "assets/vendor/bootstrap/bootstrap.min.css",
  "assets/vendor/bootstrap-icons/bootstrap-icons.css",
  "css/style.css", "css/components.css", "css/dashboard.css", "css/responsive.css", "css/print.css"
];

// Order matters: storage and the API bridge first, then shared rules and
// the data files (each builds on the ones before it), then the services
// and components the page modules use, then the app shell.
const APP_SCRIPTS = [
  "assets/vendor/bootstrap/bootstrap.bundle.min.js",
  "js/storage.js", "js/api.js", "js/ui.js", "components/toast.js", "components/modal.js",
  "data/shared.js", "data/grading-system.js", "data/academic-structure.js", "data/courses.js", "data/users.js",
  "data/students.js", "data/results.js", "data/registrations.js", "data/finance.js", "data/attendance.js",
  "data/timetable.js", "data/requests.js", "data/complaints.js", "data/notifications.js", "data/calendar.js",
  "data/announcements.js", "data/documents.js", "data/internship.js", "data/graduation.js", "data/alumni.js",
  "data/library.js", "data/hostel.js", "data/elearning.js", "data/admissions.js", "data/qa-flags.js",
  "data/audit-logs.js",
  "js/gpa.js", "js/auth.js", "js/navigation.js", "js/search.js", "js/notifications.js", "js/qa.js",
  "js/charts.js", "js/library.js", "js/hostel.js", "js/elearning.js", "js/admissions.js", "js/announcements.js",
  "components/table.js", "components/cards.js", "components/sidebar.js", "components/navbar.js",
  "js/app.js"
];
const CHART_LIBRARY = "assets/vendor/chart.js/chart.umd.min.js";

// The application frame: js/app.js fills the sidebar and navbar.
const APP_SHELL_START = [
  '<div class="app-shell" id="appShell">',
  '  <aside class="app-sidebar" id="sidebarContainer"></aside>',
  '  <div class="app-main">',
  '    <header class="app-navbar" id="navbarContainer"></header>',
  '    <main class="app-content">'
].join("\n");
const APP_SHELL_END = ["    </main>", "  </div>", "</div>"].join("\n");

const MARKER = /<!--\s*include:\s*([a-z-]+)((?:\s+[a-z-]+)*)\s*-->/g;

function render(name, options, base) {
  if (name === "app-styles") {
    return APP_STYLES.map(href => `<link rel="stylesheet" href="${base}${href}">`).join("\n");
  }
  if (name === "app-scripts") {
    const scripts = [...APP_SCRIPTS];
    // Chart.js must load before js/charts.js, which configures it.
    if (options.includes("charts")) scripts.splice(1, 0, CHART_LIBRARY);
    return scripts.map(src => `<script src="${base}${src}"></script>`).join("\n");
  }
  if (name === "app-shell-start") return APP_SHELL_START;
  if (name === "app-shell-end") return APP_SHELL_END;
  throw new Error(`Unknown page include "${name}".`);
}

/** Replaces the include markers in a page's HTML. */
function expand(html, base) {
  return html.replace(MARKER, (_, name, options) => render(name, options.trim().split(/\s+/).filter(Boolean), base));
}

// Expanded pages are kept until the file changes.
const cache = new Map();

/** The HTML to send for a page file under root. */
function pageHtml(filePath, root) {
  const stat = fs.statSync(filePath);
  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.html;
  const depth = path.relative(root, path.dirname(filePath)).split(path.sep).filter(Boolean).length;
  const html = expand(fs.readFileSync(filePath, "utf8"), "../".repeat(depth));
  cache.set(filePath, { mtimeMs: stat.mtimeMs, html });
  return html;
}

module.exports = { APP_STYLES, APP_SCRIPTS, APP_SHELL_START, APP_SHELL_END, expand, pageHtml };
