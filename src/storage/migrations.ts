import { StorageSchemaV1, TimerSession } from '../domain/types';

export const CURRENT_STORAGE_VERSION = 1;

export function createDefaultStorageState(): StorageSchemaV1 {
  return {
    version: 1,
    hasChosenGardenMode: false,
    gardenMode: 'personal',
    habits: [],
    activeTimer: null,
  };
}

/**
 * Мигрирует сырые данные из localStorage к актуальной версии схемы StorageSchemaV1.
 * Полностью сохраняет существующие деревья, ранее засчитанные выполнения и параметры роста.
 */
export function migrateStorageData(raw: unknown): StorageSchemaV1 {
  if (!raw || typeof raw !== 'object') {
    return createDefaultStorageState();
  }

  const record = raw as Record<string, unknown>;
  const version = typeof record.version === 'number' ? record.version : 0;

  if (version === 1) {
    const habits = Array.isArray(record.habits) ? record.habits : [];
    const gardenMode = record.gardenMode === 'demo' ? 'demo' : 'personal';
    const hasChosenGardenMode = Boolean(record.hasChosenGardenMode);
    const activeTimer =
      record.activeTimer && typeof record.activeTimer === 'object'
        ? (record.activeTimer as StorageSchemaV1['activeTimer'])
        : null;

    return {
      version: 1,
      hasChosenGardenMode,
      gardenMode,
      habits: habits.map((h: Record<string, unknown>) => {
        const targetDaysPerWeek =
          typeof h.targetDaysPerWeek === 'number'
            ? Math.min(7, Math.max(1, h.targetDaysPerWeek))
            : 4;
        const dailyTargetMinutes =
          typeof h.dailyTargetMinutes === 'number'
            ? Math.max(1, h.dailyTargetMinutes)
            : 20;
        const growthTargetDays =
          typeof h.growthTargetDays === 'number'
            ? Math.min(7, Math.max(1, h.growthTargetDays))
            : targetDaysPerWeek;
        const rawSessions = Array.isArray(h.sessions)
          ? (h.sessions as TimerSession[])
          : [];
        const sessions: TimerSession[] = rawSessions.map((s) => ({
          ...s,
          targetMinutesAtSession:
            typeof s.targetMinutesAtSession === 'number'
              ? s.targetMinutesAtSession
              : dailyTargetMinutes,
        }));

        return {
          id: String(h.id ?? ''),
          title: String(h.title ?? 'Привычка'),
          mode: h.mode === 'timer' ? 'timer' : 'check',
          targetDaysPerWeek,
          dailyTargetMinutes,
          growthTargetDays,
          createdAtMs: typeof h.createdAtMs === 'number' ? h.createdAtMs : 0,
          createdDateKey: String(h.createdDateKey ?? '2026-01-01'),
          seed: typeof h.seed === 'number' ? h.seed : 12345,
          checks: Array.isArray(h.checks) ? h.checks : [],
          sessions,
          rewardedDateKeys: Array.isArray(h.rewardedDateKeys) ? h.rewardedDateKeys : [],
        };
      }),
      activeTimer,
    };
  }

  return createDefaultStorageState();
}
