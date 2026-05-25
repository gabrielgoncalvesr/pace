# Pace MVP — Plano de Execução

**Data:** 2026-05-18  
**Projeto:** Pace (KPI Tracker Pessoal)  
**Base:** `pace-mvp.md` + `docs/superpowers/specs/2026-05-18-pace-mvp-design.md`

## 1) Estado atual (diagnóstico)

- Existe visão funcional e especificação técnica aprovadas.
- Ainda não há scaffold do app (Wails/Go/React) versionado no repositório.
- Não há implementação de domínio, banco, handlers, UI ou testes.

### Conclusão

O projeto está em **fase de planejamento concluído** e **fase de implementação não iniciada**.

## 2) Objetivo do MVP

Entregar app desktop macOS para registrar e acompanhar KPIs pessoais com modelo:

`Goal -> Initiative -> KPI -> KPIEntry`

Regra central obrigatória:

- `CurrentValue` **não é persistido**.
- Progresso é sempre calculado por `SUM(kpi_entries.value)` filtrado por período do KPI.

## 3) Escopo fechado do MVP

Inclui:

- CRUD de Goals
- CRUD de Initiatives
- CRUD de KPIs
- Registro/edição/exclusão de KPI entries
- Histórico por KPI
- Cálculo de progresso por período
- Dashboard de resumo
- Tema claro/escuro

Não inclui:

- Login
- Sync em nuvem
- Multiusuário
- Notificações
- IA
- Import/export CSV
- Relatórios avançados

## 4) Plano de execução por fases

## Fase 0 — Scaffold e fundação

Entregas:

- Inicializar Wails + Go + React + TypeScript
- Configurar Tailwind + shadcn/ui
- Configurar SQLite (`modernc.org/sqlite`) + WAL
- Configurar sqlc
- Criar migrations iniciais
- Estrutura de pastas backend/frontend conforme spec

Critério de pronto:

- App abre localmente
- Banco criado automaticamente
- Migrations executam no startup sem erro

## Fase 1 — Goal Management

Entregas:

- Domínio `Goal`
- Casos de uso: criar, atualizar, arquivar, listar, detalhar
- Repositório SQLite + queries sqlc
- Métodos Wails
- Tela Goals (listar + criar + editar + arquivar)

Critério de pronto:

- Fluxo completo de Goal funcional UI -> backend -> DB

## Fase 2 — Initiative Management

Entregas:

- Domínio `Initiative`
- Casos de uso: criar, atualizar, arquivar, listar por goal
- Repositório SQLite + queries sqlc
- Métodos Wails
- Tela Initiatives

Critério de pronto:

- Iniciativas vinculadas a metas funcionando ponta a ponta

## Fase 3 — KPI Management

Entregas:

- Domínio `KPI` (unidade, período, status)
- Casos de uso: criar, atualizar, arquivar, listar geral e por goal
- Repositório SQLite + queries sqlc
- Métodos Wails
- Tela KPIs (tabela base)

Critério de pronto:

- KPIs criados e exibidos com vínculo de Goal/Initiative

## Fase 4 — KPI Entries + Histórico

Entregas:

- Domínio `KPIEntry`
- Casos de uso: registrar, editar, excluir, listar histórico
- Modal de Quick Entry
- Drawer de histórico

Critério de pronto:

- Registro diário rápido funcional em até poucos cliques

## Fase 5 — Progresso e Dashboard

Entregas:

- `PeriodResolver`
- `KPIProgressService`
- Caso de uso `GetKPIProgress`
- Caso de uso `GetDashboardSummary`
- Dashboard com cards e lista de atenção
- Progress bars + badges de status

Critério de pronto:

- Progresso correto por período
- Dashboard refletindo dados reais de entries

## Fase 6 — Polimento e estabilidade MVP

Entregas:

- Tema dark/light persistido
- Ajustes de UX e consistência visual
- Tratamento de erros de formulário
- Testes mínimos críticos (domínio + integração DB)
- Build local sem erros

Critério de pronto:

- MVP utilizável de forma estável no macOS

## 5) Ordem de implementação imediata

1. Executar Fase 0 completa
2. Implementar Fase 1
3. Implementar Fase 2
4. Implementar Fase 3
5. Implementar Fase 4
6. Implementar Fase 5
7. Finalizar Fase 6

## 6) Riscos e mitigação

- Complexidade antecipada no frontend: mitigar com entrega incremental por tela.
- Regressão no cálculo de progresso: mitigar com testes de `PeriodResolver` e `KPIProgressService`.
- Divergência entre DTOs Go e TypeScript: mitigar com wrappers tipados em `frontend/src/lib/wails.ts`.

## 7) Definição de pronto do MVP

O MVP estará pronto quando:

- Usuário conseguir criar metas, iniciativas e KPIs
- Usuário registrar progresso rapidamente
- Histórico estiver íntegro e editável
- Progresso for calculado dinamicamente por período
- Dashboard mostrar evolução e status dos KPIs
- App rodar localmente em macOS com persistência em SQLite
