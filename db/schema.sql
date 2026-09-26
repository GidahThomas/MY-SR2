-- USIAMS MySQL 8 database schema
-- Run with: mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS university
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE university;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS admission_applications;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS election_votes;
DROP TABLE IF EXISTS election_candidates;
DROP TABLE IF EXISTS election_positions;
DROP TABLE IF EXISTS elections;
DROP TABLE IF EXISTS service_requests;
DROP TABLE IF EXISTS document_submissions;
DROP TABLE IF EXISTS internship_records;
DROP TABLE IF EXISTS graduation_clearance;
DROP TABLE IF EXISTS library_loans;
DROP TABLE IF EXISTS library_books;
DROP TABLE IF EXISTS hostel_allocations;
DROP TABLE IF EXISTS hostel_rooms;
DROP TABLE IF EXISTS hostels;
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS result_records;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS registration_courses;
DROP TABLE IF EXISTS timetable_entries;
DROP TABLE IF EXISTS course_prerequisites;
DROP TABLE IF EXISTS course_programmes;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS semesters;
DROP TABLE IF EXISTS academic_years;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS programmes;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS organisational_units;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id VARCHAR(40) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  status ENUM('Active', 'Inactive', 'Suspended', 'Pending') NOT NULL DEFAULT 'Active',
  department_id VARCHAR(40) NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  user_id VARCHAR(40) NOT NULL,
  role_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE organisational_units (
  id VARCHAR(40) PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  unit_type ENUM('College', 'Institute', 'School', 'Centre') NOT NULL,
  parent_id VARCHAR(40) NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_units_parent FOREIGN KEY (parent_id) REFERENCES organisational_units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE departments (
  id VARCHAR(40) PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  unit_id VARCHAR(40) NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_departments_unit FOREIGN KEY (unit_id) REFERENCES organisational_units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE users
  ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

CREATE TABLE programmes (
  id VARCHAR(40) PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  level ENUM('Certificate', 'Diploma', 'Undergraduate', 'Postgraduate', 'PhD') NOT NULL,
  department_id VARCHAR(40) NOT NULL,
  duration_years DECIMAL(3,1) NOT NULL DEFAULT 3,
  credit_limit_per_semester INT NOT NULL DEFAULT 18,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_programmes_department FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

CREATE TABLE students (
  id VARCHAR(40) PRIMARY KEY,
  registration_number VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  gender ENUM('Male', 'Female', 'Other') NULL,
  date_of_birth DATE NULL,
  programme_id VARCHAR(40) NOT NULL,
  department_id VARCHAR(40) NOT NULL,
  study_year TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('Active', 'On Leave', 'Suspended', 'Graduated', 'Withdrawn') NOT NULL DEFAULT 'Active',
  email VARCHAR(180) NOT NULL UNIQUE,
  phone VARCHAR(40),
  address VARCHAR(255),
  emergency_contact_name VARCHAR(160),
  emergency_contact_relation VARCHAR(60),
  emergency_contact_phone VARCHAR(40),
  admission_date DATE NULL,
  entry_qualification VARCHAR(255),
  previous_school VARCHAR(180),
  photo_url VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_programme FOREIGN KEY (programme_id) REFERENCES programmes(id),
  CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_students_status (status),
  INDEX idx_students_department (department_id)
) ENGINE=InnoDB;

CREATE TABLE admission_applications (
  id VARCHAR(40) PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  gender ENUM('Male', 'Female', 'Other') NOT NULL,
  programme_id VARCHAR(40) NOT NULL,
  previous_school VARCHAR(180) NOT NULL,
  entry_qualification VARCHAR(100) NOT NULL,
  application_date DATE NOT NULL,
  status ENUM('Submitted', 'Under Review', 'Accepted', 'Rejected', 'Withdrawn') NOT NULL DEFAULT 'Submitted',
  notes TEXT,
  reviewed_by VARCHAR(40) NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_applications_programme FOREIGN KEY (programme_id) REFERENCES programmes(id),
  CONSTRAINT fk_applications_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_applications_status (status),
  INDEX idx_applications_email (email)
) ENGINE=InnoDB;

CREATE TABLE academic_years (
  id VARCHAR(40) PRIMARY KEY,
  label VARCHAR(30) NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status ENUM('Active', 'Closed', 'Planned') NOT NULL DEFAULT 'Planned'
) ENGINE=InnoDB;

CREATE TABLE semesters (
  id VARCHAR(40) PRIMARY KEY,
  academic_year_id VARCHAR(40) NOT NULL,
  semester_number TINYINT UNSIGNED NOT NULL,
  label VARCHAR(80) NOT NULL,
  registration_open BOOLEAN NOT NULL DEFAULT FALSE,
  starts_on DATE NULL,
  ends_on DATE NULL,
  UNIQUE KEY uq_semester_year_number (academic_year_id, semester_number),
  CONSTRAINT fk_semesters_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;

CREATE TABLE courses (
  id VARCHAR(40) PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  credits DECIMAL(4,1) NOT NULL,
  course_type ENUM('Core', 'Elective') NOT NULL DEFAULT 'Core',
  department_id VARCHAR(40) NOT NULL,
  study_year TINYINT UNSIGNED NOT NULL,
  semester_number TINYINT UNSIGNED NOT NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

CREATE TABLE course_programmes (
  course_id VARCHAR(40) NOT NULL,
  programme_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (course_id, programme_id),
  CONSTRAINT fk_course_programmes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_course_programmes_programme FOREIGN KEY (programme_id) REFERENCES programmes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE course_prerequisites (
  course_id VARCHAR(40) NOT NULL,
  prerequisite_course_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (course_id, prerequisite_course_id),
  CONSTRAINT fk_prereq_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_prereq_required FOREIGN KEY (prerequisite_course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE timetable_entries (
  id VARCHAR(40) PRIMARY KEY,
  course_id VARCHAR(40) NOT NULL,
  programme_id VARCHAR(40) NOT NULL,
  semester_id VARCHAR(40) NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(80) NOT NULL,
  lecturer_name VARCHAR(160),
  CONSTRAINT fk_timetable_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_timetable_programme FOREIGN KEY (programme_id) REFERENCES programmes(id),
  CONSTRAINT fk_timetable_semester FOREIGN KEY (semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB;

CREATE TABLE registrations (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  semester_id VARCHAR(40) NOT NULL,
  status ENUM('Draft', 'Registered', 'Approved', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Draft',
  total_credits DECIMAL(5,1) NOT NULL DEFAULT 0,
  registered_at DATETIME NULL,
  approved_by VARCHAR(40) NULL,
  approved_at DATETIME NULL,
  UNIQUE KEY uq_student_semester_registration (student_id, semester_id),
  CONSTRAINT fk_registrations_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_registrations_semester FOREIGN KEY (semester_id) REFERENCES semesters(id),
  CONSTRAINT fk_registrations_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE registration_courses (
  registration_id VARCHAR(40) NOT NULL,
  course_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (registration_id, course_id),
  CONSTRAINT fk_registration_courses_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_registration_courses_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE result_records (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  course_id VARCHAR(40) NOT NULL,
  semester_id VARCHAR(40) NOT NULL,
  continuous_assessment DECIMAL(5,2) NOT NULL DEFAULT 0,
  examination_mark DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_mark DECIMAL(5,2) AS (continuous_assessment + examination_mark) STORED,
  status ENUM('Draft', 'Submitted', 'Published', 'Withheld') NOT NULL DEFAULT 'Draft',
  published_at DATETIME NULL,
  published_by VARCHAR(40) NULL,
  UNIQUE KEY uq_student_course_semester_result (student_id, course_id, semester_id),
  CONSTRAINT fk_results_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_results_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_results_semester FOREIGN KEY (semester_id) REFERENCES semesters(id),
  CONSTRAINT fk_results_publisher FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE attendance_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  course_id VARCHAR(40) NOT NULL,
  semester_id VARCHAR(40) NOT NULL,
  attendance_date DATE NOT NULL,
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  marked_by VARCHAR(40) NULL,
  UNIQUE KEY uq_attendance (student_id, course_id, attendance_date),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_attendance_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_attendance_semester FOREIGN KEY (semester_id) REFERENCES semesters(id),
  CONSTRAINT fk_attendance_marker FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE invoices (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  academic_year_id VARCHAR(40) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount_billed DECIMAL(14,2) NOT NULL,
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('Open', 'Partially Paid', 'Paid', 'Cancelled') NOT NULL DEFAULT 'Open',
  CONSTRAINT fk_invoices_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_invoices_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;

CREATE TABLE payments (
  id VARCHAR(40) PRIMARY KEY,
  invoice_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  payment_date DATETIME NOT NULL,
  payment_method ENUM('Bank Transfer', 'Mobile Money', 'Direct Bank Deposit', 'Cash', 'Card') NOT NULL,
  reference VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('Pending', 'Completed', 'Failed', 'Reversed') NOT NULL DEFAULT 'Pending',
  received_by VARCHAR(40) NULL,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_payments_receiver FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE service_requests (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NULL,
  submitted_by VARCHAR(40) NOT NULL,
  request_type VARCHAR(100) NOT NULL,
  subject VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  assigned_to VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_requests_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  CONSTRAINT fk_requests_submitter FOREIGN KEY (submitted_by) REFERENCES users(id),
  CONSTRAINT fk_requests_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE complaints (
  id VARCHAR(40) PRIMARY KEY,
  submitted_by VARCHAR(40) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subject VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'REJECTED') NOT NULL DEFAULT 'OPEN',
  assigned_to VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaints_submitter FOREIGN KEY (submitted_by) REFERENCES users(id),
  CONSTRAINT fk_complaints_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE elections (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status ENUM('Draft', 'Open', 'Closed', 'Published') NOT NULL DEFAULT 'Draft',
  created_by VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_elections_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE election_positions (
  id VARCHAR(40) PRIMARY KEY,
  election_id VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_election_position (election_id, name),
  CONSTRAINT fk_positions_election FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE election_candidates (
  id VARCHAR(40) PRIMARY KEY,
  position_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  manifesto TEXT,
  status ENUM('Pending', 'Approved', 'Rejected', 'Withdrawn') NOT NULL DEFAULT 'Pending',
  UNIQUE KEY uq_position_candidate (position_id, student_id),
  CONSTRAINT fk_candidates_position FOREIGN KEY (position_id) REFERENCES election_positions(id) ON DELETE CASCADE,
  CONSTRAINT fk_candidates_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE election_votes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  election_id VARCHAR(40) NOT NULL,
  position_id VARCHAR(40) NOT NULL,
  candidate_id VARCHAR(40) NOT NULL,
  voter_student_id VARCHAR(40) NOT NULL,
  voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_one_vote_per_position (election_id, position_id, voter_student_id),
  CONSTRAINT fk_votes_election FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
  CONSTRAINT fk_votes_position FOREIGN KEY (position_id) REFERENCES election_positions(id) ON DELETE CASCADE,
  CONSTRAINT fk_votes_candidate FOREIGN KEY (candidate_id) REFERENCES election_candidates(id),
  CONSTRAINT fk_votes_voter FOREIGN KEY (voter_student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE announcements (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  body TEXT NOT NULL,
  audience_role VARCHAR(40) NULL,
  published_by VARCHAR(40) NOT NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
  CONSTRAINT fk_announcements_publisher FOREIGN KEY (published_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL,
  category VARCHAR(60) NOT NULL,
  title VARCHAR(220) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE document_submissions (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  status ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
  reviewed_by VARCHAR(40) NULL,
  reviewed_at DATETIME NULL,
  CONSTRAINT fk_documents_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_documents_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE hostels (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  location VARCHAR(255),
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB;

CREATE TABLE hostel_rooms (
  id VARCHAR(40) PRIMARY KEY,
  hostel_id VARCHAR(40) NOT NULL,
  room_number VARCHAR(30) NOT NULL,
  capacity TINYINT UNSIGNED NOT NULL,
  status ENUM('Available', 'Full', 'Maintenance') NOT NULL DEFAULT 'Available',
  UNIQUE KEY uq_hostel_room (hostel_id, room_number),
  CONSTRAINT fk_rooms_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE hostel_allocations (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  room_id VARCHAR(40) NOT NULL,
  academic_year_id VARCHAR(40) NOT NULL,
  status ENUM('Requested', 'Allocated', 'Rejected', 'Checked Out') NOT NULL DEFAULT 'Requested',
  allocated_at DATETIME NULL,
  CONSTRAINT fk_allocations_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_allocations_room FOREIGN KEY (room_id) REFERENCES hostel_rooms(id),
  CONSTRAINT fk_allocations_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;

CREATE TABLE library_books (
  id VARCHAR(40) PRIMARY KEY,
  isbn VARCHAR(30) UNIQUE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(180) NOT NULL,
  category VARCHAR(100),
  total_copies INT UNSIGNED NOT NULL DEFAULT 1,
  available_copies INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('Available', 'Archived') NOT NULL DEFAULT 'Available'
) ENGINE=InnoDB;

CREATE TABLE library_loans (
  id VARCHAR(40) PRIMARY KEY,
  book_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NULL,
  user_id VARCHAR(40) NULL,
  borrowed_at DATETIME NOT NULL,
  due_at DATETIME NOT NULL,
  returned_at DATETIME NULL,
  status ENUM('Borrowed', 'Returned', 'Overdue', 'Lost') NOT NULL DEFAULT 'Borrowed',
  CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES library_books(id),
  CONSTRAINT fk_loans_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE internship_records (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  organisation_name VARCHAR(180) NOT NULL,
  supervisor_name VARCHAR(160),
  start_date DATE,
  end_date DATE,
  status ENUM('Planned', 'Ongoing', 'Completed', 'Rejected') NOT NULL DEFAULT 'Planned',
  report_url VARCHAR(500),
  CONSTRAINT fk_internship_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE graduation_clearance (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  academic_year_id VARCHAR(40) NOT NULL,
  finance_status ENUM('Pending', 'Cleared', 'Blocked') NOT NULL DEFAULT 'Pending',
  library_status ENUM('Pending', 'Cleared', 'Blocked') NOT NULL DEFAULT 'Pending',
  academic_status ENUM('Pending', 'Cleared', 'Blocked') NOT NULL DEFAULT 'Pending',
  overall_status ENUM('Pending', 'Cleared', 'Rejected') NOT NULL DEFAULT 'Pending',
  UNIQUE KEY uq_graduation_student_year (student_id, academic_year_id),
  CONSTRAINT fk_graduation_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_graduation_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(40) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(40),
  ip_address VARCHAR(45),
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW student_fee_balances AS
SELECT
  i.student_id,
  i.id AS invoice_id,
  i.amount_billed,
  COALESCE(SUM(CASE WHEN p.status = 'Completed' THEN p.amount ELSE 0 END), 0) AS amount_paid,
  i.amount_billed - COALESCE(SUM(CASE WHEN p.status = 'Completed' THEN p.amount ELSE 0 END), 0) AS balance
FROM invoices i
LEFT JOIN payments p ON p.invoice_id = i.id
GROUP BY i.id, i.student_id, i.amount_billed;

CREATE OR REPLACE VIEW student_gpa_results AS
SELECT
  r.student_id,
  r.semester_id,
  SUM(r.total_mark * c.credits) / NULLIF(SUM(c.credits), 0) AS weighted_mark,
  SUM(c.credits) AS total_credits
FROM result_records r
JOIN courses c ON c.id = r.course_id
WHERE r.status = 'Published'
GROUP BY r.student_id, r.semester_id;
