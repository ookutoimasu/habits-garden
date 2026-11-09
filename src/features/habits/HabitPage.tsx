import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Settings2 } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
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
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
      {/* Верхняя панель привычки: Назад, полное Название и Настройки */}
      <div className="flex items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#E6E6E6]">
        <Button
          variant="secondary"
          size="md"
          onClick={() => selectHabit(null)}
          data-testid="back-to-garden-btn"
          className="shrink-0"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Назад в сад</span>
        </Button>

        <h1
          data-testid="habit-page-title"
          className="text-base sm:text-xl font-medium text-[#111111] text-center break-words [overflow-wrap:anywhere] flex-1 min-w-0 px-1"
        >
          {habit.title}
        </h1>

        <Button
          variant="secondary"
          size="md"
          onClick={() => setIsSettingsOpen(true)}
          data-testid="habit-settings-btn"
          aria-label="Настройки привычки"
          className="shrink-0"
        >
          <Settings2 className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Настройки</span>
        </Button>
      </div>

      {/* Крупное живое дерево и сведения о привычке */}
      <section
        aria-label="Состояние дерева привычки"
        className="w-full bg-white border border-[#E6E6E6] rounded-2xl p-5 sm:p-7 flex flex-col items-center justify-center"
      >
        <TreeView
          seed={habit.seed}
          state={treeState}
          size="detail"
          showParticles={showParticles}
        />

        {/* Спокойная текстовая сводка стадии, типа привычки, цели и общего выполнения */}
        <div className="mt-4 pt-3.5 border-t border-[#F0F0F0] w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#666666] tabular-nums">
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
          className="w-full border border-[#E6E6E6] rounded-2xl p-4 sm:p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
            <Button
              variant={todayStatus.isCompleted ? 'secondary' : 'primary'}
              size="lg"
              onClick={() => checkInToday(habit.id)}
              aria-pressed={todayStatus.isCompleted}
              data-testid="checkin-today-btn"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {todayStatus.isCompleted ? 'Выполнено сегодня' : 'Отметить выполнение'}
              </span>
            </Button>

            {todayStatus.isCompleted && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => undoCheckInToday(habit.id)}
                data-testid="undo-checkin-btn"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Отменить отметку</span>
              </Button>
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
