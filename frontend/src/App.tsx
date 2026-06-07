import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import './App.css';
import paceLogo from './assets/images/logo.png';
import DatePickerField from './DatePickerField';

type View = 'dashboard' | 'goals' | 'history' | 'archived' | 'reviews';
type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
type InitiativeStatus = 'active' | 'paused' | 'archived';
type KPIStatus = 'active' | 'paused' | 'completed' | 'archived';

type Goal = { id: string; title: string; description: string; status: GoalStatus; createdAt: string; updatedAt: string; archivedAt?: string | null };
type Initiative = { id: string; goalId: string; title: string; description: string; status: InitiativeStatus; createdAt: string; updatedAt: string; archivedAt?: string | null };
type KPI = { id: string; goalId: string; initiativeId?: string | null; name: string; description: string; unit: string; customUnit: string; targetValue: number; periodType: string; allowExceedTarget: boolean; status: KPIStatus; createdAt: string; updatedAt: string; archivedAt?: string | null };
type KPIEntry = { id: string; kpiId: string; value: number; entryDate: string; comment: string; createdAt: string; updatedAt: string };
type KPIProgress = { kpiId: string; currentValue: number; targetValue: number; percentage: number; visualPercentage: number; progressStatus: string; isCompleted: boolean; hasExceededTarget: boolean };
type DashboardSummary = { totalKpis: number; activeKpis: number; completedKpis: number; overallPercent: number };
type Snapshot = { id: string; label: string; takenAt: string; createdAt: string };
type KPIComparison = {
  kpiId: string; kpiName: string; kpiUnit: string; kpiCustomUnit: string;
  periodType: string; valueA: number; valueB: number; delta: number;
  progressA: number | null; progressB: number | null;
  entriesInPeriod: number; status: string; successorKpiId: string;
};

type WailsApp = {
  CreateGoal(input: { title: string; description: string }): Promise<Goal>;
  UpdateGoal(id: string, input: { title: string; description: string; status: string }): Promise<Goal>;
  ArchiveGoal(id: string): Promise<void>;
  ListGoals(): Promise<Goal[]>;
  CreateInitiative(input: { goalId: string; title: string; description: string }): Promise<Initiative>;
  ArchiveInitiative(id: string): Promise<void>;
  ListInitiatives(): Promise<Initiative[]>;
  CreateKPI(input: { goalId: string; initiativeId: string; name: string; description: string; unit: string; customUnit: string; targetValue: number; periodType: string; allowExceedTarget: boolean }): Promise<KPI>;
  UpdateKPI(id: string, input: { name: string; description: string; unit: string; customUnit: string; targetValue: number; periodType: string; allowExceedTarget: boolean; status: string }): Promise<KPI>;
  ArchiveKPI(id: string): Promise<void>;
  UnarchiveKPI(id: string): Promise<void>;
  DeleteKPI(id: string): Promise<void>;
  ListKPIs(): Promise<KPI[]>;
  RegisterKPIEntry(input: { kpiId: string; value: number; entryDate: string; comment: string }): Promise<KPIEntry>;
  UpdateKPIEntry(id: string, input: { value: number; entryDate: string; comment: string }): Promise<KPIEntry>;
  DeleteKPIEntry(id: string): Promise<void>;
  ListKPIHistory(kpiID: string): Promise<KPIEntry[]>;
  GetKPIProgress(id: string): Promise<KPIProgress>;
  GetDashboardSummary(): Promise<DashboardSummary>;
  CreateSnapshot(label: string): Promise<Snapshot>;
  ListSnapshots(): Promise<Snapshot[]>;
  CompareSnapshots(snapshotAId: string, snapshotBId: string): Promise<KPIComparison[]>;
  SetKPISuccessor(kpiId: string, successorId: string): Promise<void>;
};

const appApi = () => (window as any).go.main.App as WailsApp;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const prettyDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const COMMENT_MAX_CHARS = 72;

const UNIT_LABELS: Record<string, string> = {
  class: 'Aula', text: 'Texto', minute: 'Minuto', hour: 'Hora',
  article: 'Artigo', custom: 'Customizado', day: 'Dia',
  money: 'Quantidade', step: 'Etapa', book: 'Livro',
};
const translateUnit = (unit: string, customUnit?: string) =>
  customUnit && customUnit.trim() ? customUnit : (UNIT_LABELS[unit] ?? unit);

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal', annual: 'Anual', punctual: 'Pontual',
};
const translatePeriod = (p: string) => PERIOD_LABELS[p] ?? p;

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

  const [historyFilterGoal, setHistoryFilterGoal] = useState('');
  const [historyFilterKpi, setHistoryFilterKpi] = useState('');
  const [historyFilterText, setHistoryFilterText] = useState('');
  const [historyFilterDateFrom, setHistoryFilterDateFrom] = useState('');
  const [historyFilterDateTo, setHistoryFilterDateTo] = useState('');
  const [historyFiltering, setHistoryFiltering] = useState(false);
  const historyFilterTimer = useState<ReturnType<typeof setTimeout> | null>(null);
  const triggerHistoryFilter = () => {
    setHistoryFiltering(true);
    if (historyFilterTimer[0]) clearTimeout(historyFilterTimer[0]);
    historyFilterTimer[1](setTimeout(() => setHistoryFiltering(false), 350));
  };

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapIds, setSelectedSnapIds] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<KPIComparison[] | null>(null);
  const [newSnapLabel, setNewSnapLabel] = useState('');
  const [newSnapOpen, setNewSnapOpen] = useState(false);

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

  const [editKpiId, setEditKpiId] = useState('');
  const [editKpiName, setEditKpiName] = useState('');
  const [editKpiTarget, setEditKpiTarget] = useState('1');
  const [editKpiDescription, setEditKpiDescription] = useState('');
  const [editKpiPeriod, setEditKpiPeriod] = useState('monthly');
  const [editKpiOpen, setEditKpiOpen] = useState(false);
  const [openKpiMenu, setOpenKpiMenu] = useState<string | null>(null);

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
    const avg = goalKpis.length ? goalKpis.reduce((acc, k) => acc + Math.min(progressMap[k.id]?.percentage ?? 0, 100), 0) / goalKpis.length : 0;
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
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

  const activityStats = useMemo(() => {
    const flat = activityHeatmap.flat();
    const activeDays = flat.filter(d => d.value > 0).length;
    let bestStreak = 0, cur = 0;
    for (const d of flat) { if (d.value > 0) { cur++; bestStreak = Math.max(bestStreak, cur); } else cur = 0; }
    let currentStreak = 0;
    for (let i = flat.length - 1; i >= 0; i--) { if (flat[i].value > 0) currentStreak++; else break; }
    return { activeDays, bestStreak, currentStreak };
  }, [activityHeatmap]);

  const goalCards = useMemo(() => goals.filter((g) => g.status !== 'archived').map((goal) => {
    const goalInitiatives = initiatives.filter((i) => i.goalId === goal.id && i.status !== 'archived');
    const goalKpis = kpis.filter((k) => k.goalId === goal.id && k.status !== 'archived');
    const avg = goalKpis.length ? goalKpis.reduce((acc, k) => acc + Math.min(progressMap[k.id]?.percentage ?? 0, 100), 0) / goalKpis.length : 0;
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
    if (activeView === 'reviews') {
      appApi().ListSnapshots().then(setSnapshots).catch(console.error);
      setSelectedSnapIds([]);
      setComparisons(null);
    }
  }, [activeView]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (registerOpen) return setRegisterOpen(false);
      if (editKpiOpen) return setEditKpiOpen(false);
      if (kpiOpen) return setKpiOpen(false);
      if (initiativeOpen) return setInitiativeOpen(false);
      if (goalOpen) return setGoalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goalOpen, initiativeOpen, kpiOpen, registerOpen, editKpiOpen]);

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
    setToast('Entry saved!');
    setTimeout(() => setToast(''), 3000);
  }

  async function handleUpdateKpi(e: FormEvent) {
    e.preventDefault();
    await appApi().UpdateKPI(editKpiId, {
      name: editKpiName,
      description: editKpiDescription,
      unit: '',
      customUnit: '',
      targetValue: Number(editKpiTarget),
      periodType: editKpiPeriod,
      allowExceedTarget: true,
      status: 'active',
    });
    setEditKpiOpen(false);
    await refreshAll();
  }

  const handleCreateSnapshot = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSnapLabel.trim()) return;
    const snap = await appApi().CreateSnapshot(newSnapLabel.trim());
    setSnapshots(prev => [snap, ...prev]);
    setNewSnapLabel('');
    setNewSnapOpen(false);
  };

  const toggleSnapSelection = (id: string) => {
    setSelectedSnapIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
    setComparisons(null);
  };

  const handleCompare = async () => {
    if (selectedSnapIds.length !== 2) return;
    const sorted = [...selectedSnapIds].sort((a, b) => {
      const snapA = snapshots.find(s => s.id === a)!;
      const snapB = snapshots.find(s => s.id === b)!;
      return new Date(snapA.takenAt).getTime() - new Date(snapB.takenAt).getTime();
    });
    const result = await appApi().CompareSnapshots(sorted[0], sorted[1]);
    setComparisons(result);
  };

  const navItems: Array<{ label: string; icon: string; view: View }> = [
    { label: 'Dashboard', icon: '◉', view: 'dashboard' },
    { label: 'KPI', icon: '◎', view: 'goals' },
    { label: 'History', icon: '◍', view: 'history' },
    { label: 'Archived', icon: '◌', view: 'archived' },
    { label: 'Reviews', icon: '⊙', view: 'reviews' },
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

        <div className="main-content">
        {error ? <div className="error-banner">{error}</div> : null}
        {toast ? <div className="toast-success">{toast}</div> : null}

        {activeView === 'dashboard' ? (
          <section className="content-grid">
            {/* Stat cards */}
            <section className="stats-grid">
              <div className="stat-card premium">
                <span className="sc-label">Monthly Progress</span>
                <strong className="sc-value">{summary.overallPercent.toFixed(1)}%</strong>
                <small className="sc-sub">Average of active KPIs</small>
              </div>
              <div className="stat-card premium">
                <span className="sc-label">Active Goals</span>
                <strong className="sc-value">{activeGoals}</strong>
                <small className="sc-sub">{activeGoals === 0 ? 'No goals yet' : `${activeGoals} in progress`}</small>
              </div>
              <div className="stat-card premium">
                <span className="sc-label">Active KPIs</span>
                <strong className="sc-value">{activeKpis}</strong>
                <small className="sc-sub">{activeKpis === 0 ? 'No active KPIs' : 'KPIs being tracked'}</small>
              </div>
              <div className="stat-card premium">
                <span className="sc-label">Entries this month</span>
                <strong className="sc-value">{entriesThisMonth}</strong>
                <small className="sc-sub">{entriesThisMonth === 0 ? 'No entries yet' : 'Updates recorded'}</small>
              </div>
            </section>

            {/* Activity Tracker */}
            <div className="panel">
              <div className="panel-header">
                <h3>Activity Tracker</h3>
                <div className="heatmap-stats">
                  <span className="hm-stat"><strong>{activityStats.activeDays}</strong> active days</span>
                  <span className="hm-stat-sep">·</span>
                  <span className="hm-stat">Current streak: <strong>{activityStats.currentStreak}</strong></span>
                  <span className="hm-stat-sep">·</span>
                  <span className="hm-stat">Best: <strong>{activityStats.bestStreak}</strong></span>
                </div>
              </div>
              {activityMax === 0 ? (
                <div className="empty-inline">No activity yet. Log entries on your KPIs to build your consistency map.</div>
              ) : (
                <div className="heatmap-wrap">
                  <div className="heatmap-grid">
                    {activityHeatmap.map((week, wi) => (
                      <div key={wi} className="heatmap-week">
                        {week.map((day) => {
                          const v = day.value;
                          const level = v === 0 ? 0 : v === 1 ? 1 : v === 2 ? 2 : v === 3 ? 3 : 4;
                          return <div key={day.date} className={`heatmap-cell level-${level}`} title={`${v} entr${v === 1 ? 'y' : 'ies'} on ${prettyDate(day.date)}`} />;
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="heatmap-legend"><span>Less</span><div className="heatmap-cell level-0" /><div className="heatmap-cell level-1" /><div className="heatmap-cell level-2" /><div className="heatmap-cell level-3" /><div className="heatmap-cell level-4" /><span>More</span></div>
                </div>
              )}
            </div>

            <div className="two-col-grid">
              {/* Goal Progress */}
              <div className="panel">
                <div className="panel-header"><h3>Goal Progress</h3></div>
                {goalProgress.length === 0 ? (
                  <EmptyState title="No goals yet" description="Create your first goal to get started." ctaLabel="New Goal" onClick={() => { setActiveView('goals'); setEditingGoalId(''); setGoalOpen(true); }} />
                ) : (
                  <div className="list-wrap">
                    {goalProgress.map((g) => {
                      const pct = g.progress.toFixed(0);
                      const progColor = g.progress >= 80 ? '#16a34a' : g.progress >= 40 ? 'var(--accent)' : g.progress === 0 ? '#d1d5db' : 'var(--accent)';
                      return (
                        <div
                          className="gp-item"
                          key={g.goal.id}
                          onClick={() => { setSelectedGoalDetailId(g.goal.id); setActiveView('goals'); }}
                        >
                          <div className="gp-header">
                            <span className="gp-title">{g.goal.title}</span>
                            <span className="gp-pct" style={{ color: progColor }}>{pct}%</span>
                          </div>
                          <div className="gp-track">
                            <div className="gp-fill" style={{ width: `${g.visual}%`, background: progColor }} />
                          </div>
                          <span className="gp-meta">{g.kpiCount} KPI{g.kpiCount !== 1 ? 's' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Needs Attention */}
              <div className="panel">
                <div className="panel-header"><h3>Needs Attention</h3><span className="panel-sub">KPIs with low progress</span></div>
                {needsAttention.length === 0 ? (
                  <div className="empty-inline" style={{ color: '#16a34a' }}>All good. No KPIs with low progress.</div>
                ) : (
                  <div className="list-wrap">
                    {needsAttention.map(({ kpi, initiative, p, goal }, idx) => {
                      const pct = p?.percentage ?? 0;
                      const isFirst = idx === 0;
                      return (
                        <div className={`na-item${isFirst ? ' na-item-critical' : ''}`} key={kpi.id}>
                          <div className="na-main">
                            <div className="na-top">
                              <span className="na-kpi">{kpi.name}</span>
                              <span className={`na-pct${pct < 20 ? ' na-pct-danger' : ''}`}>{pct.toFixed(0)}%</span>
                            </div>
                            <span className="na-meta">{goal?.title}{initiative ? ` · ${initiative.title}` : ''}</span>
                            <div className="na-track">
                              <div className="na-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                          <button className="icon-btn na-btn" disabled={kpi.periodType === 'punctual' && (historyByKpi[kpi.id]?.length ?? 0) > 0} onClick={() => { setRegisterGoalId(kpi.goalId); setRegisterInitiativeId(kpi.initiativeId || ''); setSelectedKpiId(kpi.id); setRegisterOpen(true); }}>⊕</button>
                        </div>
                      );
                    })}
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
                {goalCards.map((item) => {
                  const progColor = item.progress >= 80 ? '#16a34a' : item.progress >= 40 ? 'var(--accent)' : item.progress === 0 ? '#d1d5db' : 'var(--accent)';
                  return (
                    <button key={item.goal.id} className="goal-card" onClick={() => setSelectedGoalDetailId(item.goal.id)}>
                      <div className="gc-top">
                        <StatusBadge status={item.goal.status} />
                        <button
                          className="gc-archive-btn"
                          title="Archive"
                          onClick={(e) => { e.stopPropagation(); appApi().ArchiveGoal(item.goal.id).then(refreshAll); }}
                        >
                          ◌
                        </button>
                      </div>
                      <h3 className="gc-title">{item.goal.title}</h3>
                      <div className="gc-progress">
                        <div className="gc-progress-header">
                          <span className="gc-progress-label">Progress</span>
                          <span className="gc-progress-pct" style={{ color: progColor }}>{item.progress.toFixed(0)}%</span>
                        </div>
                        <div className="gc-track">
                          <div className="gc-fill" style={{ width: `${item.visual}%`, background: progColor }} />
                        </div>
                      </div>
                      <div className="gc-meta">
                        <span className="gc-meta-item">
                          <span className="gc-meta-icon">⬡</span>{item.initiativeCount} initiative{item.initiativeCount !== 1 ? 's' : ''}
                        </span>
                        <span className="gc-meta-dot" />
                        <span className="gc-meta-item">
                          <span className="gc-meta-icon">◎</span>{item.kpiCount} KPI{item.kpiCount !== 1 ? 's' : ''}
                        </span>
                        <span className="gc-meta-dot" />
                        <span className="gc-meta-item gc-meta-date">
                          {new Date(item.goal.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {activeView === 'goals' && currentGoal ? (
          <section className="content-grid">
            <div className="breadcrumb"><button className="crumb" onClick={() => setSelectedGoalDetailId('')}>Goals</button> <span>/</span> <span>{currentGoal.title}</span></div>

            {/* Goal summary cards */}
            {(() => {
              const gCard = goalCards.find(g => g.goal.id === currentGoal.id);
              const prog = gCard?.progress ?? 0;
              const progColor = prog >= 100 ? '#16a34a' : prog >= 80 ? '#16a34a' : prog >= 40 ? 'var(--accent)' : prog === 0 ? '#d1d5db' : 'var(--accent)';
              return (
                <div className="gd-summary-bar">
                  <div className="gd-summary-card">
                    <span className="gd-sc-label">Progress</span>
                    <span className="gd-sc-value" style={{ color: progColor }}>{prog.toFixed(0)}%</span>
                    <div className="gd-sc-track"><div className="gd-sc-fill" style={{ width: `${Math.min(prog, 100)}%`, background: progColor }} /></div>
                  </div>
                  <div className="gd-summary-card">
                    <span className="gd-sc-label">Initiatives</span>
                    <span className="gd-sc-value">{scopedInitiatives.length}</span>
                  </div>
                  <div className="gd-summary-card">
                    <span className="gd-sc-label">KPIs</span>
                    <span className="gd-sc-value">{scopedKpis.length}</span>
                  </div>
                </div>
              );
            })()}

            {/* KPI table */}
            <div className="panel history-panel">
              <div className="panel-header"><h3>KPIs</h3></div>
              {scopedKpis.length === 0 ? (
                <EmptyState title="No KPIs yet" description="Create your first KPI for this goal." ctaLabel="New KPI" onClick={() => setKpiOpen(true)} />
              ) : (
                <div className="gd-kpi-table-wrap">
                  <table className="reviews-table gd-kpi-table">
                    <thead>
                      <tr>
                        <th className="gd-col-init">Initiative</th>
                        <th className="gd-col-kpi">KPI</th>
                        <th className="col-num">Current</th>
                        <th className="col-num">Target</th>
                        <th className="col-num">Unit</th>
                        <th>Progress</th>
                        <th className="col-num">Period</th>
                        <th className="col-num">Status</th>
                        <th className="col-num">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedKpis.map((k) => {
                        const initiative = initiatives.find(i => i.id === k.initiativeId);
                        const p = progressMap[k.id];
                        const pct = p?.percentage ?? 0;
                        const visual = Math.min(pct, 100);
                        const barColor = pct >= 100 ? '#16a34a' : 'var(--accent)';
                        return (
                          <tr key={k.id}>
                            <td className="gd-col-init" title={initiative?.title || ''}><span className="ht-secondary">{initiative?.title || '—'}</span></td>
                            <td className="gd-col-kpi" title={k.name}><span className="col-name-primary">{k.name}</span></td>
                            <td className="col-num"><strong>{p?.currentValue ?? 0}</strong></td>
                            <td className="col-num">{k.targetValue}</td>
                            <td className="col-num"><span className="unit-pill unit-pill-sm">{translateUnit(k.unit, k.customUnit)}</span></td>
                            <td>
                              <div className="prog-wrap">
                                <div className="prog-bar"><div className="prog-fill" style={{ width: `${visual}%`, background: barColor }} /></div>
                                <span className="prog-label">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="col-num" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{translatePeriod(k.periodType)}</td>
                            <td className="col-num"><StatusBadge status={p?.progressStatus || k.status} /></td>
                            <td className="col-num gd-actions-cell">
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <div className="ht-action-wrap" data-tip={k.periodType === 'punctual' && (historyByKpi[k.id]?.length ?? 0) > 0 ? 'Pontual: já registrado' : 'Register'}>
                                  <button className="icon-btn" disabled={k.periodType === 'punctual' && (historyByKpi[k.id]?.length ?? 0) > 0} onClick={() => { setRegisterGoalId(k.goalId); setRegisterInitiativeId(k.initiativeId || ''); setSelectedKpiId(k.id); setEntryValue('1'); setEntryDate(today()); setEntryComment(''); setEditingEntryId(''); setRegisterOpen(true); }}>⊕</button>
                                </div>
                                <div className="kpi-menu-wrap">
                                  <button className="icon-btn kpi-menu-trigger" onClick={() => setOpenKpiMenu(openKpiMenu === k.id ? null : k.id)}>···</button>
                                  {openKpiMenu === k.id && (
                                    <div className="kpi-dropdown" onMouseLeave={() => setOpenKpiMenu(null)}>
                                      <button onClick={() => { setEditKpiId(k.id); setEditKpiName(k.name); setEditKpiTarget(String(k.targetValue)); setEditKpiDescription(k.description || ''); setEditKpiPeriod(k.periodType); setEditKpiOpen(true); setOpenKpiMenu(null); }}>✎ Edit</button>
                                      <button onClick={() => { if (confirm('Archive this KPI?')) { appApi().ArchiveKPI(k.id).then(refreshAll); } setOpenKpiMenu(null); }}>◌ Archive</button>
                                      <button className="danger" onClick={() => { setDeleteKpiId(k.id); setOpenKpiMenu(null); }}>✕ Delete</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeView === 'history' ? (
          <section className="content-grid">
            {/* Filters */}
            <div className="history-filters">
              <DatePickerField value={historyFilterDateFrom} onChange={v => { setHistoryFilterDateFrom(v); triggerHistoryFilter(); }} placeholder="From" />
              <DatePickerField value={historyFilterDateTo} onChange={v => { setHistoryFilterDateTo(v); triggerHistoryFilter(); }} placeholder="To" />
              <select className="history-filter-input history-filter-goal" value={historyFilterGoal} onChange={e => { setHistoryFilterGoal(e.target.value); setHistoryFilterKpi(''); triggerHistoryFilter(); }}>
                <option value="">All Goals</option>
                {goals.filter(g => g.status !== 'archived').map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <input
                className="history-filter-input history-filter-search"
                type="search"
                placeholder="Search comment…"
                value={historyFilterText}
                onChange={e => { setHistoryFilterText(e.target.value); triggerHistoryFilter(); }}
              />
              <button
                className="btn btn-ghost btn-sm history-filter-clear"
                disabled={!historyFilterGoal && !historyFilterText && !historyFilterDateFrom && !historyFilterDateTo}
                onClick={() => { setHistoryFilterGoal(''); setHistoryFilterKpi(''); setHistoryFilterText(''); setHistoryFilterDateFrom(''); setHistoryFilterDateTo(''); triggerHistoryFilter(); }}
              >
                Clear
              </button>
            </div>

            <div className={`panel history-panel${historyFiltering ? ' history-filtering' : ''}`}>
              {(() => {
                const filtered = allRecentActivity.filter(e => {
                  const k = kpis.find(x => x.id === e.kpiId);
                  if (historyFilterGoal && k?.goalId !== historyFilterGoal) return false;
                  if (historyFilterKpi && e.kpiId !== historyFilterKpi) return false;
                  if (historyFilterText && !e.comment?.toLowerCase().includes(historyFilterText.toLowerCase())) return false;
                  if (historyFilterDateFrom && e.entryDate < historyFilterDateFrom) return false;
                  if (historyFilterDateTo && e.entryDate > historyFilterDateTo) return false;
                  return true;
                });

                if (filtered.length === 0) return (
                  <EmptyState title="No entries found" description="Try adjusting the filters or log a new value." ctaLabel="Quick Register" onClick={() => { setRegisterGoalId(''); setRegisterInitiativeId(''); setSelectedKpiId(''); setRegisterOpen(true); }} />
                );

                // group by date
                const byDate: { date: string; entries: typeof filtered }[] = [];
                for (const e of filtered) {
                  const last = byDate[byDate.length - 1];
                  if (last && last.date === e.entryDate) last.entries.push(e);
                  else byDate.push({ date: e.entryDate, entries: [e] });
                }

                return (
                  <table className="data-table history-table">
                    <thead>
                      <tr>
                        <th className="ht-date">Date</th>
                        <th className="ht-goal">Goal</th>
                        <th className="ht-kpi">KPI</th>
                        <th className="ht-val">Value</th>
                        <th className="ht-comment">Comment</th>
                        <th className="ht-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byDate.map(({ date, entries }) =>
                        entries.map((e, idx) => {
                          const k = kpis.find(x => x.id === e.kpiId);
                          const kGoal = k ? goals.find(g => g.id === k.goalId) : undefined;
                          const kInit = k ? initiatives.find(i => i.id === k.initiativeId) : undefined;
                          return (
                            <tr key={e.id} className={idx === 0 ? 'ht-group-first' : ''}>
                              <td className="ht-date">
                                {idx === 0 ? <span className="ht-date-badge">{prettyDate(date)}</span> : null}
                              </td>
                              <td className="ht-goal"><span className="ht-secondary">{kGoal?.title || '—'}</span></td>
                              <td className="ht-kpi">
                                {k ? (
                                  <div className="history-tooltip">
                                    <span className="ht-kpi-name">{k.name}</span>
                                    {kInit && <span className="ht-secondary">{kInit.title}</span>}
                                    <div className="history-tooltip-bubble">
                                      {kGoal && <div><strong>Goal:</strong> {kGoal.title}</div>}
                                      {kInit && <div><strong>Initiative:</strong> {kInit.title}</div>}
                                      <div><strong>Value:</strong> {e.value}</div>
                                    </div>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="ht-val"><span className="ht-value-chip">{e.value}</span></td>
                              <td className="ht-comment">
                                {e.comment ? (
                                  <div className="history-tooltip">
                                    <span className="ht-comment-text">{truncateText(e.comment, COMMENT_MAX_CHARS)}</span>
                                    <div className="history-tooltip-bubble">{e.comment}</div>
                                  </div>
                                ) : <span className="ht-empty">—</span>}
                              </td>
                              <td className="ht-actions">
                                <div className="ht-action-wrap" data-tip="Edit">
                                  <button className="icon-btn" onClick={() => { setEditingEntryId(e.id); setEntryValue(String(e.value)); setEntryDate(e.entryDate); setEntryComment(e.comment || ''); setRegisterOpen(true); }}>✎</button>
                                </div>
                                <div className="ht-action-wrap" data-tip="Delete">
                                  <button className="icon-btn danger" onClick={() => appApi().DeleteKPIEntry(e.id).then(refreshAll)}>✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </section>
        ) : null}

        {activeView === 'archived' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="panel-header"><h3>Archived KPIs</h3></div>
              {archivedKpis.length === 0 ? (
                <EmptyState
                  title="No archived KPIs"
                  description="Archived KPIs will appear here."
                  ctaLabel="Go to KPIs"
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
                      <th></th>
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
                          <td><button className="btn btn-ghost btn-sm" onClick={() => appApi().UnarchiveKPI(kpi.id).then(refreshAll)}>Restore</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : null}

        {activeView === 'reviews' ? (
          <div className="reviews-view reviews-scrollbar">
            {/* Page header */}
            <div className="reviews-page-header">
              <div className="reviews-page-header-text">
                <h2 className="reviews-title">KPI Comparison</h2>
                <p className="reviews-subtitle">Compare your KPI progress between two period snapshots.</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setNewSnapOpen(true)}>+ New Snapshot</button>
            </div>

            <Modal open={newSnapOpen} title="New Snapshot" onClose={() => setNewSnapOpen(false)}>
              <form onSubmit={handleCreateSnapshot} className="form">
                <input
                  className="input"
                  placeholder="e.g. June 2026"
                  value={newSnapLabel}
                  onChange={e => setNewSnapLabel(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setNewSnapOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create</button>
                </div>
              </form>
            </Modal>

            {snapshots.length === 0 ? (
              <EmptyState
                title="No snapshots yet"
                description="Create your first snapshot to start tracking your progress."
                ctaLabel="New Snapshot"
                onClick={() => setNewSnapOpen(true)}
              />
            ) : (
              <>
                {/* Period selector + compare button */}
                <div className="reviews-period-bar">
                  {(['A', 'B'] as const).map((slot, idx) => {
                    const selId = selectedSnapIds[idx];
                    const sel = snapshots.find(s => s.id === selId);
                    const label = slot === 'A' ? 'Period A' : 'Period B';
                    return (
                      <div key={slot} className="reviews-period-slot">
                        <label className="reviews-period-label">
                          <span className="reviews-period-badge">{slot}</span>
                          {label}
                        </label>
                        <select
                          className="reviews-period-select"
                          value={selId ?? ''}
                          onChange={e => {
                            const id = e.target.value;
                            setSelectedSnapIds(prev => {
                              const next = [...prev];
                              next[idx] = id;
                              return next.filter(Boolean);
                            });
                            setComparisons(null);
                          }}
                        >
                          <option value="">— select —</option>
                          {snapshots.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        <span className="reviews-period-date">{sel ? prettyDate(sel.takenAt.slice(0, 10)) : ' '}</span>
                      </div>
                    );
                  })}
                  <div className="reviews-period-btn-col">
                    <span className="reviews-period-label" style={{ visibility: 'hidden' }}>{'.' }</span>
                    <button
                      className="btn btn-primary reviews-compare-btn"
                      onClick={handleCompare}
                      disabled={selectedSnapIds.length < 2}
                    >
                      Compare
                    </button>
                    <span className="reviews-period-date" style={{ visibility: 'hidden' }}>{' '}</span>
                  </div>
                </div>
                {comparisons && (() => {
                  const improved = comparisons.filter(c => c.delta > 0 && c.entriesInPeriod > 0);
                  const unchanged = comparisons.filter(c => c.delta === 0);
                  const regressed = comparisons.filter(c => c.delta < 0);
                  const totalEntries = comparisons.reduce((s, c) => s + c.entriesInPeriod, 0);
                  const topKpi = [...comparisons].sort((a, b) => b.delta - a.delta)[0];

                  // group by real Goal using kpis state as the join
                  const kpiGoalMap: Record<string, string> = {};
                  for (const k of kpis) kpiGoalMap[k.id] = k.goalId;

                  const byGoal: Record<string, KPIComparison[]> = {};
                  for (const c of comparisons) {
                    const goalId = kpiGoalMap[c.kpiId] ?? '__unknown__';
                    if (!byGoal[goalId]) byGoal[goalId] = [];
                    byGoal[goalId].push(c);
                  }

                  // all non-archived goals, preserving their order
                  const visibleGoals = goals.filter(g => g.status !== 'archived');

                  // track duplicate kpi names for disambiguation
                  const nameCounts: Record<string, number> = {};
                  for (const c of comparisons) nameCounts[c.kpiName] = (nameCounts[c.kpiName] ?? 0) + 1;

                  return (
                    <>
                      {/* Summary cards */}
                      <div className="reviews-summary-bar">
                        <div className="reviews-summary-card">
                          <span className="rsc-value rsc-green">{improved.length}</span>
                          <span className="rsc-label">Improved</span>
                        </div>
                        <div className="reviews-summary-card">
                          <span className="rsc-value rsc-gray">{unchanged.length}</span>
                          <span className="rsc-label">No change</span>
                        </div>
                        <div className="reviews-summary-card">
                          <span className="rsc-value rsc-red">{regressed.length}</span>
                          <span className="rsc-label">Declined</span>
                        </div>
                        <div className="reviews-summary-card">
                          <span className="rsc-value">{totalEntries}</span>
                          <span className="rsc-label">Total entries</span>
                        </div>
                        {topKpi && topKpi.delta > 0 && (() => {
                          const topKpiMeta = kpis.find(k => k.id === topKpi.kpiId);
                          const topInitiative = topKpiMeta?.initiativeId ? initiatives.find(i => i.id === topKpiMeta.initiativeId) : null;
                          const topGoalId = kpiGoalMap[topKpi.kpiId];
                          const topGoal = goals.find(g => g.id === topGoalId);
                          return (
                            <div className="reviews-summary-card rsc-highlight">
                              <span className="rsc-value rsc-green-soft">+{topKpi.delta.toFixed(1)}</span>
                              <span className="rsc-label">Top growth</span>
                              <span className="rsc-sublabel rsc-sublabel-kpi">{topKpi.kpiName}</span>
                              {topInitiative && <span className="rsc-sublabel rsc-sublabel-init">{topInitiative.title}</span>}
                              {topGoal && <span className="rsc-sublabel rsc-sublabel-goal">{topGoal.title}</span>}
                            </div>
                          );
                        })()}
                      </div>

                      {/* KPI table per Goal */}
                      {visibleGoals.map(goal => {
                        const rows = byGoal[goal.id] ?? [];
                        return (
                          <div key={goal.id} className="reviews-category-block">
                            <div className="reviews-category-title">
                              <span>{goal.title}</span>
                              <span className="reviews-category-count">{rows.length} indicator{rows.length !== 1 ? 's' : ''}</span>
                            </div>
                            {rows.length === 0 ? (
                              <div className="reviews-empty-goal">No indicators in this goal for comparison</div>
                            ) : (
                              <table className="reviews-table">
                                <thead>
                                  <tr>
                                    <th>Indicator</th>
                                    <th className="col-num">Period A</th>
                                    <th className="col-num">Period B</th>
                                    <th className="col-num">Change</th>
                                    <th>Progress</th>
                                    <th className="col-num">Frequency</th>
                                    <th className="col-num">Entries</th>
                                    <th className="col-num">Tipo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map(c => {
                                    const hasData = c.entriesInPeriod > 0 || c.valueB > 0;
                                    const deltaClass = c.delta > 0 ? 'delta-pos' : c.delta < 0 ? 'delta-neg' : 'delta-zero';
                                    const progB = c.progressB ?? 0;
                                    const progBarWidth = Math.min(progB, 100);
                                    const progBarColor = progB >= 100 ? '#16a34a' : 'var(--accent)';
                                    return (
                                      <tr key={c.kpiId} className={hasData ? '' : 'row-dim'}>
                                        <td className="col-name">
                                          <span className="col-name-primary">{c.kpiName}</span>
                                          {(() => {
                                            const kpi = kpis.find(k => k.id === c.kpiId);
                                            const initiative = kpi?.initiativeId ? initiatives.find(i => i.id === kpi.initiativeId) : null;
                                            return initiative ? <span className="col-name-secondary">{initiative.title}</span> : null;
                                          })()}
                                        </td>
                                        <td className="col-num">{c.valueA.toFixed(1)}</td>
                                        <td className="col-num"><strong>{c.valueB.toFixed(1)}</strong></td>
                                        <td className="col-num">
                                          <span className={`delta-badge ${deltaClass}`}>
                                            {c.delta > 0 ? '+' : ''}{c.delta.toFixed(1)}
                                          </span>
                                        </td>
                                        <td className="col-progress">
                                          {c.progressB !== null ? (
                                            <div className="prog-wrap">
                                              <div className="prog-bar">
                                                <div className="prog-fill" style={{ width: `${progBarWidth}%`, background: progBarColor }} />
                                              </div>
                                              <span className="prog-label">{progB.toFixed(0)}%</span>
                                            </div>
                                          ) : <span className="text-muted">—</span>}
                                        </td>
                                        <td className="col-num text-muted" style={{ fontSize: '0.78rem' }}>{translatePeriod(c.periodType)}</td>
                                        <td className="col-num text-muted">{c.entriesInPeriod}</td>
                                        <td className="col-num"><span className="unit-pill unit-pill-sm">{translateUnit(c.kpiUnit, c.kpiCustomUnit)}</span></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        ) : null}
        </div>{/* end main-content */}
      </div>

      <Modal open={!!deleteKpiId} title="Delete KPI" onClose={() => setDeleteKpiId('')}>
        <div className="form">
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Are you sure? All entries for this KPI will be permanently deleted.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDeleteKpiId('')}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={() => appApi().DeleteKPI(deleteKpiId).then(() => { setDeleteKpiId(''); refreshAll(); })}>Delete</button>
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
          <select value={kpiInitiativeId} onChange={(e) => setKpiInitiativeId(e.target.value)} required>
            <option value="" disabled>Select initiative</option>
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

      <Modal open={editKpiOpen} title="Edit KPI" onClose={() => setEditKpiOpen(false)}>
        <form className="form" onSubmit={handleUpdateKpi}>
          <input value={editKpiName} onChange={(e) => setEditKpiName(e.target.value)} placeholder="KPI name" required />
          <input type="number" min="0.01" step="0.01" value={editKpiTarget} onChange={(e) => setEditKpiTarget(e.target.value)} placeholder="Target" required />
          <select value={editKpiPeriod} onChange={(e) => setEditKpiPeriod(e.target.value)}>
            <option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="annual">annual</option><option value="punctual">punctual</option>
          </select>
          <textarea value={editKpiDescription} onChange={(e) => setEditKpiDescription(e.target.value)} placeholder="Description" rows={3} />
          <button className="btn btn-primary" type="submit">Save KPI</button>
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
          {editingEntryId && <DatePickerField value={entryDate} onChange={setEntryDate} placeholder="Select a date" />}
          <textarea value={entryComment} onChange={(e) => setEntryComment(e.target.value)} placeholder="Comment" rows={3} />
          <button className="btn btn-primary" type="submit">{editingEntryId ? 'Update Entry' : 'Register Entry'}</button>
        </form>
      </Modal>
    </div>
  );
}
