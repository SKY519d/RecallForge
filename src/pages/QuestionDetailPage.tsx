import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Clock3, ExternalLink, Pencil, Play, Trash2 } from 'lucide-react';
import { Card, CardTitle, DifficultyBadge, PageHeading, StatusBadge, Timeline } from '../components/common';
import { QuestionForm } from '../components/questions/QuestionForm';
import { formatDate } from '../core/revision/dates';
import { daysBetween } from '../core/revision/engine';
import { useAppStore } from '../store/appStore';

export function QuestionDetailPage() {
  const { id = '' } = useParams();
  const question = useAppStore((state) => state.data.questions.find((item) => item.id === id));
  const updateQuestion = useAppStore((state) => state.updateQuestion);
  const deleteQuestion = useAppStore((state) => state.deleteQuestion);
  const confirmDelete = useAppStore((state) => state.data.settings.confirmDelete);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  if (!question) return <div className="page"><Link to="/questions" className="back-link"><ArrowLeft size={15} /> Back to questions</Link><div className="missing-question"><h1>This question isn’t here.</h1><p>It may have been deleted or is no longer in this browser.</p><Link to="/questions" className="button secondary">Return to questions</Link></div></div>;

  const remove = () => {
    if (confirmDelete && !window.confirm(`Delete “${question.title}” and its review history? This cannot be undone.`)) return;
    deleteQuestion(question.id);
    navigate('/questions');
  };
  const xp = question.reviewHistory.reduce((total, review) => total + review.xp, 0);

  if (editing) {
    return <div className="page"><Link to={`/questions/${question.id}`} className="back-link" onClick={(event) => { event.preventDefault(); setEditing(false); }}><ArrowLeft size={15} /> Cancel editing</Link><PageHeading eyebrow="EDIT QUESTION" title={question.title} description="Adjust the question details and each revision date." /><Card className="form-card"><QuestionForm initial={question} onCancel={() => setEditing(false)} onSave={(updated) => { updateQuestion(updated); setEditing(false); }} /></Card></div>;
  }

  return (
    <div className="page detail-page">
      <Link to="/questions" className="back-link"><ArrowLeft size={15} /> All questions</Link>
      <PageHeading eyebrow={`${question.topic.toUpperCase()} · ADDED ${formatDate(question.createdAt, 'MMM d, yyyy').toUpperCase()}`} title={question.title} description={question.problem || 'Keep the problem statement here for your next recall session.'} action={<div className="detail-actions"><button className="button secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button><button className="button danger-quiet" onClick={remove}><Trash2 size={15} /></button></div>} />
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <CardTitle icon={<CalendarDays size={17} />} title="Revision timeline" detail="Your original checkpoints stay fixed, whatever the review rating." action={<Link to={`/review?question=${question.id}`} className="button primary small-button"><Play size={14} /> Review now</Link>} />
            <Timeline question={question} />
          </Card>
          {question.solution && <Card><CardTitle icon={<Check size={17} />} title="Solution / explanation" /><div className="prose-text">{question.solution}</div></Card>}
          {question.notes && <Card><CardTitle title="Notes" /><div className="prose-text">{question.notes}</div></Card>}
          {question.reviewHistory.length > 0 && <Card><CardTitle icon={<Clock3 size={17} />} title="Review history" detail={`${question.reviewHistory.length} recorded sessions`} /><div className="history-table">{[...question.reviewHistory].reverse().map((review) => <div className="history-row" key={review.id}><span className={`history-result result-${review.result}`}>{review.result}</span><span>Day {review.stage === 0 ? 0 : [0, 3, 7, 15, 30, 60, 120][review.stage]}</span><span>{formatDate(review.date)}</span><strong>+{review.xp} XP</strong></div>)}</div></Card>}
        </div>
        <aside className="detail-side">
          <Card className="detail-status-card">
            <div className="detail-badges"><DifficultyBadge difficulty={question.difficulty} /><StatusBadge question={question} /></div>
            <div className="detail-next-label">NEXT REVIEW</div>
            <strong className="detail-next-date">{question.completedStages.includes(6) ? 'Mastered' : formatDate(question.nextReviewDate, 'MMM d')}</strong>
            <p>{question.pendingReinforcement ? 'Short reinforcement review' : question.completedStages.includes(6) ? 'Final checkpoint complete' : `Day ${daysBetween(question.createdAt, question.revisionSchedule[Math.min(question.completedStages.length, 6)])} checkpoint`}</p>
            <div className="detail-summary-stats"><span><small>STAGE</small><strong>{Math.min(question.completedStages.length, 6)} / 6</strong></span><span><small>REVIEWS</small><strong>{question.reviewHistory.length}</strong></span><span><small>XP EARNED</small><strong>{xp}</strong></span></div>
          </Card>
          <Card>
            <CardTitle title="Question details" />
            <div className="detail-field"><small>TOPIC</small><strong>{question.topic}</strong></div>
            <div className="detail-field"><small>DIFFICULTY</small><DifficultyBadge difficulty={question.difficulty} /></div>
            {question.source && <div className="detail-field"><small>SOURCE</small><strong>{question.source}</strong></div>}
            {question.url && <a href={question.url} target="_blank" rel="noreferrer" className="source-link">Open source <ExternalLink size={13} /></a>}
            <button className="button secondary linkedin-share" onClick={() => {
              const post = `I’m working through a challenging ${question.topic} problem: ${question.title}.${question.url ? `\n${question.url}` : ''}\n\nWhat approach would you try? #DSA #CodingPractice`;
              const shareUrl = question.url
                ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(question.url)}`
                : 'https://www.linkedin.com/feed/';
              window.open(shareUrl, '_blank', 'noopener,noreferrer');
              void navigator.clipboard.writeText(post)
                .then(() => setShareNotice('Post draft copied. Paste it into LinkedIn and review before publishing.'))
                .catch(() => setShareNotice('LinkedIn opened. Clipboard access was unavailable; copy the question details manually.'));
            }}>Draft LinkedIn post</button>
            {shareNotice && <p className="muted small" role="status">{shareNotice}</p>}
            {question.tags.length > 0 && <div className="detail-field"><small>TAGS</small><div className="tag-list">{question.tags.map((tag) => <span className="tag-chip static-tag" key={tag}>{tag}</span>)}</div></div>}
          </Card>
          <Card className="canonical-note"><span className="note-glyph"><ArrowUpRight size={16} /></span><p>Good and Easy recalls move to the next date in your custom schedule. The final checkpoint marks mastery.</p></Card>
        </aside>
      </div>
    </div>
  );
}
