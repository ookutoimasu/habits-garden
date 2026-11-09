import {
  addDaysToDateKey,
  diffCalendarDays,
  endOfLocalDayMs,
  getPeriodBoundsForDateKey,
  startOfLocalDayMs,
  toLocalDateKey,
} from './calendar';
import { aggregateTimerByLocalDay } from './timer';
import {
  ActiveTimerState,
  DayStatus,
  Habit,
  PeriodInfo,
  TimerSession,
  TrackingMode,
} from './types';

/**
 * Детерминированная генерация seed из строки и времени создания.
 */
export function createSeedFromInput(title: string, createdAtMs: number): number {
  let hash = 2166136261 ^ (createdAtMs & 0xffffffff);
  for (let i = 0; i < title.length; i++) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) || 133742;
}

export interface CreateHabitParams {
  id?: string;
  title: string;
  mode: TrackingMode;
  targetDaysPerWeek: number;
  dailyTargetMinutes?: number;
  createdAtMs: number;
  seed?: number;
}

export function createHabit(params: CreateHabitParams): Habit {
  const cleanTitle = params.title.trim();
  const targetDays = Math.min(7, Math.max(1, Math.round(params.targetDaysPerWeek)));
  const dailyMinutes =
    params.mode === 'timer'
      ? Math.max(1, Math.round(params.dailyTargetMinutes ?? 20))
      : 15;
  const createdDateKey = toLocalDateKey(params.createdAtMs);
  const id = params.id ?? `habit_${params.createdAtMs}_${Math.floor(Math.random() * 100000)}`;
  const seed = params.seed ?? createSeedFromInput(cleanTitle, params.createdAtMs);

  return {
    id,
    title: cleanTitle,
    mode: params.mode,
    targetDaysPerWeek: targetDays,
    dailyTargetMinutes: dailyMinutes,
    growthTargetDays: targetDays,
    createdAtMs: params.createdAtMs,
    createdDateKey,
    seed,
    checks: [],
    sessions: [],
    rewardedDateKeys: [],
  };
}

/**
 * Чистая функция обновления настроек привычки (название, целевое число дней в неделю, целевые минуты).
 * Не меняет накопленный рост (`growthTargetDays`) и фиксирует прежнюю норму минут на уже записанных сессиях,
 * чтобы изменение настроек цели никогда не пересчитывало прошлое и не меняло состояние дерева.
 */
export function applyHabitSettingsUpdate(
  habit: Habit,
  params: {
    title?: string;
    targetDaysPerWeek?: number;
    dailyTargetMinutes?: number;
  }
): Habit {
  const nextTitle =
    params.title !== undefined ? params.title.trim() || habit.title : habit.title;
  const nextTargetDays =
    params.targetDaysPerWeek !== undefined
      ? Math.min(7, Math.max(1, Math.round(params.targetDaysPerWeek)))
      : habit.targetDaysPerWeek;
  const nextDailyMinutes =
    params.dailyTargetMinutes !== undefined
      ? Math.max(1, Math.round(params.dailyTargetMinutes))
      : habit.dailyTargetMinutes;

  const preservedGrowthTargetDays = habit.growthTargetDays ?? habit.targetDaysPerWeek;
  const preservedSessions = habit.sessions.map((s) =>
    s.targetMinutesAtSession !== undefined
      ? s
      : { ...s, targetMinutesAtSession: habit.dailyTargetMinutes }
  );

  return {
    ...habit,
    title: nextTitle,
    targetDaysPerWeek: nextTargetDays,
    dailyTargetMinutes: nextDailyMinutes,
    growthTargetDays: preservedGrowthTargetDays,
    sessions: preservedSessions,
  };
}

/**
 * Возвращает карту выполненных дней (dateKey -> completedAtMs) для привычки.
 */
export function getCompletedDaysMap(
  habit: Habit,
  activeTimer?: ActiveTimerState | null,
  nowMs?: number
): Map<string, number> {
  const completedMap = new Map<string, number>();

  if (habit.mode === 'check') {
    for (const check of habit.checks) {
      if (typeof nowMs === 'number' && check.completedAtMs > nowMs) {
        continue;
      }
      const existing = completedMap.get(check.dateKey);
      if (existing === undefined || check.completedAtMs < existing) {
        completedMap.set(check.dateKey, check.completedAtMs);
      }
    }
  } else {
    const relevantTimer =
      activeTimer && activeTimer.habitId === habit.id ? activeTimer : null;
    const filteredSessions =
      typeof nowMs === 'number'
        ? habit.sessions.filter((s) => s.startedAtMs <= nowMs)
        : habit.sessions;
    const aggregates = aggregateTimerByLocalDay(
      filteredSessions,
      habit.dailyTargetMinutes,
      relevantTimer,
      nowMs
    );
    for (const [dateKey, agg] of aggregates.entries()) {
      if (agg.goalReachedAtMs !== null) {
        if (typeof nowMs !== 'number' || agg.goalReachedAtMs <= nowMs) {
          completedMap.set(dateKey, agg.goalReachedAtMs);
        }
      }
    }
  }

  return completedMap;
}

/**
 * Отмечает выполнение за день `dateKey` (режим 'check').
 * Повторное нажатие не добавляет второе выполнение.
 * Возвращает обновлённую привычку и флаг `shouldTriggerParticles`, который истинен
 * ТОЛЬКО если за этот день награда (золотые частицы) ещё не показывалась.
 */
export function checkInHabitForDay(
  habit: Habit,
  dateKey: string,
  nowMs: number
): { habit: Habit; shouldTriggerParticles: boolean; didChange: boolean } {
  if (habit.mode !== 'check') {
    return { habit, shouldTriggerParticles: false, didChange: false };
  }

  const alreadyChecked = habit.checks.some((c) => c.dateKey === dateKey);
  if (alreadyChecked) {
    return { habit, shouldTriggerParticles: false, didChange: false };
  }

  const wasAlreadyRewarded = habit.rewardedDateKeys.includes(dateKey);
  const nextRewarded = wasAlreadyRewarded
    ? habit.rewardedDateKeys
    : [...habit.rewardedDateKeys, dateKey];

  const updatedHabit: Habit = {
    ...habit,
    checks: [...habit.checks, { dateKey, completedAtMs: nowMs }],
    rewardedDateKeys: nextRewarded,
  };

  return {
    habit: updatedHabit,
    shouldTriggerParticles: !wasAlreadyRewarded,
    didChange: true,
  };
}

/**
 * Отменяет ошибочную отметку за указанный день `dateKey`.
 * Обратите внимание: `rewardedDateKeys` сохраняется, чтобы отмена с повторной отметкой
 * не воспроизводила золотые частицы бесконечно.
 */
export function undoCheckInHabitForDay(
  habit: Habit,
  dateKey: string
): { habit: Habit; didChange: boolean } {
  if (habit.mode !== 'check') {
    return { habit, didChange: false };
  }

  const exists = habit.checks.some((c) => c.dateKey === dateKey);
  if (!exists) {
    return { habit, didChange: false };
  }

  return {
    habit: {
      ...habit,
      checks: habit.checks.filter((c) => c.dateKey !== dateKey),
    },
    didChange: true,
  };
}

/**
 * Сохраняет завершённую сессию таймера в привычку (с защитой от дублирования по id).
 * Проверяет, была ли впервые достигнута дневная цель в какой-либо из затронутых дней,
 * и возвращает `shouldTriggerParticles`.
 */
export function recordTimerSession(
  habit: Habit,
  session: TimerSession,
  nowMs: number
): { habit: Habit; shouldTriggerParticles: boolean; didChange: boolean } {
  if (habit.sessions.some((s) => s.id === session.id)) {
    return { habit, shouldTriggerParticles: false, didChange: false };
  }

  const sessionWithTarget: TimerSession = {
    ...session,
    targetMinutesAtSession: session.targetMinutesAtSession ?? habit.dailyTargetMinutes,
  };

  const nextSessions = [...habit.sessions, sessionWithTarget];
  const aggregates = aggregateTimerByLocalDay(
    nextSessions,
    habit.dailyTargetMinutes,
    null,
    nowMs
  );

  let shouldTriggerParticles = false;
  const nextRewarded = [...habit.rewardedDateKeys];

  for (const [dateKey, agg] of aggregates.entries()) {
    if (agg.goalReachedAtMs !== null && !nextRewarded.includes(dateKey)) {
      shouldTriggerParticles = true;
      nextRewarded.push(dateKey);
    }
  }

  return {
    habit: {
      ...habit,
      sessions: nextSessions,
      rewardedDateKeys: nextRewarded,
    },
    shouldTriggerParticles,
    didChange: true,
  };
}

/**
 * Проверяет, нужно ли выпустить золотые частицы прямо во время тика активного таймера,
 * когда сумма за день впервые перешагнула дневную цель.
 */
export function checkActiveTimerReward(
  habit: Habit,
  activeTimer: ActiveTimerState | null,
  nowMs: number
): { habit: Habit; shouldTriggerParticles: boolean } {
  if (!activeTimer || activeTimer.habitId !== habit.id || habit.mode !== 'timer') {
    return { habit, shouldTriggerParticles: false };
  }

  const aggregates = aggregateTimerByLocalDay(
    habit.sessions,
    habit.dailyTargetMinutes,
    activeTimer,
    nowMs
  );

  let shouldTriggerParticles = false;
  const nextRewarded = [...habit.rewardedDateKeys];

  for (const [dateKey, agg] of aggregates.entries()) {
    if (agg.goalReachedAtMs !== null && !nextRewarded.includes(dateKey)) {
      shouldTriggerParticles = true;
      nextRewarded.push(dateKey);
    }
  }

  if (!shouldTriggerParticles) {
    return { habit, shouldTriggerParticles: false };
  }

  return {
    habit: {
      ...habit,
      rewardedDateKeys: nextRewarded,
    },
    shouldTriggerParticles: true,
  };
}

/**
 * Возвращает информацию о 7-дневном периоде для указанного дня `targetDateKey`.
 */
export function getPeriodInfo(
  habit: Habit,
  targetDateKey: string,
  nowMs: number,
  activeTimer?: ActiveTimerState | null
): PeriodInfo {
  const bounds = getPeriodBoundsForDateKey(habit.createdDateKey, targetDateKey);
  const completedMap = getCompletedDaysMap(habit, activeTimer, nowMs);

  let completedDaysCount = 0;
  for (let i = 0; i < 7; i++) {
    const dKey = addDaysToDateKey(bounds.startDateKey, i);
    if (completedMap.has(dKey)) {
      completedDaysCount++;
    }
  }

  const todayDateKey = toLocalDateKey(nowMs);
  const isTodayCompleted = completedMap.has(todayDateKey);
  let remainingPossibleDays = 0;
  for (let i = 0; i < 7; i++) {
    const dKey = addDaysToDateKey(bounds.startDateKey, i);
    const diffFromToday = diffCalendarDays(todayDateKey, dKey);
    if (diffFromToday > 0) {
      remainingPossibleDays++;
    } else if (diffFromToday === 0 && !isTodayCompleted) {
      remainingPossibleDays++;
    }
  }

  return {
    periodIndex: bounds.periodIndex,
    startDateKey: bounds.startDateKey,
    endDateKey: bounds.endDateKey,
    startMs: bounds.startMs,
    endMs: bounds.endMs,
    completedDaysCount,
    targetDays: habit.targetDaysPerWeek,
    isGoalMet: completedDaysCount >= habit.targetDaysPerWeek,
    dayOfPeriod: bounds.dayOfPeriod,
    remainingPossibleDays,
  };
}

/**
 * Возвращает подробный статус за конкретный локальный день `dateKey`.
 */
export function getDayStatus(
  habit: Habit,
  dateKey: string,
  nowMs: number,
  activeTimer?: ActiveTimerState | null
): DayStatus {
  const todayDateKey = toLocalDateKey(nowMs);
  const completedMap = getCompletedDaysMap(habit, activeTimer, nowMs);
  const completedAtMs = completedMap.get(dateKey) ?? null;

  let totalTimerSeconds = 0;
  if (habit.mode === 'timer') {
    const relevantTimer =
      activeTimer && activeTimer.habitId === habit.id ? activeTimer : null;
    const aggregates = aggregateTimerByLocalDay(
      habit.sessions,
      habit.dailyTargetMinutes,
      relevantTimer,
      nowMs
    );
    const agg = aggregates.get(dateKey);
    totalTimerSeconds = agg ? Math.floor(agg.totalDurationMs / 1000) : 0;
  }

  return {
    dateKey,
    timestampStartMs: startOfLocalDayMs(dateKey),
    timestampEndMs: endOfLocalDayMs(dateKey),
    isCompleted: completedAtMs !== null,
    completedAtMs,
    totalTimerSeconds,
    targetTimerSeconds: habit.dailyTargetMinutes * 60,
    isToday: dateKey === todayDateKey,
    isFuture: diffCalendarDays(todayDateKey, dateKey) > 0,
  };
}

/**
 * Возвращает компактную историю последних 7 дней (от 6 дней назад до сегодня включительно).
 */
export function getLastSevenDaysHistory(
  habit: Habit,
  nowMs: number,
  activeTimer?: ActiveTimerState | null
): DayStatus[] {
  const todayDateKey = toLocalDateKey(nowMs);
  const result: DayStatus[] = [];

  for (let offset = -6; offset <= 0; offset++) {
    const dKey = addDaysToDateKey(todayDateKey, offset);
    result.push(getDayStatus(habit, dKey, nowMs, activeTimer));
  }

  return result;
}
