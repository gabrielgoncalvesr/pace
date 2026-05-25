import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import './App.css';
import paceLogo from './assets/images/logo.png';

type View = 'dashboard' | 'goals' | 'initiatives' | 'kpis' | 'history';
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
  ArchiveGoal(id: string): Promise<void>;
  ListGoals(): Promise<Goal[]>;
  CreateInitiative(input: { goalId: string; title: string; description: string }): Promise<Initiative>;
  ArchiveInitiative(id: string): Promise<void>;
  ListInitiativesByGoal(goalID: string): Promise<Initiative[]>;
  ListInitiatives(): Promise<Initiative[]>;
  CreateKPI(input: { goalId: string; initiativeId: string; name: string; description: string; unit: string; customUnit: string; targetValue: number; periodType: string; allowExceedTarget: boolean }): Promise<KPI>;
  ArchiveKPI(id: string): Promise<void>;
  ListKPIs(): Promise<KPI[]>;
  RegisterKPIEntry(input: { kpiId: string; value: number; entryDate: string; comment: string }): Promise<KPIEntry>;
  UpdateKPIEntry(id: string, input: { value: number; entryDate: string; comment: string }): Promise<KPIEntry>;
  DeleteKPIEntry(id: string): Promise<void>;
  ListKPIHistory(kpiID: string): Promise<KPIEntry[]>;
  GetKPIProgress(id: string): Promise<KPIProgress>;
  GetDashboardSummary(): Promise<DashboardSummary>;
  ImportKPIsFromSheet(): Promise<{ goalsCreated: number; initiativesCreated: number; kpisCreated: number; entriesCreated: number }>;
};

const appApi = () => (window as any).go.main.App as WailsApp;
const today = () => new Date().toISOString().slice(0, 10);

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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [entries, setEntries] = useState<KPIEntry[]>([]);
  const [historyByKpi, setHistoryByKpi] = useState<Record<string, KPIEntry[]>>({});
  const [progressMap, setProgressMap] = useState<Record<string, KPIProgress>>({});
  const [summary, setSummary] = useState<DashboardSummary>({ totalKpis: 0, activeKpis: 0, completedKpis: 0, overallPercent: 0 });

  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedInitiativeId, setSelectedInitiativeId] = useState('');
  const [selectedKpiId, setSelectedKpiId] = useState('');
  const [registerGoalId, setRegisterGoalId] = useState('');
  const [registerInitiativeId, setRegisterInitiativeId] = useState('');

  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [initiativeTitle, setInitiativeTitle] = useState('');
  const [initiativeDescription, setInitiativeDescription] = useState('');
  const [kpiName, setKpiName] = useState('');
  const [kpiDescription, setKpiDescription] = useState('');
  const [kpiUnit, setKpiUnit] = useState('class');
  const [kpiTarget, setKpiTarget] = useState('1');
  const [kpiPeriod, setKpiPeriod] = useState('monthly');
  const [entryValue, setEntryValue] = useState('1');
  const [entryDate, setEntryDate] = useState(today());
  const [entryComment, setEntryComment] = useState('');
  const [editingEntryId, setEditingEntryId] = useState('');

  const [goalOpen, setGoalOpen] = useState(false);
  const [initiativeOpen, setInitiativeOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [error, setError] = useState('');

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active').length, [goals]);
  const activeKpis = useMemo(() => kpis.filter((k) => k.status === 'active').length, [kpis]);

  const allRecentActivity = useMemo(() => Object.values(historyByKpi).flat().sort((a, b) => `${b.entryDate}${b.createdAt}`.localeCompare(`${a.entryDate}${a.createdAt}`)).slice(0, 8), [historyByKpi]);
  const entriesThisMonth = useMemo(() => {
    const now = new Date();
    return Object.values(historyByKpi).flat().filter((e) => {
      const d = new Date(`${e.entryDate}T00:00:00`);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [historyByKpi]);

  const goalProgress = useMemo(() => {
    return goals
      .filter((g) => g.status !== 'archived')
      .map((goal) => {
        const goalKpis = kpis.filter((k) => k.goalId === goal.id && k.status !== 'archived');
        const avg = goalKpis.length
          ? goalKpis.reduce((acc, k) => acc + (progressMap[k.id]?.percentage ?? 0), 0) / goalKpis.length
          : 0;
        return { goal, kpiCount: goalKpis.length, progress: avg, visual: Math.min(avg, 100) };
      })
      .sort((a, b) => b.progress - a.progress);
  }, [goals, kpis, progressMap]);

  const needsAttention = useMemo(() => {
    return kpis
      .filter((k) => k.status === 'active' && ['monthly', 'weekly', 'annual'].includes(k.periodType))
      .map((k) => ({ kpi: k, p: progressMap[k.id] }))
      .filter((x) => (x.p?.percentage ?? 0) < 40)
      .sort((a, b) => (a.p?.percentage ?? 0) - (b.p?.percentage ?? 0))
      .slice(0, 8);
  }, [kpis, progressMap]);

  const todayFocus = useMemo(() => {
    const t = today();
    return kpis
      .filter((k) => k.status === 'active' && k.periodType === 'daily')
      .map((k) => {
        const p = progressMap[k.id];
        const hasToday = (historyByKpi[k.id] || []).some((e) => e.entryDate === t);
        return { kpi: k, p, hasToday };
      })
      .filter((x) => !x.hasToday)
      .sort((a, b) => (a.p?.percentage ?? 0) - (b.p?.percentage ?? 0))
      .slice(0, 8);
  }, [kpis, progressMap, historyByKpi]);

  async function loadGoals() {
    const data = await appApi().ListGoals();
    setGoals(data);
    const fallback = data.find((g) => g.status !== 'archived')?.id ?? data[0]?.id ?? '';
    setSelectedGoalId((prev) => (prev && data.some((g) => g.id === prev) ? prev : fallback));
  }

  async function loadInitiatives() {
    const data = await appApi().ListInitiatives();
    setInitiatives(data);
    const filtered = data.filter((i) => i.goalId === selectedGoalId);
    setSelectedInitiativeId((prev) => (prev && filtered.some((i) => i.id === prev) ? prev : filtered[0]?.id ?? ''));
  }

  async function loadKPIs() {
    const data = await appApi().ListKPIs();
    setKpis(data);
    const fallback = data.find((k) => k.status !== 'archived')?.id ?? data[0]?.id ?? '';
    setSelectedKpiId((prev) => (prev && data.some((k) => k.id === prev) ? prev : fallback));

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

  async function loadEntries(kpiID: string) {
    if (!kpiID) return setEntries([]);
    setEntries(await appApi().ListKPIHistory(kpiID));
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
  useEffect(() => { loadEntries(selectedKpiId).catch((err:any)=>setError(err?.message ?? 'Could not load history')); }, [selectedKpiId]);
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

  async function handleCreateGoal(e: FormEvent) {
    e.preventDefault();
    await appApi().CreateGoal({ title: goalTitle, description: goalDescription });
    setGoalTitle(''); setGoalDescription(''); setGoalOpen(false);
    await refreshAll();
  }

  async function handleCreateInitiative(e: FormEvent) {
    e.preventDefault();
    await appApi().CreateInitiative({ goalId: selectedGoalId, title: initiativeTitle, description: initiativeDescription });
    setInitiativeTitle(''); setInitiativeDescription(''); setInitiativeOpen(false);
    await refreshAll();
  }

  async function handleCreateKpi(e: FormEvent) {
    e.preventDefault();
    await appApi().CreateKPI({ goalId: selectedGoalId, initiativeId: selectedInitiativeId, name: kpiName, description: kpiDescription, unit: kpiUnit, customUnit: '', targetValue: Number(kpiTarget), periodType: kpiPeriod, allowExceedTarget: true });
    setKpiName(''); setKpiDescription(''); setKpiTarget('1'); setKpiOpen(false);
    await refreshAll();
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (editingEntryId) {
      await appApi().UpdateKPIEntry(editingEntryId, { value: Number(entryValue), entryDate, comment: entryComment });
    } else {
      await appApi().RegisterKPIEntry({ kpiId: selectedKpiId, value: Number(entryValue), entryDate, comment: entryComment });
    }
    setEditingEntryId(''); setEntryValue('1'); setEntryDate(today()); setEntryComment(''); setRegisterOpen(false);
    await refreshAll();
  }

  const navItems: Array<{ label: string; icon: string; view: View }> = [
    { label: 'Dashboard', icon: '◉', view: 'dashboard' },
    { label: 'Goals', icon: '◎', view: 'goals' },
    { label: 'Initiatives', icon: '◌', view: 'initiatives' },
    { label: 'KPIs', icon: '◈', view: 'kpis' },
    { label: 'History', icon: '◍', view: 'history' },
  ];

  const registerInitiatives = initiatives.filter((i) => i.goalId === registerGoalId && i.status !== 'archived');
  const registerKPIs = kpis.filter((k) => k.goalId === registerGoalId && (!registerInitiativeId || k.initiativeId === registerInitiativeId) && k.status !== 'archived');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo"><img src={paceLogo} alt="Pace logo" className="logo-img" /><span>Pace</span></div>
        <nav>
          {navItems.map(({ label, icon, view }) => (
            <button key={label} className={`nav-item ${activeView === view ? 'active' : ''}`} onClick={() => setActiveView(view)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{activeView === 'dashboard' ? 'Pace' : activeView[0].toUpperCase() + activeView.slice(1)}</h1>
            <p>{activeView === 'dashboard' ? 'Track your goals and personal KPIs' : 'Manage your personal performance data'}</p>
          </div>
          <div className="top-actions">
            {activeView === 'dashboard' ? (
              <>
                <button className="btn btn-ghost" onClick={() => setActiveView('kpis')}>View KPIs</button>
                <button className="btn btn-secondary" onClick={() => { setRegisterGoalId(selectedGoalId); setRegisterInitiativeId(''); setRegisterOpen(true); }}>Quick Register</button>
              </>
            ) : null}
            {activeView === 'goals' ? <button className="btn btn-primary" onClick={() => setGoalOpen(true)}>New Goal</button> : null}
            {activeView === 'initiatives' ? <button className="btn btn-primary" onClick={() => setInitiativeOpen(true)}>New Initiative</button> : null}
            {activeView === 'kpis' ? <button className="btn btn-primary" onClick={() => setKpiOpen(true)}>New KPI</button> : null}
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        {activeView === 'dashboard' ? (
          <section className="content-grid">
            <section className="stats-grid">
              <div className="stat-card"><span>↗ Monthly Progress</span><strong>{summary.overallPercent.toFixed(1)}%</strong><small>Average progress this month</small></div>
              <div className="stat-card"><span>◉ Active Goals</span><strong>{activeGoals}</strong><small>Goals in progress</small></div>
              <div className="stat-card"><span>◈ Active KPIs</span><strong>{activeKpis}</strong><small>KPIs currently active</small></div>
              <div className="stat-card"><span>✎ Entries This Month</span><strong>{entriesThisMonth}</strong><small>Progress updates registered</small></div>
            </section>

            <div className="two-col-grid">
              <div className="panel">
                <div className="panel-header"><h3>Goal Progress</h3></div>
                {goalProgress.length === 0 ? (
                  <EmptyState title="No goals yet" description="Create your first goal to start tracking progress." ctaLabel="Create Goal" onClick={() => setGoalOpen(true)} />
                ) : (
                  <div className="list-wrap">
                    {goalProgress.map((g) => (
                      <div className="list-item" key={g.goal.id}>
                        <div>
                          <div className="cell-title">{g.goal.title}</div>
                          <div className="cell-sub">{g.kpiCount} KPI{g.kpiCount === 1 ? '' : 's'}</div>
                        </div>
                        <div className="item-right">
                          <span>{g.progress.toFixed(0)}%</span>
                          <div className="progress-track compact"><div className="progress-fill" style={{ width: `${g.visual}%` }} /></div>
                        </div>
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
                    {needsAttention.map(({ kpi, p }) => {
                      const goal = goals.find((g) => g.id === kpi.goalId);
                      return (
                        <div className="list-item attention" key={kpi.id}>
                          <div>
                            <div className="cell-title">{kpi.name}</div>
                            <div className="cell-sub">{goal?.title || '-'} · {p?.currentValue ?? 0} / {kpi.targetValue} {kpi.unit} · {kpi.periodType} · {(p?.percentage ?? 0).toFixed(0)}%</div>
                          </div>
                          <button className="icon-btn" onClick={() => { setRegisterGoalId(kpi.goalId); setRegisterInitiativeId(kpi.initiativeId || ''); setSelectedKpiId(kpi.id); setRegisterOpen(true); }}>Register</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="two-col-grid">
              <div className="panel">
                <div className="panel-header"><h3>Today Focus</h3></div>
                {todayFocus.length === 0 ? (
                  <div className="empty-inline">No daily KPI pending for today.</div>
                ) : (
                  <div className="list-wrap">
                    {todayFocus.map(({ kpi, p }) => {
                      const goal = goals.find((g) => g.id === kpi.goalId);
                      return (
                        <div className="list-item" key={kpi.id}>
                          <div>
                            <div className="cell-title">{kpi.name}</div>
                            <div className="cell-sub">{goal?.title || '-'} · {p?.currentValue ?? 0} / {kpi.targetValue} {kpi.unit}</div>
                          </div>
                          <button className="icon-btn" onClick={() => { setRegisterGoalId(kpi.goalId); setRegisterInitiativeId(kpi.initiativeId || ''); setSelectedKpiId(kpi.id); setEntryValue('1'); setRegisterOpen(true); }}>+1</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header"><h3>Recent Activity</h3></div>
                {allRecentActivity.length === 0 ? (
                  <EmptyState title="No activity yet" description="Your recent KPI updates will appear here." ctaLabel="Quick Register" onClick={() => { setRegisterGoalId(selectedGoalId); setRegisterInitiativeId(''); setRegisterOpen(true); }} />
                ) : (
                  <div className="list-wrap">
                    {allRecentActivity.map((e) => {
                      const k = kpis.find((x) => x.id === e.kpiId);
                      return (
                        <div className="list-item" key={e.id}>
                          <div>
                            <div className="cell-title">{e.entryDate} · {k?.name || '-'}</div>
                            <div className="cell-sub">+{e.value} {e.comment || ''}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === 'goals' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="panel-header"><h3>Goals</h3></div>
              {goals.length === 0 ? <EmptyState title="No goals yet" description="Create your first goal to organize your roadmap." ctaLabel="Create Goal" onClick={() => setGoalOpen(true)} /> : (
                <table className="data-table goals-table"><thead><tr><th>Title</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{goals.map((goal) => <tr key={goal.id}><td><div className="cell-title">{goal.title}</div><div className="cell-sub">{goal.description || 'No description'}</div></td><td><StatusBadge status={goal.status} /></td><td>{new Date(goal.updatedAt).toLocaleDateString('en-US')}</td><td><button className="icon-btn" onClick={() => appApi().ArchiveGoal(goal.id).then(refreshAll)}>Archive</button></td></tr>)}</tbody></table>
              )}
            </div>
          </section>
        ) : null}

        {activeView === 'initiatives' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="panel-header"><h3>Initiatives</h3></div>
              {initiatives.length === 0 ? <EmptyState title="No initiatives yet" description="Create initiatives to connect actions to goals." ctaLabel="Create Initiative" onClick={() => setInitiativeOpen(true)} /> : (
                <table className="data-table initiatives-table"><thead><tr><th>Title</th><th>Goal</th><th>Status</th><th>Actions</th></tr></thead><tbody>{initiatives.map((initiative) => { const goal = goals.find((g) => g.id === initiative.goalId); return <tr key={initiative.id}><td><div className="cell-title">{initiative.title}</div><div className="cell-sub">{initiative.description || 'No description'}</div></td><td>{goal?.title || '-'}</td><td><StatusBadge status={initiative.status} /></td><td><button className="icon-btn" onClick={() => appApi().ArchiveInitiative(initiative.id).then(refreshAll)}>Archive</button></td></tr>; })}</tbody></table>
              )}
            </div>
          </section>
        ) : null}

        {activeView === 'kpis' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="panel-header"><h3>KPIs</h3></div>
              {kpis.length === 0 ? <EmptyState title="No KPIs yet" description="Create your first KPI to start tracking progress." ctaLabel="Create KPI" onClick={() => setKpiOpen(true)} /> : (
                <table className="data-table kpi-table"><thead><tr><th>KPI</th><th>Goal</th><th>Initiative</th><th>Current</th><th>Target</th><th>Progress</th><th>Period</th><th>Status</th><th>Actions</th></tr></thead><tbody>{kpis.map((k) => { const goal = goals.find((g) => g.id === k.goalId); const initiative = initiatives.find((i) => i.id === k.initiativeId); const p = progressMap[k.id]; return <tr key={k.id}><td><div className="cell-title">{k.name}</div><div className="cell-sub">{k.description || 'No description'}</div></td><td>{goal?.title || '-'}</td><td>{initiative?.title || '-'}</td><td>{p?.currentValue ?? 0}</td><td>{k.targetValue} {k.unit}</td><td><ProgressCell progress={p} /></td><td>{k.periodType}</td><td><StatusBadge status={p?.progressStatus || k.status} /></td><td><button className="icon-btn" onClick={() => appApi().ArchiveKPI(k.id).then(refreshAll)}>Archive</button></td></tr>; })}</tbody></table>
              )}
            </div>
          </section>
        ) : null}

        {activeView === 'history' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="panel-header"><h3>Recent Activity</h3></div>
              {allRecentActivity.length === 0 ? <EmptyState title="No activity yet" description="Your recent KPI updates will appear here." ctaLabel="Quick Register" onClick={() => { setRegisterGoalId(selectedGoalId); setRegisterInitiativeId(''); setRegisterOpen(true); }} /> : (
                <table className="data-table history-table"><thead><tr><th>Date</th><th>KPI</th><th>Value</th><th>Comment</th><th>Actions</th></tr></thead><tbody>{allRecentActivity.map((e) => { const k = kpis.find((x) => x.id === e.kpiId); return <tr key={e.id}><td>{e.entryDate}</td><td>{k?.name || '-'}</td><td>{e.value}</td><td className="cell-sub">{e.comment || '-'}</td><td><button className="icon-btn" onClick={() => { setEditingEntryId(e.id); setEntryValue(String(e.value)); setEntryDate(e.entryDate); setEntryComment(e.comment || ''); setRegisterOpen(true); }}>Edit</button> <button className="icon-btn" onClick={() => appApi().DeleteKPIEntry(e.id).then(refreshAll)}>Delete</button></td></tr>; })}</tbody></table>
              )}
            </div>
          </section>
        ) : null}
      </div>

      <Modal open={goalOpen} title="New Goal" onClose={() => setGoalOpen(false)}>
        <form className="form" onSubmit={handleCreateGoal}>
          <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Title" required />
          <textarea value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Description" rows={3} />
          <button className="btn btn-primary" type="submit">Create Goal</button>
        </form>
      </Modal>

      <Modal open={initiativeOpen} title="New Initiative" onClose={() => setInitiativeOpen(false)}>
        <form className="form" onSubmit={handleCreateInitiative}>
          <select value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)} required>
            <option value="">Select goal</option>
            {goals.filter((g) => g.status !== 'archived').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <input value={initiativeTitle} onChange={(e) => setInitiativeTitle(e.target.value)} placeholder="Title" required />
          <textarea value={initiativeDescription} onChange={(e) => setInitiativeDescription(e.target.value)} placeholder="Description" rows={3} />
          <button className="btn btn-primary" type="submit">Create Initiative</button>
        </form>
      </Modal>

      <Modal open={kpiOpen} title="New KPI" onClose={() => setKpiOpen(false)}>
        <form className="form" onSubmit={handleCreateKpi}>
          <select value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)} required>
            <option value="">Select goal</option>
            {goals.filter((g) => g.status !== 'archived').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <select value={selectedInitiativeId} onChange={(e) => setSelectedInitiativeId(e.target.value)}>
            <option value="">No initiative</option>
            {initiatives.filter((i) => i.goalId === selectedGoalId && i.status !== 'archived').map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
          <input value={kpiName} onChange={(e) => setKpiName(e.target.value)} placeholder="Name" required />
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
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
          <textarea value={entryComment} onChange={(e) => setEntryComment(e.target.value)} placeholder="Comment" rows={3} />
          <button className="btn btn-primary" type="submit">{editingEntryId ? 'Update Entry' : 'Register Entry'}</button>
        </form>
      </Modal>
    </div>
  );
}
