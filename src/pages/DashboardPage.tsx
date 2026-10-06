import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { EmptyState, ProgressBar } from '../components/common';
import { getDailyQuest, getStreak } from '../core/rewards';
import { getDueQuestions, getOverdueQuestions, getQuestionCounts, getQuestionStatus, getUpcomingQuestions } from '../core/revision/engine';
import { formatDate, todayKey } from '../core/revision/dates';
import { getStudyRecommendation } from '../core/revision/recommendations';
import { getTodayReviewCount, useAppStore } from '../store/appStore';
import type { Question } from '../types';

export function DashboardPage() {
  const data = useAppStore((state) => state.data);
  const questions = data.questions;
  const today = todayKey();
  const due = getDueQuestions(questions, today);
  const overdue = getOverdueQuestions(questions, today);
  const dueCount = due.length + overdue.length;
  const counts = getQuestionCounts(questions, today);
  const streak = getStreak(questions);
  const quest = getDailyQuest(questions, data.settings.dailyGoal);
  const todayDone = getTodayReviewCount(data);
  const greeting = getGreeting(new Date());
  const displayName = data.settings.displayName.trim() || 'Student';
  const recentQuestions = [...questions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 6);
  const recommendation = getStudyRecommendation(questions, today);
  const topicStats = Object.values(questions.reduce<Record<string, { topic: string; total: number; mastered: number; due: number }>>((acc, question) => {
    const stat = acc[question.topic] ?? { topic: question.topic, total: 0, mastered: 0, due: 0 };
    stat.total += 1;
    const status = getQuestionStatus(question, today);
    if (status === 'Mastered') stat.mastered += 1;
    if (status === 'Due Today' || status === 'Overdue') stat.due += 1;
    acc[question.topic] = stat;
    return acc;
  }, {}))
    .sort((a, b) => b.due - a.due || b.total - a.total || a.topic.localeCompare(b.topic))
    .slice(0, 6);
  const upcoming = getUpcomingQuestions(questions, today, 14);
  const upcomingByDate = Object.entries(upcoming.reduce<Record<string, number>>((acc, question) => {
    acc[question.nextReviewDate] = (acc[question.nextReviewDate] ?? 0) + 1;
    return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b)).slice(0, 4);
  const latestReviews = questions.flatMap((question) =>
    question.reviewHistory.map((review) => ({ question, review })),
  ).sort((a, b) => b.review.date.localeCompare(a.review.date)).slice(0, 4);

  return (
    <div className="page dashboard-page study-desk">
      <header className="desk-welcome">
        <div>
          <div className="eyebrow">{format(new Date(), 'EEEE, MMMM d, yyyy').toUpperCase()}</div>
          <h1>{greeting}, {displayName}</h1>
          <p>{data.settings.appName.trim() || 'RecallForge'} · Study desk</p>
        </div>
        <Link to="/add" className="button secondary"><Plus size={15} /> Add question</Link>
      </header>

      <section className="desk-today" aria-labelledby="today-heading">
        <div className="desk-section-heading"><h2 id="today-heading">Today</h2><span>{format(new Date(), 'EEE, MMM d')}</span></div>
        <div className="today-summary">
          <SummaryItem label="Reviews due" value={dueCount} detail={overdue.length ? `${overdue.length} overdue` : 'On schedule'} />
          <SummaryItem label="New questions" value={counts.new} detail="Not reviewed yet" />
          <SummaryItem label="Mastered" value={counts.mastered} detail="In your library" />
          <SummaryItem label="Current streak" value={`${streak.current} days`} detail={streak.current ? `${streak.longest} days longest` : 'Start with a review'} />
        </div>
      </section>

      <section className={`desk-review ${dueCount ? 'has-due' : ''}`} aria-labelledby="review-heading">
        <div className="desk-review-copy">
          <div className="desk-section-heading"><h2 id="review-heading">Today's review</h2><span>{todayDone} completed · {data.settings.dailyGoal} daily goal</span></div>
          <strong>{dueCount ? `${dueCount} ${dueCount === 1 ? 'question is' : 'questions are'} ready` : 'Nothing due today'}</strong>
          <p>{overdue.length ? `${overdue.length} overdue${due.length ? ` and ${due.length} scheduled for today` : ''}. Start with the oldest review.` : due.length ? 'Complete a review to keep your schedule moving.' : 'Your next scheduled questions will appear in Coming up.'}</p>
        </div>
        <div className="desk-review-actions">
          <Link to="/review" className="button primary"><RotateCcw size={15} /> Start review</Link>
          {dueCount > 0 && <Link to="/review?quick=5" className="button secondary">Quick 5</Link>}
        </div>
      </section>

      <div className="desk-columns">
        <div className="desk-main-column">
          <section className="desk-section" aria-labelledby="recent-heading">
            <div className="desk-section-heading">
              <div><h2 id="recent-heading">Recent questions</h2><p>Recently added to your library</p></div>
              <Link to="/questions" className="text-link">Open library <ChevronRight size={14} /></Link>
            </div>
            {recentQuestions.length ? <div className="desk-question-list">
              {recentQuestions.map((question) => <RecentQuestion key={question.id} question={question} />)}
            </div> : <EmptyState title="Your library is empty" description="Add a question to start tracking its revision schedule." action={<Link className="button secondary small-button" to="/add"><Plus size={14} /> Add question</Link>} />}
          </section>

          <section className="desk-section" aria-labelledby="topics-heading">
            <div className="desk-section-heading">
              <div><h2 id="topics-heading">Subject progress</h2><p>Mastered questions by topic</p></div>
              <Link to="/analytics" className="text-link">Analytics <ChevronRight size={14} /></Link>
            </div>
            {topicStats.length ? <div className="desk-topic-list">{topicStats.map((topic) => (
              <Link to={`/questions?topic=${encodeURIComponent(topic.topic)}`} className="desk-topic-row" key={topic.topic}>
                <span className="desk-topic-label"><strong>{topic.topic}</strong><small>{topic.mastered} of {topic.total} mastered · {topic.due} due</small></span>
                <ProgressBar value={topic.total ? (topic.mastered / topic.total) * 100 : 0} compact />
              </Link>
            ))}</div> : <p className="desk-empty-copy">Topic progress appears after you add questions.</p>}
          </section>

          <section className="desk-section desk-activity-section" aria-labelledby="activity-heading">
            <div className="desk-section-heading"><div><h2 id="activity-heading">Recent reviews</h2><p>Latest completed sessions</p></div><Link to="/analytics" className="text-link">View history <ChevronRight size={14} /></Link></div>
            {latestReviews.length ? <div className="desk-activity-list">{latestReviews.map(({ question, review }) => (
              <Link className="desk-activity-row" key={review.id} to={`/questions/${question.id}`}>
                <span className={`desk-result result-${review.result}`}>{review.result === 'good' || review.result === 'easy' ? <Check size={13} /> : '↻'}</span>
                <strong>{question.title}</strong><span>{review.result}</span><time>{formatDate(review.date, 'MMM d')}</time>
              </Link>
            ))}</div> : <p className="desk-empty-copy">Completed reviews will be listed here.</p>}
          </section>
        </div>

        <aside className="desk-side-column">
          <section className="desk-section desk-goal" aria-labelledby="goal-heading">
            <div className="desk-section-heading"><div><h2 id="goal-heading">Daily goal</h2><p>{quest.complete ? 'Complete for today' : 'Reviews completed today'}</p></div><span className="desk-goal-count">{quest.progress}/{quest.goal}</span></div>
            <ProgressBar value={quest.goal ? (quest.progress / quest.goal) * 100 : 0} />
            <p>{quest.complete ? 'Daily target reached.' : `${Math.max(0, quest.goal - quest.progress)} more to reach today's target.`}</p>
          </section>

          <section className="desk-section" aria-labelledby="next-heading">
            <div className="desk-section-heading"><div><h2 id="next-heading">Coming up</h2><p>Scheduled over the next 14 days</p></div><CalendarDays size={16} /></div>
            {upcomingByDate.length ? <div className="desk-upcoming-list">{upcomingByDate.map(([date, count]) => (
              <Link to={`/questions?date=${date}`} className="desk-upcoming-row" key={date}>
                <time>{formatDate(date, 'MMM d')}</time><span>{formatDate(date, 'EEE')}</span><strong>{count} {count === 1 ? 'question' : 'questions'}</strong>
              </Link>
            ))}</div> : <p className="desk-empty-copy">No upcoming checkpoints in the next two weeks.</p>}
          </section>

          <section className="desk-section desk-suggestion" aria-labelledby="suggestion-heading">
            <div className="desk-section-heading"><div><h2 id="suggestion-heading">Suggested review</h2><p>From your saved review history</p></div><BookOpen size={16} /></div>
            {recommendation ? <>
              <Link to={`/questions/${recommendation.question.id}`} className="desk-suggestion-title">{recommendation.question.title}</Link>
              <p>{recommendation.reason}</p>
              <Link to={`/review?question=${recommendation.question.id}`} className="button secondary"><RotateCcw size={14} /> Review question</Link>
            </> : <p className="desk-empty-copy">{questions.length ? 'All questions in your library are mastered.' : 'Add a question to see a study suggestion.'}</p>}
          </section>

        </aside>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="summary-item"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function RecentQuestion({ question }: { question: Question }) {
  return <Link to={`/questions/${question.id}`} className="desk-question-row">
    <span className="desk-question-icon"><BookOpen size={15} /></span>
    <span className="desk-question-copy"><strong>{question.title}</strong><small>{question.topic} · {question.difficulty}</small></span>
    <time>{formatDate(question.createdAt, 'MMM d')}</time>
    <ArrowRight size={14} />
  </Link>;
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
