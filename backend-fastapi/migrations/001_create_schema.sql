-- PostgreSQL Schema Migration
-- EmailBundles Database Schema
-- Run this script on your PostgreSQL hosting account

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS TABLE (Regular Users/Subscribers)
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    tier VARCHAR(50) DEFAULT 'standard' CHECK (tier IN ('standard', 'pro')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

-- ========================================
-- ADMINS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for admins
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ========================================
-- PRODUCTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    stripe_price_id VARCHAR(255),
    stripe_product_id VARCHAR(255),
    download_file VARCHAR(500),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- ========================================
-- TRANSACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    product VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_payment_id ON transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_session_id ON transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_email ON transactions(email);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- ========================================
-- SAVED TEMPLATES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS saved_templates (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    html TEXT NOT NULL,
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    storage_size INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for saved_templates
CREATE INDEX IF NOT EXISTS idx_saved_templates_user_id ON saved_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_templates_created_at ON saved_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_templates_components ON saved_templates USING GIN(components);
CREATE INDEX IF NOT EXISTS idx_saved_templates_metadata ON saved_templates USING GIN(metadata);

-- ========================================
-- COMPONENT LIBRARY TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS component_library (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    html TEXT NOT NULL,
    elements JSONB NOT NULL DEFAULT '[]'::jsonb,
    category VARCHAR(50) CHECK (category IN ('navigation', 'footer', 'cta', 'ecommerce', 'content', 'layout')),
    status VARCHAR(20) DEFAULT 'live' CHECK (status IN ('draft', 'live')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for component_library
CREATE INDEX IF NOT EXISTS idx_component_library_category ON component_library(category);
CREATE INDEX IF NOT EXISTS idx_component_library_status ON component_library(status);
CREATE INDEX IF NOT EXISTS idx_component_library_elements ON component_library USING GIN(elements);
CREATE INDEX IF NOT EXISTS idx_component_library_created_at ON component_library(created_at DESC);

-- ========================================
-- TRIGGERS FOR UPDATED_AT
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_templates_updated_at BEFORE UPDATE ON saved_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_component_library_updated_at BEFORE UPDATE ON component_library
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================
COMMENT ON TABLE users IS 'Regular user accounts (subscribers) with authentication and tier information';
COMMENT ON TABLE admins IS 'Admin accounts with authentication (separate from users table)';
COMMENT ON TABLE products IS 'Stripe products and pricing information';
COMMENT ON TABLE transactions IS 'Stripe payment transaction records';
COMMENT ON TABLE saved_templates IS 'User-created email templates (Pro tier feature)';
COMMENT ON TABLE component_library IS 'Reusable email components library';

COMMENT ON COLUMN users.tier IS 'User subscription tier: standard or pro';
COMMENT ON COLUMN admins.username IS 'Admin username (must be unique across both users and admins tables)';
COMMENT ON COLUMN products.active IS 'Whether product is active and visible in checkout';
COMMENT ON COLUMN saved_templates.components IS 'JSON array of component references and data';
COMMENT ON COLUMN saved_templates.metadata IS 'Template metadata (category, description, etc.)';
COMMENT ON COLUMN component_library.elements IS 'JSON array of editable elements within the component';

