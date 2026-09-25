# USIAMS database

MySQL/MariaDB package for USIAMS. Every module in the application reads and
writes through this database - there is no remaining browser-side data store.

## Requirements

MySQL 8 or MariaDB 10.4+ (XAMPP's bundled MariaDB works). The `mysql`
command-line client is **not** required: the scripts below connect through the
`mysql2` driver the project already depends on.

## Setup

Copy `.env.example` to `.env` and set `DB_USER` / `DB_PASSWORD`, then:

```powershell
npm install
npm run db:setup
npm start
```

`db:setup` runs three steps, which can also be run individually:

| Script | File | What it does |
|---|---|---|
| `npm run db:schema` | `schema.sql` | Creates the `university` database and the base tables. **Drops existing tables.** |
| `npm run db:migrate` | `migration-full-app.sql` | Adds the tables and columns the finished application needs. Safe to re-run. |
| `npm run db:seed` | `seed-from-data.js` | Loads the full demo register into every table. **Replaces table contents.** |

### Why the seeder is JavaScript

The demo register is generated, not hand-written: `data/students.js` builds 60
students from name pools, and the timetable, results and finance ledger are
derived from them. `seed-from-data.js` runs those real files in a Node VM
(`load-seed-data.js`) and inserts the result, so the database and the
application agree exactly rather than drifting apart from a duplicated copy in
SQL.

It truncates the operational tables before loading, so it is repeatable - and
so it must not be pointed at a database holding real records.

### What gets loaded

60 students, 39 courses across 37 programmes and 31 departments, a 53-entry
timetable, 67 published results, 493 attendance sessions, 60 invoices with 103
payments, plus the service requests, complaints, announcements, notifications,
documents, library catalogue and loans, internships, graduation clearances,
alumni, QA flags, academic calendar, e-learning content and audit trail.

## Demo accounts

| Username | Password | Role |
|---|---|---|
| student | student123 | Student |
| admin | admin123 | University Admin |
| qa | qa123 | Quality Assurance Officer |
| lecturer | lecturer123 | Lecturer |
| finance | finance123 | Finance Officer |
| registration | registration123 | Registration Officer |
| sysadmin | sysadmin123 | System Admin |
| librarian | librarian123 | Librarian |
| hostel | hostel123 | Hostel Officer |

The seed loads 20 accounts in total, one per role in `data/users.js`. Passwords
are scrypt hashes using the salt in `config.js`. Never use these in production.

## Verifying

```powershell
node db/run-sql.js --help    # usage
curl http://127.0.0.1:3000/api/health
```

`/api/health` reports `database: connected` only when a query succeeds.

## How the application uses it

`db/resources.js` is the single registry describing every REST resource: its
table, the mapping between API field names and columns, which roles may read
and write it, and how a student is scoped to their own records.
`db/repository.js` turns that registry into queries, and `server.js` exposes it
as `/api/data/:resource`. Adding a resource means adding one registry entry.

`GET /api/bootstrap` returns every dataset the signed-in role may see in a
single request; the browser calls it once per page load through
`USIAMS.boot()`.

### Authorisation

The registry is the authorisation boundary, not the browser. Each request is
checked against the role on the server-side session:

- students are filtered to their own rows in SQL, so other students' records
  are never sent;
- a student may only create records against their own student id, and the
  owner of a record can never be reassigned by an update;
- the Quality Assurance Officer is refused every write with HTTP 403 before
  any resource rule is consulted, making the role read-only in fact and not
  only in the interface;
- the audit trail is append-only - the server writes it, the API cannot.

## Schema notes

`schema.sql` was written before the frontend modules were finished, so
`migration-full-app.sql` reconciles it with the model the application actually
uses. The substantive changes:

- new tables for `alumni`, `qa_flags`, `calendar_events`, `public_holidays` and
  the three `elearning_*` tables, none of which existed;
- `service_requests` and `complaints` take the application's status vocabulary
  (`PENDING`/`IN_PROGRESS`/...) plus priority, attachment and timeline;
- `graduation_clearance` holds the named six-item checklist rather than three
  fixed departmental statuses;
- `notifications.user_id` became nullable so a broadcast (`audience = 'ALL'`)
  can belong to everyone;
- `hostel_allocations.room_id` became nullable so accommodation can be
  requested before a room is assigned;
- `payments.payment_method` became a VARCHAR - the ledger names mobile-money
  providers ("Mobile Money (M-Pesa)"), which an ENUM could not hold.

Attendance is stored per session, as the schema always modelled it, while the
prototype held per-course summaries. The seeder expands each summary into
weekly dated sessions that add back to the same totals, and the
`student_attendance_summary` view returns the aggregate the pages render.

## Tests

```powershell
npm test
```

`tests/run.js` starts the server on a test port, reloads the demo data before
each suite so they cannot contaminate one another, and runs:

| Suite | What it covers |
|---|---|
| `api.test.js` | Authentication, student scoping, role boundaries, read-only enforcement, library availability, account lockout guards, the audit trail |
| `shapes.test.js` | That the API still returns every field the page modules read, including the derived and nested shapes |
| `frontend.test.js` | The browser data layer: hydration, and writes reaching MySQL through the storage bridge |
| `notifications.test.js` | Per-user inboxes, broadcast fan-out, and per-reader read state |
| `pages.test.js` | Every page rendered in a real DOM as every role it admits |
| `registration.test.js` | Public sign-up: the student record it creates, concurrent sign-ups, and every student page opening for an account with no history |
| `interactions.test.js` | Every control on every page pressed, failing on any error a handler throws |

The suites write to the configured database, so point `DB_NAME` at a
development copy. `jsdom` is the only development dependency.

### Derived values are never stored twice

A figure that can be computed is computed. `library_books.available_copies`
was a stored number that nothing updated, so a book still showed every copy
on the shelf after it had been lent out; availability is now counted from the
open loans. Invoice status, attendance percentages and a result's total mark
are derived the same way.

## Registering a student

`POST /api/auth/register` (the **Create Account** button on the login page)
creates three things in one transaction: the login, its `STUDENT` role, and
the **student record itself**.

The student record is the part that matters. Registration previously created
only the user, which left an account whose `studentId` was null - the student
pages had no record to show, and the account could read the entire register
instead of nothing, because scoping that found no student id applied no filter
at all. Scoping now fails closed, and a student account is never created
without the record behind it.

That record needs a programme, so the sign-up form asks for one: it sets the
department and the registration number. The number continues the institutional
run for that department and level (`T26-03-20004`), and concurrent sign-ups
step past each other rather than colliding.

A newly registered student has no results, invoice, timetable or attendance.
`registration.test.js` opens every student page as exactly that account,
because pages that assume a student always has history fail nowhere else.
