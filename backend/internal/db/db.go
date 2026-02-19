package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func Init(databaseURL string) error {
	var err error
	DB, err = sql.Open("postgres", databaseURL)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("[db] Connected to PostgreSQL")
	return nil
}

func Migrate() error {
	schema := `
	CREATE EXTENSION IF NOT EXISTS "pgcrypto";

	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		display_name TEXT NOT NULL DEFAULT '',
		avatar_url TEXT DEFAULT '',
		max_tunnels INT NOT NULL DEFAULT 5,
		role TEXT NOT NULL DEFAULT 'user',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS tunnels (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		tunnel_id TEXT UNIQUE NOT NULL,
		type TEXT NOT NULL DEFAULT 'http',
		local_port INT NOT NULL,
		public_endpoint TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'offline',
		bytes_in BIGINT NOT NULL DEFAULT 0,
		bytes_out BIGINT NOT NULL DEFAULT 0,
		connections INT NOT NULL DEFAULT 0,
		assigned_port INT DEFAULT 0,
		expires_at TIMESTAMPTZ,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS api_keys (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		key_prefix TEXT NOT NULL,
		key_hash TEXT NOT NULL,
		last_used_at TIMESTAMPTZ,
		expires_at TIMESTAMPTZ,
		revoked BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS webhooks (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		url TEXT NOT NULL,
		events TEXT[] NOT NULL DEFAULT '{}',
		secret TEXT NOT NULL DEFAULT '',
		active BOOLEAN NOT NULL DEFAULT TRUE,
		last_triggered_at TIMESTAMPTZ,
		failure_count INT NOT NULL DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS notifications (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		message TEXT NOT NULL,
		type TEXT NOT NULL DEFAULT 'info',
		read BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		action TEXT NOT NULL,
		target_type TEXT NOT NULL DEFAULT '',
		target_id TEXT NOT NULL DEFAULT '',
		metadata TEXT DEFAULT '',
		ip_address TEXT DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS connection_logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tunnel_id UUID NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		source_ip TEXT DEFAULT '',
		method TEXT DEFAULT '',
		path TEXT DEFAULT '',
		status_code INT DEFAULT 0,
		latency_ms INT DEFAULT 0,
		bytes_transferred BIGINT DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_tunnels_user_id ON tunnels(user_id);
	CREATE INDEX IF NOT EXISTS idx_tunnels_tunnel_id ON tunnels(tunnel_id);
	CREATE INDEX IF NOT EXISTS idx_tunnels_status ON tunnels(status);
	CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
	CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
	CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
	CREATE INDEX IF NOT EXISTS idx_connection_logs_tunnel_id ON connection_logs(tunnel_id);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Println("[db] Migrations complete")
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
