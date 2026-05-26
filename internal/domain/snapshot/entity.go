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
