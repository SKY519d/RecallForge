import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { REVISION_DAYS, type Question, type QuestionStatus } from '../../types';
import { addCalendarDays, todayKey } from './dates';

export function calculateRevisionSchedule(startDate: string, intervals: readonly number[] = REVISION_DAYS): string[] {
  return intervals.map((day) => addCalendarDays(startDate, day));
}

export function getRevisionStage(question: Question): number {
  return Math.min(question.completedStages.length, REVISION_DAYS.length - 1);
}

export function getRevisionDay(question: Question, stage: number): number {
  return daysBetween(question.createdAt, question.revisionSchedule[stage]);
}

export function getNextReviewDate(question: Question): string {
  return question.nextReviewDate;
}

export function getQuestionStatus(question: Question, onDate = todayKey()): QuestionStatus {
  if (question.completedStages.includes(6)) return 'Mastered';
  if (question.nextReviewDate < onDate) return 'Overdue';
  if (question.completedStages.length === 0 && question.nextReviewDate > onDate) return 'New';
  if (question.nextReviewDate === onDate) return 'Due Today';
  return 'Learning';
}

export function getDueQuestions(questions: Question[], date = todayKey()): Question[] {
  return questions.filter((question) =>
    !question.completedStages.includes(6) && question.nextReviewDate === date,
  );
}

export function getOverdueQuestions(questions: Question[], date = todayKey()): Question[] {
  return questions.filter((question) =>
    !question.completedStages.includes(6) && question.nextReviewDate < date,
  );
}

export function getUpcomingQuestions(
  questions: Question[],
  fromDate = todayKey(),
  range = 7,
): Question[] {
  const until = addCalendarDays(fromDate, range);
  return questions.filter((question) =>
    !question.completedStages.includes(6) &&
    question.nextReviewDate > fromDate &&
    question.nextReviewDate <= until,
  );
}

export function getQuestionProgress(question: Question): number {
  return Math.round((question.completedStages.length / REVISION_DAYS.length) * 100);
}

export function getQuestionCounts(questions: Question[], date = todayKey()) {
  const counts = { total: questions.length, new: 0, learning: 0, due: 0, overdue: 0, mastered: 0 };
  for (const question of questions) {
    const status = getQuestionStatus(question, date);
    if (status === 'New') counts.new += 1;
    else if (status === 'Learning') counts.learning += 1;
    else if (status === 'Due Today') counts.due += 1;
    else if (status === 'Overdue') counts.overdue += 1;
    else counts.mastered += 1;
  }
  return counts;
}

export function createQuestion(input: {
  title: string;
  topic: string;
  difficulty: Question['difficulty'];
  createdAt?: string;
  revisionIntervals?: readonly number[];
  [key: string]: unknown;
}): Question {
  const createdAt = input.createdAt ?? todayKey();
  const revisionSchedule = calculateRevisionSchedule(createdAt, input.revisionIntervals ?? REVISION_DAYS);
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    problem: String(input.problem ?? ''),
    solution: String(input.solution ?? ''),
    notes: String(input.notes ?? ''),
    topic: input.topic.trim(),
    tags: Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    difficulty: input.difficulty,
    source: String(input.source ?? ''),
    url: String(input.url ?? ''),
    createdAt,
    revisionSchedule,
    completedStages: [],
    nextReviewDate: createdAt,
    pendingReinforcement: false,
    reviewHistory: [],
  };
}

export function daysBetween(first: string, second: string): number {
  return differenceInCalendarDays(parseISO(second), parseISO(first));
}

export function weekday(dateKey: string): string {
  return format(parseISO(dateKey), 'EEEE');
}
