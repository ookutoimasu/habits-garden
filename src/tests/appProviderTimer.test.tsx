import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppContextValue, AppProvider, useApp } from '../app/AppProvider';
import { createHabit } from '../domain/habits';
import { getActiveTimerElapsedMs } from '../domain/timer';
import { calculateTreeState } from '../domain/treeModel';
import { STORAGE_KEY } from '../storage/repository';

/**
 * Минимальное окружение window / document / localStorage для монтирования React 19 createRoot
 * внутри <StrictMode> с полным отслеживанием активных setInterval и обработчиков visibilitychange.
 */
function setupTestBrowserEnv() {
  const storageMap = new Map<string, string>();
  const activeIntervals = new Map<number, { fn: () => void; ms: number }>();
  const visibilityListeners = new Set<EventListenerOrEventListenerObject>();
  let nextTimerId = 1;
  let visibilityState: 'visible' | 'hidden' = 'visible';

  const localStorageMock = {
    getItem(key: string) {
      return storageMap.get(key) ?? null;
    },
    setItem(key: string, val: string) {
      storageMap.set(key, String(val));
    },
    removeItem(key: string) {
      storageMap.delete(key);
    },
    clear() {
      storageMap.clear();
    },
  };

  const makeElement = (tagName: string): any => {
    const el: any = {
      nodeType: 1,
      tagName: tagName.toUpperCase(),
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      childNodes: [],
      style: {},
      ownerDocument: null,
      appendChild(child: any) {
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
      },
      removeChild(child: any) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
        child.parentNode = null;
        return child;
      },
      insertBefore(child: any, ref: any) {
        const idx = this.childNodes.indexOf(ref);
        if (idx >= 0) this.childNodes.splice(idx, 0, child);
        else this.childNodes.push(child);
        child.parentNode = this;
        return child;
      },
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
      removeAttribute() {},
    };
    return el;
  };

  const docMock: any = {
    nodeType: 9,
    documentElement: makeElement('html'),
    body: makeElement('body'),
    get visibilityState() {
      return visibilityState;
    },
    createElement(tag: string) {
      const el = makeElement(tag);
      el.ownerDocument = docMock;
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, nodeValue: text, ownerDocument: docMock };
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'visibilitychange') {
        visibilityListeners.add(listener);
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'visibilitychange') {
        visibilityListeners.delete(listener);
      }
    },
  };
  docMock.documentElement.ownerDocument = docMock;
  docMock.body.ownerDocument = docMock;

  const winMock: any = {
    document: docMock,
    localStorage: localStorageMock,
    HTMLIFrameElement: class {},
    navigator: { userAgent: 'node-test' },
    setInterval(fn: () => void, ms: number) {
      const id = nextTimerId++;
      activeIntervals.set(id, { fn, ms });
      return id;
    },
    clearInterval(id: number) {
      activeIntervals.delete(id);
    },
    setTimeout(_fn: () => void, _ms: number) {
      const id = nextTimerId++;
      return id;
    },
    clearTimeout(_id: number) {},
    addEventListener() {},
    removeEventListener() {},
  };

  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).window = winMock;
  (globalThis as any).document = docMock;
  (globalThis as any).localStorage = localStorageMock;

  return {
    container: docMock.createElement('div'),
    storageMap,
    activeIntervals,
    visibilityListeners,
    tickAllIntervals() {
      for (const item of Array.from(activeIntervals.values())) {
        item.fn();
      }
    },
    triggerVisibilityChange(state: 'visible' | 'hidden') {
      visibilityState = state;
      for (const listener of Array.from(visibilityListeners)) {
        if (typeof listener === 'function') {
          listener(new Event('visibilitychange'));
        } else {
          listener.handleEvent(new Event('visibilitychange'));
        }
      }
    },
  };
}

function getCtx(holder: { current: AppContextValue | null }): AppContextValue {
  if (!holder.current) {
    throw new Error('AppContextValue is not initialized');
  }
  return holder.current;
}

test('AppProvider внутри настоящего <StrictMode>: один интервал, один обработчик visibilitychange, точный старт с 00:00 после >15с ожидания, пауза, продолжение и защита от двойного сохранения сессии', () => {
  const env = setupTestBrowserEnv();
  let fakeNowMs = new Date(2026, 5, 1, 10, 0, 0).getTime();

  const ctxHolder: { current: AppContextValue | null } = { current: null };
  const Probe: React.FC = () => {
    ctxHolder.current = useApp();
    return null;
  };

  const root = createRoot(env.container);

  act(() => {
    root.render(
      <StrictMode>
        <AppProvider getNowMs={() => fakeNowMs}>
          <Probe />
        </AppProvider>
      </StrictMode>
    );
  });

  assert.ok(ctxHolder.current, 'Контекст AppProvider должен быть инициализирован');

  // 1. Проверяем, что после двойного запуска эффектов в <StrictMode> остался ровно 1 интервал и 1 обработчик visibilitychange
  assert.equal(
    env.activeIntervals.size,
    1,
    'После монтирования в <StrictMode> должен остаться ровно один активный интервал'
  );
  assert.equal(
    env.visibilityListeners.size,
    1,
    'После монтирования в <StrictMode> должен остаться ровно один обработчик visibilitychange'
  );

  // Переключаемся в личный сад и создаём привычку с таймером
  let habitId = '';
  act(() => {
    getCtx(ctxHolder).chooseGardenMode('personal');
    const created = getCtx(ctxHolder).addHabit({
      title: 'Глубокая работа',
      mode: 'timer',
      targetDaysPerWeek: 4,
      dailyTargetMinutes: 20,
    });
    habitId = created.id;
  });

  // 2. Ждём 14 секунд без тика 15-секундного интервала (имитация простоя перед нажатием «Начать»)
  fakeNowMs += 14_000;

  act(() => {
    getCtx(ctxHolder).startTimerForHabit(habitId);
  });

  const startedTimer = getCtx(ctxHolder).activeTimer;
  assert.ok(startedTimer, 'Таймер должен запуститься');
  assert.equal(
    getActiveTimerElapsedMs(startedTimer, getCtx(ctxHolder).nowMs),
    0,
    'Сразу после старта (даже после 14с ожидания) таймер должен показывать ровно 00:00 (0 мс)'
  );
  assert.equal(
    env.activeIntervals.size,
    1,
    'При работающем таймере должен быть ровно один активный интервал'
  );

  // Через 1 секунду после старта должно быть ровно 1000 мс (а не 15000 мс!)
  fakeNowMs += 1_000;
  act(() => {
    env.tickAllIntervals();
  });
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, getCtx(ctxHolder).nowMs),
    1_000,
    'Через 1 секунду после старта должно быть ровно 1000 мс без скачка на 15 секунд'
  );

  // Проходит ещё 3 секунды (всего 4 секунды), нажимаем «Пауза» между тиками интервала
  fakeNowMs += 3_000;
  act(() => {
    getCtx(ctxHolder).pauseTimer();
    // Повторное быстрое нажатие на паузу не должно ничего менять
    getCtx(ctxHolder).pauseTimer();
  });

  assert.equal(getCtx(ctxHolder).activeTimer?.status, 'paused');
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, getCtx(ctxHolder).nowMs),
    4_000,
    'При нажатии на паузу на 4-й секунде таймер должен зафиксировать ровно 4000 мс'
  );

  // 3. Стоим на паузе 25 секунд, затем нажимаем «Продолжить»
  fakeNowMs += 25_000;
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, fakeNowMs),
    4_000,
    'Во время паузы время не должно начисляться'
  );

  act(() => {
    getCtx(ctxHolder).resumeTimer();
    // Повторное быстрое нажатие на Продолжить не должно сбрасывать или дублировать сегмент
    getCtx(ctxHolder).resumeTimer();
  });

  assert.equal(getCtx(ctxHolder).activeTimer?.status, 'running');
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, getCtx(ctxHolder).nowMs),
    4_000,
    'В момент нажатия «Продолжить» после 25с паузы значение должно оставаться 4000 мс без скачка'
  );

  // Имитируем уход вкладки в фон на 6 секунд и возврат через visibilitychange
  fakeNowMs += 6_000;
  act(() => {
    env.triggerVisibilityChange('visible');
  });
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, getCtx(ctxHolder).nowMs),
    10_000,
    'После возврата из фоновой вкладки должно быть ровно 4 + 6 = 10 секунд'
  );

  // 4. Защита от повторного сохранения сессии (как при двойном клике, так и при вызове после снятия блокировки)
  act(() => {
    getCtx(ctxHolder).stopAndSaveTimer();
    getCtx(ctxHolder).stopAndSaveTimer();
  });
  act(() => {
    getCtx(ctxHolder).stopAndSaveTimer();
  });

  assert.equal(getCtx(ctxHolder).activeTimer, null, 'После сохранения активный таймер должен быть очищен');
  const savedHabit = getCtx(ctxHolder).habits.find((h) => h.id === habitId)!;
  assert.equal(
    savedHabit.sessions.length,
    1,
    'Сессия должна сохраниться ровно один раз без дублирования'
  );
  assert.equal(savedHabit.sessions[0].durationMs, 10_000);

  act(() => {
    root.unmount();
  });
  assert.equal(env.activeIntervals.size, 0, 'При размонтировании интервал должен очищаться');
  assert.equal(
    env.visibilityListeners.size,
    0,
    'При размонтировании обработчик visibilitychange должен удаляться'
  );
});

test('AppProvider: восстановление работающего и приостановленного таймера после перезагрузки + проверка скорости симуляции', () => {
  const env = setupTestBrowserEnv();
  let fakeNowMs = new Date(2026, 5, 2, 9, 0, 0).getTime();

  // Предварительно сохраняем старый формат activeTimer без поля id в localStorage
  const preloadHabit = createHabit({
    id: 'h_reload_1',
    title: 'Английский язык',
    mode: 'timer',
    targetDaysPerWeek: 5,
    dailyTargetMinutes: 15,
    createdAtMs: fakeNowMs - 86_400_000,
    seed: 998877,
  });

  env.storageMap.set(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      hasChosenGardenMode: true,
      gardenMode: 'personal',
      habits: [preloadHabit],
      activeTimer: {
        // намеренно без поля id (проверка миграции при загрузке репозитория)
        habitId: preloadHabit.id,
        startedAtMs: fakeNowMs - 120_000,
        status: 'paused',
        accumulatedIntervals: [{ startMs: fakeNowMs - 120_000, endMs: fakeNowMs - 60_000 }],
        currentSegmentStartMs: null,
      },
    })
  );

  const ctxHolder: { current: AppContextValue | null } = { current: null };
  const Probe: React.FC = () => {
    ctxHolder.current = useApp();
    return null;
  };

  // Прошло 10 минут пока страница была закрыта, а таймер стоял на паузе
  fakeNowMs += 600_000;

  const root = createRoot(env.container);
  act(() => {
    root.render(
      <StrictMode>
        <AppProvider getNowMs={() => fakeNowMs}>
          <Probe />
        </AppProvider>
      </StrictMode>
    );
  });

  // 1. Таймер на паузе восстановился с назначенным id и НЕ начислил время за время перезагрузки
  const restoredPaused = getCtx(ctxHolder).activeTimer;
  assert.ok(restoredPaused);
  assert.ok(restoredPaused.id.startsWith('legacy_timer_'));
  assert.equal(restoredPaused.status, 'paused');
  assert.equal(
    getActiveTimerElapsedMs(restoredPaused, getCtx(ctxHolder).nowMs),
    60_000,
    'Таймер на паузе после перезагрузки должен сохранить ровно 60 секунд без начисления времени простоя'
  );

  const assignedId = restoredPaused.id;

  // Завершаем и сохраняем восстановленный таймер
  act(() => {
    getCtx(ctxHolder).stopAndSaveTimer();
  });
  assert.equal(getCtx(ctxHolder).activeTimer, null);
  assert.equal(getCtx(ctxHolder).habits[0].sessions.length, 1);
  assert.equal(getCtx(ctxHolder).habits[0].sessions[0].durationMs, 60_000);
  const growthAfterSave = calculateTreeState(
    getCtx(ctxHolder).habits[0],
    getCtx(ctxHolder).nowMs
  ).development;

  act(() => {
    getCtx(ctxHolder).stopAndSaveTimer();
  });
  assert.equal(getCtx(ctxHolder).habits[0].sessions.length, 1);
  assert.equal(
    calculateTreeState(getCtx(ctxHolder).habits[0], getCtx(ctxHolder).nowMs).development,
    growthAfterSave
  );
  assert.ok(assignedId.length > 0);

  // 2. Перезагрузка страницы после сохранения: сохранённая сессия остаётся одной, активный таймер не появляется снова
  act(() => {
    root.unmount();
  });

  const root2 = createRoot(env.container);
  act(() => {
    root2.render(
      <StrictMode>
        <AppProvider getNowMs={() => fakeNowMs}>
          <Probe />
        </AppProvider>
      </StrictMode>
    );
  });

  assert.equal(
    getCtx(ctxHolder).activeTimer,
    null,
    'После перезагрузки завершённый таймер не появляется снова'
  );
  assert.equal(getCtx(ctxHolder).habits[0].sessions.length, 1, 'Сохранена ровно одна сессия');

  // 3. Восстановление РАБОТАЮЩЕГО таймера после перезагрузки страницы + обновление настроек во время работы таймера
  act(() => {
    getCtx(ctxHolder).startTimerForHabit(preloadHabit.id);
  });
  fakeNowMs += 5_000;
  act(() => {
    root2.unmount();
  });
  fakeNowMs += 7_000;

  const root3 = createRoot(env.container);
  act(() => {
    root3.render(
      <StrictMode>
        <AppProvider getNowMs={() => fakeNowMs}>
          <Probe />
        </AppProvider>
      </StrictMode>
    );
  });

  const restoredRunning = getCtx(ctxHolder).activeTimer;
  assert.ok(restoredRunning, 'Работающий таймер должен восстановиться после перезагрузки');
  assert.equal(restoredRunning.status, 'running');
  assert.equal(
    getActiveTimerElapsedMs(restoredRunning, getCtx(ctxHolder).nowMs),
    12_000,
    'Работающий таймер после перезагрузки должен учитывать всё прошедшее время (5с + 7с = 12с)'
  );

  // Меняем настройки привычки прямо во время работы таймера и проверяем, что тик не перезаписывает их
  act(() => {
    getCtx(ctxHolder).updateHabitSettings(preloadHabit.id, {
      title: 'Английский язык (обновлено)',
      targetDaysPerWeek: 7,
      dailyTargetMinutes: 30,
    });
  });
  fakeNowMs += 3_000;
  act(() => {
    env.tickAllIntervals();
    getCtx(ctxHolder).stopAndSaveTimer();
  });

  assert.equal(getCtx(ctxHolder).habits[0].title, 'Английский язык (обновлено)');
  assert.equal(getCtx(ctxHolder).habits[0].targetDaysPerWeek, 7);
  assert.equal(getCtx(ctxHolder).habits[0].sessions.length, 2);
  assert.equal(getCtx(ctxHolder).habits[0].sessions[1].durationMs, 15_000);

  // 4. Проверка режима симуляции и смены скорости симуляции (1x -> 10x -> 60x)
  act(() => {
    getCtx(ctxHolder).enterSimulation();
  });

  // Ждём 20 секунд в режиме симуляции ДО старта таймера
  fakeNowMs += 20_000;
  act(() => {
    getCtx(ctxHolder).startTimerForHabit(preloadHabit.id);
  });
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, getCtx(ctxHolder).nowMs),
    0,
    'В симуляции время ожидания до старта не должно добавляться к новой сессии'
  );

  // 2 секунды на скорости 1x = 2000 мс
  fakeNowMs += 2_000;
  act(() => {
    getCtx(ctxHolder).setSimSpeedMultiplier(10);
  });
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, getCtx(ctxHolder).nowMs),
    2_000,
    'Перед переключением скорости на 10x прошедшие 2с должны быть учтены по старой скорости 1x'
  );

  // 3 секунды реального времени на скорости 10x = +30 000 мс (итого 32 000 мс)
  fakeNowMs += 3_000;
  act(() => {
    getCtx(ctxHolder).pauseTimer();
  });
  assert.equal(
    getActiveTimerElapsedMs(getCtx(ctxHolder).activeTimer!, getCtx(ctxHolder).nowMs),
    32_000,
    '3 секунды на скорости 10x должны прибавить ровно 30 секунд (итого 32 000 мс)'
  );

  act(() => {
    root3.unmount();
  });
});
