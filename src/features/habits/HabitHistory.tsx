import React from 'react';
import { Check } from 'lucide-react';
import {
  formatDateRangeRu,
  formatShortDateRu,
  getDayNumber,
  getWeekdayShortRu,
} from '../../domain/calendar';
import { DayStatus, PeriodInfo, TrackingMode } from '../../domain/types';

interface HabitHistoryProps {
  days: DayStatus[];
  period: PeriodInfo;
  mode: TrackingMode;
}

export const HabitHistory: React.FC<HabitHistoryProps> = ({ days, period, mode }) => {
  return (
    <section
      aria-label="История последних семи дней и текущий период"
      className="w-full border border-[#E6E6E6] rounded-2xl p-4 sm:p-5 bg-white space-y-3.5"
    >
      {/* Сводка и границы текущего 7-дневного периода */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 pb-3 border-b border-[#F0F0F0]">
        <div>
          <h3 className="text-sm font-medium text-[#111111]">
            Текущий семидневный период
          </h3>
          <p className="text-xs text-[#666666] mt-0.5 tabular-nums">
            Границы периода: {formatDateRangeRu(period.startDateKey, period.endDateKey)} (день{' '}
            {period.dayOfPeriod} из 7)
          </p>
        </div>

        <div className="text-xs text-[#111111] font-medium tabular-nums">
          Выполнено: {period.completedDaysCount} из {period.targetDays} дн.
          {period.isGoalMet ? ' · План периода выполнен' : ' · Период продолжается'}
        </div>
      </div>

      {/* Компактная сетка последних 7 дней */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#666666]">
            Последние 7 дней
          </span>
          <span className="text-xs text-[#666666] tabular-nums">
            {formatShortDateRu(days[0]?.dateKey ?? period.startDateKey)} —{' '}
            {formatShortDateRu(days[days.length - 1]?.dateKey ?? period.endDateKey)}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2" data-testid="history-7-days">
          {days.map((day) => {
            const weekday = getWeekdayShortRu(day.dateKey);
            const dayNum = getDayNumber(day.dateKey);
            const minutesDone = Math.floor(day.totalTimerSeconds / 60);

            return (
              <div
                key={day.dateKey}
                data-testid={`history-day-${day.dateKey}`}
                data-completed={day.isCompleted ? 'true' : 'false'}
                className={`flex flex-col items-center justify-between py-1.5 px-1 rounded-xl border text-center tabular-nums ${
                  day.isCompleted
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : day.isToday
                    ? 'bg-white text-[#111111] border-[#111111]'
                    : 'bg-white text-[#666666] border-[#E6E6E6]'
                }`}
              >
                <span className="text-[10px] opacity-80">{weekday}</span>
                <span className="text-xs sm:text-sm font-medium my-0.5">{dayNum}</span>
                <div className="h-3.5 flex items-center justify-center">
                  {day.isCompleted ? (
                    <Check className="w-3 h-3" aria-label="Выполнено" />
                  ) : mode === 'timer' && minutesDone > 0 ? (
                    <span className="text-[10px] font-mono">{minutesDone}м</span>
                  ) : (
                    <span className="text-[10px] opacity-45">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
