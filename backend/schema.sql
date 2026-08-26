CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) CHECK (category IN ('water', 'electricity', 'roads', 'refuse', 'sanitation')),
    description TEXT NOT NULL,
    severity INTEGER CHECK (severity BETWEEN 1 AND 3),
    status VARCHAR(50) DEFAULT 'pending',
    location VARCHAR(255),
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL,
    ward_id VARCHAR(50) DEFAULT 'CPT-001',
    photo_urls TEXT[],
    worker_evidence TEXT[],
    resolution_rating INTEGER CHECK (resolution_rating BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
