package kpi

type Repository interface {
	Create(item *KPI) error
	Update(item *KPI) error
	Archive(id string) error
	Unarchive(id string) error
	Delete(id string) error
	GetByID(id string) (*KPI, error)
	List() ([]KPI, error)
	ListByGoal(goalID string) ([]KPI, error)
}
