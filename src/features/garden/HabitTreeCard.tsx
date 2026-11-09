import React, { useMemo } from 'react';
import { StagePreviewPreset } from '../../app/AppProvider';
import { toLocalDateKey } from '../../domain/calendar';
import { getDayStatus } from '../../domain/habits';
import { formatTimerDuration, getActiveTimerElapsedMs } from '../../domain/timer';
import { calculateTreeState, createPreviewTreeState } from '../../domain/treeModel';
import { ActiveTimerState, Habit } from '../../domain/types';
import { TreeView } from '../tree/TreeView';

interface HabitTreeCardProps {
  habit: Habit;
  nowMs: number;
  activeTimer: ActiveTimerState | null;
  showParticles: boolean;
  stagePreviewPreset: StagePreviewPreset;
  onOpenHabit: (habitId: string) => void;
}

export const HabitTreeCard: React.FC<HabitTreeCardProps> = ({
  habit,
  nowMs,
  activeTimer,
  showParticles,
  stagePreviewPreset,
  onOpenHabit,
}) => {
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

  const isThisTimerActive = activeTimer?.habitId === habit.id;
  const activeElapsedMs =
    isThisTimerActive && activeTimer ? getActiveTimerElapsedMs(activeTimer, nowMs) : 0;

  const { currentPeriod } = treeState;

  return (
    <button
      type="button"
      onClick={() => onOpenHabit(habit.id)}
      data-testid={`habit-card-${habit.id}`}
      className="group w-full text-left bg-white border border-[#E6E6E6] hover:border-[#111111] rounded-md p-6 transition-colors flex flex-col justify-between cursor-pointer focus-visible:outline-2 focus-visible:outline-[#111111]"
    >
      {/* Главное визуальное пространство: живое дерево в горшке/кадке/земле */}
      <div className="w-full py-2 flex items-center justify-center">
        <TreeView
          seed={habit.seed}
          state={treeState}
          size="card"
          showParticles={showParticles}
          ariaLabel={`Дерево привычки «${habit.title}»: ${treeState.stageLabel}`}
        />
      </div>

      {/* Подпись привычки и спокойная сводка текущего периода (без капсул и тяжёлых шкал) */}
      <div className="pt-4 border-t border-[#F0F0F0] w-full">
        <h2 className="text-base font-semibold text-[#111111] group-hover:underline leading-snug truncate">
          {habit.title}
        </h2>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#666666] tabular-nums">
          <span>
            Период: {currentPeriod.completedDaysCount} из {currentPeriod.targetDays} дн.
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {habit.mode === 'timer'
              ? `Таймер (${habit.dailyTargetMinutes} мин)`
              : 'Отметка'}
          </span>
          {todayStatus.isCompleted && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#111111] font-medium">Сегодня выполнено</span>
            </>
          )}
          {isThisTimerActive && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#111111] font-mono font-medium">
                {activeTimer?.status === 'paused' ? 'Пауза ' : 'Идёт '}
                {formatTimerDuration(activeElapsedMs)}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
};
