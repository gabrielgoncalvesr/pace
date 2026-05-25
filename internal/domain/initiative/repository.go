package initiative

type Repository interface {
	Create(i *Initiative) error
	Update(i *Initiative) error
	Archive(id string) error
	GetByID(id string) (*Initiative, error)
	ListByGoal(goalID string) ([]Initiative, error)
}
