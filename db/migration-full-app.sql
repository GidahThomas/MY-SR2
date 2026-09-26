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

-- ---------------------------------------------------------
-- Self-registered staff accounts wait for an administrator's
-- approval before they can sign in.
-- ---------------------------------------------------------
ALTER TABLE users
  MODIFY COLUMN status ENUM('Active', 'Inactive', 'Suspended', 'Pending') NOT NULL DEFAULT 'Active';

-- ---------------------------------------------------------
-- Control-number payments (GePG style). A student chooses what
-- to pay for, is issued a control number for it straight away,
-- then pays through one of the listed payment methods.
-- Payment methods and fee items are reference data: edit these
-- rows to change what students are offered.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  channel ENUM('Mobile Money', 'Bank') NOT NULL,
  instructions VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB;

INSERT IGNORE INTO payment_methods (id, name, channel, instructions, sort_order) VALUES
  ('MPESA', 'M-Pesa', 'Mobile Money', 'Dial *150*00#, choose Pay by M-Pesa, then Government Payments (GePG), and enter the GePG control number and amount.', 1),
  ('TIGOPESA', 'Tigo Pesa', 'Mobile Money', 'Dial *150*01#, choose Pay Bills, then Government Payments (GePG), and enter the GePG control number and amount.', 2),
  ('AIRTELMONEY', 'Airtel Money', 'Mobile Money', 'Dial *150*60#, choose Make Payments, then Government Payments (GePG), and enter the GePG control number and amount.', 3),
  ('HALOPESA', 'HaloPesa', 'Mobile Money', 'Dial *150*88#, choose Payments, then Government Payments (GePG), and enter the GePG control number and amount.', 4),
  ('CRDB', 'CRDB Bank', 'Bank', 'Government payment (GePG): pay at any CRDB branch or CRDB Wakala agent, or in SimBanking choose Government Payments (GePG), quoting the GePG control number.', 5),
  ('NMB', 'NMB Bank', 'Bank', 'Government payment (GePG): pay at any NMB branch or NMB Wakala agent, or in NMB Mkononi choose Government Payments (GePG), quoting the GePG control number.', 6),
  ('NBC', 'NBC Bank', 'Bank', 'Government payment (GePG): pay at any NBC branch or agent, or in NBC Kiganjani choose Government Payments (GePG), quoting the GePG control number.', 7);

CREATE TABLE IF NOT EXISTS fee_items (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  -- TUITION is billed from the student's invoice (the outstanding balance);
  -- FIXED items cost the amount below.
  kind ENUM('TUITION', 'FIXED') NOT NULL DEFAULT 'FIXED',
  amount DECIMAL(14,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB;

INSERT IGNORE INTO fee_items (id, name, description, kind, amount, sort_order) VALUES
  ('TUITION', 'Tuition fee', 'Outstanding balance on your tuition invoice for this academic year.', 'TUITION', NULL, 1),
  ('REGISTRATION', 'Registration fee', 'Annual registration fee.', 'FIXED', 50000, 2),
  ('EXAMINATION', 'Examination fee', 'Examination fee for the academic year.', 'FIXED', 40000, 3),
  ('SUPPLEMENTARY', 'Supplementary examination', 'Fee per supplementary examination.', 'FIXED', 30000, 4),
  ('ACCOMMODATION', 'Accommodation fee', 'Hostel accommodation for one semester.', 'FIXED', 250000, 5),
  ('TRANSCRIPT', 'Academic transcript', 'One official academic transcript.', 'FIXED', 20000, 6),
  ('ID_CARD', 'Student ID card replacement', 'Replacement for a lost or damaged student ID card.', 'FIXED', 10000, 7),
  ('GRADUATION', 'Graduation fee', 'Gown, certificate and graduation ceremony.', 'FIXED', 60000, 8);

CREATE TABLE IF NOT EXISTS control_numbers (
  control_number VARCHAR(20) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  fee_item_id VARCHAR(40) NOT NULL,
  invoice_id VARCHAR(40) NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status ENUM('Pending', 'Paid', 'Expired', 'Cancelled') NOT NULL DEFAULT 'Pending',
  payment_method_id VARCHAR(40) NULL,
  payment_id VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  paid_at DATETIME NULL,
  INDEX idx_control_numbers_student (student_id, status),
  CONSTRAINT fk_control_numbers_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_control_numbers_item FOREIGN KEY (fee_item_id) REFERENCES fee_items(id),
  CONSTRAINT fk_control_numbers_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_control_numbers_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
) ENGINE=InnoDB;

-- Payments for anything other than tuition have no invoice; each payment
-- records the control number it settled.
ALTER TABLE payments
  MODIFY COLUMN invoice_id VARCHAR(40) NULL;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS control_number VARCHAR(20) NULL AFTER reference;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS fee_item_id VARCHAR(40) NULL AFTER control_number;

-- The mobile number or bank account the payment was made from.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payer_account VARCHAR(30) NULL AFTER payment_method;

-- Every university payment is a government payment through GePG, the
-- Government Electronic Payment Gateway. Keep existing installs' method
-- instructions in step with the rows above (INSERT IGNORE never updates).
UPDATE payment_methods SET instructions = 'Dial *150*00#, choose Pay by M-Pesa, then Government Payments (GePG), and enter the GePG control number and amount.' WHERE id = 'MPESA';
UPDATE payment_methods SET instructions = 'Dial *150*01#, choose Pay Bills, then Government Payments (GePG), and enter the GePG control number and amount.' WHERE id = 'TIGOPESA';
UPDATE payment_methods SET instructions = 'Dial *150*60#, choose Make Payments, then Government Payments (GePG), and enter the GePG control number and amount.' WHERE id = 'AIRTELMONEY';
UPDATE payment_methods SET instructions = 'Dial *150*88#, choose Payments, then Government Payments (GePG), and enter the GePG control number and amount.' WHERE id = 'HALOPESA';
UPDATE payment_methods SET instructions = 'Government payment (GePG): pay at any CRDB branch or CRDB Wakala agent, or in SimBanking choose Government Payments (GePG), quoting the GePG control number.' WHERE id = 'CRDB';
UPDATE payment_methods SET instructions = 'Government payment (GePG): pay at any NMB branch or NMB Wakala agent, or in NMB Mkononi choose Government Payments (GePG), quoting the GePG control number.' WHERE id = 'NMB';
UPDATE payment_methods SET instructions = 'Government payment (GePG): pay at any NBC branch or agent, or in NBC Kiganjani choose Government Payments (GePG), quoting the GePG control number.' WHERE id = 'NBC';

-- ---------------------------------------------------------
-- Everything a user sets is kept in the database, not the browser.
-- ---------------------------------------------------------
-- Per-user settings: notification preferences, theme, whether the
-- welcome tour has been seen. One JSON document per user.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR(40) PRIMARY KEY,
  preferences JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- University-wide settings from Administration > System Settings.
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_by VARCHAR(40) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
  ('maintenanceMode', 'false'), ('selfRegistration', 'false'), ('emailNotifications', 'true');

-- A student's acknowledgement of the By-Laws, and the documents named in
-- Complete My Profile.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS bylaws_acknowledged_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS documents_submitted TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_names JSON NULL;

-- ---------------------------------------------------------
-- Uploaded files are stored in the database itself: documents,
-- request/complaint attachments, assignment submissions and the
-- documents from Complete My Profile. Rows elsewhere point at a
-- file through its download URL, /api/files/<id>.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS stored_files (
  id VARCHAR(40) PRIMARY KEY,
  owner_user_id VARCHAR(40) NULL,
  student_id VARCHAR(40) NULL,
  purpose VARCHAR(40) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL,
  content LONGBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stored_files_owner (owner_user_id),
  INDEX idx_stored_files_student (student_id),
  CONSTRAINT fk_stored_files_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(255) NULL AFTER attachment;
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(255) NULL AFTER attachment;

-- File contents are kept in 512 KB chunks so uploads work under the
-- default max_allowed_packet (1 MB) without reconfiguring MySQL.
ALTER TABLE stored_files
  MODIFY COLUMN content LONGBLOB NULL;
CREATE TABLE IF NOT EXISTS stored_file_chunks (
  file_id VARCHAR(40) NOT NULL,
  chunk_index INT NOT NULL,
  data MEDIUMBLOB NOT NULL,
  PRIMARY KEY (file_id, chunk_index),
  CONSTRAINT fk_stored_file_chunks_file FOREIGN KEY (file_id) REFERENCES stored_files(id) ON DELETE CASCADE
) ENGINE=InnoDB;
