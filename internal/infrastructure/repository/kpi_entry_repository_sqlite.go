package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"pace/internal/domain/kpi"
)

type KPIEntrySQLiteRepository struct {
	db *sql.DB
}

func NewKPIEntrySQLiteRepository(db *sql.DB) *KPIEntrySQLiteRepository {
	return &KPIEntrySQLiteRepository{db: db}
}

func (r *KPIEntrySQLiteRepository) Create(entry *kpi.KPIEntry) error {
	_, err := r.db.Exec(`
		INSERT INTO kpi_entries (id, kpi_id, value, entry_date, comment, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, entry.ID, entry.KPIID, entry.Value, entry.EntryDate.Format("2006-01-02"), entry.Comment, entry.CreatedAt, entry.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert kpi entry: %w", err)
	}
	return nil
}

func (r *KPIEntrySQLiteRepository) Update(entry *kpi.KPIEntry) error {
	res, err := r.db.Exec(`
		UPDATE kpi_entries
		SET value = ?, entry_date = ?, comment = ?, updated_at = ?
		WHERE id = ?
	`, entry.Value, entry.EntryDate.Format("2006-01-02"), entry.Comment, entry.UpdatedAt, entry.ID)
	if err != nil {
		return fmt.Errorf("update kpi entry: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("kpi entry not found")
	}
	return nil
}

func (r *KPIEntrySQLiteRepository) Delete(id string) error {
	res, err := r.db.Exec(`DELETE FROM kpi_entries WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete kpi entry: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("kpi entry not found")
	}
	return nil
}

func (r *KPIEntrySQLiteRepository) GetByID(id string) (*kpi.KPIEntry, error) {
	row := r.db.QueryRow(`
		SELECT id, kpi_id, value, entry_date, comment, created_at, updated_at
		FROM kpi_entries WHERE id = ?
	`, id)
	entry, err := scanEntry(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("kpi entry not found")
		}
		return nil, fmt.Errorf("query kpi entry: %w", err)
	}
	return entry, nil
}

func (r *KPIEntrySQLiteRepository) ListByKPI(kpiID string) ([]kpi.KPIEntry, error) {
	rows, err := r.db.Query(`
		SELECT id, kpi_id, value, entry_date, comment, created_at, updated_at
		FROM kpi_entries
		WHERE kpi_id = ?
		ORDER BY entry_date DESC, created_at DESC
	`, kpiID)
	if err != nil {
		return nil, fmt.Errorf("list kpi entries: %w", err)
	}
	defer rows.Close()

	items := make([]kpi.KPIEntry, 0)
	for rows.Next() {
		entry, err := scanEntry(rows)
		if err != nil {
			return nil, fmt.Errorf("scan kpi entry: %w", err)
		}
		items = append(items, *entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate kpi entries: %w", err)
	}
	return items, nil
}

func (r *KPIEntrySQLiteRepository) SumByKPIAndDateRange(kpiID string, start, end time.Time) (float64, error) {
	row := r.db.QueryRow(`
		SELECT COALESCE(SUM(value), 0)
		FROM kpi_entries
		WHERE kpi_id = ? AND entry_date BETWEEN ? AND ?
	`, kpiID, start.Format("2006-01-02"), end.Format("2006-01-02"))

	var total float64
	if err := row.Scan(&total); err != nil {
		return 0, fmt.Errorf("sum kpi entries: %w", err)
	}
	return total, nil
}

func (r *KPIEntrySQLiteRepository) SumEntriesBetween(kpiID string, from, to time.Time) (float64, int, error) {
	var sum float64
	var count int
	err := r.db.QueryRow(`
		SELECT COALESCE(SUM(value), 0), COUNT(*)
		FROM kpi_entries
		WHERE kpi_id = ? AND entry_date >= ? AND entry_date <= ?`,
		kpiID, from.Format("2006-01-02"), to.Format("2006-01-02")).Scan(&sum, &count)
	if err != nil {
		return 0, 0, fmt.Errorf("sum entries between: %w", err)
	}
	return sum, count, nil
}

func scanEntry(s scanner) (*kpi.KPIEntry, error) {
	var entry kpi.KPIEntry
	if err := s.Scan(&entry.ID, &entry.KPIID, &entry.Value, &entry.EntryDate, &entry.Comment, &entry.CreatedAt, &entry.UpdatedAt); err != nil {
		return nil, err
	}
	return &entry, nil
}
