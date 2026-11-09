import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import {
  formatTimerDuration,
  getActiveTimerElapsedMs,
} from '../../domain/timer';
import { ActiveTimerState, DayStatus, Habit } from '../../domain/types';

interface TimerPanelProps {
  habit: Habit;
  todayStatus: DayStatus;
  activeTimer: ActiveTimerState | null;
  otherActiveHabitTitle: string | null;
  nowMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSwitchToActiveHabit?: () => void;
}

export const TimerPanel: React.FC<TimerPanelProps> = ({
  habit,
  todayStatus,
  activeTimer,
  otherActiveHabitTitle,
  nowMs,
  onStart,
  onPause,
  onResume,
  onStop,
  onSwitchToActiveHabit,
}) => {
  const isCurrentHabitTimer = activeTimer?.habitId === habit.id;
  const currentSessionMs =
    isCurrentHabitTimer && activeTimer
      ? getActiveTimerElapsedMs(activeTimer, nowMs)
      : 0;

  // Общее время за сегодня в мс (уже включает и сохранённые сессии, и активный таймер за сегодня)
  const todayTotalMs = todayStatus.totalTimerSeconds * 1000;
  const targetMs = habit.dailyTargetMinutes * 60_000;
  const remainingForGoalMs = Math.max(0, targetMs - todayTotalMs);

  return (
    <section
      aria-label="Управление таймером привычки"
      className="w-full border border-[#E6E6E6] rounded-md p-5 bg-white space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-[#666666]">
            Текущая сессия {isCurrentHabitTimer && activeTimer?.status === 'paused' ? '(на паузе)' : ''}
          </div>
          <div
            data-testid="timer-display"
            className="text-3xl font-mono font-semibold text-[#111111] tracking-tight tabular-nums mt-0.5"
          >
            {formatTimerDuration(currentSessionMs)}
          </div>
        </div>

        <div className="text-left sm:text-right text-xs text-[#666666] space-y-1 tabular-nums">
          <div>
            Сумма за сегодня:{' '}
            <span className="font-mono font-semibold text-[#111111]">
              {formatTimerDuration(todayTotalMs)}
            </span>{' '}
            из {habit.dailyTargetMinutes}:00
          </div>
          <div>
            {todayStatus.isCompleted ? (
              <span className="text-[#111111] font-medium">
                Дневная цель выполнена
              </span>
            ) : (
              <span>
                Осталось до цели сегодня: {formatTimerDuration(remainingForGoalMs)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Предупреждение, если в другой привычке запущен незавершённый таймер */}
      {!isCurrentHabitTimer && activeTimer && otherActiveHabitTitle && (
        <div className="p-3 border border-[#E6E6E6] bg-[#FAFAFA] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#666666]">
          <span>
            Сейчас есть незавершённый таймер в привычке «{otherActiveHabitTitle}». Запуск здесь автоматически остановит и сохранит его.
          </span>
          {onSwitchToActiveHabit && (
            <button
              type="button"
              onClick={onSwitchToActiveHabit}
              className="text-[#111111] underline font-medium whitespace-nowrap cursor-pointer text-left sm:text-right"
            >
              Перейти к нему
            </button>
          )}
        </div>
      )}

      {/* Кнопки управления таймером */}
      <div className="flex flex-wrap items-center gap-2.5">
        {!isCurrentHabitTimer && (
          <button
            type="button"
            onClick={onStart}
            data-testid="timer-start-btn"
            className="min-h-[46px] px-6 py-2.5 bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            <span>Начать</span>
          </button>
        )}

        {isCurrentHabitTimer && activeTimer?.status === 'running' && (
          <button
            type="button"
            onClick={onPause}
            data-testid="timer-pause-btn"
            className="min-h-[46px] px-5 py-2.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#111111] text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Pause className="w-4 h-4" />
            <span>Пауза</span>
          </button>
        )}

        {isCurrentHabitTimer && activeTimer?.status === 'paused' && (
          <button
            type="button"
            onClick={onResume}
            data-testid="timer-resume-btn"
            className="min-h-[46px] px-5 py-2.5 bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            <span>Продолжить</span>
          </button>
        )}

        {isCurrentHabitTimer && (
          <button
            type="button"
            onClick={onStop}
            data-testid="timer-stop-btn"
            className="min-h-[46px] px-5 py-2.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#CCCCCC] hover:border-[#111111] text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Square className="w-4 h-4" />
            <span>Стоп и сохранить</span>
          </button>
        )}
      </div>

      {/* Краткая сводка сохранённых сессий за сегодня */}
      {habit.sessions.length > 0 && (
        <div className="pt-2 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#666666] tabular-nums">
          <span>Всего сохранённых сессий: {habit.sessions.length}</span>
          <span>Короткие сессии суммируются в течение дня</span>
        </div>
      )}
    </section>
  );
};
