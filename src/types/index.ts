export const REVISION_DAYS = [0, 3, 7, 15, 30, 60, 120] as const;

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ReviewResult = 'again' | 'hard' | 'good' | 'easy';
export type QuestionStatus = 'New' | 'Learning' | 'Due Today' | 'Overdue' | 'Mastered';

export interface ReviewRecord {
  id: string;
  date: string;
  stage: number;
  result: ReviewResult;
  xp: number;
}

export interface Question {
  id: string;
  title: string;
  problem: string;
  solution: string;
  notes: string;
  topic: string;
  tags: string[];
  difficulty: Difficulty;
  source: string;
  url: string;
  createdAt: string;
  revisionSchedule: string[];
  completedStages: number[];
  nextReviewDate: string;
  pendingReinforcement: boolean;
  reviewHistory: ReviewRecord[];
}

export interface UserSettings {
  theme: 'paper' | 'dark' | 'light' | 'system' | 'petal' | 'afterglow';
  appName: string;
  displayName: string;
  accentColor: 'teal' | 'blue' | 'ochre';
  density: 'comfortable' | 'compact';
  defaultDifficulty: Difficulty;
  dailyGoal: number;
  soundEffects: boolean;
  animations: boolean;
  confirmDelete: boolean;
  notifications: boolean;
  revisionIntervals: number[];
}

export interface ContestReminder {
  id: string;
  platform: string;
  title: string;
  url: string;
  startsAt: string;
  reminderMinutes: number;
  remindedAt?: string;
}

export interface ScheduledTest {
  date: string;
  time: string;
  durationMinutes: number;
  remindedAt?: string;
}

export interface AppData {
  questions: Question[];
  contests: ContestReminder[];
  scheduledTest: ScheduledTest | null;
  xp: number;
  settings: UserSettings;
  createdAt: string;
  dailyGoalDays: string[];
  weeklyStreaks: number[];
}

export const DEFAULT_TOPICS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stack', 'Queue', 'Binary Search',
  'Sorting', 'Recursion', 'Trees', 'BST', 'Heap', 'Hashing', 'Graphs',
  'Greedy', 'Dynamic Programming', 'Backtracking', 'Bit Manipulation',
];

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'paper',
  appName: 'RecallForge',
  displayName: 'Student',
  accentColor: 'blue',
  density: 'comfortable',
  defaultDifficulty: 'Medium',
  dailyGoal: 3,
  soundEffects: false,
  animations: true,
  confirmDelete: true,
  notifications: false,
  revisionIntervals: [...REVISION_DAYS],
};
