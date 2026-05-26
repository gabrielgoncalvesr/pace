package snapshot_test

import (
	"testing"
	"time"

	appsnap "pace/internal/application/snapshot"
	domain "pace/internal/domain/snapshot"
	kpidomain "pace/internal/domain/kpi"
)

type fakeSnapshotRepo struct {
	created []domain.Snapshot
	values  []domain.SnapshotKPIValue
}

func (f *fakeSnapshotRepo) Create(s domain.Snapshot, vals []domain.SnapshotKPIValue) error {
	f.created = append(f.created, s)
	f.values = append(f.values, vals...)
	return nil
}
func (f *fakeSnapshotRepo) List() ([]domain.Snapshot, error) { return f.created, nil }
func (f *fakeSnapshotRepo) GetValues(id string) ([]domain.SnapshotKPIValue, error) {
	var out []domain.SnapshotKPIValue
	for _, v := range f.values {
		if v.SnapshotID == id {
			out = append(out, v)
		}
	}
	return out, nil
}
func (f *fakeSnapshotRepo) GetLatestTakenAt() (*time.Time, error) { return nil, nil }

type fakeKPIRepo struct{ kpis []kpidomain.KPI }

func (f *fakeKPIRepo) ListAll() ([]kpidomain.KPI, error) { return f.kpis, nil }
func (f *fakeKPIRepo) SetSuccessor(kpiID, successorID string) error { return nil }

type fakeEntryRepo struct{}

func (f *fakeEntryRepo) SumEntriesBetween(kpiID string, from, to time.Time) (float64, int, error) {
	return 5.0, 3, nil
}

func TestCreateSnapshot_StoresValues(t *testing.T) {
	snapRepo := &fakeSnapshotRepo{}
	kpiRepo := &fakeKPIRepo{kpis: []kpidomain.KPI{
		{ID: "k1", Name: "Livros lidos", Unit: "book", TargetValue: 8, PeriodType: "annual", Status: "active"},
	}}
	entryRepo := &fakeEntryRepo{}

	svc := appsnap.NewService(snapRepo, kpiRepo, entryRepo)
	snap, err := svc.Create("Abril 2026")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if snap.Label != "Abril 2026" {
		t.Fatalf("wrong label: %s", snap.Label)
	}
	if len(snapRepo.values) != 1 {
		t.Fatalf("expected 1 kpi value stored, got %d", len(snapRepo.values))
	}
	if snapRepo.values[0].ValueAtSnapshot != 5.0 {
		t.Fatalf("expected value 5.0, got %f", snapRepo.values[0].ValueAtSnapshot)
	}
}
