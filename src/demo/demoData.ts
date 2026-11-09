import { addDaysToDateKey, startOfLocalDayMs, toLocalDateKey } from '../domain/calendar';
import { CheckRecord, Habit, TimerSession } from '../domain/types';

/**
 * Генерирует изолированный демонстрационный набор привычек относительно переданного `nowMs`.
 * Демонстрационные записи показывают разные стадии развития дерева, короткие и длинные названия
 * и разные способы учёта:
 * 1. Зрелое дерево в земле (Утреннее чтение книги, отметка, 5 дней в неделю, ~19 недель)
 * 2. Крупное дерево в кадке (Глубокая сфокусированная работа без телефона и уведомлений, таймер 25 мин, 4 дня в неделю, ~11 недель)
 * 3. Молодое дерево (Практика набросков от руки, таймер 15 мин, 3 дня в неделю, ~5 недель)
 * 4. Росток в маленьком горшке (Вечерняя разминка спины, отметка, 4 дня в неделю, создана 4 дня назад)
 * 5. Восстанавливающееся дерево (Чтение художественной литературы на иностранном языке, отметка, 3 дня в неделю)
 */
export function buildDemoHabits(nowMs: number): Habit[] {
  const todayKey = toLocalDateKey(nowMs);

  const generateCheckHistory = (
    startDateKey: string,
    totalWeeks: number,
    activeDayOffsetsInWeek: number[],
    skipWeeks: Set<number> = new Set()
  ): CheckRecord[] => {
    const checks: CheckRecord[] = [];
    const yesterdayEndMs = startOfLocalDayMs(todayKey) - 1;
    for (let w = 0; w < totalWeeks; w++) {
      if (skipWeeks.has(w)) continue;
      for (const dOffset of activeDayOffsetsInWeek) {
        const totalOffset = w * 7 + dOffset;
        const dKey = addDaysToDateKey(startDateKey, totalOffset);
        const completedAtMs = startOfLocalDayMs(dKey) + 10 * 3_600_000;
        if (completedAtMs <= yesterdayEndMs) {
          checks.push({ dateKey: dKey, completedAtMs });
        }
      }
    }
    return checks;
  };

  const generateTimerHistory = (
    habitId: string,
    startDateKey: string,
    totalWeeks: number,
    activeDayOffsetsInWeek: number[],
    minutesPerSession: number
  ): TimerSession[] => {
    const sessions: TimerSession[] = [];
    const durationMs = minutesPerSession * 60_000;
    const yesterdayEndMs = startOfLocalDayMs(todayKey) - 1;
    for (let w = 0; w < totalWeeks; w++) {
      for (const dOffset of activeDayOffsetsInWeek) {
        const totalOffset = w * 7 + dOffset;
        const dKey = addDaysToDateKey(startDateKey, totalOffset);
        const startedAtMs = startOfLocalDayMs(dKey) + 11 * 3_600_000;
        const endedAtMs = startedAtMs + durationMs;
        if (endedAtMs <= yesterdayEndMs) {
          sessions.push({
            id: `demo_sess_${habitId}_${dKey}`,
            habitId,
            startedAtMs,
            endedAtMs,
            durationMs,
            intervals: [{ startMs: startedAtMs, endMs: endedAtMs }],
            targetMinutesAtSession: minutesPerSession,
          });
        }
      }
    }
    return sessions;
  };

  // 1. Зрелое дерево в земле (19 недель назад)
  const matureStartKey = addDaysToDateKey(todayKey, -19 * 7 + 3);
  const matureStartMs = startOfLocalDayMs(matureStartKey) + 9 * 3_600_000;
  const matureChecks = generateCheckHistory(matureStartKey, 19, [0, 1, 2, 3, 5]);

  // 2. Крупное дерево в кадке (11 недель назад, таймер, длинное название для демонстрации прокрутки)
  const largeStartKey = addDaysToDateKey(todayKey, -11 * 7 + 2);
  const largeStartMs = startOfLocalDayMs(largeStartKey) + 9 * 3_600_000;
  const largeSessions = generateTimerHistory(
    'demo_habit_large',
    largeStartKey,
    11,
    [0, 1, 3, 5],
    25
  );

  // 3. Молодое дерево (5 недель назад, таймер)
  const youngStartKey = addDaysToDateKey(todayKey, -5 * 7 + 1);
  const youngStartMs = startOfLocalDayMs(youngStartKey) + 9 * 3_600_000;
  const youngSessions = generateTimerHistory(
    'demo_habit_young',
    youngStartKey,
    5,
    [0, 2, 4],
    15
  );

  // 4. Молодой росток (создан 4 дня назад)
  const sproutStartKey = addDaysToDateKey(todayKey, -4);
  const sproutStartMs = startOfLocalDayMs(sproutStartKey) + 9 * 3_600_000;
  const sproutChecks = generateCheckHistory(sproutStartKey, 1, [0, 2]);

  // 5. Восстанавливающееся после увядания дерево (10 недель назад)
  const recoveringStartKey = addDaysToDateKey(todayKey, -10 * 7 + 4);
  const recoveringStartMs = startOfLocalDayMs(recoveringStartKey) + 9 * 3_600_000;
  const recoveringChecks = generateCheckHistory(
    recoveringStartKey,
    10,
    [0, 1, 3],
    new Set([6, 7, 8])
  );

  return [
    {
      id: 'demo_habit_mature',
      title: 'Утреннее чтение книги',
      mode: 'check',
      targetDaysPerWeek: 5,
      dailyTargetMinutes: 20,
      growthTargetDays: 5,
      createdAtMs: matureStartMs,
      createdDateKey: matureStartKey,
      seed: 4829104,
      checks: matureChecks,
      sessions: [],
      rewardedDateKeys: matureChecks.map((c) => c.dateKey),
    },
    {
      id: 'demo_habit_large',
      title: 'Глубокая сфокусированная работа без телефона и уведомлений',
      mode: 'timer',
      targetDaysPerWeek: 4,
      dailyTargetMinutes: 25,
      growthTargetDays: 4,
      createdAtMs: largeStartMs,
      createdDateKey: largeStartKey,
      seed: 9174628,
      checks: [],
      sessions: largeSessions,
      rewardedDateKeys: [],
    },
    {
      id: 'demo_habit_young',
      title: 'Практика набросков от руки',
      mode: 'timer',
      targetDaysPerWeek: 3,
      dailyTargetMinutes: 15,
      growthTargetDays: 3,
      createdAtMs: youngStartMs,
      createdDateKey: youngStartKey,
      seed: 3391027,
      checks: [],
      sessions: youngSessions,
      rewardedDateKeys: [],
    },
    {
      id: 'demo_habit_sprout',
      title: 'Вечерняя разминка спины',
      mode: 'check',
      targetDaysPerWeek: 4,
      dailyTargetMinutes: 15,
      growthTargetDays: 4,
      createdAtMs: sproutStartMs,
      createdDateKey: sproutStartKey,
      seed: 7519283,
      checks: sproutChecks,
      sessions: [],
      rewardedDateKeys: sproutChecks.map((c) => c.dateKey),
    },
    {
      id: 'demo_habit_recovering',
      title: 'Чтение художественной литературы на иностранном языке',
      mode: 'check',
      targetDaysPerWeek: 3,
      dailyTargetMinutes: 15,
      growthTargetDays: 3,
      createdAtMs: recoveringStartMs,
      createdDateKey: recoveringStartKey,
      seed: 6182945,
      checks: recoveringChecks,
      sessions: [],
      rewardedDateKeys: recoveringChecks.map((c) => c.dateKey),
    },
  ];
}
