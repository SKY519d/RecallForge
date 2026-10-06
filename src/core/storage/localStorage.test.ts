import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyAppData,
  hasLegacyAppData,
  loadAccountAppData,
  loadLegacyAppData,
  parseBackup,
  removeLegacyAppData,
  saveAccountAppData,
} from './localStorage';

afterEach(() => vi.unstubAllGlobals());

describe('personalization settings migration', () => {
  it('fills new branding and appearance settings when loading an older backup', () => {
    const restored = parseBackup({ questions: [], xp: 0 });

    expect(restored.settings.appName).toBe('RecallForge');
    expect(restored.settings.displayName).toBe('Student');
    expect(restored.settings.theme).toBe('paper');
    expect(restored.settings.accentColor).toBe('blue');
    expect(restored.settings.density).toBe('comfortable');
  });

  describe('account-scoped browser storage', () => {
    function stubStorage() {
      const values = new Map<string, string>();
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      });
    }

    it('keeps each account cache separate', () => {
      stubStorage();
      const alice = createEmptyAppData();
      alice.settings.appName = 'Alice Desk';
      saveAccountAppData('alice-id', alice);

      expect(loadAccountAppData('alice-id')?.settings.appName).toBe('Alice Desk');
      expect(loadAccountAppData('bob-id')).toBeNull();
    });

    it('reads legacy data only through the explicit migration helper', () => {
      stubStorage();
      const legacy = { ...createEmptyAppData(), xp: 42 };
      localStorage.setItem('recallforge-v1', JSON.stringify(legacy));

      expect(hasLegacyAppData()).toBe(true);
      expect(loadLegacyAppData().xp).toBe(42);
      removeLegacyAppData();
      expect(hasLegacyAppData()).toBe(false);
    });
  });

  it('uses safe defaults for invalid personalization values in a backup', () => {
    const restored = parseBackup({
      questions: [],
      xp: 0,
      settings: { appName: 42, displayName: false, accentColor: 'pink', density: 'tiny' },
    });

    expect(restored.settings.appName).toBe('RecallForge');
    expect(restored.settings.displayName).toBe('Student');
    expect(restored.settings.accentColor).toBe('blue');
    expect(restored.settings.density).toBe('comfortable');
  });
});
