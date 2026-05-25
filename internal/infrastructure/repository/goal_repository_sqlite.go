package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"pace/internal/domain/goal"
)

type GoalSQLiteRepository struct {
	db *sql.DB
}

func NewGoalSQLiteRepository(db *sql.DB) *GoalSQLiteRepository {
	return &GoalSQLiteRepository{db: db}
}

func (r *GoalSQLiteRepository) Create(g *goal.Goal) error {
	_, err := r.db.Exec(`
		INSERT INTO goals (id, title, description, status, created_at, updated_at, archived_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, g.ID, g.Title, g.Description, string(g.Status), g.CreatedAt, g.UpdatedAt, g.ArchivedAt)
	if err != nil {
		return fmt.Errorf("insert goal: %w", err)
	}
	return nil
}

func (r *GoalSQLiteRepository) Update(g *goal.Goal) error {
	res, err := r.db.Exec(`
		UPDATE goals
		SET title = ?, description = ?, status = ?, updated_at = ?, archived_at = ?
		WHERE id = ?
	`, g.Title, g.Description, string(g.Status), g.UpdatedAt, g.ArchivedAt, g.ID)
	if err != nil {
		return fmt.Errorf("update goal: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("goal not found")
	}
	return nil
}

func (r *GoalSQLiteRepository) Archive(id string) error {
	now := time.Now()
	res, err := r.db.Exec(`
		UPDATE goals
		SET status = ?, updated_at = ?, archived_at = ?
		WHERE id = ?
	`, string(goal.StatusArchived), now, now, id)
	if err != nil {
		return fmt.Errorf("archive goal: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("goal not found")
	}
	return nil
}

func (r *GoalSQLiteRepository) GetByID(id string) (*goal.Goal, error) {
	row := r.db.QueryRow(`
		SELECT id, title, description, status, created_at, updated_at, archived_at
		FROM goals
		WHERE id = ?
	`, id)

	var g goal.Goal
	var status string
	if err := row.Scan(&g.ID, &g.Title, &g.Description, &status, &g.CreatedAt, &g.UpdatedAt, &g.ArchivedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("goal not found")
		}
		return nil, fmt.Errorf("query goal: %w", err)
	}
	g.Status = goal.Status(status)
	return &g, nil
}

func (r *GoalSQLiteRepository) List() ([]goal.Goal, error) {
	rows, err := r.db.Query(`
		SELECT id, title, description, status, created_at, updated_at, archived_at
		FROM goals
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list goals: %w", err)
	}
	defer rows.Close()

	result := make([]goal.Goal, 0)
	for rows.Next() {
		var g goal.Goal
		var status string
		if err := rows.Scan(&g.ID, &g.Title, &g.Description, &status, &g.CreatedAt, &g.UpdatedAt, &g.ArchivedAt); err != nil {
			return nil, fmt.Errorf("scan goal: %w", err)
		}
		g.Status = goal.Status(status)
		result = append(result, g)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate goals: %w", err)
	}

	return result, nil
}
