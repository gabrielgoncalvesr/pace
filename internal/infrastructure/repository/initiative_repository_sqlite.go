package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"pace/internal/domain/initiative"
)

type InitiativeSQLiteRepository struct {
	db *sql.DB
}

func NewInitiativeSQLiteRepository(db *sql.DB) *InitiativeSQLiteRepository {
	return &InitiativeSQLiteRepository{db: db}
}

func (r *InitiativeSQLiteRepository) Create(i *initiative.Initiative) error {
	_, err := r.db.Exec(`
		INSERT INTO initiatives (id, goal_id, title, description, status, created_at, updated_at, archived_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, i.ID, i.GoalID, i.Title, i.Description, string(i.Status), i.CreatedAt, i.UpdatedAt, i.ArchivedAt)
	if err != nil {
		return fmt.Errorf("insert initiative: %w", err)
	}
	return nil
}

func (r *InitiativeSQLiteRepository) Update(i *initiative.Initiative) error {
	res, err := r.db.Exec(`
		UPDATE initiatives
		SET title = ?, description = ?, status = ?, updated_at = ?, archived_at = ?
		WHERE id = ?
	`, i.Title, i.Description, string(i.Status), i.UpdatedAt, i.ArchivedAt, i.ID)
	if err != nil {
		return fmt.Errorf("update initiative: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("initiative not found")
	}
	return nil
}

func (r *InitiativeSQLiteRepository) Archive(id string) error {
	now := time.Now()
	res, err := r.db.Exec(`
		UPDATE initiatives
		SET status = ?, updated_at = ?, archived_at = ?
		WHERE id = ?
	`, string(initiative.StatusArchived), now, now, id)
	if err != nil {
		return fmt.Errorf("archive initiative: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("initiative not found")
	}
	return nil
}

func (r *InitiativeSQLiteRepository) GetByID(id string) (*initiative.Initiative, error) {
	row := r.db.QueryRow(`
		SELECT id, goal_id, title, description, status, created_at, updated_at, archived_at
		FROM initiatives
		WHERE id = ?
	`, id)

	var item initiative.Initiative
	var status string
	if err := row.Scan(&item.ID, &item.GoalID, &item.Title, &item.Description, &status, &item.CreatedAt, &item.UpdatedAt, &item.ArchivedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("initiative not found")
		}
		return nil, fmt.Errorf("query initiative: %w", err)
	}
	item.Status = initiative.Status(status)
	return &item, nil
}

func (r *InitiativeSQLiteRepository) ListByGoal(goalID string) ([]initiative.Initiative, error) {
	rows, err := r.db.Query(`
		SELECT id, goal_id, title, description, status, created_at, updated_at, archived_at
		FROM initiatives
		WHERE goal_id = ?
		ORDER BY created_at DESC
	`, goalID)
	if err != nil {
		return nil, fmt.Errorf("list initiatives: %w", err)
	}
	defer rows.Close()

	items := make([]initiative.Initiative, 0)
	for rows.Next() {
		var item initiative.Initiative
		var status string
		if err := rows.Scan(&item.ID, &item.GoalID, &item.Title, &item.Description, &status, &item.CreatedAt, &item.UpdatedAt, &item.ArchivedAt); err != nil {
			return nil, fmt.Errorf("scan initiative: %w", err)
		}
		item.Status = initiative.Status(status)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate initiatives: %w", err)
	}
	return items, nil
}
