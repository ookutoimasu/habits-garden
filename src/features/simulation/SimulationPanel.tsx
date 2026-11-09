import React from 'react';
import { Clock, FastForward, RotateCcw, X } from 'lucide-react';
import { StagePreviewPreset, useApp } from '../../app/AppProvider';
import { formatShortDateRu, toLocalDateKey } from '../../domain/calendar';

const STAGE_PRESETS: Array<{ id: Exclude<StagePreviewPreset, null>; label: string }> = [
  { id: 'sprout', label: 'Росток в маленьком горшке' },
  { id: 'young', label: 'Молодое дерево' },
  { id: 'large', label: 'Крупное дерево в кадке' },
  { id: 'mature', label: 'Зрелое дерево в земле' },
  { id: 'wilted', label: 'Голый ствол (увядание)' },
  { id: 'recovering', label: 'Почки (восстановление)' },
];

/**
 * Панель проверки времени и стадий дерева.
 * По умолчанию закрыта. Работает с отдельной копией данных и тестовыми часами.
 * Выход из панели возвращает настоящие данные без изменений.
 */
export const SimulationPanel: React.FC = () => {
  const {
    nowMs,
    selectedHabitId,
    isSimulationOpen,
    exitSimulation,
    advanceSimulationTime,
    simulatePlanWeek,
    simulateNeglectWeek,
    stagePreviewPreset,
    setStagePreviewPreset,
    resetSimulationToCurrentReal,
  } = useApp();

  if (!isSimulationOpen) {
    return null;
  }

  const simDateKey = toLocalDateKey(nowMs);
  const simTimeStr = new Date(nowMs).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section
      aria-label="Панель проверки времени и симуляции"
      data-testid="simulation-panel"
      className="w-full bg-white border-b border-[#111111]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E6E6E6]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#111111]">
              <Clock className="w-4 h-4" />
              <span>Режим проверки времени (изолированная копия данных)</span>
            </span>
            <span aria-hidden="true" className="text-[#8C8C8C]">
              ·
            </span>
            <span
              data-testid="sim-clock-display"
              className="text-xs font-mono text-[#111111] tabular-nums"
            >
              Тестовые часы: {formatShortDateRu(simDateKey)} ({simDateKey}), {simTimeStr}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={resetSimulationToCurrentReal}
              data-testid="sim-reset-btn"
              className="min-h-[40px] px-3 py-1.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#CCCCCC] hover:border-[#111111] rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить копию</span>
            </button>
            <button
              type="button"
              onClick={exitSimulation}
              data-testid="sim-exit-btn"
              className="min-h-[40px] px-3.5 py-1.5 bg-[#111111] hover:bg-[#2A2A2A] text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Выйти к настоящим данным</span>
            </button>
          </div>
        </div>

        {/* Управление шагами времени и сценариями */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#666666]">
              Перемотка тестовых часов и сценарии периода
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => advanceSimulationTime(86_400_000)}
                data-testid="sim-step-day-btn"
                className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#CCCCCC] hover:border-[#111111] rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>+1 день вперёд</span>
              </button>

              <button
                type="button"
                onClick={() => advanceSimulationTime(7 * 86_400_000)}
                data-testid="sim-step-week-btn"
                className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#CCCCCC] hover:border-[#111111] rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>+1 неделя вперёд</span>
              </button>

              <button
                type="button"
                onClick={() => simulatePlanWeek(selectedHabitId ?? undefined)}
                data-testid="sim-plan-week-btn"
                className="min-h-[40px] px-3.5 py-1.5 bg-[#111111] hover:bg-[#2A2A2A] text-white rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                Неделя выполнения плана
              </button>

              <button
                type="button"
                onClick={simulateNeglectWeek}
                data-testid="sim-neglect-week-btn"
                className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#111111] rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                Неделя без занятий
              </button>
            </div>
          </div>

          {/* Просмотр стадий дерева */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#666666]">
                Просмотр стадий дерева (визуальный эталон)
              </span>
              {stagePreviewPreset && (
                <button
                  type="button"
                  onClick={() => setStagePreviewPreset(null)}
                  className="text-xs text-[#111111] underline cursor-pointer"
                >
                  Вернуть расчёт по времени
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {STAGE_PRESETS.map((preset) => {
                const isActive = stagePreviewPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setStagePreviewPreset(isActive ? null : preset.id)
                    }
                    aria-pressed={isActive}
                    data-testid={`sim-stage-${preset.id}`}
                    className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#111111] border-[#CCCCCC] hover:border-[#111111]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
