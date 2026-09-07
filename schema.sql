PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  national_id TEXT,
  guardian_name TEXT,
  guardian_mobile TEXT,
  city TEXT,
  birth_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'lead' CHECK(status IN ('lead','consulted','pre_registered','active','completed','withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_mobile ON students(mobile);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  code TEXT UNIQUE,
  default_fee INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  cohort TEXT,
  gross_fee INTEGER NOT NULL CHECK(gross_fee >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK(discount >= 0),
  final_fee INTEGER NOT NULL CHECK(final_fee >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pre_registered','active','completed','withdrawn','cancelled')),
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);

CREATE TABLE IF NOT EXISTS installments (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  due_date TEXT NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','paid','overdue','waived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, installment_no)
);
CREATE INDEX IF NOT EXISTS idx_installments_due ON installments(due_date, status);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  installment_id TEXT REFERENCES installments(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  method TEXT NOT NULL CHECK(method IN ('cash','card','transfer','gateway','other')),
  reference_no TEXT,
  paid_at TEXT NOT NULL,
  received_by TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_enrollment ON payments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
