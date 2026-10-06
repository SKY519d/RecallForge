import { create } from 'zustand';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { addCalendarDays, todayKey } from '../core/revision/dates';
import { getStreak } from '../core/rewards';
import { createEmptyAppData, saveAccountAppData, saveAppData } from '../core/storage/localStorage';
import { saveCloudWorkspace } from '../core/auth/cloudWorkspace';
import type { AppData, ContestReminder, Question, ReviewResult, ScheduledTest, UserSettings } from '../types';

interface AppStore {
  data: AppData;
  userId: string | null;
  localOnly: boolean;
  storageError: string;
  cacheError: string;
  saveError: string;
  syncState: 'idle' | 'saving' | 'synced' | 'error';
  setWorkspace: (userId: string, data: AppData) => void;
  setLocalWorkspace: (data: AppData) => void;
  setLocalCacheError: (message: string) => void;
  clearWorkspace: () => void;
  retryCloudSave: () => void;
  flushCloudSave: () => Promise<void>;
  addQuestion: (question: Question) => void;
  updateQuestion: (question: Question) => void;
  updateContest: (contest: ContestReminder) => void;
  deleteContest: (id: string) => void;
  updateScheduledTest: (test: ScheduledTest | null) => void;
  deleteQuestion: (id: string) => void;
  completeReview: (id: string, result: ReviewResult) => { xp: number; nextReviewDate: string; mastered: boolean };
  updateSettings: (settings: Partial<UserSettings>) => void;
  importQuestions: (questions: Question[], replace: boolean) => void;
  restoreBackup: (data: AppData) => void;
  resetData: () => void;
}

type StoreSet = (state: Partial<AppStore>) => void;
type StoreGet = () => AppStore;
const cloudSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const cloudSaveQueues = new Map<string, Promise<void>>();

function queueCloudSave(userId: string, data: AppData, set: StoreSet, get: StoreGet) {
  const existingTimer = cloudSaveTimers.get(userId);
  if (existingTimer) clearTimeout(existingTimer);
  set({ syncState: 'saving' });
  cloudSaveTimers.set(userId, setTimeout(() => {
    cloudSaveTimers.delete(userId);
    const previous = cloudSaveQueues.get(userId) ?? Promise.resolve();
    const saving = previous.catch(() => undefined).then(() => saveCloudWorkspace(userId, data));
    cloudSaveQueues.set(userId, saving);
    void saving.then(() => {
      if (get().userId === userId && get().data === data) set({ syncState: 'synced', saveError: '' });
    }).catch((error: unknown) => {
      if (get().userId === userId) {
        set({
          syncState: 'error',
          saveError: error instanceof Error ? error.message : 'Cloud sync failed. Retry from Settings.',
        });
      }
    }).finally(() => {
      if (cloudSaveQueues.get(userId) === saving) cloudSaveQueues.delete(userId);
    });
  }, 500));
}

function persist(next: AppData, set: StoreSet, get: StoreGet) {
  const { userId, localOnly } = get();
  let cacheError = '';
  try {
    if (userId) saveAccountAppData(userId, next);
    else if (localOnly) saveAppData(next);
  } catch (error) {
    cacheError = error instanceof Error
      ? `Changes could not be saved in this browser: ${error.message}`
      : 'Changes could not be saved in this browser. Export a backup and check browser storage.';
  }
  set({ data: next, cacheError, storageError: '' });
  if (userId) queueCloudSave(userId, next, set, get);
}

export const useAppStore = create<AppStore>((set, get) => {
  return {
    data: createEmptyAppData(),
    userId: null,
    localOnly: false,
    storageError: '',
    cacheError: '',
    saveError: '',
    syncState: 'idle',
    setWorkspace: (userId, data) => set({ data, userId, localOnly: false, storageError: '', cacheError: '', saveError: '', syncState: 'synced' }),
    setLocalWorkspace: (data) => set({ data, userId: null, localOnly: true, storageError: '', cacheError: '', saveError: '', syncState: 'idle' }),
    setLocalCacheError: (message) => set({ cacheError: message }),
    clearWorkspace: () => set({ data: createEmptyAppData(), userId: null, localOnly: false, storageError: '', cacheError: '', saveError: '', syncState: 'idle' }),
    retryCloudSave: () => {
      const { userId, data } = get();
      if (!userId) return;
      const timer = cloudSaveTimers.get(userId);
      if (timer) clearTimeout(timer);
      cloudSaveTimers.delete(userId);
      queueCloudSave(userId, data, set, get);
    },
    flushCloudSave: async () => {
      const { userId, data } = get();
      if (!userId) throw new Error('No signed-in account is available for cloud sync.');
      const timer = cloudSaveTimers.get(userId);
      if (timer) clearTimeout(timer);
      cloudSaveTimers.delete(userId);
      set({ syncState: 'saving' });
      const previous = cloudSaveQueues.get(userId) ?? Promise.resolve();
      const saving = previous.catch(() => undefined).then(() => saveCloudWorkspace(userId, data));
      cloudSaveQueues.set(userId, saving);
      try {
        await saving;
        if (get().userId === userId && get().data === data) set({ syncState: 'synced', saveError: '' });
      } catch (error) {
        if (get().userId === userId) {
          set({
            syncState: 'error',
            saveError: error instanceof Error ? error.message : 'Cloud sync failed. Retry before signing out.',
          });
        }
        throw error;
      } finally {
        if (cloudSaveQueues.get(userId) === saving) cloudSaveQueues.delete(userId);
      }
    },
    addQuestion: (question) => {
      const { data } = get();
      persist({ ...data, questions: [question, ...data.questions], xp: data.xp + 5 }, set, get);
    },
    updateQuestion: (question) => {
      const { data } = get();
      persist({ ...data, questions: data.questions.map((item) => item.id === question.id ? question : item) }, set, get);
    },
    updateContest: (contest) => {
      const { data } = get();
      const contests = data.contests.some((item) => item.id === contest.id)
        ? data.contests.map((item) => item.id === contest.id ? contest : item)
        : [...data.contests, contest];
      persist({ ...data, contests }, set, get);
    },
    deleteContest: (id) => {
      const { data } = get();
      persist({ ...data, contests: data.contests.filter((contest) => contest.id !== id) }, set, get);
    },
    updateScheduledTest: (scheduledTest) => {
      const { data } = get();
      persist({ ...data, scheduledTest }, set, get);
    },
    deleteQuestion: (id) => {
      const { data } = get();
      persist({ ...data, questions: data.questions.filter((question) => question.id !== id) }, set, get);
    },
    completeReview: (id, result) => {
      const { data } = get();
      const today = todayKey();
      const question = data.questions.find((item) => item.id === id);
      if (!question) throw new Error('This question is no longer available.');
      const scheduledDate = question.nextReviewDate;
      const isScheduled = scheduledDate <= today;
      const baseXp = scheduledDate < today ? 12 : isScheduled ? 10 : 5;
      const stage = Math.min(question.completedStages.length, 6);
      const advances = result !== 'again';
      const earned = baseXp + (advances ? 15 : 0);
      const review = {
        id: crypto.randomUUID(),
        date: today,
        stage,
        result,
        xp: earned,
      };
      const completedStages = advances && !question.completedStages.includes(stage)
        ? [...question.completedStages, stage]
        : question.completedStages;
      const wasMastered = question.completedStages.includes(6);
      const masteredNow = !wasMastered && completedStages.includes(6);
      let nextReviewDate = question.nextReviewDate;
      let pendingReinforcement = false;
      if (wasMastered) {
        nextReviewDate = question.revisionSchedule[6];
      } else if (advances) {
        nextReviewDate = masteredNow
          ? question.revisionSchedule[6]
          : question.revisionSchedule[Math.min(completedStages.length, 6)];
      } else {
        nextReviewDate = addCalendarDays(today, 1);
        pendingReinforcement = true;
      }
      const updatedQuestion: Question = {
        ...question,
        completedStages,
        nextReviewDate,
        pendingReinforcement,
        reviewHistory: [...question.reviewHistory, review],
      };
      const questions = data.questions.map((item) => item.id === id ? updatedQuestion : item);
      let xp = data.xp + earned;
      const goalDays = [...data.dailyGoalDays];
      const todayCount = questions.reduce(
        (count, item) => count + item.reviewHistory.filter((record) => record.date === today).length,
        0,
      );
      if (todayCount >= data.settings.dailyGoal && !goalDays.includes(today)) {
        xp += 30;
        goalDays.push(today);
      }
      const streak = getStreak(questions, today);
      const weekKey = format(startOfWeek(parseISO(today), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weeklyStreaks = [...data.weeklyStreaks];
      const weekId = Number(weekKey.replace(/-/g, ''));
      const weekBonus = streak.current >= 7 && !weeklyStreaks.includes(weekId) ? 75 : 0;
      if (weekBonus) {
        xp += 75;
        weeklyStreaks.push(weekId);
      }
      persist({ ...data, questions, xp, dailyGoalDays: goalDays, weeklyStreaks }, set, get);
      const dailyBonus = todayCount === data.settings.dailyGoal && !data.dailyGoalDays.includes(today) ? 30 : 0;
      return { xp: earned + dailyBonus + weekBonus, nextReviewDate, mastered: masteredNow };
    },
    updateSettings: (settings) => {
      const { data } = get();
      persist({ ...data, settings: { ...data.settings, ...settings } }, set, get);
    },
    importQuestions: (questions, replace) => {
      const { data } = get();
      persist({
        ...data,
        questions: replace ? questions : [...questions, ...data.questions],
        xp: replace ? 0 : data.xp,
        dailyGoalDays: replace ? [] : data.dailyGoalDays,
        weeklyStreaks: replace ? [] : data.weeklyStreaks,
      }, set, get);
    },
    restoreBackup: (restored) => persist(restored, set, get),
    resetData: () => persist({ ...createEmptyAppData(), createdAt: new Date().toISOString() }, set, get),
  };
});

export function getTodayReviewCount(data: AppData): number {
  const today = todayKey();
  return data.questions.reduce(
    (count, question) => count + question.reviewHistory.filter((review) => review.date === today).length,
    0,
  );
}

export function addDaysForDisplay(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}
