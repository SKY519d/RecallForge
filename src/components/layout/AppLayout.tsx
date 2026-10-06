import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, BookOpen, CalendarDays, Command, Flame, Grid2X2, Plus,
  RotateCcw, Search, Settings, X,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { getLevel, getStreak } from '../../core/rewards';
import { BrandMark, Modal, ProgressBar } from '../common';

const links = [
  { to: '/', label: 'Dashboard', icon: Grid2X2, end: true },
  { to: '/questions', label: 'Questions', icon: BookOpen },
  { to: '/review', label: 'Review', icon: RotateCcw },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];
const accentColors = { teal: '#78aaa6', blue: '#7b9db7', ochre: '#c09a63' };

export function AppLayout() {
  const { data, saveError, storageError, cacheError, syncState } = useAppStore();
  const retryCloudSave = useAppStore((state) => state.retryCloudSave);
  const updateContest = useAppStore((state) => state.updateContest);
  const updateScheduledTest = useAppStore((state) => state.updateScheduledTest);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [systemLight, setSystemLight] = useState(() => window.matchMedia('(prefers-color-scheme: light)').matches);
  const focusMode = location.pathname === '/review';
  const level = getLevel(data.xp);
  const streak = getStreak(data.questions);
  const resolvedTheme = data.settings.theme === 'system' ? (systemLight ? 'light' : 'dark') : data.settings.theme;
  const appName = data.settings.appName.trim() || 'RecallForge';
  const shellStyle = { '--custom-accent': accentColors[data.settings.accentColor] } as CSSProperties;
  const pageTitle = links.find((link) => link.to === location.pathname)?.label ??
    (location.pathname.startsWith('/questions/') ? 'Question details' :
      location.pathname === '/add' ? 'Add question' :
        location.pathname === '/settings' ? 'Settings' :
          location.pathname === '/planner' ? 'Planner' :
          location.pathname === '/analytics' ? 'Analytics' : 'Your progress');
  const result = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data.questions.slice(0, 5);
    return data.questions.filter((question) =>
      `${question.title} ${question.topic} ${question.problem} ${question.notes} ${question.tags.join(' ')}`.toLowerCase().includes(term),
    ).slice(0, 8);
  }, [data.questions, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!data.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    const notifyDueItems = () => {
      const now = Date.now();
      for (const contest of data.contests) {
        const reminderAt = new Date(contest.startsAt).getTime() - contest.reminderMinutes * 60_000;
        if (!contest.remindedAt && reminderAt <= now) {
          new Notification(`${contest.platform} contest reminder`, { body: `${contest.title} starts soon.` });
          updateContest({ ...contest, remindedAt: new Date().toISOString() });
        }
      }
      const test = data.scheduledTest;
      const testAt = test ? new Date(`${test.date}T${test.time}`).getTime() : NaN;
      if (test && !test.remindedAt && testAt <= now) {
        new Notification('Surprise test time', { body: `Your due-question test is ready in ${appName}.` });
        updateScheduledTest({ ...test, remindedAt: new Date().toISOString() });
      }
    };
    notifyDueItems();
    const timer = window.setInterval(notifyDueItems, 30_000);
    return () => window.clearInterval(timer);
  }, [appName, data.contests, data.scheduledTest, data.settings.notifications, updateContest, updateScheduledTest]);

  useEffect(() => {
    document.title = pageTitle === 'Dashboard' ? `${appName} · Dashboard` : `${pageTitle} · ${appName}`;
  }, [appName, pageTitle]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (event: MediaQueryListEvent) => setSystemLight(event.matches);
    setSystemLight(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return (
    <div className={`app-shell classic-shell ${focusMode ? 'focus-mode' : ''} ${data.settings.animations ? '' : 'animations-off'} density-${data.settings.density} theme-${resolvedTheme}`} style={shellStyle}>
      {!focusMode && (
        <aside className="sidebar">
          <NavLink to="/" className="brand-lockup" aria-label={`${appName} home`}>
            <BrandMark />
            <span><strong className="brand-name">{appName}</strong><small>PERSONAL STUDY DESK</small></span>
          </NavLink>

          <div className="sidebar-label">WORKSPACE</div>
          <nav className="side-nav">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink to={to} end={end} key={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </NavLink>
            ))}
            <NavLink to="/add" className={({ isActive }) => `nav-item nav-add ${isActive ? 'active' : ''}`}>
              <Plus size={18} /><span>Add question</span>
            </NavLink>
          </nav>

          <div className="sidebar-spacer" />
          <div className="level-card">
            <div className="level-card-top"><span className="level-glyph"><Activity size={15} /></span><span>LEVEL {level.level}</span><strong>{data.xp} XP</strong></div>
            <h3>{level.title}</h3>
            <ProgressBar value={level.progress} compact />
            <span className="level-next">{level.nextLevelXp ? `${level.nextLevelXp - level.currentXp} XP to next level` : 'Highest level reached'}</span>
          </div>
          <div className="sidebar-footer">{appName} <span>·</span> Private study desk</div>
        </aside>
      )}

      <main className="main-area">
        {!focusMode && (
          <header className="topbar">
            <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
            <div className="topbar-actions">
              <button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={16} /><span>Search questions</span><kbd><Command size={11} /> K</kbd></button>
              <span className="topbar-divider" />
              <div className="topbar-streak"><Flame size={15} />{streak.current ? `${streak.current} day streak` : '0-day streak'}</div>
              <NavLink to="/settings" className="avatar-button" aria-label="Settings">R</NavLink>
            </div>
          </header>
        )}
        {(storageError || cacheError || saveError) && (
          <div className="storage-alert" role="alert"><span>{storageError || cacheError || saveError}</span>{syncState === 'error' && <button onClick={retryCloudSave}>Retry cloud sync</button>}{storageError && <button onClick={() => useAppStore.getState().resetData()}>Reset saved data</button>}</div>
        )}
        <div className="content-area"><Outlet /></div>
      </main>

      {!focusMode && (
        <nav className="mobile-nav" aria-label="Main navigation">
          {links.filter((item) => item.to !== '/analytics').map(({ to, label, icon: Icon, end }) => (
            <NavLink to={to} end={end} key={to} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/add" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}><Plus size={19} /><span>Add</span></NavLink>
        </nav>
      )}

      {searchOpen && (
        <Modal title="Search your questions" onClose={() => { setSearchOpen(false); setQuery(''); }} wide>
          <div className="global-search-field"><Search size={18} /><input autoFocus placeholder="Search title, topic, notes…" value={query} onChange={(event) => setQuery(event.target.value)} /><button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button></div>
          <div className="search-results">
            {result.length ? result.map((question) => (
              <button className="search-result" key={question.id} onClick={() => { navigate(`/questions/${question.id}`); setSearchOpen(false); setQuery(''); }}>
                <span className="search-result-icon"><BookOpen size={16} /></span><span><strong>{question.title}</strong><small>{question.topic} · {question.difficulty}</small></span><span className="search-result-enter">↵</span>
              </button>
            )) : <p className="search-empty">No questions match “{query}”.</p>}
          </div>
          <div className="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span><span><kbd>ESC</kbd> to close</span></div>
        </Modal>
      )}
    </div>
  );
}
