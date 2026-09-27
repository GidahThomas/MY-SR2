const { check, finish, call, login } = require("./helpers");

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
  check("admin sees 1625 courses", ad.courses.length === 1625, String(ad.courses && ad.courses.length));
  check("admin sees 350 results", ad.results.length === 350, String(ad.results && ad.results.length));
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
  check("student sees shared course catalogue", sd.courses.length === 1625);
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

  // Change the course list while keeping the load within six to seven:
  // drop one course from a seven-course registration, or add one from the
  // same class group to a six-course one.
  const reg1 = ad.seedRegistrations.find(r => r.id === "REG-0001");
  const reg1Student = ad.students.find(s => s.id === reg1.studentId);
  const spare = ad.courses.find(c => c.programmeIds.includes(reg1Student.programmeId) && c.year === reg1Student.year &&
    c.semesterNumber === 1 && !reg1.courseIds.includes(c.id));
  const swapped = reg1.courseIds.length === 7 || !spare ? reg1.courseIds.slice(1) : [...reg1.courseIds, spare.id];
  const regPatch = await call("/api/data/registrations/REG-0001", {
    method: "PATCH", token: admin.token, body: { courseIds: swapped }
  });
  check("join collections update", regPatch.status === 200 &&
    [...regPatch.json.data.courseIds].sort().join() === [...swapped].sort().join(),
    JSON.stringify(regPatch.json).slice(0, 160));
  await call("/api/data/registrations/REG-0001", {
    method: "PATCH", token: admin.token, body: { courseIds: reg1.courseIds }
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

  console.log("\n== Six or seven courses per student ==");
  const allRegs = (await call("/api/data/registrations", { token: admin.token })).json.data;
  const activeStudents = (await call("/api/data/students", { token: admin.token })).json.data.filter(s => s.status === "Active");
  check("every active student is registered",
    activeStudents.every(s => allRegs.some(r => r.studentId === s.id)), `${allRegs.length} registrations, ${activeStudents.length} active`);
  check("every registration has 6 or 7 courses",
    allRegs.every(r => r.courseIds.length >= 6 && r.courseIds.length <= 7),
    JSON.stringify(allRegs.filter(r => r.courseIds.length < 6 || r.courseIds.length > 7).map(r => [r.id, r.courseIds.length])));
  const myReg = allRegs.find(r => r.studentId === "STU-0001");
  const tooFew = await call("/api/data/registrations/" + myReg.id, {
    method: "PATCH", token: admin.token, body: { courseIds: myReg.courseIds.slice(0, 5) }
  });
  check("a registration with 5 courses is refused", tooFew.status === 422, String(tooFew.status));
  const tooMany = await call("/api/data/registrations", {
    method: "POST", token: student.token,
    body: { studentId: "STU-0001", semesterId: myReg.semesterId, status: "Registered", courseIds: [...myReg.courseIds, "CP101", "TN103"] }
  });
  check("a registration with 8 or more courses is refused", tooMany.status === 422, String(tooMany.status));
  const draft = await call("/api/data/registrations/" + myReg.id, {
    method: "PATCH", token: admin.token, body: { status: "Draft", courseIds: myReg.courseIds.slice(0, 2) }
  });
  check("a draft registration may hold fewer while being amended", draft.status === 200, String(draft.status));
  await call("/api/data/registrations/" + myReg.id, {
    method: "PATCH", token: admin.token, body: { status: myReg.status, courseIds: myReg.courseIds }
  });

  console.log("\n== Daily class checklist ==");
  const entries = (await call("/api/data/timetable", { token: student.token })).json.data;
  const myEntry = entries.find(e => myReg.courseIds.includes(e.courseId) && e.programmeId === sd.students[0].programmeId);
  const forOther = await call("/api/data/classCheckins", {
    method: "POST", token: student.token,
    body: { studentId: "STU-0002", entryId: myEntry.id, courseId: myEntry.courseId, date: "2026-09-21", status: "Attended" }
  });
  check("a student cannot mark classes for someone else", forOther.status === 403, String(forOther.status));
  const tick = await call("/api/data/classCheckins", {
    method: "POST", token: student.token,
    body: { studentId: "STU-0001", entryId: myEntry.id, courseId: myEntry.courseId, date: "2026-09-21", status: "Attended" }
  });
  check("a student can mark a class", tick.status === 201, JSON.stringify(tick.json));
  check("the mark is filed under the student's own record", tick.json.data && tick.json.data.studentId === "STU-0001");
  const change = await call("/api/data/classCheckins/" + tick.json.data.id, { method: "PATCH", token: student.token, body: { status: "Missed" } });
  check("a student can change their mark", change.status === 200 && change.json.data.status === "Missed");
  const otherReads = (await call("/api/data/classCheckins", { token: (await login("lecturer", "lecturer123")).token })).json.data;
  check("staff can see class marks", otherReads.some(c => c.id === tick.json.data.id));
  await call("/api/data/classCheckins/" + tick.json.data.id, { method: "DELETE", token: student.token });

  console.log("\n== Password reset ==");
  const oldStyle = await call("/api/auth/reset-password", {
    method: "POST", body: { username: "student", email: student.user.email, password: "takeover123" }
  });
  check("username + email alone cannot reset a password", oldStyle.status === 422, String(oldStyle.status));
  const unknown = await call("/api/auth/forgot-password", { method: "POST", body: { identifier: "no-such-user" } });
  const known = await call("/api/auth/forgot-password", { method: "POST", body: { identifier: "student" } });
  check("forgot-password does not reveal whether an account exists",
    unknown.status === 200 && known.status === 200 && unknown.json.message === known.json.message);

  // The emailed token is only stored hashed, so plant a known one.
  const crypto = require("node:crypto");
  const repo = require("../db/repository");
  const resetToken = crypto.randomBytes(32).toString("hex");
  await repo.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 10 MINUTE)",
    [crypto.createHash("sha256").update(resetToken).digest("hex"), student.user.id]);
  const reset = await call("/api/auth/reset-password", { method: "POST", body: { token: resetToken, password: "student-new-1" } });
  check("a valid reset token sets the password", reset.status === 200, JSON.stringify(reset.json));
  const reused = await call("/api/auth/reset-password", { method: "POST", body: { token: resetToken, password: "student-new-2" } });
  check("a reset token works only once", reused.status === 410, String(reused.status));
  check("resetting signs out existing sessions", (await call("/api/auth/me", { token: student.token })).status === 401);
  check("the new password signs in", !!(await login("student", "student-new-1")).token);
  const expired = crypto.randomBytes(32).toString("hex");
  await repo.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, NOW() - INTERVAL 1 MINUTE)",
    [crypto.createHash("sha256").update(expired).digest("hex"), student.user.id]);
  check("an expired reset token is refused",
    (await call("/api/auth/reset-password", { method: "POST", body: { token: expired, password: "student-new-3" } })).status === 410);
  const [stored] = await repo.query("SELECT password_hash AS h FROM users WHERE id = ?", [student.user.id]);
  check("passwords are stored with their own salt", /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(stored.h));
  const [sessionRow] = await repo.query("SELECT COUNT(*) AS n FROM user_sessions WHERE token_hash = ?", [admin.token]);
  check("session tokens are not stored in plain text", sessionRow.n === 0);
  await repo.pool.end();

  finish();
})();
