-- User Management System - Database Migration Guide

-- This file shows the SQL structure for the user management tables
-- For TypeORM, these are auto-generated from entities

-- ============================================================================
-- USERS TABLE (ENHANCED)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    firstName VARCHAR(255) NOT NULL,
    lastName VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatarUrl VARCHAR(500),
    isActive BOOLEAN DEFAULT true,
    isDeactivated BOOLEAN DEFAULT false,
    deletedAt TIMESTAMP,
    lastLogin TIMESTAMP,
    emailVerified BOOLEAN DEFAULT false,
    emailVerificationToken VARCHAR(255),
    emailVerificationExpires TIMESTAMP,
    failedLoginAttempts INTEGER DEFAULT 0,
    lockedUntil TIMESTAMP,
    passwordResetToken VARCHAR(255),
    passwordResetExpires TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_unique UNIQUE(email)
);

-- Index for frequently queried fields
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted ON users(deletedAt);
CREATE INDEX idx_users_active ON users(isActive);
CREATE INDEX idx_users_last_login ON users(lastLogin);

-- ============================================================================
-- USER PREFERENCES TABLE
-- ============================================================================

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emailNotifications BOOLEAN DEFAULT true,
    smsNotifications BOOLEAN DEFAULT false,
    pushNotifications BOOLEAN DEFAULT false,
    dataShareConsent BOOLEAN DEFAULT false,
    profilePublic BOOLEAN DEFAULT true,
    preferredLanguage VARCHAR(10),
    timezone VARCHAR(50),
    marketingEmails BOOLEAN DEFAULT false,
    activityEmails BOOLEAN DEFAULT true,
    privacySettings JSONB,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_preferences_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_preference UNIQUE(userId)
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(userId);

-- ============================================================================
-- USER SESSIONS TABLE
-- ============================================================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deviceId VARCHAR(255) NOT NULL,
    deviceName VARCHAR(255),
    ipAddress VARCHAR(45) NOT NULL,
    userAgent TEXT NOT NULL,
    refreshToken VARCHAR(500),
    expiresAt TIMESTAMP NOT NULL,
    lastActivityAt TIMESTAMP,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_sessions_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for session lookups and expiration
CREATE INDEX idx_user_sessions_user_id ON user_sessions(userId);
CREATE INDEX idx_user_sessions_device_id ON user_sessions(deviceId);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refreshToken);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expiresAt);
CREATE INDEX idx_user_sessions_active ON user_sessions(isActive);

-- ============================================================================
-- USER ACTIVITY LOGS TABLE
-- ============================================================================

CREATE TYPE activity_type AS ENUM (
    'LOGIN',
    'LOGOUT',
    'PROFILE_UPDATE',
    'PASSWORD_CHANGE',
    'SETTINGS_UPDATE',
    'AVATAR_UPLOAD',
    'SESSION_CREATED',
    'SESSION_REVOKED',
    'ACCOUNT_DEACTIVATED',
    'ACCOUNT_REACTIVATED',
    'DATA_EXPORT',
    'DATA_DELETION',
    'SECURITY_EVENT'
);

CREATE TABLE user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activityType activity_type NOT NULL,
    description TEXT,
    ipAddress VARCHAR(45),
    userAgent TEXT,
    deviceId VARCHAR(255),
    metadata JSONB,
    isSuspicious BOOLEAN DEFAULT false,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_activity_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Composite indexes for common queries
CREATE INDEX idx_user_activity_logs_user_id_created ON user_activity_logs(userId, createdAt DESC);
CREATE INDEX idx_user_activity_logs_user_id_type ON user_activity_logs(userId, activityType);
CREATE INDEX idx_user_activity_logs_suspicious ON user_activity_logs(userId, isSuspicious);
CREATE INDEX idx_user_activity_logs_created ON user_activity_logs(createdAt DESC);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: User with profile completion
CREATE VIEW user_profile_completion AS
SELECT 
    u.id,
    u.email,
    u.firstName,
    u.lastName,
    CASE 
        WHEN firstName IS NOT NULL THEN 1 ELSE 0
    END +
    CASE 
        WHEN lastName IS NOT NULL THEN 1 ELSE 0
    END +
    CASE 
        WHEN email IS NOT NULL THEN 1 ELSE 0
    END +
    CASE 
        WHEN phone IS NOT NULL THEN 1 ELSE 0
    END +
    CASE 
        WHEN avatarUrl IS NOT NULL THEN 1 ELSE 0
    END AS completed_fields,
    (
        CASE 
            WHEN firstName IS NOT NULL THEN 1 ELSE 0
        END +
        CASE 
            WHEN lastName IS NOT NULL THEN 1 ELSE 0
        END +
        CASE 
            WHEN email IS NOT NULL THEN 1 ELSE 0
        END +
        CASE 
            WHEN phone IS NOT NULL THEN 1 ELSE 0
        END +
        CASE 
            WHEN avatarUrl IS NOT NULL THEN 1 ELSE 0
        END
    ) * 20 AS completion_score
FROM users u
WHERE u.deletedAt IS NULL;

-- View: Active sessions per user
CREATE VIEW active_sessions_view AS
SELECT 
    userId,
    COUNT(*) as active_session_count,
    MAX(lastActivityAt) as last_activity,
    MIN(expiresAt) as earliest_expiration
FROM user_sessions
WHERE isActive = true AND expiresAt > CURRENT_TIMESTAMP
GROUP BY userId;

-- View: User activity summary
CREATE VIEW user_activity_summary AS
SELECT 
    u.id,
    u.email,
    COUNT(CASE WHEN al.activityType = 'LOGIN' THEN 1 END) as total_logins,
    MAX(CASE WHEN al.activityType = 'LOGIN' THEN al.createdAt END) as last_login_activity,
    COUNT(CASE WHEN al.isSuspicious = true THEN 1 END) as suspicious_activities,
    MAX(al.createdAt) as last_activity
FROM users u
LEFT JOIN user_activity_logs al ON u.id = al.userId
WHERE u.deletedAt IS NULL
GROUP BY u.id, u.email;

-- ============================================================================
-- MIGRATION PROCEDURES
-- ============================================================================

-- Function to deactivate account
CREATE OR REPLACE FUNCTION deactivate_user_account(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users SET isDeactivated = true, isActive = false WHERE id = user_id;
    UPDATE user_sessions SET isActive = false WHERE userId = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to soft delete user
CREATE OR REPLACE FUNCTION soft_delete_user(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET deletedAt = CURRENT_TIMESTAMP, 
        isActive = false,
        email = CONCAT('deleted-', id, '@example.com')
    WHERE id = user_id;
    UPDATE user_sessions SET isActive = false WHERE userId = user_id;
    INSERT INTO user_activity_logs 
    (userId, activityType, description) 
    VALUES (user_id, 'DATA_DELETION', 'Account deleted (data retained for 30 days)');
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions 
    WHERE expiresAt < CURRENT_TIMESTAMP 
    OR (isActive = false AND createdAt < CURRENT_TIMESTAMP - INTERVAL '90 days');
END;
$$ LANGUAGE plpgsql;

-- Function to archive old activity logs (> 90 days)
CREATE OR REPLACE FUNCTION archive_old_activity_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM user_activity_logs 
    WHERE createdAt < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULED JOBS (OPTIONAL - Requires pg_cron extension)
-- ============================================================================

-- Uncomment if pg_cron is installed and enabled
/*
-- Run daily at 2 AM
SELECT cron.schedule('cleanup-expired-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions()');

-- Run monthly
SELECT cron.schedule('archive-old-logs', '0 0 1 * *', 'SELECT archive_old_activity_logs()');
*/

-- ============================================================================
-- DATA VALIDATION QUERIES
-- ============================================================================

-- Check profile completion statistics
SELECT 
    u.id,
    u.email,
    (
        CASE WHEN u.firstName IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN u.lastName IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN u.email IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN u.phone IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN u.avatarUrl IS NOT NULL THEN 1 ELSE 0 END
    ) * 20 as completion_score
FROM users u
WHERE u.deletedAt IS NULL
ORDER BY completion_score DESC;

-- Find users with multiple active sessions
SELECT 
    u.id,
    u.email,
    COUNT(us.id) as active_sessions,
    MAX(us.lastActivityAt) as last_activity
FROM users u
LEFT JOIN user_sessions us ON u.id = us.userId AND us.isActive = true
WHERE u.deletedAt IS NULL
GROUP BY u.id, u.email
HAVING COUNT(us.id) > 1
ORDER BY active_sessions DESC;

-- Find suspicious activity patterns
SELECT 
    u.id,
    u.email,
    COUNT(*) as suspicious_count,
    MAX(al.createdAt) as last_suspicious,
    STRING_AGG(DISTINCT al.activityType::text, ', ') as activity_types
FROM users u
INNER JOIN user_activity_logs al ON u.id = al.userId
WHERE al.isSuspicious = true
GROUP BY u.id, u.email
ORDER BY suspicious_count DESC;

-- Monitor recently deleted accounts (< 30 days)
SELECT 
    id,
    email,
    deletedAt,
    CURRENT_TIMESTAMP - deletedAt as days_since_deletion
FROM users
WHERE deletedAt IS NOT NULL
AND deletedAt > CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY deletedAt DESC;

-- Activity summary statistics
SELECT 
    DATE(createdAt) as activity_date,
    activityType,
    COUNT(*) as count,
    COUNT(CASE WHEN isSuspicious = true THEN 1 END) as suspicious_count
FROM user_activity_logs
WHERE createdAt > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY DATE(createdAt), activityType
ORDER BY activity_date DESC, count DESC;

-- ============================================================================
-- GRANT PERMISSIONS (Example)
-- ============================================================================

-- Create application user (if needed)
-- CREATE USER petchain_user WITH PASSWORD 'secure_password';

-- Grant necessary permissions
-- GRANT USAGE ON SCHEMA public TO petchain_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON users TO petchain_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO petchain_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO petchain_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_activity_logs TO petchain_user;

-- ============================================================================
-- BACKUP AND RECOVERY
-- ============================================================================

-- Backup user data (PostgreSQL)
-- pg_dump -U postgres -d petchain_db -t users -t user_preferences -t user_sessions -t user_activity_logs > backup.sql

-- Restore from backup
-- psql -U postgres -d petchain_db < backup.sql
