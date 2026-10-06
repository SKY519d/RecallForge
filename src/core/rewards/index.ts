import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns';
import type { Question } from '../../types';
import { todayKey } from '../revision/dates';
import { getOverdueQuestions } from '../revision/engine';

const LEVELS = [
  { xp: 0, title: 'Starter' },
  { xp: 100, title: 'Learner' },
  { xp: 250, title: 'Problem Solver' },
  { xp: 500, title: 'Pattern Hunter' },
  { xp: 900, title: 'Algorithm Builder' },
  { xp: 1450, title: 'DSA Specialist' },
  { xp: 2200, title: 'Memory Master' },
];

export function getLevel(xp: number) {
  const index = LEVELS.reduce((last, level, current) => xp >= level.xp ? current : last, 0);
  const current = LEVELS[index];
  const next = LEVELS[index + 1];
  return {
    level: index + 1,
    title: current.title,
    currentXp: xp - current.xp,
    nextLevelXp: next ? next.xp - current.xp : 0,
    progress: next ? Math.min(100, ((xp - current.xp) / (next.xp - current.xp)) * 100) : 100,
  };
}

export function getReviewDays(questions: Question[]): string[] {
  return [...new Set(questions.flatMap((question) => question.reviewHistory.map((review) => review.date)))].sort();
}

export function getStreak(questions: Question[], today = todayKey()) {
  const activeDays = new Set(getReviewDays(questions));
  let streak = 0;
  let cursor = activeDays.has(today) ? today : format(subDays(parseISO(today), 1), 'yyyy-MM-dd');
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = format(subDays(parseISO(cursor), 1), 'yyyy-MM-dd');
  }
  let longest = 0;
  let current = 0;
  let previous = '';
  for (const date of [...activeDays].sort()) {
    current = previous && format(subDays(parseISO(date), 1), 'yyyy-MM-dd') === previous ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return { current: streak, longest };
}

export function getDailyQuest(questions: Question[], goal: number) {
  const today = todayKey();
  const reviewsToday = questions.reduce(
    (count, question) => count + question.reviewHistory.filter((review) => review.date === today).length,
    0,
  );
  return { label: `Complete ${goal} reviews today`, progress: Math.min(reviewsToday, goal), goal, complete: reviewsToday >= goal };
}

export function getActivity(questions: Question[], days = 28) {
  const end = parseISO(todayKey());
  const start = subDays(end, days - 1);
  return eachDayOfInterval({ start, end }).map((date) => {
    const key = format(date, 'yyyy-MM-dd');
    const count = questions.reduce(
      (sum, question) => sum + question.reviewHistory.filter((review) => review.date === key).length,
      0,
    );
    return { date: key, count };
  });
}

export function getBadges(questions: Question[]) {
  const history = questions.flatMap((question) => question.reviewHistory);
  const mastered = questions.filter((question) => question.completedStages.includes(6));
  const hardReviews = history.filter((review) => review.result === 'hard' && review.stage > 0).length;
  const longTerm = questions.filter((question) => question.completedStages.includes(5) || question.completedStages.includes(6)).length;
  const arrays = mastered.filter((question) => question.topic.toLowerCase() === 'arrays').length;
  const streak = getStreak(questions);
  const overdue = getOverdueQuestions(questions).length;
  return [
    { name: 'First Recall', detail: 'Complete your first review', progress: Math.min(history.length, 1), goal: 1, icon: 'sparkles' },
    { name: 'Three-Day Memory', detail: 'Review on 3 consecutive days', progress: Math.min(streak.longest, 3), goal: 3, icon: 'flame' },
    { name: 'Week Warrior', detail: 'Maintain a 7-day review streak', progress: Math.min(streak.longest, 7), goal: 7, icon: 'calendar' },
    { name: 'Clean Slate', detail: 'Clear all overdue questions', progress: questions.length > 0 && overdue === 0 ? 1 : 0, goal: 1, icon: 'check' },
    { name: 'Deep Recall', detail: 'Complete 10 hard reviews', progress: Math.min(hardReviews, 10), goal: 10, icon: 'target' },
    { name: 'Long-Term', detail: 'Reach Day 60 on 5 questions', progress: Math.min(longTerm, 5), goal: 5, icon: 'calendar' },
    { name: 'Mastered', detail: 'Complete a Day 120 checkpoint', progress: Math.min(mastered.length, 1), goal: 1, icon: 'award' },
    { name: 'Array Architect', detail: 'Master 10 Array questions', progress: Math.min(arrays, 10), goal: 10, icon: 'layers' },
  ];
}
