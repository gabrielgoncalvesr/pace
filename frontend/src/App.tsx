import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import './App.css';
import paceLogo from './assets/images/logo.png';
import DatePickerField from './DatePickerField';

type View = 'dashboard' | 'goals' | 'history' | 'archived';
type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
type InitiativeStatus = 'active' | 'paused' | 'archived';
type KPIStatus = 'active' | 'paused' | 'completed' | 'archived';

type Goal = { id: string; title: string; description: string; status: GoalStatus; createdAt: string; updatedAt: string; archivedAt?: string | null };
type Initiative = { id: string; goalId: string; title: string; description: string; status: InitiativeStatus; createdAt: string; updatedAt: string; archivedAt?: string | null };
type KPI = { id: string; goalId: string; initiativeId?: string | null; name: string; description: string; unit: string; customUnit: string; targetValue: number; periodType: string; allowExceedTarget: boolean; status: KPIStatus; createdAt: string; updatedAt: string; archivedAt?: string | null };
type KPIEntry = { id: string; kpiId: string; value: number; entryDate: string; comment: string; createdAt: string; updatedAt: string };
type KPIProgress = { kpiId: string; currentValue: number; targetValue: number; percentage: number; visualPercentage: number; progressStatus: string; isCompleted: boolean; hasExceededTarget: boolean };
type DashboardSummary = { totalKpis: number; activeKpis: number; completedKpis: number; overallPercent: number };

type WailsApp = {
  CreateGoal(input: { title: string; description: string }): Promise<Goal>;
  UpdateGoal(id: string, input: { title: string; description: string; status: string }): Promise<Goal>;
  ArchiveGoal(id: string): Promise<void>;
  ListGoals(): Promise<Goal[]>;
  CreateInitiative(input: { goalId: string; title: string; description: string }): Promise<Initiative>;
  ArchiveInitiative(id: string): Promise<void>;
  ListInitiatives(): Promise<Initiative[]>;
  CreateKPI(input: { goalId: string; initiativeId: string; name: string; description: string; unit: string; customUnit: string; targetValue: number; periodType: string; allowExceedTarget: boolean }): Promise<KPI>;
  ArchiveKPI(id: string): Promise<void>;
  DeleteKPI(id: string): Promise<void>;
  ListKPIs(): Promise<KPI[]>;
  RegisterKPIEntry(input: { kpiId: string; value: number; entryDate: string; comment: string }): Promise<KPIEntry>;
  UpdateKPIEntry(id: string, input: { value: number; entryDate: string; comment: string }): Promise<KPIEntry>;
  DeleteKPIEntry(id: string): Promise<void>;
  ListKPIHistory(kpiID: string): Promise<KPIEntry[]>;
  GetKPIProgress(id: string): Promise<KPIProgress>;
  GetDashboardSummary(): Promise<DashboardSummary>;
};

const appApi = () => (window as any).go.main.App as WailsApp;
const today = () => new Date().toISOString().slice(0, 10);
const prettyDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const COMMENT_MAX_CHARS = 72;

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}...`;
}

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{status.replaceAll('_', ' ')}</span>;
}

function ProgressCell({ progress }: { progress?: KPIProgress }) {
  const value = progress?.percentage ?? 0;
  const visual = Math.min(progress?.visualPercentage ?? 0, 100);
  return (
    <div className="progress-cell">
      <div className="progress-track"><div className="progress-fill" style={{ width: `${visual}%` }} /></div>
      <span>{value.toFixed(0)}%</span>
    </div>
  );
}

function EmptyState({ title, description, ctaLabel, onClick }: { title: string; description: string; ctaLabel: string; onClick: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◌</div>
      <h4>{title}</h4>
      <p>{description}</p>
      <button className="btn btn-primary" onClick={onClick}>{ctaLabel}</button>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedGoalDetailId, setSelectedGoalDetailId] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [historyByKpi, setHistoryByKpi] = useState<Record<string, KPIEntry[]>>({});
  const [progressMap, setProgressMap] = useState<Record<string, KPIProgress>>({});
  const [summary, setSummary] = useState<DashboardSummary>({ totalKpis: 0, activeKpis: 0, completedKpis: 0, overallPercent: 0 });

  const [selectedKpiId, setSelectedKpiId] = useState('');
  const [registerGoalId, setRegisterGoalId] = useState('');
  const [registerInitiativeId, setRegisterInitiativeId] = useState('');

  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [editingGoalId, setEditingGoalId] = useState('');

  const [initiativeTitle, setInitiativeTitle] = useState('');
  const [initiativeDescription, setInitiativeDescription] = useState('');

  const [kpiName, setKpiName] = useState('');
  const [kpiDescription, setKpiDescription] = useState('');
  const [kpiUnit, setKpiUnit] = useState('class');
  const [kpiTarget, setKpiTarget] = useState('1');
  const [kpiPeriod, setKpiPeriod] = useState('monthly');
  const [kpiInitiativeId, setKpiInitiativeId] = useState('');

  const [entryValue, setEntryValue] = useState('1');
  const [entryDate, setEntryDate] = useState(today());
  const [entryComment, setEntryComment] = useState('');
  const [editingEntryId, setEditingEntryId] = useState('');

  const [deleteKpiId, setDeleteKpiId] = useState('');

  const [goalOpen, setGoalOpen] = useState(false);
  const [initiativeOpen, setInitiativeOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const currentGoal = useMemo(() => goals.find((g) => g.id === selectedGoalDetailId) || null, [goals, selectedGoalDetailId]);
  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active').length, [goals]);
  const activeKpis = useMemo(() => kpis.filter((k) => k.status === 'active').length, [kpis]);

  const allRecentActivity = useMemo(() => Object.values(historyByKpi).flat().sort((a, b) => `${b.entryDate}${b.createdAt}`.localeCompare(`${a.entryDate}${a.createdAt}`)).slice(0, 30), [historyByKpi]);
  const entriesThisMonth = useMemo(() => {
    const now = new Date();
    return Object.values(historyByKpi).flat().filter((e) => {
      const d = new Date(`${e.entryDate}T00:00:00`);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [historyByKpi]);

  const goalProgress = useMemo(() => goals.filter((g) => g.status !== 'archived').map((goal) => {
    const goalKpis = kpis.filter((k) => k.goalId === goal.id && k.status !== 'archived');
    const avg = goalKpis.length ? goalKpis.reduce((acc, k) => acc + (progressMap[k.id]?.percentage ?? 0), 0) / goalKpis.length : 0;
    return { goal, kpiCount: goalKpis.length, progress: avg, visual: Math.min(avg, 100) };
  }), [goals, kpis, progressMap]);

  const needsAttention = useMemo(() => {
    return kpis
      .filter((k) => k.status === 'active' && ['monthly', 'weekly', 'annual'].includes(k.periodType))
      .map((k) => ({
        kpi: k,
        initiative: initiatives.find((i) => i.id === k.initiativeId),
        p: progressMap[k.id],
        goal: goals.find((g) => g.id === k.goalId),
      }))
      .filter((x) => (x.p?.percentage ?? 0) < 40)
      .sort((a, b) => (a.p?.percentage ?? 0) - (b.p?.percentage ?? 0))
      .slice(0, 5);
  }, [kpis, initiatives, progressMap, goals]);

  const activityHeatmap = useMemo(() => {
    const dayMap = new Map<string, number>();
    Object.values(historyByKpi).flat().forEach((entry) => {
      dayMap.set(entry.entryDate, (dayMap.get(entry.entryDate) || 0) + 1);
    });

    const days = 7 * 26;
    const end = new Date();
    const values: Array<{ date: string; value: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      values.push({ date: key, value: dayMap.get(key) || 0 });
    }

    const weeks: Array<Array<{ date: string; value: number }>> = [];
    for (let i = 0; i < values.length; i += 7) weeks.push(values.slice(i, i + 7));
    return weeks;
  }, [historyByKpi]);

  const activityMax = useMemo(() => {
    const values = activityHeatmap.flat().map((d) => d.value);
    return values.length ? Math.max(...values) : 0;
  }, [activityHeatmap]);

  const goalCards = useMemo(() => goals.filter((g) => g.status !== 'archived').map((goal) => {
    const goalInitiatives = initiatives.filter((i) => i.goalId === goal.id && i.status !== 'archived');
    const goalKpis = kpis.filter((k) => k.goalId === goal.id && k.status !== 'archived');
    const avg = goalKpis.length ? goalKpis.reduce((acc, k) => acc + (progressMap[k.id]?.percentage ?? 0), 0) / goalKpis.length : 0;
    return {
      goal,
      initiativeCount: goalInitiatives.length,
      kpiCount: goalKpis.length,
      progress: avg,
      visual: Math.min(avg, 100),
    };
  }), [goals, initiatives, kpis, progressMap]);

  const scopedInitiatives = useMemo(() => initiatives.filter((i) => i.goalId === selectedGoalDetailId && i.status !== 'archived'), [initiatives, selectedGoalDetailId]);
  const scopedKpis = useMemo(() => kpis.filter((k) => k.goalId === selectedGoalDetailId && k.status !== 'archived'), [kpis, selectedGoalDetailId]);
  const archivedKpis = useMemo(() => {
    return kpis
      .filter((k) => k.status === 'archived')
      .sort((a, b) => {
        const da = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
        const db = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
        return db - da;
      });
  }, [kpis]);

  const registerInitiatives = initiatives.filter((i) => i.goalId === registerGoalId && i.status !== 'archived');
  const registerKPIs = kpis.filter((k) => k.goalId === registerGoalId && (!registerInitiativeId || k.initiativeId === registerInitiativeId) && k.status !== 'archived');

  async function loadGoals() {
    const data = await appApi().ListGoals();
    setGoals(data);
    if (selectedGoalDetailId && !data.some((g) => g.id === selectedGoalDetailId)) {
      setSelectedGoalDetailId('');
    }
  }

  async function loadInitiatives() {
    setInitiatives(await appApi().ListInitiatives());
  }

  async function loadKPIs() {
    const data = await appApi().ListKPIs();
    setKpis(data);

    const byId: Record<string, KPIProgress> = {};
    const history: Record<string, KPIEntry[]> = {};
    for (const k of data) {
      byId[k.id] = await appApi().GetKPIProgress(k.id);
      history[k.id] = await appApi().ListKPIHistory(k.id);
    }
    setProgressMap(byId);
    setHistoryByKpi(history);
    setSummary(await appApi().GetDashboardSummary());
  }

  async function refreshAll() {
    setError('');
    try {
      await loadGoals();
      await loadInitiatives();
      await loadKPIs();
    } catch (err: any) {
      setError(err?.message ?? 'Could not load data');
    }
  }

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (registerOpen) return setRegisterOpen(false);
      if (kpiOpen) return setKpiOpen(false);
      if (initiativeOpen) return setInitiativeOpen(false);
      if (goalOpen) return setGoalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goalOpen, initiativeOpen, kpiOpen, registerOpen]);

  async function handleCreateOrEditGoal(e: FormEvent) {
    e.preventDefault();
    if (editingGoalId) {
      await appApi().UpdateGoal(editingGoalId, { title: goalTitle, description: goalDescription, status: 'active' });
    } else {
      await appApi().CreateGoal({ title: goalTitle, description: goalDescription });
    }
    setEditingGoalId('');
    setGoalTitle('');
    setGoalDescription('');
    setGoalOpen(false);
    await refreshAll();
  }

  async function handleCreateInitiative(e: FormEvent) {
    e.preventDefault();
    await appApi().CreateInitiative({ goalId: selectedGoalDetailId, title: initiativeTitle, description: initiativeDescription });
    setInitiativeTitle('');
    setInitiativeDescription('');
    setInitiativeOpen(false);
    await refreshAll();
  }

  async function handleCreateKpi(e: FormEvent) {
    e.preventDefault();
    await appApi().CreateKPI({
      goalId: selectedGoalDetailId,
      initiativeId: kpiInitiativeId,
      name: kpiName,
      description: kpiDescription,
      unit: kpiUnit,
      customUnit: '',
      targetValue: Number(kpiTarget),
      periodType: kpiPeriod,
      allowExceedTarget: true,
    });
    setKpiName('');
    setKpiDescription('');
    setKpiTarget('1');
    setKpiInitiativeId('');
    setKpiOpen(false);
    await refreshAll();
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (editingEntryId) {
      await appApi().UpdateKPIEntry(editingEntryId, { value: Number(entryValue), entryDate, comment: entryComment });
    } else {
      await appApi().RegisterKPIEntry({ kpiId: selectedKpiId, value: Number(entryValue), entryDate, comment: entryComment });
    }
    setEditingEntryId('');
    setEntryValue('1');
    setEntryDate(today());
    setEntryComment('');
    setRegisterOpen(false);
    await refreshAll();
    setToast('Registro salvo com sucesso!');
    setTimeout(() => setToast(''), 3000);
  }

  const navItems: Array<{ label: string; icon: string; view: View }> = [
    { label: 'Dashboard', icon: '◉', view: 'dashboard' },
    { label: 'KPI', icon: '◎', view: 'goals' },
    { label: 'History', icon: '◍', view: 'history' },
    { label: 'Archived', icon: '◌', view: 'archived' },
  ];

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="logo">
          <img src={paceLogo} alt="Pace logo" className="logo-img" />
          {!sidebarCollapsed && <span>Pace</span>}
        </div>
        <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((v) => !v)} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          {sidebarCollapsed ? '›' : '‹'}
        </button>
        <nav>
          {navItems.map(({ label, icon, view }) => (
            <button key={label} className={`nav-item ${activeView === view ? 'active' : ''}`} title={sidebarCollapsed ? label : undefined} onClick={() => { setActiveView(view); setSelectedGoalDetailId(''); }}>
              <span>{icon}</span>{!sidebarCollapsed && label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{activeView === 'goals' && currentGoal ? currentGoal.title : activeView[0].toUpperCase() + activeView.slice(1)}</h1>
          </div>
          <div className="top-actions">
            {activeView === 'dashboard' ? <button className="btn btn-primary" onClick={() => { setRegisterGoalId(''); setRegisterInitiativeId(''); setSelectedKpiId(''); setRegisterOpen(true); }}>Quick Register</button> : null}
            {activeView === 'goals' && !currentGoal ? <button className="btn btn-primary" onClick={() => { setEditingGoalId(''); setGoalTitle(''); setGoalDescription(''); setGoalOpen(true); }}>New Goal</button> : null}
            {activeView === 'goals' && currentGoal ? (
              <>
                <button className="btn btn-secondary" onClick={() => setInitiativeOpen(true)}>New Initiative</button>
                <button className="btn btn-primary" onClick={() => setKpiOpen(true)}>New KPI</button>
                <button className="btn btn-ghost" onClick={() => { setEditingGoalId(currentGoal.id); setGoalTitle(currentGoal.title); setGoalDescription(currentGoal.description || ''); setGoalOpen(true); }}>Edit Goal</button>
                <button className="btn btn-ghost" onClick={() => appApi().ArchiveGoal(currentGoal.id).then(refreshAll)}>Archive Goal</button>
              </>
            ) : null}
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {toast ? <div className="toast-success">{toast}</div> : null}

        {activeView === 'dashboard' ? (
          <section className="content-grid">
            <section className="stats-grid">
              <div className="stat-card premium"><div className="metric-icon">↗</div><span>Monthly Progress</span><strong>{summary.overallPercent.toFixed(1)}%</strong><small>Average progress this month</small></div>
              <div className="stat-card premium"><div className="metric-icon">◉</div><span>Active Goals</span><strong>{activeGoals}</strong><small>Goals in progress</small></div>
              <div className="stat-card premium"><div className="metric-icon">◈</div><span>Active KPIs</span><strong>{activeKpis}</strong><small>KPIs currently active</small></div>
              <div className="stat-card premium"><div className="metric-icon">✎</div><span>Entries This Month</span><strong>{entriesThisMonth}</strong><small>Progress updates registered</small></div>
            </section>

            <div className="panel">
              <div className="panel-header"><h3>Activity Tracker</h3><span className="panel-sub">Your KPI registration consistency over time</span></div>
              <div className="heatmap-wrap">
                <div className="heatmap-grid">
                  {activityHeatmap.map((week, wi) => (
                    <div key={wi} className="heatmap-week">
                      {week.map((day) => {
                        const v = day.value;
                        const level = v === 0 ? 0 : v === 1 ? 1 : v === 2 ? 2 : v === 3 ? 3 : 4;
                        return <div key={day.date} className={`heatmap-cell level-${level}`} title={`${v} registro(s) em ${prettyDate(day.date)}`} />;
                      })}
                    </div>
                  ))}
                </div>
                <div className="heatmap-legend"><span>Less</span><div className="heatmap-cell level-0" /><div className="heatmap-cell level-1" /><div className="heatmap-cell level-2" /><div className="heatmap-cell level-3" /><div className="heatmap-cell level-4" /><span>More</span></div>
              </div>
              {activityMax === 0 ? <div className="empty-inline">No activity yet. Start registering KPI progress to build your consistency map.</div> : null}
            </div>

            <div className="two-col-grid">
              <div className="panel">
                <div className="panel-header"><h3>Goal Progress</h3></div>
                {goalProgress.length === 0 ? (
                  <EmptyState title="No goals yet" description="Create your first goal to start tracking your progress." ctaLabel="New Goal" onClick={() => { setActiveView('goals'); setEditingGoalId(''); setGoalOpen(true); }} />
                ) : (
                  <div className="list-wrap">
                    {goalProgress.map((g) => (
                      <div className="list-item premium" key={g.goal.id}>
                        <div className="list-main">
                          <div className="one-line-row">
                            <span className="cell-title">{g.goal.title}</span>
                            <span className="cell-sub-inline"> · {g.kpiCount} KPI{g.kpiCount === 1 ? '' : 's'}</span>
                          </div>
                          <div className="progress-track compact-wide"><div className="progress-fill" style={{ width: `${g.visual}%` }} /></div>
                        </div>
                        <div className="list-side">{g.progress.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header"><h3>Needs Attention</h3></div>
                {needsAttention.length === 0 ? (
                  <div className="empty-inline">No low-progress KPIs right now.</div>
                ) : (
                  <div className="list-wrap">
                    {needsAttention.map(({ kpi, initiative, p }) => (
                      <div className="list-item attention premium" key={kpi.id}>
                        <div className="list-main">
                          <div className="inline-badges"><span className="tiny-badge warning">Low progress</span><span className="tiny-badge neutral">{kpi.periodType}</span></div>
                          <div className="one-line-row">
                            <span className="cell-title">{initiative?.title || 'Sem initiative'}</span>
                            <span className="cell-sub-inline"> · {kpi.name} · {p?.currentValue ?? 0} / {kpi.targetValue} {kpi.unit} · {(p?.percentage ?? 0).toFixed(0)}%</span>
                          </div>
                        </div>
                        <button className="icon-btn" onClick={() => { setRegisterGoalId(kpi.goalId); setRegisterInitiativeId(kpi.initiativeId || ''); setSelectedKpiId(kpi.id); setRegisterOpen(true); }}>Register</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </section>
        ) : null}

        {activeView === 'goals' && !currentGoal ? (
          <section className="content-grid">
            {goalCards.length === 0 ? (
              <div className="panel">
                <EmptyState title="No goals yet" description="Create your first goal to start tracking your progress." ctaLabel="New Goal" onClick={() => { setEditingGoalId(''); setGoalOpen(true); }} />
              </div>
            ) : (
              <div className="goals-grid">
                {goalCards.map((item) => (
                  <button key={item.goal.id} className="goal-card" onClick={() => setSelectedGoalDetailId(item.goal.id)}>
                    <div className="goal-card-header">
                      <h3>{item.goal.title}</h3>
                      <StatusBadge status={item.goal.status} />
                    </div>
                    <div className="goal-card-progress"><span>Progress: {item.progress.toFixed(0)}%</span><div className="progress-track"><div className="progress-fill" style={{ width: `${item.visual}%` }} /></div></div>
                    <div className="goal-card-meta">{item.initiativeCount} initiatives · {item.kpiCount} KPIs · Atualizado em {new Date(item.goal.updatedAt).toLocaleDateString('pt-BR')}</div>
                    <div className="goal-card-actions"><span className="mini-btn">Open</span><span className="mini-btn" onClick={(e) => { e.stopPropagation(); appApi().ArchiveGoal(item.goal.id).then(refreshAll); }}>Archive</span></div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeView === 'goals' && currentGoal ? (
          <section className="content-grid">
            <div className="breadcrumb"><button className="crumb" onClick={() => setSelectedGoalDetailId('')}>Goals</button> <span>/</span> <span>{currentGoal.title}</span></div>

            <div className="panel">
              <div className="panel-header"><h3>{currentGoal.title}</h3></div>
              <div className="goal-detail-summary">
                <div><strong>Status</strong><StatusBadge status={currentGoal.status} /></div>
                <div><strong>Progress</strong><span>{(goalCards.find((g) => g.goal.id === currentGoal.id)?.progress ?? 0).toFixed(0)}%</span></div>
                <div><strong>Initiatives</strong><span>{scopedInitiatives.length}</span></div>
                <div><strong>KPIs</strong><span>{scopedKpis.length}</span></div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><h3>KPIs</h3></div>
              {scopedKpis.length === 0 ? (
                <EmptyState title="No KPIs yet" description="Create your first KPI for this goal." ctaLabel="New KPI" onClick={() => setKpiOpen(true)} />
              ) : (
                <table className="data-table kpi-table">
                  <thead><tr><th>Initiative</th><th>KPI</th><th>Current</th><th>Target</th><th>Progress</th><th>Period</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {scopedKpis.map((k) => {
                      const initiative = initiatives.find((i) => i.id === k.initiativeId);
                      const p = progressMap[k.id];
                      return (
                        <tr key={k.id}>
                          <td>{initiative?.title || '-'}</td>
                          <td><div className="cell-title">{k.name}</div></td>
                          <td>{p?.currentValue ?? 0}</td>
                          <td>{k.targetValue} {k.unit}</td>
                          <td><ProgressCell progress={p} /></td>
                          <td>{k.periodType}</td>
                          <td><StatusBadge status={p?.progressStatus || k.status} /></td>
                          <td>
                            <button className="icon-btn" onClick={() => { setRegisterGoalId(k.goalId); setRegisterInitiativeId(k.initiativeId || ''); setSelectedKpiId(k.id); setEntryValue('1'); setEntryDate(today()); setEntryComment(''); setEditingEntryId(''); setRegisterOpen(true); }}>⊕</button>
                            <button className="icon-btn" title="Archive" onClick={() => appApi().ArchiveKPI(k.id).then(refreshAll)}>◌</button>
                            <button className="icon-btn danger" title="Delete" onClick={() => setDeleteKpiId(k.id)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : null}

        {activeView === 'history' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="panel-header"><h3>Recent Activity</h3></div>
              {allRecentActivity.length === 0 ? (
                <EmptyState title="No activity yet" description="Your recent KPI updates will appear here." ctaLabel="Quick Register" onClick={() => { setRegisterGoalId(''); setRegisterInitiativeId(''); setSelectedKpiId(''); setRegisterOpen(true); }} />
              ) : (
                <table className="data-table history-table">
                  <thead><tr><th>Date</th><th>Goal</th><th>KPI</th><th>Comment</th><th>Actions</th></tr></thead>
                  <tbody>
                    {allRecentActivity.map((e) => {
                      const k = kpis.find((x) => x.id === e.kpiId);
                      const kGoal = k ? goals.find((g) => g.id === k.goalId) : undefined;
                      const kInit = k ? initiatives.find((i) => i.id === k.initiativeId) : undefined;
                      return (
                        <tr key={e.id}>
                          <td className="history-date">{prettyDate(e.entryDate)}</td>
                          <td className="history-goal-cell"><div className="history-comment">{kGoal?.title || '-'}</div></td>
                          <td>
                            {k ? (
                              <div className="history-tooltip">
                                <span className="history-kpi-name">{k.name}</span>
                                <div className="history-tooltip-bubble">
                                  {kGoal && <div><strong>Goal:</strong> {kGoal.title}</div>}
                                  {kInit && <div><strong>Initiative:</strong> {kInit.title}</div>}
                                  <div><strong>Value:</strong> {e.value}</div>
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="history-comment-cell">
                            {e.comment ? (
                              <div className="history-tooltip">
                                <div className="history-comment">{truncateText(e.comment, COMMENT_MAX_CHARS)}</div>
                                <div className="history-tooltip-bubble">{e.comment}</div>
                              </div>
                            ) : (
                              <div className="history-comment">-</div>
                            )}
                          </td>
                          <td>
                            <button className="icon-btn" title="Edit" onClick={() => { setEditingEntryId(e.id); setEntryValue(String(e.value)); setEntryDate(e.entryDate); setEntryComment(e.comment || ''); setRegisterOpen(true); }}>✎</button>
                            <button className="icon-btn danger" title="Delete" onClick={() => appApi().DeleteKPIEntry(e.id).then(refreshAll)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : null}

        {activeView === 'archived' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="panel-header"><h3>Archived KPIs</h3></div>
              {archivedKpis.length === 0 ? (
                <EmptyState
                  title="Nenhuma KPI arquivada"
                  description="As KPIs arquivadas aparecerão aqui."
                  ctaLabel="Ir para KPIs"
                  onClick={() => setActiveView('goals')}
                />
              ) : (
                <table className="data-table archived-table">
                  <thead>
                    <tr>
                      <th>KPI</th>
                      <th>Initiative</th>
                      <th>Goal</th>
                      <th>Target</th>
                      <th>Period</th>
                      <th>Archived At</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedKpis.map((kpi) => {
                      const goal = goals.find((g) => g.id === kpi.goalId);
                      const initiative = initiatives.find((i) => i.id === kpi.initiativeId);
                      return (
                        <tr key={kpi.id}>
                          <td><div className="cell-title">{kpi.name}</div></td>
                          <td>{initiative?.title || '-'}</td>
                          <td>{goal?.title || '-'}</td>
                          <td>{kpi.targetValue} {kpi.unit}</td>
                          <td>{kpi.periodType}</td>
                          <td>{kpi.archivedAt ? prettyDate(kpi.archivedAt.slice(0, 10)) : '-'}</td>
                          <td><StatusBadge status={kpi.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : null}
      </div>

      <Modal open={!!deleteKpiId} title="Delete KPI" onClose={() => setDeleteKpiId('')}>
        <div className="form">
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Tem certeza? Todos os registros desta KPI serão apagados permanentemente.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDeleteKpiId('')}>Cancelar</button>
            <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={() => appApi().DeleteKPI(deleteKpiId).then(() => { setDeleteKpiId(''); refreshAll(); })}>Excluir</button>
          </div>
        </div>
      </Modal>

      <Modal open={goalOpen} title={editingGoalId ? 'Edit Goal' : 'New Goal'} onClose={() => setGoalOpen(false)}>
        <form className="form" onSubmit={handleCreateOrEditGoal}>
          <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Title" required />
          <textarea value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Description" rows={3} />
          <button className="btn btn-primary" type="submit">{editingGoalId ? 'Save Goal' : 'Create Goal'}</button>
        </form>
      </Modal>

      <Modal open={initiativeOpen} title="New Initiative" onClose={() => setInitiativeOpen(false)}>
        <form className="form" onSubmit={handleCreateInitiative}>
          <input value={initiativeTitle} onChange={(e) => setInitiativeTitle(e.target.value)} placeholder="Title" required />
          <textarea value={initiativeDescription} onChange={(e) => setInitiativeDescription(e.target.value)} placeholder="Description" rows={3} />
          <button className="btn btn-primary" type="submit">Create Initiative</button>
        </form>
      </Modal>

      <Modal open={kpiOpen} title="New KPI" onClose={() => setKpiOpen(false)}>
        <form className="form" onSubmit={handleCreateKpi}>
          <select value={kpiInitiativeId} onChange={(e) => setKpiInitiativeId(e.target.value)}>
            <option value="">No initiative</option>
            {scopedInitiatives.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
          <input value={kpiName} onChange={(e) => setKpiName(e.target.value)} placeholder="KPI name" required />
          <input type="number" min="0.01" step="0.01" value={kpiTarget} onChange={(e) => setKpiTarget(e.target.value)} placeholder="Target" required />
          <select value={kpiUnit} onChange={(e) => setKpiUnit(e.target.value)}>
            <option value="class">class</option><option value="minute">minute</option><option value="hour">hour</option><option value="day">day</option><option value="article">article</option><option value="book">book</option><option value="money">money</option><option value="step">step</option><option value="custom">custom</option>
          </select>
          <select value={kpiPeriod} onChange={(e) => setKpiPeriod(e.target.value)}>
            <option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="annual">annual</option><option value="punctual">punctual</option>
          </select>
          <textarea value={kpiDescription} onChange={(e) => setKpiDescription(e.target.value)} placeholder="Description" rows={3} />
          <button className="btn btn-primary" type="submit">Create KPI</button>
        </form>
      </Modal>

      <Modal open={registerOpen} title="Quick Register" onClose={() => setRegisterOpen(false)}>
        <form className="form" onSubmit={handleRegister}>
          <select value={registerGoalId} onChange={(e) => { setRegisterGoalId(e.target.value); setRegisterInitiativeId(''); setSelectedKpiId(''); }} required>
            <option value="">Select goal</option>
            {goals.filter((g) => g.status !== 'archived').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <select value={registerInitiativeId} onChange={(e) => { setRegisterInitiativeId(e.target.value); setSelectedKpiId(''); }}>
            <option value="">All initiatives</option>
            {registerInitiatives.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
          <select value={selectedKpiId} onChange={(e) => setSelectedKpiId(e.target.value)} required>
            <option value="">Select KPI</option>
            {registerKPIs.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <input type="number" min="0.01" step="0.01" value={entryValue} onChange={(e) => setEntryValue(e.target.value)} required />
          <DatePickerField value={entryDate} onChange={setEntryDate} placeholder="Selecione uma data" />
          <textarea value={entryComment} onChange={(e) => setEntryComment(e.target.value)} placeholder="Comment" rows={3} />
          <button className="btn btn-primary" type="submit">{editingEntryId ? 'Update Entry' : 'Register Entry'}</button>
        </form>
      </Modal>
    </div>
  );
}
