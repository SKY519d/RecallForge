import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Activity, Award, BookOpenCheck, CalendarDays, Flame, Layers3, Target, Trophy, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardTitle, EmptyState, PageHeading, ProgressBar, StatCard } from '../components/common';
import { getActivity, getBadges, getLevel, getStreak } from '../core/rewards';
import { getQuestionCounts, getQuestionStatus, getRevisionStage } from '../core/revision/engine';
import { todayKey } from '../core/revision/dates';
import { useAppStore } from '../store/appStore';

const colors = ['#9485ff', '#4cc9d0', '#f5b971', '#f2758d', '#71c6a2', '#7da9ed', '#d38ff0'];

export function AnalyticsPage() {
  const data = useAppStore((state) => state.data);
  const paperTheme = data.settings.theme === 'paper';
  const chartColors = paperTheme
    ? ['#315b96', '#63928b', '#c17b52', '#a85456', '#698a61', '#6687ad', '#9876a0']
    : colors;
  const chartGrid = paperTheme ? '#d7dfe0' : '#292a32';
  const chartLabel = paperTheme ? '#5f7080' : '#858895';
  const chartTooltip = paperTheme
    ? { background: '#fffefa', border: '1px solid #bac6cd', borderRadius: 2, color: '#263b54', fontSize: 12 }
    : { background: '#1b1c22', border: '1px solid #30313a', borderRadius: 10, color: '#fff', fontSize: 12 };
  const activityLine = paperTheme ? '#315b96' : '#9887fa';
  const questions = data.questions;
  const today = todayKey();
  const total = questions.length;
  const statusCounts = getQuestionCounts(questions, today);
  const reviews = questions.flatMap((question) => question.reviewHistory);
  const streak = getStreak(questions);
  const level = getLevel(data.xp);
  const activity = getActivity(questions, 28).map((item) => ({ ...item, label: format(parseISO(item.date), 'MMM d'), day: format(parseISO(item.date), 'EEEEE') }));
  const heatmap = getActivity(questions, 91);
  const weekdayCounts = reviews.reduce<Record<string, number>>((acc, review) => {
    const day = format(parseISO(review.date), 'EEEE');
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});
  const consistentDay = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0];
  const topicStats = useMemo(() => {
    const groups = questions.reduce<Record<string, { topic: string; total: number; mastered: number; due: number; reviews: number }>>((acc, question) => {
      const group = acc[question.topic] ?? { topic: question.topic, total: 0, mastered: 0, due: 0, reviews: 0 };
      group.total += 1;
      group.reviews += question.reviewHistory.length;
      if (getQuestionStatus(question, today) === 'Mastered') group.mastered += 1;
      if (['Due Today', 'Overdue'].includes(getQuestionStatus(question, today))) group.due += 1;
      acc[question.topic] = group;
      return acc;
    }, {});
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [questions, today]);
  const difficultyStats = (['Easy', 'Medium', 'Hard'] as const).map((difficulty) => ({
    name: difficulty,
    value: questions.filter((question) => question.difficulty === difficulty).length,
  }));
  const stageStats = [0, 1, 2, 3, 4, 5, 6].map((stage) => ({
    stage: `Day ${[0, 3, 7, 15, 30, 60, 120][stage]}`,
    count: questions.filter((question) => getRevisionStage(question) === stage || question.completedStages.includes(stage)).length,
  }));
  const activityTotal = reviews.length;
  const hardestShare = reviews.length ? Math.round((reviews.filter((item) => item.result === 'hard').length / reviews.length) * 100) : 0;
  const closeToMastery = questions.filter((question) => question.completedStages.length >= 5 && !question.completedStages.includes(6)).length;
  const bestTopic = topicStats.filter((item) => item.total > 0).sort((a, b) => b.mastered / b.total - a.mastered / a.total)[0];
  const badges = getBadges(questions);

  return (
    <div className="page analytics-page">
      <PageHeading eyebrow="YOUR PROGRESS" title="Progress that compounds." description="A clear view of your review habits, question mix, and long-term milestones." action={<div className="analytics-level-pill"><span>LEVEL {level.level}</span><strong>{level.title}</strong></div>} />
      <div className="stat-grid analytics-stats">
        <StatCard label="Total questions" value={total} detail={`${statusCounts.new} new · ${statusCounts.learning} learning`} icon={<BookOpenCheck size={17} />} />
        <StatCard label="Due / overdue" value={statusCounts.due + statusCounts.overdue} detail={`${statusCounts.overdue} overdue`} icon={<CalendarDays size={17} />} accent="stat-orange" />
        <StatCard label="Mastered" value={statusCounts.mastered} detail="Day 120 checkpoints complete" icon={<Trophy size={17} />} accent="stat-violet" />
        <StatCard label="Reviews completed" value={activityTotal} detail={`${streak.current} day current streak`} icon={<Activity size={17} />} accent="stat-cyan" />
      </div>

      <div className="analytics-chart-grid">
        <Card className="wide-chart-card">
          <CardTitle icon={<TrendingUp size={17} />} title="Revision activity" detail="Completed recalls over the last 28 days" />
          {activityTotal ? <div className="large-chart"><ResponsiveContainer width="100%" height={245}><LineChart data={activity} margin={{ top: 16, right: 14, left: -22, bottom: 0 }}>
            <CartesianGrid stroke={chartGrid} vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} interval={3} tick={{ fill: chartLabel, fontSize: 11 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: chartLabel, fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltip} formatter={(value) => [`${value} reviews`, 'Completed']} />
            <Line type="monotone" dataKey="count" stroke={activityLine} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: paperTheme ? '#6688b0' : '#b7aaff', stroke: paperTheme ? '#fffefa' : '#17171c', strokeWidth: 2 }} />
          </LineChart></ResponsiveContainer></div> : <EmptyState title="Your activity chart starts with your first review" description="Only completed recalls appear here; no activity is fabricated." /> }
        </Card>
        <Card>
          <CardTitle icon={<Layers3 size={17} />} title="Difficulty mix" detail="Question library, not review ratings" />
          {total ? <div className="difficulty-chart-wrap"><div className="difficulty-donut"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={difficultyStats} dataKey="value" nameKey="name" innerRadius={53} outerRadius={76} paddingAngle={4} stroke="none">{difficultyStats.map((entry, index) => <Cell key={entry.name} fill={chartColors[index]} />)}</Pie><Tooltip contentStyle={chartTooltip} /></PieChart></ResponsiveContainer><div className="donut-total"><strong>{total}</strong><small>questions</small></div></div><div className="difficulty-legend">{difficultyStats.map((item, index) => <div key={item.name}><span><i style={{ background: chartColors[index] }} />{item.name}</span><strong>{item.value}</strong></div>)}</div></div> : <EmptyState title="No questions yet" description="Difficulty distribution appears once you add questions." />}
        </Card>
      </div>

      <Card className="heatmap-card">
        <CardTitle icon={<Activity size={17} />} title="Review heatmap" detail="Real completed reviews · last 13 weeks" action={<span className="heatmap-legend">Less <i className="heat-level-0" /><i className="heat-level-1" /><i className="heat-level-2" /><i className="heat-level-3" /> More</span>} />
        <div className="heatmap-scroll"><div className="heatmap-grid">{heatmap.map((item) => {
          const levelValue = item.count === 0 ? 0 : item.count === 1 ? 1 : item.count <= 3 ? 2 : 3;
          return <span key={item.date} className={`heatmap-cell heat-level-${levelValue}`} title={`${format(parseISO(item.date), 'MMM d')}: ${item.count} ${item.count === 1 ? 'review' : 'reviews'}`} aria-label={`${item.date}: ${item.count} reviews`} />;
        })}</div></div>
        <div className="heatmap-foot"><span>{format(parseISO(heatmap[0]?.date ?? today), 'MMM d')}</span><strong>{activityTotal ? `${activityTotal} total review${activityTotal === 1 ? '' : 's'} recorded` : 'No review activity recorded yet'}</strong><span>Today</span></div>
      </Card>

      <div className="analytics-lower-grid">
        <Card>
          <CardTitle icon={<Layers3 size={17} />} title="Topic breakdown" detail="Progress within each topic" />
          {topicStats.length ? <div className="topic-analytics-list">{topicStats.map((item) => <div key={item.topic} className="topic-analytics-row"><div className="topic-analytics-heading"><strong>{item.topic}</strong><span>{item.mastered}/{item.total} mastered <i>·</i> {item.due} due</span></div><ProgressBar value={(item.mastered / item.total) * 100} compact /></div>)}</div> : <EmptyState title="Topics will appear as you add questions." />}
        </Card>
        <Card>
          <CardTitle icon={<Target size={17} />} title="Checkpoint progress" detail="Questions touching each stage" />
          {total ? <div className="stage-chart"><ResponsiveContainer width="100%" height={220}><BarChart data={stageStats} layout="vertical" margin={{ top: 2, right: 10, left: -10, bottom: 0 }} barSize={11}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="stage" axisLine={false} tickLine={false} width={56} tick={{ fill: chartLabel, fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltip} formatter={(value) => [`${value} questions`, 'Checkpoint']} />
            <Bar dataKey="count" fill={paperTheme ? '#638b91' : '#69c4c5'} radius={paperTheme ? [0, 1, 1, 0] : [0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer></div> : <EmptyState title="Your first checkpoint is Day 0" description="Add a question to start." />}
        </Card>
      </div>

      <div className="analytics-lower-grid">
        <Card>
          <CardTitle icon={<Activity size={17} />} title="Review patterns" detail="Summary of your recorded activity" />
          <div className="insight-list">
            <div className="insight-row"><span><Flame size={15} /></span><p>{streak.current ? `You're on a ${streak.current}-day review streak. Your longest is ${streak.longest} days.` : 'Your next completed review will start a streak.'}</p></div>
            <div className="insight-row"><span><Target size={15} /></span><p>{hardestShare ? `Hard recall ratings make up ${hardestShare}% of completed sessions.` : 'Recall ratings will show which sessions took more effort.'}</p></div>
            <div className="insight-row"><span><Layers3 size={15} /></span><p>{bestTopic ? `${bestTopic.topic} has your highest mastery share (${bestTopic.mastered} of ${bestTopic.total}).` : 'Topic mastery appears as you build your library.'}</p></div>
            <div className="insight-row"><span><CalendarDays size={15} /></span><p>{closeToMastery ? `${closeToMastery} ${closeToMastery === 1 ? 'question is' : 'questions are'} within two checkpoints of mastery.` : 'Questions nearing Day 120 will be highlighted here.'}</p></div>
            {consistentDay && <div className="insight-row"><span><Activity size={15} /></span><p>{consistentDay[0]} is your most active review day so far, with {consistentDay[1]} completed sessions.</p></div>}
          </div>
        </Card>
        <Card>
          <CardTitle icon={<Award size={17} />} title="Milestones" detail="A small set of meaningful achievements" />
          <div className="milestone-list">{badges.map((badge) => {
            const unlocked = badge.progress === badge.goal;
            return <div className={`milestone-row ${unlocked ? 'unlocked' : ''}`} key={badge.name}><span className="milestone-icon"><Trophy size={15} /></span><span className="milestone-copy"><strong>{badge.name}</strong><small>{badge.detail}</small><ProgressBar value={(badge.progress / badge.goal) * 100} compact /></span><span className="milestone-count">{unlocked ? '✓' : `${badge.progress}/${badge.goal}`}</span></div>;
          })}</div>
        </Card>
      </div>
    </div>
  );
}
