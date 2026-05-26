package repository

import (
	"database/sql"
	"fmt"
	"time"

	domain "pace/internal/domain/snapshot"
)

type SnapshotSQLiteRepository struct {
	db *sql.DB
}

func NewSnapshotSQLiteRepository(db *sql.DB) *SnapshotSQLiteRepository {
	return &SnapshotSQLiteRepository{db: db}
}

func (r *SnapshotSQLiteRepository) Create(s domain.Snapshot, values []domain.SnapshotKPIValue) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}

	_, err = tx.Exec(`INSERT INTO snapshots (id, label, taken_at, created_at) VALUES (?, ?, ?, ?)`,
		s.ID, s.Label, s.TakenAt, s.CreatedAt)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("insert snapshot: %w", err)
	}

	for _, v := range values {
		_, err = tx.Exec(`
			INSERT INTO snapshot_kpi_values
				(id, snapshot_id, kpi_id, kpi_name, kpi_unit, kpi_custom_unit, kpi_target_value,
				 kpi_period_type, value_at_snapshot, entries_count, progress_pct, is_tombstone)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			v.ID, v.SnapshotID, v.KPIID, v.KPIName, v.KPIUnit, v.KPICustomUnit, v.KPITargetValue,
			v.PeriodType, v.ValueAtSnapshot, v.EntriesCount, v.ProgressPct, v.IsTombstone)
		if err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("insert snapshot_kpi_value: %w", err)
		}
	}

	return tx.Commit()
}

func (r *SnapshotSQLiteRepository) List() ([]domain.Snapshot, error) {
	rows, err := r.db.Query(`SELECT id, label, taken_at, created_at FROM snapshots ORDER BY taken_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list snapshots: %w", err)
	}
	defer rows.Close()

	var result []domain.Snapshot
	for rows.Next() {
		var s domain.Snapshot
		if err := rows.Scan(&s.ID, &s.Label, &s.TakenAt, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan snapshot: %w", err)
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

func (r *SnapshotSQLiteRepository) GetValues(snapshotID string) ([]domain.SnapshotKPIValue, error) {
	rows, err := r.db.Query(`
		SELECT id, snapshot_id, kpi_id, kpi_name, kpi_unit, kpi_custom_unit, kpi_target_value,
		       kpi_period_type, value_at_snapshot, entries_count, progress_pct, is_tombstone
		FROM snapshot_kpi_values
		WHERE snapshot_id = ?`, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("get snapshot values: %w", err)
	}
	defer rows.Close()

	var result []domain.SnapshotKPIValue
	for rows.Next() {
		var v domain.SnapshotKPIValue
		if err := rows.Scan(
			&v.ID, &v.SnapshotID, &v.KPIID, &v.KPIName, &v.KPIUnit, &v.KPICustomUnit,
			&v.KPITargetValue, &v.PeriodType, &v.ValueAtSnapshot, &v.EntriesCount,
			&v.ProgressPct, &v.IsTombstone,
		); err != nil {
			return nil, fmt.Errorf("scan snapshot value: %w", err)
		}
		result = append(result, v)
	}
	return result, rows.Err()
}

func (r *SnapshotSQLiteRepository) GetLatestTakenAt() (*time.Time, error) {
	var t time.Time
	err := r.db.QueryRow(`SELECT taken_at FROM snapshots ORDER BY taken_at DESC LIMIT 1`).Scan(&t)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get latest taken_at: %w", err)
	}
	return &t, nil
}
