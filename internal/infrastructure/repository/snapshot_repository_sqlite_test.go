package repository_test

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	domain "pace/internal/domain/snapshot"
	"pace/internal/infrastructure/database"
	"pace/internal/infrastructure/repository"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := database.RunMigrations(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func seedKPI(t *testing.T, db *sql.DB) string {
	t.Helper()
	_, _ = db.Exec(`INSERT INTO goals (id, title, status, created_at, updated_at) VALUES ('goal-1','Test','active',?,?)`, time.Now(), time.Now())
	id := "kpi-test-1"
	_, err := db.Exec(`INSERT INTO kpis (id, goal_id, name, description, unit, custom_unit, target_value, period_type, allow_exceed_target, status, created_at, updated_at)
		VALUES (?, 'goal-1', 'Livros', '', 'book', '', 8, 'annual', 1, 'active', ?, ?)`,
		id, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("seed kpi: %v", err)
	}
	return id
}

func TestSnapshotRepository_CreateAndList(t *testing.T) {
	db := newTestDB(t)
	kpiID := seedKPI(t, db)
	repo := repository.NewSnapshotSQLiteRepository(db)

	now := time.Now()
	pct := 37.5
	snap := domain.Snapshot{ID: "snap-1", Label: "Abril 2026", TakenAt: now, CreatedAt: now}
	vals := []domain.SnapshotKPIValue{{
		ID: "skv-1", SnapshotID: "snap-1", KPIID: kpiID,
		KPIName: "Livros", KPIUnit: "book", KPITargetValue: 8,
		PeriodType: "annual", ValueAtSnapshot: 3, EntriesCount: 3,
		ProgressPct: &pct, IsTombstone: false,
	}}

	if err := repo.Create(snap, vals); err != nil {
		t.Fatalf("create: %v", err)
	}

	list, err := repo.List()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 || list[0].Label != "Abril 2026" {
		t.Fatalf("unexpected list: %+v", list)
	}

	values, err := repo.GetValues("snap-1")
	if err != nil {
		t.Fatalf("get values: %v", err)
	}
	if len(values) != 1 || values[0].ValueAtSnapshot != 3 {
		t.Fatalf("unexpected values: %+v", values)
	}
}

func TestSnapshotRepository_GetLatestTakenAt(t *testing.T) {
	db := newTestDB(t)
	seedKPI(t, db)
	repo := repository.NewSnapshotSQLiteRepository(db)

	latest, err := repo.GetLatestTakenAt()
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if latest != nil {
		t.Fatalf("expected nil for empty db, got %v", latest)
	}

	now := time.Now()
	snap := domain.Snapshot{ID: "snap-1", Label: "Test", TakenAt: now, CreatedAt: now}
	_ = repo.Create(snap, nil)

	latest, err = repo.GetLatestTakenAt()
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if latest == nil {
		t.Fatal("expected non-nil after insert")
	}
}

func TestKPIRepo_ListAll(t *testing.T) {
	db := newTestDB(t)
	seedKPI(t, db)
	repo := repository.NewKPISQLiteRepository(db)
	kpis, err := repo.ListAll()
	if err != nil {
		t.Fatalf("ListAll: %v", err)
	}
	if len(kpis) != 1 {
		t.Fatalf("expected 1 kpi, got %d", len(kpis))
	}
}

func TestKPIRepo_SetSuccessor(t *testing.T) {
	db := newTestDB(t)
	id1 := seedKPI(t, db)
	_, _ = db.Exec(`INSERT INTO kpis (id, goal_id, name, description, unit, custom_unit, target_value, period_type, allow_exceed_target, status, created_at, updated_at)
		VALUES ('kpi-test-2', 'goal-1', 'Livros v2', '', 'book', '', 8, 'annual', 1, 'active', ?, ?)`, time.Now(), time.Now())
	repo := repository.NewKPISQLiteRepository(db)
	if err := repo.SetSuccessor(id1, "kpi-test-2"); err != nil {
		t.Fatalf("SetSuccessor: %v", err)
	}
}

func TestEntryRepo_SumEntriesBetween(t *testing.T) {
	db := newTestDB(t)
	kpiID := seedKPI(t, db)
	for i, val := range []float64{2, 3} {
		id := fmt.Sprintf("entry-%d", i)
		_, _ = db.Exec(`INSERT INTO kpi_entries (id, kpi_id, value, entry_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			id, kpiID, val, time.Now().Format("2006-01-02"), time.Now(), time.Now())
	}
	repo := repository.NewKPIEntrySQLiteRepository(db)
	sum, count, err := repo.SumEntriesBetween(kpiID, time.Now().Add(-24*time.Hour), time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("SumEntriesBetween: %v", err)
	}
	if sum != 5 || count != 2 {
		t.Fatalf("expected sum=5 count=2, got sum=%f count=%d", sum, count)
	}
}
