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
  geom GEOMETRY(POLYGON, 4326)        -- PostGIS polygon for ward boundary
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
  report_id UUID REFERENCES reports(id),
  worker_id UUID REFERENCES users(id),
  algorithm_used VARCHAR(30),         -- 'fcfs', 'greedy', 'genetic', 'hybrid'
  priority_score DECIMAL(10, 6),
  efficiency_score DECIMAL(10, 6),
  equity_score DECIMAL(10, 6),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
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
  occurred_at TIMESTAMPTZ DEFAULT NOW()
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
-- SEED DATA — 5 wards with real SAMPI-range scores
-- (synthetic — based on StatsSA deprivation index ranges)
-- ============================================================
INSERT INTO wards (id, municipality, name, sampi_score, population) VALUES
  ('CPT-001', 'City of Cape Town', 'Khayelitsha Ward 1', 0.7823, 42000),
  ('CPT-002', 'City of Cape Town', 'Mitchells Plain Ward 2', 0.6541, 38000),
  ('CPT-003', 'City of Cape Town', 'Bellville Ward 3', 0.3102, 21000),
  ('JHB-001', 'City of Johannesburg', 'Alexandra Ward 1', 0.7491, 55000),
  ('JHB-002', 'City of Johannesburg', 'Sandton Ward 2', 0.1203, 18000)
ON CONFLICT (id) DO NOTHING;
