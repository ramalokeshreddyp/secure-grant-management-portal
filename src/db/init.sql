-- Grant Management Portal Database Initialization Script
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: roles
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_oauth UNIQUE (oauth_provider, oauth_id)
);

-- ============================================
-- TABLE: user_roles (Many-to-Many pivot)
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- ============================================
-- TABLE: grants
-- ============================================
CREATE TABLE IF NOT EXISTS grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    deadline TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'draft')),
    grantor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLE: applications
-- ============================================
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')),
    reviewer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_application UNIQUE (grant_id, grantee_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_grants_grantor_id ON grants(grantor_id);
CREATE INDEX IF NOT EXISTS idx_grants_status ON grants(status);
CREATE INDEX IF NOT EXISTS idx_applications_grant_id ON applications(grant_id);
CREATE INDEX IF NOT EXISTS idx_applications_grantee_id ON applications(grantee_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- ============================================
-- SEED: Roles
-- ============================================
INSERT INTO roles (id, name, description) VALUES
    (uuid_generate_v4(), 'ADMIN', 'System administrator with full access'),
    (uuid_generate_v4(), 'GRANTOR', 'Can create and manage grant opportunities'),
    (uuid_generate_v4(), 'GRANTEE', 'Can view grants and submit applications')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED: Admin User
-- Password: Admin@123456 (bcrypt hash)
-- ============================================
DO $$
DECLARE
    admin_user_id UUID;
    admin_role_id UUID;
BEGIN
    -- Insert admin user if not exists
    INSERT INTO users (id, name, email, password_hash, is_active)
    VALUES (
        uuid_generate_v4(),
        'System Administrator',
        'admin@grantportal.com',
        '$2a$12$nKpbywbjPRVgznR8b03vSux7H5coRMNRDgq5shqx/x3E5lHggyLAK',
        TRUE
    )
    ON CONFLICT (email) DO NOTHING;

    -- Get admin user ID
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@grantportal.com';
    
    -- Get admin role ID
    SELECT id INTO admin_role_id FROM roles WHERE name = 'ADMIN';
    
    -- Assign admin role
    IF admin_user_id IS NOT NULL AND admin_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id)
        VALUES (admin_user_id, admin_role_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
