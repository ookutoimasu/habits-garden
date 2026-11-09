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

interface AppContextValue {
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
  simulatePlanWeek: (habitId?: string) => void;
  simulateNeglectWeek: () => void;
  stagePreviewPreset: StagePreviewPreset;
  setStagePreviewPreset: (preset: StagePreviewPreset) => void;
  resetSimulationToCurrentReal: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [realNowMs, setRealNowMs] = useState<number>(() => Date.now());
  const [storageState, setStorageState] = useState<StorageSchemaV1>(() => loadStorageState());

  // Изолированное состояние демонстрационного сада (не смешивается с личной историей)
  const [demoHabits, setDemoHabits] = useState<Habit[]>(() => buildDemoHabits(Date.now()));
  const [demoActiveTimer, setDemoActiveTimer] = useState<ActiveTimerState | null>(null);

  // Навигация: null = Сад, string = страница конкретной привычки
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  // Состояние кратковременной награды золотыми частицами
  const [activeParticleHabitId, setActiveParticleHabitId] = useState<string | null>(null);
  const particleTimeoutRef = useRef<number | null>(null);

  // Изолированный контур симуляции и проверки времени (по умолчанию закрыт)
  const [isSimulationOpen, setIsSimulationOpen] = useState<boolean>(false);
  const [simNowMs, setSimNowMs] = useState<number>(() => Date.now());
  const [simHabits, setSimHabits] = useState<Habit[]>([]);
  const [simActiveTimer, setSimActiveTimer] = useState<ActiveTimerState | null>(null);
  const [stagePreviewPreset, setStagePreviewPreset] = useState<StagePreviewPreset>(null);

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

  // Сохраняем личное состояние в localStorage при каждом изменении
  useEffect(() => {
    saveStorageState(storageState);
  }, [storageState]);

  // Тик реальных часов (раз в секунду, когда запущен таймер, иначе раз в 15 секунд)
  const effectiveActiveTimer = isSimulationOpen
    ? simActiveTimer
    : storageState.gardenMode === 'demo'
    ? demoActiveTimer
    : storageState.activeTimer;

  useEffect(() => {
    const isRunning = effectiveActiveTimer?.status === 'running';
    const intervalMs = isRunning ? 1000 : 15000;

    const id = window.setInterval(() => {
      const now = Date.now();
      setRealNowMs(now);
      if (isSimulationOpen && isRunning) {
        setSimNowMs((prev) => prev + 1000);
      }
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setRealNowMs(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveActiveTimer?.status, isSimulationOpen]);

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
    if (!activeTimer || activeTimer.status !== 'running') return;
    const targetHabit = habits.find((h) => h.id === activeTimer.habitId);
    if (!targetHabit) return;

    const { habit: updatedHabit, shouldTriggerParticles } = checkActiveTimerReward(
      targetHabit,
      activeTimer,
      nowMs
    );

    if (shouldTriggerParticles) {
      if (isSimulationOpen) {
        setSimHabits((prev) =>
          prev.map((h) => (h.id === updatedHabit.id ? updatedHabit : h))
        );
      } else if (storageState.gardenMode === 'demo') {
        setDemoHabits((prev) =>
          prev.map((h) => (h.id === updatedHabit.id ? updatedHabit : h))
        );
      } else {
        setStorageState((prev) => ({
          ...prev,
          habits: prev.habits.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)),
        }));
      }
      triggerParticlesForHabit(updatedHabit.id);
    }
  }, [
    activeTimer,
    habits,
    nowMs,
    isSimulationOpen,
    storageState.gardenMode,
    triggerParticlesForHabit,
  ]);

  // Вспомогательный мутатор текущего активного списка привычек и таймера
  const updateCurrentContext = useCallback(
    (
      updater: (
        currentHabits: Habit[],
        currentTimer: ActiveTimerState | null
      ) => {
        habits: Habit[];
        activeTimer: ActiveTimerState | null;
      }
    ) => {
      if (isSimulationOpen) {
        const next = updater(simHabits, simActiveTimer);
        setSimHabits(next.habits);
        setSimActiveTimer(next.activeTimer);
        return;
      }
      if (storageState.gardenMode === 'demo') {
        const next = updater(demoHabits, demoActiveTimer);
        setDemoHabits(next.habits);
        setDemoActiveTimer(next.activeTimer);
        return;
      }
      setStorageState((prev) => {
        const next = updater(prev.habits, prev.activeTimer);
        return {
          ...prev,
          hasChosenGardenMode: true,
          habits: next.habits,
          activeTimer: next.activeTimer,
        };
      });
    },
    [
      isSimulationOpen,
      simHabits,
      simActiveTimer,
      storageState.gardenMode,
      demoHabits,
      demoActiveTimer,
    ]
  );

  const chooseGardenMode = useCallback((mode: 'personal' | 'demo') => {
    setStorageState((prev) => ({
      ...prev,
      hasChosenGardenMode: true,
      gardenMode: mode,
    }));
    setSelectedHabitId(null);
  }, []);

  const selectHabit = useCallback((habitId: string | null) => {
    setSelectedHabitId(habitId);
  }, []);

  const addHabit = useCallback(
    (params: {
      title: string;
      mode: TrackingMode;
      targetDaysPerWeek: number;
      dailyTargetMinutes?: number;
    }): Habit => {
      const createParams: CreateHabitParams = {
        ...params,
        createdAtMs: nowMs,
      };
      const newHabit = createHabit(createParams);
      updateCurrentContext((currHabits, currTimer) => ({
        habits: [newHabit, ...currHabits],
        activeTimer: currTimer,
      }));
      return newHabit;
    },
    [nowMs, updateCurrentContext]
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
      updateCurrentContext((currHabits, currTimer) => ({
        habits: currHabits.map((h) =>
          h.id === habitId ? applyHabitSettingsUpdate(h, params) : h
        ),
        activeTimer: currTimer,
      }));
    },
    [updateCurrentContext]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      updateCurrentContext((currHabits, currTimer) => ({
        habits: currHabits.filter((h) => h.id !== habitId),
        activeTimer: currTimer?.habitId === habitId ? null : currTimer,
      }));
      if (selectedHabitId === habitId) {
        setSelectedHabitId(null);
      }
    },
    [updateCurrentContext, selectedHabitId]
  );

  const checkInToday = useCallback(
    (habitId: string) => {
      const todayKey = toLocalDateKey(nowMs);
      let shouldReward = false;
      updateCurrentContext((currHabits, currTimer) => {
        const nextHabits = currHabits.map((h) => {
          if (h.id !== habitId) return h;
          const res = checkInHabitForDay(h, todayKey, nowMs);
          if (res.shouldTriggerParticles) {
            shouldReward = true;
          }
          return res.habit;
        });
        return { habits: nextHabits, activeTimer: currTimer };
      });
      if (shouldReward) {
        triggerParticlesForHabit(habitId);
      }
    },
    [nowMs, updateCurrentContext, triggerParticlesForHabit]
  );

  const undoCheckInToday = useCallback(
    (habitId: string) => {
      const todayKey = toLocalDateKey(nowMs);
      updateCurrentContext((currHabits, currTimer) => ({
        habits: currHabits.map((h) =>
          h.id === habitId ? undoCheckInHabitForDay(h, todayKey).habit : h
        ),
        activeTimer: currTimer,
      }));
    },
    [nowMs, updateCurrentContext]
  );

  const startTimerForHabit = useCallback(
    (habitId: string) => {
      let shouldReward = false;
      let rewardedHabitId: string | null = null;

      updateCurrentContext((currHabits, currTimer) => {
        let updatedHabits = currHabits;
        // Если уже был запущен другой таймер, корректно сохраняем его сессию перед запуском нового
        if (currTimer && currTimer.habitId !== habitId) {
          const stoppedSession = stopActiveTimer(currTimer, nowMs);
          if (stoppedSession) {
            updatedHabits = currHabits.map((h) => {
              if (h.id !== currTimer.habitId) return h;
              const rec = recordTimerSession(h, stoppedSession, nowMs);
              if (rec.shouldTriggerParticles) {
                shouldReward = true;
                rewardedHabitId = h.id;
              }
              return rec.habit;
            });
          }
        } else if (currTimer && currTimer.habitId === habitId) {
          return { habits: currHabits, activeTimer: currTimer };
        }

        const nextTimer = startNewTimer(habitId, nowMs);
        return {
          habits: updatedHabits,
          activeTimer: nextTimer,
        };
      });

      if (shouldReward && rewardedHabitId) {
        triggerParticlesForHabit(rewardedHabitId);
      }
    },
    [nowMs, updateCurrentContext, triggerParticlesForHabit]
  );

  const pauseTimer = useCallback(() => {
    updateCurrentContext((currHabits, currTimer) => {
      if (!currTimer) return { habits: currHabits, activeTimer: null };
      return {
        habits: currHabits,
        activeTimer: pauseActiveTimer(currTimer, nowMs),
      };
    });
  }, [nowMs, updateCurrentContext]);

  const resumeTimer = useCallback(() => {
    updateCurrentContext((currHabits, currTimer) => {
      if (!currTimer) return { habits: currHabits, activeTimer: null };
      return {
        habits: currHabits,
        activeTimer: resumeActiveTimer(currTimer, nowMs),
      };
    });
  }, [nowMs, updateCurrentContext]);

  const stopAndSaveTimer = useCallback(() => {
    let shouldReward = false;
    let targetId: string | null = null;

    updateCurrentContext((currHabits, currTimer) => {
      if (!currTimer) {
        return { habits: currHabits, activeTimer: null };
      }
      targetId = currTimer.habitId;
      const session = stopActiveTimer(currTimer, nowMs);
      if (!session) {
        return { habits: currHabits, activeTimer: null };
      }
      const nextHabits = currHabits.map((h) => {
        if (h.id !== currTimer.habitId) return h;
        const res = recordTimerSession(h, session, nowMs);
        if (res.shouldTriggerParticles) {
          shouldReward = true;
        }
        return res.habit;
      });
      return {
        habits: nextHabits,
        activeTimer: null,
      };
    });

    if (shouldReward && targetId) {
      triggerParticlesForHabit(targetId);
    }
  }, [nowMs, updateCurrentContext, triggerParticlesForHabit]);

  // Функции изолированной панели проверки времени (SimulationPanel)
  const enterSimulation = useCallback(() => {
    const sourceHabits =
      storageState.gardenMode === 'demo' ? demoHabits : storageState.habits;
    const sourceTimer =
      storageState.gardenMode === 'demo' ? demoActiveTimer : storageState.activeTimer;

    setSimHabits(JSON.parse(JSON.stringify(sourceHabits)) as Habit[]);
    setSimActiveTimer(
      sourceTimer ? (JSON.parse(JSON.stringify(sourceTimer)) as ActiveTimerState) : null
    );
    setSimNowMs(realNowMs);
    setStagePreviewPreset(null);
    setIsSimulationOpen(true);
  }, [
    storageState.gardenMode,
    storageState.habits,
    storageState.activeTimer,
    demoHabits,
    demoActiveTimer,
    realNowMs,
  ]);

  const exitSimulation = useCallback(() => {
    setIsSimulationOpen(false);
    setStagePreviewPreset(null);
  }, []);

  const resetSimulationToCurrentReal = useCallback(() => {
    const sourceHabits =
      storageState.gardenMode === 'demo' ? demoHabits : storageState.habits;
    const sourceTimer =
      storageState.gardenMode === 'demo' ? demoActiveTimer : storageState.activeTimer;

    setSimHabits(JSON.parse(JSON.stringify(sourceHabits)) as Habit[]);
    setSimActiveTimer(
      sourceTimer ? (JSON.parse(JSON.stringify(sourceTimer)) as ActiveTimerState) : null
    );
    setSimNowMs(realNowMs);
    setStagePreviewPreset(null);
  }, [
    storageState.gardenMode,
    storageState.habits,
    storageState.activeTimer,
    demoHabits,
    demoActiveTimer,
    realNowMs,
  ]);

  const advanceSimulationTime = useCallback(
    (deltaMs: number) => {
      if (!isSimulationOpen) return;
      setStagePreviewPreset(null);
      setSimNowMs((prev) => prev + deltaMs);
    },
    [isSimulationOpen]
  );

  /**
   * Симулирует полную неделю (7 дней) успешного выполнения выбранного плана
   * для выбранной привычки или для всех привычек в симуляции.
   */
  const simulatePlanWeek = useCallback(
    (targetHabitId?: string) => {
      if (!isSimulationOpen) return;
      setStagePreviewPreset(null);

      const startDayKey = toLocalDateKey(simNowMs);
      const nextSimNowMs = simNowMs + 7 * 86_400_000;

      setSimHabits((prevHabits) =>
        prevHabits.map((h) => {
          if (targetHabitId && h.id !== targetHabitId) {
            return h;
          }
          const needed = Math.min(7, Math.max(1, h.targetDaysPerWeek));
          // Равномерно распределяем `needed` выполнений по 7 дням симулируемой недели
          const chosenDayOffsets = new Set<number>();
          for (let k = 0; k < needed; k++) {
            const offset = Math.min(6, Math.floor((k * 7) / needed));
            chosenDayOffsets.add(offset);
          }
          // Если из-за округления меньше needed, добираем свободные дни
          for (let d = 0; d < 7 && chosenDayOffsets.size < needed; d++) {
            chosenDayOffsets.add(d);
          }

          let updated = { ...h };
          for (const dOffset of Array.from(chosenDayOffsets).sort((a, b) => a - b)) {
            const dKey = addDaysToDateKey(startDayKey, dOffset);
            const eventTimeMs = Math.max(
              simNowMs + 3_600_000,
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
                  },
                ],
                rewardedDateKeys: updated.rewardedDateKeys.includes(dKey)
                  ? updated.rewardedDateKeys
                  : [...updated.rewardedDateKeys, dKey],
              };
            }
          }
          return updated;
        })
      );

      setSimNowMs(nextSimNowMs);
    },
    [isSimulationOpen, simNowMs]
  );

  /**
   * Симулирует неделю (7 дней) полного отсутствия занятий.
   */
  const simulateNeglectWeek = useCallback(() => {
    if (!isSimulationOpen) return;
    setStagePreviewPreset(null);
    // Если таймер был активен в симуляции, ставим его на паузу в начале недели без занятий
    setSimActiveTimer((prev) => (prev ? pauseActiveTimer(prev, simNowMs) : null));
    setSimNowMs((prev) => prev + 7 * 86_400_000);
  }, [isSimulationOpen, simNowMs]);

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
