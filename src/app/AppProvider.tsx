import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { buildDemoHabits } from '../demo/demoData';
import { addDaysToDateKey, startOfLocalDayMs, toLocalDateKey } from '../domain/calendar';
import {
  applyHabitSettingsUpdate,
  checkActiveTimerReward,
  checkInHabitForDay,
  createHabit,
  CreateHabitParams,
  recordTimerSession,
  undoCheckInHabitForDay,
} from '../domain/habits';
import {
  getSavedSessionIdForTimer,
  pauseActiveTimer,
  resumeActiveTimer,
  startNewTimer,
  stopActiveTimer,
} from '../domain/timer';
import { ActiveTimerState, Habit, StorageSchemaV1, TrackingMode } from '../domain/types';
import { loadStorageState, saveStorageState } from '../storage/repository';

export type StagePreviewPreset =
  | 'sprout'
  | 'young'
  | 'large'
  | 'mature'
  | 'wilted'
  | 'recovering'
  | null;

interface ContextSlice {
  habits: Habit[];
  activeTimer: ActiveTimerState | null;
}

export interface AppContextValue {
  /** Текущее эффективное время (реальные часы или тестовые часы симуляции) */
  nowMs: number;
  /** Список привычек активного контура (личный, демо или копия симуляции) */
  habits: Habit[];
  /** Активный незавершённый таймер (не более одного одновременно) */
  activeTimer: ActiveTimerState | null;
  /** Выбранная открытая привычка (null = экран Сада) */
  selectedHabitId: string | null;
  selectHabit: (habitId: string | null) => void;

  /** Режим сада: личный или демонстрационный */
  gardenMode: 'personal' | 'demo';
  hasChosenGardenMode: boolean;
  chooseGardenMode: (mode: 'personal' | 'demo') => void;

  /** Действия с привычками */
  addHabit: (params: {
    title: string;
    mode: TrackingMode;
    targetDaysPerWeek: number;
    dailyTargetMinutes?: number;
  }) => Habit;
  updateHabitSettings: (
    habitId: string,
    params: {
      title: string;
      targetDaysPerWeek: number;
      dailyTargetMinutes?: number;
    }
  ) => void;
  deleteHabit: (habitId: string) => void;

  /** Отметка и отмена отметки за сегодня */
  checkInToday: (habitId: string) => void;
  undoCheckInToday: (habitId: string) => void;

  /** Управление таймером */
  startTimerForHabit: (habitId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopAndSaveTimer: () => void;

  /** Золотые частицы выполнения (habitId -> активно) */
  activeParticleHabitId: string | null;

  /** Панель проверки времени (симуляция) */
  isSimulationOpen: boolean;
  enterSimulation: () => void;
  exitSimulation: () => void;
  advanceSimulationTime: (deltaMs: number) => void;
  simSpeedMultiplier: number;
  setSimSpeedMultiplier: (multiplier: number) => void;
  simulatePlanWeek: (habitId?: string) => void;
  simulateNeglectWeek: () => void;
  stagePreviewPreset: StagePreviewPreset;
  setStagePreviewPreset: (preset: StagePreviewPreset) => void;
  resetSimulationToCurrentReal: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  children: React.ReactNode;
  /** Опциональный источник времени (по умолчанию Date.now) для детерминированных тестов */
  getNowMs?: () => number;
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  getNowMs = () => Date.now(),
}) => {
  const getNowRef = useRef(getNowMs);
  getNowRef.current = getNowMs;

  const initialRealNow = useMemo(() => getNowRef.current(), []);
  const [realNowMs, setRealNowMs] = useState<number>(initialRealNow);
  const realNowMsRef = useRef<number>(initialRealNow);

  const initialStorage = useMemo(() => loadStorageState(), []);
  const [storageState, setStorageState] = useState<StorageSchemaV1>(initialStorage);
  const storageStateRef = useRef<StorageSchemaV1>(initialStorage);

  // Изолированное состояние демонстрационного сада
  const initialDemoHabits = useMemo(() => buildDemoHabits(initialRealNow), [initialRealNow]);
  const [demoHabits, setDemoHabits] = useState<Habit[]>(initialDemoHabits);
  const [demoActiveTimer, setDemoActiveTimer] = useState<ActiveTimerState | null>(null);
  const demoStateRef = useRef<ContextSlice>({
    habits: initialDemoHabits,
    activeTimer: null,
  });

  // Навигация: null = Сад, string = страница конкретной привычки
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  // Состояние кратковременной награды золотыми частицами
  const [activeParticleHabitId, setActiveParticleHabitId] = useState<string | null>(null);
  const particleTimeoutRef = useRef<number | null>(null);

  // Изолированный контур симуляции и проверки времени (по умолчанию закрыт)
  const [isSimulationOpen, setIsSimulationOpen] = useState<boolean>(false);
  const isSimulationOpenRef = useRef<boolean>(false);

  const [simNowMs, setSimNowMs] = useState<number>(initialRealNow);
  const simNowMsRef = useRef<number>(initialRealNow);
  const lastSimRealTickRef = useRef<number>(initialRealNow);

  const [simSpeedMultiplier, setSimSpeedMultiplierState] = useState<number>(1);
  const simSpeedMultiplierRef = useRef<number>(1);

  const [simHabits, setSimHabits] = useState<Habit[]>([]);
  const [simActiveTimer, setSimActiveTimer] = useState<ActiveTimerState | null>(null);
  const simStateRef = useRef<ContextSlice>({
    habits: [],
    activeTimer: null,
  });

  const [stagePreviewPreset, setStagePreviewPreset] = useState<StagePreviewPreset>(null);

  // Защита от повторного сохранения одной и той же сессии таймера
  const isSavingTimerRef = useRef<boolean>(false);
  const completedTimerIdsRef = useRef<Set<string>>(new Set());

  const triggerParticlesForHabit = useCallback((habitId: string) => {
    if (particleTimeoutRef.current !== null) {
      window.clearTimeout(particleTimeoutRef.current);
    }
    setActiveParticleHabitId(habitId);
    particleTimeoutRef.current = window.setTimeout(() => {
      setActiveParticleHabitId((prev) => (prev === habitId ? null : prev));
      particleTimeoutRef.current = null;
    }, 1600);
  }, []);

  // Единые атомарные функции фиксации состояния (без побочных эффектов внутри функциональных сеттеров)
  const commitStorageState = useCallback((nextState: StorageSchemaV1) => {
    storageStateRef.current = nextState;
    saveStorageState(nextState);
    setStorageState(nextState);
  }, []);

  const commitDemoState = useCallback((nextSlice: ContextSlice) => {
    demoStateRef.current = nextSlice;
    setDemoHabits(nextSlice.habits);
    setDemoActiveTimer(nextSlice.activeTimer);
  }, []);

  const commitSimState = useCallback((nextSlice: ContextSlice) => {
    simStateRef.current = nextSlice;
    setSimHabits(nextSlice.habits);
    setSimActiveTimer(nextSlice.activeTimer);
  }, []);

  const readActiveSlice = useCallback((): ContextSlice => {
    if (isSimulationOpenRef.current) {
      return simStateRef.current;
    }
    if (storageStateRef.current.gardenMode === 'demo') {
      return demoStateRef.current;
    }
    return {
      habits: storageStateRef.current.habits,
      activeTimer: storageStateRef.current.activeTimer,
    };
  }, []);

  const commitActiveSlice = useCallback(
    (nextSlice: ContextSlice) => {
      if (isSimulationOpenRef.current) {
        commitSimState(nextSlice);
        return;
      }
      if (storageStateRef.current.gardenMode === 'demo') {
        commitDemoState(nextSlice);
        return;
      }
      const prevStorage = storageStateRef.current;
      commitStorageState({
        ...prevStorage,
        hasChosenGardenMode: true,
        habits: nextSlice.habits,
        activeTimer: nextSlice.activeTimer,
      });
    },
    [commitDemoState, commitSimState, commitStorageState]
  );

  /**
   * Синхронизирует часы до текущего момента ровно один раз и возвращает актуальную отметку времени.
   * В реальном режиме берёт свежий `getNowRef.current()`.
   * В режиме симуляции продвигает тестовые часы на `(realNow - lastSimRealTick) * speed` ТОЛЬКО если
   * таймер в симуляции сейчас запущен, и всегда обновляет `lastSimRealTickRef.current = realNow`.
   * Благодаря этому время ожидания до нажатия «Начать» или на паузе никогда не добавляется к сессии.
   */
  const syncAndGetEffectiveNowMs = useCallback((): number => {
    const freshReal = getNowRef.current();
    realNowMsRef.current = freshReal;
    setRealNowMs(freshReal);

    if (!isSimulationOpenRef.current) {
      lastSimRealTickRef.current = freshReal;
      return freshReal;
    }

    const deltaReal = Math.max(0, freshReal - lastSimRealTickRef.current);
    lastSimRealTickRef.current = freshReal;

    if (simStateRef.current.activeTimer?.status === 'running' && deltaReal > 0) {
      const nextSimNow = simNowMsRef.current + deltaReal * simSpeedMultiplierRef.current;
      simNowMsRef.current = nextSimNow;
      setSimNowMs(nextSimNow);
      return nextSimNow;
    }

    return simNowMsRef.current;
  }, []);

  const effectiveActiveTimer = isSimulationOpen
    ? simActiveTimer
    : storageState.gardenMode === 'demo'
    ? demoActiveTimer
    : storageState.activeTimer;

  // Интервал 200 мс используется только для плавного обновления экрана во время работы таймера
  useEffect(() => {
    const isRunning = effectiveActiveTimer?.status === 'running';
    const intervalMs = isRunning ? 200 : 15000;

    const id = window.setInterval(() => {
      syncAndGetEffectiveNowMs();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncAndGetEffectiveNowMs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveActiveTimer?.status, isSimulationOpen, syncAndGetEffectiveNowMs]);

  const nowMs = isSimulationOpen ? simNowMs : realNowMs;

  const habits = useMemo(() => {
    if (isSimulationOpen) {
      return simHabits;
    }
    if (storageState.gardenMode === 'demo') {
      return demoHabits;
    }
    return storageState.habits;
  }, [isSimulationOpen, simHabits, storageState.gardenMode, storageState.habits, demoHabits]);

  const activeTimer = effectiveActiveTimer;

  // Проверяем, не достигла ли текущая активная сессия таймера дневной цели прямо во время работы
  useEffect(() => {
    const slice = readActiveSlice();
    const currTimer = slice.activeTimer;
    if (!currTimer || currTimer.status !== 'running') return;

    const targetHabit = slice.habits.find((h) => h.id === currTimer.habitId);
    if (!targetHabit) return;

    const { habit: updatedHabit, shouldTriggerParticles } = checkActiveTimerReward(
      targetHabit,
      currTimer,
      nowMs
    );

    if (shouldTriggerParticles) {
      const nextHabits = slice.habits.map((h) =>
        h.id === updatedHabit.id ? updatedHabit : h
      );
      commitActiveSlice({
        habits: nextHabits,
        activeTimer: currTimer,
      });
      triggerParticlesForHabit(updatedHabit.id);
    }
  }, [
    activeTimer,
    habits,
    nowMs,
    isSimulationOpen,
    storageState.gardenMode,
    readActiveSlice,
    commitActiveSlice,
    triggerParticlesForHabit,
  ]);

  const chooseGardenMode = useCallback(
    (mode: 'personal' | 'demo') => {
      syncAndGetEffectiveNowMs();
      const prev = storageStateRef.current;
      commitStorageState({
        ...prev,
        hasChosenGardenMode: true,
        gardenMode: mode,
      });
      setSelectedHabitId(null);
    },
    [commitStorageState, syncAndGetEffectiveNowMs]
  );

  const selectHabit = useCallback(
    (habitId: string | null) => {
      syncAndGetEffectiveNowMs();
      setSelectedHabitId(habitId);
    },
    [syncAndGetEffectiveNowMs]
  );

  const addHabit = useCallback(
    (params: {
      title: string;
      mode: TrackingMode;
      targetDaysPerWeek: number;
      dailyTargetMinutes?: number;
    }): Habit => {
      const actionNowMs = syncAndGetEffectiveNowMs();
      const createParams: CreateHabitParams = {
        ...params,
        createdAtMs: actionNowMs,
      };
      const newHabit = createHabit(createParams);
      const slice = readActiveSlice();
      commitActiveSlice({
        habits: [newHabit, ...slice.habits],
        activeTimer: slice.activeTimer,
      });
      return newHabit;
    },
    [syncAndGetEffectiveNowMs, readActiveSlice, commitActiveSlice]
  );

  const updateHabitSettings = useCallback(
    (
      habitId: string,
      params: {
        title: string;
        targetDaysPerWeek: number;
        dailyTargetMinutes?: number;
      }
    ) => {
      const slice = readActiveSlice();
      commitActiveSlice({
        habits: slice.habits.map((h) =>
          h.id === habitId ? applyHabitSettingsUpdate(h, params) : h
        ),
        activeTimer: slice.activeTimer,
      });
    },
    [readActiveSlice, commitActiveSlice]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      const slice = readActiveSlice();
      commitActiveSlice({
        habits: slice.habits.filter((h) => h.id !== habitId),
        activeTimer: slice.activeTimer?.habitId === habitId ? null : slice.activeTimer,
      });
      if (selectedHabitId === habitId) {
        setSelectedHabitId(null);
      }
    },
    [readActiveSlice, commitActiveSlice, selectedHabitId]
  );

  const checkInToday = useCallback(
    (habitId: string) => {
      const actionNowMs = syncAndGetEffectiveNowMs();
      const todayKey = toLocalDateKey(actionNowMs);
      const slice = readActiveSlice();

      let shouldReward = false;
      const nextHabits = slice.habits.map((h) => {
        if (h.id !== habitId) return h;
        const res = checkInHabitForDay(h, todayKey, actionNowMs);
        if (res.shouldTriggerParticles) {
          shouldReward = true;
        }
        return res.habit;
      });

      commitActiveSlice({
        habits: nextHabits,
        activeTimer: slice.activeTimer,
      });

      if (shouldReward) {
        triggerParticlesForHabit(habitId);
      }
    },
    [syncAndGetEffectiveNowMs, readActiveSlice, commitActiveSlice, triggerParticlesForHabit]
  );

  const undoCheckInToday = useCallback(
    (habitId: string) => {
      const actionNowMs = syncAndGetEffectiveNowMs();
      const todayKey = toLocalDateKey(actionNowMs);
      const slice = readActiveSlice();

      commitActiveSlice({
        habits: slice.habits.map((h) =>
          h.id === habitId ? undoCheckInHabitForDay(h, todayKey).habit : h
        ),
        activeTimer: slice.activeTimer,
      });
    },
    [syncAndGetEffectiveNowMs, readActiveSlice, commitActiveSlice]
  );

  const startTimerForHabit = useCallback(
    (habitId: string) => {
      const actionNowMs = syncAndGetEffectiveNowMs();
      const slice = readActiveSlice();
      const currTimer = slice.activeTimer;

      // Если таймер для этой же привычки уже активен (запущен или на паузе), повторный старт ничего не сбрасывает
      if (currTimer && currTimer.habitId === habitId) {
        return;
      }

      let updatedHabits = slice.habits;
      let shouldReward = false;
      let rewardedHabitId: string | null = null;

      // Если был запущен таймер в другой привычке, корректно завершаем и один раз сохраняем его
      if (
        currTimer &&
        currTimer.habitId !== habitId &&
        !completedTimerIdsRef.current.has(currTimer.id)
      ) {
        completedTimerIdsRef.current.add(currTimer.id);
        const stoppedSession = stopActiveTimer(currTimer, actionNowMs);
        if (stoppedSession) {
          updatedHabits = slice.habits.map((h) => {
            if (h.id !== currTimer.habitId) return h;
            const rec = recordTimerSession(h, stoppedSession, actionNowMs);
            if (rec.shouldTriggerParticles) {
              shouldReward = true;
              rewardedHabitId = h.id;
            }
            return rec.habit;
          });
        }
      }

      const nextTimer = startNewTimer(habitId, actionNowMs);
      // В режиме симуляции сбрасываем отметку реального тика прямо в момент старта, чтобы ожидание до старта не прибавлялось
      lastSimRealTickRef.current = getNowRef.current();

      commitActiveSlice({
        habits: updatedHabits,
        activeTimer: nextTimer,
      });

      if (shouldReward && rewardedHabitId) {
        triggerParticlesForHabit(rewardedHabitId);
      }
    },
    [syncAndGetEffectiveNowMs, readActiveSlice, commitActiveSlice, triggerParticlesForHabit]
  );

  const pauseTimer = useCallback(() => {
    const actionNowMs = syncAndGetEffectiveNowMs();
    const slice = readActiveSlice();
    if (!slice.activeTimer || slice.activeTimer.status === 'paused') {
      return;
    }
    const paused = pauseActiveTimer(slice.activeTimer, actionNowMs);
    commitActiveSlice({
      habits: slice.habits,
      activeTimer: paused,
    });
  }, [syncAndGetEffectiveNowMs, readActiveSlice, commitActiveSlice]);

  const resumeTimer = useCallback(() => {
    const actionNowMs = syncAndGetEffectiveNowMs();
    const slice = readActiveSlice();
    if (!slice.activeTimer || slice.activeTimer.status === 'running') {
      return;
    }
    lastSimRealTickRef.current = getNowRef.current();
    const resumed = resumeActiveTimer(slice.activeTimer, actionNowMs);
    commitActiveSlice({
      habits: slice.habits,
      activeTimer: resumed,
    });
  }, [syncAndGetEffectiveNowMs, readActiveSlice, commitActiveSlice]);

  const stopAndSaveTimer = useCallback(() => {
    if (isSavingTimerRef.current) {
      return;
    }
    const slice = readActiveSlice();
    const currTimer = slice.activeTimer;
    if (!currTimer) {
      return;
    }

    const expectedSessionId = getSavedSessionIdForTimer(currTimer.id);
    const targetHabit = slice.habits.find((h) => h.id === currTimer.habitId);
    const alreadySavedInHabit = Boolean(
      targetHabit?.sessions.some((s) => s.id === expectedSessionId)
    );

    if (completedTimerIdsRef.current.has(currTimer.id) || alreadySavedInHabit) {
      commitActiveSlice({
        habits: slice.habits,
        activeTimer: null,
      });
      return;
    }

    isSavingTimerRef.current = true;
    try {
      completedTimerIdsRef.current.add(currTimer.id);
      const actionNowMs = syncAndGetEffectiveNowMs();
      const session = stopActiveTimer(currTimer, actionNowMs);

      let shouldReward = false;
      const nextHabits = session
        ? slice.habits.map((h) => {
            if (h.id !== currTimer.habitId) return h;
            const res = recordTimerSession(h, session, actionNowMs);
            if (res.shouldTriggerParticles) {
              shouldReward = true;
            }
            return res.habit;
          })
        : slice.habits;

      commitActiveSlice({
        habits: nextHabits,
        activeTimer: null,
      });

      if (shouldReward) {
        triggerParticlesForHabit(currTimer.habitId);
      }
    } finally {
      isSavingTimerRef.current = false;
    }
  }, [syncAndGetEffectiveNowMs, readActiveSlice, commitActiveSlice, triggerParticlesForHabit]);

  // Функции изолированной панели проверки времени (SimulationPanel)
  const enterSimulation = useCallback(() => {
    const freshReal = getNowRef.current();
    realNowMsRef.current = freshReal;
    setRealNowMs(freshReal);

    const sourceSlice =
      storageStateRef.current.gardenMode === 'demo'
        ? demoStateRef.current
        : {
            habits: storageStateRef.current.habits,
            activeTimer: storageStateRef.current.activeTimer,
          };

    const clonedHabits = JSON.parse(JSON.stringify(sourceSlice.habits)) as Habit[];
    const clonedTimer = sourceSlice.activeTimer
      ? (JSON.parse(JSON.stringify(sourceSlice.activeTimer)) as ActiveTimerState)
      : null;

    commitSimState({
      habits: clonedHabits,
      activeTimer: clonedTimer,
    });

    simNowMsRef.current = freshReal;
    lastSimRealTickRef.current = freshReal;
    setSimNowMs(freshReal);

    simSpeedMultiplierRef.current = 1;
    setSimSpeedMultiplierState(1);

    setStagePreviewPreset(null);
    isSimulationOpenRef.current = true;
    setIsSimulationOpen(true);
  }, [commitSimState]);

  const exitSimulation = useCallback(() => {
    isSimulationOpenRef.current = false;
    setIsSimulationOpen(false);
    setStagePreviewPreset(null);
    const freshReal = getNowRef.current();
    realNowMsRef.current = freshReal;
    lastSimRealTickRef.current = freshReal;
    setRealNowMs(freshReal);
  }, []);

  const resetSimulationToCurrentReal = useCallback(() => {
    const freshReal = getNowRef.current();
    realNowMsRef.current = freshReal;
    setRealNowMs(freshReal);

    const sourceSlice =
      storageStateRef.current.gardenMode === 'demo'
        ? demoStateRef.current
        : {
            habits: storageStateRef.current.habits,
            activeTimer: storageStateRef.current.activeTimer,
          };

    commitSimState({
      habits: JSON.parse(JSON.stringify(sourceSlice.habits)) as Habit[],
      activeTimer: sourceSlice.activeTimer
        ? (JSON.parse(JSON.stringify(sourceSlice.activeTimer)) as ActiveTimerState)
        : null,
    });

    simNowMsRef.current = freshReal;
    lastSimRealTickRef.current = freshReal;
    setSimNowMs(freshReal);
    setStagePreviewPreset(null);
  }, [commitSimState]);

  const setSimSpeedMultiplier = useCallback(
    (multiplier: number) => {
      const cleanMultiplier = Math.max(1, Math.min(3600, Math.round(multiplier)));
      // Сначала фиксируем время, прошедшее на прежней скорости, чтобы смена множителя не искажала прошлое
      syncAndGetEffectiveNowMs();
      simSpeedMultiplierRef.current = cleanMultiplier;
      setSimSpeedMultiplierState(cleanMultiplier);
    },
    [syncAndGetEffectiveNowMs]
  );

  const advanceSimulationTime = useCallback(
    (deltaMs: number) => {
      if (!isSimulationOpenRef.current) return;
      syncAndGetEffectiveNowMs();
      setStagePreviewPreset(null);
      const nextSimNow = simNowMsRef.current + deltaMs;
      simNowMsRef.current = nextSimNow;
      lastSimRealTickRef.current = getNowRef.current();
      setSimNowMs(nextSimNow);
    },
    [syncAndGetEffectiveNowMs]
  );

  /**
   * Симулирует полную неделю (7 дней) успешного выполнения выбранного плана
   * для выбранной привычки или для всех привычек в симуляции.
   */
  const simulatePlanWeek = useCallback(
    (targetHabitId?: string) => {
      if (!isSimulationOpenRef.current) return;
      const baseSimNow = syncAndGetEffectiveNowMs();
      setStagePreviewPreset(null);

      const startDayKey = toLocalDateKey(baseSimNow);
      const nextSimNowMs = baseSimNow + 7 * 86_400_000;

      const slice = simStateRef.current;
      const nextHabits = slice.habits.map((h) => {
        if (targetHabitId && h.id !== targetHabitId) {
          return h;
        }
        const needed = Math.min(7, Math.max(1, h.targetDaysPerWeek));
        const chosenDayOffsets = new Set<number>();
        for (let k = 0; k < needed; k++) {
          const offset = Math.min(6, Math.floor((k * 7) / needed));
          chosenDayOffsets.add(offset);
        }
        for (let d = 0; d < 7 && chosenDayOffsets.size < needed; d++) {
          chosenDayOffsets.add(d);
        }

        let updated = { ...h };
        for (const dOffset of Array.from(chosenDayOffsets).sort((a, b) => a - b)) {
          const dKey = addDaysToDateKey(startDayKey, dOffset);
          const eventTimeMs = Math.max(
            baseSimNow + 3_600_000,
            startOfLocalDayMs(dKey) + 12 * 3_600_000
          );
          if (updated.mode === 'check') {
            if (!updated.checks.some((c) => c.dateKey === dKey)) {
              updated = {
                ...updated,
                checks: [...updated.checks, { dateKey: dKey, completedAtMs: eventTimeMs }],
                rewardedDateKeys: updated.rewardedDateKeys.includes(dKey)
                  ? updated.rewardedDateKeys
                  : [...updated.rewardedDateKeys, dKey],
              };
            }
          } else {
            const durationMs = updated.dailyTargetMinutes * 60_000;
            const sessId = `sim_sess_${updated.id}_${dKey}_${eventTimeMs}`;
            updated = {
              ...updated,
              sessions: [
                ...updated.sessions,
                {
                  id: sessId,
                  habitId: updated.id,
                  startedAtMs: eventTimeMs - durationMs,
                  endedAtMs: eventTimeMs,
                  durationMs,
                  intervals: [{ startMs: eventTimeMs - durationMs, endMs: eventTimeMs }],
                  targetMinutesAtSession: updated.dailyTargetMinutes,
                },
              ],
              rewardedDateKeys: updated.rewardedDateKeys.includes(dKey)
                ? updated.rewardedDateKeys
                : [...updated.rewardedDateKeys, dKey],
            };
          }
        }
        return updated;
      });

      commitSimState({
        habits: nextHabits,
        activeTimer: slice.activeTimer,
      });

      simNowMsRef.current = nextSimNowMs;
      lastSimRealTickRef.current = getNowRef.current();
      setSimNowMs(nextSimNowMs);
    },
    [syncAndGetEffectiveNowMs, commitSimState]
  );

  /**
   * Симулирует неделю (7 дней) полного отсутствия занятий.
   */
  const simulateNeglectWeek = useCallback(() => {
    if (!isSimulationOpenRef.current) return;
    const baseSimNow = syncAndGetEffectiveNowMs();
    setStagePreviewPreset(null);

    const slice = simStateRef.current;
    const pausedTimer = slice.activeTimer
      ? pauseActiveTimer(slice.activeTimer, baseSimNow)
      : null;

    commitSimState({
      habits: slice.habits,
      activeTimer: pausedTimer,
    });

    const nextSimNowMs = baseSimNow + 7 * 86_400_000;
    simNowMsRef.current = nextSimNowMs;
    lastSimRealTickRef.current = getNowRef.current();
    setSimNowMs(nextSimNowMs);
  }, [syncAndGetEffectiveNowMs, commitSimState]);

  const contextValue = useMemo<AppContextValue>(
    () => ({
      nowMs,
      habits,
      activeTimer,
      selectedHabitId,
      selectHabit,
      gardenMode: storageState.gardenMode,
      hasChosenGardenMode: storageState.hasChosenGardenMode,
      chooseGardenMode,
      addHabit,
      updateHabitSettings,
      deleteHabit,
      checkInToday,
      undoCheckInToday,
      startTimerForHabit,
      pauseTimer,
      resumeTimer,
      stopAndSaveTimer,
      activeParticleHabitId,
      isSimulationOpen,
      enterSimulation,
      exitSimulation,
      advanceSimulationTime,
      simSpeedMultiplier,
      setSimSpeedMultiplier,
      simulatePlanWeek,
      simulateNeglectWeek,
      stagePreviewPreset,
      setStagePreviewPreset,
      resetSimulationToCurrentReal,
    }),
    [
      nowMs,
      habits,
      activeTimer,
      selectedHabitId,
      selectHabit,
      storageState.gardenMode,
      storageState.hasChosenGardenMode,
      chooseGardenMode,
      addHabit,
      updateHabitSettings,
      deleteHabit,
      checkInToday,
      undoCheckInToday,
      startTimerForHabit,
      pauseTimer,
      resumeTimer,
      stopAndSaveTimer,
      activeParticleHabitId,
      isSimulationOpen,
      enterSimulation,
      exitSimulation,
      advanceSimulationTime,
      simSpeedMultiplier,
      setSimSpeedMultiplier,
      simulatePlanWeek,
      simulateNeglectWeek,
      stagePreviewPreset,
      resetSimulationToCurrentReal,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
