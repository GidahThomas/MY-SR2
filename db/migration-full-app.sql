-- =========================================================
-- USIAMS - db/migration-full-app.sql
--
-- Closes the gaps between db/schema.sql (written before the
-- frontend modules were finished) and the data model the
-- application actually uses. Safe to re-run: every statement
-- uses IF NOT EXISTS / CREATE OR REPLACE.
--
-- Run with:
--   mysql -u root -p university < db/migration-full-app.sql
-- or via: npm run db:migrate
-- =========================================================
USE university;

-- ---------------------------------------------------------
-- Academic structure: fields the prototype carries that the
-- original schema did not model.
-- ---------------------------------------------------------
ALTER TABLE organisational_units
  ADD COLUMN IF NOT EXISTS established_year SMALLINT NULL AFTER unit_type;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS head_of_department VARCHAR(160) NULL AFTER unit_id;

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS credit_min_per_semester INT NOT NULL DEFAULT 9 AFTER credit_limit_per_semester;

-- Semesters carry a lifecycle status and a registration deadline in the UI.
ALTER TABLE semesters
  ADD COLUMN IF NOT EXISTS status ENUM('Active', 'Closed', 'Upcoming') NOT NULL DEFAULT 'Upcoming' AFTER label,
  ADD COLUMN IF NOT EXISTS registration_deadline DATE NULL AFTER registration_open;

-- The timetable grid is rendered per study year.
ALTER TABLE timetable_entries
  ADD COLUMN IF NOT EXISTS study_year TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER programme_id;

-- ---------------------------------------------------------
-- Attendance: records are per session; the lecturer who owns
-- the session is shown on the student attendance page.
-- ---------------------------------------------------------
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS lecturer_name VARCHAR(160) NULL AFTER attended;

-- ---------------------------------------------------------
-- Finance: the prototype records mobile-money providers by
-- name ("Mobile Money (M-Pesa)"), which an ENUM cannot hold.
-- ---------------------------------------------------------
ALTER TABLE payments
  MODIFY COLUMN payment_method VARCHAR(60) NOT NULL;

-- ---------------------------------------------------------
-- Service requests and complaints: the app's status vocabulary
-- differs from the original schema, and both carry a priority,
-- an attachment and an audit timeline.
-- ---------------------------------------------------------
ALTER TABLE service_requests
  MODIFY COLUMN status ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ESCALATED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
  MODIFY COLUMN submitted_by VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM' AFTER status,
  ADD COLUMN IF NOT EXISTS attachment VARCHAR(255) NULL AFTER priority,
  ADD COLUMN IF NOT EXISTS timeline LONGTEXT NULL AFTER attachment;

ALTER TABLE complaints
  MODIFY COLUMN status ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ESCALATED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
  MODIFY COLUMN submitted_by VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS student_id VARCHAR(40) NULL AFTER submitted_by,
  ADD COLUMN IF NOT EXISTS priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM' AFTER status,
  ADD COLUMN IF NOT EXISTS attachment VARCHAR(255) NULL AFTER priority,
  ADD COLUMN IF NOT EXISTS assigned_office VARCHAR(120) NULL AFTER attachment,
  ADD COLUMN IF NOT EXISTS timeline LONGTEXT NULL AFTER assigned_office;

-- ---------------------------------------------------------
-- Announcements carry a display tone; notifications may be
-- broadcast to every user rather than addressed to one.
-- ---------------------------------------------------------
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS tone ENUM('info', 'success', 'warning', 'gold') NOT NULL DEFAULT 'info' AFTER audience_role;

ALTER TABLE notifications
  MODIFY COLUMN user_id VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS audience VARCHAR(40) NULL AFTER user_id;

-- ---------------------------------------------------------
-- Documents: the prototype tracks the upload date and does not
-- store a file payload, so file_url must be optional.
-- ---------------------------------------------------------
ALTER TABLE document_submissions
  MODIFY COLUMN file_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS uploaded_at DATE NULL AFTER file_url;

-- ---------------------------------------------------------
-- Hostels: a student may request accommodation before a room
-- has been assigned, so room_id must be nullable.
-- ---------------------------------------------------------
ALTER TABLE hostel_allocations
  MODIFY COLUMN room_id VARCHAR(40) NULL,
  MODIFY COLUMN status ENUM('Requested', 'Allocated', 'Rejected', 'Vacated', 'Checked Out') NOT NULL DEFAULT 'Requested',
  ADD COLUMN IF NOT EXISTS requested_date DATE NULL AFTER status;

-- ---------------------------------------------------------
-- Internships carry a placement location, a logbook counter and
-- a three-part assessment.
-- ---------------------------------------------------------
ALTER TABLE internship_records
  MODIFY COLUMN status ENUM('Pending', 'Approved', 'In Progress', 'Completed', 'Rejected') NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS location VARCHAR(160) NULL AFTER organisation_name,
  ADD COLUMN IF NOT EXISTS logbook_entries INT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN IF NOT EXISTS supervisor_score DECIMAL(5,2) NULL AFTER logbook_entries,
  ADD COLUMN IF NOT EXISTS academic_score DECIMAL(5,2) NULL AFTER supervisor_score,
  ADD COLUMN IF NOT EXISTS final_grade VARCHAR(5) NULL AFTER academic_score;

-- ---------------------------------------------------------
-- Graduation clearance is driven by a named checklist rather
-- than three fixed departmental statuses.
-- ---------------------------------------------------------
ALTER TABLE graduation_clearance
  ADD COLUMN IF NOT EXISTS checklist LONGTEXT NULL AFTER academic_status,
  ADD COLUMN IF NOT EXISTS application_submitted BOOLEAN NOT NULL DEFAULT FALSE AFTER checklist;

-- ---------------------------------------------------------
-- Audit logs record the acting account's name and role as text
-- so the trail survives the account being deleted.
-- ---------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_name VARCHAR(160) NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(60) NULL AFTER user_name,
  ADD COLUMN IF NOT EXISTS entity_label VARCHAR(180) NULL AFTER entity_id,
  ADD COLUMN IF NOT EXISTS status ENUM('Success', 'Failed') NOT NULL DEFAULT 'Success' AFTER entity_label;

-- =========================================================
-- Tables the original schema did not include at all.
-- =========================================================

CREATE TABLE IF NOT EXISTS alumni (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NULL,
  full_name VARCHAR(160) NOT NULL,
  registration_number VARCHAR(50) NOT NULL,
  programme_id VARCHAR(40) NOT NULL,
  graduation_year SMALLINT NOT NULL,
  employment_status ENUM('Employed', 'Self-Employed', 'Further Studies', 'Seeking Employment') NOT NULL,
  organisation VARCHAR(180) NULL,
  contact VARCHAR(180) NULL,
  CONSTRAINT fk_alumni_programme FOREIGN KEY (programme_id) REFERENCES programmes(id),
  CONSTRAINT fk_alumni_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  INDEX idx_alumni_year (graduation_year)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qa_flags (
  id VARCHAR(40) PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  severity ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  entity_id VARCHAR(40) NULL,
  entity_label VARCHAR(180) NULL,
  description TEXT NOT NULL,
  raised_on DATE NOT NULL,
  status ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  raised_by VARCHAR(40) NULL,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_qa_flags_user FOREIGN KEY (raised_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_qa_flags_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  description TEXT NULL,
  event_date DATE NOT NULL,
  end_date DATE NULL,
  academic_year_id VARCHAR(40) NULL,
  CONSTRAINT fk_calendar_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
  INDEX idx_calendar_date (event_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS public_holidays (
  id VARCHAR(40) PRIMARY KEY,
  holiday_date DATE NOT NULL,
  title VARCHAR(180) NOT NULL,
  INDEX idx_holiday_date (holiday_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS elearning_materials (
  id VARCHAR(40) PRIMARY KEY,
  course_id VARCHAR(40) NOT NULL,
  title VARCHAR(220) NOT NULL,
  material_type ENUM('Lecture Notes', 'Slides', 'Reading', 'Video Link') NOT NULL,
  file_url VARCHAR(500) NULL,
  uploaded_at DATE NOT NULL,
  uploaded_by VARCHAR(40) NULL,
  CONSTRAINT fk_materials_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_materials_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS elearning_assignments (
  id VARCHAR(40) PRIMARY KEY,
  course_id VARCHAR(40) NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NULL,
  due_date DATE NOT NULL,
  max_score INT NOT NULL DEFAULT 100,
  created_by VARCHAR(40) NULL,
  CONSTRAINT fk_assignments_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS elearning_submissions (
  id VARCHAR(40) PRIMARY KEY,
  assignment_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  submitted_at DATE NOT NULL,
  note TEXT NULL,
  file_url VARCHAR(500) NULL,
  score DECIMAL(5,2) NULL,
  status ENUM('Submitted', 'Graded') NOT NULL DEFAULT 'Submitted',
  graded_by VARCHAR(40) NULL,
  UNIQUE KEY uq_assignment_student (assignment_id, student_id),
  CONSTRAINT fk_submissions_assignment FOREIGN KEY (assignment_id) REFERENCES elearning_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_submissions_grader FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Derived reporting views used by the dashboards.
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW student_attendance_summary AS
SELECT
  CONCAT(a.student_id, '-', a.course_id, '-', a.semester_id) AS id,
  a.student_id,
  a.course_id,
  a.semester_id,
  MAX(a.lecturer_name) AS lecturer_name,
  COUNT(*) AS total_classes,
  SUM(a.attended) AS attended,
  COUNT(*) - SUM(a.attended) AS missed,
  ROUND(100 * SUM(a.attended) / NULLIF(COUNT(*), 0)) AS percentage
FROM attendance_records a
GROUP BY a.student_id, a.course_id, a.semester_id;

-- ---------------------------------------------------------
-- A college, institute or school administrator belongs to an
-- organisational unit rather than to a single department.
-- ---------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unit_id VARCHAR(40) NULL AFTER department_id;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_unit'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_unit FOREIGN KEY (unit_id) REFERENCES organisational_units(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
