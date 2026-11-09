import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDaysToDateKey,
  endOfLocalDayMs,
  startOfLocalDayMs,
  toLocalDateKey,
} from '../domain/calendar';
import {
  applyHabitSettingsUpdate,
  checkInHabitForDay,
  createHabit,
  getDayStatus,
  getPeriodInfo,
  recordTimerSession,
  undoCheckInHabitForDay,
} from '../domain/habits';
import {
  aggregateTimerByLocalDay,
  formatTimerDuration,
  getActiveTimerElapsedMs,
  pauseActiveTimer,
  resumeActiveTimer,
  splitIntervalByLocalMidnight,
  startNewTimer,
  stopActiveTimer,
} from '../domain/timer';
import { calculateTreeState } from '../domain/treeModel';
import { generateTreeGeometry } from '../features/tree/treeGeometry';
import { migrateStorageData } from '../storage/migrations';
import { cloneStorageState } from '../storage/repository';

test('1. Сохранение и миграция состояния после перезагрузки (включая активный таймер и seed)', () => {
  const startMs = new Date(2026, 4, 10, 9, 0, 0).getTime();
  const habit = createHabit({
    title: 'Чтение',
    mode: 'timer',
    targetDaysPerWeek: 4,
    dailyTargetMinutes: 20,
    createdAtMs: startMs,
    seed: 777111,
  });

  const activeTimer = startNewTimer(habit.id, startMs + 60_000);
  const pausedTimer = pauseActiveTimer(activeTimer, startMs + 360_000); // 5 минут работы

  const rawStorage = JSON.parse(
    JSON.stringify({
      version: 1,
      hasChosenGardenMode: true,
      gardenMode: 'personal',
      habits: [habit],
      activeTimer: pausedTimer,
    })
  );

  const restored = migrateStorageData(rawStorage);
  assert.equal(restored.version, 1);
  assert.equal(restored.habits.length, 1);
  assert.equal(restored.habits[0].seed, 777111);
  assert.ok(restored.activeTimer);
  assert.equal(restored.activeTimer?.status, 'paused');
  assert.equal(getActiveTimerElapsedMs(restored.activeTimer!, startMs + 900_000), 300_000);
});

test('2. Пауза, продолжение и остановка таймера по временным меткам + форматирование MM:SS и HH:MM:SS', () => {
  assert.equal(formatTimerDuration(65_000), '01:05');
  assert.equal(formatTimerDuration(3_661_000), '01:01:01');

  const t0 = new Date(2026, 4, 10, 10, 0, 0).getTime();
  let timer = startNewTimer('h1', t0);
  timer = pauseActiveTimer(timer, t0 + 10 * 60_000);
  assert.equal(getActiveTimerElapsedMs(timer, t0 + 25 * 60_000), 10 * 60_000);

  timer = resumeActiveTimer(timer, t0 + 25 * 60_000);
  const session = stopActiveTimer(timer, t0 + 30 * 60_000);
  assert.ok(session);
  assert.equal(session.durationMs, 15 * 60_000);
  assert.equal(session.intervals.length, 2);
});

test('3. Сумма нескольких коротких сессий за день засчитывает выполнение при достижении дневной цели', () => {
  const dayStart = new Date(2026, 4, 10, 8, 0, 0).getTime();
  let habit = createHabit({
    title: 'Практика',
    mode: 'timer',
    targetDaysPerWeek: 3,
    dailyTargetMinutes: 20,
    createdAtMs: dayStart,
  });
  const dateKey = toLocalDateKey(dayStart);

  const t1 = startNewTimer(habit.id, dayStart + 60_000);
  const s1 = stopActiveTimer(t1, dayStart + 9 * 60_000)!;
  const r1 = recordTimerSession(habit, s1, dayStart + 9 * 60_000);
  habit = r1.habit;
  assert.equal(r1.shouldTriggerParticles, false);
  assert.equal(getDayStatus(habit, dateKey, dayStart + 10 * 60_000).isCompleted, false);

  const t2 = startNewTimer(habit.id, dayStart + 20 * 60_000);
  const s2 = stopActiveTimer(t2, dayStart + 27 * 60_000)!;
  const r2 = recordTimerSession(habit, s2, dayStart + 27 * 60_000);
  habit = r2.habit;
  assert.equal(r2.shouldTriggerParticles, false);
  assert.equal(getDayStatus(habit, dateKey, dayStart + 28 * 60_000).isCompleted, false);

  const t3 = startNewTimer(habit.id, dayStart + 40 * 60_000);
  const s3 = stopActiveTimer(t3, dayStart + 46 * 60_000)!;
  const r3 = recordTimerSession(habit, s3, dayStart + 46 * 60_000);
  habit = r3.habit;
  assert.equal(r3.shouldTriggerParticles, true);
  assert.equal(getDayStatus(habit, dateKey, dayStart + 46 * 60_000).isCompleted, true);

  const dup = recordTimerSession(habit, s3, dayStart + 47 * 60_000);
  assert.equal(dup.didChange, false);
  assert.equal(dup.shouldTriggerParticles, false);
});

test('4. Переход таймера через локальную полночь корректно распределяет время по двум дням', () => {
  const day1Key = '2026-05-10';
  const day2Key = '2026-05-11';
  const day1End = endOfLocalDayMs(day1Key);
  const startMs = day1End - 10 * 60_000 + 1;
  const endMs = day1End + 1 + 15 * 60_000;

  const pieces = splitIntervalByLocalMidnight({ startMs, endMs });
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].dateKey, day1Key);
  assert.equal(Math.round(pieces[0].durationMs / 60_000), 10);
  assert.equal(pieces[1].dateKey, day2Key);
  assert.equal(Math.round(pieces[1].durationMs / 60_000), 15);

  const aggregates = aggregateTimerByLocalDay(
    [
      {
        id: 'midnight_sess',
        habitId: 'h1',
        startedAtMs: startMs,
        endedAtMs: endMs,
        durationMs: endMs - startMs,
        intervals: [{ startMs, endMs }],
      },
    ],
    12
  );
  assert.equal(aggregates.get(day1Key)?.goalReachedAtMs, null);
  assert.ok(aggregates.get(day2Key)?.goalReachedAtMs !== null);
});

test('5. Отсутствие двойного выполнения и отсутствие бесконечного повтора золотых частиц после отмены', () => {
  const nowMs = new Date(2026, 4, 10, 12, 0, 0).getTime();
  const todayKey = toLocalDateKey(nowMs);
  let habit = createHabit({
    title: 'Зарядка',
    mode: 'check',
    targetDaysPerWeek: 5,
    createdAtMs: nowMs - 3_600_000,
  });

  const first = checkInHabitForDay(habit, todayKey, nowMs);
  habit = first.habit;
  assert.equal(first.didChange, true);
  assert.equal(first.shouldTriggerParticles, true);
  assert.equal(habit.checks.length, 1);

  const second = checkInHabitForDay(habit, todayKey, nowMs + 5000);
  assert.equal(second.didChange, false);
  assert.equal(second.shouldTriggerParticles, false);
  assert.equal(second.habit.checks.length, 1);

  const undone = undoCheckInHabitForDay(habit, todayKey);
  habit = undone.habit;
  assert.equal(habit.checks.length, 0);

  const rechecked = checkInHabitForDay(habit, todayKey, nowMs + 10_000);
  assert.equal(rechecked.didChange, true);
  assert.equal(rechecked.shouldTriggerParticles, false);
});

test('6. Отсутствие скачка дерева сразу после отметки (непрерывность состояния в момент выполнения)', () => {
  const createdMs = new Date(2026, 4, 1, 9, 0, 0).getTime();
  const habitBefore = createHabit({
    title: 'Йога',
    mode: 'check',
    targetDaysPerWeek: 4,
    createdAtMs: createdMs,
  });

  const checkMomentMs = createdMs + 6 * 3_600_000;
  const checkDateKey = toLocalDateKey(checkMomentMs);

  const stateBeforeCheck = calculateTreeState(habitBefore, checkMomentMs);
  const { habit: habitAfter } = checkInHabitForDay(habitBefore, checkDateKey, checkMomentMs);
  const stateImmediatelyAfterCheck = calculateTreeState(habitAfter, checkMomentMs);

  assert.equal(
    stateImmediatelyAfterCheck.development.toFixed(6),
    stateBeforeCheck.development.toFixed(6)
  );
  assert.equal(
    stateImmediatelyAfterCheck.vitality.toFixed(6),
    stateBeforeCheck.vitality.toFixed(6)
  );
  assert.equal(
    stateImmediatelyAfterCheck.canopyRecovery.toFixed(6),
    stateBeforeCheck.canopyRecovery.toFixed(6)
  );

  const stateNextDay = calculateTreeState(habitAfter, checkMomentMs + 24 * 3_600_000);
  assert.ok(stateNextDay.development > stateBeforeCheck.development);
});

test('7. Отсутствие преждевременных штрафов внутри периода и равенство планов 3 из 3 и 7 из 7', () => {
  const startDayKey = '2026-05-01';
  const createdMs = startOfLocalDayMs(startDayKey) + 8 * 3_600_000;

  let habit3 = createHabit({
    title: 'План 3 из 7',
    mode: 'check',
    targetDaysPerWeek: 3,
    createdAtMs: createdMs,
  });

  const day4Ms = createdMs + 4 * 86_400_000;
  const stateAtCreation = calculateTreeState(habit3, createdMs);
  const stateAtDay4 = calculateTreeState(habit3, day4Ms);

  assert.equal(stateAtDay4.vitality, stateAtCreation.vitality);
  assert.equal(stateAtDay4.canopyRecovery, stateAtCreation.canopyRecovery);

  const periodAtDay4 = getPeriodInfo(habit3, toLocalDateKey(day4Ms), day4Ms);
  assert.equal(periodAtDay4.remainingPossibleDays >= 3, true);

  let habit7 = createHabit({
    title: 'План 7 из 7',
    mode: 'check',
    targetDaysPerWeek: 7,
    createdAtMs: createdMs,
  });

  for (let d = 0; d < 14; d++) {
    const dKey = addDaysToDateKey(startDayKey, d);
    const evMs = startOfLocalDayMs(dKey) + 10 * 3_600_000;
    habit7 = checkInHabitForDay(habit7, dKey, evMs).habit;
    if (d % 7 === 0 || d % 7 === 2 || d % 7 === 4) {
      habit3 = checkInHabitForDay(habit3, dKey, evMs).habit;
    }
  }

  const evalMs = createdMs + 15 * 86_400_000;
  const state3Full = calculateTreeState(habit3, evalMs);
  const state7Full = calculateTreeState(habit7, evalMs);

  assert.ok(Math.abs(state3Full.development - state7Full.development) < 0.35);
});

test('8. Постепенное увядание до голого ствола за 14–21 день и полное восстановление за ~3 недели без блокировки старыми пропусками', () => {
  const startDayKey = '2026-05-01';
  const createdMs = startOfLocalDayMs(startDayKey) + 9 * 3_600_000;
  let habit = createHabit({
    title: 'Рисование',
    mode: 'check',
    targetDaysPerWeek: 4,
    createdAtMs: createdMs,
  });

  const neglectedMs = createdMs + 19 * 86_400_000;
  const wiltedState = calculateTreeState(habit, neglectedMs);
  assert.equal(wiltedState.vitality, 0);
  assert.equal(wiltedState.canopyRecovery, 0);
  assert.ok(wiltedState.development >= 4.0);

  const recoveryStartDayIdx = 21;
  for (let w = 0; w < 3; w++) {
    for (const offset of [0, 2, 4, 5]) {
      const dayIdx = recoveryStartDayIdx + w * 7 + offset;
      const dKey = addDaysToDateKey(startDayKey, dayIdx);
      const evMs = startOfLocalDayMs(dKey) + 11 * 3_600_000;
      habit = checkInHabitForDay(habit, dKey, evMs).habit;
    }
  }

  const midRecoveryMs = startOfLocalDayMs(addDaysToDateKey(startDayKey, recoveryStartDayIdx + 7));
  const midState = calculateTreeState(habit, midRecoveryMs);
  assert.ok(midState.canopyRecovery > 0.25 && midState.canopyRecovery < 0.75);
  assert.ok(midState.budFactor > 0.4);

  const fullRecoveryMs = startOfLocalDayMs(addDaysToDateKey(startDayKey, recoveryStartDayIdx + 21));
  const recoveredState = calculateTreeState(habit, fullRecoveryMs);
  assert.ok(recoveredState.vitality >= 0.95);
  assert.ok(recoveredState.canopyRecovery >= 0.95);
});

test('9. Изоляция копии симуляции и постоянство геометрии ветвей от seed', () => {
  const createdMs = new Date(2026, 4, 1, 9, 0, 0).getTime();
  const habit = createHabit({
    title: 'Медитация',
    mode: 'check',
    targetDaysPerWeek: 5,
    createdAtMs: createdMs,
    seed: 987654,
  });

  const treeState = calculateTreeState(habit, createdMs + 86_400_000);
  const geom1 = generateTreeGeometry(habit.seed, treeState);
  const geom2 = generateTreeGeometry(habit.seed, treeState);
  assert.deepEqual(geom1.branches, geom2.branches);

  const originalStorage = {
    version: 1 as const,
    hasChosenGardenMode: true,
    gardenMode: 'personal' as const,
    habits: [habit],
    activeTimer: null,
  };
  const simClone = cloneStorageState(originalStorage);
  simClone.habits[0].title = 'Изменено в симуляции';
  simClone.habits[0].checks.push({ dateKey: '2026-05-02', completedAtMs: createdMs + 86_400_000 });

  assert.equal(originalStorage.habits[0].title, 'Медитация');
  assert.equal(originalStorage.habits[0].checks.length, 0);
});

test('10. Смена цели 3 → 7 и 7 → 3 у выросшего дерева не пересчитывает прошлое и сохраняет рост, стадию и внешний вид', () => {
  const startDayKey = '2026-04-01';
  const createdMs = startOfLocalDayMs(startDayKey) + 9 * 3_600_000;
  let habit = createHabit({
    title: 'Скетчинг',
    mode: 'check',
    targetDaysPerWeek: 3,
    createdAtMs: createdMs,
    seed: 3391027,
  });

  // Выращиваем молодое дерево за 5 недель выполнения плана 3 дня в неделю
  for (let w = 0; w < 5; w++) {
    for (const dOffset of [0, 2, 4]) {
      const dKey = addDaysToDateKey(startDayKey, w * 7 + dOffset);
      const evMs = startOfLocalDayMs(dKey) + 10 * 3_600_000;
      habit = checkInHabitForDay(habit, dKey, evMs).habit;
    }
  }

  const checkTimeMs = createdMs + 35 * 86_400_000;
  const stateBefore = calculateTreeState(habit, checkTimeMs);
  assert.equal(stateBefore.stage, 'young');
  const geomBefore = generateTreeGeometry(habit.seed, stateBefore);

  // Переключаем цель с 3 на 7 занятий в неделю
  const habitGoal7 = applyHabitSettingsUpdate(habit, { targetDaysPerWeek: 7 });
  assert.equal(habitGoal7.targetDaysPerWeek, 7);
  const stateGoal7 = calculateTreeState(habitGoal7, checkTimeMs);

  assert.equal(stateGoal7.development, stateBefore.development);
  assert.equal(stateGoal7.vitality, stateBefore.vitality);
  assert.equal(stateGoal7.canopyRecovery, stateBefore.canopyRecovery);
  assert.equal(stateGoal7.stage, 'young');
  assert.deepEqual(generateTreeGeometry(habitGoal7.seed, stateGoal7).branches, geomBefore.branches);

  // Сохраняем и перезагружаем через миграцию хранилища
  const reloadedStorage = migrateStorageData(
    JSON.parse(
      JSON.stringify({
        version: 1,
        hasChosenGardenMode: true,
        gardenMode: 'personal',
        habits: [habitGoal7],
        activeTimer: null,
      })
    )
  );
  const reloadedHabit = reloadedStorage.habits[0];
  const stateAfterReload = calculateTreeState(reloadedHabit, checkTimeMs);
  assert.equal(stateAfterReload.development, stateBefore.development);
  assert.equal(stateAfterReload.stage, 'young');

  // Переключаем обратно с 7 на 3
  const habitBackTo3 = applyHabitSettingsUpdate(reloadedHabit, { targetDaysPerWeek: 3 });
  const stateBackTo3 = calculateTreeState(habitBackTo3, checkTimeMs);
  assert.equal(stateBackTo3.development, stateBefore.development);
  assert.equal(stateBackTo3.stage, 'young');

  // Новое выполнение после смены цели продолжает давать рост по прежним правилам
  const nextDayKey = toLocalDateKey(checkTimeMs);
  const afterNewCheck = checkInHabitForDay(habitGoal7, nextDayKey, checkTimeMs).habit;
  const stateAfterNewGrowth = calculateTreeState(afterNewCheck, checkTimeMs + 24 * 3_600_000);
  assert.ok(stateAfterNewGrowth.development > stateBefore.development);
});

test('11. Увеличение и уменьшение целевого количества минут таймера не пересчитывает прошлое и не меняет дерево', () => {
  const startDayKey = '2026-04-01';
  const createdMs = startOfLocalDayMs(startDayKey) + 9 * 3_600_000;
  let habit = createHabit({
    title: 'Чтение с таймером',
    mode: 'timer',
    targetDaysPerWeek: 3,
    dailyTargetMinutes: 20,
    createdAtMs: createdMs,
    seed: 554433,
  });

  // Записываем 5 недель сессий по 20 минут + один день с 12 минутами (неполный)
  for (let w = 0; w < 5; w++) {
    for (const dOffset of [0, 2, 4]) {
      const dKey = addDaysToDateKey(startDayKey, w * 7 + dOffset);
      const sStart = startOfLocalDayMs(dKey) + 11 * 3_600_000;
      const sEnd = sStart + 20 * 60_000;
      habit = recordTimerSession(
        habit,
        {
          id: `s_${w}_${dOffset}`,
          habitId: habit.id,
          startedAtMs: sStart,
          endedAtMs: sEnd,
          durationMs: 20 * 60_000,
          intervals: [{ startMs: sStart, endMs: sEnd }],
        },
        sEnd
      ).habit;
    }
  }
  // Неполная 12-минутная сессия в отдельный день
  const partialDayKey = addDaysToDateKey(startDayKey, 1);
  const pStart = startOfLocalDayMs(partialDayKey) + 14 * 3_600_000;
  habit = recordTimerSession(
    habit,
    {
      id: 's_partial_12m',
      habitId: habit.id,
      startedAtMs: pStart,
      endedAtMs: pStart + 12 * 60_000,
      durationMs: 12 * 60_000,
      intervals: [{ startMs: pStart, endMs: pStart + 12 * 60_000 }],
    },
    pStart + 12 * 60_000
  ).habit;

  const checkTimeMs = createdMs + 35 * 86_400_000;
  const stateOriginal = calculateTreeState(habit, checkTimeMs);

  // Увеличиваем дневную цель минут с 20 до 60
  const habitIncreasedMin = applyHabitSettingsUpdate(habit, { dailyTargetMinutes: 60 });
  assert.equal(habitIncreasedMin.dailyTargetMinutes, 60);
  const stateIncreased = calculateTreeState(habitIncreasedMin, checkTimeMs);
  assert.equal(stateIncreased.development, stateOriginal.development);
  assert.equal(stateIncreased.vitality, stateOriginal.vitality);
  assert.equal(stateIncreased.canopyRecovery, stateOriginal.canopyRecovery);
  assert.equal(stateIncreased.stage, stateOriginal.stage);

  // Уменьшаем дневную цель минут с 60 до 10 (прошлая 12-минутная сессия НЕ должна задним числом стать выполненным днём)
  const habitDecreasedMin = applyHabitSettingsUpdate(habitIncreasedMin, {
    dailyTargetMinutes: 10,
  });
  assert.equal(habitDecreasedMin.dailyTargetMinutes, 10);
  const stateDecreased = calculateTreeState(habitDecreasedMin, checkTimeMs);
  assert.equal(stateDecreased.development, stateOriginal.development);
  assert.equal(stateDecreased.vitality, stateOriginal.vitality);
  assert.equal(stateDecreased.canopyRecovery, stateOriginal.canopyRecovery);
  assert.equal(stateDecreased.stage, stateOriginal.stage);
});

test('12. Появление новых ветвей при росте не меняет параметры существующих ветвей (отсутствие скачков геометрии)', () => {
  const seed = 4829104;
  const basePeriod = {
    periodIndex: 0,
    startDateKey: '2026-05-01',
    endDateKey: '2026-05-07',
    startMs: 0,
    endMs: 1,
    completedDaysCount: 3,
    targetDays: 4,
    isGoalMet: false,
    dayOfPeriod: 3,
    remainingPossibleDays: 4,
  };

  // Проверяем плотную сетку значений development от 4.0 до 85.0 с шагом 0.05,
  // проходя через все точки зарождения ветвей первого, второго и третьего порядков.
  for (let dev = 4.0; dev < 85.0; dev += 0.25) {
    const stateA = {
      development: dev,
      vitality: 0.95,
      canopyRecovery: 0.95,
      budFactor: 0.2,
      leafDullness: 0,
      stage: 'young' as const,
      stageLabel: 'Молодое дерево',
      conditionLabel: 'Здоровое живое дерево',
      currentPeriod: basePeriod,
    };
    const stateB = {
      ...stateA,
      development: dev + 0.05,
    };

    const geomA = generateTreeGeometry(seed, stateA);
    const geomB = generateTreeGeometry(seed, stateB);

    const mapB = new Map(geomB.branches.map((b) => [b.id, b]));
    for (const branchA of geomA.branches) {
      const branchB = mapB.get(branchA.id);
      assert.ok(branchB, `Ветвь ${branchA.id} должна сохраняться при росте`);
      const deltaStart = Math.hypot(branchB.x1 - branchA.x1, branchB.y1 - branchA.y1);
      const deltaEnd = Math.hypot(branchB.x2 - branchA.x2, branchB.y2 - branchA.y2);
      assert.ok(
        deltaStart < 0.5 && deltaEnd < 0.5,
        `Ветвь ${branchA.id} не должна прыгать при dev=${dev.toFixed(2)}: deltaEnd=${deltaEnd.toFixed(3)}`
      );
    }
  }
});

test('13. Совместимость со старым состоянием localStorage без поля activeTimer.id: назначение id и сохранение без сброса длительности, паузы, истории и роста', () => {
  const baseMs = new Date(2026, 4, 10, 9, 0, 0).getTime();
  let habit = createHabit({
    id: 'habit_legacy_1',
    title: 'Фортепиано',
    mode: 'timer',
    targetDaysPerWeek: 4,
    dailyTargetMinutes: 20,
    createdAtMs: baseMs - 7 * 86_400_000,
    seed: 112233,
  });

  // Запишем одну прошлую сессию, чтобы убедиться, что история и рост не теряются
  const pastStart = baseMs - 2 * 86_400_000;
  habit = recordTimerSession(
    habit,
    {
      id: 'past_sess_1',
      habitId: habit.id,
      startedAtMs: pastStart,
      endedAtMs: pastStart + 25 * 60_000,
      durationMs: 25 * 60_000,
      intervals: [{ startMs: pastStart, endMs: pastStart + 25 * 60_000 }],
    },
    pastStart + 25 * 60_000
  ).habit;

  const treeBefore = calculateTreeState(habit, baseMs);

  // Старый формат activeTimer без поля `id` (на паузе с накопленными 8 минутами)
  const legacyPausedTimerWithoutId = {
    habitId: habit.id,
    startedAtMs: baseMs - 600_000,
    status: 'paused',
    accumulatedIntervals: [{ startMs: baseMs - 600_000, endMs: baseMs - 120_000 }],
    currentSegmentStartMs: null,
  };

  const migrated = migrateStorageData({
    version: 1,
    hasChosenGardenMode: true,
    gardenMode: 'personal',
    habits: [habit],
    activeTimer: legacyPausedTimerWithoutId,
  });

  assert.ok(migrated.activeTimer);
  assert.equal(typeof migrated.activeTimer.id, 'string');
  assert.ok(migrated.activeTimer.id.length > 0);
  assert.equal(migrated.activeTimer.status, 'paused');
  assert.equal(getActiveTimerElapsedMs(migrated.activeTimer, baseMs + 300_000), 480_000);
  assert.equal(migrated.habits[0].sessions.length, 1);

  const treeAfter = calculateTreeState(migrated.habits[0], baseMs);
  assert.equal(treeAfter.development, treeBefore.development);
  assert.equal(treeAfter.stage, treeBefore.stage);
});

