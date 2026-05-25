package kpi

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	domain "pace/internal/domain/kpi"
)

type EntryRepository interface {
	Create(entry *domain.KPIEntry) error
	Update(entry *domain.KPIEntry) error
	Delete(id string) error
	GetByID(id string) (*domain.KPIEntry, error)
	ListByKPI(kpiID string) ([]domain.KPIEntry, error)
}

type EntryService struct {
	repo EntryRepository
}

func NewEntryService(repo EntryRepository) *EntryService {
	return &EntryService{repo: repo}
}

type RegisterEntryInput struct {
	KPIID     string
	Value     float64
	EntryDate string
	Comment   string
}

type UpdateEntryInput struct {
	Value     float64
	EntryDate string
	Comment   string
}

func (s *EntryService) Register(input RegisterEntryInput) (*domain.KPIEntry, error) {
	entryDate, err := parseDate(input.EntryDate)
	if err != nil {
		return nil, err
	}

	entry, err := domain.NewEntry(input.KPIID, input.Value, entryDate, input.Comment, uuid.NewString(), time.Now())
	if err != nil {
		return nil, err
	}
	if err := s.repo.Create(entry); err != nil {
		return nil, err
	}
	return entry, nil
}

func (s *EntryService) Update(id string, input UpdateEntryInput) (*domain.KPIEntry, error) {
	entry, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if input.Value <= 0 {
		return nil, errors.New("value must be greater than zero")
	}
	entryDate, err := parseDate(input.EntryDate)
	if err != nil {
		return nil, err
	}

	entry.Value = input.Value
	entry.EntryDate = entryDate
	entry.Comment = strings.TrimSpace(input.Comment)
	entry.UpdatedAt = time.Now()

	if err := s.repo.Update(entry); err != nil {
		return nil, err
	}
	return entry, nil
}

func (s *EntryService) Delete(id string) error {
	return s.repo.Delete(id)
}

func (s *EntryService) ListByKPI(kpiID string) ([]domain.KPIEntry, error) {
	if strings.TrimSpace(kpiID) == "" {
		return nil, errors.New("kpi_id is required")
	}
	return s.repo.ListByKPI(kpiID)
}

func parseDate(value string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Time{}, errors.New("entry_date is required")
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, errors.New("entry_date must be YYYY-MM-DD")
	}
	return parsed, nil
}
