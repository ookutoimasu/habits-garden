import { endOfLocalDayMs, startOfLocalDayMs, toLocalDateKey } from './calendar';
import { ActiveTimerState, TimerInterval, TimerSession } from './types';

/**
 * Форматирует длительность таймера:
 * — до 1 часа: MM:SS
 * — от 1 часа и выше: HH:MM:SS
 */
export function formatTimerDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Возвращает полный список интервалов работы для активного таймера на момент nowMs.
 */
export function getEffectiveIntervals(
  activeTimer: ActiveTimerState,
  nowMs: number
): TimerInterval[] {
  const intervals = [...activeTimer.accumulatedIntervals];
  if (
    activeTimer.status === 'running' &&
    activeTimer.currentSegmentStartMs !== null &&
    nowMs > activeTimer.currentSegmentStartMs
  ) {
    intervals.push({
      startMs: activeTimer.currentSegmentStartMs,
      endMs: nowMs,
    });
  }
  return intervals;
}

/**
 * Вычисляет общую длительность активного таймера в миллисекундах на момент nowMs.
 */
export function getActiveTimerElapsedMs(activeTimer: ActiveTimerState, nowMs: number): number {
  const intervals = getEffectiveIntervals(activeTimer, nowMs);
  return intervals.reduce((acc, item) => acc + Math.max(0, item.endMs - item.startMs), 0);
}

export function startNewTimer(habitId: string, nowMs: number): ActiveTimerState {
  return {
    id: `timer_${habitId}_${nowMs}`,
    habitId,
    startedAtMs: nowMs,
    status: 'running',
    accumulatedIntervals: [],
    currentSegmentStartMs: nowMs,
  };
}

export function pauseActiveTimer(
  activeTimer: ActiveTimerState,
  nowMs: number
): ActiveTimerState {
  if (activeTimer.status === 'paused') {
    return activeTimer;
  }
  const nextIntervals = [...activeTimer.accumulatedIntervals];
  if (
    activeTimer.currentSegmentStartMs !== null &&
    nowMs > activeTimer.currentSegmentStartMs
  ) {
    nextIntervals.push({
      startMs: activeTimer.currentSegmentStartMs,
      endMs: nowMs,
    });
  }
  return {
    ...activeTimer,
    status: 'paused',
    accumulatedIntervals: nextIntervals,
    currentSegmentStartMs: null,
  };
}

export function resumeActiveTimer(
  activeTimer: ActiveTimerState,
  nowMs: number
): ActiveTimerState {
  if (activeTimer.status === 'running') {
    return activeTimer;
  }
  return {
    ...activeTimer,
    status: 'running',
    currentSegmentStartMs: nowMs,
  };
}

/**
 * Останавливает активный таймер и создаёт завершённую сессию TimerSession.
 * Если длительность меньше или равна 0, возвращает null.
 */
export function stopActiveTimer(
  activeTimer: ActiveTimerState,
  nowMs: number
): TimerSession | null {
  const intervals = getEffectiveIntervals(activeTimer, nowMs).filter(
    (iv) => iv.endMs > iv.startMs
  );
  const durationMs = intervals.reduce((sum, iv) => sum + (iv.endMs - iv.startMs), 0);
  if (durationMs <= 0 || intervals.length === 0) {
    return null;
  }
  const endedAtMs = intervals[intervals.length - 1].endMs;
  return {
    id: `session_${activeTimer.id}`,
    habitId: activeTimer.habitId,
    startedAtMs: activeTimer.startedAtMs,
    endedAtMs,
    durationMs,
    intervals,
  };
}

/**
 * Разбивает один интервал [startMs, endMs] по границам локальной полуночи,
 * чтобы сессия, перешедшая через полночь, корректно учитывалась в соответствующих локальных днях.
 */
export function splitIntervalByLocalMidnight(
  interval: TimerInterval
): Array<{ dateKey: string; startMs: number; endMs: number; durationMs: number }> {
  const result: Array<{ dateKey: string; startMs: number; endMs: number; durationMs: number }> = [];
  if (interval.endMs <= interval.startMs) {
    return result;
  }

  let cursorMs = interval.startMs;
  const finalEndMs = interval.endMs;

  while (cursorMs < finalEndMs) {
    const dateKey = toLocalDateKey(cursorMs);
    const dayEndMs = endOfLocalDayMs(dateKey);
    // Следующая полночь = начало следующего дня (dayEndMs + 1)
    const nextMidnightMs = dayEndMs + 1;
    const segmentEndMs = Math.min(finalEndMs, nextMidnightMs);
    const durationMs = Math.max(0, segmentEndMs - cursorMs);

    if (durationMs > 0) {
      result.push({
        dateKey,
        startMs: cursorMs,
        endMs: segmentEndMs,
        durationMs,
      });
    }

    cursorMs = segmentEndMs;
    if (segmentEndMs === dayEndMs) {
      cursorMs = dayEndMs + 1;
    }
  }

  return result;
}

export interface DailyTimerAggregate {
  dateKey: string;
  totalDurationMs: number;
  /** Точный момент времени (мс), когда сумма сессий за этот день впервые достигла дневной цели */
  goalReachedAtMs: number | null;
}

/**
 * Собирает все интервалы сессий (и опционально активного таймера) и распределяет их по локальным дням.
 * Вычисляет сумму за каждый день и точный момент достижения дневной цели `dailyTargetMs`.
 */
export function aggregateTimerByLocalDay(
  sessions: TimerSession[],
  dailyTargetMinutes: number,
  activeTimer?: ActiveTimerState | null,
  nowMs?: number
): Map<string, DailyTimerAggregate> {
  const dailyTargetMs = Math.max(1, dailyTargetMinutes) * 60_000;
  const allIntervals: TimerInterval[] = [];

  for (const session of sessions) {
    if (session.intervals && session.intervals.length > 0) {
      allIntervals.push(...session.intervals);
    } else if (session.endedAtMs > session.startedAtMs) {
      allIntervals.push({
        startMs: session.startedAtMs,
        endMs: session.endedAtMs,
      });
    }
  }

  if (activeTimer && typeof nowMs === 'number') {
    allIntervals.push(...getEffectiveIntervals(activeTimer, nowMs));
  }

  // Разбиваем все интервалы по локальным суткам и сортируем по времени начала
  const daySegments = new Map<string, Array<{ startMs: number; endMs: number; durationMs: number }>>();

  for (const interval of allIntervals) {
    const pieces = splitIntervalByLocalMidnight(interval);
    for (const piece of pieces) {
      const list = daySegments.get(piece.dateKey) ?? [];
      list.push({
        startMs: piece.startMs,
        endMs: piece.endMs,
        durationMs: piece.durationMs,
      });
      daySegments.set(piece.dateKey, list);
    }
  }

  const aggregates = new Map<string, DailyTimerAggregate>();

  for (const [dateKey, segments] of daySegments.entries()) {
    segments.sort((a, b) => a.startMs - b.startMs);
    let totalDurationMs = 0;
    let goalReachedAtMs: number | null = null;

    for (const seg of segments) {
      const prevTotal = totalDurationMs;
      totalDurationMs += seg.durationMs;
      if (goalReachedAtMs === null && totalDurationMs >= dailyTargetMs) {
        const neededMs = dailyTargetMs - prevTotal;
        goalReachedAtMs = Math.min(seg.endMs, seg.startMs + Math.max(0, neededMs));
      }
    }

    aggregates.set(dateKey, {
      dateKey,
      totalDurationMs,
      goalReachedAtMs,
    });
  }

  return aggregates;
}

/**
 * Вспомогательная проверка принадлежности timestamp к конкретному локальному дню.
 */
export function isTimestampInDateKey(timestampMs: number, dateKey: string): boolean {
  return (
    timestampMs >= startOfLocalDayMs(dateKey) &&
    timestampMs <= endOfLocalDayMs(dateKey)
  );
}
