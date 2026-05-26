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

	// KPIs in A but not in B
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
