-- MuniPrioritise — Database Initialisation Script
-- This runs automatically when the Docker container first starts.
-- If you need to reset: docker compose down -v && docker compose up

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- WARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS wards (
  id VARCHAR(50) PRIMARY KEY,
  municipality VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sampi_score DECIMAL(5,4),           -- 0.0000 to 1.0000 (higher = more deprived)
  population INTEGER,
  lat DOUBLE PRECISION,               -- ward centroid, used to assign a report to its nearest ward
  lng DOUBLE PRECISION,
  geom GEOMETRY(POLYGON, 4326)        -- PostGIS polygon for ward boundary (not populated yet)
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('resident', 'worker', 'supervisor')),
  full_name VARCHAR(255),
  expo_push_token VARCHAR(255),
  ward_id VARCHAR(50) REFERENCES wards(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REPORTS (Service requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  category VARCHAR(50) NOT NULL CHECK (category IN ('water', 'electricity', 'roads', 'refuse', 'sanitation')),
  description TEXT,
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'escalated')),
  location GEOMETRY(POINT, 4326),
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  ward_id VARCHAR(50) REFERENCES wards(id),
  photo_urls TEXT[],
  resolution_rating INTEGER CHECK (resolution_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for proximity queries
CREATE INDEX IF NOT EXISTS reports_location_idx ON reports USING GIST (location);

-- ============================================================
-- JOB ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID UNIQUE REFERENCES reports(id),   -- one assignment per report (GET /api/jobs upserts on this)
  worker_id UUID REFERENCES users(id),
  algorithm_used VARCHAR(30),         -- 'fcfs', 'greedy', 'genetic', 'hybrid'
  priority_score DECIMAL(10, 6),
  efficiency_score DECIMAL(10, 6),
  equity_score DECIMAL(10, 6),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  override_by UUID REFERENCES users(id),
  notes TEXT
);

-- ============================================================
-- STATUS HISTORY (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  changed_by UUID REFERENCES users(id),
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  notes TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  job_id UUID REFERENCES job_assignments(id),     -- set for supervisor overrides
  old_worker_id UUID REFERENCES users(id),
  new_worker_id UUID REFERENCES users(id)
);

-- ============================================================
-- EVIDENCE (completion photos/notes)
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  worker_id UUID REFERENCES users(id),
  photo_urls TEXT[],
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BENCHMARK RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name VARCHAR(100),
  algorithm VARCHAR(30),
  gini_coefficient DECIMAL(10, 6),
  avg_response_time DECIMAL(10, 4),
  high_severity_rate DECIMAL(5, 4),
  low_income_coverage DECIMAL(5, 4),
  processing_time_ms INTEGER,
  alpha_value DECIMAL(5, 4),
  run_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA: 20 Cape Town wards plus 2 Johannesburg wards.
-- SYNTHETIC: centroids are approximate suburb centres, sampi_score and
-- population are invented for the prototype (range 0.12-0.78, issue P3-03).
-- Same data as database/seed/wards.json and migrations/003_ward_centroids.sql.
-- The JHB wards have no centroid, so they are never chosen as a nearest ward.
-- ============================================================
INSERT INTO wards (id, municipality, name, sampi_score, population, lat, lng) VALUES
  ('CPT-001', 'City of Cape Town', 'Khayelitsha Ward 1', 0.7823, 42000, -34.04, 18.67),
  ('CPT-002', 'City of Cape Town', 'Mitchells Plain Ward 2', 0.6541, 38000, -34.05, 18.62),
  ('CPT-003', 'City of Cape Town', 'Bellville Ward 3', 0.3102, 21000, -33.9, 18.63),
  ('CPT-004', 'City of Cape Town', 'Gugulethu Ward 4', 0.7120, 36000, -33.98, 18.57),
  ('CPT-005', 'City of Cape Town', 'Nyanga Ward 5', 0.7450, 33000, -33.9917, 18.5833),
  ('CPT-006', 'City of Cape Town', 'Philippi Ward 6', 0.6900, 40000, -34.0, 18.6),
  ('CPT-007', 'City of Cape Town', 'Delft Ward 7', 0.6300, 35000, -33.97, 18.64),
  ('CPT-008', 'City of Cape Town', 'Langa Ward 8', 0.5900, 24000, -33.94, 18.53),
  ('CPT-009', 'City of Cape Town', 'Athlone Ward 9', 0.4500, 27000, -33.96, 18.5),
  ('CPT-010', 'City of Cape Town', 'Mannenberg Ward 10', 0.5600, 22000, -34.0, 18.55),
  ('CPT-011', 'City of Cape Town', 'Milnerton Ward 11', 0.2400, 26000, -33.9, 18.49),
  ('CPT-012', 'City of Cape Town', 'Durbanville Ward 12', 0.1800, 23000, -33.83, 18.65),
  ('CPT-013', 'City of Cape Town', 'Parow Ward 13', 0.3500, 25000, -33.904, 18.56),
  ('CPT-014', 'City of Cape Town', 'Goodwood Ward 14', 0.3300, 20000, -33.907, 18.546),
  ('CPT-015', 'City of Cape Town', 'Claremont Ward 15', 0.1500, 19000, -33.985, 18.465),
  ('CPT-016', 'City of Cape Town', 'Sea Point Ward 16', 0.1200, 17000, -33.92, 18.385),
  ('CPT-017', 'City of Cape Town', 'Cape Town CBD Ward 17', 0.2000, 16000, -33.925, 18.424),
  ('CPT-018', 'City of Cape Town', 'Woodstock Ward 18', 0.4200, 18000, -33.93, 18.45),
  ('CPT-019', 'City of Cape Town', 'Elsies River Ward 19', 0.5100, 30000, -33.92, 18.58),
  ('CPT-020', 'City of Cape Town', 'Kraaifontein Ward 20', 0.5400, 34000, -33.84, 18.72),
  ('JHB-001', 'City of Johannesburg', 'Alexandra Ward 1', 0.7491, 55000, NULL, NULL),
  ('JHB-002', 'City of Johannesburg', 'Sandton Ward 2', 0.1203, 18000, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
