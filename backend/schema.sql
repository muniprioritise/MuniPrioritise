CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('resident', 'worker', 'supervisor')),
    expo_push_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'completed', 'escalated')),
    assigned_by VARCHAR(255) DEFAULT 'algorithm',
    score NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
