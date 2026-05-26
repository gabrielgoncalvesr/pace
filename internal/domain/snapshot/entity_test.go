package snapshot_test

import (
	"testing"
	"time"

	"pace/internal/domain/snapshot"
)

func TestClassify_Monthly_Improved(t *testing.T) {
	a := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 3}
	b := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 5, EntriesCount: 2}
	got := snapshot.Classify(a, b)
	if got != snapshot.StatusImproved {
		t.Fatalf("want improved, got %s", got)
	}
}

func TestClassify_Monthly_Regressed(t *testing.T) {
	a := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 5}
	b := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 3, EntriesCount: 1}
	got := snapshot.Classify(a, b)
	if got != snapshot.StatusRegressed {
		t.Fatalf("want regressed, got %s", got)
	}
}

func TestClassify_Monthly_Stagnant(t *testing.T) {
	a := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 5}
	b := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 5, EntriesCount: 0}
	got := snapshot.Classify(a, b)
	if got != snapshot.StatusStagnant {
		t.Fatalf("want stagnant, got %s", got)
	}
}

func TestClassify_Annual_InProgress(t *testing.T) {
	a := snapshot.SnapshotKPIValue{PeriodType: "annual", ProgressPct: floatPtr(37)}
	b := snapshot.SnapshotKPIValue{PeriodType: "annual", ProgressPct: floatPtr(62), EntriesCount: 1}
	got := snapshot.Classify(a, b)
	if got != snapshot.StatusImproved {
		t.Fatalf("want improved, got %s", got)
	}
}

func TestClassify_Completed(t *testing.T) {
	a := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 8}
	b := snapshot.SnapshotKPIValue{PeriodType: "monthly", ValueAtSnapshot: 10, ProgressPct: floatPtr(100), EntriesCount: 2}
	got := snapshot.Classify(a, b)
	if got != snapshot.StatusCompleted {
		t.Fatalf("want completed, got %s", got)
	}
}

func floatPtr(f float64) *float64 { return &f }

func TestSnapshotNew(t *testing.T) {
	now := time.Now()
	s := snapshot.New("Abril 2026", "test-id", now)
	if s.ID != "test-id" || s.Label != "Abril 2026" {
		t.Fatalf("unexpected snapshot: %+v", s)
	}
}
