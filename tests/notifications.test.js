const BASE = process.env.BASE || "http://127.0.0.1:3311";
let pass = 0, fail = 0;
const check = (l, c, d = "") => { c ? (pass++, console.log("  PASS " + l)) : (fail++, console.log("  FAIL " + l + (d ? " -> " + d : ""))); };

const login = async (u, p) => (await (await fetch(BASE + "/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: u, password: p })
})).json());

const call = async (path, { method = "GET", token, body } = {}) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};

(async () => {
  const student = await login("student", "student123");     // USR-0001
  const lecturer = await login("lecturer", "lecturer123");  // USR-0002
  const admin = await login("admin", "admin123");
  const qa = await login("qa", "qa123");

  console.log("== Notifications are personal ==");
  const mine = await call("/api/data/notifications", { token: student.token });
  const theirs = await call("/api/data/notifications", { token: lecturer.token });
  check("student sees only their own", mine.json.data.length > 0 && mine.json.data.every(n => n.target === student.user.id),
    String(mine.json.data.length));
  check("staff also see only their own", theirs.json.data.every(n => n.target === lecturer.user.id),
    String(theirs.json.data.length) + " rows");
  check("the two inboxes are different", mine.json.data.length !== theirs.json.data.length ||
    mine.json.data[0].id !== theirs.json.data[0].id);

  const unread = mine.json.data.find(n => !n.read);
  check("student has an unread notification", !!unread);
  if (unread) {
    const marked = await call("/api/data/notifications/" + unread.id, { method: "PATCH", token: student.token, body: { read: true } });
    check("student marks their own read", marked.status === 200 && marked.json.data.read === true, JSON.stringify(marked.json).slice(0, 140));
  }

  // A notification belonging to the lecturer must be untouchable by the student.
  const foreign = theirs.json.data[0];
  if (foreign) {
    const attempt = await call("/api/data/notifications/" + foreign.id, { method: "PATCH", token: student.token, body: { read: true } });
    check("student cannot touch another user's notification", attempt.status === 403 || attempt.status === 404, String(attempt.status));
    const adminAttempt = await call("/api/data/notifications/" + foreign.id, { method: "PATCH", token: admin.token, body: { read: true } });
    check("even an admin cannot mark someone else's read", adminAttempt.status === 403 || adminAttempt.status === 404, String(adminAttempt.status));
  }

  console.log("\n== Broadcast fan-out ==");
  const activeUsers = (await call("/api/data/users", { token: admin.token })).json.data.filter(u => u.status === "Active").length;
  const studentBefore = (await call("/api/data/notifications", { token: student.token })).json.data.length;
  const lecturerBefore = (await call("/api/data/notifications", { token: lecturer.token })).json.data.length;

  const broadcast = await call("/api/data/notifications", {
    method: "POST", token: admin.token,
    body: { target: "ALL", category: "System", title: "Fan-out test", description: "Delivered per user.", read: false, date: new Date().toISOString().slice(0, 19) }
  });
  check("broadcast accepted", broadcast.status === 201 && Array.isArray(broadcast.json.data), JSON.stringify(broadcast.json).slice(0, 120));
  check("one row per active user", broadcast.json.data && broadcast.json.data.length === activeUsers,
    (broadcast.json.data && broadcast.json.data.length) + " vs " + activeUsers + " active");

  const studentAfter = (await call("/api/data/notifications", { token: student.token })).json.data;
  const lecturerAfter = (await call("/api/data/notifications", { token: lecturer.token })).json.data;
  check("student received exactly one copy", studentAfter.length === studentBefore + 1, studentBefore + " -> " + studentAfter.length);
  check("lecturer received exactly one copy", lecturerAfter.length === lecturerBefore + 1, lecturerBefore + " -> " + lecturerAfter.length);

  const studentCopy = studentAfter.find(n => n.title === "Fan-out test");
  const lecturerCopy = lecturerAfter.find(n => n.title === "Fan-out test");
  check("each copy is owned by its recipient",
    studentCopy.target === student.user.id && lecturerCopy.target === lecturer.user.id);
  check("the copies are distinct rows", studentCopy.id !== lecturerCopy.id);

  await call("/api/data/notifications/" + studentCopy.id, { method: "PATCH", token: student.token, body: { read: true } });
  const lecturerStill = (await call("/api/data/notifications", { token: lecturer.token })).json.data.find(n => n.id === lecturerCopy.id);
  check("one reader marking read leaves the other unread", lecturerStill && lecturerStill.read === false,
    String(lecturerStill && lecturerStill.read));

  console.log("\n== Read-only role ==");
  const qaInbox = await call("/api/data/notifications", { token: qa.token });
  check("qa can read their own inbox", qaInbox.status === 200);
  if (qaInbox.json.data.length) {
    const qaMark = await call("/api/data/notifications/" + qaInbox.json.data[0].id, { method: "PATCH", token: qa.token, body: { read: true } });
    check("qa still refused every write", qaMark.status === 403, String(qaMark.status));
  }

  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
})();
