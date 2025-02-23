-- Tạo database nếu chưa có
CREATE DATABASE IF NOT EXISTS crypto_db;
USE crypto_db;

-- Tạo bảng users
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    level INT UNSIGNED DEFAULT 1,
    exp FLOAT UNSIGNED DEFAULT 1,
    balance DECIMAL(18,8) NOT NULL DEFAULT 0,
    mining_active TINYINT NOT NULL DEFAULT 0,
    mining_start_time BIGINT DEFAULT NULL,
    ip VARCHAR(255) NOT NULL,
    mining_fixed_amount DECIMAL(16,8) NULL
);

-- Tạo bảng guilds
CREATE TABLE IF NOT EXISTS guilds (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),               -- ID của guild (UUID)
    name VARCHAR(255) NOT NULL,                               -- Tên guild
    leader_id CHAR(36) NOT NULL,                              -- ID của trưởng nhóm (liên kết với bảng users)
    members JSON,                                            -- Mảng chứa các thành viên (dạng JSON)
    mining_users JSON,                                       -- Mảng chứa các người đang đào (dạng JSON)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,           -- Thời gian tạo guild
    FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE -- Liên kết với bảng users
);
