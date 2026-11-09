import React, { useState } from 'react';
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
    if (mode === 'timer' && (!Number.isFinite(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 720)) {
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor="habit-title-input"
          className="block text-sm font-medium text-[#111111] mb-1.5"
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
          className="w-full min-h-[44px] px-3.5 py-2 bg-white border border-[#CCCCCC] focus:border-[#111111] rounded-md text-sm text-[#111111] placeholder:text-[#8C8C8C]"
        />
      </div>

      {!isEdit && (
        <div>
          <span className="block text-sm font-medium text-[#111111] mb-1.5">
            Способ учёта
          </span>
          <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Способ учёта">
            <button
              type="button"
              onClick={() => setMode('check')}
              aria-pressed={mode === 'check'}
              className={`min-h-[44px] px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'check'
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111] border-[#CCCCCC] hover:border-[#111111]'
              }`}
            >
              Отметка за день
            </button>
            <button
              type="button"
              onClick={() => setMode('timer')}
              aria-pressed={mode === 'timer'}
              className={`min-h-[44px] px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'timer'
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111] border-[#CCCCCC] hover:border-[#111111]'
              }`}
            >
              Таймер времени
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-medium text-[#111111]">
            Цель за 7-дневный период
          </span>
          <span className="text-xs text-[#666666] tabular-nums">
            {targetDaysPerWeek} из 7 дн.
          </span>
        </div>
        <div
          className="grid grid-cols-7 gap-1.5"
          role="group"
          aria-label="Количество дней за семидневный период"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((dayCount) => (
            <button
              key={dayCount}
              type="button"
              onClick={() => setTargetDaysPerWeek(dayCount)}
              aria-label={`${dayCount} дн. за период`}
              aria-pressed={targetDaysPerWeek === dayCount}
              className={`min-h-[42px] text-sm font-medium rounded-md border transition-colors cursor-pointer tabular-nums ${
                targetDaysPerWeek === dayCount
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111] border-[#CCCCCC] hover:border-[#111111]'
              }`}
            >
              {dayCount}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-[#666666]">
          Свободное расписание: можно выполнять в любые дни внутри каждого 7-дневного периода.
        </p>
      </div>

      {mode === 'timer' && (
        <div>
          <label
            htmlFor="habit-minutes-input"
            className="block text-sm font-medium text-[#111111] mb-1.5"
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
            className="w-full min-h-[44px] px-3.5 py-2 bg-white border border-[#CCCCCC] focus:border-[#111111] rounded-md text-sm text-[#111111] tabular-nums"
          />
          <p className="mt-1.5 text-xs text-[#666666]">
            Короткие сессии суммируются за день. День засчитывается при достижении цели.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-[#111111] bg-[#F5F5F5] border border-[#111111] rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!isEdit && (
        <p className="text-xs text-[#666666]">
          Новая привычка появится в саду молодым ростком в маленьком горшке.
        </p>
      )}

      <div className="pt-2 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#111111] bg-white border border-[#CCCCCC] hover:border-[#111111] rounded-md transition-colors cursor-pointer whitespace-nowrap"
        >
          Отмена
        </button>
        <button
          type="submit"
          className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#111111] hover:bg-[#2A2A2A] rounded-md transition-colors cursor-pointer whitespace-nowrap"
        >
          {isEdit ? 'Сохранить изменения' : 'Посадить росток'}
        </button>
      </div>

      {isEdit && onDelete && (
        <div className="pt-4 border-t border-[#E6E6E6] flex items-center justify-between">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-[40px] px-3 py-1.5 text-xs text-[#666666] hover:text-[#111111] underline cursor-pointer"
            >
              Удалить привычку из сада
            </button>
          ) : (
            <div className="flex items-center gap-3 w-full justify-between">
              <span className="text-xs text-[#111111]">Удалить дерево и всю историю?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[36px] px-3 py-1 text-xs border border-[#CCCCCC] rounded-md cursor-pointer"
                >
                  Нет
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="min-h-[36px] px-3 py-1 text-xs bg-[#111111] text-white rounded-md cursor-pointer"
                >
                  Да, удалить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
};
