package snapshot

import "time"

type Repository interface {
	Create(s Snapshot, values []SnapshotKPIValue) error
	List() ([]Snapshot, error)
	GetValues(snapshotID string) ([]SnapshotKPIValue, error)
	GetLatestTakenAt() (*time.Time, error)
}
