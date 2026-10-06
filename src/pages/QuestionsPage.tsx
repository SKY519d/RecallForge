import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, ArrowUpRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { DifficultyBadge, EmptyState, PageHeading, ProgressBar, StatusBadge } from '../components/common';
import { getQuestionStatus } from '../core/revision/engine';
import { formatDate, todayKey } from '../core/revision/dates';
import { useAppStore } from '../store/appStore';
import { DEFAULT_TOPICS } from '../types';

type SortType = 'added' | 'next' | 'difficulty' | 'topic';

export function QuestionsPage() {
  const questions = useAppStore((state) => state.data.questions);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const dateFilter = searchParams.get('date') ?? '';
  const [topic, setTopic] = useState(searchParams.get('topic') ?? 'All topics');
  const [difficulty, setDifficulty] = useState('All difficulties');
  const [status, setStatus] = useState(searchParams.get('filter') === 'due' ? 'Due / overdue' : 'All statuses');
  const [sort, setSort] = useState<SortType>(searchParams.get('sort') === 'next' ? 'next' : 'next');
  const topics = useMemo(() => [...new Set([...DEFAULT_TOPICS, ...questions.map((question) => question.topic)])].sort(), [questions]);
  useEffect(() => {
    const requestedTopic = searchParams.get('topic');
    setTopic(requestedTopic && topics.includes(requestedTopic) ? requestedTopic : 'All topics');
  }, [searchParams, topics]);
  const filtered = useMemo(() => {
    const today = todayKey();
    const list = questions.filter((question) => {
      const text = `${question.title} ${question.topic} ${question.tags.join(' ')}`.toLowerCase();
      const currentStatus = getQuestionStatus(question, today);
      const matchesStatus = status === 'All statuses' ||
        (status === 'Due / overdue' && (currentStatus === 'Due Today' || currentStatus === 'Overdue')) ||
        (status === 'Upcoming' && question.nextReviewDate > today && currentStatus !== 'Mastered') ||
        currentStatus === status;
      return (!query || text.includes(query.toLowerCase())) &&
        (topic === 'All topics' || question.topic === topic) &&
        (difficulty === 'All difficulties' || question.difficulty === difficulty) &&
        matchesStatus &&
        (!dateFilter || question.nextReviewDate === dateFilter);
    });
    return list.sort((a, b) => {
      if (sort === 'added') return b.createdAt.localeCompare(a.createdAt);
      if (sort === 'topic') return a.topic.localeCompare(b.topic);
      if (sort === 'difficulty') return ['Easy', 'Medium', 'Hard'].indexOf(a.difficulty) - ['Easy', 'Medium', 'Hard'].indexOf(b.difficulty);
      return a.nextReviewDate.localeCompare(b.nextReviewDate);
    });
  }, [questions, query, topic, difficulty, status, sort, dateFilter]);

  return (
    <div className="page">
      <PageHeading eyebrow="YOUR LIBRARY" title="Questions" description={`${questions.length} problems in your personal revision system.`} action={<Link to="/add" className="button primary"><Plus size={16} /> Add question</Link>} />

      <div className="question-library-card">
        <div className="library-toolbar">
          <div className="library-search"><Search size={16} /><input aria-label="Search questions" placeholder="Search by title, topic, or tag…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="filter-controls">
            <label className="filter-select"><SlidersHorizontal size={14} /><select aria-label="Filter by topic" value={topic} onChange={(event) => setTopic(event.target.value)}><option>All topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
            <select aria-label="Filter by difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
            <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Due / overdue</option><option>Upcoming</option><option>New</option><option>Learning</option><option>Due Today</option><option>Overdue</option><option>Mastered</option></select>
            <label className="sort-select"><ArrowDownUp size={14} /><select aria-label="Sort questions" value={sort} onChange={(event) => setSort(event.target.value as SortType)}><option value="next">Next review</option><option value="added">Date added</option><option value="difficulty">Difficulty</option><option value="topic">Topic</option></select></label>
          </div>
        </div>

        <div className="library-table-wrap">
          <table className="library-table">
            <thead><tr><th>QUESTION</th><th>TOPIC</th><th>DIFFICULTY</th><th>STAGE</th><th>NEXT REVIEW</th><th>STATUS</th><th aria-label="Open" /></tr></thead>
            <tbody>{filtered.map((question) => {
              const completed = question.completedStages.length;
              const percent = Math.round((completed / 7) * 100);
              return <tr key={question.id}>
                <td><Link to={`/questions/${question.id}`} className="table-question"><strong>{question.title}</strong><small>{question.tags.length ? question.tags.slice(0, 2).join(' · ') : `Added ${formatDate(question.createdAt, 'MMM d')}`}</small></Link></td>
                <td><span className="topic-cell"><span className="topic-dot" />{question.topic}</span></td>
                <td><DifficultyBadge difficulty={question.difficulty} /></td>
                <td><div className="stage-cell"><span>{Math.min(completed, 6)}/6</span><ProgressBar value={percent} compact /></div></td>
                <td><span className="date-cell">{question.completedStages.includes(6) ? 'Complete' : formatDate(question.nextReviewDate, 'MMM d, yyyy')}</span></td>
                <td><StatusBadge question={question} /></td>
                <td><Link to={`/questions/${question.id}`} className="icon-link" aria-label={`View ${question.title}`}><ArrowUpRight size={15} /></Link></td>
              </tr>;
            })}</tbody>
          </table>
          {!filtered.length && <EmptyState title={questions.length ? 'No questions match these filters' : 'Your revision system is empty.'} description={questions.length ? 'Try broadening your search or changing a filter.' : 'Add your first problem and start building memory.'} action={!questions.length && <Link className="button primary" to="/add"><Plus size={16} /> Add your first question</Link>} />}
        </div>
        <div className="library-footer"><span>Showing <strong>{filtered.length}</strong> of {questions.length} questions</span><span>Fixed 0 · 3 · 7 · 15 · 30 · 60 · 120 day schedule</span></div>
      </div>
    </div>
  );
}
