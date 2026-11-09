import React, { useMemo, useState } from 'react';
import { StagePreviewPreset } from '../../app/AppProvider';
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

/**
 * Компактный элемент галереи деревьев на главном экране.
 * В спокойном состоянии отображается только само дерево в чёрном силуэтном горшке на белом фоне.
 * При наведении курсора мыши или фокусе с клавиатуры (:focus-visible):
 * — позади дерева плавно появляется круглый серо-чёрный ореол;
 * — над деревом в слоте строго фиксированной высоты (36px) проявляется стационарное название
 *   привычки (до 2 строк, при превышении — с троеточием в конце второй строки, без бегущей строки).
 * Появление заголовка и ореола не сдвигает соседние элементы и не меняет сетку.
 */
export const HabitTreeCard: React.FC<HabitTreeCardProps> = ({
  habit,
  nowMs,
  activeTimer,
  showParticles,
  stagePreviewPreset,
  onOpenHabit,
}) => {
  const [isActive, setIsActive] = useState(false);

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

  return (
    <button
      type="button"
      onClick={() => onOpenHabit(habit.id)}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      aria-label={`${habit.title} — ${treeState.stageLabel}`}
      data-testid={`habit-card-${habit.id}`}
      data-active={isActive ? 'true' : 'false'}
      className="group relative w-full max-w-[136px] sm:max-w-[146px] bg-white rounded-xl px-1 py-0.5 flex flex-col items-center justify-start cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
    >
      {/* Строго фиксированный по высоте слот заголовка (36px) над деревом — гарантирует отсутствие сдвигов */}
      <div
        data-testid={`habit-card-title-${habit.id}`}
        className={`w-full h-[36px] min-h-[36px] max-h-[36px] overflow-hidden flex items-end justify-center px-0.5 pb-0.5 transition-opacity duration-150 ${
          isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span
          data-testid={`habit-card-title-text-${habit.id}`}
          className="w-full max-h-[34px] line-clamp-2 overflow-hidden text-ellipsis break-words [overflow-wrap:anywhere] text-center text-[12px] sm:text-[13px] leading-[16px] font-medium text-[#111111] tracking-tight"
        >
          {habit.title}
        </span>
      </div>

      {/* Компактная область дерева и круглого серо-чёрного ореола позади него */}
      <div className="relative w-[116px] h-[112px] sm:w-[126px] sm:h-[122px] flex items-center justify-center shrink-0">
        {/* Круглый серо-чёрный ореол с мягким затемнением позади дерева */}
        <div
          aria-hidden="true"
          data-testid={`habit-card-halo-${habit.id}`}
          className={`absolute z-0 w-[108px] h-[108px] sm:w-[118px] sm:h-[118px] rounded-full tree-gallery-halo pointer-events-none transition-all duration-150 ${
            isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        />

        {/* Само дерево на переднем плане */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <TreeView
            seed={habit.seed}
            state={treeState}
            size="card"
            showParticles={showParticles}
            ariaLabel={`Дерево привычки «${habit.title}»: ${treeState.stageLabel}`}
          />
        </div>
      </div>
    </button>
  );
};
