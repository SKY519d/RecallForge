import { DEFAULT_SETTINGS, type AppData, type Question } from '../../types';

const STORAGE_KEY = 'recallforge-v1';
const accountStorageKey = (userId: string) => `${STORAGE_KEY}:user:${userId}`;

export function createEmptyAppData(): AppData {
  return {
  questions: [],
  contests: [],
  scheduledTest: null,
  xp: 0,
  settings: { ...DEFAULT_SETTINGS, revisionIntervals: [...DEFAULT_SETTINGS.revisionIntervals] },
  createdAt: new Date().toISOString(),
  dailyGoalDays: [],
  weeklyStreaks: [],
  };
}

export const emptyAppData: AppData = createEmptyAppData();

export function loadAppData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyAppData;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as AppData).questions)) {
    throw new Error('Saved application data is not valid. Export a backup before resetting the app.');
  }
  const data = parsed as AppData;
  if (data.settings?.revisionIntervals && !isValidRevisionIntervals(data.settings.revisionIntervals)) {
    throw new Error('Saved revision intervals are invalid. Export a backup before resetting the app.');
  }
  return {
    ...emptyAppData,
    ...data,
    dailyGoalDays: data.dailyGoalDays ?? [],
    weeklyStreaks: data.weeklyStreaks ?? [],
    contests: data.contests ?? [],
    scheduledTest: data.scheduledTest ?? null,
    settings: normalizeSettings(data.settings),
    questions: data.questions,
  };
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function hasLegacyAppData(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function removeLegacyAppData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadLegacyAppData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyAppData();
  return parseBackup(JSON.parse(raw));
}

export function loadAccountAppData(userId: string): AppData | null {
  const raw = localStorage.getItem(accountStorageKey(userId));
  return raw ? parseBackup(JSON.parse(raw)) : null;
}

export function saveAccountAppData(userId: string, data: AppData): void {
  localStorage.setItem(accountStorageKey(userId), JSON.stringify(data));
}

export function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false;
  const question = value as Question;
  return typeof question.id === 'string' &&
    typeof question.title === 'string' &&
    typeof question.topic === 'string' &&
    Array.isArray(question.revisionSchedule) &&
    Array.isArray(question.completedStages) &&
    Array.isArray(question.reviewHistory);
}

export function parseBackup(value: unknown): AppData {
  if (!value || typeof value !== 'object') throw new Error('This file is not a valid application backup.');
  const candidate = value as Partial<AppData>;
  if (!Array.isArray(candidate.questions) || !candidate.questions.every(isQuestion)) {
    throw new Error('The backup is missing valid question records.');
  }
  if (typeof candidate.xp !== 'number' || candidate.xp < 0) throw new Error('The backup contains invalid XP data.');
  if (candidate.settings?.revisionIntervals && !isValidRevisionIntervals(candidate.settings.revisionIntervals)) {
    throw new Error('The backup contains invalid revision intervals.');
  }
  return {
    ...emptyAppData,
    ...candidate,
    dailyGoalDays: candidate.dailyGoalDays ?? [],
    weeklyStreaks: candidate.weeklyStreaks ?? [],
    contests: candidate.contests ?? [],
    scheduledTest: candidate.scheduledTest ?? null,
    settings: normalizeSettings(candidate.settings),
  };
}

function normalizeSettings(settings: Partial<AppData['settings']> | undefined): AppData['settings'] {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  return {
    ...merged,
    appName: typeof merged.appName === 'string' ? merged.appName.slice(0, 40) : DEFAULT_SETTINGS.appName,
    displayName: typeof merged.displayName === 'string' ? merged.displayName.slice(0, 32) : DEFAULT_SETTINGS.displayName,
    accentColor: ['teal', 'blue', 'ochre'].includes(merged.accentColor) ? merged.accentColor : DEFAULT_SETTINGS.accentColor,
    density: ['comfortable', 'compact'].includes(merged.density) ? merged.density : DEFAULT_SETTINGS.density,
  };
}

export function isValidRevisionIntervals(value: unknown): value is number[] {
  return Array.isArray(value) &&
    value.length === 7 &&
    value[0] === 0 &&
    value.every((day, index) =>
      Number.isInteger(day) &&
      day >= 0 &&
      day <= 3650 &&
      (index === 0 || day > value[index - 1]),
    );
}
