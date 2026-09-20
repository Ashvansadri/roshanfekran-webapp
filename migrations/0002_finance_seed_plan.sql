-- Academy Control Center Finance Engine v0.2
-- Staging migration plan
-- No production data is affected.

CREATE TABLE IF NOT EXISTS financial_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  method TEXT,
  reference TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_events_enrollment
ON financial_events(enrollment_id);

-- Supported event_type values:
-- PAYMENT, DISCOUNT, REFUND, ADJUSTMENT

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_event_id INTEGER NOT NULL,
  receipt_no TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(payment_event_id) REFERENCES financial_events(id)
);
