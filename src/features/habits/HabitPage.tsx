import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Settings2 } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Modal } from '../../components/ui/Modal';
import { toLocalDateKey } from '../../domain/calendar';
import {
  getCompletedDaysMap,
  getDayStatus,
  getLastSevenDaysHistory,
} from '../../domain/habits';
import { formatTimerDuration, getActiveTimerElapsedMs } from '../../domain/timer';
import { calculateTreeState, createPreviewTreeState } from '../../domain/treeModel';
import { Habit } from '../../domain/types';
import { TimerPanel } from '../timer/TimerPanel';
import { TreeView } from '../tree/TreeView';
import { HabitForm } from './HabitForm';
import { HabitHistory } from './HabitHistory';

interface HabitPageProps {
  habit: Habit;
}

export const HabitPage: React.FC<HabitPageProps> = ({ habit }) => {
  const {
    nowMs,
    habits,
    activeTimer,
    selectHabit,
    updateHabitSettings,
    deleteHabit,
    checkInToday,
    undoCheckInToday,
    startTimerForHabit,
    pauseTimer,
    resumeTimer,
    stopAndSaveTimer,
    activeParticleHabitId,
    stagePreviewPreset,
  } = useApp();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const realTreeState = useMemo(
    () => calculateTreeState(habit, nowMs, activeTimer),
    [habit, nowMs, activeTimer]
  );

  const treeState = useMemo(() => {
    if (stagePreviewPreset) {
      return createPreviewTreeState(stagePreviewPreset, realTreeState.currentPeriod);
    }
    return realTreeState;
  }, [stagePreviewPreset, realTreeState]);

  const todayKey = toLocalDateKey(nowMs);
  const todayStatus = useMemo(
    () => getDayStatus(habit, todayKey, nowMs, activeTimer),
    [habit, todayKey, nowMs, activeTimer]
  );

  const historyDays = useMemo(
    () => getLastSevenDaysHistory(habit, nowMs, activeTimer),
    [habit, nowMs, activeTimer]
  );

  const totalCompletedDaysCount = useMemo(
    () => getCompletedDaysMap(habit, activeTimer, nowMs).size,
    [habit, activeTimer, nowMs]
  );

  const totalAccumulatedTimerMs = useMemo(() => {
    if (habit.mode !== 'timer') return 0;
    const savedMs = habit.sessions.reduce((acc, s) => acc + Math.max(0, s.durationMs), 0);
    const activeMs =
      activeTimer && activeTimer.habitId === habit.id
        ? getActiveTimerElapsedMs(activeTimer, nowMs)
        : 0;
    return savedMs + activeMs;
  }, [habit, activeTimer, nowMs]);

  const otherActiveHabit = useMemo(() => {
    if (!activeTimer || activeTimer.habitId === habit.id) return null;
    return habits.find((h) => h.id === activeTimer.habitId) ?? null;
  }, [activeTimer, habit.id, habits]);

  const showParticles = activeParticleHabitId === habit.id;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Верхняя панель привычки: Назад, Название и Настройки */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E6E6E6]">
        <button
          type="button"
          onClick={() => selectHabit(null)}
          data-testid="back-to-garden-btn"
          className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-[#F5F5F5] border border-[#E6E6E6] hover:border-[#111111] rounded-md text-sm font-medium text-[#111111] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад в сад</span>
        </button>

        <h1 className="text-lg sm:text-xl font-medium text-[#111111] text-center truncate">
          {habit.title}
        </h1>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          data-testid="habit-settings-btn"
          aria-label="Настройки привычки"
          className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-[#F5F5F5] border border-[#E6E6E6] hover:border-[#111111] rounded-md text-sm font-medium text-[#111111] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Настройки</span>
        </button>
      </div>

      {/* Крупное живое дерево и сведения о привычке */}
      <section
        aria-label="Состояние дерева привычки"
        className="w-full bg-white border border-[#E6E6E6] rounded-md p-6 sm:p-8 flex flex-col items-center justify-center"
      >
        <TreeView
          seed={habit.seed}
          state={treeState}
          size="detail"
          showParticles={showParticles}
        />

        {/* Спокойная текстовая сводка стадии, типа привычки, цели и общего выполнения */}
        <div className="mt-5 pt-4 border-t border-[#F0F0F0] w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#666666] tabular-nums">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-[#111111]" data-testid="tree-stage-label">
              {treeState.stageLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span data-testid="tree-condition-label">{treeState.conditionLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span data-testid="habit-type-label">
              {habit.mode === 'timer'
                ? `Таймер (${habit.dailyTargetMinutes} мин в день)`
                : 'Отметка за день'}
            </span>
            <span aria-hidden="true">·</span>
            <span data-testid="habit-goal-label">
              Цель: {habit.targetDaysPerWeek} дн. за 7 дней
            </span>
            <span aria-hidden="true">·</span>
            <span data-testid="habit-total-summary" className="text-[#111111] font-medium">
              {habit.mode === 'timer'
                ? `Накоплено времени: ${formatTimerDuration(totalAccumulatedTimerMs)}`
                : `Выполнений всего: ${totalCompletedDaysCount}`}
            </span>
            {stagePreviewPreset && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#111111] font-medium">Предпросмотр стадии</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Ниже дерева: кнопка выполнения или панель таймера */}
      {habit.mode === 'check' ? (
        <section
          aria-label="Отметка выполнения за сегодня"
          className="w-full border border-[#E6E6E6] rounded-md p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="text-sm font-medium text-[#111111]">
              {todayStatus.isCompleted
                ? 'Выполнение за сегодня засчитано'
                : 'Отметить выполнение за сегодня'}
            </div>
            <p className="text-xs text-[#666666]">
              {todayStatus.isCompleted
                ? 'Дерево получило импульс питания и продолжает плавно развиваться со временем.'
                : 'Отметка засчитывает сегодняшний день и задаёт дальнейшую динамику роста дерева.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => checkInToday(habit.id)}
              aria-pressed={todayStatus.isCompleted}
              data-testid="checkin-today-btn"
              className={`min-h-[46px] px-5 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                todayStatus.isCompleted
                  ? 'bg-[#F4F4F4] text-[#111111] border border-[#CCCCCC]'
                  : 'bg-[#111111] hover:bg-[#2A2A2A] text-white'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {todayStatus.isCompleted ? 'Выполнено сегодня' : 'Отметить выполнение'}
              </span>
            </button>

            {todayStatus.isCompleted && (
              <button
                type="button"
                onClick={() => undoCheckInToday(habit.id)}
                data-testid="undo-checkin-btn"
                className="min-h-[46px] px-4 py-2.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#CCCCCC] hover:border-[#111111] rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Отменить отметку</span>
              </button>
            )}
          </div>
        </section>
      ) : (
        <TimerPanel
          habit={habit}
          todayStatus={todayStatus}
          activeTimer={activeTimer}
          otherActiveHabitTitle={otherActiveHabit?.title ?? null}
          nowMs={nowMs}
          onStart={() => startTimerForHabit(habit.id)}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onStop={stopAndSaveTimer}
          onSwitchToActiveHabit={
            otherActiveHabit ? () => selectHabit(otherActiveHabit.id) : undefined
          }
        />
      )}

      {/* Компактная история последних 7 дней и границы текущего 7-дневного периода */}
      <HabitHistory
        days={historyDays}
        period={treeState.currentPeriod}
        mode={habit.mode}
      />

      {/* Модальное окно настроек привычки */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Настройки привычки"
      >
        <HabitForm
          isEdit
          initialValues={{
            title: habit.title,
            mode: habit.mode,
            targetDaysPerWeek: habit.targetDaysPerWeek,
            dailyTargetMinutes: habit.dailyTargetMinutes,
          }}
          onCancel={() => setIsSettingsOpen(false)}
          onSubmit={(vals) => {
            updateHabitSettings(habit.id, vals);
            setIsSettingsOpen(false);
          }}
          onDelete={() => {
            deleteHabit(habit.id);
            setIsSettingsOpen(false);
          }}
        />
      </Modal>
    </div>
  );
};
