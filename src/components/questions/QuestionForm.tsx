import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { calculateRevisionSchedule, createQuestion, daysBetween } from '../../core/revision/engine';
import { isDateKey, todayKey } from '../../core/revision/dates';
import { useAppStore } from '../../store/appStore';
import { DEFAULT_TOPICS, type Difficulty, type Question } from '../../types';

const normalized = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function QuestionForm({ initial, onSave, onCancel }: {
  initial?: Question;
  onSave: (question: Question) => void;
  onCancel?: () => void;
}) {
  const existing = useAppStore((state) => state.data.questions);
  const defaultDifficulty = useAppStore((state) => state.data.settings.defaultDifficulty);
  const revisionIntervals = useAppStore((state) => state.data.settings.revisionIntervals);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [problem, setProblem] = useState(initial?.problem ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? defaultDifficulty);
  const [source, setSource] = useState(initial?.source ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [solution, setSolution] = useState(initial?.solution ?? '');
  const [createdAt, setCreatedAt] = useState(initial?.createdAt ?? todayKey());
  const [revisionDates, setRevisionDates] = useState(initial?.revisionSchedule ?? calculateRevisionSchedule(todayKey(), revisionIntervals));
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [error, setError] = useState('');
  const duplicate = useMemo(() => existing.find((question) =>
    question.id !== initial?.id && normalized(question.title) === normalized(title) && normalized(title).length > 0,
  ), [existing, initial?.id, title]);
  const topics = [...new Set([...DEFAULT_TOPICS, ...existing.map((question) => question.topic)])].sort();

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.some((item) => item.toLowerCase() === tag.toLowerCase())) setTags([...tags, tag]);
    setTagInput('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !topic.trim() || !createdAt) {
      setError('Add a question title, topic, and date to continue.');
      return;
    }
    if (!isDateKey(createdAt)) {
      setError('Enter a valid calendar date.');
      return;
    }
    if (revisionDates.length !== 7 || revisionDates.some((date) => !isDateKey(date)) ||
      revisionDates.some((date, index) => index > 0 && date <= revisionDates[index - 1]) ||
      revisionDates[0] < createdAt) {
      setError('Set seven valid checkpoint dates in order, starting on or after the date added.');
      return;
    }
    setError('');
    const draft = initial
      ? {
        ...initial,
        title: title.trim(),
        problem: problem.trim(),
        topic: topic.trim(),
        difficulty,
        source: source.trim(),
        url: url.trim(),
        notes: notes.trim(),
        solution: solution.trim(),
        tags,
        createdAt,
        revisionSchedule: revisionDates,
        ...(createdAt !== initial.createdAt || !initial.pendingReinforcement ? {
          nextReviewDate: revisionDates[Math.min(initial.completedStages.length, 6)],
          pendingReinforcement: false,
        } : { nextReviewDate: initial.nextReviewDate }),
      }
      : {
        ...createQuestion({ title, problem, topic, difficulty, source, url, notes, solution, tags, createdAt, revisionIntervals }),
        revisionSchedule: revisionDates,
        nextReviewDate: revisionDates[0],
      };
    onSave(draft);
  };

  return (
    <form className="question-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field full"><span>Question title <i>*</i></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Binary Search" autoFocus required /></label>
        {duplicate && <div className="duplicate-warning full"><AlertTriangle size={16} /><span><strong>Possible duplicate</strong> — you already have “{duplicate.title}”. You can still add it if this is intentional.</span></div>}
        <label className="field full"><span>Problem statement</span><textarea rows={3} value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="What are you trying to solve?" /></label>
        <label className="field"><span>Topic <i>*</i></span><input list="topic-options" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Choose or type a topic" required /><datalist id="topic-options">{topics.map((item) => <option key={item} value={item} />)}</datalist><small>Type a new topic to create it.</small></label>
        <label className="field"><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
        <label className="field"><span>Source</span><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="e.g. LeetCode" /></label>
        <label className="field"><span>Problem URL</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>
        <label className="field"><span>Date added / solved</span><input type="date" value={createdAt} max={todayKey()} onChange={(event) => { const value = event.target.value; setCreatedAt(value); if (isDateKey(value)) setRevisionDates(calculateRevisionSchedule(value, revisionIntervals)); }} required /><small>Use the default cadence or adjust any checkpoint below.</small></label>
        <div className="field full revision-date-editor"><span>Custom revision dates</span><div className="revision-date-grid">{revisionDates.map((date, index) => <label className="field" key={index}><span>Checkpoint {index + 1} · Day {isDateKey(date) && isDateKey(createdAt) ? daysBetween(createdAt, date) : revisionIntervals[index]}</span><input type="date" value={date} min={index === 0 ? createdAt : revisionDates[index - 1]} max={revisionDates[index + 1]} onChange={(event) => setRevisionDates(revisionDates.map((item, dateIndex) => dateIndex === index ? event.target.value : item))} required /></label>)}</div></div>
        <label className="field"><span>Tags</span><div className="tag-editor"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Add a tag" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} /><button type="button" onClick={addTag} aria-label="Add tag"><Plus size={16} /></button></div><div className="tag-list">{tags.map((tag) => <button type="button" className="tag-chip" key={tag} onClick={() => setTags(tags.filter((item) => item !== tag))}>{tag}<X size={12} /></button>)}</div></label>
        <label className="field"><span>Notes</span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Your approach, edge cases, or reminder…" /></label>
        <label className="field"><span>Solution / explanation</span><textarea rows={4} value={solution} onChange={(event) => setSolution(event.target.value)} placeholder="Write the key idea and complexity…" /></label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-actions">
        {onCancel && <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="button primary">{initial ? 'Save changes' : 'Add question'}<span aria-hidden="true">→</span></button>
      </div>
    </form>
  );
}
