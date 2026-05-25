package kpi

import (
	"errors"
	"strings"
	"time"
)

type Status string

type Unit string

type PeriodType string

const (
	StatusActive    Status = "active"
	StatusPaused    Status = "paused"
	StatusCompleted Status = "completed"
	StatusArchived  Status = "archived"
)

const (
	UnitClass   Unit = "class"
	UnitText    Unit = "text"
	UnitMinute  Unit = "minute"
	UnitHour    Unit = "hour"
	UnitDay     Unit = "day"
	UnitArticle Unit = "article"
	UnitBook    Unit = "book"
	UnitMoney   Unit = "money"
	UnitStep    Unit = "step"
	UnitCustom  Unit = "custom"
)

const (
	PeriodDaily    PeriodType = "daily"
	PeriodWeekly   PeriodType = "weekly"
	PeriodMonthly  PeriodType = "monthly"
	PeriodAnnual   PeriodType = "annual"
	PeriodPunctual PeriodType = "punctual"
	PeriodCustom   PeriodType = "custom"
)

type KPI struct {
	ID                string
	GoalID            string
	InitiativeID      *string
	Name              string
	Description       string
	Unit              Unit
	CustomUnit        string
	TargetValue       float64
	PeriodType        PeriodType
	AllowExceedTarget bool
	Status            Status
	CreatedAt         time.Time
	UpdatedAt         time.Time
	ArchivedAt        *time.Time
}

func New(input CreateInput, id string, now time.Time) (*KPI, error) {
	if strings.TrimSpace(input.GoalID) == "" {
		return nil, errors.New("goal_id is required")
	}
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("name is required")
	}
	if input.TargetValue <= 0 {
		return nil, errors.New("target_value must be greater than zero")
	}
	if strings.TrimSpace(string(input.Unit)) == "" {
		return nil, errors.New("unit is required")
	}
	if strings.TrimSpace(string(input.PeriodType)) == "" {
		return nil, errors.New("period_type is required")
	}

	var initiativeID *string
	if strings.TrimSpace(input.InitiativeID) != "" {
		v := strings.TrimSpace(input.InitiativeID)
		initiativeID = &v
	}

	return &KPI{
		ID:                id,
		GoalID:            strings.TrimSpace(input.GoalID),
		InitiativeID:      initiativeID,
		Name:              strings.TrimSpace(input.Name),
		Description:       strings.TrimSpace(input.Description),
		Unit:              input.Unit,
		CustomUnit:        strings.TrimSpace(input.CustomUnit),
		TargetValue:       input.TargetValue,
		PeriodType:        input.PeriodType,
		AllowExceedTarget: input.AllowExceedTarget,
		Status:            StatusActive,
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

type CreateInput struct {
	GoalID            string
	InitiativeID      string
	Name              string
	Description       string
	Unit              Unit
	CustomUnit        string
	TargetValue       float64
	PeriodType        PeriodType
	AllowExceedTarget bool
}
