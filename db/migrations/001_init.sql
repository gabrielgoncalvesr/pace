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
