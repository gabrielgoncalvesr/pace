# Pace

Personal KPI tracker desktop app built with [Wails](https://wails.io) (Go + React + SQLite).

Track your goals, initiatives, and KPIs with a clean native macOS app.

## Stack

- **Backend:** Go, SQLite (via `database/sql`)
- **Frontend:** React + TypeScript + Vite
- **Desktop:** Wails v2

## Domain

```
Goal → Initiative → KPI → KPI Entry
```

- **Goal** — top-level objective
- **Initiative** — project under a goal
- **KPI** — measurable metric (daily / weekly / monthly / annual / punctual)
- **KPI Entry** — a recorded value for a KPI on a given date

## Features

- Dashboard with stats, goal progress, needs-attention panel, and activity heatmap
- Quick Register from dashboard or directly from the KPI table row
- Full KPI history with goal/initiative tooltip, inline edit and delete
- Collapsible sidebar navigation
- Success toast on entry save
- Archive and delete for KPIs

## Development

**Requirements:** Go 1.21+, Node 18+, Wails CLI v2

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Run in dev mode (hot reload)
wails dev

# Build production app
wails build
```

The built `.app` is output to `build/bin/pace.app`.

## Database

SQLite database is stored at:

```
~/Library/Application Support/pace/pace.db
```

Migrations run automatically on startup from `db/migrations/`.
