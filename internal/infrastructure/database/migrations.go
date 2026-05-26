package database

import (
	"database/sql"
	"fmt"
)

var migrations = []string{
	`CREATE TABLE IF NOT EXISTS schema_migrations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);`,
	`CREATE TABLE IF NOT EXISTS goals (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		description TEXT,
		status TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		archived_at DATETIME
	);`,
	`CREATE TABLE IF NOT EXISTS initiatives (
		id TEXT PRIMARY KEY,
		goal_id TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		status TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		archived_at DATETIME,
		FOREIGN KEY (goal_id) REFERENCES goals(id)
	);`,
	`CREATE TABLE IF NOT EXISTS kpis (
		id TEXT PRIMARY KEY,
		goal_id TEXT NOT NULL,
		initiative_id TEXT,
		name TEXT NOT NULL,
		description TEXT,
		unit TEXT NOT NULL,
		custom_unit TEXT,
		target_value REAL NOT NULL,
		period_type TEXT NOT NULL,
		allow_exceed_target BOOLEAN NOT NULL DEFAULT 1,
		status TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		archived_at DATETIME,
		FOREIGN KEY (goal_id) REFERENCES goals(id),
		FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
	);`,
	`CREATE TABLE IF NOT EXISTS kpi_entries (
		id TEXT PRIMARY KEY,
		kpi_id TEXT NOT NULL,
		value REAL NOT NULL,
		entry_date DATE NOT NULL,
		comment TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (kpi_id) REFERENCES kpis(id)
	);`,
	`CREATE INDEX IF NOT EXISTS idx_initiatives_goal_id ON initiatives(goal_id);`,
	`CREATE INDEX IF NOT EXISTS idx_kpis_goal_id ON kpis(goal_id);`,
	`CREATE INDEX IF NOT EXISTS idx_kpis_initiative_id ON kpis(initiative_id);`,
	`CREATE INDEX IF NOT EXISTS idx_kpi_entries_kpi_id ON kpi_entries(kpi_id);`,
	`CREATE INDEX IF NOT EXISTS idx_kpi_entries_entry_date ON kpi_entries(entry_date);`,
	`CREATE INDEX IF NOT EXISTS idx_kpi_entries_kpi_id_entry_date ON kpi_entries(kpi_id, entry_date);`,
	`ALTER TABLE kpis ADD COLUMN successor_kpi_id TEXT REFERENCES kpis(id);`,
	`CREATE TABLE IF NOT EXISTS snapshots (
		id TEXT PRIMARY KEY,
		label TEXT NOT NULL,
		taken_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL
	);`,
	`CREATE TABLE IF NOT EXISTS snapshot_kpi_values (
		id TEXT PRIMARY KEY,
		snapshot_id TEXT NOT NULL,
		kpi_id TEXT NOT NULL,
		kpi_name TEXT NOT NULL,
		kpi_unit TEXT NOT NULL,
		kpi_custom_unit TEXT,
		kpi_target_value REAL NOT NULL,
		kpi_period_type TEXT NOT NULL,
		value_at_snapshot REAL NOT NULL,
		entries_count INTEGER NOT NULL,
		progress_pct REAL,
		is_tombstone BOOLEAN NOT NULL DEFAULT 0,
		FOREIGN KEY (snapshot_id) REFERENCES snapshots(id),
		FOREIGN KEY (kpi_id) REFERENCES kpis(id)
	);`,
}

// RunMigrations executes the migration array in order and records each statement fingerprint.
func RunMigrations(db *sql.DB) error {
	if _, err := db.Exec(migrations[0]); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	for i, stmt := range migrations[1:] {
		name := fmt.Sprintf("migration_%03d", i+1)

		var exists int
		err := db.QueryRow(`SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1`, name).Scan(&exists)
		if err == nil {
			continue
		}
		if err != sql.ErrNoRows {
			return fmt.Errorf("check migration %s: %w", name, err)
		}

		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("begin migration tx: %w", err)
		}

		if _, err := tx.Exec(stmt); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("execute %s: %w", name, err)
		}

		if _, err := tx.Exec(`INSERT INTO schema_migrations(name) VALUES(?)`, name); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("register %s: %w", name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit %s: %w", name, err)
		}
	}

	return nil
}
