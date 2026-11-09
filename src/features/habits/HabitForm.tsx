import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TrackingMode } from '../../domain/types';

interface HabitFormProps {
  initialValues?: {
    title: string;
    mode: TrackingMode;
    targetDaysPerWeek: number;
    dailyTargetMinutes: number;
  };
  isEdit?: boolean;
  onSubmit: (values: {
    title: string;
    mode: TrackingMode;
    targetDaysPerWeek: number;
    dailyTargetMinutes: number;
  }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export const HabitForm: React.FC<HabitFormProps> = ({
  initialValues,
  isEdit = false,
  onSubmit,
  onCancel,
  onDelete,
}) => {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [mode, setMode] = useState<TrackingMode>(initialValues?.mode ?? 'check');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState<number>(
    initialValues?.targetDaysPerWeek ?? 4
  );
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState<string>(
    String(initialValues?.dailyTargetMinutes ?? 20)
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Введите название привычки');
      return;
    }

    const parsedMinutes = Number(dailyTargetMinutes);
    if (
      mode === 'timer' &&
      (!Number.isFinite(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 720)
    ) {
      setError('Укажите дневную цель таймера от 1 до 720 минут');
      return;
    }

    setError(null);
    onSubmit({
      title: trimmed,
      mode,
      targetDaysPerWeek,
      dailyTargetMinutes: mode === 'timer' ? Math.round(parsedMinutes) : 15,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
      <div>
        <label
          htmlFor="habit-title-input"
          className="block text-xs sm:text-sm font-medium text-[#111111] mb-1"
        >
          Название привычки
        </label>
        <input
          id="habit-title-input"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Например: Утреннее чтение"
          autoFocus
          className="w-full min-h-[40px] px-3.5 py-1.5 bg-white border border-[#CCCCCC] focus:border-[#111111] rounded-xl text-sm text-[#111111] placeholder:text-[#8C8C8C]"
        />
      </div>

      {!isEdit && (
        <div>
          <span className="block text-xs sm:text-sm font-medium text-[#111111] mb-1">
            Способ учёта
          </span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Способ учёта">
            <Button
              type="button"
              variant={mode === 'check' ? 'selected' : 'secondary'}
              size="sm"
              onClick={() => setMode('check')}
              aria-pressed={mode === 'check'}
            >
              Отметка за день
            </Button>
            <Button
              type="button"
              variant={mode === 'timer' ? 'selected' : 'secondary'}
              size="sm"
              onClick={() => setMode('timer')}
              aria-pressed={mode === 'timer'}
            >
              Таймер времени
            </Button>
          </div>
        </div>
      )}

      {/* Компактный блок с кружками выбора цели (1–7 дней) */}
      <div
        data-testid="target-days-circles-block"
        className="bg-[#FAFAFA] border border-[#ECECEC] rounded-xl px-3 py-2.5"
      >
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-xs sm:text-sm font-medium text-[#111111]">
            Цель за 7-дневный период
          </span>
          <span className="text-xs text-[#666666] tabular-nums shrink-0">
            {targetDaysPerWeek} из 7 дн.
          </span>
        </div>
        <div
          className="grid grid-cols-7 gap-1 w-full max-w-[288px] mx-auto sm:mx-0"
          role="group"
          aria-label="Количество дней за семидневный период"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((dayCount) => {
            const isSelected = targetDaysPerWeek === dayCount;
            return (
              <button
                key={dayCount}
                type="button"
                onClick={() => setTargetDaysPerWeek(dayCount)}
                aria-label={`${dayCount} дн. за период`}
                aria-pressed={isSelected}
                data-testid={`target-day-circle-${dayCount}`}
                className="group/circle min-h-[38px] w-full flex items-center justify-center rounded-full cursor-pointer select-none focus-visible:outline-none enabled:active:scale-[0.95] transition-transform"
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium tabular-nums transition-all duration-150 group-focus-visible/circle:ring-2 group-focus-visible/circle:ring-[#111111] group-focus-visible/circle:ring-offset-2 ${
                    isSelected
                      ? 'bg-[#111111] text-white border border-[#111111] shadow-[0_1px_3px_rgba(17,17,17,0.22)]'
                      : 'bg-white text-[#111111] border border-[#D4D4D8] group-hover/circle:border-[#111111] group-hover/circle:bg-[#F2F2F7]'
                  }`}
                >
                  {dayCount}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[#666666]">
          Свободное расписание: можно выполнять в любые дни внутри каждого 7-дневного периода.
        </p>
      </div>

      {mode === 'timer' && (
        <div>
          <label
            htmlFor="habit-minutes-input"
            className="block text-xs sm:text-sm font-medium text-[#111111] mb-1"
          >
            Дневная цель (в минутах)
          </label>
          <input
            id="habit-minutes-input"
            type="number"
            min={1}
            max={720}
            value={dailyTargetMinutes}
            onChange={(e) => {
              setDailyTargetMinutes(e.target.value);
              if (error) setError(null);
            }}
            className="w-full min-h-[40px] px-3.5 py-1.5 bg-white border border-[#CCCCCC] focus:border-[#111111] rounded-xl text-sm text-[#111111] tabular-nums"
          />
          <p className="mt-1 text-[11px] leading-snug text-[#666666]">
            Короткие сессии суммируются за день. День засчитывается при достижении цели.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-xs font-medium text-[#111111] bg-[#F5F5F5] border border-[#111111] rounded-xl px-3 py-2"
        >
          {error}
        </p>
      )}

      {!isEdit && (
        <p className="text-[11px] text-[#666666]">
          Новая привычка появится в саду молодым ростком в маленьком горшке.
        </p>
      )}

      <div className="pt-1 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" size="md">
          {isEdit ? 'Сохранить изменения' : 'Посадить росток'}
        </Button>
      </div>

      {isEdit && onDelete && (
        <div className="pt-2.5 border-t border-[#ECECEC] flex items-center justify-between">
          {!confirmDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              Удалить привычку из сада
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full justify-between">
              <span className="text-xs text-[#111111]">Удалить дерево и всю историю?</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Нет
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={onDelete}>
                  Да, удалить
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
};
