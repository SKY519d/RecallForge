import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, ArrowRight, ArrowUpRight, Check, Clock3, ExternalLink, Eye, Flame, Keyboard, Plus } from 'lucide-react';
import { BrandMark, EmptyState, DifficultyBadge } from '../components/common';
import { formatDate, todayKey } from '../core/revision/dates';
import { getDueQuestions, getOverdueQuestions, getRevisionDay, getRevisionStage } from '../core/revision/engine';
import { useAppStore } from '../store/appStore';
import type { Question, ReviewResult } from '../types';

const outcomes: { result: ReviewResult; label: string; description: string; key: string }[] = [
  { result: 'again', label: 'Again', description: 'I could not recall it', key: '1' },
  { result: 'hard', label: 'Hard', description: 'Got there with effort', key: '2' },
  { result: 'good', label: 'Good', description: 'Recalled it correctly', key: '3' },
  { result: 'easy', label: 'Easy', description: 'Clear and confident recall', key: '4' },
];

interface Feedback {
  xp: number;
  nextReviewDate: string;
  mastered: boolean;
}

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const data = useAppStore((state) => state.data);
  const appName = data.settings.appName.trim() || 'RecallForge';
  const soundEffects = useAppStore((state) => state.data.settings.soundEffects);
  const completeReview = useAppStore((state) => state.completeReview);
  const [activeId, setActiveId] = useState(searchParams.get('question') ?? '');
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackQuestionId, setFeedbackQuestionId] = useState('');
  const [error, setError] = useState('');
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const today = todayKey();
  const isDirectReview = Boolean(searchParams.get('question'));
  const isSurpriseTest = searchParams.get('test') === '1';
  const testDate = isSurpriseTest && data.scheduledTest ? data.scheduledTest.date : today;
  const requestedId = searchParams.get('question');
  const queue = useMemo(() => {
    if (isDirectReview && requestedId) {
      const requested = data.questions.find((item) => item.id === requestedId);
      return requested && !doneIds.includes(requested.id) ? [requested] : [];
    }
    const due = getDueQuestions(data.questions, testDate);
    const overdue = getOverdueQuestions(data.questions, testDate);
    const sorted = [...overdue.sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate)), ...due];
    const available = sorted.filter((item) => !doneIds.includes(item.id));
    if (isSurpriseTest) {
      for (let index = available.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [available[index], available[swap]] = [available[swap], available[index]];
      }
    }
    return searchParams.get('quick') === '5' ? available.slice(0, 5) : available;
  }, [data.questions, doneIds, isDirectReview, isSurpriseTest, requestedId, searchParams, testDate, today]);

  const activeQuestion = data.questions.find((item) => item.id === activeId) ?? queue[0];
  const currentQuestion = activeQuestion && !doneIds.includes(activeQuestion.id) ? activeQuestion : queue[0];
  const stage = currentQuestion ? getRevisionStage(currentQuestion) : 0;

  useEffect(() => {
    if (!activeId && queue[0]) setActiveId(queue[0].id);
  }, [activeId, queue]);

  const moveNext = () => {
    if (feedbackQuestionId) setDoneIds((ids) => ids.includes(feedbackQuestionId) ? ids : [...ids, feedbackQuestionId]);
    setFeedback(null);
    setAttempted(false);
    setRevealed(false);
    setError('');
    setActiveId('');
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'r' && !feedback && attempted) setRevealed(true);
      if (/^[1-4]$/.test(event.key) && revealed && !feedback) {
        const choice = outcomes[Number(event.key) - 1];
        if (currentQuestion) {
          const result = completeReview(currentQuestion.id, choice.result);
          playReviewTone(soundEffects);
          setFeedbackQuestionId(currentQuestion.id);
          setFeedback(result);
          setSessionXp((xp) => xp + result.xp);
          setSessionCount((count) => count + 1);
          setDoneIds((ids) => ids.includes(currentQuestion.id) ? ids : [...ids, currentQuestion.id]);
        }
      }
      if (event.key.toLowerCase() === 'n' && feedback) moveNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attempted, completeReview, currentQuestion, feedback, revealed, soundEffects]);

  const submitOutcome = (result: ReviewResult) => {
    if (!currentQuestion || !revealed) return;
    try {
      const resultData = completeReview(currentQuestion.id, result);
      playReviewTone(soundEffects);
      setFeedbackQuestionId(currentQuestion.id);
      setFeedback(resultData);
      setSessionXp((xp) => xp + resultData.xp);
      setSessionCount((count) => count + 1);
      setDoneIds((ids) => ids.includes(currentQuestion.id) ? ids : [...ids, currentQuestion.id]);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Review could not be saved.');
    }
  };

  if (!currentQuestion && !feedback && sessionCount > 0) {
    return <SessionSummary appName={appName} count={sessionCount} xp={sessionXp} onStartAgain={() => { setDoneIds([]); setSessionCount(0); setSessionXp(0); setActiveId(''); }} />;
  }
  if (!currentQuestion && !feedback) {
    return <div className="review-empty"><div className="review-empty-top"><Link to="/" className="focus-brand"><BrandMark />{appName}</Link><span className="focus-tag">{isSurpriseTest ? 'SURPRISE TEST' : 'REVIEW SESSION'}</span></div><EmptyState title={isSurpriseTest ? 'No questions are due for this test.' : data.questions.length ? 'Nothing due today.' : 'No questions in your library.'} description={isSurpriseTest ? 'This test includes questions due or overdue on its scheduled date. Choose another date in Planner or add a question due on that day.' : data.questions.length ? 'Your next checkpoint will appear here when it is due.' : 'Add a question to start a revision schedule.'} action={<Link to={isSurpriseTest ? '/planner' : data.questions.length ? '/questions' : '/add'} className="button primary">{isSurpriseTest ? 'Back to Planner' : data.questions.length ? 'Open questions' : 'Add question'} <ArrowRight size={16} /></Link>} /><Link to="/" className="review-back-link">Back to dashboard</Link></div>;
  }

  const feedbackQuestion = data.questions.find((item) => item.id === feedbackQuestionId);
  if (feedback && feedbackQuestion) {
    const question = feedbackQuestion;
    const nextAvailable = queue.length > 0;
    return (
      <div className="review-page review-feedback-page">
        <div className="review-topline"><Link to="/" className="focus-brand"><BrandMark />{appName}</Link><span className="focus-tag">REVIEW SESSION</span><span className="review-session-count">{sessionCount} complete</span></div>
        <div className="review-feedback-wrap">
          <div className={`feedback-icon ${feedback.mastered ? 'mastered' : ''}`}>{feedback.mastered ? <Award size={25} /> : <Check size={24} />}</div>
          <div className="eyebrow">{feedback.mastered ? 'A MILESTONE REACHED' : 'RECALL LOGGED'}</div>
          <h1>{feedback.mastered ? 'Question mastered.' : 'Revision complete.'}</h1>
          <p>{question.title}</p>
          <div className="feedback-reward"><Plus size={17} /><strong>+{feedback.xp} XP</strong><span>earned for this session</span></div>
          <div className="feedback-next"><span>{feedback.mastered ? 'REVISION TIMELINE' : question.pendingReinforcement ? 'REINFORCEMENT REVIEW' : 'NEXT CHECKPOINT'}</span><strong>{feedback.mastered ? 'Final checkpoint complete' : formatDate(feedback.nextReviewDate, 'EEEE, MMMM d')}</strong><small>{feedback.mastered ? 'All seven checkpoints complete' : question.pendingReinforcement ? 'A short recall tomorrow; your custom schedule stays intact.' : `Day ${getRevisionDay(question, Math.min(question.completedStages.length, 6))} · Your next spaced checkpoint.`}</small></div>
          <div className="feedback-actions">
            {nextAvailable ? <button className="button primary" onClick={moveNext}>Next question <ArrowRight size={16} /></button> : <Link to="/" className="button primary">Finish session <Check size={16} /></Link>}
            <Link to={`/questions/${question.id}`} className="button secondary">View timeline</Link>
          </div>
          <div className="shortcut-hint"><kbd>N</kbd> next question</div>
        </div>
      </div>
    );
  }

  const question: Question = currentQuestion!;
  const isOverdue = question.nextReviewDate < today;

  return (
    <div className="review-page">
      <div className="review-topline"><Link to="/" className="focus-brand"><BrandMark />{appName}</Link><span className="focus-tag">{isSurpriseTest ? `SURPRISE TEST · ${data.scheduledTest?.durationMinutes ?? 60} MIN` : 'FOCUSED RECALL'}</span><span className="review-session-count">{doneIds.length + 1}{queue.length ? ` / ${Math.max(queue.length + doneIds.length, 1)}` : ''}</span><button className="keyboard-hint" onClick={() => setShowShortcuts(!showShortcuts)}><Keyboard size={15} /><span>Shortcuts</span></button><Link to="/" className="exit-review">Exit session</Link></div>
      {showShortcuts && <div className="shortcut-panel"><span><kbd>R</kbd> Reveal</span>{outcomes.map((outcome) => <span key={outcome.key}><kbd>{outcome.key}</kbd> {outcome.label}</span>)}<span><kbd>N</kbd> Next</span></div>}
      <div className="review-workspace">
        <div className="review-progress-line"><span style={{ width: `${Math.min(100, ((doneIds.length + 1) / Math.max(queue.length + doneIds.length, 1)) * 100)}%` }} /></div>
        <div className="review-question-top"><div><span className="eyebrow">RECALL CHECK · DAY {getRevisionDay(question, stage)}</span><h1>{question.title}</h1></div><div className="review-question-tags"><DifficultyBadge difficulty={question.difficulty} /><span className="topic-chip">{question.topic}</span>{isOverdue && <span className="badge overdue">Overdue</span>}</div></div>
        <div className="review-card">
          <div className="review-problem-heading"><span>THE PROBLEM</span><Link to={`/questions/${question.id}`} className="review-detail-link">Question details <ArrowUpRight size={14} /></Link></div>
          <div className="review-problem">{question.problem || 'Try to restate the problem from memory before revealing the solution.'}</div>
          {question.url && <a href={question.url} target="_blank" rel="noreferrer" className="review-source"><ExternalLink size={13} /> Open problem source</a>}
          {!attempted && <div className="attempt-prompt"><span className="attempt-icon"><Clock3 size={15} /></span><span><strong>Pause and attempt retrieval first.</strong><small>Try to solve it or explain the approach from memory.</small></span><button className="button secondary" onClick={() => setAttempted(true)}>I’ve tried it</button></div>}
          {attempted && <div className="reveal-row"><span className="attempted-note"><Check size={14} /> Attempt noted · reveal when ready</span><button className="button reveal-button" onClick={() => setRevealed(true)}><Eye size={15} /> Reveal solution <kbd>R</kbd></button></div>}
          {revealed && <div className="solution-block"><div className="solution-heading"><span><Check size={14} /> SOLUTION / EXPLANATION</span>{question.source && <small>{question.source}</small>}</div><p>{question.solution || 'No solution has been added yet. Add one from this question’s detail page for future reviews.'}</p>{question.notes && <div className="solution-notes"><strong>YOUR NOTES</strong><p>{question.notes}</p></div>}</div>}
        </div>

        <div className={`review-rating ${revealed ? 'ready' : ''}`}>
          <div className="rating-heading"><div><strong>How did recall feel?</strong><span>Rate the attempt honestly — this never changes the fixed schedule.</span></div>{!revealed && <span className="rating-locked"><Clock3 size={13} /> Reveal first</span>}</div>
          <div className="rating-options">{outcomes.map(({ result, label, description, key }) => <button key={result} className={`rating-button rating-${result}`} disabled={!revealed} onClick={() => submitOutcome(result)}><span className="rating-button-top"><strong>{label}</strong><kbd>{key}</kbd></span><small>{description}</small></button>)}</div>
          {error && <div role="alert" className="form-error">{error}</div>}
        </div>
        <div className="review-session-footer"><span><Flame size={14} /> {getTodaySessionCount(data.questions, today)} reviews completed today</span><span>{isSurpriseTest ? 'Surprise test · due questions' : 'Your custom revision schedule'}</span><button onClick={() => setShowShortcuts(!showShortcuts)}><Keyboard size={14} /> Keyboard shortcuts</button></div>
      </div>
    </div>
  );
}

function getTodaySessionCount(questions: Question[], today: string) {
  return questions.reduce((count, question) => count + question.reviewHistory.filter((review) => review.date === today).length, 0);
}

function playReviewTone(enabled: boolean) {
  if (!enabled || typeof window.AudioContext === 'undefined') return;
  const context = new window.AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.035, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => { void context.close(); };
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
}

function SessionSummary({ appName, count, xp, onStartAgain }: { appName: string; count: number; xp: number; onStartAgain: () => void }) {
  return <div className="review-page"><div className="review-topline"><Link to="/" className="focus-brand"><BrandMark />{appName}</Link><span className="focus-tag">SESSION COMPLETE</span></div><div className="review-feedback-wrap"><div className="feedback-icon mastered"><Check size={24} /></div><div className="eyebrow">REVIEW SUMMARY</div><h1>Session complete</h1><p>Your review results have been saved.</p><div className="session-summary-stats"><div><strong>{count}</strong><span>reviews</span></div><div><strong>+{xp}</strong><span>XP earned</span></div></div><Link to="/" className="button primary">Back to dashboard <ArrowRight size={16} /></Link><button className="text-button" onClick={onStartAgain}>Start another session</button></div></div>;
}
