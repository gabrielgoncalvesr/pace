# Pace MVP — Design Spec

**Date:** 2026-05-18  
**Status:** Approved

---

## Overview

Desktop app for macOS to track personal KPIs, replacing a spreadsheet.  
Built with Wails + Go + React + SQLite.

**Core domain model:**
```
Goal → Initiative → KPI → KPIEntry
```

**Critical invariant:** `CurrentValue` is never persisted. Always calculated as `SUM(kpi_entries.value)` filtered by the KPI's period.

---

## Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Wails v2 |
| Backend | Go 1.22+ |
| Frontend | React 18 + TypeScript + Vite |
| UI components | Tailwind CSS + shadcn/ui |
| Database | SQLite via `modernc.org/sqlite` (pure Go, no CGO) |
| Query layer | sqlc (type-safe, generated from SQL) |
| IDs | UUID v4 as TEXT |
| Theme | next-themes + shadcn CSS variables |

---

## Architecture

### Backend (Go)

```
internal/
  domain/
    goal/           entity.go, repository.go, value_object.go
    initiative/     entity.go, repository.go, value_object.go
    kpi/            entity.go, entry.go, progress.go, period.go, repository.go, value_object.go
  application/
    goal/           create_goal.go, update_goal.go, archive_goal.go, list_goals.go
    initiative/     create_initiative.go, update_initiative.go, list_initiatives.go
    kpi/            create_kpi.go, update_kpi.go, archive_kpi.go, register_entry.go,
                    list_kpis.go, list_history.go, get_progress.go
    dashboard/      get_summary.go
  infrastructure/
    database/
      sqlite.go         opens connection, configures WAL mode
      migrations.go     runs migrations array on startup (no external lib)
      queries/          named .sql files
      generated/        sqlc-generated Go code
    repository/
      goal_repository_sqlite.go
      initiative_repository_sqlite.go
      kpi_repository_sqlite.go
      kpi_entry_repository_sqlite.go
  interfaces/
    wails/
      goal_handler.go
      initiative_handler.go
      kpi_handler.go
      dashboard_handler.go
```

### Data flow

```
React → window.go:Method() → Handler → UseCase → Domain → Repository → SQLite
                                                                ↑
                                                         sqlc generated queries
```

### Wails binding surface (app.go)

All public methods on `App` are exposed to the frontend automatically by Wails:

```go
// Goal
CreateGoal(input CreateGoalInput) (*GoalOutput, error)
UpdateGoal(id string, input UpdateGoalInput) (*GoalOutput, error)
ArchiveGoal(id string) error
ListGoals() ([]GoalOutput, error)
GetGoalDetails(id string) (*GoalOutput, error)

// Initiative
CreateInitiative(input CreateInitiativeInput) (*InitiativeOutput, error)
UpdateInitiative(id string, input UpdateInitiativeInput) (*InitiativeOutput, error)
ArchiveInitiative(id string) error
ListInitiativesByGoal(goalID string) ([]InitiativeOutput, error)

// KPI
CreateKPI(input CreateKPIInput) (*KPIOutput, error)
UpdateKPI(id string, input UpdateKPIInput) (*KPIOutput, error)
ArchiveKPI(id string) error
ListKPIs() ([]KPIOutput, error)
ListKPIsByGoal(goalID string) ([]KPIOutput, error)
GetKPIProgress(id string) (*KPIProgressOutput, error)

// KPI Entry
RegisterKPIEntry(input RegisterKPIEntryInput) (*KPIEntryOutput, error)
UpdateKPIEntry(id string, input UpdateKPIEntryInput) (*KPIEntryOutput, error)
DeleteKPIEntry(id string) error
ListKPIHistory(kpiID string) ([]KPIEntryOutput, error)

// Dashboard
GetDashboardSummary() (*DashboardSummaryOutput, error)
```

---

## Domain

### Entities

**Goal**
```go
type Goal struct {
    ID          string
    Title       string
    Description string
    Status      GoalStatus     // active | paused | completed | archived
    CreatedAt   time.Time
    UpdatedAt   time.Time
    ArchivedAt  *time.Time
}
```

**Initiative**
```go
type Initiative struct {
    ID          string
    GoalID      string
    Title       string
    Description string
    Status      InitiativeStatus  // active | paused | archived
    CreatedAt   time.Time
    UpdatedAt   time.Time
    ArchivedAt  *time.Time
}
```

**KPI**
```go
type KPI struct {
    ID                string
    GoalID            string
    InitiativeID      *string
    Name              string
    Description       string
    Unit              KPIUnit      // class|text|minute|hour|day|article|book|money|step|custom
    TargetValue       float64
    PeriodType        PeriodType   // daily|weekly|monthly|annual|punctual|custom
    AllowExceedTarget bool
    Status            KPIStatus    // active|paused|completed|archived
    CreatedAt         time.Time
    UpdatedAt         time.Time
    ArchivedAt        *time.Time
}
```

**KPIEntry**
```go
type KPIEntry struct {
    ID        string
    KPIID     string
    Value     float64
    EntryDate time.Time
    Comment   string
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

### Domain services

**PeriodResolver** — resolves `(start time.Time, end time.Time)` from a `PeriodType`:
- `daily` → today 00:00 to 23:59
- `weekly` → Monday to Sunday of current week
- `monthly` → first to last day of current month
- `annual` → Jan 1 to Dec 31 of current year
- `punctual` → `kpi.CreatedAt` to now

**KPIProgressService** — calculates progress on-the-fly, never persisted:
```go
type KPIProgress struct {
    KPIID             string
    CurrentValue      float64
    TargetValue       float64
    Percentage        float64  // may exceed 100
    VisualPercentage  float64  // capped at 100
    ProgressStatus    string   // not_started|in_progress_low|in_progress|almost_done|completed|exceeded
    IsCompleted       bool
    HasExceededTarget bool
}
```

Progress status thresholds:
```
0%        → not_started
1–39%     → in_progress_low
40–69%    → in_progress
70–99%    → almost_done
100%      → completed
>100%     → exceeded
```

---

## Database

### Schema

```sql
CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    archived_at DATETIME
);

CREATE TABLE initiatives (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    archived_at DATETIME,
    FOREIGN KEY (goal_id) REFERENCES goals(id)
);

CREATE TABLE kpis (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    initiative_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL,
    custom_unit TEXT,
    target_value REAL NOT NULL,
    period_type TEXT NOT NULL,
    allow_exceed_target BOOLEAN NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    archived_at DATETIME,
    FOREIGN KEY (goal_id) REFERENCES goals(id),
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
);

CREATE TABLE kpi_entries (
    id TEXT PRIMARY KEY,
    kpi_id TEXT NOT NULL,
    value REAL NOT NULL,
    entry_date DATE NOT NULL,
    comment TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (kpi_id) REFERENCES kpis(id)
);

CREATE INDEX idx_initiatives_goal_id ON initiatives(goal_id);
CREATE INDEX idx_kpis_goal_id ON kpis(goal_id);
CREATE INDEX idx_kpis_initiative_id ON kpis(initiative_id);
CREATE INDEX idx_kpi_entries_kpi_id ON kpi_entries(kpi_id);
CREATE INDEX idx_kpi_entries_entry_date ON kpi_entries(entry_date);
CREATE INDEX idx_kpi_entries_kpi_id_entry_date ON kpi_entries(kpi_id, entry_date);
```

### Key query (CurrentValue)

```sql
-- name: GetKPICurrentValue :one
SELECT COALESCE(SUM(value), 0) AS current_value
FROM kpi_entries
WHERE kpi_id = ? AND entry_date BETWEEN ? AND ?;
```

Migrations are run as an ordered string array on app startup — no external migration library.  
SQLite is configured with WAL mode for better concurrent read performance.

---

## Frontend

### Structure

```
frontend/src/
  features/
    goals/         GoalsPage, GoalForm, GoalCard
    initiatives/   InitiativesPage, InitiativeForm
    kpis/          KPIsPage, KPIForm, KPIRow, KPIProgressBar
    entries/       QuickEntryModal, HistoryDrawer
    dashboard/     DashboardPage, SummaryCards, GoalProgressList
  components/ui/   shadcn components
  lib/
    wails.ts       typed wrappers over Wails-generated bindings
    utils.ts
  types/           TypeScript interfaces mirroring Go output structs
```

### Navigation

Fixed sidebar with 4 items: Dashboard · KPIs · Goals · Initiatives.

### KPIs page (primary screen)

Table with columns: `Goal | Initiative | KPI | Current | Target | Progress | Period | Actions`

- Inline progress bar (capped at 100% visually)
- Status badge (color-coded by progress threshold)
- Quick-entry button per row (opens modal)

### Quick Entry Modal

Opens on row action or global shortcut. Fields: value (number), date (default today), comment (optional).  
Submit with Enter. Closes and refreshes table on success.

### History Drawer

Slides in from the right. Shows KPIEntry list: date · value · comment · edit · delete.  
No separate route — stays in context of KPIs page.

### Theme

`next-themes` with shadcn CSS variables. Toggle button in topbar. Persists in `localStorage`.

### Wails binding wrapper

```ts
// lib/wails.ts
import * as Go from '../wailsjs/go/main/App'
export const createGoal        = Go.CreateGoal
export const listGoals         = Go.ListGoals
export const createKPI         = Go.CreateKPI
export const listKPIs          = Go.ListKPIs
export const getKPIProgress    = Go.GetKPIProgress
export const registerKPIEntry  = Go.RegisterKPIEntry
export const getDashboardSummary = Go.GetDashboardSummary
// ... all methods typed
```

---

## Build Order (feature-by-feature)

1. Scaffold: `wails init`, go.mod, sqlc config, DB setup, migrations
2. Goal CRUD — Go domain + app + repo + handler + React page
3. Initiative CRUD — same layers
4. KPI CRUD — same layers
5. KPI Entry — RegisterEntry use case + QuickEntryModal
6. KPI Progress — PeriodResolver + KPIProgressService + GetKPIProgress handler
7. Dashboard — DashboardService + GetDashboardSummary + React page
8. UI polish — tabela completa, progress bars, badges, drawer histórico
9. Dark/light toggle

---

## Out of scope (MVP)

Login, cloud sync, multi-user, notifications, AI, calendar integration, CSV import, export, reports.
