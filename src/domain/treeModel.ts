import {
  addDaysToDateKey,
  diffCalendarDays,
  endOfLocalDayMs,
  getPeriodBoundsForDateKey,
  startOfLocalDayMs,
  toLocalDateKey,
} from './calendar';
import { getCompletedDaysMap, getPeriodInfo } from './habits';
import {
  getConditionLabelRu,
  getStageFromDevelopment,
  getStageLabelRu,
  TREE_CONFIG,
} from './treeConfig';
import { ActiveTimerState, Habit, TreeBiologicalState } from './types';

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Вычисляет выраженность почек (budFactor) на основе жизненности, кроны и развития.
 * Когда дерево восстанавливается после увядания (высокая vitality, но ещё малая крона),
 * на ветвях сначала распускаются заметные почки, из которых затем вырастают листья.
 */
export function computeBudFactor(
  development: number,
  vitality: number,
  canopyRecovery: number
): number {
  if (vitality <= 0.12) {
    return 0;
  }
  // Молодой росток всегда имеет верхушечные и боковые почки
  const sproutBonus = development < TREE_CONFIG.stageThresholds.sproutMax ? 0.55 : 0.25;

  // При восстановлении кроны (canopyRecovery от 0.02 до 0.75) почки наиболее выражены
  let recoveryBuds = 0;
  if (canopyRecovery < 0.78 && vitality > 0.25) {
    const { min, peak, max } = TREE_CONFIG.budPeakCanopyRange;
    if (canopyRecovery <= peak) {
      recoveryBuds = clamp((canopyRecovery - min) / (peak - min), 0.2, 1.0);
    } else {
      recoveryBuds = clamp(1.0 - (canopyRecovery - peak) / (max - peak), 0, 1.0);
    }
    recoveryBuds *= clamp(vitality * 1.2, 0, 1);
  }

  return clamp(Math.max(sproutBonus * vitality, recoveryBuds), 0, 1);
}

/**
 * Вычисляет степень потускнения листьев (0 = свежая зелень, 1 = тусклые сухие листья перед опадением).
 */
export function computeLeafDullness(vitality: number, canopyRecovery: number): number {
  const health = vitality * 0.65 + canopyRecovery * 0.35;
  if (health >= 0.75) {
    return 0;
  }
  return clamp((0.75 - health) / 0.65, 0, 1);
}

/**
 * Чистая функция расчёта биологического состояния дерева на явно переданный момент `nowMs`.
 *
 * НЕ вызывает Date.now() внутри.
 * Используется как основным приложением, так и панелью проверки времени (SimulationPanel).
 *
 * Математические гарантии:
 * 1. Непрерывность при отметке: событие выполнения в момент `E` влияет на скорости изменения
 *    ТОЛЬКО на интервалах времени `t > E`. Поэтому в сам момент `nowMs = E` скачок `development`,
 *    `vitality` и `canopyRecovery` равен строго 0.
 * 2. Непрерывность на границах 7-дневных периодов: смена периода меняет только производные,
 *    но не само проинтегрированное значение.
 * 3. Отсутствие преждевременных штрафов: внутри открытого 7-дневного периода, пока цель периода
 *    ещё достижима в оставшиеся дни периода, штрафы не начисляются.
 * 4. План N из N (например, 3 из 3) даёт такой же недельный прирост и восстановление, как 7 из 7.
 */
export function calculateTreeState(
  habit: Habit,
  nowMs: number,
  activeTimer?: ActiveTimerState | null
): TreeBiologicalState {
  const currentTodayKey = toLocalDateKey(nowMs);
  const currentPeriod = getPeriodInfo(habit, currentTodayKey, nowMs, activeTimer);

  const startMs = Math.min(habit.createdAtMs, startOfLocalDayMs(habit.createdDateKey));
  if (nowMs <= startMs) {
    const dev = TREE_CONFIG.initialDevelopment;
    const vit = TREE_CONFIG.initialVitality;
    const can = TREE_CONFIG.initialCanopy;
    const stage = getStageFromDevelopment(dev);
    return {
      development: dev,
      vitality: vit,
      canopyRecovery: can,
      budFactor: computeBudFactor(dev, vit, can),
      leafDullness: computeLeafDullness(vit, can),
      stage,
      stageLabel: getStageLabelRu(stage),
      conditionLabel: getConditionLabelRu(vit, can),
      currentPeriod,
    };
  }

  const completedMap = getCompletedDaysMap(habit, activeTimer, nowMs);
  // Сортируем все завершённые события до nowMs
  const completionEvents: Array<{ dateKey: string; completedAtMs: number }> = [];
  for (const [dateKey, completedAtMs] of completedMap.entries()) {
    if (completedAtMs <= nowMs) {
      completionEvents.push({ dateKey, completedAtMs });
    }
  }
  completionEvents.sort((a, b) => a.completedAtMs - b.completedAtMs);

  const targetDays = Math.min(7, Math.max(1, habit.targetDaysPerWeek));

  // В каждом 7-дневном периоде учитываем не более targetDays выполнений для расчёта плана (чтобы N из N = 100%).
  const periodCounts = new Map<number, number>();
  const effectiveCompletionEvents: Array<{ dateKey: string; completedAtMs: number }> = [];
  for (const ev of completionEvents) {
    const pBounds = getPeriodBoundsForDateKey(habit.createdDateKey, ev.dateKey);
    const count = periodCounts.get(pBounds.periodIndex) ?? 0;
    if (count < targetDays) {
      periodCounts.set(pBounds.periodIndex, count + 1);
      effectiveCompletionEvents.push(ev);
    }
  }

  // Каждое выполненное занятие действует как импульс питания длительностью nourishmentWindowHours.
  // Величина импульса нормирована на 1 / targetDays недели.
  const nourishmentWindowMs = TREE_CONFIG.nourishmentWindowHours * 3_600_000;
  const nourishmentWeeksPerMs = 1 / (targetDays * nourishmentWindowMs);

  // Скорости восстановления и роста на 1 "неделю выполнения плана":
  const devPerFullWeek = TREE_CONFIG.developmentPerFullWeek;
  const canopyRecoveryPerFullWeek = 1.0 / TREE_CONFIG.recoveryWeeksForFullCanopy;
  const vitalityRecoveryPerFullWeek = 1.0 / TREE_CONFIG.vitalityRecoveryWeeks;

  // Скорость увядания в состоянии фактического запустения (в расчёте на 1 мс запустения):
  // При полном отсутствии занятий дерево доходит от начального состояния до голого ствола
  // примерно за 14–21 день (с учётом льготных дней первого периода).
  const effectiveDecayDays = Math.max(
    11.5,
    TREE_CONFIG.daysToBareTrunkUnderNeglect - (7 - targetDays) * 0.55
  );
  const decayPerMs = 1.0 / (effectiveDecayDays * 86_400_000);

  let development: number = TREE_CONFIG.initialDevelopment;
  let vitality: number = TREE_CONFIG.initialVitality;
  let canopyRecovery: number = TREE_CONFIG.initialCanopy;

  // Интегрируем по времени от createdAtMs до nowMs.
  const maxStepMs = 2 * 3_600_000;
  let cursorMs = habit.createdAtMs;

  while (cursorMs < nowMs) {
    const remainingToNow = nowMs - cursorMs;
    const baseStep = remainingToNow > 60 * 86_400_000 ? 6 * 3_600_000 : maxStepMs;
    let stepEndMs = Math.min(nowMs, cursorMs + baseStep);

    // Разбиваем шаг точно по границам начала и конца импульсов питания,
    // чтобы интеграл вычислялся аналитически точно без погрешности сетки.
    for (const ev of effectiveCompletionEvents) {
      const pulseStart = ev.completedAtMs;
      const pulseEnd = ev.completedAtMs + nourishmentWindowMs;
      if (pulseStart > cursorMs && pulseStart < stepEndMs) {
        stepEndMs = pulseStart;
      }
      if (pulseEnd > cursorMs && pulseEnd < stepEndMs) {
        stepEndMs = pulseEnd;
      }
    }

    const dtMs = stepEndMs - cursorMs;
    const midMs = cursorMs + dtMs * 0.5;

    // 1. Считаем активные импульсы питания на интервале [cursorMs, stepEndMs]
    let activePulses = 0;
    let lastCompletionMsBeforeMid: number | null = null;

    for (const ev of completionEvents) {
      if (ev.completedAtMs <= cursorMs) {
        lastCompletionMsBeforeMid = ev.completedAtMs;
      }
    }

    for (const ev of effectiveCompletionEvents) {
      if (ev.completedAtMs <= cursorMs && midMs - ev.completedAtMs < nourishmentWindowMs) {
        activePulses++;
      }
    }

    if (activePulses > 0) {
      const dWeeks = activePulses * nourishmentWeeksPerMs * dtMs;

      vitality = clamp(vitality + dWeeks * vitalityRecoveryPerFullWeek, 0, 1);
      canopyRecovery = clamp(canopyRecovery + dWeeks * canopyRecoveryPerFullWeek, 0, 1);

      // Рост ствола и ветвей идёт, когда жизненность выше порога и крона хотя бы частично жива
      if (vitality >= TREE_CONFIG.minVitalityForGrowth) {
        const vigorMultiplier =
          0.35 + 0.65 * vitality * (0.4 + 0.6 * canopyRecovery);
        development += dWeeks * devPerFullWeek * vigorMultiplier;
      }
    } else {
      // 2. Нет активного импульса питания в этот момент.
      // Проверяем, является ли этот момент законным отдыхом внутри периода или запустением.
      const sliceDateKey = toLocalDateKey(midMs);
      const periodBounds = getPeriodBoundsForDateKey(habit.createdDateKey, sliceDateKey);

      // Сколько дней уже выполнено в этом периоде к моменту cursorMs?
      let completedInPeriodSoFar = 0;
      let isSliceDayCompleted = false;
      for (const ev of completionEvents) {
        if (ev.completedAtMs <= cursorMs) {
          const dDiff = diffCalendarDays(periodBounds.startDateKey, ev.dateKey);
          if (dDiff >= 0 && dDiff < 7) {
            completedInPeriodSoFar++;
            if (ev.dateKey === sliceDateKey) {
              isSliceDayCompleted = true;
            }
          }
        }
      }

      // Сколько календарных дней осталось в текущем 7-дневном периоде (включая текущий день, если он ещё не выполнен)?
      const dayIndexInPeriod = diffCalendarDays(periodBounds.startDateKey, sliceDateKey); // 0..6
      const futureDaysInPeriod = Math.max(0, 6 - dayIndexInPeriod);
      const remainingPossibleInPeriod =
        futureDaysInPeriod + (isSliceDayCompleted ? 0 : 1);
      const neededInPeriod = Math.max(0, targetDays - completedInPeriodSoFar);

      // Был ли предыдущий период выполнен (если periodIndex > 0)?
      let previousPeriodFailed = false;
      if (periodBounds.periodIndex > 0) {
        const prevStartKey = addDaysToDateKey(periodBounds.startDateKey, -7);
        let prevCompleted = 0;
        for (const ev of completionEvents) {
          if (ev.completedAtMs <= cursorMs) {
            const dDiff = diffCalendarDays(prevStartKey, ev.dateKey);
            if (dDiff >= 0 && dDiff < 7) {
              prevCompleted++;
            }
          }
        }
        if (prevCompleted < targetDays) {
          previousPeriodFailed = true;
        }
      }

      // Для ежедневного плана (7/7) даём льготное окно 36 часов от создания или последнего выполнения,
      // чтобы не штрафовать в течение текущего рабочего дня.
      const referenceLastActiveMs = lastCompletionMsBeforeMid ?? habit.createdAtMs;
      const hoursSinceLastActive = (midMs - referenceLastActiveMs) / 3_600_000;
      const graceHours = targetDays === 7 ? 36 : 24;

      // Запустение наступает ТОЛЬКО если:
      // 1) Прошло больше базового льготного окна И
      // 2) В текущем периоде план уже недостижим (neededInPeriod > remainingPossibleInPeriod)
      //    ИЛИ предыдущий период был провален и пользователь до сих пор не возобновил занятия.
      const isPlanStillAchievableInCurrentPeriod =
        neededInPeriod <= remainingPossibleInPeriod;

      const isNeglected =
        hoursSinceLastActive > graceHours &&
        (!isPlanStillAchievableInCurrentPeriod ||
          (previousPeriodFailed && completedInPeriodSoFar === 0));

      if (isNeglected) {
        const dDecay = decayPerMs * dtMs;
        vitality = clamp(vitality - dDecay * 1.08, 0, 1);
        // Листья сначала тускнеют (при снижении vitality), а затем опадают
        const canopyDecayFactor = vitality < 0.65 ? 1.12 : 0.78;
        canopyRecovery = clamp(canopyRecovery - dDecay * canopyDecayFactor, 0, 1);
      }
    }

    cursorMs = stepEndMs;
  }

  const stage = getStageFromDevelopment(development);
  const budFactor = computeBudFactor(development, vitality, canopyRecovery);
  const leafDullness = computeLeafDullness(vitality, canopyRecovery);

  return {
    development,
    vitality,
    canopyRecovery,
    budFactor,
    leafDullness,
    stage,
    stageLabel: getStageLabelRu(stage),
    conditionLabel: getConditionLabelRu(vitality, canopyRecovery),
    currentPeriod,
  };
}

/**
 * Создаёт синтетическое состояние дерева для режима предпросмотра стадий в панели проверки.
 */
export function createPreviewTreeState(
  stagePreset: 'sprout' | 'young' | 'large' | 'mature' | 'wilted' | 'recovering',
  currentPeriod: TreeBiologicalState['currentPeriod']
): TreeBiologicalState {
  const presets: Record<
    typeof stagePreset,
    { dev: number; vit: number; can: number }
  > = {
    sprout: { dev: 8, vit: 0.95, can: 0.92 },
    young: { dev: 30, vit: 0.95, can: 0.95 },
    large: { dev: 62, vit: 0.96, can: 0.96 },
    mature: { dev: 102, vit: 0.98, can: 0.98 },
    wilted: { dev: 62, vit: 0.0, can: 0.0 },
    recovering: { dev: 62, vit: 0.68, can: 0.28 },
  };

  const { dev, vit, can } = presets[stagePreset];
  const stage = getStageFromDevelopment(dev);
  return {
    development: dev,
    vitality: vit,
    canopyRecovery: can,
    budFactor: computeBudFactor(dev, vit, can),
    leafDullness: computeLeafDullness(vit, can),
    stage,
    stageLabel: getStageLabelRu(stage),
    conditionLabel: getConditionLabelRu(vit, can),
    currentPeriod,
  };
}
