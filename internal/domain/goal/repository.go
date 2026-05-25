package goal

type Repository interface {
	Create(g *Goal) error
	Update(g *Goal) error
	Archive(id string) error
	GetByID(id string) (*Goal, error)
	List() ([]Goal, error)
}
