const BASE = process.env.BASE || "http://127.0.0.1:3311";
let pass = 0, fail = 0;

function check(label, condition, detail = "") {
  if (condition) { pass++; console.log("  PASS " + label); }
  else { fail++; console.log("  FAIL " + label + (detail ? " -> " + detail : "")); }
}

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function login(username, password) {
  const r = await call("/api/auth/login", { method: "POST", body: { username, password } });
  return r.json && r.json.token ? { token: r.json.token, user: r.json.user } : null;
}

(async () => {
  console.log("\n== Authentication ==");
  const student = await login("student", "student123");
  check("student logs in", !!student);
  check("student session carries studentId", student && student.user.studentId === "STU-0001", JSON.stringify(student && student.user));
  const admin = await login("admin", "admin123");
  check("admin logs in", !!admin);
  const qa = await login("qa", "qa123");
  check("qa officer logs in", !!qa);
  const finance = await login("finance", "finance123");
  check("finance officer logs in", !!finance);
  const librarian = await login("librarian", "librarian123");
  check("librarian logs in", !!librarian);
  const bad = await call("/api/auth/login", { method: "POST", body: { username: "student", password: "wrong" } });
  check("bad password rejected 401", bad.status === 401);
  const noAuth = await call("/api/bootstrap");
  check("bootstrap needs a session", noAuth.status === 401);

  console.log("\n== Bootstrap ==");
  const adminBoot = await call("/api/bootstrap", { token: admin.token });
  check("admin bootstrap ok", adminBoot.status === 200);
  const ad = adminBoot.json.data;
  check("admin sees 60 students", ad.students.length === 60, String(ad.students && ad.students.length));
  check("admin sees 39 courses", ad.courses.length === 39);
  check("admin sees 67 results", ad.results.length === 67);
  check("admin sees 60 invoices", ad.invoices.length === 60);
  check("admin sees alumni", ad.alumni.length === 12);
  check("admin sees audit logs", ad.seedAuditLogs.length >= 15);
  check("courses keep programmeIds", Array.isArray(ad.courses[0].programmeIds));
  check("registrations keep courseIds", Array.isArray(ad.seedRegistrations[0].courseIds));
  check("attendance has percentage", typeof ad.attendance[0].percentage === "number");

  const studentBoot = await call("/api/bootstrap", { token: student.token });
  const sd = studentBoot.json.data;
  check("student sees only own results", sd.results.every(r => r.studentId === "STU-0001"), String(sd.results.length));
  check("student sees only own invoices", sd.invoices.every(r => r.studentId === "STU-0001"));
  check("student sees only own student record", sd.students.length === 1 && sd.students[0].id === "STU-0001");
  check("student sees shared course catalogue", sd.courses.length === 39);
  check("student is denied alumni register", studentBoot.json.withheld.includes("alumni"));
  check("student is denied user accounts", studentBoot.json.withheld.includes("users"));
  check("student is denied audit logs", studentBoot.json.withheld.includes("auditLogs"));
  check("student gets own + broadcast notifications",
    sd.seedNotifications.every(n => n.target === "USR-0001" || n.audience === "ALL"), String(sd.seedNotifications.length));

  console.log("\n== Read-only enforcement (QA Officer) ==");
  const qaRead = await call("/api/data/students", { token: qa.token });
  check("qa can read students", qaRead.status === 200 && qaRead.json.data.length === 60);
  const qaWrite = await call("/api/data/students", {
    method: "POST", token: qa.token,
    body: { regNumber: "T99-03-99999", firstName: "Q", lastName: "A", programmeId: "BSCS", departmentId: "DCSE", email: "qa.test@x.ac.tz", year: 1, status: "Active" }
  });
  check("qa write refused 403", qaWrite.status === 403, JSON.stringify(qaWrite.json));
  check("qa refusal explains read-only", qaWrite.json && /read-only/i.test(qaWrite.json.message));
  const qaDelete = await call("/api/data/students/STU-0002", { method: "DELETE", token: qa.token });
  check("qa delete refused 403", qaDelete.status === 403);

  console.log("\n== Role boundaries ==");
  const libInvoice = await call("/api/data/invoices", {
    method: "POST", token: librarian.token,
    body: { studentId: "STU-0002", academicYearId: "AY2025", description: "x", amountBilled: 1, issuedDate: "2026-01-01", dueDate: "2026-02-01" }
  });
  check("librarian cannot write invoices", libInvoice.status === 403);
  const finInvoice = await call("/api/data/invoices", {
    method: "POST", token: finance.token,
    body: { studentId: "STU-0002", academicYearId: "AY2025", description: "Test invoice", amountBilled: 50000, issuedDate: "2026-01-01", dueDate: "2026-02-01" }
  });
  check("finance officer can create invoice", finInvoice.status === 201, JSON.stringify(finInvoice.json).slice(0, 200));
  const createdInvoiceId = finInvoice.json && finInvoice.json.data && finInvoice.json.data.id;
  const studentInvoice = await call("/api/data/invoices", {
    method: "POST", token: student.token,
    body: { studentId: "STU-0001", academicYearId: "AY2025", description: "self", amountBilled: 1, issuedDate: "2026-01-01", dueDate: "2026-02-01" }
  });
  check("student cannot invoice themselves", studentInvoice.status === 403);

  console.log("\n== Student self-service ==");
  const ownRequest = await call("/api/data/requests", {
    method: "POST", token: student.token,
    body: { type: "Transcript", subject: "Transcript copy", description: "Need a transcript for an application.", status: "PENDING" }
  });
  check("student files own request", ownRequest.status === 201, JSON.stringify(ownRequest.json).slice(0, 200));
  const newRequestId = ownRequest.json && ownRequest.json.data && ownRequest.json.data.id;
  check("request is bound to the signed-in student",
    ownRequest.json && ownRequest.json.data && ownRequest.json.data.studentId === "STU-0001");

  const otherStudentRequest = await call("/api/data/requests", {
    method: "POST", token: student.token,
    body: { studentId: "STU-0009", type: "Letter", subject: "x", description: "Filed against another student." }
  });
  check("request forged for another student is refused or rebound",
    otherStudentRequest.status === 403 ||
    (otherStudentRequest.json.data && otherStudentRequest.json.data.studentId === "STU-0001"),
    JSON.stringify(otherStudentRequest.json).slice(0, 160));

  // A student must not be able to edit someone else's record.
  const foreign = await call("/api/data/requests/REQ-0007", { method: "PATCH", token: student.token, body: { status: "RESOLVED" } });
  check("student cannot edit another student's request", foreign.status === 403 || foreign.status === 404, String(foreign.status));

  console.log("\n== Update / delete round trip ==");
  const patched = await call("/api/data/books/BK-0001", { method: "PATCH", token: librarian.token, body: { category: "Algorithms" } });
  check("librarian updates a book", patched.status === 200 && patched.json.data.category === "Algorithms");
  await call("/api/data/books/BK-0001", { method: "PATCH", token: librarian.token, body: { category: "Computer Science" } });

  const regPatch = await call("/api/data/registrations/REG-0001", {
    method: "PATCH", token: admin.token, body: { courseIds: ["CP301", "CP302"] }
  });
  check("join collections update", regPatch.status === 200 && regPatch.json.data.courseIds.length === 2,
    JSON.stringify(regPatch.json).slice(0, 160));
  await call("/api/data/registrations/REG-0001", {
    method: "PATCH", token: admin.token, body: { courseIds: ["CP301", "CP302", "CP304", "CP401"] }
  });

  if (newRequestId) {
    const del = await call("/api/data/requests/" + newRequestId, { method: "DELETE", token: admin.token });
    check("admin deletes a request", del.status === 200);
  }
  if (createdInvoiceId) {
    const del = await call("/api/data/invoices/" + createdInvoiceId, { method: "DELETE", token: finance.token });
    check("finance deletes its invoice", del.status === 200);
  }

  console.log("\n== Elections ==");
  const election = await call("/api/elections/active", { token: student.token });
  check("active election returned", election.status === 200 && election.json.election, JSON.stringify(election.json).slice(0, 160));
  const positions = election.json.election ? election.json.election.positions : [];
  check("ballot has candidates", positions.length > 0 && positions[0].candidates.length > 0);
  if (positions.length && positions[0].candidates.length) {
    const vote = await call("/api/elections/vote", {
      method: "POST", token: student.token,
      body: { electionId: election.json.election.id, positionId: positions[0].id, candidateId: positions[0].candidates[0].id }
    });
    check("student casts a vote", vote.status === 201 || vote.status === 409, JSON.stringify(vote.json));
    const again = await call("/api/elections/vote", {
      method: "POST", token: student.token,
      body: { electionId: election.json.election.id, positionId: positions[0].id, candidateId: positions[0].candidates[0].id }
    });
    check("double vote rejected 409", again.status === 409);
    const staffVote = await call("/api/elections/vote", {
      method: "POST", token: admin.token,
      body: { electionId: election.json.election.id, positionId: positions[0].id, candidateId: positions[0].candidates[0].id }
    });
    check("non-student cannot vote", staffVote.status === 403);
  }

  console.log("\n== Public routes ==");
  const programmes = await call("/api/public/programmes");
  check("public programme list", programmes.status === 200 && programmes.json.data.length === 37);

  console.log("\n== Library availability stays correct ==");
  // available_copies used to be a stored number that nothing updated, so a
  // book still showed every copy on the shelf after it had been borrowed.
  const bookOf = async () => (await call("/api/data/books/BK-0010", { token: librarian.token })).json.data;
  const start = (await bookOf()).availableCopies;
  await call("/api/data/loans", {
    method: "POST", token: librarian.token,
    body: { id: "LOAN-AVAIL-TEST", bookId: "BK-0010", studentId: "STU-0005",
            borrowedDate: "2026-09-01T09:00:00", dueDate: "2026-09-15T17:00:00", status: "Borrowed" }
  });
  check("borrowing reduces the available copies", (await bookOf()).availableCopies === start - 1,
    String((await bookOf()).availableCopies) + " (was " + start + ")");
  await call("/api/data/loans/LOAN-AVAIL-TEST", {
    method: "PATCH", token: librarian.token,
    body: { bookId: "BK-0010", status: "Returned", returnedDate: "2026-09-05T12:00:00" }
  });
  check("returning restores them", (await bookOf()).availableCopies === start);
  await call("/api/data/loans/LOAN-AVAIL-TEST", { method: "DELETE", token: librarian.token });
  check("deleting the loan leaves the count right", (await bookOf()).availableCopies === start);

  console.log("\n== Account lockout guards ==");
  // An administrator must not be able to sign away their own access, nor
  // remove the last account that can administer accounts. Neither was
  // prevented anywhere, and the result cannot be undone from inside the
  // application - the interactions suite locked itself out this way.
  const selfOff = await call("/api/data/users/" + admin.user.id, {
    method: "PATCH", token: admin.token, body: { status: "Inactive" }
  });
  check("admin cannot deactivate their own account", selfOff.status === 409, String(selfOff.status));
  check("the refusal explains why", selfOff.json && /signed in with/i.test(selfOff.json.message),
    selfOff.json && selfOff.json.message);

  const selfDelete = await call("/api/data/users/" + admin.user.id, { method: "DELETE", token: admin.token });
  check("admin cannot delete their own account", selfDelete.status === 409, String(selfDelete.status));
  check("the admin account still signs in afterwards", !!(await login("admin", "admin123")).token);

  const accounts = await call("/api/data/users", { token: admin.token });
  const sysadmin = accounts.json.data.find(u => u.username === "sysadmin");
  const deactivateOther = await call("/api/data/users/" + sysadmin.id, {
    method: "PATCH", token: admin.token, body: { status: "Inactive" }
  });
  check("another administrator may be deactivated while one remains",
    deactivateOther.status === 200, String(deactivateOther.status));
  const lastOne = await call("/api/data/users/" + admin.user.id, {
    method: "PATCH", token: admin.token, body: { status: "Inactive" }
  });
  check("the last administrator is protected", lastOne.status === 409, String(lastOne.status));
  await call("/api/data/users/" + sysadmin.id, { method: "PATCH", token: admin.token, body: { status: "Active" } });

  console.log("\n== Audit trail ==");
  const logs = await call("/api/data/auditLogs", { token: admin.token });
  check("writes are audited", logs.status === 200 && logs.json.data.length > 15, String(logs.json.data && logs.json.data.length));
  check("failed login recorded", logs.json.data.some(l => l.action === "LOGIN" && l.status === "Failed"));

  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
})();
