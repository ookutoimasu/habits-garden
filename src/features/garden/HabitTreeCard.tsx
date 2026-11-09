import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
 * В обычном состоянии отображается только само дерево на чистом белом фоне.
 * При наведении курсора мыши или фокусе с клавиатуры:
 * — позади дерева плавно появляется круглый серо-чёрный ореол;
 * — над деревом проявляется название привычки (короткое — по центру целиком,
 *   длинное — от начала строки с плавной прокруткой после паузы и возвратом в исходное положение).
 * Никакие соседние элементы не сдвигаются.
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
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollOffsetPx, setScrollOffsetPx] = useState(0);
  const [isScrollingTitle, setIsScrollingTitle] = useState(false);

  const titleContainerRef = useRef<HTMLDivElement | null>(null);
  const titleTextRef = useRef<HTMLSpanElement | null>(null);

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

  // Измеряем, помещается ли название целиком в область заголовка
  useLayoutEffect(() => {
    const checkOverflow = () => {
      const containerEl = titleContainerRef.current;
      const textEl = titleTextRef.current;
      if (!containerEl || !textEl) return;
      const overflow = textEl.scrollWidth - containerEl.clientWidth;
      setIsOverflowing(overflow > 2);
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [habit.title]);

  // Логика плавной прокрутки длинного названия после небольшой паузы при наведении/фокусе
  useEffect(() => {
    if (!isActive) {
      setIsScrollingTitle(false);
      setScrollOffsetPx(0);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return;
    }

    const containerEl = titleContainerRef.current;
    const textEl = titleTextRef.current;
    if (!containerEl || !textEl) {
      return;
    }

    const overflowPx = textEl.scrollWidth - containerEl.clientWidth;
    if (overflowPx <= 2) {
      setIsScrollingTitle(false);
      setScrollOffsetPx(0);
      return;
    }

    const timerId = window.setTimeout(() => {
      setIsScrollingTitle(true);
      setScrollOffsetPx(-(overflowPx + 4));
    }, 600);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isActive, habit.title]);

  const scrollDurationMs = Math.max(1800, Math.abs(scrollOffsetPx) * 28);

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
      className="group relative w-full bg-white rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center cursor-pointer select-none focus-visible:outline-none"
    >
      {/* Фиксированная область заголовка над деревом (не сдвигает сетку при появлении) */}
      <div
        ref={titleContainerRef}
        data-testid={`habit-card-title-${habit.id}`}
        className={`w-full h-7 overflow-hidden flex items-center px-1 transition-opacity duration-200 ${
          isOverflowing ? 'justify-start' : 'justify-center'
        } ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <span
          ref={titleTextRef}
          data-testid={`habit-card-title-text-${habit.id}`}
          style={{
            transform: `translateX(${scrollOffsetPx}px)`,
            transitionProperty: isScrollingTitle ? 'transform' : 'none',
            transitionDuration: isScrollingTitle ? `${scrollDurationMs}ms` : '0ms',
            transitionTimingFunction: 'linear',
          }}
          className="inline-block whitespace-nowrap text-sm font-medium text-[#111111] tracking-tight"
        >
          {habit.title}
        </span>
      </div>

      {/* Область дерева и круглого серо-чёрного ореола позади него */}
      <div className="relative w-full h-[200px] sm:h-[215px] flex items-center justify-center">
        {/* Круглый серо-чёрный ореол с мягким затемнением позади дерева */}
        <div
          aria-hidden="true"
          data-testid={`habit-card-halo-${habit.id}`}
          className={`absolute z-0 w-[180px] h-[180px] sm:w-[196px] sm:h-[196px] rounded-full tree-gallery-halo pointer-events-none transition-all duration-200 ${
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
