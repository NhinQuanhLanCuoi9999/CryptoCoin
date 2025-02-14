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