package initiative

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	domain "pace/internal/domain/initiative"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	GoalID      string
	Title       string
	Description string
}

type UpdateInput struct {
	Title       string
	Description string
	Status      string
}

func (s *Service) Create(input CreateInput) (*domain.Initiative, error) {
	item, err := domain.New(input.GoalID, input.Title, input.Description, uuid.NewString(), time.Now())
	if err != nil {
		return nil, err
	}
	if err := s.repo.Create(item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) Update(id string, input UpdateInput) (*domain.Initiative, error) {
	item, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Title) == "" {
		return nil, errors.New("title is required")
	}
	item.Title = strings.TrimSpace(input.Title)
	item.Description = strings.TrimSpace(input.Description)
	if input.Status != "" {
		item.Status = domain.Status(input.Status)
	}
	item.UpdatedAt = time.Now()

	if err := s.repo.Update(item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) Archive(id string) error {
	return s.repo.Archive(id)
}

func (s *Service) ListByGoal(goalID string) ([]domain.Initiative, error) {
	if strings.TrimSpace(goalID) == "" {
		return nil, errors.New("goal_id is required")
	}
	return s.repo.ListByGoal(goalID)
}
