import React from 'react';
import { Clock, FastForward, RotateCcw, X } from 'lucide-react';
import { StagePreviewPreset, useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { formatShortDateRu, toLocalDateKey } from '../../domain/calendar';

const STAGE_PRESETS: Array<{ id: Exclude<StagePreviewPreset, null>; label: string }> = [
  { id: 'sprout', label: 'Росток в маленьком горшке' },
  { id: 'young', label: 'Молодое дерево' },
  { id: 'large', label: 'Крупное дерево в кадке' },
  { id: 'mature', label: 'Зрелое дерево в кадке' },
  { id: 'wilted', label: 'Голый ствол (увядание)' },
  { id: 'recovering', label: 'Почки (восстановление)' },
];

const SPEED_OPTIONS = [1, 10, 60] as const;

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
    simSpeedMultiplier,
    setSimSpeedMultiplier,
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
    second: '2-digit',
  });

  return (
    <section
      aria-label="Панель проверки времени и симуляции"
      data-testid="simulation-panel"
      className="w-full bg-white border-b border-[#111111]"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3.5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#E6E6E6]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#111111]">
              <Clock className="w-4 h-4 shrink-0" />
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetSimulationToCurrentReal}
              data-testid="sim-reset-btn"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Сбросить копию</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={exitSimulation}
              data-testid="sim-exit-btn"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span>Выйти к настоящим данным</span>
            </Button>
          </div>
        </div>

        {/* Управление шагами времени, скоростью таймера и сценариями */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#666666]">
                Перемотка тестовых часов и сценарии периода
              </span>
              <div
                className="inline-flex items-center gap-1"
                role="group"
                aria-label="Скорость течения времени в симуляции"
              >
                <span className="text-[11px] text-[#666666] mr-1">Скорость таймера:</span>
                {SPEED_OPTIONS.map((spd) => (
                  <Button
                    key={spd}
                    variant={simSpeedMultiplier === spd ? 'selected' : 'secondary'}
                    size="sm"
                    onClick={() => setSimSpeedMultiplier(spd)}
                    aria-pressed={simSpeedMultiplier === spd}
                    data-testid={`sim-speed-${spd}x`}
                    className="min-h-[28px] px-2.5 py-0.5 text-[11px] tabular-nums"
                  >
                    {spd}×
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => advanceSimulationTime(86_400_000)}
                data-testid="sim-step-day-btn"
              >
                <FastForward className="w-3.5 h-3.5 shrink-0" />
                <span>+1 день вперёд</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => advanceSimulationTime(7 * 86_400_000)}
                data-testid="sim-step-week-btn"
              >
                <FastForward className="w-3.5 h-3.5 shrink-0" />
                <span>+1 неделя вперёд</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => simulatePlanWeek(selectedHabitId ?? undefined)}
                data-testid="sim-plan-week-btn"
              >
                Неделя выполнения плана
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={simulateNeglectWeek}
                data-testid="sim-neglect-week-btn"
              >
                Неделя без занятий
              </Button>
            </div>
          </div>

          {/* Просмотр стадий дерева */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#666666]">
                Просмотр стадий дерева (визуальный эталон)
              </span>
              {stagePreviewPreset && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStagePreviewPreset(null)}
                  className="min-h-[28px] px-2.5 py-0.5 text-xs"
                >
                  Вернуть расчёт по времени
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {STAGE_PRESETS.map((preset) => {
                const isActive = stagePreviewPreset === preset.id;
                return (
                  <Button
                    key={preset.id}
                    variant={isActive ? 'selected' : 'secondary'}
                    size="sm"
                    onClick={() => setStagePreviewPreset(isActive ? null : preset.id)}
                    aria-pressed={isActive}
                    data-testid={`sim-stage-${preset.id}`}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
