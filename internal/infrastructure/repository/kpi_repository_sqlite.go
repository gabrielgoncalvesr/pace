package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"pace/internal/domain/kpi"
)

type KPISQLiteRepository struct {
	db *sql.DB
}

func NewKPISQLiteRepository(db *sql.DB) *KPISQLiteRepository {
	return &KPISQLiteRepository{db: db}
}

func (r *KPISQLiteRepository) Create(item *kpi.KPI) error {
	_, err := r.db.Exec(`
		INSERT INTO kpis (
			id, goal_id, initiative_id, name, description, unit, custom_unit,
			target_value, period_type, allow_exceed_target, status, created_at, updated_at, archived_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item.ID, item.GoalID, item.InitiativeID, item.Name, item.Description, string(item.Unit), item.CustomUnit,
		item.TargetValue, string(item.PeriodType), item.AllowExceedTarget, string(item.Status), item.CreatedAt, item.UpdatedAt, item.ArchivedAt)
	if err != nil {
		return fmt.Errorf("insert kpi: %w", err)
	}
	return nil
}

func (r *KPISQLiteRepository) Update(item *kpi.KPI) error {
	res, err := r.db.Exec(`
		UPDATE kpis
		SET name = ?, description = ?, unit = ?, custom_unit = ?, target_value = ?, period_type = ?, allow_exceed_target = ?,
			status = ?, updated_at = ?, archived_at = ?
		WHERE id = ?
	`, item.Name, item.Description, string(item.Unit), item.CustomUnit, item.TargetValue, string(item.PeriodType),
		item.AllowExceedTarget, string(item.Status), item.UpdatedAt, item.ArchivedAt, item.ID)
	if err != nil {
		return fmt.Errorf("update kpi: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("kpi not found")
	}
	return nil
}

func (r *KPISQLiteRepository) Unarchive(id string) error {
	res, err := r.db.Exec(`
		UPDATE kpis
		SET status = 'active', updated_at = ?, archived_at = NULL
		WHERE id = ?
	`, time.Now(), id)
	if err != nil {
		return fmt.Errorf("unarchive kpi: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("kpi not found")
	}
	return nil
}

func (r *KPISQLiteRepository) Archive(id string) error {
	now := time.Now()
	res, err := r.db.Exec(`
		UPDATE kpis
		SET status = ?, updated_at = ?, archived_at = ?
		WHERE id = ?
	`, string(kpi.StatusArchived), now, now, id)
	if err != nil {
		return fmt.Errorf("archive kpi: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("kpi not found")
	}
	return nil
}

func (r *KPISQLiteRepository) Delete(id string) error {
	res, err := r.db.Exec(`DELETE FROM kpis WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete kpi: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("kpi not found")
	}
	return nil
}

func (r *KPISQLiteRepository) GetByID(id string) (*kpi.KPI, error) {
	row := r.db.QueryRow(`
		SELECT id, goal_id, initiative_id, name, description, unit, custom_unit,
			target_value, period_type, allow_exceed_target, status, created_at, updated_at, archived_at
		FROM kpis WHERE id = ?
	`, id)
	item, err := scanKPI(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("kpi not found")
		}
		return nil, fmt.Errorf("query kpi: %w", err)
	}
	return item, nil
}

func (r *KPISQLiteRepository) List() ([]kpi.KPI, error) {
	rows, err := r.db.Query(`
		SELECT id, goal_id, initiative_id, name, description, unit, custom_unit,
			target_value, period_type, allow_exceed_target, status, created_at, updated_at, archived_at
		FROM kpis ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list kpis: %w", err)
	}
	defer rows.Close()
	return collectKPIs(rows)
}

func (r *KPISQLiteRepository) ListByGoal(goalID string) ([]kpi.KPI, error) {
	rows, err := r.db.Query(`
		SELECT id, goal_id, initiative_id, name, description, unit, custom_unit,
			target_value, period_type, allow_exceed_target, status, created_at, updated_at, archived_at
		FROM kpis WHERE goal_id = ? ORDER BY created_at DESC
	`, goalID)
	if err != nil {
		return nil, fmt.Errorf("list kpis by goal: %w", err)
	}
	defer rows.Close()
	return collectKPIs(rows)
}

// ListAll returns all KPIs including archived ones (needed for snapshot capture).
func (r *KPISQLiteRepository) ListAll() ([]kpi.KPI, error) {
	rows, err := r.db.Query(`
		SELECT id, goal_id, initiative_id, name, description, unit, custom_unit,
			target_value, period_type, allow_exceed_target, status, created_at, updated_at, archived_at
		FROM kpis ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list all kpis: %w", err)
	}
	defer rows.Close()
	return collectKPIs(rows)
}

func (r *KPISQLiteRepository) SetSuccessor(kpiID, successorID string) error {
	res, err := r.db.Exec(`UPDATE kpis SET successor_kpi_id = ? WHERE id = ?`, successorID, kpiID)
	if err != nil {
		return fmt.Errorf("set successor: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return errors.New("kpi not found")
	}
	return nil
}

func collectKPIs(rows *sql.Rows) ([]kpi.KPI, error) {
	items := make([]kpi.KPI, 0)
	for rows.Next() {
		item, err := scanKPI(rows)
		if err != nil {
			return nil, fmt.Errorf("scan kpi: %w", err)
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate kpis: %w", err)
	}
	return items, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanKPI(s scanner) (*kpi.KPI, error) {
	var item kpi.KPI
	var unit, period, status string
	if err := s.Scan(
		&item.ID, &item.GoalID, &item.InitiativeID, &item.Name, &item.Description, &unit, &item.CustomUnit,
		&item.TargetValue, &period, &item.AllowExceedTarget, &status, &item.CreatedAt, &item.UpdatedAt, &item.ArchivedAt,
	); err != nil {
		return nil, err
	}
	item.Unit = kpi.Unit(unit)
	item.PeriodType = kpi.PeriodType(period)
	item.Status = kpi.Status(status)
	return &item, nil
}
