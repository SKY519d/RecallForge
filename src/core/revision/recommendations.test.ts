import { describe, expect, it } from 'vitest';
import { createQuestion } from './engine';
import { getStudyRecommendation } from './recommendations';
import type { Question } from '../../types';

const question = (title: string, nextReviewDate: string, reviewHistory: Question['reviewHistory'] = []): Question => ({
  ...createQuestion({ title, topic: 'Arrays', difficulty: 'Medium', createdAt: '2026-09-01' }),
  id: title,
  nextReviewDate,
  reviewHistory,
});

describe('study recommendations', () => {
  it('prioritizes overdue work over questions with future checkpoints', () => {
    const overdue = question('Overdue', '2026-10-01');
    const future = question('Future', '2026-10-20', [{
      id: 'hard-review',
      date: '2026-10-03',
      stage: 0,
      result: 'hard',
      xp: 10,
    }]);

    expect(getStudyRecommendation([future, overdue], '2026-10-04')?.question.title).toBe('Overdue');
  });

  it('prefers recent difficult recall when due dates are equally urgent', () => {
    const difficult = question('Difficult', '2026-10-04', [{
      id: 'again-review',
      date: '2026-10-03',
      stage: 0,
      result: 'again',
      xp: 12,
    }]);
    const steady = question('Steady', '2026-10-04');

    expect(getStudyRecommendation([steady, difficult], '2026-10-04')?.question.title).toBe('Difficult');
  });

  it('avoids recommending a question already reviewed today when another is available', () => {
    const reviewed = question('Reviewed', '2026-10-04', [{
      id: 'today-review',
      date: '2026-10-04',
      stage: 0,
      result: 'again',
      xp: 12,
    }]);
    const fresh = question('Fresh', '2026-10-04');

    expect(getStudyRecommendation([reviewed, fresh], '2026-10-04')?.question.title).toBe('Fresh');
  });

  it('returns no suggestion when every question is mastered', () => {
    const mastered = {
      ...question('Mastered', '2026-10-04'),
      completedStages: [0, 1, 2, 3, 4, 5, 6],
    };

    expect(getStudyRecommendation([mastered], '2026-10-04')).toBeNull();
  });
});
