USE university;

CREATE TABLE IF NOT EXISTS elections (
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

CREATE TABLE IF NOT EXISTS election_positions (
  id VARCHAR(40) PRIMARY KEY,
  election_id VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_election_position (election_id, name),
  CONSTRAINT fk_positions_election FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS election_candidates (
  id VARCHAR(40) PRIMARY KEY,
  position_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  manifesto TEXT,
  status ENUM('Pending', 'Approved', 'Rejected', 'Withdrawn') NOT NULL DEFAULT 'Pending',
  UNIQUE KEY uq_position_candidate (position_id, student_id),
  CONSTRAINT fk_candidates_position FOREIGN KEY (position_id) REFERENCES election_positions(id) ON DELETE CASCADE,
  CONSTRAINT fk_candidates_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS election_votes (
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

INSERT INTO elections (id, name, description, starts_at, ends_at, status)
VALUES ('UDOSO-2026', 'UDOSO General Election 2026', 'Student union election managed through USIAMS.', '2026-09-16 08:00:00', '2026-10-07 18:00:00', 'Open')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), status = VALUES(status);

INSERT INTO election_positions (id, election_id, name, display_order) VALUES
('UDOSO-2026-PRESIDENT', 'UDOSO-2026', 'President', 1),
('UDOSO-2026-VPRESIDENT', 'UDOSO-2026', 'Vice President', 2),
('UDOSO-2026-SECRETARY', 'UDOSO-2026', 'Secretary General', 3)
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order);
