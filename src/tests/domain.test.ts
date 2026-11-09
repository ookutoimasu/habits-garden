import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDaysToDateKey,
  endOfLocalDayMs,
  startOfLocalDayMs,
  toLocalDateKey,
} from '../domain/calendar';
import {
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
  // 10 минут работы
  timer = pauseActiveTimer(timer, t0 + 10 * 60_000);
  assert.equal(getActiveTimerElapsedMs(timer, t0 + 25 * 60_000), 10 * 60_000);

  // Продолжаем через 15 минут паузы и работаем ещё 5 минут
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

  // Сессия 1: 8 минут
  const t1 = startNewTimer(habit.id, dayStart + 60_000);
  const s1 = stopActiveTimer(t1, dayStart + 9 * 60_000)!;
  const r1 = recordTimerSession(habit, s1, dayStart + 9 * 60_000);
  habit = r1.habit;
  assert.equal(r1.shouldTriggerParticles, false);
  assert.equal(getDayStatus(habit, dateKey, dayStart + 10 * 60_000).isCompleted, false);

  // Сессия 2: 7 минут (в сумме 15 из 20)
  const t2 = startNewTimer(habit.id, dayStart + 20 * 60_000);
  const s2 = stopActiveTimer(t2, dayStart + 27 * 60_000)!;
  const r2 = recordTimerSession(habit, s2, dayStart + 27 * 60_000);
  habit = r2.habit;
  assert.equal(r2.shouldTriggerParticles, false);
  assert.equal(getDayStatus(habit, dateKey, dayStart + 28 * 60_000).isCompleted, false);

  // Сессия 3: 6 минут (в сумме 21 из 20 -> цель достигнута!)
  const t3 = startNewTimer(habit.id, dayStart + 40 * 60_000);
  const s3 = stopActiveTimer(t3, dayStart + 46 * 60_000)!;
  const r3 = recordTimerSession(habit, s3, dayStart + 46 * 60_000);
  habit = r3.habit;
  assert.equal(r3.shouldTriggerParticles, true);
  assert.equal(getDayStatus(habit, dateKey, dayStart + 46 * 60_000).isCompleted, true);

  // Повторная попытка сохранить ту же сессию не дублирует её
  const dup = recordTimerSession(habit, s3, dayStart + 47 * 60_000);
  assert.equal(dup.didChange, false);
  assert.equal(dup.shouldTriggerParticles, false);
});

test('4. Переход таймера через локальную полночь корректно распределяет время по двум дням', () => {
  const day1Key = '2026-05-10';
  const day2Key = '2026-05-11';
  const day1End = endOfLocalDayMs(day1Key);
  // Начинаем за 10 минут до полуночи и заканчиваем через 15 минут после полуночи
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

  // Первая отметка: выполнение засчитано, золотые частицы показаны
  const first = checkInHabitForDay(habit, todayKey, nowMs);
  habit = first.habit;
  assert.equal(first.didChange, true);
  assert.equal(first.shouldTriggerParticles, true);
  assert.equal(habit.checks.length, 1);

  // Повторное нажатие: не добавляет второе выполнение и не запускает частицы
  const second = checkInHabitForDay(habit, todayKey, nowMs + 5000);
  assert.equal(second.didChange, false);
  assert.equal(second.shouldTriggerParticles, false);
  assert.equal(second.habit.checks.length, 1);

  // Отмена ошибочной отметки и повторная отметка в тот же день:
  // выполнение возвращается, но золотые частицы повторно не воспроизводятся
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

  // В момент самой отметки скачок размера, жизненности и кроны равен строго 0
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

  // А через 24 часа после отметки дерево плавно выросло
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

  // Прошло 4 дня без занятий внутри первого 7-дневного периода (остаётся ещё 3 дня для 3 отметок)
  const day4Ms = createdMs + 4 * 86_400_000;
  const stateAtCreation = calculateTreeState(habit3, createdMs);
  const stateAtDay4 = calculateTreeState(habit3, day4Ms);

  // Жизненность и крона НЕ оштрафованы преждевременно
  assert.equal(stateAtDay4.vitality, stateAtCreation.vitality);
  assert.equal(stateAtDay4.canopyRecovery, stateAtCreation.canopyRecovery);

  const periodAtDay4 = getPeriodInfo(habit3, toLocalDateKey(day4Ms), day4Ms);
  assert.equal(periodAtDay4.remainingPossibleDays >= 3, true);

  // Сравним выполнение плана 3 из 3 и 7 из 7 за 2 недели
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

  // Развитие при выполнении 3 из 3 практически идентично 7 из 7
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

  // 19 дней полного отсутствия занятий -> голый ствол (vitality = 0, canopyRecovery = 0), но дерево сохранено
  const neglectedMs = createdMs + 19 * 86_400_000;
  const wiltedState = calculateTreeState(habit, neglectedMs);
  assert.equal(wiltedState.vitality, 0);
  assert.equal(wiltedState.canopyRecovery, 0);
  assert.ok(wiltedState.development >= 4.0);

  // Теперь выполняем план 4 дня в неделю на протяжении 3 недель (21 день)
  const recoveryStartDayIdx = 21; // начало 4-го периода
  for (let w = 0; w < 3; w++) {
    for (const offset of [0, 2, 4, 5]) {
      const dayIdx = recoveryStartDayIdx + w * 7 + offset;
      const dKey = addDaysToDateKey(startDayKey, dayIdx);
      const evMs = startOfLocalDayMs(dKey) + 11 * 3_600_000;
      habit = checkInHabitForDay(habit, dKey, evMs).habit;
    }
  }

  // В середине восстановления (через 1 неделю) видны почки и частичная крона
  const midRecoveryMs = startOfLocalDayMs(addDaysToDateKey(startDayKey, recoveryStartDayIdx + 7));
  const midState = calculateTreeState(habit, midRecoveryMs);
  assert.ok(midState.canopyRecovery > 0.25 && midState.canopyRecovery < 0.75);
  assert.ok(midState.budFactor > 0.4);

  // Через 3 недели соблюдения плана дерево полностью восстановило крону и жизненность
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
