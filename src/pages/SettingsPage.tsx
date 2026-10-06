import { useRef, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Check, Cloud, Download, FileSpreadsheet, LogOut, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { Card, CardTitle, PageHeading } from '../components/common';
import type { ImportPreview } from '../core/importExport/excel';
import { makeDemoQuestions } from '../data/demoQuestions';
import { parseBackup } from '../core/storage/localStorage';
import { useAppStore } from '../store/appStore';
import { REVISION_DAYS, type Difficulty, type Question } from '../types';
import { isValidRevisionIntervals } from '../core/storage/localStorage';
import { useAccount } from '../components/auth/AccountGate';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizedTitle(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function SettingsPage() {
  const { user, signOut } = useAccount();
  const data = useAppStore((state) => state.data);
  const localOnly = useAppStore((state) => state.localOnly);
  const cacheError = useAppStore((state) => state.cacheError);
  const syncState = useAppStore((state) => state.syncState);
  const retryCloudSave = useAppStore((state) => state.retryCloudSave);
  const flushCloudSave = useAppStore((state) => state.flushCloudSave);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const importQuestions = useAppStore((state) => state.importQuestions);
  const restoreBackup = useAppStore((state) => state.restoreBackup);
  const resetData = useAppStore((state) => state.resetData);
  const excelRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [allowSignOutWithoutSync, setAllowSignOutWithoutSync] = useState(false);
  const [intervals, setIntervals] = useState(data.settings.revisionIntervals);

  const loadExcel = async (file?: File) => {
    if (!file) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { previewExcel } = await import('../core/importExport/excel');
      const result = await previewExcel(file);
      setPreview(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This spreadsheet could not be read.');
      setPreview(null);
    } finally {
      setBusy(false);
      if (excelRef.current) excelRef.current.value = '';
    }
  };

  const seenTitles = new Set(data.questions.map((question) => normalizedTitle(question.title)));
  const duplicates: Question[] = [];
  const uniqueQuestions: Question[] = [];
  for (const question of preview?.questions ?? []) {
    const normalized = normalizedTitle(question.title);
    if (seenTitles.has(normalized)) duplicates.push(question);
    else {
      uniqueQuestions.push(question);
      seenTitles.add(normalized);
    }
  }

  const importExcelQuestions = (includeDuplicates: boolean) => {
    if (!preview?.questions.length) return;
    const questions = includeDuplicates ? preview.questions : uniqueQuestions;
    importQuestions(questions, false);
    setNotice(`${questions.length} question${questions.length === 1 ? '' : 's'} imported${duplicates.length && !includeDuplicates ? `; skipped ${duplicates.length} possible duplicate${duplicates.length === 1 ? '' : 's'}` : ''}.`);
    setPreview(null);
  };

  const restoreJson = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      if (!window.confirm(`Restore this backup with ${parsed.questions.length} questions? Current data will be replaced.`)) return;
      restoreBackup(parsed);
      setNotice(`Backup restored with ${parsed.questions.length} questions.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This backup could not be restored.');
    } finally {
      if (backupRef.current) backupRef.current.value = '';
    }
  };

  const replaceWithDemo = () => {
    if (!window.confirm('Load 15 realistic DSA examples? This replaces your current question library and XP. Export a backup first if you need it.')) return;
    const questions = makeDemoQuestions();
    const xp = questions.reduce((sum, question) => sum + 5 + question.reviewHistory.reduce((earned, review) => earned + review.xp, 0), 0);
    restoreBackup({ ...data, questions, xp, dailyGoalDays: [], weeklyStreaks: [] });
    setNotice('Demo library loaded with 15 questions and sample recall history. Reset it any time.');
  };

  const resetApplication = () => {
    if (!window.confirm(`Reset all ${data.settings.appName || 'RecallForge'} data, including questions, reviews, XP, and settings? This cannot be undone.`)) return;
    resetData();
    setNotice(`${data.settings.appName || 'RecallForge'} has been reset.`);
  };

  const exportBackup = () => downloadJson(data, `recallforge-backup-${new Date().toISOString().slice(0, 10)}.json`);
  const exportQuestions = async () => {
    try {
      const { exportExcel } = await import('../core/importExport/excel');
      await exportExcel(data.questions);
      setNotice('Excel export is ready.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Excel export failed.');
    }
  };

  const handleSignOut = async (skipSync = false) => {
    setSigningOut(true);
    setError('');
    try {
      if (!skipSync) await flushCloudSave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sync before signing out.');
      setAllowSignOutWithoutSync(true);
      setSigningOut(false);
      return;
    }
    try {
      await signOut();
      setAllowSignOutWithoutSync(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign out.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="page settings-page">
      <PageHeading eyebrow="YOUR WORKSPACE" title="Settings" description="Set up your study desk, review routine, and backups." />
      {notice && <div className="settings-notice"><Check size={15} />{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
      {error && <div className="form-error settings-error" role="alert"><AlertTriangle size={15} />{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {busy && <div className="settings-notice"><span className="spinner" />Reading spreadsheet…</div>}

      <Card className="settings-card">
        <CardTitle title={localOnly ? 'Local workspace' : 'Account and sync'} detail={localOnly ? 'You are using the app without an account. Your study data is saved only in this browser.' : 'Your workspace is private to this account and syncs across your devices.'} />
        <div className="settings-row account-settings-row">
          <div><strong>{localOnly ? 'This device' : user?.email ?? 'Signed-in account'}</strong><span><Cloud size={14} />{localOnly ? 'Saved locally · account sync is optional and not set up.' : cacheError ? 'Account is online, but this browser cache could not be saved.' : syncState === 'saving' ? 'Saving changes to your account…' : syncState === 'error' ? 'Cloud sync needs attention.' : 'Account data is synced.'}</span></div>
          {!localOnly && <div className="data-action-buttons">
              {syncState === 'error' && <button className="button secondary" onClick={retryCloudSave}>Retry sync</button>}
              <button className="button secondary" disabled={signingOut} onClick={() => void handleSignOut()}><LogOut size={15} />{signingOut ? 'Signing out…' : 'Sign out'}</button>
              {allowSignOutWithoutSync && <button className="button secondary" disabled={signingOut} onClick={() => {
                if (window.confirm('Recent changes may not be available on your other devices until sync succeeds. Sign out anyway?')) void handleSignOut(true);
              }}>Sign out without syncing</button>}
            </div>}
        </div>
      </Card>

      <Card className="settings-card">
        <CardTitle title="Personalization" detail="Name your study desk and adjust how it looks." />
        <label className="personalization-field"><span>App name</span><input maxLength={40} value={data.settings.appName} onChange={(event) => updateSettings({ appName: event.target.value })} placeholder="RecallForge" /><small>Shown in the sidebar, review sessions, and browser tab. A book icon is used as the current mark.</small></label>
        <label className="personalization-field"><span>Display name</span><input maxLength={32} value={data.settings.displayName} onChange={(event) => updateSettings({ displayName: event.target.value })} placeholder="Student" /><small>Used in the dashboard greeting.</small></label>
        <div className="personalization-control"><div><strong>Theme</strong><span>Choose the color scheme.</span></div><div className="segmented-control appearance-theme-picker" role="group" aria-label="Theme">{(['paper', 'dark', 'light', 'system', 'petal', 'afterglow'] as const).map((theme) => <button key={theme} className={data.settings.theme === theme ? 'selected' : ''} onClick={() => updateSettings({ theme })}>{theme === 'afterglow' ? 'Afterglow' : theme === 'petal' ? 'Petal' : theme === 'dark' ? 'Classic dark' : theme[0].toUpperCase() + theme.slice(1)}</button>)}</div></div>
        <div className="personalization-control"><div><strong>Accent color</strong><span>Used for active navigation and primary actions.</span></div><div className="segmented-control" role="group" aria-label="Accent color">{(['teal', 'blue', 'ochre'] as const).map((color) => <button key={color} className={data.settings.accentColor === color ? 'selected' : ''} onClick={() => updateSettings({ accentColor: color })}>{color[0].toUpperCase() + color.slice(1)}</button>)}</div></div>
        <div className="personalization-control"><div><strong>Interface density</strong><span>Adjust spacing across lists and controls.</span></div><div className="segmented-control" role="group" aria-label="Interface density">{(['comfortable', 'compact'] as const).map((density) => <button key={density} className={data.settings.density === density ? 'selected' : ''} onClick={() => updateSettings({ density })}>{density[0].toUpperCase() + density.slice(1)}</button>)}</div></div>
      </Card>

      <Card className="settings-card">
        <CardTitle title="Appearance" detail="Keep motion unobtrusive." />
        <div className="settings-row"><div><strong>Motion</strong><span>Use subtle interface transitions and progress animations.</span></div><Toggle checked={data.settings.animations} label="Enable animations" onChange={(checked) => updateSettings({ animations: checked })} /></div>
      </Card>

      <Card className="settings-card">
        <CardTitle title="Review routine" detail="Keep goals helpful, not punishing." />
        <div className="settings-row"><div><strong>Daily review goal</strong><span>Reviews needed to complete your daily quest and earn its reward.</span></div><select className="settings-select" value={data.settings.dailyGoal} onChange={(event) => updateSettings({ dailyGoal: Number(event.target.value) })}>{[1, 2, 3, 5, 8, 10].map((value) => <option key={value} value={value}>{value} reviews</option>)}</select></div>
        <div className="settings-row"><div><strong>Default difficulty</strong><span>Preselected when adding a question.</span></div><select className="settings-select" value={data.settings.defaultDifficulty} onChange={(event) => updateSettings({ defaultDifficulty: event.target.value as Difficulty })}><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
        <div className="settings-row"><div><strong>Review sounds</strong><span>A soft confirmation tone after logging a recall.</span></div><Toggle checked={data.settings.soundEffects} label="Enable review sounds" onChange={(checked) => updateSettings({ soundEffects: checked })} /></div>
        <div className="settings-row"><div><strong>Confirm before deleting</strong><span>Ask before removing a question and its review history.</span></div><Toggle checked={data.settings.confirmDelete} label="Confirm before deleting" onChange={(checked) => updateSettings({ confirmDelete: checked })} /></div>
        <div className="settings-row"><div><strong>Contest and test notifications</strong><span>Show browser notifications while {data.settings.appName || 'RecallForge'} is open. Configure dates in Planner.</span></div><Toggle checked={data.settings.notifications} label="Enable browser notifications" onChange={async (checked) => {
          if (!checked) { updateSettings({ notifications: false }); return; }
          if (!('Notification' in window)) { setError('This browser does not support notifications.'); return; }
          const permission = await Notification.requestPermission();
          if (permission === 'granted') updateSettings({ notifications: true });
          else setError('Browser notification permission was not granted.');
        }} /></div>
        <div className="interval-settings">
          <div><strong>Default revision intervals</strong><span>Used for new questions; existing question dates stay unchanged. Keep day 0 first and later days increasing.</span></div>
          <div className="interval-grid">{intervals.map((day, index) => <label className="field" key={index}><span>Checkpoint {index + 1}</span><input type="number" min={index === 0 ? 0 : intervals[index - 1] + 1} max="3650" value={day} onChange={(event) => setIntervals(intervals.map((item, intervalIndex) => intervalIndex === index ? Number(event.target.value) : item))} /></label>)}</div>
          <div className="interval-actions"><button className="button secondary" onClick={() => setIntervals([...REVISION_DAYS])}>Restore defaults</button><button className="button primary" disabled={!isValidRevisionIntervals(intervals)} onClick={() => updateSettings({ revisionIntervals: intervals })}>Save intervals</button>{!isValidRevisionIntervals(intervals) && <span className="muted small">Use 7 increasing whole numbers starting at 0.</span>}</div>
        </div>
      </Card>

      <Card className="settings-card">
        <CardTitle title="Data & portability" detail="Account data syncs privately; exports give you an additional backup." />
        <div className="data-action-row"><div className="data-action-icon"><FileSpreadsheet size={18} /></div><div className="data-action-copy"><strong>Excel question library</strong><span>Import questions from a spreadsheet or export your current library.</span></div><div className="data-action-buttons"><button className="button secondary" onClick={() => excelRef.current?.click()}><ArrowDownToLine size={15} /> Import Excel</button><button className="button secondary" onClick={() => void exportQuestions()}><ArrowUpFromLine size={15} /> Export Excel</button></div></div>
        <div className="data-action-row"><div className="data-action-icon backup-icon"><ShieldCheck size={18} /></div><div className="data-action-copy"><strong>Full backup</strong><span>JSON backup includes questions, fixed schedules, review history, XP, and settings.</span></div><div className="data-action-buttons"><button className="button secondary" onClick={() => backupRef.current?.click()}><Upload size={15} /> Import backup</button><button className="button secondary" onClick={exportBackup}><Download size={15} /> Export backup</button></div></div>
        <input ref={excelRef} hidden type="file" accept=".xlsx" onChange={(event) => void loadExcel(event.target.files?.[0])} />
        <input ref={backupRef} hidden type="file" accept=".json,application/json" onChange={(event) => void restoreJson(event.target.files?.[0])} />
        {preview && <div className="import-preview">
          <div className="import-preview-heading"><strong>Import preview</strong><button className="text-button" onClick={() => setPreview(null)}>Cancel</button></div>
          <div className="import-summary"><span><strong>{preview.detectedCount}</strong> detected</span><span><strong>{preview.questions.length}</strong> valid</span><span><strong>{preview.attentionCount}</strong> need attention</span><span>Sheet: <strong>{preview.sheetName}</strong></span></div>
          {duplicates.length > 0 && <div className="duplicate-warning"><AlertTriangle size={15} /><span>{duplicates.length} possible duplicate{duplicates.length === 1 ? '' : 's'}: {duplicates.map((item) => item.title).slice(0, 5).join(', ')}{duplicates.length > 5 ? '…' : ''}</span></div>}
          {preview.skipped.map((item) => <div className="import-warning-line" key={item}>{item}</div>)}
          <div className="import-preview-buttons"><button className="button primary" disabled={!uniqueQuestions.length} onClick={() => importExcelQuestions(false)}>Import {uniqueQuestions.length} new</button>{duplicates.length > 0 && <button className="button secondary" onClick={() => importExcelQuestions(true)}>Import all, including duplicates</button>}</div>
          <p className="muted small">Existing data is preserved. Revision dates present in the workbook are kept; missing checkpoints are calculated from Date Added.</p>
        </div>}
        <div className="privacy-strip"><ShieldCheck size={15} /><span>{localOnly ? 'Your data is stored only in this browser. Export backups before clearing browser data or switching devices. You can set up private account sync later.' : 'Your workspace is stored under your account and protected by database row-level security. Browser storage keeps a separate local cache for each signed-in account.'}</span></div>
      </Card>

      <Card className="settings-card">
        <CardTitle title="Demo & reset" detail="Explore with sample problems or clear your local workspace." />
        <div className="settings-row"><div><strong>Load demo DSA questions</strong><span>Replaces your library with 15 examples, dated sample reviews, and sample XP so charts and progress are visible.</span></div><button className="button secondary" onClick={replaceWithDemo}><RotateCcw size={15} /> Load demo</button></div>
        <div className="settings-row danger-row"><div><strong>Reset application</strong><span>Remove all questions, review history, settings, and XP from this browser.</span></div><button className="button danger" onClick={resetApplication}>Reset {data.settings.appName || 'RecallForge'}</button></div>
      </Card>
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <button className={`toggle-switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}
