package kpi

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	domain "pace/internal/domain/kpi"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	GoalID            string
	InitiativeID      string
	Name              string
	Description       string
	Unit              string
	CustomUnit        string
	TargetValue       float64
	PeriodType        string
	AllowExceedTarget bool
}

type UpdateInput struct {
	Name              string
	Description       string
	Unit              string
	CustomUnit        string
	TargetValue       float64
	PeriodType        string
	AllowExceedTarget bool
	Status            string
}

func (s *Service) Create(input CreateInput) (*domain.KPI, error) {
	item, err := domain.New(domain.CreateInput{
		GoalID:            input.GoalID,
		InitiativeID:      input.InitiativeID,
		Name:              input.Name,
		Description:       input.Description,
		Unit:              domain.Unit(strings.TrimSpace(input.Unit)),
		CustomUnit:        input.CustomUnit,
		TargetValue:       input.TargetValue,
		PeriodType:        domain.PeriodType(strings.TrimSpace(input.PeriodType)),
		AllowExceedTarget: input.AllowExceedTarget,
	}, uuid.NewString(), time.Now())
	if err != nil {
		return nil, err
	}
	if err := s.repo.Create(item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) Update(id string, input UpdateInput) (*domain.KPI, error) {
	item, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("name is required")
	}
	if input.TargetValue <= 0 {
		return nil, errors.New("target_value must be greater than zero")
	}

	item.Name = strings.TrimSpace(input.Name)
	item.Description = strings.TrimSpace(input.Description)
	item.Unit = domain.Unit(strings.TrimSpace(input.Unit))
	item.CustomUnit = strings.TrimSpace(input.CustomUnit)
	item.TargetValue = input.TargetValue
	item.PeriodType = domain.PeriodType(strings.TrimSpace(input.PeriodType))
	item.AllowExceedTarget = input.AllowExceedTarget
	if input.Status != "" {
		item.Status = domain.Status(strings.TrimSpace(input.Status))
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

func (s *Service) Unarchive(id string) error {
	return s.repo.Unarchive(id)
}

func (s *Service) Delete(id string) error {
	return s.repo.Delete(id)
}

func (s *Service) List() ([]domain.KPI, error) {
	return s.repo.List()
}

func (s *Service) ListByGoal(goalID string) ([]domain.KPI, error) {
	if strings.TrimSpace(goalID) == "" {
		return nil, errors.New("goal_id is required")
	}
	return s.repo.ListByGoal(goalID)
}
