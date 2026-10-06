import { addCalendarDays, todayKey } from './dates';
import { daysBetween } from './engine';
import type { Question } from '../../types';

export interface StudyRecommendation {
  question: Question;
  reason: string;
}

export function getStudyRecommendation(
  questions: Question[],
  today = todayKey(),
): StudyRecommendation | null {
  const active = questions.filter((question) => !question.completedStages.includes(6));
  if (!active.length) return null;

  const notReviewedToday = active.filter((question) =>
    !question.reviewHistory.some((review) => review.date === today),
  );
  const candidates = notReviewedToday.length ? notReviewedToday : active;
  const recentStart = addCalendarDays(today, -30);

  const score = (question: Question) => {
    const latestReviews = [...question.reviewHistory]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    const recentReviews = latestReviews.filter((review) => review.date >= recentStart);
    const againCount = recentReviews.filter((review) => review.result === 'again').length;
    const hardCount = recentReviews.filter((review) => review.result === 'hard').length;
    const overdueDays = question.nextReviewDate < today
      ? daysBetween(question.nextReviewDate, today)
      : 0;
    const isDue = question.nextReviewDate <= today;
    return {
      value: (isDue ? 100 : 0) + overdueDays * 10 + againCount * 8 + hardCount * 5,
      overdueDays,
      isDue,
      againCount,
      hardCount,
      recentDifficulty: againCount + hardCount,
    };
  };

  candidates.sort((a, b) => {
    const left = score(a);
    const right = score(b);
    return right.value - left.value ||
      a.nextReviewDate.localeCompare(b.nextReviewDate) ||
      a.reviewHistory.length - b.reviewHistory.length ||
      a.title.localeCompare(b.title);
  });

  const question = candidates[0];
  const result = score(question);
  const difficultCount = result.againCount + result.hardCount;
  const difficultLabel = `${difficultCount} recent difficult recall${difficultCount === 1 ? '' : 's'}`;
  const reason = result.overdueDays > 0
    ? `Overdue by ${result.overdueDays} day${result.overdueDays === 1 ? '' : 's'}${difficultCount ? `, with ${difficultLabel}` : ''}.`
    : result.isDue
      ? difficultCount
        ? `Due today, with ${difficultLabel}.`
        : 'This question is due today.'
      : difficultCount
        ? `${difficultLabel} in your last three attempts.`
        : `Next checkpoint: ${question.nextReviewDate}. Try a brief recall before checking your notes.`;

  return { question, reason };
}
