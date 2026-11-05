-- =====================================================================
-- DropBoxed: schema, tables, constraints and indexes
-- Implements Part 6 (Relational Schema), Part 7 (Data Dictionary) and
-- Part 9 (Integrity Constraints) of the Activity 2 database blueprint.
--
-- Run while connected to dropboxed_db:
--   psql -U postgres -d dropboxed_db -f database/01_schema.sql
-- (or use: npm run db:setup)
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS dropboxed;
SET search_path TO dropboxed;

-- ---------------------------------------------------------------------
-- USERS: resident / homeowner accounts (Business Rules 1, 12)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id         INTEGER GENERATED ALWAYS AS IDENTITY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   TEXT         NOT NULL,
    phone_number    VARCHAR(20),
    account_status  VARCHAR(20)  NOT NULL DEFAULT 'Active',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_account_status CHECK (account_status IN ('Active', 'Inactive'))
);

-- ---------------------------------------------------------------------
-- STAFF: water district staff / administrator accounts (Business Rule 12)
-- ---------------------------------------------------------------------
CREATE TABLE staff (
    staff_id        INTEGER GENERATED ALWAYS AS IDENTITY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   TEXT         NOT NULL,
    account_status  VARCHAR(20)  NOT NULL DEFAULT 'Active',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_staff PRIMARY KEY (staff_id),
    CONSTRAINT uq_staff_email UNIQUE (email),
    CONSTRAINT ck_staff_account_status CHECK (account_status IN ('Active', 'Inactive'))
);

-- ---------------------------------------------------------------------
-- COMPLAINT_CATEGORIES: water issue types (Business Rule 3)
-- ---------------------------------------------------------------------
CREATE TABLE complaint_categories (
    category_id     INTEGER GENERATED ALWAYS AS IDENTITY,
    category_name   VARCHAR(100) NOT NULL,
    description     TEXT,
    CONSTRAINT pk_complaint_categories PRIMARY KEY (category_id),
    CONSTRAINT uq_complaint_categories_name UNIQUE (category_name)
);

-- ---------------------------------------------------------------------
-- LOCATIONS: household addresses where issues are reported (Business Rule 4)
-- ---------------------------------------------------------------------
CREATE TABLE locations (
    location_id     INTEGER GENERATED ALWAYS AS IDENTITY,
    house_number    VARCHAR(50)  NOT NULL,
    street          VARCHAR(150) NOT NULL,
    barangay        VARCHAR(100) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    postal_code     VARCHAR(10),
    CONSTRAINT pk_locations PRIMARY KEY (location_id)
);

-- ---------------------------------------------------------------------
-- COMPLAINTS: core complaint records (Business Rules 1-5, 10, 11)
-- ---------------------------------------------------------------------
CREATE TABLE complaints (
    complaint_id    INTEGER GENERATED ALWAYS AS IDENTITY,
    user_id         INTEGER      NOT NULL,
    category_id     INTEGER      NOT NULL,
    location_id     INTEGER      NOT NULL,
    description     TEXT         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    is_flagged      BOOLEAN      NOT NULL DEFAULT FALSE,
    flag_reason     TEXT,
    submitted_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP,
    CONSTRAINT pk_complaints PRIMARY KEY (complaint_id),
    CONSTRAINT fk_complaints_user
        FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_complaints_category
        FOREIGN KEY (category_id) REFERENCES complaint_categories (category_id),
    CONSTRAINT fk_complaints_location
        FOREIGN KEY (location_id) REFERENCES locations (location_id),
    CONSTRAINT ck_complaints_description CHECK (btrim(description) <> ''),
    CONSTRAINT ck_complaints_status CHECK (status IN ('Pending', 'In Progress', 'Resolved')),
    -- BOOLEAN NOT NULL already limits values to TRUE/FALSE; kept explicit to match Part 9.
    CONSTRAINT ck_complaints_is_flagged CHECK (is_flagged IN (TRUE, FALSE)),
    -- A resolved complaint must have a resolution timestamp, and only resolved ones may.
    CONSTRAINT ck_complaints_resolved_at CHECK (
        (status = 'Resolved' AND resolved_at IS NOT NULL)
        OR (status <> 'Resolved' AND resolved_at IS NULL)
    )
);

-- ---------------------------------------------------------------------
-- COMPLAINT_ASSIGNMENTS: associative table resolving complaints M:N staff
-- (Business Rule 6)
-- ---------------------------------------------------------------------
CREATE TABLE complaint_assignments (
    assignment_id   INTEGER GENERATED ALWAYS AS IDENTITY,
    complaint_id    INTEGER      NOT NULL,
    staff_id        INTEGER      NOT NULL,
    assigned_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_complaint_assignments PRIMARY KEY (assignment_id),
    CONSTRAINT fk_complaint_assignments_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaints (complaint_id),
    CONSTRAINT fk_complaint_assignments_staff
        FOREIGN KEY (staff_id) REFERENCES staff (staff_id),
    CONSTRAINT uq_complaint_assignments_complaint_staff UNIQUE (complaint_id, staff_id)
);

-- ---------------------------------------------------------------------
-- STATUS_LOGS: timestamped history of status changes (Business Rules 5, 7)
-- ---------------------------------------------------------------------
CREATE TABLE status_logs (
    status_log_id   INTEGER GENERATED ALWAYS AS IDENTITY,
    complaint_id    INTEGER      NOT NULL,
    staff_id        INTEGER      NOT NULL,
    status          VARCHAR(20)  NOT NULL,
    remarks         TEXT,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_status_logs PRIMARY KEY (status_log_id),
    CONSTRAINT fk_status_logs_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaints (complaint_id),
    CONSTRAINT fk_status_logs_staff
        FOREIGN KEY (staff_id) REFERENCES staff (staff_id),
    CONSTRAINT ck_status_logs_status CHECK (status IN ('Pending', 'In Progress', 'Resolved'))
);

-- ---------------------------------------------------------------------
-- ATTACHMENTS: photo evidence metadata; files live in local storage
-- (Business Rules 8, 9)
-- ---------------------------------------------------------------------
CREATE TABLE attachments (
    attachment_id   INTEGER GENERATED ALWAYS AS IDENTITY,
    complaint_id    INTEGER      NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_path       TEXT         NOT NULL,
    file_type       VARCHAR(50)  NOT NULL,
    file_size_bytes BIGINT       NOT NULL,
    uploaded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_attachments PRIMARY KEY (attachment_id),
    CONSTRAINT fk_attachments_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaints (complaint_id),
    CONSTRAINT ck_attachments_file_type CHECK (file_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_attachments_file_size CHECK (file_size_bytes > 0)
);

-- ---------------------------------------------------------------------
-- Indexes on foreign keys and common filters.
-- PostgreSQL does not index foreign-key columns automatically; these
-- support joins, the admin filters and the reports (see Part 12,
-- "Future Administration Concerns").
-- ---------------------------------------------------------------------
CREATE INDEX idx_complaints_user_id        ON complaints (user_id);
CREATE INDEX idx_complaints_category_id    ON complaints (category_id);
CREATE INDEX idx_complaints_location_id    ON complaints (location_id);
CREATE INDEX idx_complaints_status         ON complaints (status);
CREATE INDEX idx_complaints_submitted_at   ON complaints (submitted_at);
CREATE INDEX idx_complaint_assignments_staff_id ON complaint_assignments (staff_id);
CREATE INDEX idx_status_logs_complaint_id  ON status_logs (complaint_id, updated_at);
CREATE INDEX idx_status_logs_staff_id      ON status_logs (staff_id);
CREATE INDEX idx_attachments_complaint_id  ON attachments (complaint_id);
CREATE INDEX idx_locations_barangay        ON locations (barangay);

-- ---------------------------------------------------------------------
-- Data dictionary stored in the catalog (visible in pgAdmin and \d+)
-- ---------------------------------------------------------------------
COMMENT ON SCHEMA dropboxed IS 'DropBoxed household water complaint system.';

COMMENT ON TABLE users IS 'Resident/homeowner accounts that submit water complaints.';
COMMENT ON COLUMN users.email IS 'Unique email address used for account identification/login (stored lowercase).';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash of the password; plain-text passwords are never stored.';
COMMENT ON COLUMN users.account_status IS 'Active or Inactive. Inactive accounts cannot log in.';

COMMENT ON TABLE staff IS 'Water district staff/administrator accounts (e.g., Primewater San Pedro).';
COMMENT ON COLUMN staff.email IS 'Unique email address of the staff member (stored lowercase).';
COMMENT ON COLUMN staff.password_hash IS 'bcrypt hash of the password.';
COMMENT ON COLUMN staff.account_status IS 'Active or Inactive. Inactive accounts cannot log in.';

COMMENT ON TABLE complaint_categories IS 'Water issue categories such as rusty water, low pressure, foul odor and pipe leak.';

COMMENT ON TABLE locations IS 'Household locations where water issues were reported.';
COMMENT ON COLUMN locations.barangay IS 'Barangay of the reported location; used for complaints-by-area reports.';

COMMENT ON TABLE complaints IS 'Water-related complaints submitted by residents.';
COMMENT ON COLUMN complaints.status IS 'Lifecycle: Pending -> In Progress -> Resolved (transitions enforced by the application).';
COMMENT ON COLUMN complaints.is_flagged IS 'TRUE when flagged for administrative review (possible duplicate, spam or invalid).';
COMMENT ON COLUMN complaints.flag_reason IS 'Reason for the flag; only meaningful when is_flagged is TRUE.';
COMMENT ON COLUMN complaints.resolved_at IS 'Set when status becomes Resolved; NULL otherwise.';

COMMENT ON TABLE complaint_assignments IS 'Associative table: which staff members are assigned to which complaints (M:N).';

COMMENT ON TABLE status_logs IS 'Timestamped history of every status update made by staff.';
COMMENT ON COLUMN status_logs.staff_id IS 'Staff member who performed the status update.';

COMMENT ON TABLE attachments IS 'Photo evidence metadata; the image file is stored on local disk at file_path.';
COMMENT ON COLUMN attachments.file_path IS 'Storage path relative to the application upload directory.';
COMMENT ON COLUMN attachments.file_type IS 'MIME type of the image: image/jpeg or image/png.';
