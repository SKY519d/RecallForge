import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Check, Clock3, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Card, CardTitle, PageHeading } from '../components/common';
import { formatDate, isDateKey, todayKey } from '../core/revision/dates';
import { getDueQuestions, getOverdueQuestions } from '../core/revision/engine';
import { useAppStore } from '../store/appStore';
import type { ContestReminder, ScheduledTest } from '../types';

const platforms = ['LeetCode', 'CodeChef', 'Codeforces', 'AtCoder', 'HackerRank', 'Topcoder', 'Other'];
const contestPlatforms = [
  { name: 'LeetCode', url: 'https://leetcode.com/contest/', detail: 'Weekly and biweekly contests' },
  { name: 'CodeChef', url: 'https://www.codechef.com/contests', detail: 'Starters and rated contests' },
  { name: 'Codeforces', url: 'https://codeforces.com/contests', detail: 'Upcoming rounds and gym' },
  { name: 'AtCoder', url: 'https://atcoder.jp/contests/', detail: 'ABC, ARC, and AGC rounds' },
  { name: 'HackerRank', url: 'https://www.hackerrank.com/contests', detail: 'Practice and timed contests' },
  { name: 'Topcoder', url: 'https://www.topcoder.com/challenges', detail: 'Challenges and competitions' },
];

export function PlannerPage() {
  const data = useAppStore((state) => state.data);
  const appName = data.settings.appName.trim() || 'RecallForge';
  const updateContest = useAppStore((state) => state.updateContest);
  const deleteContest = useAppStore((state) => state.deleteContest);
  const updateScheduledTest = useAppStore((state) => state.updateScheduledTest);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [platform, setPlatform] = useState('LeetCode');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [testDate, setTestDate] = useState(todayKey());
  const [testTime, setTestTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [error, setError] = useState('');
  const test = data.scheduledTest;
  const previewDate = test?.date ?? testDate;
  const dueOnTestDate = useMemo(() => {
    if (!isDateKey(previewDate)) return [];
    return [...getOverdueQuestions(data.questions, previewDate), ...getDueQuestions(data.questions, previewDate)];
  }, [data.questions, previewDate]);

  const submitContest = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !startsAt || Number.isNaN(new Date(startsAt).getTime())) {
      setError('Add a contest name and valid start date and time.');
      return;
    }
    if (url && !/^https?:\/\//i.test(url)) {
      setError('Contest links must start with http:// or https://.');
      return;
    }
    const contest: ContestReminder = {
      id: crypto.randomUUID(), platform, title: title.trim(), url: url.trim(),
      startsAt: new Date(startsAt).toISOString(), reminderMinutes,
    };
    updateContest(contest);
    setTitle('');
    setUrl('');
    setStartsAt('');
    setError('');
  };

  const saveTest = (event: FormEvent) => {
    event.preventDefault();
    if (!isDateKey(testDate) || testDate < todayKey() || !/^\d{2}:\d{2}$/.test(testTime)) {
      setError('Choose a valid test date today or later, and a valid time.');
      return;
    }
    const scheduled: ScheduledTest = { date: testDate, time: testTime, durationMinutes };
    updateScheduledTest(scheduled);
    setError('');
  };

  const enableNotifications = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ notifications: false });
      return;
    }
    if (!('Notification' in window)) {
      setError('This browser does not support notifications. In-app reminders are still available here.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setError('Browser notification permission was not granted. You can still see reminders in the Planner.');
      return;
    }
    updateSettings({ notifications: true });
    setError('');
  };

  return (
    <div className="page planner-page">
      <PageHeading eyebrow="YOUR STUDY CALENDAR" title="Plan your next win." description="Keep contest dates and a surprise practice test in one calm place." />
      {error && <div className="form-error settings-error" role="alert">{error}</div>}
      <Card className="planner-notice">
        <Bell size={17} />
        <span>Reminders appear here while {appName} is open. Browser notifications work while this tab is open; notifications while the app is closed require a server.</span>
        <button className={`toggle-switch ${data.settings.notifications ? 'on' : ''}`} role="switch" aria-checked={data.settings.notifications} aria-label="Enable browser notifications" onClick={() => void enableNotifications(!data.settings.notifications)}><span /></button>
      </Card>

      <section className="contest-platform-section" aria-labelledby="contest-platform-heading">
        <div className="contest-platform-heading">
          <div><h2 id="contest-platform-heading">Contest platforms</h2><p>Open an official schedule, then add a reminder below.</p></div>
        </div>
        <div className="contest-platform-grid">
          {contestPlatforms.map((item) => (
            <article className={`contest-platform-card ${platform === item.name ? 'selected' : ''}`} key={item.name}>
              <div><strong>{item.name}</strong><span>{item.detail}</span></div>
              <div className="contest-platform-actions">
                <button type="button" className="text-link" onClick={() => setPlatform(item.name)}>Use platform</button>
                <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Browse ${item.name} contests`}><ExternalLink size={15} /></a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="planner-grid">
        <Card className="settings-card">
          <CardTitle icon={<CalendarDays size={17} />} title="Coding contest reminders" detail="Save upcoming events from the platform schedules above." />
          <form className="planner-form" onSubmit={submitContest}>
            <label className="field"><span>Platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>Contest name</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Weekly Contest" required /></label>
            <label className="field"><span>Starts at</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
            <label className="field"><span>Contest link (optional)</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>
            <label className="field"><span>Remind me</span><select value={reminderMinutes} onChange={(event) => setReminderMinutes(Number(event.target.value))}><option value={0}>At start time</option><option value={10}>10 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></label>
            <button className="button primary" type="submit"><Plus size={15} /> Add reminder</button>
          </form>
          <div className="planner-event-list">
            {[...data.contests].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((contest) => (
              <div className="planner-event" key={contest.id}>
                <div><strong>{contest.title}</strong><span>{contest.platform} · {new Date(contest.startsAt).toLocaleString()} · {contest.reminderMinutes ? `${contest.reminderMinutes}m reminder` : 'At start'}</span></div>
                {contest.url && <a href={contest.url} target="_blank" rel="noreferrer" aria-label={`Open ${contest.title} link`}><ExternalLink size={15} /></a>}
                <button className="icon-button" onClick={() => deleteContest(contest.id)} aria-label={`Delete ${contest.title}`}><Trash2 size={15} /></button>
              </div>
            ))}
            {!data.contests.length && <p className="muted small">Your contest calendar is clear. Add the next one above.</p>}
          </div>
        </Card>

        <Card className="settings-card">
          <CardTitle icon={<Clock3 size={17} />} title="Surprise test" detail="On your chosen date, test yourself on questions due or overdue that day." />
          <form className="planner-form" onSubmit={saveTest}>
            <label className="field"><span>Test date</span><input type="date" min={todayKey()} value={testDate} onChange={(event) => setTestDate(event.target.value)} required /></label>
            <label className="field"><span>Start time</span><input type="time" value={testTime} onChange={(event) => setTestTime(event.target.value)} required /></label>
            <label className="field"><span>Test length</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={20}>20 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label>
            <button className="button primary" type="submit">{test ? 'Update test' : 'Schedule test'}</button>
            {test && <button className="button secondary" type="button" onClick={() => updateScheduledTest(null)}>Cancel scheduled test</button>}
          </form>
          <div className="test-preview">
            <strong>{test ? `${formatDate(test.date)} · ${test.time}` : 'Preview for selected date'}</strong>
            <span>{dueOnTestDate.length} due or overdue question{dueOnTestDate.length === 1 ? '' : 's'} · {test?.durationMinutes ?? durationMinutes} minutes</span>
            <div className="test-preview-list">{dueOnTestDate.slice(0, 5).map((question) => <span key={question.id}>{question.title}</span>)}</div>
            {test && <Link to="/review?test=1" className="button secondary"><Check size={15} /> Start surprise test</Link>}
          </div>
        </Card>
      </div>
    </div>
  );
}
