package goal

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	domain "pace/internal/domain/goal"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	Title       string
	Description string
}

type UpdateInput struct {
	Title       string
	Description string
	Status      string
}

func (s *Service) Create(input CreateInput) (*domain.Goal, error) {
	g, err := domain.New(input.Title, input.Description, time.Now(), uuid.NewString())
	if err != nil {
		return nil, err
	}
	if err := s.repo.Create(g); err != nil {
		return nil, err
	}
	return g, nil
}

func (s *Service) Update(id string, input UpdateInput) (*domain.Goal, error) {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("title is required")
	}

	g.Title = title
	g.Description = strings.TrimSpace(input.Description)
	if input.Status != "" {
		g.Status = domain.Status(input.Status)
	}
	g.UpdatedAt = time.Now()

	if err := s.repo.Update(g); err != nil {
		return nil, err
	}

	return g, nil
}

func (s *Service) Archive(id string) error {
	return s.repo.Archive(id)
}

func (s *Service) List() ([]domain.Goal, error) {
	return s.repo.List()
}

func (s *Service) Get(id string) (*domain.Goal, error) {
	return s.repo.GetByID(id)
}
