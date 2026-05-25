# Snapshots (Cortes) — Design Spec

**Date:** 2026-05-25  
**Status:** Approved

---

## Overview

Manual snapshot system ("corte") that captures the state of all KPIs at a point in time. Two snapshots can be compared side-by-side to produce a structured insight report showing what improved, stagnated, regressed, completed, or ended between the cuts.

---

## Schema

### New table: `snapshots`

```sql
CREATE TABLE snapshots (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    taken_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL
);
```

`label` is free-form (e.g. "Abril 2026"). `taken_at` is the moment of the cut.

### New table: `snapshot_kpi_values`

```sql
CREATE TABLE snapshot_kpi_values (
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
);
```

KPI metadata (name, unit, target, period_type) is frozen at snapshot time so comparisons remain accurate even if the KPI is later modified or deleted. `is_tombstone=true` when the KPI was archived/deleted at the time of the cut.

`value_at_snapshot` is the accumulated sum of entries from the previous snapshot (or KPI creation if this is the first snapshot) up to `taken_at`. `entries_count` is the count of entries in that same window.

### Alteration: `kpis`

```sql
ALTER TABLE kpis ADD COLUMN successor_kpi_id TEXT REFERENCES kpis(id);
```

Allows manual linking when a KPI is replaced by a new equivalent one. The comparison view chains them.

---

## Comparison Logic

`CompareSnapshots(snapshotAId, snapshotBId)` returns `[]KPIComparison`, where A is the older snapshot and B is the newer.

### Classification by `period_type`

| period_type | Rule |
|---|---|
| `monthly` | Compare `value_at_snapshot` B vs A. Positive delta = improved, negative = regressed, zero = stagnant. |
| `annual` / `punctual` | Compare `progress_pct` B vs A. Does not penalize low delta within a period — only cares if overall progress advanced. Delta ≥ 0 with entries = in progress; delta < 0 = regressed. |

### KPI statuses in comparison

| Status | Condition |
|---|---|
| `completed` | `progress_pct` ≥ 100% in B |
| `improved` | Positive delta per period_type logic |
| `stagnant` | Zero delta AND entries_count = 0 in period |
| `regressed` | Negative delta |
| `ended` | `is_tombstone=true` in B, was active in A |
| `new` | Present in B, absent in A |
| `continued` | KPI has `successor_kpi_id`; displayed as a chain in the UI |

Result is ordered: `completed → improved → stagnant → regressed → ended → new`.

`entries_count` distinguishes "stagnant because nothing was logged" from "stagnant because logged but didn't move."

---

## Application Layer (Go)

### Use cases

**`CreateSnapshot(label string) → Snapshot`**
- Iterates all KPIs (active + recently archived)
- For each KPI: queries entries since the previous snapshot's `taken_at` (or KPI's `created_at` if no prior snapshot)
- Computes `value_at_snapshot` (sum), `entries_count`, `progress_pct`
- Marks `is_tombstone=true` for KPIs with `archived_at != nil`
- Persists snapshot + snapshot_kpi_values in a transaction

**`ListSnapshots() → []Snapshot`**
- Returns all snapshots ordered by `taken_at` desc

**`CompareSnapshots(snapshotAId, snapshotBId string) → []KPIComparison`**
- Loads values for both snapshots
- Applies classification logic per period_type
- Handles new/ended/continued KPIs
- Returns ordered result list

**`SetKPISuccessor(kpiId, successorId string) error`**
- Sets `successor_kpi_id` on the given KPI
- Validates that successorId exists and is not the same KPI

### Wails bindings exposed

- `CreateSnapshot`
- `ListSnapshots`
- `CompareSnapshots`
- `SetKPISuccessor`

---

## Frontend

### "Revisão" screen (new route)

**Section 1 — Snapshot list**
- Cards showing label + date
- "Novo corte" button → modal to enter label → calls `CreateSnapshot`

**Section 2 — Snapshot selection**
- Click two cards to select them
- "Comparar" button activates when exactly two are selected

**Section 3 — Comparison view**
- Grouped by status (collapsible sections)
- Each KPI card shows:
  - Name, goal, initiative
  - Value A → Value B + delta (absolute)
  - Progress % A → % B
  - Entries count in period
  - Status badge (`melhorou` / `estagnado` / `regrediu` / `concluído` / `encerrado` / `novo`)
  - If `continued`: displays chain "KPI antiga → KPI atual"

---

## Out of scope

- Automatic/scheduled snapshots
- Comparing more than two snapshots at once
- Exporting comparison to PDF/CSV
