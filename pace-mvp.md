# KPI Tracker Pessoal

## Visão geral

Aplicativo desktop para macOS focado em registro, acompanhamento e histórico de KPIs pessoais.

A ideia é substituir a planilha atual por um app local, simples e rápido, onde seja possível:

- Cadastrar metas
- Cadastrar iniciativas
- Cadastrar KPIs
- Registrar progresso diário, semanal, mensal, anual ou pontual
- Ver histórico do que foi feito
- Acompanhar evolução por dashboard
- Manter os dados localmente no Mac

---

# Stack recomendada

```txt
Desktop App: Wails
Backend: Go
Frontend: React + TypeScript
UI: Tailwind CSS + shadcn/ui
Banco local: SQLite
ORM: GORM ou sqlc
Sistema operacional alvo: macOS
```

## Por que essa stack?

```txt
Wails + Go + SQLite é uma boa escolha porque:
- Gera app desktop nativo para Mac
- Não precisa de servidor externo
- É leve
- Tem boa performance
- Permite usar React no frontend
- Mantém a lógica de domínio em Go
- SQLite resolve bem o armazenamento local
```

---

# Objetivo do app

O app será um KPI Tracker pessoal baseado na estrutura:

```txt
Goal -> Initiative -> KPI -> KPIEntry
```

Exemplo vindo da planilha:

```txt
Goal: Melhorar meu inglês
Initiative: Curso
KPI: Quantidade de aulas realizadas
Current: 3
Target: 7
Prazo: Mensal
```

O foco principal não é só armazenar o valor atual, mas manter o histórico de evolução.

---

# Domínio principal

```txt
Personal Performance Tracking
```

O domínio representa o acompanhamento de performance pessoal através de metas, iniciativas e indicadores mensuráveis.

---

# Bounded Contexts

## 1. Goal Management

Responsável pelo gerenciamento das metas principais.

Exemplos:

```txt
Melhorar meu inglês
Aprender francês
Evoluir em DevOps
Fortalecer conhecimento backend e arquitetura
Organizar vida financeira
Rotina saudável
Leitura
```

Entidade principal:

```txt
Goal
```

Responsabilidades:

```txt
- Criar meta
- Editar meta
- Arquivar meta
- Pausar meta
- Concluir meta
- Listar metas
```

---

## 2. Initiative Management

Responsável pelas iniciativas ligadas a uma meta.

Exemplos:

```txt
Curso
Escrita
Escuta
Leitura
Reserva
Treinar
Fazer app pessoal de controle financeiro
Tirar certificação AWS Practitioner
```

Entidade principal:

```txt
Initiative
```

Relação:

```txt
Goal 1 -> N Initiatives
```

Responsabilidades:

```txt
- Criar iniciativa
- Editar iniciativa
- Arquivar iniciativa
- Listar iniciativas por meta
```

---

## 3. KPI Tracking

Responsável pelo cadastro e acompanhamento dos KPIs.

Exemplos:

```txt
Quantidade de aulas realizadas
Quantidade de textos escritos
Quantidade de minutos ouvidos de conteúdo
Quantidade de artigos tech lidos
Quantidade de horas estudadas
Quantidade de dias registrados
Guardar valor proposto no mês
Quantidade de etapas do desenvolvimento
Dias de meta batida
Quantidade de livros
```

Entidade principal:

```txt
KPI
```

Relação:

```txt
Initiative 1 -> N KPIs
Goal 1 -> N KPIs
```

Responsabilidades:

```txt
- Criar KPI
- Editar KPI
- Arquivar KPI
- Calcular progresso
- Calcular valor atual
- Identificar status do KPI
```

---

## 4. KPI History

Responsável pelo histórico de registros feitos em cada KPI.

Exemplo:

```txt
Dia 18/05:
+1 aula de inglês
Comentário: Aula sobre phrasal verbs

Dia 19/05:
+30 minutos de escuta
Comentário: Podcast técnico em inglês

Dia 20/05:
+1 dia de água batida
Comentário: Meta diária concluída
```

Entidade principal:

```txt
KPIEntry
```

Relação:

```txt
KPI 1 -> N KPIEntries
```

Regra principal:

```txt
O histórico é a fonte da verdade.
O CurrentValue deve ser calculado a partir dos registros.
```

---

# Agregados

## Aggregate: Goal

```txt
Goal
  └── Initiatives
        └── KPIs
```

A meta é o agrupador principal.

Ela não precisa carregar todas as iniciativas e KPIs sempre, mas conceitualmente representa o topo do agrupamento.

---

## Aggregate: KPI

```txt
KPI
  └── KPIEntries
```

Esse é o agregado mais importante do sistema.

O KPI concentra as regras de progresso, target, período, conclusão e histórico.

---

# Entidades

## Goal

```go
type Goal struct {
	ID          string
	Title       string
	Description string
	Status      GoalStatus
	CreatedAt   time.Time
	UpdatedAt   time.Time
	ArchivedAt  *time.Time
}
```

### GoalStatus

```go
type GoalStatus string

const (
	GoalStatusActive    GoalStatus = "active"
	GoalStatusPaused    GoalStatus = "paused"
	GoalStatusCompleted GoalStatus = "completed"
	GoalStatusArchived  GoalStatus = "archived"
)
```

---

## Initiative

```go
type Initiative struct {
	ID          string
	GoalID      string
	Title       string
	Description string
	Status      InitiativeStatus
	CreatedAt   time.Time
	UpdatedAt   time.Time
	ArchivedAt  *time.Time
}
```

### InitiativeStatus

```go
type InitiativeStatus string

const (
	InitiativeStatusActive   InitiativeStatus = "active"
	InitiativeStatusPaused   InitiativeStatus = "paused"
	InitiativeStatusArchived InitiativeStatus = "archived"
)
```

---

## KPI

```go
type KPI struct {
	ID                string
	GoalID            string
	InitiativeID      *string
	Name              string
	Description       string
	Unit              KPIUnit
	TargetValue       float64
	PeriodType        PeriodType
	AllowExceedTarget bool
	Status            KPIStatus
	CreatedAt         time.Time
	UpdatedAt         time.Time
	ArchivedAt        *time.Time
}
```

### KPIStatus

```go
type KPIStatus string

const (
	KPIStatusActive    KPIStatus = "active"
	KPIStatusPaused    KPIStatus = "paused"
	KPIStatusCompleted KPIStatus = "completed"
	KPIStatusArchived  KPIStatus = "archived"
)
```

### KPIUnit

```go
type KPIUnit string

const (
	KPIUnitClass   KPIUnit = "class"
	KPIUnitText    KPIUnit = "text"
	KPIUnitMinute  KPIUnit = "minute"
	KPIUnitHour    KPIUnit = "hour"
	KPIUnitDay     KPIUnit = "day"
	KPIUnitArticle KPIUnit = "article"
	KPIUnitBook    KPIUnit = "book"
	KPIUnitMoney   KPIUnit = "money"
	KPIUnitStep    KPIUnit = "step"
	KPIUnitCustom  KPIUnit = "custom"
)
```

### PeriodType

```go
type PeriodType string

const (
	PeriodTypeDaily    PeriodType = "daily"
	PeriodTypeWeekly   PeriodType = "weekly"
	PeriodTypeMonthly  PeriodType = "monthly"
	PeriodTypeAnnual   PeriodType = "annual"
	PeriodTypePunctual PeriodType = "punctual"
	PeriodTypeCustom   PeriodType = "custom"
)
```

---

## KPIEntry

```go
type KPIEntry struct {
	ID        string
	KPIID     string
	Value     float64
	EntryDate time.Time
	Comment   string
	CreatedAt time.Time
	UpdatedAt time.Time
}
```

---

# Regras de negócio

## 1. Histórico como fonte da verdade

O campo `CurrentValue` não deve ser salvo manualmente no KPI.

Ele deve ser calculado a partir da soma dos registros de histórico.

```txt
CurrentValue = soma dos KPIEntries dentro do período correspondente
```

---

## 2. Cálculo de progresso

```txt
ProgressPercentage = CurrentValue / TargetValue * 100
```

Exemplo:

```txt
CurrentValue: 3
TargetValue: 7

ProgressPercentage = 42.85%
```

---

## 3. Barra visual de progresso

A barra visual deve limitar em 100%.

O percentual textual pode passar de 100%.

Exemplo:

```txt
CurrentValue: 10
TargetValue: 7

Percentual textual: 142%
Barra visual: 100%
```

---

## 4. KPI mensal

Para KPIs mensais, considerar apenas os registros do mês atual.

```txt
Período: primeiro dia do mês até último dia do mês
```

Exemplo:

```txt
KPI: Quantidade de aulas realizadas
Prazo: Mensal
Target: 7

Registros de maio:
+1
+1
+1

Current: 3
Progress: 42.85%
```

---

## 5. KPI anual

Para KPIs anuais, considerar apenas os registros do ano atual.

```txt
Período: primeiro dia do ano até último dia do ano
```

Exemplo:

```txt
KPI: Quantidade de livros
Prazo: Anual
Target: 8

Registros de 2026:
+1
+1

Current: 2
Progress: 25%
```

---

## 6. KPI pontual

Para KPIs pontuais, considerar os registros desde a criação do KPI até a data atual.

Exemplo:

```txt
KPI: Tirar certificação AWS Practitioner
Target: 5 semanas de preparação
Current: 1
Progress: 20%
```

---

## 7. Status de progresso

O app pode classificar visualmente o progresso assim:

```txt
0%        -> not_started
1% a 39%  -> in_progress_low
40% a 69% -> in_progress
70% a 99% -> almost_done
100%      -> completed
100%+     -> exceeded
```

Isso deve ser apenas visual.

O status real do KPI continua sendo:

```txt
active
paused
completed
archived
```

---

# Casos de uso

## Goal

```txt
CreateGoal
UpdateGoal
ArchiveGoal
PauseGoal
CompleteGoal
ListGoals
GetGoalDetails
```

---

## Initiative

```txt
CreateInitiative
UpdateInitiative
ArchiveInitiative
ListInitiativesByGoal
```

---

## KPI

```txt
CreateKPI
UpdateKPI
ArchiveKPI
PauseKPI
CompleteKPI
ListKPIs
ListKPIsByGoal
GetKPIDetails
GetKPIProgress
```

---

## KPI Entry

```txt
RegisterKPIEntry
UpdateKPIEntry
DeleteKPIEntry
ListKPIHistory
ListKPIEntriesByPeriod
```

---

## Dashboard

```txt
GetDashboardSummary
GetMonthlyProgress
GetAnnualProgress
GetGoalsSummary
GetCompletedKPIs
GetActiveKPIs
GetLowProgressKPIs
```

---

# Services de domínio

## KPIProgressService

Responsável por calcular o progresso de um KPI.

Responsabilidades:

```txt
- Calcular valor atual
- Calcular percentual
- Calcular status visual
- Limitar barra visual em 100%
- Permitir percentual textual acima de 100%
```

Retorno esperado:

```go
type KPIProgress struct {
	KPIID              string
	CurrentValue       float64
	TargetValue        float64
	Percentage         float64
	VisualPercentage   float64
	ProgressStatus     string
	IsCompleted        bool
	HasExceededTarget  bool
}
```

---

## PeriodResolver

Responsável por resolver o período de análise de um KPI.

Exemplo:

```go
type PeriodRange struct {
	Start time.Time
	End   time.Time
}
```

Responsabilidades:

```txt
- Resolver período diário
- Resolver período semanal
- Resolver período mensal
- Resolver período anual
- Resolver período pontual
- Resolver período customizado
```

---

## DashboardService

Responsável por consolidar dados para a tela inicial.

Responsabilidades:

```txt
- Buscar KPIs ativos
- Calcular progresso geral
- Agrupar por meta
- Agrupar por período
- Mostrar KPIs concluídos
- Mostrar KPIs com baixo progresso
```

---

# Banco de dados SQLite

## Tabela: goals

```sql
CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    archived_at DATETIME
);
```

---

## Tabela: initiatives

```sql
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
```

---

## Tabela: kpis

```sql
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
```

---

## Tabela: kpi_entries

```sql
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
```

---

## Índices recomendados

```sql
CREATE INDEX idx_initiatives_goal_id ON initiatives(goal_id);

CREATE INDEX idx_kpis_goal_id ON kpis(goal_id);

CREATE INDEX idx_kpis_initiative_id ON kpis(initiative_id);

CREATE INDEX idx_kpi_entries_kpi_id ON kpi_entries(kpi_id);

CREATE INDEX idx_kpi_entries_entry_date ON kpi_entries(entry_date);

CREATE INDEX idx_kpi_entries_kpi_id_entry_date ON kpi_entries(kpi_id, entry_date);
```

---

# Estrutura de pastas sugerida

```txt
.
├── app.go
├── main.go
├── go.mod
├── go.sum
├── wails.json
├── internal
│   ├── domain
│   │   ├── goal
│   │   │   ├── entity.go
│   │   │   ├── repository.go
│   │   │   └── value_object.go
│   │   ├── initiative
│   │   │   ├── entity.go
│   │   │   ├── repository.go
│   │   │   └── value_object.go
│   │   └── kpi
│   │       ├── entity.go
│   │       ├── entry.go
│   │       ├── progress.go
│   │       ├── period.go
│   │       ├── repository.go
│   │       └── value_object.go
│   ├── application
│   │   ├── goal
│   │   │   ├── create_goal.go
│   │   │   ├── update_goal.go
│   │   │   ├── archive_goal.go
│   │   │   └── list_goals.go
│   │   ├── initiative
│   │   │   ├── create_initiative.go
│   │   │   ├── update_initiative.go
│   │   │   └── list_initiatives.go
│   │   ├── kpi
│   │   │   ├── create_kpi.go
│   │   │   ├── update_kpi.go
│   │   │   ├── archive_kpi.go
│   │   │   ├── register_entry.go
│   │   │   ├── list_kpis.go
│   │   │   ├── list_history.go
│   │   │   └── get_progress.go
│   │   └── dashboard
│   │       └── get_summary.go
│   ├── infrastructure
│   │   ├── database
│   │   │   ├── sqlite.go
│   │   │   └── migrations.go
│   │   └── repository
│   │       ├── goal_repository_sqlite.go
│   │       ├── initiative_repository_sqlite.go
│   │       ├── kpi_repository_sqlite.go
│   │       └── kpi_entry_repository_sqlite.go
│   └── interfaces
│       └── wails
│           ├── goal_handler.go
│           ├── initiative_handler.go
│           ├── kpi_handler.go
│           └── dashboard_handler.go
└── frontend
    ├── package.json
    ├── src
    │   ├── app
    │   ├── components
    │   │   └── ui
    │   ├── features
    │   │   ├── dashboard
    │   │   ├── goals
    │   │   ├── initiatives
    │   │   └── kpis
    │   ├── lib
    │   ├── types
    │   └── main.tsx
    └── index.html
```

---

# Interfaces Wails

O frontend React deve chamar métodos expostos pelo Go via Wails.

Exemplo de métodos:

```go
type App struct {
	GoalHandler       *GoalHandler
	InitiativeHandler *InitiativeHandler
	KPIHandler        *KPIHandler
	DashboardHandler  *DashboardHandler
}
```

Exemplo:

```go
func (a *App) CreateGoal(input CreateGoalInput) (*GoalOutput, error) {
	return a.GoalHandler.Create(input)
}

func (a *App) ListGoals() ([]GoalOutput, error) {
	return a.GoalHandler.List()
}

func (a *App) CreateKPI(input CreateKPIInput) (*KPIOutput, error) {
	return a.KPIHandler.Create(input)
}

func (a *App) RegisterKPIEntry(input RegisterKPIEntryInput) error {
	return a.KPIHandler.RegisterEntry(input)
}

func (a *App) GetDashboardSummary() (*DashboardSummaryOutput, error) {
	return a.DashboardHandler.GetSummary()
}
```

---

# Telas do app

## 1. Dashboard

Tela inicial com resumo geral.

Cards principais:

```txt
- Progresso geral do mês
- KPIs ativos
- KPIs concluídos
- KPIs com baixo progresso
- Metas em andamento
- Registros feitos no mês
```

Agrupamento por meta:

```txt
Melhorar meu inglês: 38%
Aprender francês: 0%
Evoluir em DevOps: 20%
Organizar vida financeira: 25%
Rotina saudável: 38%
Leitura: 0%
```

---

## 2. Goals

Tela para cadastro e manutenção das metas.

Campos:

```txt
Título
Descrição
Status
Data de criação
```

Ações:

```txt
Criar meta
Editar meta
Pausar meta
Arquivar meta
Concluir meta
Ver iniciativas
Ver KPIs
```

---

## 3. Initiatives

Tela para cadastro e manutenção das iniciativas.

Campos:

```txt
Meta vinculada
Título
Descrição
Status
```

Ações:

```txt
Criar iniciativa
Editar iniciativa
Arquivar iniciativa
Ver KPIs vinculados
```

---

## 4. KPIs

Tela principal em formato de tabela, parecida com a planilha atual.

Colunas:

```txt
Goal
Initiative
KPI
Current
Target
Progress
Period
Comments
Actions
```

Ações:

```txt
Registrar progresso
Editar KPI
Ver histórico
Arquivar KPI
Concluir KPI
```

---

## 5. Registro rápido

Modal para registrar progresso sem fricção.

Campos:

```txt
KPI
Valor
Data
Comentário
```

Exemplo:

```txt
KPI: Quantidade de aulas realizadas
Valor: +1
Data: Hoje
Comentário: Aula 4 concluída
```

Esse é um dos fluxos mais importantes do app.

O registro precisa ser rápido.

---

## 6. Histórico do KPI

Tela para visualizar tudo que já foi feito em um KPI.

Colunas:

```txt
Data
Valor
Comentário
Criado em
Ações
```

Exemplo:

```txt
18/05/2026 | +1  | Aula concluída
19/05/2026 | +30 | Podcast em inglês
20/05/2026 | +1  | Dia de água batida
```

Ações:

```txt
Editar registro
Excluir registro
```

---

# Layout visual recomendado

## Estilo geral

```txt
- Visual limpo
- Aparência de app de produtividade
- Inspiração em Notion, Linear e planilha moderna
- Tabela central para KPIs
- Cards para resumo
- Modal para registro rápido
```

## Componentes principais

```txt
Sidebar
Topbar
Dashboard cards
Tabela de KPIs
Progress bar
Badge de status
Modal de cadastro
Modal de registro rápido
Drawer de histórico
Filtros
```

## Filtros recomendados

```txt
Por meta
Por período
Por status
Por tipo de KPI
Por progresso
```

---

# Modelo de progresso visual

```txt
0%        -> Cinza
1% a 39%  -> Baixo progresso
40% a 69% -> Em andamento
70% a 99% -> Quase concluído
100%      -> Concluído
100%+     -> Superado
```

Importante:

```txt
A barra visual limita em 100%.
O texto pode exibir acima de 100%.
```

Exemplo:

```txt
142% concluído
```

---

# MVP

A primeira versão deve focar apenas no essencial.

## Funcionalidades do MVP

```txt
1. Criar Goal
2. Editar Goal
3. Arquivar Goal
4. Criar Initiative
5. Editar Initiative
6. Criar KPI
7. Editar KPI
8. Arquivar KPI
9. Registrar progresso
10. Ver histórico do KPI
11. Ver dashboard simples
12. Ver tabela geral de KPIs
```

## Não fazer no MVP

```txt
Login
Cloud sync
Multiusuário
Notificações
IA
Integração com calendário
Importação automática da planilha
Relatórios avançados
Exportação
```

---

# Evoluções futuras

Depois do MVP, o app pode evoluir para:

```txt
- Importar CSV da planilha atual
- Exportar relatório mensal
- Backup local
- Backup em iCloud Drive
- Notificações para registrar progresso
- Metas recorrentes
- Templates de KPI
- Dashboard anual
- Comparativo mês a mês
- Gráficos
- Modo foco
- Widgets
- Integração com calendário
```

---

# Possíveis nomes

```txt
Pace
Momentum
MetricFlow
Progress OS
Orbita Goals
Orbita KPI
Orbit Goals
Milestone
Trackly
```

Como já existe a ideia do Orbita, uma boa opção seria:

```txt
Orbita Goals
```

Ou, se for app separado:

```txt
Pace
```

---

# Fluxo principal

```txt
Usuário registra progresso
        ↓
React chama método Wails
        ↓
Application Use Case executa ação
        ↓
Domain valida regra
        ↓
Repository salva no SQLite
        ↓
Dashboard recalcula progresso
        ↓
Frontend atualiza a tela
```

---

# Decisão importante

## CurrentValue não deve ser salvo no KPI

Evitar isso:

```txt
kpis.current_value
```

Preferir isso:

```txt
CurrentValue = SUM(kpi_entries.value)
```

Motivo:

```txt
- Evita inconsistência
- Permite histórico real
- Permite recalcular por mês, ano ou período customizado
- Permite gráficos futuros
- Permite auditoria pessoal
```

---

# Prompt para Codex ou Claude

```txt
Crie um app desktop para macOS usando Wails + Go + React + TypeScript + Tailwind CSS + shadcn/ui + SQLite.

O app será um KPI Tracker pessoal baseado em metas, iniciativas, KPIs e histórico de progresso.

A arquitetura deve ser inspirada em DDD, separando:

- domain
- application
- infrastructure
- interfaces/wails
- frontend

Entidades principais:

- Goal
- Initiative
- KPI
- KPIEntry

Regras de domínio:

- Uma Goal pode ter várias Initiatives.
- Uma Initiative pode ter vários KPIs.
- Um KPI pode ter vários registros de histórico.
- O histórico é a fonte da verdade.
- O CurrentValue do KPI deve ser calculado pela soma dos KPIEntries dentro do período.
- Não salvar CurrentValue diretamente no KPI.
- O progresso percentual é calculado por CurrentValue / TargetValue * 100.
- A barra visual deve limitar em 100%.
- O percentual textual pode passar de 100%.
- PeriodType pode ser daily, weekly, monthly, annual, punctual ou custom.
- Para KPIs mensais, calcular apenas os registros do mês atual.
- Para KPIs anuais, calcular apenas os registros do ano atual.
- Para KPIs pontuais, calcular desde a criação do KPI até hoje.

Telas necessárias:

- Dashboard com resumo geral
- Tela de Goals
- Tela de Initiatives
- Tela de KPIs em formato de tabela
- Modal de criação e edição de KPI
- Modal de registro rápido de progresso
- Tela ou drawer de histórico do KPI

Banco local SQLite com as tabelas:

- goals
- initiatives
- kpis
- kpi_entries

Estrutura desejada no backend Go:

internal/domain
internal/application
internal/infrastructure
internal/interfaces/wails

Estrutura desejada no frontend:

frontend/src/features/dashboard
frontend/src/features/goals
frontend/src/features/initiatives
frontend/src/features/kpis
frontend/src/components/ui
frontend/src/lib
frontend/src/types

O frontend deve ter uma interface moderna, limpa e produtiva, parecida com uma planilha melhorada.

Use componentes como:

- Sidebar
- Cards
- Table
- Progress bar
- Badges
- Dialogs
- Drawer
- Inputs
- Selects
- Buttons

O app deve priorizar simplicidade, velocidade de registro e visualização clara da evolução.
```

---

# Prompt complementar para design da UI

```txt
Crie a interface do KPI Tracker pessoal com React, TypeScript, Tailwind CSS e shadcn/ui.

A interface deve parecer um app desktop moderno de produtividade.

Inspirações visuais:

- Notion
- Linear
- Raycast
- Planilha moderna
- Dashboard minimalista

Telas:

1. Dashboard
   - Cards de resumo
   - Progresso geral do mês
   - KPIs ativos
   - KPIs concluídos
   - Metas em andamento
   - Lista dos KPIs com menor progresso

2. KPIs
   - Tabela principal
   - Colunas: Goal, Initiative, KPI, Current, Target, Progress, Period, Actions
   - Barra de progresso
   - Badge de status
   - Botão de registro rápido

3. Goals
   - Lista de metas
   - Card ou tabela
   - Criar, editar, arquivar

4. KPI History
   - Timeline ou tabela
   - Data, valor, comentário
   - Editar e excluir registros

5. Modal de registro rápido
   - Selecionar KPI
   - Informar valor
   - Informar data
   - Comentário opcional

Prioridade da experiência:

- Poucos cliques para registrar progresso
- Boa visualização do avanço
- Layout limpo
- Evitar excesso de informação
- Manter o app rápido e simples
```

---

# Resumo final

A melhor abordagem para esse app é:

```txt
Wails + Go + React + SQLite
```

Com domínio baseado em:

```txt
Goal -> Initiative -> KPI -> KPIEntry
```

E a decisão mais importante:

```txt
O histórico é a fonte da verdade.
O progresso é calculado.
O Current não deve ser salvo manualmente.
```

Essa estrutura resolve melhor que a planilha porque permite:

```txt
- Histórico real
- Dashboard
- Evolução por período
- Registro rápido
- Organização por metas
- Crescimento futuro sem refatorar tudo
```