package initiative

import (
	"errors"
	"strings"
	"time"
)

type Status string

const (
	StatusActive   Status = "active"
	StatusPaused   Status = "paused"
	StatusArchived Status = "archived"
)

type Initiative struct {
	ID          string
	GoalID      string
	Title       string
	Description string
	Status      Status
	CreatedAt   time.Time
	UpdatedAt   time.Time
	ArchivedAt  *time.Time
}

func New(goalID, title, description, id string, now time.Time) (*Initiative, error) {
	if strings.TrimSpace(goalID) == "" {
		return nil, errors.New("goal_id is required")
	}
	if strings.TrimSpace(title) == "" {
		return nil, errors.New("title is required")
	}
	return &Initiative{
		ID:          id,
		GoalID:      strings.TrimSpace(goalID),
		Title:       strings.TrimSpace(title),
		Description: strings.TrimSpace(description),
		Status:      StatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}
