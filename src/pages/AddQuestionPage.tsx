import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CircleHelp } from 'lucide-react';
import { Card, CardTitle, PageHeading, Timeline } from '../components/common';
import { QuestionForm } from '../components/questions/QuestionForm';
import { formatDate } from '../core/revision/dates';
import { daysBetween } from '../core/revision/engine';
import { useAppStore } from '../store/appStore';
import type { Question } from '../types';

export function AddQuestionPage() {
  const addQuestion = useAppStore((state) => state.addQuestion);
  const appName = useAppStore((state) => state.data.settings.appName.trim() || 'RecallForge');
  const [added, setAdded] = useState<Question | null>(null);

  return (
    <div className="page">
      <PageHeading eyebrow="BUILD YOUR LIBRARY" title={added ? 'Question added.' : 'Add a question'} description={added ? 'Your first recall is on the calendar. Here is the complete schedule.' : 'Add a problem and set its revision schedule.'} />
      {added ? (
        <div className="add-success-layout">
          <Card className="success-card">
            <div className="success-mark"><Check size={21} /></div>
            <span className="eyebrow">ADDED TO YOUR LIBRARY</span>
            <h2>{added.title}</h2>
            <p>Your first recall is scheduled for <strong>{formatDate(added.nextReviewDate)}</strong>. Your next checkpoint is Day {daysBetween(added.createdAt, added.revisionSchedule[1])} on <strong>{formatDate(added.revisionSchedule[1])}</strong>.</p>
            <div className="success-actions"><Link to={`/questions/${added.id}`} className="button secondary">View question</Link><button className="button primary" onClick={() => setAdded(null)}>Add another <ArrowRight size={15} /></button></div>
          </Card>
          <Card><CardTitle icon={<CircleHelp size={17} />} title="Your revision timeline" detail="Seven spaced checkpoints, individually customizable" /><Timeline question={added} /></Card>
        </div>
      ) : (
        <div className="add-form-layout">
          <Card className="form-card">
            <CardTitle title="Question details" detail="Required fields are marked with an asterisk." />
            <QuestionForm onSave={(question) => { addQuestion(question); setAdded(question); }} />
          </Card>
          <aside className="add-aside">
            <Card className="schedule-explainer">
              <span className="schedule-mark"><CircleHelp size={18} /></span>
              <div className="eyebrow">{appName.toUpperCase()} SCHEDULE</div>
              <h3>Revision schedule</h3>
              <p>Questions return at fixed intervals. Outcome ratings never skip a checkpoint.</p>
              <div className="schedule-pills">{[0, 3, 7, 15, 30, 60, 120].map((day) => <span key={day}>D{day}</span>)}</div>
              <div className="schedule-next-label">NEXT CHECKPOINT <strong>Day 3</strong></div>
            </Card>
            <div className="privacy-note"><span className="privacy-dot" /><span>Stored locally in this browser. No account or cloud service.</span></div>
          </aside>
        </div>
      )}
    </div>
  );
}
