package dashboard

import (
	"testing"
	"time"

	"pace/internal/domain/kpi"
)

type fakeKPIRepo struct {
	items map[string]*kpi.KPI
	list  []kpi.KPI
}

func (f *fakeKPIRepo) GetByID(id string) (*kpi.KPI, error) { return f.items[id], nil }
func (f *fakeKPIRepo) List() ([]kpi.KPI, error)            { return f.list, nil }

type fakeEntryAgg struct{ sums map[string]float64 }

func (f *fakeEntryAgg) SumByKPIAndDateRange(kpiID string, start, end time.Time) (float64, error) {
	return f.sums[kpiID], nil
}

func TestProgressStatus(t *testing.T) {
	cases := []struct {
		p    float64
		want string
	}{
		{0, "not_started"},
		{10, "in_progress_low"},
		{50, "in_progress"},
		{80, "almost_done"},
		{100, "completed"},
		{120, "exceeded"},
	}
	for _, tc := range cases {
		if got := progressStatus(tc.p); got != tc.want {
			t.Fatalf("progressStatus(%v) = %s, want %s", tc.p, got, tc.want)
		}
	}
}

func TestResolvePeriodMonthly(t *testing.T) {
	now := time.Date(2026, 5, 19, 10, 0, 0, 0, time.UTC)
	start, end := resolvePeriod(kpi.PeriodMonthly, now)
	if start.Day() != 1 || start.Month() != time.May || start.Year() != 2026 {
		t.Fatalf("unexpected start: %v", start)
	}
	if end.Day() != 31 || end.Month() != time.May || end.Year() != 2026 {
		t.Fatalf("unexpected end: %v", end)
	}
}

func TestGetKPIProgress(t *testing.T) {
	k := &kpi.KPI{ID: "k1", TargetValue: 10, PeriodType: kpi.PeriodMonthly, CreatedAt: time.Now()}
	svc := NewService(&fakeKPIRepo{items: map[string]*kpi.KPI{"k1": k}}, &fakeEntryAgg{sums: map[string]float64{"k1": 7}})

	p, err := svc.GetKPIProgress("k1")
	if err != nil {
		t.Fatalf("GetKPIProgress error: %v", err)
	}
	if p.CurrentValue != 7 || p.TargetValue != 10 {
		t.Fatalf("unexpected values: %+v", p)
	}
	if p.ProgressStatus != "almost_done" {
		t.Fatalf("unexpected status: %s", p.ProgressStatus)
	}
}

func TestGetSummary(t *testing.T) {
	items := []kpi.KPI{
		{ID: "k1", TargetValue: 10, Status: kpi.StatusActive, PeriodType: kpi.PeriodMonthly, CreatedAt: time.Now()},
		{ID: "k2", TargetValue: 10, Status: kpi.StatusActive, PeriodType: kpi.PeriodMonthly, CreatedAt: time.Now()},
	}
	repo := &fakeKPIRepo{list: items, items: map[string]*kpi.KPI{"k1": &items[0], "k2": &items[1]}}
	agg := &fakeEntryAgg{sums: map[string]float64{"k1": 10, "k2": 5}}
	svc := NewService(repo, agg)

	s, err := svc.GetSummary()
	if err != nil {
		t.Fatalf("GetSummary error: %v", err)
	}
	if s.TotalKPIs != 2 || s.ActiveKPIs != 2 || s.CompletedKPIs != 1 {
		t.Fatalf("unexpected summary: %+v", s)
	}
}
