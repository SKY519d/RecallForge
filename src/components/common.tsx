import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Check, Circle, Clock3, Flame, LockKeyhole } from 'lucide-react';
import type { Question } from '../types';
import { formatDate, todayKey } from '../core/revision/dates';
import { getQuestionStatus, getRevisionDay, getRevisionStage } from '../core/revision/engine';
import { getQuestionProgress } from '../core/revision/engine';

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function BrandMark() {
  return <span className="brand-mark"><BookOpen size={17} strokeWidth={1.8} /></span>;
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardTitle({ icon, title, detail, action }: {
  icon?: React.ReactNode;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-title-row">
      <div className="card-title-content">
        {icon && <span className="card-title-icon">{icon}</span>}
        <div><h2>{title}</h2>{detail && <p className="muted small">{detail}</p>}</div>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ question, status }: { question: Question; status?: string }) {
  const value = status ?? getQuestionStatus(question);
  const css = value.toLowerCase().replaceAll(' ', '-');
  return <span className={`badge status-badge ${css}`}>{value}</span>;
}

export function DifficultyBadge({ difficulty }: { difficulty: Question['difficulty'] }) {
  return <span className={`badge difficulty-${difficulty.toLowerCase()}`}>{difficulty}</span>;
}

export function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  return <div className={`progress-track ${compact ? 'compact' : ''}`}><span style={{ width: `${value}%` }} /></div>;
}

export function StatCard({ label, value, detail, icon, accent = '' }: {
  label: string;
  value: string | number;
  detail?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`stat-card ${accent}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}

export function QuestionLine({ question, meta }: { question: Question; meta?: React.ReactNode }) {
  const stage = getRevisionStage(question);
  const progress = getQuestionProgress(question);
  return (
    <Link to={`/questions/${question.id}`} className="question-line">
      <span className="question-line-mark"><Circle size={18} /></span>
      <span className="question-line-main">
        <span className="question-line-title">{question.title}</span>
        <span className="question-line-meta">{question.topic} <span>·</span> {question.difficulty} <span>·</span> Stage {stage}/6</span>
      </span>
      <span className="question-line-end">
        {meta ?? <><StatusBadge question={question} /><ArrowUpRight size={15} /></>}
      </span>
      <span className="question-mini-progress"><ProgressBar value={progress} compact /></span>
    </Link>
  );
}

export function Timeline({ question }: { question: Question }) {
  const stage = getRevisionStage(question);
  const today = todayKey();
  return (
    <div className="revision-timeline" aria-label="Canonical seven checkpoint revision schedule">
      {question.revisionSchedule.map((date, index) => {
        const day = getRevisionDay(question, index);
        const completed = question.completedStages.includes(index);
        const isCurrent = index === stage;
        const isReinforcement = question.pendingReinforcement && isCurrent;
        const state = completed ? 'completed' : isCurrent ? (question.nextReviewDate <= today ? 'current' : 'next') : 'upcoming';
        return (
          <div className={`timeline-step ${state}`} key={day}>
            <span className="timeline-marker">
              {completed ? <Check size={14} /> : isReinforcement ? <Flame size={13} /> : state === 'upcoming' ? <LockKeyhole size={12} /> : <Circle size={12} />}
            </span>
            <span className="timeline-copy">
              <strong>Day {day}{day === 120 && <span className="mastery-tag"> · Mastery</span>}</strong>
              <small>{formatDate(date, 'MMM d, yyyy')}</small>
              {completed && <small className="step-state">Completed</small>}
              {isCurrent && !completed && <small className="step-state">{isReinforcement ? 'Reinforcement' : state === 'current' ? 'Ready to review' : 'Next checkpoint'}</small>}
              {!completed && !isCurrent && <small className="step-state"><Clock3 size={11} /> Upcoming</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, description, action }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <div className="empty-state"><BookOpen size={19} className="empty-state-icon" /><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}

export function Modal({ title, children, onClose, wide = false }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal-panel ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

export function StreakMark({ value }: { value: number }) {
  return <span className="streak-mark"><Flame size={15} /> {value} day streak</span>;
}
