package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	dashboardapp "pace/internal/application/dashboard"
	goalapp "pace/internal/application/goal"
	initiativeapp "pace/internal/application/initiative"
	kpiapp "pace/internal/application/kpi"
	goalDomain "pace/internal/domain/goal"
	initiativeDomain "pace/internal/domain/initiative"
	kpiDomain "pace/internal/domain/kpi"
	"pace/internal/infrastructure/database"
	"pace/internal/infrastructure/repository"
)

// App struct
type App struct {
	ctx               context.Context
	db                *sql.DB
	goalService       *goalapp.Service
	initiativeService *initiativeapp.Service
	kpiService        *kpiapp.Service
	entryService      *kpiapp.EntryService
	dashboardService  *dashboardapp.Service
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	dataDir, err := appDataDir()
	if err != nil {
		log.Printf("resolve app data dir: %v", err)
		return
	}

	db, err := database.OpenSQLite(dataDir)
	if err != nil {
		log.Printf("open sqlite: %v", err)
		return
	}

	if err := database.RunMigrations(db); err != nil {
		log.Printf("run migrations: %v", err)
		_ = db.Close()
		return
	}

	a.db = db
	a.goalService = goalapp.NewService(repository.NewGoalSQLiteRepository(db))
	a.initiativeService = initiativeapp.NewService(repository.NewInitiativeSQLiteRepository(db))
	kpiRepo := repository.NewKPISQLiteRepository(db)
	entryRepo := repository.NewKPIEntrySQLiteRepository(db)
	a.kpiService = kpiapp.NewService(kpiRepo)
	a.entryService = kpiapp.NewEntryService(entryRepo)
	a.dashboardService = dashboardapp.NewService(kpiRepo, entryRepo)
}

func (a *App) shutdown(context.Context) {
	if a.db != nil {
		_ = a.db.Close()
	}
}

func appDataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "pace"), nil
}

type CreateGoalInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type UpdateGoalInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type GoalOutput struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	ArchivedAt  *time.Time `json:"archivedAt"`
}

func (a *App) CreateGoal(input CreateGoalInput) (*GoalOutput, error) {
	g, err := a.goalService.Create(goalapp.CreateInput{
		Title:       input.Title,
		Description: input.Description,
	})
	if err != nil {
		return nil, err
	}
	out := mapGoalOutput(g)
	return &out, nil
}

func (a *App) UpdateGoal(id string, input UpdateGoalInput) (*GoalOutput, error) {
	g, err := a.goalService.Update(id, goalapp.UpdateInput{
		Title:       input.Title,
		Description: input.Description,
		Status:      input.Status,
	})
	if err != nil {
		return nil, err
	}
	out := mapGoalOutput(g)
	return &out, nil
}

func (a *App) ArchiveGoal(id string) error {
	return a.goalService.Archive(id)
}

func (a *App) ListGoals() ([]GoalOutput, error) {
	goals, err := a.goalService.List()
	if err != nil {
		return nil, err
	}

	out := make([]GoalOutput, 0, len(goals))
	for i := range goals {
		out = append(out, mapGoalOutput(&goals[i]))
	}
	return out, nil
}

func (a *App) GetGoalDetails(id string) (*GoalOutput, error) {
	g, err := a.goalService.Get(id)
	if err != nil {
		return nil, err
	}
	out := mapGoalOutput(g)
	return &out, nil
}

func mapGoalOutput(g *goalDomain.Goal) GoalOutput {
	return GoalOutput{
		ID:          g.ID,
		Title:       g.Title,
		Description: g.Description,
		Status:      string(g.Status),
		CreatedAt:   g.CreatedAt,
		UpdatedAt:   g.UpdatedAt,
		ArchivedAt:  g.ArchivedAt,
	}
}

type CreateInitiativeInput struct {
	GoalID      string `json:"goalId"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type UpdateInitiativeInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type InitiativeOutput struct {
	ID          string     `json:"id"`
	GoalID      string     `json:"goalId"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	ArchivedAt  *time.Time `json:"archivedAt"`
}

func (a *App) CreateInitiative(input CreateInitiativeInput) (*InitiativeOutput, error) {
	item, err := a.initiativeService.Create(initiativeapp.CreateInput{
		GoalID:      input.GoalID,
		Title:       input.Title,
		Description: input.Description,
	})
	if err != nil {
		return nil, err
	}
	out := mapInitiativeOutput(item)
	return &out, nil
}

func (a *App) UpdateInitiative(id string, input UpdateInitiativeInput) (*InitiativeOutput, error) {
	item, err := a.initiativeService.Update(id, initiativeapp.UpdateInput{
		Title:       input.Title,
		Description: input.Description,
		Status:      input.Status,
	})
	if err != nil {
		return nil, err
	}
	out := mapInitiativeOutput(item)
	return &out, nil
}

func (a *App) ArchiveInitiative(id string) error {
	return a.initiativeService.Archive(id)
}

func (a *App) ListInitiativesByGoal(goalID string) ([]InitiativeOutput, error) {
	items, err := a.initiativeService.ListByGoal(goalID)
	if err != nil {
		return nil, err
	}
	out := make([]InitiativeOutput, 0, len(items))
	for i := range items {
		out = append(out, mapInitiativeOutput(&items[i]))
	}
	return out, nil
}

func (a *App) ListInitiatives() ([]InitiativeOutput, error) {
	goals, err := a.goalService.List()
	if err != nil {
		return nil, err
	}

	out := make([]InitiativeOutput, 0)
	for i := range goals {
		items, err := a.initiativeService.ListByGoal(goals[i].ID)
		if err != nil {
			return nil, err
		}
		for j := range items {
			out = append(out, mapInitiativeOutput(&items[j]))
		}
	}
	return out, nil
}

func mapInitiativeOutput(i *initiativeDomain.Initiative) InitiativeOutput {
	return InitiativeOutput{
		ID:          i.ID,
		GoalID:      i.GoalID,
		Title:       i.Title,
		Description: i.Description,
		Status:      string(i.Status),
		CreatedAt:   i.CreatedAt,
		UpdatedAt:   i.UpdatedAt,
		ArchivedAt:  i.ArchivedAt,
	}
}

type CreateKPIInput struct {
	GoalID            string  `json:"goalId"`
	InitiativeID      string  `json:"initiativeId"`
	Name              string  `json:"name"`
	Description       string  `json:"description"`
	Unit              string  `json:"unit"`
	CustomUnit        string  `json:"customUnit"`
	TargetValue       float64 `json:"targetValue"`
	PeriodType        string  `json:"periodType"`
	AllowExceedTarget bool    `json:"allowExceedTarget"`
}

type UpdateKPIInput struct {
	Name              string  `json:"name"`
	Description       string  `json:"description"`
	Unit              string  `json:"unit"`
	CustomUnit        string  `json:"customUnit"`
	TargetValue       float64 `json:"targetValue"`
	PeriodType        string  `json:"periodType"`
	AllowExceedTarget bool    `json:"allowExceedTarget"`
	Status            string  `json:"status"`
}

type KPIOutput struct {
	ID                string     `json:"id"`
	GoalID            string     `json:"goalId"`
	InitiativeID      *string    `json:"initiativeId"`
	Name              string     `json:"name"`
	Description       string     `json:"description"`
	Unit              string     `json:"unit"`
	CustomUnit        string     `json:"customUnit"`
	TargetValue       float64    `json:"targetValue"`
	PeriodType        string     `json:"periodType"`
	AllowExceedTarget bool       `json:"allowExceedTarget"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	ArchivedAt        *time.Time `json:"archivedAt"`
}

func (a *App) CreateKPI(input CreateKPIInput) (*KPIOutput, error) {
	item, err := a.kpiService.Create(kpiapp.CreateInput{
		GoalID:            input.GoalID,
		InitiativeID:      input.InitiativeID,
		Name:              input.Name,
		Description:       input.Description,
		Unit:              input.Unit,
		CustomUnit:        input.CustomUnit,
		TargetValue:       input.TargetValue,
		PeriodType:        input.PeriodType,
		AllowExceedTarget: input.AllowExceedTarget,
	})
	if err != nil {
		return nil, err
	}
	out := mapKPIOutput(item)
	return &out, nil
}

func (a *App) UpdateKPI(id string, input UpdateKPIInput) (*KPIOutput, error) {
	item, err := a.kpiService.Update(id, kpiapp.UpdateInput{
		Name:              input.Name,
		Description:       input.Description,
		Unit:              input.Unit,
		CustomUnit:        input.CustomUnit,
		TargetValue:       input.TargetValue,
		PeriodType:        input.PeriodType,
		AllowExceedTarget: input.AllowExceedTarget,
		Status:            input.Status,
	})
	if err != nil {
		return nil, err
	}
	out := mapKPIOutput(item)
	return &out, nil
}

func (a *App) ArchiveKPI(id string) error {
	return a.kpiService.Archive(id)
}

func (a *App) DeleteKPI(id string) error {
	return a.kpiService.Delete(id)
}

func (a *App) ListKPIs() ([]KPIOutput, error) {
	items, err := a.kpiService.List()
	if err != nil {
		return nil, err
	}
	out := make([]KPIOutput, 0, len(items))
	for i := range items {
		out = append(out, mapKPIOutput(&items[i]))
	}
	return out, nil
}

func (a *App) ListKPIsByGoal(goalID string) ([]KPIOutput, error) {
	items, err := a.kpiService.ListByGoal(goalID)
	if err != nil {
		return nil, err
	}
	out := make([]KPIOutput, 0, len(items))
	for i := range items {
		out = append(out, mapKPIOutput(&items[i]))
	}
	return out, nil
}

func mapKPIOutput(item *kpiDomain.KPI) KPIOutput {
	return KPIOutput{
		ID:                item.ID,
		GoalID:            item.GoalID,
		InitiativeID:      item.InitiativeID,
		Name:              item.Name,
		Description:       item.Description,
		Unit:              string(item.Unit),
		CustomUnit:        item.CustomUnit,
		TargetValue:       item.TargetValue,
		PeriodType:        string(item.PeriodType),
		AllowExceedTarget: item.AllowExceedTarget,
		Status:            string(item.Status),
		CreatedAt:         item.CreatedAt,
		UpdatedAt:         item.UpdatedAt,
		ArchivedAt:        item.ArchivedAt,
	}
}

type RegisterKPIEntryInput struct {
	KPIID     string  `json:"kpiId"`
	Value     float64 `json:"value"`
	EntryDate string  `json:"entryDate"`
	Comment   string  `json:"comment"`
}

type UpdateKPIEntryInput struct {
	Value     float64 `json:"value"`
	EntryDate string  `json:"entryDate"`
	Comment   string  `json:"comment"`
}

type KPIEntryOutput struct {
	ID        string    `json:"id"`
	KPIID     string    `json:"kpiId"`
	Value     float64   `json:"value"`
	EntryDate string    `json:"entryDate"`
	Comment   string    `json:"comment"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (a *App) RegisterKPIEntry(input RegisterKPIEntryInput) (*KPIEntryOutput, error) {
	entry, err := a.entryService.Register(kpiapp.RegisterEntryInput{
		KPIID:     input.KPIID,
		Value:     input.Value,
		EntryDate: input.EntryDate,
		Comment:   input.Comment,
	})
	if err != nil {
		return nil, err
	}
	out := mapEntryOutput(entry)
	return &out, nil
}

func (a *App) UpdateKPIEntry(id string, input UpdateKPIEntryInput) (*KPIEntryOutput, error) {
	entry, err := a.entryService.Update(id, kpiapp.UpdateEntryInput{
		Value:     input.Value,
		EntryDate: input.EntryDate,
		Comment:   input.Comment,
	})
	if err != nil {
		return nil, err
	}
	out := mapEntryOutput(entry)
	return &out, nil
}

func (a *App) DeleteKPIEntry(id string) error {
	return a.entryService.Delete(id)
}

func (a *App) ListKPIHistory(kpiID string) ([]KPIEntryOutput, error) {
	items, err := a.entryService.ListByKPI(kpiID)
	if err != nil {
		return nil, err
	}
	out := make([]KPIEntryOutput, 0, len(items))
	for i := range items {
		out = append(out, mapEntryOutput(&items[i]))
	}
	return out, nil
}

type ImportResultOutput struct {
	GoalsCreated       int `json:"goalsCreated"`
	InitiativesCreated int `json:"initiativesCreated"`
	KPIsCreated        int `json:"kpisCreated"`
	EntriesCreated     int `json:"entriesCreated"`
}

func (a *App) ImportKPIsFromSheet() (*ImportResultOutput, error) {
	type row struct {
		goal       string
		initiative string
		kpi        string
		target     float64
		current    float64
		unit       string
		period     string
	}

	rows := []row{
		{"Melhorar meu inglês", "Curso", "Quantidade de aulas realizadas", 7, 3, "class", "monthly"},
		{"Melhorar meu inglês", "Escrita", "Quantidade de textos escritos", 4, 0, "text", "monthly"},
		{"Melhorar meu inglês", "Escuta", "Quantidade de minutos ouvidos de conteúdo", 120, 0, "minute", "monthly"},
		{"Melhorar meu inglês", "Leitura", "Quantidade de artigos tech lidos", 8, 0, "article", "monthly"},
		{"Aprender francês", "Aprendizado autodidata", "Quantidade de horas estudadas", 8, 0, "hour", "monthly"},
		{"Aprender francês", "Leitura", "Quantidade de notícias lidas", 4, 0, "article", "monthly"},
		{"Aprender francês", "Conversa", "Quantidade de minutos conversando com o ChatGPT", 60, 0, "minute", "monthly"},
		{"Evoluir em DevOps", "Tirar certificação AWS Practioner", "Quantidade de semanas de preparação", 5, 1, "custom", "monthly"},
		{"Fortalecer conhecimento backend | arquitetura", "Estudar itens técnicos", "Quantidade de artigos, vídeos ou docs estudados", 10, 0, "article", "monthly"},
		{"Fortalecer conhecimento backend | arquitetura", "Fazer aulas do Matt KØDVB", "Quantidade de aulas realizadas", 44, 2, "class", "monthly"},
		{"Fortalecer conhecimento backend | arquitetura", "Fazer aulas do Tutorial Series", "Quantidade de aulas realizadas", 37, 7, "class", "monthly"},
		{"Fortalecer conhecimento backend | arquitetura", "Fazer aulas do Piovani.dev", "Quantidade de aulas realizadas", 30, 0, "class", "monthly"},
		{"Organizar vida financeira", "Controle de entrada | saída", "Quantidade de dias registrados", 26, 0, "day", "monthly"},
		{"Organizar vida financeira", "Reserva", "Guardar valor proposto no mês", 8, 1, "money", "monthly"},
		{"Organizar vida financeira", "Fazer app pessoal de controle financeiro", "Quantidade de etapas do desenvolvimento", 4, 1, "step", "monthly"},
		{"Rotina saudável", "Bater meta de água diária", "Dias de meta batida", 26, 10, "day", "monthly"},
		{"Rotina saudável", "Treinar", "Quantidade de dias registrados", 150, 13, "day", "annual"},
	}

	result := &ImportResultOutput{}

	existingGoals, err := a.goalService.List()
	if err != nil {
		return nil, err
	}
	goalByTitle := map[string]string{}
	for i := range existingGoals {
		goalByTitle[strings.ToLower(strings.TrimSpace(existingGoals[i].Title))] = existingGoals[i].ID
	}

	for _, r := range rows {
		goalKey := strings.ToLower(strings.TrimSpace(r.goal))
		goalID := goalByTitle[goalKey]
		if goalID == "" {
			g, err := a.goalService.Create(goalapp.CreateInput{Title: r.goal})
			if err != nil {
				return nil, err
			}
			goalID = g.ID
			goalByTitle[goalKey] = goalID
			result.GoalsCreated++
		}

		initiatives, err := a.initiativeService.ListByGoal(goalID)
		if err != nil {
			return nil, err
		}
		initiativeID := ""
		for i := range initiatives {
			if strings.EqualFold(strings.TrimSpace(initiatives[i].Title), strings.TrimSpace(r.initiative)) {
				initiativeID = initiatives[i].ID
				break
			}
		}
		if initiativeID == "" {
			item, err := a.initiativeService.Create(initiativeapp.CreateInput{
				GoalID: goalID, Title: r.initiative,
			})
			if err != nil {
				return nil, err
			}
			initiativeID = item.ID
			result.InitiativesCreated++
		}

		kpis, err := a.kpiService.ListByGoal(goalID)
		if err != nil {
			return nil, err
		}
		kpiID := ""
		for i := range kpis {
			matchName := strings.EqualFold(strings.TrimSpace(kpis[i].Name), strings.TrimSpace(r.kpi))
			matchInit := kpis[i].InitiativeID != nil && *kpis[i].InitiativeID == initiativeID
			if matchName && matchInit {
				kpiID = kpis[i].ID
				break
			}
		}
		if kpiID == "" {
			item, err := a.kpiService.Create(kpiapp.CreateInput{
				GoalID: goalID, InitiativeID: initiativeID, Name: r.kpi, TargetValue: r.target,
				Unit: r.unit, PeriodType: r.period, AllowExceedTarget: true,
			})
			if err != nil {
				return nil, err
			}
			kpiID = item.ID
			result.KPIsCreated++
		}

		if r.current > 0 {
			history, err := a.entryService.ListByKPI(kpiID)
			if err != nil {
				return nil, err
			}
			if len(history) == 0 {
				_, err = a.entryService.Register(kpiapp.RegisterEntryInput{
					KPIID: kpiID, Value: r.current, EntryDate: time.Now().Format("2006-01-02"),
					Comment: "Importado da planilha inicial",
				})
				if err != nil {
					return nil, err
				}
				result.EntriesCreated++
			}
		}
	}

	return result, nil
}

func mapEntryOutput(entry *kpiDomain.KPIEntry) KPIEntryOutput {
	return KPIEntryOutput{
		ID:        entry.ID,
		KPIID:     entry.KPIID,
		Value:     entry.Value,
		EntryDate: entry.EntryDate.Format("2006-01-02"),
		Comment:   entry.Comment,
		CreatedAt: entry.CreatedAt,
		UpdatedAt: entry.UpdatedAt,
	}
}

type KPIProgressOutput struct {
	KPIID             string  `json:"kpiId"`
	CurrentValue      float64 `json:"currentValue"`
	TargetValue       float64 `json:"targetValue"`
	Percentage        float64 `json:"percentage"`
	VisualPercentage  float64 `json:"visualPercentage"`
	ProgressStatus    string  `json:"progressStatus"`
	IsCompleted       bool    `json:"isCompleted"`
	HasExceededTarget bool    `json:"hasExceededTarget"`
}

type DashboardSummaryOutput struct {
	TotalKPIs      int     `json:"totalKpis"`
	ActiveKPIs     int     `json:"activeKpis"`
	CompletedKPIs  int     `json:"completedKpis"`
	OverallPercent float64 `json:"overallPercent"`
}

func (a *App) GetKPIProgress(id string) (*KPIProgressOutput, error) {
	p, err := a.dashboardService.GetKPIProgress(id)
	if err != nil {
		return nil, err
	}
	return &KPIProgressOutput{
		KPIID:             p.KPIID,
		CurrentValue:      p.CurrentValue,
		TargetValue:       p.TargetValue,
		Percentage:        p.Percentage,
		VisualPercentage:  p.VisualPercentage,
		ProgressStatus:    p.ProgressStatus,
		IsCompleted:       p.IsCompleted,
		HasExceededTarget: p.HasExceededTarget,
	}, nil
}

func (a *App) GetDashboardSummary() (*DashboardSummaryOutput, error) {
	s, err := a.dashboardService.GetSummary()
	if err != nil {
		return nil, err
	}
	return &DashboardSummaryOutput{
		TotalKPIs:      s.TotalKPIs,
		ActiveKPIs:     s.ActiveKPIs,
		CompletedKPIs:  s.CompletedKPIs,
		OverallPercent: s.OverallPercent,
	}, nil
}
