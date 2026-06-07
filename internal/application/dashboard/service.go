package dashboard

import (
	"errors"
	"time"

	"pace/internal/domain/kpi"
)

type KPIRepository interface {
	GetByID(id string) (*kpi.KPI, error)
	List() ([]kpi.KPI, error)
}

type EntryAggregator interface {
	SumByKPIAndDateRange(kpiID string, start, end time.Time) (float64, error)
}

type Service struct {
	kpis    KPIRepository
	entries EntryAggregator
}

func NewService(kpis KPIRepository, entries EntryAggregator) *Service {
	return &Service{kpis: kpis, entries: entries}
}

type Summary struct {
	TotalKPIs      int
	ActiveKPIs     int
	CompletedKPIs  int
	OverallPercent float64
}

func (s *Service) GetKPIProgress(kpiID string) (*kpi.Progress, error) {
	item, err := s.kpis.GetByID(kpiID)
	if err != nil {
		return nil, err
	}
	return s.calculateProgress(item)
}

func (s *Service) GetSummary() (*Summary, error) {
	items, err := s.kpis.List()
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return &Summary{}, nil
	}

	summary := &Summary{TotalKPIs: len(items)}
	progressSum := 0.0

	for i := range items {
		p, err := s.calculateProgress(&items[i])
		if err != nil {
			return nil, err
		}
		progressSum += p.VisualPercentage
		if items[i].Status == kpi.StatusActive {
			summary.ActiveKPIs++
		}
		if p.IsCompleted {
			summary.CompletedKPIs++
		}
	}

	summary.OverallPercent = progressSum / float64(len(items))
	return summary, nil
}

func (s *Service) calculateProgress(item *kpi.KPI) (*kpi.Progress, error) {
	if item.TargetValue <= 0 {
		return nil, errors.New("target_value must be greater than zero")
	}
	start, end := resolvePeriod(item.PeriodType, time.Now())
	current, err := s.entries.SumByKPIAndDateRange(item.ID, start, end)
	if err != nil {
		return nil, err
	}
	percentage := (current / item.TargetValue) * 100
	visual := percentage
	if visual > 100 {
		visual = 100
	}
	if visual < 0 {
		visual = 0
	}

	status := progressStatus(percentage)
	return &kpi.Progress{
		KPIID:             item.ID,
		CurrentValue:      current,
		TargetValue:       item.TargetValue,
		Percentage:        percentage,
		VisualPercentage:  visual,
		ProgressStatus:    status,
		IsCompleted:       percentage >= 100,
		HasExceededTarget: percentage > 100,
	}, nil
}

func resolvePeriod(periodType kpi.PeriodType, now time.Time) (time.Time, time.Time) {
	loc := now.Location()
	y, m, d := now.In(loc).Date()
	switch periodType {
	case kpi.PeriodDaily:
		start := time.Date(y, m, d, 0, 0, 0, 0, loc)
		end := time.Date(y, m, d, 23, 59, 59, int(time.Second-time.Nanosecond), loc)
		return start, end
	case kpi.PeriodWeekly:
		wd := int(now.Weekday())
		if wd == 0 {
			wd = 7
		}
		start := time.Date(y, m, d-(wd-1), 0, 0, 0, 0, loc)
		end := start.AddDate(0, 0, 6).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		return start, end
	case kpi.PeriodAnnual:
		start := time.Date(y, time.January, 1, 0, 0, 0, 0, loc)
		end := time.Date(y, time.December, 31, 23, 59, 59, int(time.Second-time.Nanosecond), loc)
		return start, end
	case kpi.PeriodPunctual:
		return time.Time{}, now
	case kpi.PeriodCustom:
		fallthrough
	case kpi.PeriodMonthly:
		start := time.Date(y, m, 1, 0, 0, 0, 0, loc)
		end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
		return start, end
	default:
		start := time.Date(y, m, 1, 0, 0, 0, 0, loc)
		end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
		return start, end
	}
}

func progressStatus(p float64) string {
	switch {
	case p <= 0:
		return "not_started"
	case p < 40:
		return "in_progress_low"
	case p < 70:
		return "in_progress"
	case p < 100:
		return "almost_done"
	case p == 100:
		return "completed"
	default:
		return "exceeded"
	}
}
