/* =========================================================
   USIAMS - tests/permissions.test.js
   Administration > Roles & Permissions: rules an administrator sets
   per role and module are enforced by the server - granting access a
   role does not have by default, withholding access it does, and
   limiting a role to viewing - while the safeguards (students and the
   QA officer never manage; the system admin keeps Administration)
   cannot be overridden. Every rule is removed again at the end.
   ========================================================= */
const { check, finish, call, login } = require("./helpers");

const setRule = (token, role, module, level) =>
  call("/api/admin/permissions", { method: "PUT", token, body: { role, module, level } });

(async () => {
  const admin = await login("admin", "admin123");
  const sysadmin = await login("sysadmin", "sysadmin123");
  const librarian = await login("librarian", "librarian123");
  const finance = await login("finance", "finance123");
  const lecturer = await login("lecturer", "lecturer123");
  const student = await login("student", "student123");
  await call("/api/admin/permissions", { method: "DELETE", token: admin.token });

  console.log("== Who may manage permissions ==");
  const table = await call("/api/admin/permissions", { token: admin.token });
  check("an administrator reads the rules", table.status === 200 && Array.isArray(table.json.data.rules));
  check("with no rules set by default", table.json.data.rules.length === 0);
  check("defaults say who may change each module", table.json.data.defaultWriters.finance.includes("FINANCE_OFFICER"));
  check("a lecturer cannot read them", (await call("/api/admin/permissions", { token: lecturer.token })).status === 403);
  check("a lecturer cannot change them", (await setRule(lecturer.token, "LECTURER", "results", "manage")).status === 403);

  console.log("\n== Granting access ==");
  check("Librarian given View on Finance", (await setRule(admin.token, "LIBRARIAN", "finance", "view")).status === 200);
  const libBoot = await call("/api/bootstrap", { token: librarian.token });
  check("the rule reaches the librarian's pages", libBoot.json.permissions.finance === "view");
  check("the librarian can list control numbers", (await call("/api/finance/control-numbers", { token: librarian.token })).status === 200);
  const invoice = libBoot.json.data.invoices[0];
  check("but cannot change an invoice", (await call(`/api/data/invoices/${invoice.id}`, { method: "PATCH", token: librarian.token, body: { description: "x" } })).status === 403);

  check("Librarian given Manage on Announcements", (await setRule(admin.token, "LIBRARIAN", "announcements", "manage")).status === 200);
  const posted = await call("/api/data/announcements", { method: "POST", token: librarian.token,
    body: { title: "Library hours", body: "Open late this week.", audience: "ALL", status: "Draft", publishedAt: "2026-09-30" } });
  check("the librarian can now post an announcement", posted.status === 201, String(posted.status));
  if (posted.status === 201) await call(`/api/data/announcements/${posted.json.data.id}`, { method: "DELETE", token: admin.token });

  console.log("\n== Withholding access ==");
  check("Finance Officer set to No access on Finance", (await setRule(admin.token, "FINANCE_OFFICER", "finance", "none")).status === 200);
  check("finance routes refuse the finance officer", (await call("/api/finance/control-numbers", { token: finance.token })).status === 403);
  const finBoot = await call("/api/bootstrap", { token: finance.token });
  check("invoices and payments are withheld", finBoot.json.withheld.includes("invoices") && finBoot.json.withheld.includes("payments"));

  const result = (await call("/api/bootstrap", { token: lecturer.token })).json.data.results[0];
  check("Lecturer set to View on Results", (await setRule(admin.token, "LECTURER", "results", "view")).status === 200);
  check("the lecturer can no longer change a result", (await call(`/api/data/results/${result.id}`, { method: "PATCH", token: lecturer.token, body: { remarks: "x" } })).status === 403);

  check("Student set to No access on Requests", (await setRule(admin.token, "STUDENT", "requests", "none")).status === 200);
  check("the student can no longer raise a request", (await call("/api/data/requests", { method: "POST", token: student.token,
    body: { type: "Other", description: "Test", studentId: student.user.studentId } })).status === 403);

  console.log("\n== Safeguards ==");
  check("students cannot be given Manage", (await setRule(admin.token, "STUDENT", "requests", "manage")).status === 422);
  check("the QA officer cannot be given Manage", (await setRule(admin.token, "QUALITY_ASSURANCE_OFFICER", "results", "manage")).status === 422);
  check("the system admin cannot lose Administration", (await setRule(admin.token, "SYSTEM_ADMIN", "administration", "none")).status === 422);
  check("an unknown module is refused", (await setRule(admin.token, "LECTURER", "nothing", "view")).status === 422);
  check("University Admin set to View on Administration", (await setRule(sysadmin.token, "UNIVERSITY_ADMIN", "administration", "view")).status === 200);
  check("the university admin can then no longer change permissions", (await setRule(admin.token, "LECTURER", "results", null)).status === 403);
  check("nor system settings", (await call("/api/settings/system", { method: "PUT", token: admin.token, body: { maintenanceMode: false } })).status === 403);
  check("the system admin still can", (await setRule(sysadmin.token, "UNIVERSITY_ADMIN", "administration", null)).status === 200);

  console.log("\n== Back to the defaults ==");
  const logged = (await call("/api/data/auditLogs", { token: admin.token })).json.data.filter(a => a.entity === "role_permissions");
  check("every change is in the audit log", logged.length >= 8, String(logged.length));
  check("reset removes every rule", (await call("/api/admin/permissions", { method: "DELETE", token: admin.token })).status === 200);
  check("the finance officer has Finance again", (await call("/api/finance/control-numbers", { token: finance.token })).status === 200);
  check("the lecturer can change results again", (await call(`/api/data/results/${result.id}`, { method: "PATCH", token: lecturer.token, body: { remarks: "" } })).status === 200);

  finish();
})().catch(async error => {
  console.error(error);
  // Never leave rules behind for the suites that follow.
  try { const admin = await login("admin", "admin123"); await call("/api/admin/permissions", { method: "DELETE", token: admin.token }); } catch { /* best effort */ }
  process.exit(1);
});
