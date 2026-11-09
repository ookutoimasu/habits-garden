/**
 * Утилиты локального календаря и расчёта последовательных 7-дневных периодов.
 * Все функции принимают явные временные метки и не вызывают Date.now() самостоятельно.
 */

const MONTHS_SHORT_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

const WEEKDAYS_SHORT_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function toLocalDateKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function startOfLocalDayMs(dateKey: string): number {
  const { year, month, day } = parseLocalDateKey(dateKey);
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

export function endOfLocalDayMs(dateKey: string): number {
  const { year, month, day } = parseLocalDateKey(dateKey);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const { year, month, day } = parseLocalDateKey(dateKey);
  const d = new Date(year, month - 1, day + deltaDays, 12, 0, 0, 0);
  return toLocalDateKey(d.getTime());
}

/**
 * Возвращает разницу в календарных днях: (endDateKey - startDateKey).
 * Использует полдень в UTC для защиты от переходов на летнее/зимнее время.
 */
export function diffCalendarDays(startDateKey: string, endDateKey: string): number {
  const a = parseLocalDateKey(startDateKey);
  const b = parseLocalDateKey(endDateKey);
  const utcA = Date.UTC(a.year, a.month - 1, a.day, 12, 0, 0);
  const utcB = Date.UTC(b.year, b.month - 1, b.day, 12, 0, 0);
  return Math.round((utcB - utcA) / 86_400_000);
}

export function formatShortDateRu(dateKey: string): string {
  const { month, day } = parseLocalDateKey(dateKey);
  return `${day} ${MONTHS_SHORT_RU[month - 1] ?? ''}`;
}

export function formatDateRangeRu(startDateKey: string, endDateKey: string): string {
  return `${formatShortDateRu(startDateKey)} — ${formatShortDateRu(endDateKey)}`;
}

export function getWeekdayShortRu(dateKey: string): string {
  const { year, month, day } = parseLocalDateKey(dateKey);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return WEEKDAYS_SHORT_RU[d.getDay()] ?? '';
}

export function getDayNumber(dateKey: string): number {
  return parseLocalDateKey(dateKey).day;
}

/**
 * Вычисляет границы 7-дневного периода, к которому относится targetDateKey,
 * отсчитывая последовательные 7-дневные периоды от createdDateKey.
 */
export function getPeriodBoundsForDateKey(
  createdDateKey: string,
  targetDateKey: string
): {
  periodIndex: number;
  startDateKey: string;
  endDateKey: string;
  startMs: number;
  endMs: number;
  dayOfPeriod: number;
} {
  const daysSinceCreation = Math.max(0, diffCalendarDays(createdDateKey, targetDateKey));
  const periodIndex = Math.floor(daysSinceCreation / 7);
  const periodStartOffset = periodIndex * 7;
  const startDateKey = addDaysToDateKey(createdDateKey, periodStartOffset);
  const endDateKey = addDaysToDateKey(startDateKey, 6);
  const dayOfPeriod = (daysSinceCreation % 7) + 1;

  return {
    periodIndex,
    startDateKey,
    endDateKey,
    startMs: startOfLocalDayMs(startDateKey),
    endMs: endOfLocalDayMs(endDateKey),
    dayOfPeriod,
  };
}
