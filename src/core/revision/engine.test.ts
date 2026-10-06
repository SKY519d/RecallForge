import { describe, expect, it } from 'vitest';
import { calculateRevisionSchedule, createQuestion, getDueQuestions, getOverdueQuestions, getQuestionCounts, getQuestionStatus } from './engine';
import { isDateKey } from './dates';
import type { Question } from '../../types';
import { createExcelBuffer, previewExcel } from '../importExport/excel';

describe('canonical revision schedule', () => {
  it('calculates the Day 0, 3, 7, 15, 30, 60, and 120 checkpoints', () => {
    expect(calculateRevisionSchedule('2026-10-01')).toEqual([
      '2026-10-01', '2026-10-04', '2026-10-08', '2026-10-16', '2026-10-31', '2026-11-30', '2027-01-29',
    ]);
  });

  it('handles month, year, and leap-day boundaries as calendar dates', () => {
    expect(calculateRevisionSchedule('2026-01-30').slice(1, 4)).toEqual(['2026-02-02', '2026-02-06', '2026-02-14']);
    expect(calculateRevisionSchedule('2026-12-20')[6]).toBe('2027-04-19');
    expect(calculateRevisionSchedule('2024-02-29')[1]).toBe('2024-03-03');
    expect(isDateKey('2024-02-29')).toBe(true);
  });

  it('categorizes due and overdue questions using date-only comparisons', () => {
    const due = createQuestion({ title: 'Due', topic: 'Arrays', difficulty: 'Easy', createdAt: '2026-10-01' });
    const overdue = { ...due, id: 'late', nextReviewDate: '2026-09-30' };
    expect(getDueQuestions([due, overdue], '2026-10-01')).toEqual([due]);
    expect(getOverdueQuestions([due, overdue], '2026-10-01')).toEqual([overdue]);
    expect(getQuestionStatus(overdue, '2026-10-01')).toBe('Overdue');
  });

  it('removing a question also removes it from derived dashboard counts', () => {
    const question = createQuestion({ title: 'Two Sum', topic: 'Arrays', difficulty: 'Easy', createdAt: '2026-10-01' });
    expect(getQuestionCounts([question], '2026-10-01').due).toBe(1);
    expect(getQuestionCounts([], '2026-10-01')).toEqual({ total: 0, new: 0, learning: 0, due: 0, overdue: 0, mastered: 0 });
  });

  it('marks a question mastered after the Day 120 checkpoint', () => {
    const mastered: Question = {
      ...createQuestion({ title: 'Mastered', topic: 'Trees', difficulty: 'Hard', createdAt: '2026-06-01' }),
      completedStages: [0, 1, 2, 3, 4, 5, 6],
      nextReviewDate: '2026-09-29',
    };
    expect(getQuestionStatus(mastered, '2026-10-01')).toBe('Mastered');
  });

  it('keeps question revision dates and progress through an Excel round trip', async () => {
    const question: Question = {
      ...createQuestion({ title: 'Binary Search', topic: 'Binary Search', difficulty: 'Medium', createdAt: '2026-10-01' }),
      completedStages: [0, 1, 2],
      nextReviewDate: '2026-10-16',
      reviewHistory: [{
        id: 'review-1',
        date: '2026-10-08',
        stage: 2,
        result: 'good',
        xp: 25,
      }],
    };
    const buffer = await createExcelBuffer([question]);
    const workbookFile = new File([buffer], 'recallforge-round-trip.xlsx');
    const imported = await previewExcel(workbookFile);
    expect(imported.questions).toHaveLength(1);
    expect(imported.questions[0].title).toBe('Binary Search');
    expect(imported.questions[0].revisionSchedule).toEqual(question.revisionSchedule);
    expect(imported.questions[0].nextReviewDate).toBe('2026-10-16');
    expect(imported.questions[0].completedStages).toEqual([0, 1, 2]);
  });
});
