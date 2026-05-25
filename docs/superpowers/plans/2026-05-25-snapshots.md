# Snapshots (Cortes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a manual snapshot ("corte") system that captures KPI state at a point in time and allows comparing two snapshots to produce a structured insight report.

**Architecture:** New `snapshot` domain with its own entity, repository interface, application service, SQLite repository, and Wails bindings — following the same layered pattern as `kpi`. The frontend adds a `reviews` view to `App.tsx` with snapshot list + two-snapshot comparison UI.

**Tech Stack:** Go 1.25, SQLite (database/sql), Wails v2, React + TypeScript (no new deps needed)

**Spec:** `docs/superpowers/specs/2026-05-25-snapshots-design.md`

---

## File Map

**New files:**
- `internal/domain/snapshot/entity.go` — `Snapshot`, `SnapshotKPIValue`, `KPIComparison` types + comparison logic
- `internal/domain/snapshot/repository.go` — `Repository` interface
- `internal/application/snapshot/service.go` — `Service` with `Create`, `List`, `Compare`, `SetKPISuccessor`
- `internal/infrastructure/repository/snapshot_repository_sqlite.go` — SQLite implementation

**Modified files:**
- `internal/infrastructure/database/migrations.go` — 3 new migration entries (snapshots table, snapshot_kpi_values table, successor_kpi_id column)
- `app.go` — wire `snapshotService`, expose 4 Wails bindings
- `frontend/src/App.tsx` — add `reviews` view type, types, Wails calls, and Reviews UI

---

## Task 1: DB migrations

**Files:**
- Modify: `internal/infrastructure/database/migrations.go`

- [ ] **Step 1: Add 3 migration entries to the `migrations` slice**

Open `internal/infrastructure/database/migrations.go`. Append these three strings to the `migrations` slice (after the existing index entries):

```go
`ALTER TABLE kpis ADD COLUMN successor_kpi_id TEXT REFERENCES kpis(id);`,

`CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    taken_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL
);`,

`CREATE TABLE IF NOT EXISTS snapshot_kpi_values (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL,
    kpi_id TEXT NOT NULL,
    kpi_name TEXT NOT NULL,
    kpi_unit TEXT NOT NULL,
    kpi_custom_unit TEXT,
    kpi_target_value REAL NOT NULL,
    kpi_period_type TEXT NOT NULL,
    value_at_snapshot REAL NOT NULL,
    entries_count INTEGER NOT NULL,
    progress_pct REAL,
    is_tombstone BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id),
    FOREIGN KEY (kpi_id) REFERENCES kpis(id)
);`,
```

- [ ] **Step 2: Build to verify no compile errors**

```bash
cd /Users/gabriel/projects/pace && go build ./...
```
Expected: no output (clean build).

- [ ] **Step 3: Commit**

```bash
git add internal/infrastructure/database/migrations.go
git commit -m "feat(snapshot): add DB migrations for snapshots, snapshot_kpi_values, and successor_kpi_id"
```

---

## Task 2: Domain entities and comparison logic

**Files:**
- Create: `internal/domain/snapshot/entity.go`
- Create: `internal/domain/snapshot/repository.go`

- [ ] **Step 1: Write failing test for comparison logic**

Create `internal/domain/snapshot/entity_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/domain/snapshot/... 2>&1
```
Expected: `cannot find package` or compile error (package doesn't exist yet).

- [ ] **Step 3: Create entity.go**

Create `internal/domain/snapshot/entity.go`:

```go
package snapshot

import "time"

type ComparisonStatus string

const (
	StatusImproved  ComparisonStatus = "improved"
	StatusStagnant  ComparisonStatus = "stagnant"
	StatusRegressed ComparisonStatus = "regressed"
	StatusCompleted ComparisonStatus = "completed"
	StatusEnded     ComparisonStatus = "ended"
	StatusNew       ComparisonStatus = "new"
	StatusContinued ComparisonStatus = "continued"
)

type Snapshot struct {
	ID        string
	Label     string
	TakenAt   time.Time
	CreatedAt time.Time
}

type SnapshotKPIValue struct {
	ID              string
	SnapshotID      string
	KPIID           string
	KPIName         string
	KPIUnit         string
	KPICustomUnit   string
	KPITargetValue  float64
	PeriodType      string
	ValueAtSnapshot float64
	EntriesCount    int
	ProgressPct     *float64
	IsTombstone     bool
}

type KPIComparison struct {
	KPIID           string
	KPIName         string
	KPIUnit         string
	KPICustomUnit   string
	PeriodType      string
	ValueA          float64
	ValueB          float64
	Delta           float64
	ProgressA       *float64
	ProgressB       *float64
	EntriesInPeriod int
	Status          ComparisonStatus
	SuccessorKPIID  string
}

func New(label, id string, now time.Time) Snapshot {
	return Snapshot{ID: id, Label: label, TakenAt: now, CreatedAt: now}
}

// Classify determines the comparison status for a KPI between two snapshots.
// a is the older snapshot value, b is the newer.
func Classify(a, b SnapshotKPIValue) ComparisonStatus {
	if b.ProgressPct != nil && *b.ProgressPct >= 100 {
		return StatusCompleted
	}

	switch b.PeriodType {
	case "monthly":
		delta := b.ValueAtSnapshot - a.ValueAtSnapshot
		if delta > 0 {
			return StatusImproved
		}
		if delta < 0 {
			return StatusRegressed
		}
		return StatusStagnant

	default: // annual, punctual, daily, weekly, custom
		var progA, progB float64
		if a.ProgressPct != nil {
			progA = *a.ProgressPct
		}
		if b.ProgressPct != nil {
			progB = *b.ProgressPct
		}
		if progB > progA {
			return StatusImproved
		}
		if progB < progA {
			return StatusRegressed
		}
		if b.EntriesCount == 0 {
			return StatusStagnant
		}
		return StatusImproved
	}
}
```

- [ ] **Step 4: Create repository.go**

Create `internal/domain/snapshot/repository.go`:

```go
package snapshot

import "time"

type Repository interface {
	Create(s Snapshot, values []SnapshotKPIValue) error
	List() ([]Snapshot, error)
	GetValues(snapshotID string) ([]SnapshotKPIValue, error)
	GetLatestTakenAt() (*time.Time, error)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/domain/snapshot/... -v
```
Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add internal/domain/snapshot/
git commit -m "feat(snapshot): add domain entities, Classify logic, and repository interface"
```

---

## Task 3: Application service

**Files:**
- Create: `internal/application/snapshot/service.go`

- [ ] **Step 1: Write failing test**

Create `internal/application/snapshot/service_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/application/snapshot/... 2>&1
```
Expected: compile error — package doesn't exist yet.

- [ ] **Step 3: Create service.go**

Create `internal/application/snapshot/service.go`:

```go
package snapshot

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	domain "pace/internal/domain/snapshot"
	kpidomain "pace/internal/domain/kpi"
)

type SnapshotRepository interface {
	Create(s domain.Snapshot, values []domain.SnapshotKPIValue) error
	List() ([]domain.Snapshot, error)
	GetValues(snapshotID string) ([]domain.SnapshotKPIValue, error)
	GetLatestTakenAt() (*time.Time, error)
}

type KPIRepository interface {
	ListAll() ([]kpidomain.KPI, error)
	SetSuccessor(kpiID, successorID string) error
}

type EntryRepository interface {
	SumEntriesBetween(kpiID string, from, to time.Time) (float64, int, error)
}

type Service struct {
	snapRepo  SnapshotRepository
	kpiRepo   KPIRepository
	entryRepo EntryRepository
}

func NewService(snapRepo SnapshotRepository, kpiRepo KPIRepository, entryRepo EntryRepository) *Service {
	return &Service{snapRepo: snapRepo, kpiRepo: kpiRepo, entryRepo: entryRepo}
}

func (s *Service) Create(label string) (domain.Snapshot, error) {
	if strings.TrimSpace(label) == "" {
		return domain.Snapshot{}, errors.New("label is required")
	}

	now := time.Now()
	snap := domain.New(strings.TrimSpace(label), uuid.NewString(), now)

	prevTakenAt, err := s.snapRepo.GetLatestTakenAt()
	if err != nil {
		return domain.Snapshot{}, err
	}

	kpis, err := s.kpiRepo.ListAll()
	if err != nil {
		return domain.Snapshot{}, err
	}

	var values []domain.SnapshotKPIValue
	for _, k := range kpis {
		from := k.CreatedAt
		if prevTakenAt != nil {
			from = *prevTakenAt
		}

		sum, count, err := s.entryRepo.SumEntriesBetween(k.ID, from, now)
		if err != nil {
			return domain.Snapshot{}, err
		}

		var progressPct *float64
		if k.TargetValue > 0 {
			p := sum / k.TargetValue * 100
			progressPct = &p
		}

		values = append(values, domain.SnapshotKPIValue{
			ID:              uuid.NewString(),
			SnapshotID:      snap.ID,
			KPIID:           k.ID,
			KPIName:         k.Name,
			KPIUnit:         string(k.Unit),
			KPICustomUnit:   k.CustomUnit,
			KPITargetValue:  k.TargetValue,
			PeriodType:      string(k.PeriodType),
			ValueAtSnapshot: sum,
			EntriesCount:    count,
			ProgressPct:     progressPct,
			IsTombstone:     k.ArchivedAt != nil,
		})
	}

	if err := s.snapRepo.Create(snap, values); err != nil {
		return domain.Snapshot{}, err
	}
	return snap, nil
}

func (s *Service) List() ([]domain.Snapshot, error) {
	return s.snapRepo.List()
}

func (s *Service) Compare(snapshotAID, snapshotBID string) ([]domain.KPIComparison, error) {
	valuesA, err := s.snapRepo.GetValues(snapshotAID)
	if err != nil {
		return nil, err
	}
	valuesB, err := s.snapRepo.GetValues(snapshotBID)
	if err != nil {
		return nil, err
	}

	indexA := make(map[string]domain.SnapshotKPIValue, len(valuesA))
	for _, v := range valuesA {
		indexA[v.KPIID] = v
	}
	indexB := make(map[string]domain.SnapshotKPIValue, len(valuesB))
	for _, v := range valuesB {
		indexB[v.KPIID] = v
	}

	var result []domain.KPIComparison

	// KPIs in B
	for _, b := range valuesB {
		a, inA := indexA[b.KPIID]

		var status domain.ComparisonStatus
		var valueA float64
		var progressA *float64

		if b.IsTombstone && inA && !a.IsTombstone {
			status = domain.StatusEnded
		} else if !inA {
			status = domain.StatusNew
		} else {
			status = domain.Classify(a, b)
			valueA = a.ValueAtSnapshot
			progressA = a.ProgressPct
		}

		result = append(result, domain.KPIComparison{
			KPIID:           b.KPIID,
			KPIName:         b.KPIName,
			KPIUnit:         b.KPIUnit,
			KPICustomUnit:   b.KPICustomUnit,
			PeriodType:      b.PeriodType,
			ValueA:          valueA,
			ValueB:          b.ValueAtSnapshot,
			Delta:           b.ValueAtSnapshot - valueA,
			ProgressA:       progressA,
			ProgressB:       b.ProgressPct,
			EntriesInPeriod: b.EntriesCount,
			Status:          status,
		})
	}

	// KPIs in A but not in B (deleted, no tombstone in B)
	for _, a := range valuesA {
		if _, inB := indexB[a.KPIID]; !inB {
			result = append(result, domain.KPIComparison{
				KPIID:   a.KPIID,
				KPIName: a.KPIName,
				ValueA:  a.ValueAtSnapshot,
				Status:  domain.StatusEnded,
			})
		}
	}

	// Sort: completed > improved > stagnant > regressed > ended > new
	order := map[domain.ComparisonStatus]int{
		domain.StatusCompleted: 0,
		domain.StatusImproved:  1,
		domain.StatusContinued: 2,
		domain.StatusStagnant:  3,
		domain.StatusRegressed: 4,
		domain.StatusEnded:     5,
		domain.StatusNew:       6,
	}
	sortComparisons(result, order)

	return result, nil
}

func (s *Service) SetKPISuccessor(kpiID, successorID string) error {
	if kpiID == successorID {
		return errors.New("kpi cannot succeed itself")
	}
	return s.kpiRepo.SetSuccessor(kpiID, successorID)
}

func sortComparisons(items []domain.KPIComparison, order map[domain.ComparisonStatus]int) {
	for i := 1; i < len(items); i++ {
		for j := i; j > 0 && order[items[j].Status] < order[items[j-1].Status]; j-- {
			items[j], items[j-1] = items[j-1], items[j]
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/application/snapshot/... -v
```
Expected: `TestCreateSnapshot_StoresValues` PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/application/snapshot/
git commit -m "feat(snapshot): add application service with Create, List, Compare, SetKPISuccessor"
```

---

## Task 4: SQLite repository

**Files:**
- Create: `internal/infrastructure/repository/snapshot_repository_sqlite.go`

- [ ] **Step 1: Write failing test**

Create `internal/infrastructure/repository/snapshot_repository_sqlite_test.go`:

```go
package repository_test

import (
	"database/sql"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"

	domain "pace/internal/domain/snapshot"
	"pace/internal/infrastructure/database"
	"pace/internal/infrastructure/repository"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
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
	id := "kpi-test-1"
	_, err := db.Exec(`INSERT INTO kpis (id, goal_id, name, unit, target_value, period_type, allow_exceed_target, status, created_at, updated_at)
		VALUES (?, 'goal-1', 'Livros', 'book', 8, 'annual', 1, 'active', ?, ?)`,
		id, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("seed kpi: %v", err)
	}
	// seed goal too
	_, _ = db.Exec(`INSERT INTO goals (id, title, status, created_at, updated_at) VALUES ('goal-1','Test','active',?,?)`, time.Now(), time.Now())
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/infrastructure/repository/... -run TestSnapshot 2>&1
```
Expected: compile error — `NewSnapshotSQLiteRepository` not defined.

- [ ] **Step 3: Create snapshot_repository_sqlite.go**

Create `internal/infrastructure/repository/snapshot_repository_sqlite.go`:

```go
package repository

import (
	"database/sql"
	"fmt"
	"time"

	domain "pace/internal/domain/snapshot"
)

type SnapshotSQLiteRepository struct {
	db *sql.DB
}

func NewSnapshotSQLiteRepository(db *sql.DB) *SnapshotSQLiteRepository {
	return &SnapshotSQLiteRepository{db: db}
}

func (r *SnapshotSQLiteRepository) Create(s domain.Snapshot, values []domain.SnapshotKPIValue) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}

	_, err = tx.Exec(`INSERT INTO snapshots (id, label, taken_at, created_at) VALUES (?, ?, ?, ?)`,
		s.ID, s.Label, s.TakenAt, s.CreatedAt)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("insert snapshot: %w", err)
	}

	for _, v := range values {
		_, err = tx.Exec(`
			INSERT INTO snapshot_kpi_values
				(id, snapshot_id, kpi_id, kpi_name, kpi_unit, kpi_custom_unit, kpi_target_value,
				 kpi_period_type, value_at_snapshot, entries_count, progress_pct, is_tombstone)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			v.ID, v.SnapshotID, v.KPIID, v.KPIName, v.KPIUnit, v.KPICustomUnit, v.KPITargetValue,
			v.PeriodType, v.ValueAtSnapshot, v.EntriesCount, v.ProgressPct, v.IsTombstone)
		if err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("insert snapshot_kpi_value: %w", err)
		}
	}

	return tx.Commit()
}

func (r *SnapshotSQLiteRepository) List() ([]domain.Snapshot, error) {
	rows, err := r.db.Query(`SELECT id, label, taken_at, created_at FROM snapshots ORDER BY taken_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list snapshots: %w", err)
	}
	defer rows.Close()

	var result []domain.Snapshot
	for rows.Next() {
		var s domain.Snapshot
		if err := rows.Scan(&s.ID, &s.Label, &s.TakenAt, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan snapshot: %w", err)
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

func (r *SnapshotSQLiteRepository) GetValues(snapshotID string) ([]domain.SnapshotKPIValue, error) {
	rows, err := r.db.Query(`
		SELECT id, snapshot_id, kpi_id, kpi_name, kpi_unit, kpi_custom_unit, kpi_target_value,
		       kpi_period_type, value_at_snapshot, entries_count, progress_pct, is_tombstone
		FROM snapshot_kpi_values
		WHERE snapshot_id = ?`, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("get snapshot values: %w", err)
	}
	defer rows.Close()

	var result []domain.SnapshotKPIValue
	for rows.Next() {
		var v domain.SnapshotKPIValue
		if err := rows.Scan(
			&v.ID, &v.SnapshotID, &v.KPIID, &v.KPIName, &v.KPIUnit, &v.KPICustomUnit,
			&v.KPITargetValue, &v.PeriodType, &v.ValueAtSnapshot, &v.EntriesCount,
			&v.ProgressPct, &v.IsTombstone,
		); err != nil {
			return nil, fmt.Errorf("scan snapshot value: %w", err)
		}
		result = append(result, v)
	}
	return result, rows.Err()
}

func (r *SnapshotSQLiteRepository) GetLatestTakenAt() (*time.Time, error) {
	var t time.Time
	err := r.db.QueryRow(`SELECT taken_at FROM snapshots ORDER BY taken_at DESC LIMIT 1`).Scan(&t)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get latest taken_at: %w", err)
	}
	return &t, nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/infrastructure/repository/... -run TestSnapshot -v
```
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/infrastructure/repository/snapshot_repository_sqlite.go internal/infrastructure/repository/snapshot_repository_sqlite_test.go
git commit -m "feat(snapshot): add SQLite repository with Create, List, GetValues, GetLatestTakenAt"
```

---

## Task 5: Wire KPI repos to satisfy snapshot service interfaces

The snapshot service's `KPIRepository` interface needs `ListAll` and `SetSuccessor`. The snapshot service's `EntryRepository` needs `SumEntriesBetween`. These methods must be added to the existing SQLite repos.

**Files:**
- Modify: `internal/infrastructure/repository/kpi_repository_sqlite.go`
- Modify: `internal/infrastructure/repository/kpi_entry_repository_sqlite.go`

- [ ] **Step 1: Write failing tests**

Add to `internal/infrastructure/repository/snapshot_repository_sqlite_test.go`:

```go
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
	// seed second kpi
	_, _ = db.Exec(`INSERT INTO kpis (id, goal_id, name, unit, target_value, period_type, allow_exceed_target, status, created_at, updated_at)
		VALUES ('kpi-test-2', 'goal-1', 'Livros v2', 'book', 8, 'annual', 1, 'active', ?, ?)`, time.Now(), time.Now())
	repo := repository.NewKPISQLiteRepository(db)
	if err := repo.SetSuccessor(id1, "kpi-test-2"); err != nil {
		t.Fatalf("SetSuccessor: %v", err)
	}
}

func TestEntryRepo_SumEntriesBetween(t *testing.T) {
	db := newTestDB(t)
	kpiID := seedKPI(t, db)
	// seed entries
	for i, val := range []float64{2, 3} {
		id := fmt.Sprintf("entry-%d", i)
		_, _ = db.Exec(`INSERT INTO kpi_entries (id, kpi_id, value, entry_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			id, kpiID, val, time.Now(), time.Now(), time.Now())
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
```

Add `"fmt"` to imports in that test file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/infrastructure/repository/... -run "TestKPIRepo_ListAll|TestKPIRepo_SetSuccessor|TestEntryRepo_Sum" 2>&1
```
Expected: compile errors — methods not defined yet.

- [ ] **Step 3: Add ListAll and SetSuccessor to kpi_repository_sqlite.go**

Open `internal/infrastructure/repository/kpi_repository_sqlite.go`. The existing `List()` method only returns non-archived KPIs. Add these two methods at the end of the file:

```go
// ListAll returns all KPIs including archived ones (needed for snapshot capture).
func (r *KPISQLiteRepository) ListAll() ([]kpi.KPI, error) {
	rows, err := r.db.Query(`
		SELECT id, goal_id, initiative_id, name, description, unit, custom_unit,
		       target_value, period_type, allow_exceed_target, status, created_at, updated_at, archived_at
		FROM kpis
		ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("list all kpis: %w", err)
	}
	defer rows.Close()
	return scanKPIs(rows)
}

func (r *KPISQLiteRepository) SetSuccessor(kpiID, successorID string) error {
	res, err := r.db.Exec(`UPDATE kpis SET successor_kpi_id = ? WHERE id = ?`, successorID, kpiID)
	if err != nil {
		return fmt.Errorf("set successor: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("kpi not found")
	}
	return nil
}
```

Note: `scanKPIs` must be extracted from the existing `List()` method to avoid duplication. Look at the existing `List()` and extract the row-scanning loop into a private `scanKPIs(rows *sql.Rows) ([]kpi.KPI, error)` helper, then call it from both `List()` and `ListAll()`.

- [ ] **Step 4: Add SumEntriesBetween to kpi_entry_repository_sqlite.go**

Open `internal/infrastructure/repository/kpi_entry_repository_sqlite.go`. Add at the end:

```go
func (r *KPIEntrySQLiteRepository) SumEntriesBetween(kpiID string, from, to time.Time) (float64, int, error) {
	var sum float64
	var count int
	err := r.db.QueryRow(`
		SELECT COALESCE(SUM(value), 0), COUNT(*)
		FROM kpi_entries
		WHERE kpi_id = ? AND entry_date >= ? AND entry_date <= ?`,
		kpiID, from.Format("2006-01-02"), to.Format("2006-01-02")).Scan(&sum, &count)
	if err != nil {
		return 0, 0, fmt.Errorf("sum entries between: %w", err)
	}
	return sum, count, nil
}
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/gabriel/projects/pace && go test ./internal/... -v 2>&1 | tail -30
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add internal/infrastructure/repository/kpi_repository_sqlite.go internal/infrastructure/repository/kpi_entry_repository_sqlite.go internal/infrastructure/repository/snapshot_repository_sqlite_test.go
git commit -m "feat(snapshot): add ListAll, SetSuccessor, SumEntriesBetween to existing repos"
```

---

## Task 6: Wire into app.go and expose Wails bindings

**Files:**
- Modify: `app.go`

- [ ] **Step 1: Add snapshotService field and wire in startup()**

Open `app.go`. 

Add import:
```go
snapshotapp "pace/internal/application/snapshot"
```

Add field to `App` struct:
```go
snapshotService *snapshotapp.Service
```

In `startup()`, after the existing service wiring (after `a.dashboardService = ...`), add:

```go
a.snapshotService = snapshotapp.NewService(
    repository.NewSnapshotSQLiteRepository(db),
    kpiRepo,
    entryRepo,
)
```

- [ ] **Step 2: Add Wails-bound output types**

Add these types near the other output types in `app.go`:

```go
type SnapshotOutput struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	TakenAt   string `json:"takenAt"`
	CreatedAt string `json:"createdAt"`
}

type KPIComparisonOutput struct {
	KPIID           string   `json:"kpiId"`
	KPIName         string   `json:"kpiName"`
	KPIUnit         string   `json:"kpiUnit"`
	KPICustomUnit   string   `json:"kpiCustomUnit"`
	PeriodType      string   `json:"periodType"`
	ValueA          float64  `json:"valueA"`
	ValueB          float64  `json:"valueB"`
	Delta           float64  `json:"delta"`
	ProgressA       *float64 `json:"progressA"`
	ProgressB       *float64 `json:"progressB"`
	EntriesInPeriod int      `json:"entriesInPeriod"`
	Status          string   `json:"status"`
	SuccessorKPIID  string   `json:"successorKpiId"`
}
```

- [ ] **Step 3: Add the 4 Wails methods**

Add at the end of `app.go`:

```go
func (a *App) CreateSnapshot(label string) (*SnapshotOutput, error) {
	s, err := a.snapshotService.Create(label)
	if err != nil {
		return nil, err
	}
	return &SnapshotOutput{
		ID:        s.ID,
		Label:     s.Label,
		TakenAt:   s.TakenAt.Format(time.RFC3339),
		CreatedAt: s.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (a *App) ListSnapshots() ([]SnapshotOutput, error) {
	list, err := a.snapshotService.List()
	if err != nil {
		return nil, err
	}
	out := make([]SnapshotOutput, len(list))
	for i, s := range list {
		out[i] = SnapshotOutput{
			ID:        s.ID,
			Label:     s.Label,
			TakenAt:   s.TakenAt.Format(time.RFC3339),
			CreatedAt: s.CreatedAt.Format(time.RFC3339),
		}
	}
	return out, nil
}

func (a *App) CompareSnapshots(snapshotAID, snapshotBID string) ([]KPIComparisonOutput, error) {
	comparisons, err := a.snapshotService.Compare(snapshotAID, snapshotBID)
	if err != nil {
		return nil, err
	}
	out := make([]KPIComparisonOutput, len(comparisons))
	for i, c := range comparisons {
		out[i] = KPIComparisonOutput{
			KPIID:           c.KPIID,
			KPIName:         c.KPIName,
			KPIUnit:         c.KPIUnit,
			KPICustomUnit:   c.KPICustomUnit,
			PeriodType:      c.PeriodType,
			ValueA:          c.ValueA,
			ValueB:          c.ValueB,
			Delta:           c.Delta,
			ProgressA:       c.ProgressA,
			ProgressB:       c.ProgressB,
			EntriesInPeriod: c.EntriesInPeriod,
			Status:          string(c.Status),
			SuccessorKPIID:  c.SuccessorKPIID,
		}
	}
	return out, nil
}

func (a *App) SetKPISuccessor(kpiID, successorID string) error {
	return a.snapshotService.SetKPISuccessor(kpiID, successorID)
}
```

- [ ] **Step 4: Build**

```bash
cd /Users/gabriel/projects/pace && go build ./...
```
Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add app.go
git commit -m "feat(snapshot): wire snapshot service and expose Wails bindings"
```

---

## Task 7: Frontend — types, API, and Reviews view

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add types and WailsApp entries**

In `App.tsx`, add to the type declarations at the top:

```typescript
type Snapshot = { id: string; label: string; takenAt: string; createdAt: string };
type KPIComparison = {
  kpiId: string; kpiName: string; kpiUnit: string; kpiCustomUnit: string;
  periodType: string; valueA: number; valueB: number; delta: number;
  progressA: number | null; progressB: number | null;
  entriesInPeriod: number; status: string; successorKpiId: string;
};
```

Add to the `WailsApp` type:
```typescript
CreateSnapshot(label: string): Promise<Snapshot>;
ListSnapshots(): Promise<Snapshot[]>;
CompareSnapshots(snapshotAId: string, snapshotBId: string): Promise<KPIComparison[]>;
SetKPISuccessor(kpiId: string, successorId: string): Promise<void>;
```

- [ ] **Step 2: Add 'reviews' to View type and nav**

Change:
```typescript
type View = 'dashboard' | 'goals' | 'history' | 'archived';
```
To:
```typescript
type View = 'dashboard' | 'goals' | 'history' | 'archived' | 'reviews';
```

Find the nav items array (the one with `['Dashboard', 'dashboard']` etc.) and add:
```typescript
['Reviews', 'reviews'],
```

- [ ] **Step 3: Add Reviews view state and logic**

Add these state variables inside the `App` component (near other `useState` declarations):

```typescript
const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
const [selectedSnapIds, setSelectedSnapIds] = useState<string[]>([]);
const [comparisons, setComparisons] = useState<KPIComparison[] | null>(null);
const [newSnapLabel, setNewSnapLabel] = useState('');
const [newSnapOpen, setNewSnapOpen] = useState(false);
```

Add a `useEffect` to load snapshots when the reviews view becomes active:

```typescript
useEffect(() => {
  if (activeView === 'reviews') {
    appApi().ListSnapshots().then(setSnapshots).catch(console.error);
  }
}, [activeView]);
```

Add these handler functions inside the component:

```typescript
const handleCreateSnapshot = async (e: FormEvent) => {
  e.preventDefault();
  if (!newSnapLabel.trim()) return;
  const snap = await appApi().CreateSnapshot(newSnapLabel.trim());
  setSnapshots(prev => [snap, ...prev]);
  setNewSnapLabel('');
  setNewSnapOpen(false);
};

const toggleSnapSelection = (id: string) => {
  setSelectedSnapIds(prev => {
    if (prev.includes(id)) return prev.filter(x => x !== id);
    if (prev.length >= 2) return [prev[1], id];
    return [...prev, id];
  });
  setComparisons(null);
};

const handleCompare = async () => {
  if (selectedSnapIds.length !== 2) return;
  // Always compare older (A) vs newer (B): sort by takenAt
  const sorted = [...selectedSnapIds].sort((a, b) => {
    const snapA = snapshots.find(s => s.id === a)!;
    const snapB = snapshots.find(s => s.id === b)!;
    return new Date(snapA.takenAt).getTime() - new Date(snapB.takenAt).getTime();
  });
  const result = await appApi().CompareSnapshots(sorted[0], sorted[1]);
  setComparisons(result);
};
```

- [ ] **Step 4: Add Reviews JSX**

Find the section in the JSX that renders views (around line 380 where `activeView === 'dashboard'` is checked). Add a new block:

```tsx
{activeView === 'reviews' ? (
  <div className="reviews-view">
    <div className="reviews-header">
      <button className="btn btn-primary" onClick={() => setNewSnapOpen(true)}>Novo Corte</button>
    </div>

    <Modal open={newSnapOpen} title="Novo Corte" onClose={() => setNewSnapOpen(false)}>
      <form onSubmit={handleCreateSnapshot} className="form-body">
        <div className="form-group">
          <label>Label</label>
          <input
            className="input"
            placeholder="ex: Maio 2026"
            value={newSnapLabel}
            onChange={e => setNewSnapLabel(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setNewSnapOpen(false)}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Criar</button>
        </div>
      </form>
    </Modal>

    {snapshots.length === 0 ? (
      <EmptyState
        title="Nenhum corte ainda"
        description="Crie seu primeiro corte para começar a acompanhar sua evolução."
        ctaLabel="Novo Corte"
        onClick={() => setNewSnapOpen(true)}
      />
    ) : (
      <>
        <div className="snapshot-list">
          {snapshots.map(s => (
            <div
              key={s.id}
              className={`snapshot-card ${selectedSnapIds.includes(s.id) ? 'selected' : ''}`}
              onClick={() => toggleSnapSelection(s.id)}
            >
              <div className="snapshot-card-label">{s.label}</div>
              <div className="snapshot-card-date">{prettyDate(s.takenAt.slice(0, 10))}</div>
              {selectedSnapIds.includes(s.id) && (
                <span className="snapshot-card-badge">{selectedSnapIds.indexOf(s.id) === 0 ? 'A' : 'B'}</span>
              )}
            </div>
          ))}
        </div>

        {selectedSnapIds.length === 2 && (
          <div className="compare-bar">
            <button className="btn btn-primary" onClick={handleCompare}>Comparar</button>
          </div>
        )}

        {comparisons && (
          <div className="comparison-results">
            {(['completed', 'improved', 'stagnant', 'regressed', 'ended', 'new'] as const).map(status => {
              const group = comparisons.filter(c => c.status === status);
              if (group.length === 0) return null;
              const labels: Record<string, string> = {
                completed: 'Concluído', improved: 'Melhorou', stagnant: 'Estagnado',
                regressed: 'Regrediu', ended: 'Encerrado', new: 'Novo'
              };
              return (
                <details key={status} open={status === 'improved' || status === 'completed'}>
                  <summary className={`comparison-group-title status-${status}`}>
                    {labels[status]} ({group.length})
                  </summary>
                  <div className="comparison-group-items">
                    {group.map(c => (
                      <div key={c.kpiId} className="comparison-card">
                        <div className="comparison-card-name">{c.kpiName}</div>
                        <div className="comparison-card-unit">{c.kpiCustomUnit || c.kpiUnit}</div>
                        <div className="comparison-card-values">
                          <span>{c.valueA.toFixed(1)}</span>
                          <span className="arrow">→</span>
                          <span>{c.valueB.toFixed(1)}</span>
                          <span className={`delta ${c.delta >= 0 ? 'positive' : 'negative'}`}>
                            {c.delta >= 0 ? '+' : ''}{c.delta.toFixed(1)}
                          </span>
                        </div>
                        {c.progressA !== null && c.progressB !== null && (
                          <div className="comparison-card-progress">
                            {c.progressA?.toFixed(0)}% → {c.progressB?.toFixed(0)}%
                          </div>
                        )}
                        <div className="comparison-card-entries">{c.entriesInPeriod} registros no período</div>
                        <StatusBadge status={c.status} />
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </>
    )}
  </div>
) : null}
```

- [ ] **Step 5: Build frontend**

```bash
cd /Users/gabriel/projects/pace/frontend && npm run build 2>&1 | tail -20
```
Expected: build completes without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(snapshot): add Reviews view with snapshot list and comparison UI"
```

---

## Task 8: Basic CSS for Reviews view

**Files:**
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add styles**

Open `frontend/src/App.css`. Add at the end:

```css
.reviews-view { display: flex; flex-direction: column; gap: 1.5rem; }
.reviews-header { display: flex; justify-content: flex-end; }

.snapshot-list { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.snapshot-card {
  position: relative; cursor: pointer; padding: 0.75rem 1rem;
  border: 2px solid var(--border); border-radius: 8px; min-width: 140px;
  transition: border-color 0.15s;
}
.snapshot-card:hover { border-color: var(--primary); }
.snapshot-card.selected { border-color: var(--primary); background: var(--primary-light, #f0f4ff); }
.snapshot-card-label { font-weight: 600; font-size: 0.95rem; }
.snapshot-card-date { font-size: 0.8rem; color: var(--text-muted); }
.snapshot-card-badge {
  position: absolute; top: 4px; right: 6px;
  font-size: 0.7rem; font-weight: 700; color: var(--primary);
}

.compare-bar { display: flex; justify-content: center; }

.comparison-results { display: flex; flex-direction: column; gap: 0.75rem; }
.comparison-group-title { font-weight: 600; padding: 0.5rem 0; cursor: pointer; list-style: none; }
.comparison-group-items { display: flex; flex-wrap: wrap; gap: 0.75rem; padding: 0.5rem 0; }
.comparison-card {
  padding: 0.75rem 1rem; border: 1px solid var(--border);
  border-radius: 8px; min-width: 200px; display: flex; flex-direction: column; gap: 0.25rem;
}
.comparison-card-name { font-weight: 600; }
.comparison-card-unit { font-size: 0.8rem; color: var(--text-muted); }
.comparison-card-values { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; }
.comparison-card-values .arrow { color: var(--text-muted); }
.comparison-card-values .delta.positive { color: #16a34a; }
.comparison-card-values .delta.negative { color: #dc2626; }
.comparison-card-progress { font-size: 0.85rem; color: var(--text-muted); }
.comparison-card-entries { font-size: 0.8rem; color: var(--text-muted); }
```

- [ ] **Step 2: Build and verify no errors**

```bash
cd /Users/gabriel/projects/pace/frontend && npm run build 2>&1 | tail -10
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat(snapshot): add CSS styles for Reviews view"
```

---

## Task 9: End-to-end smoke test

- [ ] **Step 1: Run all Go tests**

```bash
cd /Users/gabriel/projects/pace && go test ./... -v 2>&1 | grep -E "PASS|FAIL|ok|---"
```
Expected: all PASS, no FAIL.

- [ ] **Step 2: Build the full app**

```bash
cd /Users/gabriel/projects/pace && go build ./...
```
Expected: clean.

- [ ] **Step 3: Commit final state if clean**

```bash
git add -A && git status
```
If everything is committed already: done. If any straggler files remain, commit them:
```bash
git commit -m "feat(snapshot): finalize snapshots feature"
```
