-- MuniPrioritise: ward centroids + 20-ward seed
-- Safe to run more than once. Run it on Neon after reading the notes below.
--
-- WHY: reports were being saved with ward_id = NULL, and GET /api/jobs then
-- quietly treated every one of them as CPT-001 (SAMPI 0.78). The hybrid
-- algorithm's equity term needs a real ward. The backend now assigns the
-- nearest ward at submission, which needs a centroid for every ward.
--
-- DATA IS SYNTHETIC: centroids are approximate suburb centres; sampi_score
-- and population are invented for the prototype (see database/seed/wards.json).
-- The three existing wards (CPT-001..003) keep their names and scores; only
-- their centroids are added. JHB-001/002 are left alone (no centroid, so they
-- are never chosen as a nearest ward).

ALTER TABLE wards
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

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
  ('CPT-020', 'City of Cape Town', 'Kraaifontein Ward 20', 0.5400, 34000, -33.84, 18.72)
ON CONFLICT (id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng;

-- Backfill existing reports that have no ward: nearest centroid within 25 km.
-- Same rule as MAX_WARD_DISTANCE_KM in backend/index.js. Reports further than
-- that from every ward stay NULL.
UPDATE reports r
SET ward_id = (
  SELECT w.id
  FROM wards w
  WHERE w.lat IS NOT NULL
    AND 111.0 * sqrt(power(r.lat::float8 - w.lat, 2) + power((r.lng::float8 - w.lng) * cos(radians(r.lat::float8)), 2)) <= 25
  ORDER BY 111.0 * sqrt(power(r.lat::float8 - w.lat, 2) + power((r.lng::float8 - w.lng) * cos(radians(r.lat::float8)), 2))
  LIMIT 1
)
WHERE r.ward_id IS NULL;
