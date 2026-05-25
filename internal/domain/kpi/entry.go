package kpi

import (
	"errors"
	"strings"
	"time"
)

type KPIEntry struct {
	ID        string
	KPIID     string
	Value     float64
	EntryDate time.Time
	Comment   string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func NewEntry(kpiID string, value float64, entryDate time.Time, comment string, id string, now time.Time) (*KPIEntry, error) {
	if strings.TrimSpace(kpiID) == "" {
		return nil, errors.New("kpi_id is required")
	}
	if value <= 0 {
		return nil, errors.New("value must be greater than zero")
	}
	if entryDate.IsZero() {
		return nil, errors.New("entry_date is required")
	}

	return &KPIEntry{
		ID:        id,
		KPIID:     strings.TrimSpace(kpiID),
		Value:     value,
		EntryDate: entryDate,
		Comment:   strings.TrimSpace(comment),
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}
