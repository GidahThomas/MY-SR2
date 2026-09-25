-- USIAMS demo seed data
-- Run after schema.sql with: mysql -u root -p university < db/seed.sql
USE university;

INSERT INTO roles (id, name, description) VALUES
('STUDENT', 'Student', 'Student self-service access'),
('LECTURER', 'Lecturer', 'Teaching and academic assessment access'),
('UNIVERSITY_ADMIN', 'University Admin', 'University-wide administration access'),
('QUALITY_ASSURANCE_OFFICER', 'Quality Assurance Officer', 'Read-only quality assurance access'),
('FINANCE_OFFICER', 'Finance Officer', 'Fees and payment management access'),
('REGISTRATION_OFFICER', 'Registration Officer', 'Admissions and registration management access'),
('SYSTEM_ADMIN', 'System Admin', 'System configuration and administration access'),
('LIBRARIAN', 'Librarian', 'Library management access'),
('HOSTEL_OFFICER', 'Hostel Officer', 'Hostel and accommodation management access')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO organisational_units (id, code, name, unit_type) VALUES
('CIVE', 'CIVE', 'College of Informatics and Virtual Education', 'College'),
('CI', 'CI', 'College of Informatics', 'Institute'),
('SOL', 'SOL', 'School of Law', 'School')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO departments (id, code, name, unit_id) VALUES
('DCSE', 'DCSE', 'Department of Computer Science and Engineering', 'CIVE'),
('DIS', 'DIS', 'Department of Information Systems', 'CIVE'),
('DACC', 'DACC', 'Department of Accounting', 'CIVE'),
('DLAW', 'DLAW', 'Department of Law', 'SOL'),
('DMS', 'DMS', 'Department of Mathematics and Statistics', 'CIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name), unit_id = VALUES(unit_id);

INSERT INTO users (id, username, password_hash, full_name, email, status) VALUES
('USR-STUDENT', 'student', '3c03a4f97faed1fd130d32b401c3fbb9c14b2f40e8b705237ac8fe4831ca815a0dca23d2af262fcdd86aa803ab6222b69ac9fbf51679acdfdf93d178d64aca32', 'Baraka Komba', 'baraka.komba0001@students.usiams.ac.tz', 'Active'),
('USR-ADMIN', 'admin', 'bd1d52e1fb4de5cc93699defd6bda9dc52122972558576cb5bd62194a490245b60bc42634c8216b1aa298defb3c374eeeafd809ee14896be662315d40c13e6a2', 'Prof. Deogratius Kimaro', 'admin@usiams.ac.tz', 'Active'),
('USR-QA', 'qa', 'e71a734ff244639b08b76e47fb2a3fe7dacc24e06f9887d27b30c06cf983f1a7cee43e1160514a2f058e2f1353790eb83e88c8213817e2b40d7281b8b1cfd00e', 'Consolata Lyimo', 'qa@usiams.ac.tz', 'Active'),
('USR-LECTURER', 'lecturer', 'f5faa1f53d39f1c6c24e194955a3eff7c84b04503c16f93fab44141845570ac2053fc3e4c44574454da3ed947df6f8d76f57a80aab6676daf29b5289fdd130fc', 'Dr. Amani Mrema', 'amani.mrema@usiams.ac.tz', 'Active'),
('USR-FINANCE', 'finance', '27cccbf6af130da95436c9fcf887863498af50d273a544d5cd13901de917e7046866003dc313adb8c8a700473207d3aba842bc03637c55a9f216121fb81296ae', 'Yohana Ndumbaro', 'finance@usiams.ac.tz', 'Active'),
('USR-REGISTRATION', 'registration', '1832476b1f454f74ccbcb4161a98a91059341447b9613374931da777dad82a809dd42ef4292330227eae90854e7a8c0d70754b9fc27e1bfc385cea29458b24cd', 'Victoria Mgaya', 'registration@usiams.ac.tz', 'Active'),
('USR-SYSADMIN', 'sysadmin', '227868bb35a31e43278c0dd969897fdde6283b732dbda26384af627db7a18fdcb47d092919cd7dbd2285cb276aa9a29363dc2f1edb989c8c221b196abfbc14d4', 'Upendo Mallya', 'sysadmin@usiams.ac.tz', 'Active'),
('USR-LIBRARIAN', 'librarian', '7e670924047b0998866554efafea9599f0c5f58a2f9984685009cc00798a709a2da6420247b6341405ac24429dfd35b5a4a42ec334fe868ab5fd54fabc7545d9', 'Beatrice Mollel', 'librarian@usiams.ac.tz', 'Active'),
('USR-HOSTEL', 'hostel', 'e797de778de9cef927f3a316e093550b193ff651a69fa1c29a42b5e24dbb760376e20b6b4512142ed1020007451e78254dd054613840168d71ded64beea258ed', 'Raymond Kessy', 'hostel@usiams.ac.tz', 'Active')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), status = VALUES(status);

INSERT INTO user_roles (user_id, role_id) VALUES
('USR-STUDENT', 'STUDENT'),
('USR-ADMIN', 'UNIVERSITY_ADMIN'),
('USR-QA', 'QUALITY_ASSURANCE_OFFICER'),
('USR-LECTURER', 'LECTURER'),
('USR-FINANCE', 'FINANCE_OFFICER'),
('USR-REGISTRATION', 'REGISTRATION_OFFICER'),
('USR-SYSADMIN', 'SYSTEM_ADMIN'),
('USR-LIBRARIAN', 'LIBRARIAN'),
('USR-HOSTEL', 'HOSTEL_OFFICER')
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

INSERT INTO programmes (id, code, name, level, department_id, duration_years, credit_limit_per_semester) VALUES
('BSCS', 'BSCS', 'Bachelor of Science in Computer Science', 'Undergraduate', 'DCSE', 3, 18),
('BSSE', 'BSSE', 'Bachelor of Science in Software Engineering', 'Undergraduate', 'DCSE', 3, 18),
('BSCDS', 'BSCDS', 'Bachelor of Science in Computer and Data Science', 'Undergraduate', 'DCSE', 3, 18),
('BSCIS', 'BSCIS', 'Bachelor of Science in Information Systems', 'Undergraduate', 'DIS', 3, 18),
('BCOMACC', 'BCOMACC', 'Bachelor of Commerce in Accounting', 'Undergraduate', 'DACC', 3, 18),
('LLB', 'LLB', 'Bachelor of Laws', 'Undergraduate', 'DLAW', 4, 18)
ON DUPLICATE KEY UPDATE name = VALUES(name), department_id = VALUES(department_id);

INSERT INTO academic_years (id, label, starts_on, ends_on, status) VALUES
('AY2025', '2025/2026', '2025-08-01', '2026-07-31', 'Active'),
('AY2024', '2024/2025', '2024-08-01', '2025-07-31', 'Closed')
ON DUPLICATE KEY UPDATE label = VALUES(label), status = VALUES(status);

INSERT INTO semesters (id, academic_year_id, semester_number, label, registration_open, starts_on, ends_on) VALUES
('AY2025-S1', 'AY2025', 1, 'Semester 1', TRUE, '2025-08-01', '2025-12-31'),
('AY2025-S2', 'AY2025', 2, 'Semester 2', FALSE, '2026-01-01', '2026-07-31'),
('AY2024-S1', 'AY2024', 1, 'Semester 1', FALSE, '2024-08-01', '2024-12-31'),
('AY2024-S2', 'AY2024', 2, 'Semester 2', FALSE, '2025-01-01', '2025-07-31')
ON DUPLICATE KEY UPDATE registration_open = VALUES(registration_open);

INSERT INTO courses (id, code, title, credits, course_type, department_id, study_year, semester_number) VALUES
('CP101', 'CP101', 'Introduction to Programming', 3, 'Core', 'DCSE', 1, 1),
('TN103', 'TN103', 'Discrete Mathematics', 3, 'Core', 'DCSE', 1, 1),
('CP103', 'CP103', 'Computer Organization and Architecture', 3, 'Core', 'DCSE', 1, 1),
('GS101', 'GS101', 'Communication Skills', 2, 'Core', 'DCSE', 1, 1),
('CP201', 'CP201', 'Data Structures and Algorithms', 4, 'Core', 'DCSE', 2, 1),
('CP301', 'CP301', 'Operating Systems', 4, 'Core', 'DCSE', 3, 1),
('CP302', 'CP302', 'Computer Networks', 3, 'Core', 'DCSE', 3, 1),
('CP203', 'CP203', 'Database Systems', 4, 'Core', 'DCSE', 2, 2),
('CP303', 'CP303', 'Software Engineering Principles', 3, 'Core', 'DCSE', 3, 2),
('AI405', 'AI405', 'Cybersecurity Fundamentals', 3, 'Core', 'DCSE', 3, 2),
('IS201', 'IS201', 'Systems Analysis and Design', 3, 'Core', 'DIS', 2, 1),
('AC101', 'AC101', 'Financial Accounting I', 3, 'Core', 'DACC', 1, 1),
('LW101', 'LW101', 'Legal Methods', 3, 'Core', 'DLAW', 1, 1)
ON DUPLICATE KEY UPDATE title = VALUES(title), credits = VALUES(credits), status = 'Active';

INSERT INTO course_programmes (course_id, programme_id) VALUES
('CP101', 'BSCS'), ('CP101', 'BSSE'), ('CP101', 'BSCDS'),
('TN103', 'BSCS'), ('TN103', 'BSSE'), ('TN103', 'BSCDS'),
('CP103', 'BSCS'), ('CP103', 'BSSE'),
('GS101', 'BSCS'), ('GS101', 'BSSE'), ('GS101', 'BSCDS'), ('GS101', 'BSCIS'),
('CP201', 'BSCS'), ('CP201', 'BSSE'), ('CP201', 'BSCDS'),
('CP301', 'BSCS'), ('CP301', 'BSSE'),
('CP302', 'BSCS'), ('CP302', 'BSSE'), ('CP302', 'BSCDS'),
('CP203', 'BSCS'), ('CP203', 'BSSE'), ('CP203', 'BSCIS'),
('CP303', 'BSCS'), ('CP303', 'BSSE'),
('AI405', 'BSCS'), ('AI405', 'BSSE'), ('AI405', 'BSCIS'),
('IS201', 'BSCIS'), ('AC101', 'BCOMACC'), ('LW101', 'LLB')
ON DUPLICATE KEY UPDATE course_id = VALUES(course_id);

INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES
('CP201', 'CP101'), ('CP301', 'CP201'), ('CP302', 'CP201'), ('CP203', 'CP201'), ('CP303', 'CP101'), ('AI405', 'CP302')
ON DUPLICATE KEY UPDATE course_id = VALUES(course_id);

INSERT INTO students (id, registration_number, first_name, last_name, gender, date_of_birth, programme_id, department_id, study_year, status, email, phone, address, admission_date, entry_qualification, previous_school) VALUES
('STU-0001', 'T23-01-20001', 'Baraka', 'Komba', 'Male', '2004-01-01', 'BSCS', 'DCSE', 3, 'Active', 'baraka.komba0001@students.usiams.ac.tz', '+255710000001', 'P.O. Box 1001, Dar es Salaam, Tanzania', '2023-10-02', 'Advanced Certificate of Secondary Education (ACSEE)', 'Mzumbe Secondary School')
ON DUPLICATE KEY UPDATE study_year = VALUES(study_year), status = VALUES(status);

UPDATE users SET department_id = 'DCSE' WHERE id IN ('USR-STUDENT', 'USR-LECTURER');

INSERT INTO elections (id, name, description, starts_at, ends_at, status)
VALUES ('UDOSO-2026', 'UDOSO General Election 2026', 'Student union election managed through USIAMS.', '2026-09-16 08:00:00', '2026-10-07 18:00:00', 'Open')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), status = VALUES(status);

INSERT INTO election_positions (id, election_id, name, display_order) VALUES
('UDOSO-2026-PRESIDENT', 'UDOSO-2026', 'President', 1),
('UDOSO-2026-VPRESIDENT', 'UDOSO-2026', 'Vice President', 2),
('UDOSO-2026-SECRETARY', 'UDOSO-2026', 'Secretary General', 3)
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order);
