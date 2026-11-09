import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { Button } from '../../components/ui/Button';
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
      className="w-full border border-[#E6E6E6] rounded-2xl p-4 sm:p-5 bg-white space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-[#666666]">
            Текущая сессия{' '}
            {isCurrentHabitTimer && activeTimer?.status === 'paused' ? '(на паузе)' : ''}
          </div>
          <div
            data-testid="timer-display"
            className="text-3xl font-mono font-medium text-[#111111] tracking-tight tabular-nums mt-0.5"
          >
            {formatTimerDuration(currentSessionMs)}
          </div>
        </div>

        <div className="text-left sm:text-right text-xs text-[#666666] space-y-1 tabular-nums">
          <div>
            Сумма за сегодня:{' '}
            <span className="font-mono font-medium text-[#111111]">
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
        <div className="p-3 border border-[#E6E6E6] bg-[#FAFAFA] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#666666]">
          <span>
            Сейчас есть незавершённый таймер в привычке «{otherActiveHabitTitle}». Запуск здесь
            автоматически остановит и сохранит его.
          </span>
          {onSwitchToActiveHabit && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSwitchToActiveHabit}
              className="shrink-0"
            >
              Перейти к нему
            </Button>
          )}
        </div>
      )}

      {/* Кнопки управления таймером */}
      <div className="flex flex-wrap items-center gap-2.5">
        {!isCurrentHabitTimer && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onStart}
            data-testid="timer-start-btn"
          >
            <Play className="w-4 h-4 shrink-0" />
            <span>Начать</span>
          </Button>
        )}

        {isCurrentHabitTimer && activeTimer?.status === 'running' && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onPause}
            data-testid="timer-pause-btn"
          >
            <Pause className="w-4 h-4 shrink-0" />
            <span>Пауза</span>
          </Button>
        )}

        {isCurrentHabitTimer && activeTimer?.status === 'paused' && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onResume}
            data-testid="timer-resume-btn"
          >
            <Play className="w-4 h-4 shrink-0" />
            <span>Продолжить</span>
          </Button>
        )}

        {isCurrentHabitTimer && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onStop}
            data-testid="timer-stop-btn"
          >
            <Square className="w-4 h-4 shrink-0" />
            <span>Стоп и сохранить</span>
          </Button>
        )}
      </div>

      {/* Краткая сводка сохранённых сессий за сегодня */}
      {habit.sessions.length > 0 && (
        <div
          data-testid="timer-sessions-count"
          className="pt-2 border-t border-[#F0F0F0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#666666] tabular-nums"
        >
          <span>Всего сохранённых сессий: {habit.sessions.length}</span>
          <span>Короткие сессии суммируются в течение дня</span>
        </div>
      )}
    </section>
  );
};
