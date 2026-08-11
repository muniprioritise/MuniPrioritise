CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('worker', 'supervisor')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    category VARCHAR(50) CHECK (category IN ('water', 'electricity', 'roads', 'refuse', 'sanitation')),
    description TEXT NOT NULL,
    severity INTEGER CHECK (severity BETWEEN 1 AND 3),
    status VARCHAR(50) DEFAULT 'pending',
    location VARCHAR(255),
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL,
    ward_id VARCHAR(50) DEFAULT 'CPT-001',
    photo_urls TEXT[],
    resolution_rating INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
